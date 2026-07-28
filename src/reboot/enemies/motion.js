import { patchEnemyState } from './state.js';

function turnToward(current, target, maximum) {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + Math.max(-maximum, Math.min(maximum, difference));
}
function advanceCommitted(enemy, move) {
  const nextTick = enemy.phaseTick + 1;
  if (enemy.phase === 'windup' && nextTick >= move.timing.windupTicks) {
    return patchEnemyState(enemy, { phase: 'active', phaseTick: 0 });
  }
  if (enemy.phase === 'active' && nextTick >= move.timing.activeTicks) {
    return patchEnemyState(enemy, { phase: 'recover', phaseTick: 0 });
  }
  if (enemy.phase === 'recover' && nextTick >= move.timing.recoveryTicks) {
    return patchEnemyState(enemy, { cooldownTicks: 0, faceTicks: 0, phase: 'idle', phaseTick: 0 });
  }
  return patchEnemyState(enemy, { phaseTick: nextTick });
}

function advanceDisabled(enemy) {
  if (enemy.phaseTick + 1 >= enemy.phaseDuration) {
    return patchEnemyState(enemy, { faceTicks: 0, phase: 'idle', phaseDuration: 0, phaseTick: 0 });
  }
  return patchEnemyState(enemy, { phaseTick: enemy.phaseTick + 1 });
}

export function applyEnemyMotion(enemy, intent) {
  const cooldownTicks = Math.max(0, enemy.cooldownTicks - 1);
  if (intent.type === 'acquire') {
    return patchEnemyState(enemy, { cooldownTicks, lastIntent: intent.type, phase: 'acquire', targetId: intent.targetId });
  }
  if (intent.type === 'lose-target') {
    return patchEnemyState(enemy, { cooldownTicks, faceTicks: 0, lastIntent: intent.type, phase: 'idle', targetId: null });
  }
  if (intent.type === 'reposition') {
    const sign = intent.distance < intent.preferred ? -1 : 1;
    const speed = enemy.definition.stats.speed * sign;
    return patchEnemyState(enemy, {
      cooldownTicks,
      faceTicks: 0,
      lastIntent: intent.type,
      phase: 'reposition',
      position: { x: enemy.position.x + intent.direction.x * speed, z: enemy.position.z + intent.direction.z * speed }
    });
  }
  if (intent.type === 'face') {
    const targetAngle = Math.atan2(intent.direction.z, intent.direction.x);
    const facing = turnToward(enemy.facing, targetAngle, enemy.definition.stats.turnRadians);
    const remaining = Math.abs(Math.atan2(Math.sin(targetAngle - facing), Math.cos(targetAngle - facing)));
    return patchEnemyState(enemy, {
      cooldownTicks,
      faceTicks: remaining < 0.05 ? enemy.faceTicks + 1 : 0,
      facing,
      lastIntent: intent.type,
      phase: 'reposition'
    });
  }
  if (intent.type === 'commit-attack') {
    return patchEnemyState(enemy, { cooldownTicks, lastIntent: intent.type, phase: 'windup', phaseTick: 0 });
  }
  if (intent.type === 'cancel-attack') {
    return patchEnemyState(enemy, { cooldownTicks, faceTicks: 0, lastIntent: intent.type, phase: 'reposition', phaseTick: 0 });
  }
  if (intent.type === 'advance-phase') {
    if (enemy.phase === 'interrupt' || enemy.phase === 'stagger') return advanceDisabled(enemy);
    return advanceCommitted(enemy, intent.move);
  }
  return patchEnemyState(enemy, { cooldownTicks, lastIntent: intent.type });
}
