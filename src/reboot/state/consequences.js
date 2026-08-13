import {
  CHARACTER_IDS,
  CHAPTER_COUNT,
  EVIDENCE_ACTIONS,
  EVIDENCE_IDS,
  GATE_OUTCOMES,
  PATCH_IDS,
  deepFreeze,
  isValidGateId,
  normalizeRebootState
} from './model.js';

const characterIdSet = new Set(CHARACTER_IDS);
const evidenceIdSet = new Set(EVIDENCE_IDS);
const evidenceActionSet = new Set(EVIDENCE_ACTIONS);
const gateOutcomeSet = new Set(GATE_OUTCOMES);
const patchIdSet = new Set(PATCH_IDS);

export function recordEvidenceOutcome(state, { action, chapter, evidenceId }) {
  const current = normalizeRebootState(state);
  if (!evidenceIdSet.has(evidenceId) || !evidenceActionSet.has(action)) {
    throw new RangeError('등록되지 않은 증거 결과입니다.');
  }
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > CHAPTER_COUNT) {
    throw new RangeError(`장 번호는 1부터 ${CHAPTER_COUNT}까지여야 합니다.`);
  }
  if (current.evidence.some((record) => record.evidenceId === evidenceId)) {
    return Object.isFrozen(state) ? state : current;
  }

  const securedDelta = action === 'purge' ? 0 : 1;
  const lostDelta = action === 'purge' ? 1 : 0;
  const containedDelta = action === 'expose' ? 0 : 1;
  const disclosedDelta = action === 'expose' ? 1 : 0;
  return deepFreeze({
    ...current,
    integrity: {
      secured: current.integrity.secured + securedDelta,
      lost: current.integrity.lost + lostDelta
    },
    exposure: {
      contained: current.exposure.contained + containedDelta,
      disclosed: current.exposure.disclosed + disclosedDelta
    },
    evidence: [...current.evidence, { action, chapter, evidenceId }]
  });
}

export function updateCharacterTrust(state, characterId, delta) {
  const current = normalizeRebootState(state);
  if (!characterIdSet.has(characterId) || !Number.isInteger(delta)) {
    throw new RangeError('등록된 인물과 정수 변화량이 필요합니다.');
  }
  const nextValue = Math.max(-100, Math.min(100, current.trust[characterId] + delta));
  if (nextValue === current.trust[characterId]) return Object.isFrozen(state) ? state : current;
  return deepFreeze({
    ...current,
    trust: { ...current.trust, [characterId]: nextValue }
  });
}

export function setChapterCheckpoint(state, chapter, checkpoint) {
  const current = normalizeRebootState(state);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > CHAPTER_COUNT) {
    throw new RangeError(`장 번호는 1부터 ${CHAPTER_COUNT}까지여야 합니다.`);
  }
  if (typeof checkpoint !== 'string' || !new RegExp(`^chapter-${chapter}:[a-z0-9-]+$`).test(checkpoint)) {
    throw new RangeError('체크포인트 형식이 올바르지 않습니다.');
  }
  return deepFreeze({
    ...current,
    chapterProgress: {
      completed: Array.from({ length: chapter - 1 }, (_, index) => index + 1),
      current: chapter,
      checkpoint
    }
  });
}

export function recordGateAttempt(state, { chapter, gateId, outcome }) {
  const current = normalizeRebootState(state);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > CHAPTER_COUNT
    || !isValidGateId(gateId) || !gateOutcomeSet.has(outcome)) {
    throw new RangeError('등록된 장의 유효한 관문 시도 결과가 필요합니다.');
  }
  return deepFreeze({
    ...current,
    gateAttempts: [...current.gateAttempts, { chapter, gateId, outcome }]
  });
}

export function choosePatch(state, patchId) {
  const current = normalizeRebootState(state);
  if (!patchIdSet.has(patchId)) throw new RangeError('등록되지 않은 PATCH입니다.');
  if (current.patchChoice === patchId) return Object.isFrozen(state) ? state : current;
  if (current.patchChoice !== null) throw new Error('PATCH는 한 번만 선택할 수 있습니다.');
  return deepFreeze({ ...current, patchChoice: patchId });
}
