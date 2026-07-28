function issue(code, phaseId = null) {
  return Object.freeze({ code, phaseId });
}

function validTiming(timing) {
  return timing && ['windupTicks', 'activeTicks', 'recoveryTicks']
    .every((key) => Number.isInteger(timing[key]) && timing[key] > 0);
}

export function validateBossDefinition(definition) {
  const errors = [];
  const phases = Array.isArray(definition?.phases) ? definition.phases : [];
  if (definition?.id !== 'attendance-proctor') errors.push(issue('INVALID_BOSS_ID'));
  if (!(definition?.maxHp > 0)) errors.push(issue('INVALID_MAX_HP'));
  if (!Number.isInteger(definition?.retryTicks) || definition.retryTicks < 1 || definition.retryTicks > 120) {
    errors.push(issue('INVALID_RETRY_TIME'));
  }
  if (phases.map((phase) => phase.id).join('|') !== 'reflect-scan|trace-roster|approval-core') {
    errors.push(issue('INVALID_PHASE_ORDER'));
  }
  for (const phase of phases) {
    if (!validTiming(phase.timing)) errors.push(issue('INVALID_TIMING', phase.id));
    else if (phase.timing.windupTicks < 18) errors.push(issue('SHORT_TELEGRAPH', phase.id));
    if (!Number.isInteger(phase.requiredSuccesses) || phase.requiredSuccesses < 1 || phase.requiredSuccesses > 3) {
      errors.push(issue('HEALTH_SPONGE_PHASE', phase.id));
    }
    if (!Array.isArray(phase.patterns) || phase.patterns.length < 1) errors.push(issue('MISSING_PATTERN', phase.id));
    if (phase.id === 'reflect-scan' && phase.patterns.some((pattern) => !pattern.safeLane)) {
      errors.push(issue('UNAVOIDABLE_BEAM', phase.id));
    }
    if (phase.id === 'trace-roster' && phase.patterns.some((pattern) => {
      const targets = Array.isArray(pattern.targetIds) ? pattern.targetIds : [];
      return targets.length < 3 || new Set(targets).size !== targets.length || !targets.includes(pattern.trueTargetId);
    })) errors.push(issue('INVALID_CLONE_SET', phase.id));
    if (phase.id === 'approval-core' && phase.patterns.some((pattern) => pattern.collisionChanged !== false)) {
      errors.push(issue('COLLISION_CHANGING_ERASURE', phase.id));
    }
    if (phase.id === 'approval-core' && phase.patterns.some((pattern) => pattern.safeSectors?.length < 2)) {
      errors.push(issue('NO_SAFE_GROUND', phase.id));
    }
  }
  return Object.freeze({ errors: Object.freeze(errors), valid: errors.length === 0 });
}
