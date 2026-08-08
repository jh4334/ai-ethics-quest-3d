import { CHAPTER_COUNT, deepFreeze, isValidGateId, normalizeRebootState } from './model.js';

function statusFor(attempts) {
  if (attempts.some(({ outcome }) => outcome === 'legacy-grandfathered')) return 'legacy-grandfathered';
  const known = attempts.filter(({ outcome }) => outcome !== 'unknown');
  if (known.length === 0) return attempts.length > 0 ? 'unknown' : 'unattempted';
  const resolvedIndex = known.findIndex(({ outcome }) => outcome === 'resolved');
  if (resolvedIndex < 0) return 'struggling';
  return resolvedIndex === 0 ? 'first-try' : 'retry';
}

export function createLearningReport(state, gateDefinitions = []) {
  const current = normalizeRebootState(state);
  const definitions = [...gateDefinitions];
  const registered = new Set();
  for (const definition of definitions) {
    if (!definition || !isValidGateId(definition.gateId)
      || !Number.isInteger(definition.chapter) || definition.chapter < 1
      || definition.chapter > CHAPTER_COUNT || registered.has(definition.gateId)) {
      throw new RangeError('중복되지 않은 유효한 관문 정의가 필요합니다.');
    }
    registered.add(definition.gateId);
  }
  for (const attempt of current.gateAttempts) {
    if (registered.has(attempt.gateId)) continue;
    definitions.push({ chapter: attempt.chapter, gateId: attempt.gateId });
    registered.add(attempt.gateId);
  }

  const gates = definitions.map(({ chapter, gateId }) => {
    const attempts = current.gateAttempts.filter((entry) => entry.gateId === gateId);
    return {
      attempts: attempts.filter(({ outcome }) => outcome !== 'unknown').length,
      chapter,
      gateId,
      status: statusFor(attempts)
    };
  });
  return deepFreeze({
    firstTryCount: gates.filter(({ status }) => status === 'first-try').length,
    gates,
    retryCount: gates.filter(({ status }) => status === 'retry').length
  });
}
