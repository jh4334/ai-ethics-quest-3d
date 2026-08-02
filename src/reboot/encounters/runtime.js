import { ENEMY_DEFINITIONS } from '../content/enemies/catalog.js';
import { createEnemyInstance, resetEnemyInstance, stepEnemy } from '../enemies/runtime.js';

function freezeEncounter(value) {
  return Object.freeze({
    ...value,
    enemies: Object.freeze([...value.enemies])
  });
}

export function attackerCapFor(deviceClass) {
  return deviceClass === 'mobile' || deviceClass === 'touch' ? 2 : 3;
}

export function getCommittedAttackerIds(encounter) {
  return Object.freeze(encounter.enemies
    .filter((enemy) => enemy.phase === 'windup' || enemy.phase === 'active')
    .map((enemy) => enemy.id));
}

export function createEncounter(definition, options = {}) {
  const enemies = definition.spawns.map((spawn) => {
    const enemyDefinition = ENEMY_DEFINITIONS[spawn.definitionId];
    if (!enemyDefinition) throw new Error(`알 수 없는 적 정의: ${spawn.definitionId}`);
    return createEnemyInstance(enemyDefinition, spawn);
  });
  return freezeEncounter({
    definition,
    deviceClass: options.deviceClass === 'mobile' || options.deviceClass === 'touch' ? options.deviceClass : 'desktop',
    enemies,
    tick: 0
  });
}

export function resetEncounter(encounter) {
  return freezeEncounter({
    ...encounter,
    enemies: encounter.enemies.map(resetEnemyInstance),
    tick: 0
  });
}

export function stepEncounter(encounter, context) {
  const cap = attackerCapFor(encounter.deviceClass);
  const committed = new Set(getCommittedAttackerIds(encounter));
  const definition = encounter.definition ?? {};
  // 진입 그레이스 — 정의가 entryGraceTicks를 저작하면 그 틱 동안 적 지각을 잠근다(onScreen=false와
  // 같은 계약). 새로 심긴 방 웨이브·리스폰 직후의 선제 피격을 막는 결정적 틱 규칙이다.
  const graceTicks = Number.isFinite(definition.entryGraceTicks) ? definition.entryGraceTicks : 0;
  const perceptionHeld = encounter.tick < graceTicks;
  // 방 모드(zoneMode 'room') — 존 경계로 적을 동결하지 않는다: 플레이어가 리시 존 밖 한 걸음에
  // 있어도 같은 존으로 취급해 방 walkable 전체가 교전 구역이 된다(무저항 처치 악용 방지).
  const sharedZone = definition.zoneMode === 'room';
  const events = [];
  const feedback = [];
  const enemies = [];
  for (const enemy of encounter.enemies) {
    const targetedEffects = [...(context.effects ?? []), ...(context.contacts ?? [])]
      .filter((effect) => effect.targetId === undefined || effect.targetId === enemy.id);
    const canCommit = committed.has(enemy.id) || committed.size < cap;
    const player = sharedZone && context.player
      ? { ...context.player, zoneId: enemy.zoneId }
      : context.player;
    const result = stepEnemy(enemy, {
      ...context,
      canCommit,
      effects: targetedEffects,
      onScreen: perceptionHeld ? false : context.onScreen,
      player
    });
    enemies.push(result.state);
    events.push(...result.events);
    feedback.push(...result.feedback);
    const nowCommitted = result.state.phase === 'windup' || result.state.phase === 'active';
    if (nowCommitted) committed.add(enemy.id);
    else committed.delete(enemy.id);
  }
  const state = freezeEncounter({ ...encounter, enemies, tick: encounter.tick + 1 });
  return Object.freeze({
    events: Object.freeze(events),
    feedback: Object.freeze(feedback),
    state
  });
}
