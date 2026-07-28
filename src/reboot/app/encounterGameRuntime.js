import { stepCombat, createCombatState } from '../sim/combatSimulation.js';
import { FIXED_HZ } from '../content/actions.js';
import { MIXED_ARENA } from '../encounters/catalog.js';
import { createEncounter, resetEncounter, stepEncounter } from '../encounters/runtime.js';

const EDGE_ACTIONS = new Set(['attack', 'dash', 'reflect', 'trace', 'secure']);
const ENCOUNTER_LEASH_RADIUS = 12;
const MAX_FRAME_SECONDS = 0.25;

function offsetEncounter(definition, origin) {
  return {
    ...definition,
    spawns: definition.spawns.map((spawn) => ({
      ...spawn,
      position: { x: spawn.position.x + origin.x, z: spawn.position.z + origin.z }
    }))
  };
}

function combatTargets(encounter, extraTargets) {
  return [...encounter.enemies.map((enemy) => ({
    hp: enemy.hp,
    id: enemy.id,
    position: { x: enemy.position.x, y: enemy.position.z }
  })), ...extraTargets];
}

function playerZone(position, origin) {
  return Math.hypot(position.x - origin.x, position.y - origin.z) <= ENCOUNTER_LEASH_RADIUS
    ? 'arena'
    : 'route';
}

function syncCombatTargets(combat, encounter) {
  for (const target of combat.targets) {
    const enemy = encounter.enemies.find((candidate) => candidate.id === target.id);
    if (!enemy) continue;
    target.position = { x: enemy.position.x, y: enemy.position.z };
    target.hp = enemy.hp;
    target.defeated = enemy.phase === 'defeat';
  }
}

function outgoingContacts(events, encounter) {
  const contacts = events
    .filter((event) => event.type === 'target-hit')
    .map((event) => ({
      damage: event.damage,
      id: event.hitId,
      kind: 'blade',
      targetId: event.targetId,
      type: 'damage'
    }));
  const reflected = events.find((event) => ['reflected', 'perfect-reflect'].includes(event.type));
  const armored = encounter.enemies.find((enemy) => enemy.armor > 0 && enemy.phase !== 'defeat');
  if (reflected && armored) {
    contacts.push({
      damage: 0,
      id: reflected.hitId,
      kind: 'reflected-projectile',
      sourceId: reflected.sourceId,
      targetId: armored.id,
      type: 'damage'
    });
  }
  return contacts;
}

function incomingContact(event, encounter, player) {
  const source = encounter.enemies.find((enemy) => enemy.id === event.enemyId);
  if (!source) return null;
  const dx = source.position.x - player.position.x;
  const dz = source.position.z - player.position.y;
  const distance = Math.hypot(dx, dz) || 1;
  return {
    contactId: `${event.enemyId}:${event.moveId}:${encounter.tick}`,
    damage: event.damage,
    position: {
      x: player.position.x + dx / distance,
      y: player.position.y + dz / distance
    },
    sourceId: event.enemyId,
    type: 'incoming'
  };
}

function releaseQueuedActions(actions, encounter) {
  const stamper = encounter.enemies.find((enemy) => (
    enemy.definition.moves[0].projectile?.reflectable === true && enemy.phase === 'windup'
  ));
  const ready = [];
  const deferred = [];
  for (const action of actions) {
    const releaseTick = stamper ? stamper.definition.moves[0].timing.windupTicks - 5 : 0;
    if (action.type === 'reflect' && stamper && stamper.phaseTick < releaseTick) deferred.push(action);
    else ready.push(action);
  }
  return { deferred, ready };
}

export function createEncounterGameRuntime({
  blockers = [], deviceClass = 'desktop', encounterDefinition = MIXED_ARENA,
  encounterOrigin = { x: 0, z: -39 }, onScreen = true,
  extraTargets = [{ hp: 100, id: 'memory-backup', position: { x: 0, y: -54 } }],
  startPosition = { x: 0, y: 0 }
} = {}) {
  const authoredEncounter = offsetEncounter(encounterDefinition, encounterOrigin);
  const createInitial = () => {
    const encounter = createEncounter(authoredEncounter, { deviceClass });
    const combat = createCombatState({ targets: combatTargets(encounter, extraTargets) });
    combat.player.position = { x: startPosition.x, y: startPosition.y };
    return { accumulator: 0, combat, encounter, pendingIncoming: [] };
  };
  let runtime = createInitial();
  let queuedActions = [];

  function getState() {
    return Object.freeze({ combat: runtime.combat, encounter: runtime.encounter });
  }

  function step(commands, environment) {
    const combatResult = stepCombat(runtime.combat, [...runtime.pendingIncoming, ...commands]);
    const contacts = outgoingContacts(combatResult.events, runtime.encounter);
    const encounterResult = stepEncounter(runtime.encounter, {
      blockers: environment.blockers,
      contacts,
      effects: [],
      onScreen: environment.onScreen,
      player: {
        id: 'player',
        position: { x: combatResult.state.player.position.x, z: combatResult.state.player.position.y },
        zoneId: playerZone(combatResult.state.player.position, encounterOrigin)
      }
    });
    syncCombatTargets(combatResult.state, encounterResult.state);
    const pendingIncoming = encounterResult.events
      .filter((event) => event.type === 'attack-contact')
      .map((event) => incomingContact(event, encounterResult.state, combatResult.state.player))
      .filter(Boolean);
    runtime = {
      ...runtime,
      combat: combatResult.state,
      encounter: encounterResult.state,
      pendingIncoming
    };
    return { combatEvents: combatResult.events, enemyEvents: encounterResult.events };
  }

  return Object.freeze({
    getState,
    queueAction(type, targetId = null) {
      if (!EDGE_ACTIONS.has(type) || queuedActions.length >= 16) return false;
      queuedActions.push(targetId ? { targetId, type } : { type });
      return true;
    },
    reset() {
      queuedActions = [];
      runtime = createInitial();
      runtime.encounter = resetEncounter(runtime.encounter);
      return getState();
    },
    update(elapsedSeconds, movement = {}, environment = {}) {
      const bounded = Number.isFinite(elapsedSeconds)
        ? Math.max(0, Math.min(MAX_FRAME_SECONDS, elapsedSeconds))
        : 0;
      runtime.accumulator += bounded * FIXED_HZ;
      const held = Number.isFinite(movement.horizontal) && Number.isFinite(movement.vertical)
        && (movement.horizontal !== 0 || movement.vertical !== 0)
        ? [{ type: 'move', x: movement.horizontal, y: movement.vertical }]
        : [];
      const combatEvents = [];
      const enemyEvents = [];
      while (runtime.accumulator + 1e-9 >= 1) {
        const release = releaseQueuedActions(queuedActions, runtime.encounter);
        queuedActions = release.deferred;
        const result = step([...held, ...release.ready], {
          blockers: environment.blockers ?? blockers,
          onScreen: environment.onScreen ?? onScreen
        });
        combatEvents.push(...result.combatEvents);
        enemyEvents.push(...result.enemyEvents);
        runtime.accumulator -= 1;
      }
      if (Math.abs(runtime.accumulator) < 1e-9) runtime.accumulator = 0;
      return Object.freeze({
        combatEvents: Object.freeze(combatEvents),
        enemyEvents: Object.freeze(enemyEvents),
        state: getState()
      });
    }
  });
}
