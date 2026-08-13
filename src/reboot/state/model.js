export const SAVE_SCHEMA_VERSION = 5;
export const CHAPTER_COUNT = 6;

export const CHARACTER_IDS = Object.freeze(['dot', 'haru', 'lumen', 'yoonseo']);
export const PATCH_IDS = Object.freeze(['reflect-arc', 'trace-speed', 'chain-persistence']);
export const EVIDENCE_IDS = Object.freeze([
  'haru-memory-backup',
  'player-approval-record',
  'original-upload-trace',
  'dot-deletion-log',
  'support-record',
  'verified-package',
  'broadcast-queue'
]);
export const EVIDENCE_ACTIONS = Object.freeze(['secure', 'purge', 'expose']);
export const GATE_OUTCOMES = Object.freeze(['resolved', 'failed', 'unknown', 'legacy-grandfathered']);
export const MOTION_SETTINGS = Object.freeze(['full', 'reduced']);
export const QUALITY_SETTINGS = Object.freeze(['auto', 'low', 'medium', 'high']);

const characterIdSet = new Set(CHARACTER_IDS);
const evidenceIdSet = new Set(EVIDENCE_IDS);
const evidenceActionSet = new Set(EVIDENCE_ACTIONS);
const gateOutcomeSet = new Set(GATE_OUTCOMES);
const patchIdSet = new Set(PATCH_IDS);
const motionSet = new Set(MOTION_SETTINGS);
const qualitySet = new Set(QUALITY_SETTINGS);

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function createDefaultSettings(overrides = {}) {
  return deepFreeze({
    motion: motionSet.has(overrides.motion) ? overrides.motion : 'full',
    quality: qualitySet.has(overrides.quality) ? overrides.quality : 'auto',
    sound: typeof overrides.sound === 'boolean' ? overrides.sound : true
  });
}

export function createInitialRebootState(settings = createDefaultSettings()) {
  return deepFreeze({
    schemaVersion: SAVE_SCHEMA_VERSION,
    integrity: { secured: 0, lost: 0 },
    exposure: { contained: 0, disclosed: 0 },
    trust: { dot: 0, haru: 0, lumen: 0, yoonseo: 0 },
    chapterProgress: { completed: [], current: 1, checkpoint: 'chapter-1:start' },
    patchChoice: null,
    evidence: [],
    gateAttempts: [],
    settings: createDefaultSettings(settings)
  });
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isCount(value) {
  return Number.isInteger(value) && value >= 0;
}

function isTrust(value) {
  return Number.isInteger(value) && value >= -100 && value <= 100;
}

function isSettings(value) {
  return isRecord(value)
    && typeof value.sound === 'boolean'
    && motionSet.has(value.motion)
    && qualitySet.has(value.quality);
}

function isChapterProgress(value) {
  if (!isRecord(value) || !Number.isInteger(value.current)
    || value.current < 1 || value.current > CHAPTER_COUNT) return false;
  if (!Array.isArray(value.completed)) return false;
  const expectedCompleted = Array.from({ length: value.current - 1 }, (_, index) => index + 1);
  if (value.completed.length !== expectedCompleted.length) return false;
  if (!value.completed.every((chapter, index) => chapter === expectedCompleted[index])) return false;
  return typeof value.checkpoint === 'string'
    && new RegExp(`^chapter-${value.current}:[a-z0-9-]+$`).test(value.checkpoint);
}

function isEvidenceRecord(value) {
  return isRecord(value)
    && evidenceIdSet.has(value.evidenceId)
    && evidenceActionSet.has(value.action)
    && Number.isInteger(value.chapter)
    && value.chapter >= 1
    && value.chapter <= CHAPTER_COUNT;
}

export function isValidGateId(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value);
}

function isGateAttempt(value) {
  return isRecord(value)
    && isValidGateId(value.gateId)
    && Number.isInteger(value.chapter)
    && value.chapter >= 1
    && value.chapter <= CHAPTER_COUNT
    && gateOutcomeSet.has(value.outcome);
}

export function isValidRebootState(candidate) {
  if (!isRecord(candidate) || candidate.schemaVersion !== SAVE_SCHEMA_VERSION) return false;
  if (!isRecord(candidate.integrity) || !isCount(candidate.integrity.secured) || !isCount(candidate.integrity.lost)) return false;
  if (!isRecord(candidate.exposure) || !isCount(candidate.exposure.contained) || !isCount(candidate.exposure.disclosed)) return false;
  if (!isRecord(candidate.trust) || !CHARACTER_IDS.every((id) => isTrust(candidate.trust[id]))) return false;
  if (Object.keys(candidate.trust).some((id) => !characterIdSet.has(id))) return false;
  if (!isChapterProgress(candidate.chapterProgress)) return false;
  if (candidate.patchChoice !== null && !patchIdSet.has(candidate.patchChoice)) return false;
  if (!Array.isArray(candidate.evidence) || !candidate.evidence.every(isEvidenceRecord)) return false;
  if (new Set(candidate.evidence.map((record) => record.evidenceId)).size !== candidate.evidence.length) return false;
  if (!Array.isArray(candidate.gateAttempts) || !candidate.gateAttempts.every(isGateAttempt)) return false;
  return isSettings(candidate.settings);
}

export function normalizeRebootState(candidate) {
  if (!isValidRebootState(candidate)) return createInitialRebootState();
  return deepFreeze({
    schemaVersion: SAVE_SCHEMA_VERSION,
    integrity: { secured: candidate.integrity.secured, lost: candidate.integrity.lost },
    exposure: { contained: candidate.exposure.contained, disclosed: candidate.exposure.disclosed },
    trust: Object.fromEntries(CHARACTER_IDS.map((id) => [id, candidate.trust[id]])),
    chapterProgress: {
      completed: [...candidate.chapterProgress.completed],
      current: candidate.chapterProgress.current,
      checkpoint: candidate.chapterProgress.checkpoint
    },
    patchChoice: candidate.patchChoice,
    evidence: candidate.evidence.map(({ action, chapter, evidenceId }) => ({ action, chapter, evidenceId })),
    gateAttempts: candidate.gateAttempts.map(({ chapter, gateId, outcome }) => ({ chapter, gateId, outcome })),
    settings: createDefaultSettings(candidate.settings)
  });
}
