import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const unavailable = () => {
  throw new Error('Task 6 enemy foundation is not implemented');
};

const catalog = await import('../src/reboot/content/enemies/catalog.js').catch(() => ({}));
const validation = await import('../src/reboot/content/enemies/validateEnemies.js').catch(() => ({}));
const runtime = await import('../src/reboot/enemies/runtime.js').catch(() => ({}));
const perceptionModule = await import('../src/reboot/enemies/perception.js').catch(() => ({}));
const intentModule = await import('../src/reboot/enemies/intent.js').catch(() => ({}));
const motionModule = await import('../src/reboot/enemies/motion.js').catch(() => ({}));
const contactModule = await import('../src/reboot/enemies/contact.js').catch(() => ({}));
const feedbackModule = await import('../src/reboot/enemies/feedback.js').catch(() => ({}));
const encounters = await import('../src/reboot/encounters/catalog.js').catch(() => ({}));
const encounterRuntime = await import('../src/reboot/encounters/runtime.js').catch(() => ({}));

const {
  ENEMY_DEFINITIONS = {}, ERASER_DEFINITION = {}, STAMPER_DEFINITION = {}
} = catalog;
const { validateEnemyDefinitions = unavailable } = validation;
const { createEnemyInstance = unavailable, resetEnemyInstance = unavailable, stepEnemy = unavailable } = runtime;
const { perceiveEnemy = unavailable } = perceptionModule;
const { decideEnemyIntent = unavailable } = intentModule;
const { applyEnemyMotion = unavailable } = motionModule;
const { resolveEnemyContacts = unavailable } = contactModule;
const { createEnemyFeedback = unavailable } = feedbackModule;
const { MIXED_ARENA = {}, SOLO_TUTORIAL = {} } = encounters;
const {
  attackerCapFor = unavailable,
  createEncounter = unavailable,
  getCommittedAttackerIds = unavailable,
  resetEncounter = unavailable,
  stepEncounter = unavailable
} = encounterRuntime;

function player(x, zoneId = 'arena') {
  return { id: 'player', position: { x, z: 0 }, zoneId };
}

function context(x, overrides = {}) {
  return { blockers: [], effects: [], player: player(x), ...overrides };
}

function runEnemy(initial, ticks, makeContext) {
  let state = initial;
  const events = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    const result = stepEnemy(state, makeContext(tick, state));
    state = result.state;
    events.push(...result.events);
  }
  return { events, state };
}

function deepFrozen(value) {
  if (!value || typeof value !== 'object' || !Object.isFrozen(value)) return false;
  return Object.values(value).every((child) => !child || typeof child !== 'object' || deepFrozen(child));
}

test('Given the campaign enemy catalog, When validated, Then definitions are deeply immutable and complete', () => {
  // Given: the four authored enemy definitions.
  const definitions = Object.values(ENEMY_DEFINITIONS);

  // When: their authoring contract is validated.
  const result = validateEnemyDefinitions(definitions);

  // Then: ids, timings, ranges, sockets, colliders, rewards, and feedback hooks are legal.
  assert.deepEqual(definitions.map((definition) => definition.id), [
    'eraser', 'stamper', 'copycat', 'recommender', 'approval'
  ]);
  assert.deepEqual(result.errors, []);
  assert.equal(deepFrozen(ENEMY_DEFINITIONS), true);
  assert.equal(ERASER_DEFINITION.role, 'melee-pressure');
  assert.equal(STAMPER_DEFINITION.moves[0].projectile.reflectable, true);
});

test('Given malformed enemy content, When validated, Then independent authoring errors remain visible', () => {
  // Given: duplicate ids and illegal move contracts across every required field group.
  const malformed = structuredClone([ERASER_DEFINITION, STAMPER_DEFINITION]);
  malformed[1].id = malformed[0].id;
  malformed[0].moves[0].timing.windupTicks = -1;
  malformed[0].moves[0].range.max = 0;
  malformed[0].moves[0].socket = '';
  malformed[0].collider.radius = 0;
  malformed[0].reward.id = '';
  malformed[0].moves[0].feedback.contact = '';

  // When: validation runs once at the content boundary.
  const codes = validateEnemyDefinitions(malformed).errors.map((error) => error.code);

  // Then: no fault is hidden by the duplicate id.
  for (const code of ['DUPLICATE_ID', 'INVALID_TIMING', 'INVALID_RANGE', 'INVALID_SOCKET',
    'INVALID_COLLIDER', 'INVALID_REWARD', 'INVALID_FEEDBACK']) assert.equal(codes.includes(code), true);
});

test('Given one definition, When two runtime instances advance, Then state is independent while content is shared', () => {
  // Given: two Erasers created from one immutable definition.
  const first = createEnemyInstance(ERASER_DEFINITION, { id: 'eraser-a', position: { x: 0, z: 0 }, zoneId: 'arena' });
  const second = createEnemyInstance(ERASER_DEFINITION, { id: 'eraser-b', position: { x: 5, z: 0 }, zoneId: 'arena' });

  // When: only the first instance perceives the player.
  const advanced = stepEnemy(first, context(3)).state;

  // Then: definitions share identity, but neither original runtime nor sibling is mutated.
  assert.equal(first.definition, second.definition);
  assert.notDeepEqual(advanced, first);
  assert.equal(second.phase, 'idle');
  assert.equal(deepFrozen(advanced), true);
});

test('Given pure pipeline stages, When perception becomes actionable, Then each stage returns a separate value', () => {
  // Given: a facing Eraser and a visible player in the same zone.
  const enemy = createEnemyInstance(ERASER_DEFINITION, {
    facing: 0, id: 'eraser-pipeline', position: { x: 0, z: 0 }, zoneId: 'arena'
  });

  // When: perception, intent, motion, contact, and feedback run separately.
  const perception = perceiveEnemy(enemy, context(3));
  const intent = decideEnemyIntent(enemy, perception, { canCommit: true });
  const moved = applyEnemyMotion(enemy, intent);
  const contacted = resolveEnemyContacts(moved, []);
  const feedback = createEnemyFeedback(contacted.events, enemy.definition);

  // Then: pipeline values are immutable and do not mutate their input.
  assert.equal(perception.targetVisible, true);
  assert.equal(intent.type, 'acquire');
  assert.equal(moved.phase, 'acquire');
  assert.deepEqual(contacted.events, []);
  assert.deepEqual(feedback, []);
  assert.equal(enemy.phase, 'idle');
});

test('Given target movement, When distance and zone contracts change, Then acquire loss and reposition are deterministic', () => {
  // Given: an idle Eraser near a same-zone player.
  const enemy = createEnemyInstance(ERASER_DEFINITION, {
    facing: 0, id: 'eraser-route', position: { x: 0, z: 0 }, zoneId: 'arena'
  });

  // When: it acquires, approaches, then the player leaves its authored zone.
  const acquired = stepEnemy(enemy, context(5));
  const repositioned = stepEnemy(acquired.state, context(5));
  const lost = stepEnemy(repositioned.state, context(5, { player: player(5, 'corridor') }));

  // Then: movement is local, target loss is explicit, and no cross-zone chase occurs.
  assert.ok(acquired.events.some((event) => event.type === 'target-acquired'));
  assert.equal(repositioned.state.phase, 'reposition');
  assert.ok(repositioned.state.position.x > acquired.state.position.x);
  assert.ok(lost.events.some((event) => event.type === 'target-lost'));
  assert.deepEqual(lost.state.position, repositioned.state.position);
});

test('Given facing and blocker changes, When a Stamper prepares a shot, Then turn and windup stay fair', () => {
  // Given: a Stamper initially facing away from a visible player.
  const enemy = createEnemyInstance(STAMPER_DEFINITION, {
    facing: Math.PI, id: 'stamper-fair', position: { x: 0, z: 0 }, zoneId: 'arena'
  });

  // When: it turns until a windup starts, then a locker blocks the shot lane.
  let preparedState = enemy;
  const preparationEvents = [];
  for (let tick = 0; tick < 40 && preparedState.phase !== 'windup'; tick += 1) {
    const result = stepEnemy(preparedState, context(6));
    preparedState = result.state;
    preparationEvents.push(...result.events);
  }
  const windupIndex = preparationEvents.findIndex((event) => event.type === 'attack-committed');
  const blocked = stepEnemy(preparedState, context(6, {
    blockers: [{ id: 'locker', maxX: 4, maxZ: 1, minX: 2, minZ: -1 }]
  }));

  // Then: no instant turn-and-hit occurs, and obstruction cancels before contact.
  assert.ok(windupIndex > 0);
  assert.equal(preparationEvents.slice(0, windupIndex).some((event) => event.type === 'attack-contact'), false);
  assert.ok(blocked.events.some((event) => event.type === 'attack-cancelled'));
  assert.equal(blocked.events.some((event) => event.type === 'attack-contact'), false);
});

test('Given an unobstructed committed move, When ticks advance, Then attack and recovery are explicit', () => {
  // Given: a facing Eraser at its preferred range.
  const enemy = createEnemyInstance(ERASER_DEFINITION, {
    facing: 0, id: 'eraser-attack', position: { x: 0, z: 0 }, zoneId: 'arena'
  });

  // When: enough deterministic ticks pass for one attack cycle.
  const result = runEnemy(enemy, 90, () => context(1.2));

  // Then: commitment precedes one contact, which precedes recovery.
  const types = result.events.map((event) => event.type);
  assert.ok(types.indexOf('attack-committed') < types.indexOf('attack-contact'));
  assert.ok(types.indexOf('attack-contact') < types.indexOf('attack-recovered'));
  assert.equal(types.filter((type) => type === 'attack-contact').length >= 1, true);
});

test('Given an offscreen windup, When visibility is lost, Then hidden contact is cancelled', () => {
  // Given: a facing Stamper with an acquired target and committed windup.
  let state = createEnemyInstance(STAMPER_DEFINITION, {
    facing: 0, id: 'stamper-offscreen', position: { x: 0, z: 0 }, zoneId: 'arena'
  });
  for (let tick = 0; tick < 40 && state.phase !== 'windup'; tick += 1) {
    state = stepEnemy(state, context(6)).state;
  }

  // When: camera framing marks the threat offscreen before release.
  const result = stepEnemy(state, context(6, { onScreen: false }));

  // Then: commitment ends without authoritative contact.
  assert.ok(result.events.some((event) => event.type === 'attack-cancelled'));
  assert.equal(result.events.some((event) => event.type === 'attack-contact'), false);
});

test('Given combat effects, When interrupt stagger defeat and reset occur, Then every transition is recoverable', () => {
  // Given: a Stamper already entering its attack loop.
  const enemy = createEnemyInstance(STAMPER_DEFINITION, {
    facing: 0, id: 'stamper-states', position: { x: 0, z: 0 }, zoneId: 'arena'
  });
  const winding = runEnemy(enemy, 20, () => context(6)).state;

  // When: interrupt, stagger, lethal damage, and reset are applied in order.
  const interrupted = stepEnemy(winding, context(6, { effects: [{ type: 'interrupt', ticks: 5 }] }));
  const staggered = stepEnemy(interrupted.state, context(6, { effects: [{ type: 'stagger', ticks: 7 }] }));
  const defeated = stepEnemy(staggered.state, context(6, { effects: [{ damage: 999, id: 'lethal', type: 'damage' }] }));
  const reset = resetEnemyInstance(defeated.state);

  // Then: explicit events fire and reset restores the authored spawn without replacing the definition.
  assert.ok(interrupted.events.some((event) => event.type === 'attack-interrupted'));
  assert.equal(staggered.state.phase, 'stagger');
  assert.equal(defeated.state.phase, 'defeat');
  assert.deepEqual(reset.position, enemy.position);
  assert.equal(reset.hp, STAMPER_DEFINITION.stats.maxHp);
  assert.equal(reset.definition, enemy.definition);
});

for (const [deviceClass, expectedCap] of [['desktop', 3], ['mobile', 2]]) {
  test(`Given many ready enemies, When ${deviceClass} scheduling runs, Then committed attacks cap at ${expectedCap}`, () => {
    // Given: four identical close-pressure spawns ready to face the player.
    const definition = {
      ...MIXED_ARENA,
      spawns: [0, 1, 2, 3].map((index) => ({
        definitionId: 'eraser', facing: 0, id: `cap-${index}`, position: { x: 0, z: index * 0.1 }, zoneId: 'arena'
      }))
    };
    let encounter = createEncounter(definition, { deviceClass });

    // When: all enemies request attacks over the same ticks.
    for (let tick = 0; tick < 30; tick += 1) encounter = stepEncounter(encounter, context(1.2)).state;

    // Then: scheduler ownership never exceeds the device budget.
    assert.equal(attackerCapFor(deviceClass), expectedCap);
    assert.ok(getCommittedAttackerIds(encounter).length <= expectedCap);
  });
}

test('Given the mixed arena, When one reflected shot repeats, Then Eraser armor and reward resolve exactly once', () => {
  // Given: the authored mixed encounter and one reflected Stamper projectile id.
  let encounter = createEncounter(MIXED_ARENA, { deviceClass: 'desktop' });
  const eraser = encounter.enemies.find((enemy) => enemy.definition.role === 'melee-pressure');
  const reflected = {
    damage: 0, id: 'reflected-shot-1', kind: 'reflected-projectile', sourceId: 'stamper-mixed', targetId: eraser.id
  };

  // When: the exact same authoritative contact is delivered twice.
  const first = stepEncounter(encounter, context(8, { contacts: [reflected] }));
  const second = stepEncounter(first.state, context(8, { contacts: [reflected] }));
  const events = [...first.events, ...second.events];

  // Then: armor opens once and its reward cannot duplicate.
  assert.equal(events.filter((event) => event.type === 'armor-broken').length, 1);
  assert.equal(events.filter((event) => event.type === 'reward-granted').length, 1);
  assert.equal(second.state.enemies.find((enemy) => enemy.id === eraser.id).armor, 0);
});

test('Given authored encounters, When replayed and reset, Then fixtures stay deterministic and independent', () => {
  // Given: solo tutorial and mixed arena definitions.
  const play = () => {
    let state = createEncounter(SOLO_TUTORIAL, { deviceClass: 'mobile' });
    const events = [];
    for (let tick = 0; tick < 80; tick += 1) {
      const result = stepEncounter(state, context(6));
      state = result.state;
      events.push(...result.events);
    }
    return { events, state };
  };

  // When: the same fixture runs twice and one result resets.
  const first = play();
  const second = play();
  const reset = resetEncounter(first.state);

  // Then: both traces match and reset preserves authored instance count.
  assert.deepEqual(first, second);
  assert.equal(reset.enemies.length, SOLO_TUTORIAL.spawns.length);
  assert.equal(deepFrozen(SOLO_TUTORIAL), true);
  assert.equal(deepFrozen(MIXED_ARENA), true);
});

test('Given the enemy source boundary, When inspected, Then it stays deterministic, generic, and Three-independent', () => {
  // Given: every Task 6 runtime source file.
  const files = [
    'src/reboot/enemies/perception.js', 'src/reboot/enemies/intent.js', 'src/reboot/enemies/motion.js',
    'src/reboot/enemies/contact.js', 'src/reboot/enemies/feedback.js', 'src/reboot/enemies/runtime.js',
    'src/reboot/encounters/runtime.js'
  ];

  // When: forbidden dependencies and identity branches are searched.
  const source = files.map((file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')).join('\n');

  // Then: simulation depends on authored capabilities, never random, enemy names, or Three.
  assert.equal(/Math\.random|from ['"]three['"]|definition\.id\s*===?\s*['"](?:eraser|stamper)/.test(source), false);
});
