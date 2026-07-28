function issue(code, definitionId, moveId = null) {
  return Object.freeze({ code, definitionId, moveId });
}
function validId(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function validTiming(timing) {
  return timing && ['windupTicks', 'activeTicks', 'recoveryTicks']
    .every((key) => Number.isInteger(timing[key]) && timing[key] > 0);
}

function validRange(range) {
  return range && Number.isFinite(range.min) && Number.isFinite(range.max)
    && Number.isFinite(range.preferred) && range.min >= 0 && range.max > range.min
    && range.preferred >= range.min && range.preferred <= range.max;
}

function validFeedback(feedback) {
  return feedback && ['windup', 'contact', 'recover']
    .every((key) => validId(feedback[key]));
}

export function validateEnemyDefinitions(definitions) {
  const errors = [];
  const definitionIds = new Set();
  const moveIds = new Set();
  for (const definition of Array.isArray(definitions) ? definitions : []) {
    const definitionId = definition?.id ?? null;
    if (!validId(definitionId)) errors.push(issue('INVALID_ID', definitionId));
    if (definitionIds.has(definitionId)) errors.push(issue('DUPLICATE_ID', definitionId));
    definitionIds.add(definitionId);
    if (!definition?.collider || !(definition.collider.radius > 0) || !(definition.collider.height > 0)) {
      errors.push(issue('INVALID_COLLIDER', definitionId));
    }
    if (!definition?.reward || !validId(definition.reward.id) || !validId(definition.reward.onceOn)) {
      errors.push(issue('INVALID_REWARD', definitionId));
    }
    if (!definition?.stats || !(definition.stats.maxHp > 0) || !(definition.stats.speed >= 0)
      || !(definition.stats.turnRadians > 0)) errors.push(issue('INVALID_STATS', definitionId));
    if (!definition?.perception || !(definition.perception.acquireRange > 0)
      || !(definition.perception.lossRange >= definition.perception.acquireRange)) {
      errors.push(issue('INVALID_PERCEPTION', definitionId));
    }
    for (const move of Array.isArray(definition?.moves) ? definition.moves : []) {
      const moveId = move?.id ?? null;
      if (!validId(moveId) || moveIds.has(moveId)) errors.push(issue('DUPLICATE_MOVE_ID', definitionId, moveId));
      moveIds.add(moveId);
      if (!validTiming(move?.timing)) errors.push(issue('INVALID_TIMING', definitionId, moveId));
      if (!validRange(move?.range)) errors.push(issue('INVALID_RANGE', definitionId, moveId));
      if (!validId(move?.socket)) errors.push(issue('INVALID_SOCKET', definitionId, moveId));
      if (!validFeedback(move?.feedback)) errors.push(issue('INVALID_FEEDBACK', definitionId, moveId));
      if (!(move?.facingDot >= -1 && move.facingDot <= 1)
        || !Number.isInteger(move?.requiredFacingTicks) || move.requiredFacingTicks < 1) {
        errors.push(issue('INVALID_FACING', definitionId, moveId));
      }
      if (move?.kind === 'projectile' && (!move.projectile || move.projectile.reflectable !== true
        || !(move.projectile.speed > 0) || !(move.projectile.radius > 0))) {
        errors.push(issue('INVALID_PROJECTILE', definitionId, moveId));
      }
    }
    if (!Array.isArray(definition?.moves) || definition.moves.length === 0) {
      errors.push(issue('MISSING_MOVE', definitionId));
    }
  }
  return Object.freeze({ errors: Object.freeze(errors), valid: errors.length === 0 });
}
