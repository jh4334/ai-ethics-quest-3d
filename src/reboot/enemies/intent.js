function facingDot(enemy, direction) {
  return Math.cos(enemy.facing) * direction.x + Math.sin(enemy.facing) * direction.z;
}
function intent(type, values = {}) {
  return Object.freeze({ type, ...values });
}

export function decideEnemyIntent(enemy, perception, options = {}) {
  const move = enemy.definition.moves[0];
  if (enemy.phase === 'defeat') return intent('hold');
  if (enemy.phase === 'interrupt' || enemy.phase === 'stagger') return intent('advance-phase', { move });
  if (enemy.phase === 'active' || enemy.phase === 'recover') return intent('advance-phase', { move });
  if (enemy.phase === 'windup') {
    const inRange = perception.distance >= move.range.min && perception.distance <= move.range.max;
    if (!perception.targetTrackable) return intent('lose-target');
    if (!perception.targetVisible || !inRange || facingDot(enemy, perception.direction) < move.facingDot) {
      return intent('cancel-attack');
    }
    return intent('advance-phase', { move });
  }
  if (enemy.targetId === null) {
    return perception.targetVisible ? intent('acquire', { targetId: perception.targetId }) : intent('hold');
  }
  if (!perception.targetTrackable) return intent('lose-target');
  if (!perception.targetVisible) return intent('hold');
  const inRange = perception.distance >= move.range.min && perception.distance <= move.range.max;
  if (!inRange) {
    return intent('reposition', {
      direction: perception.direction,
      distance: perception.distance,
      preferred: move.range.preferred
    });
  }
  if (facingDot(enemy, perception.direction) < move.facingDot
    || enemy.faceTicks < move.requiredFacingTicks) {
    return intent('face', { direction: perception.direction });
  }
  if (options.canCommit !== false && enemy.cooldownTicks === 0) return intent('commit-attack', { move });
  return intent('hold');
}
