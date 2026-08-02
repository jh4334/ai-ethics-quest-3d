import { stepCombat, createCombatState } from '../sim/combatSimulation.js';
import { FIXED_HZ, PLAYER_RULES } from '../content/actions.js';
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
  startPosition = { x: 0, y: 0 },
  // 통행 가능 경계 — {minX, maxX, minZ, maxZ} 사각형 목록(레벨 저작 데이터).
  // 플레이어는 시뮬 틱마다, 적은 reposition 이동마다 이 합집합 안으로 클램프된다.
  walkable = []
} = {}) {
  const authoredEncounter = offsetEncounter(encounterDefinition, encounterOrigin);
  // 통행 경계는 스토리 게이트에 따라 장면이 갱신할 수 있다(setWalkable) — 시뮬 틱 밖에서만 바뀐다.
  let activeWalkable = walkable;
  const createInitial = () => {
    const encounter = createEncounter(authoredEncounter, { deviceClass });
    const combat = createCombatState({ targets: combatTargets(encounter, extraTargets), walkable: activeWalkable });
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
      },
      walkable: activeWalkable
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
    // 체크포인트 복원(S6a) — 이미 정리된 구간을 재부팅했을 때, 공인 피해 접촉으로
    // 살아 있는 적을 전부 정리한다(같은 부팅 상태 → 같은 결과, 결정적).
    clearEnemiesForCheckpoint() {
      const contacts = runtime.encounter.enemies
        .filter((enemy) => enemy.phase !== 'defeat')
        .map((enemy) => ({
          damage: 9999, id: `checkpoint-clear:${enemy.id}`, targetId: enemy.id, type: 'damage'
        }));
      if (contacts.length === 0) return getState();
      const result = stepEncounter(runtime.encounter, {
        blockers: [],
        contacts,
        effects: [],
        onScreen: true,
        player: {
          id: 'player',
          position: { x: runtime.combat.player.position.x, z: runtime.combat.player.position.y },
          zoneId: playerZone(runtime.combat.player.position, encounterOrigin)
        },
        walkable: activeWalkable
      });
      runtime.encounter = result.state;
      syncCombatTargets(runtime.combat, runtime.encounter);
      return getState();
    },
    getState,
    // 웨이브 사이 소폭 회복(S6a) — 결정적 이벤트(적 격파)에서만 호출된다. 회복량을 돌려준다.
    heal(amount) {
      if (!Number.isInteger(amount) || amount <= 0) return 0;
      const player = runtime.combat.player;
      if (player.status !== 'active') return 0;
      const before = player.hp;
      player.hp = Math.min(PLAYER_RULES.maxHp, player.hp + amount);
      return player.hp - before;
    },
    queueAction(type, targetId = null) {
      if (!EDGE_ACTIONS.has(type) || queuedActions.length >= 16) return false;
      queuedActions.push(targetId ? { targetId, type } : { type });
      return true;
    },
    // 리스폰 = 체크포인트(S6a): position으로 스폰을 지정하고, keepEncounter면 적 상태
    // (격파 기록 포함)를 유지한다 — 이미 전멸시킨 구간의 적을 되살리지 않는다.
    reset({ keepEncounter = false, position = startPosition } = {}) {
      const survivors = runtime.encounter;
      queuedActions = [];
      runtime = createInitial();
      runtime.encounter = keepEncounter ? survivors : resetEncounter(runtime.encounter);
      if (keepEncounter) syncCombatTargets(runtime.combat, runtime.encounter);
      runtime.combat.player.position = { x: position.x, y: position.y };
      return getState();
    },
    // 스토리 게이트 개폐 — 다음 시뮬 틱부터 새 통행 경계가 적용된다(틱 중간 변경 없음).
    setWalkable(rects) {
      activeWalkable = Object.freeze(
        (Array.isArray(rects) ? rects : []).map((rect) => Object.freeze({ ...rect }))
      );
      runtime.combat.walkable = activeWalkable;
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
