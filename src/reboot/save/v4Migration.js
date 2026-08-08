import {
  CHARACTER_IDS,
  EVIDENCE_ACTIONS,
  MOTION_SETTINGS,
  PATCH_IDS,
  QUALITY_SETTINGS,
  createDefaultSettings,
  deepFreeze,
  isValidRebootState,
  normalizeRebootState
} from '../state/model.js';

const V4_EVIDENCE_IDS = new Set([
  'haru-memory-backup', 'player-approval-record', 'original-upload-trace',
  'dot-deletion-log', 'support-record', 'broadcast-queue'
]);
const evidenceActions = new Set(EVIDENCE_ACTIONS);
const patchIds = new Set(PATCH_IDS);
const motionSettings = new Set(MOTION_SETTINGS);
const qualitySettings = new Set(QUALITY_SETTINGS);
const LEGACY_GATE_IDS = Object.freeze({
  1: 'attendance-proctor',
  2: 'source-chain',
  3: 'dual-school',
  4: 'approval-chain',
  5: 'testimony-archive',
  6: 'broadcast-protocol'
});
const FINALE_CHECKPOINTS = new Set([
  'broadcast-room', 'resolved-redacted', 'resolved-raw', 'resolved-sealed'
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isV4State(candidate) {
  if (!isRecord(candidate) || candidate.schemaVersion !== 4) return false;
  if (!isRecord(candidate.integrity) || !Number.isInteger(candidate.integrity.secured)
    || candidate.integrity.secured < 0 || !Number.isInteger(candidate.integrity.lost)
    || candidate.integrity.lost < 0) return false;
  if (!isRecord(candidate.exposure) || !Number.isInteger(candidate.exposure.contained)
    || candidate.exposure.contained < 0 || !Number.isInteger(candidate.exposure.disclosed)
    || candidate.exposure.disclosed < 0) return false;
  if (!isRecord(candidate.trust) || !CHARACTER_IDS.every((id) => (
    Number.isInteger(candidate.trust[id]) && candidate.trust[id] >= -100 && candidate.trust[id] <= 100
  )) || Object.keys(candidate.trust).some((id) => !CHARACTER_IDS.includes(id))) return false;
  const progress = candidate.chapterProgress;
  if (!isRecord(progress) || !Number.isInteger(progress.current)
    || progress.current < 1 || progress.current > 5 || !Array.isArray(progress.completed)) return false;
  const expected = Array.from({ length: progress.current - 1 }, (_, index) => index + 1);
  if (!progress.completed.every((chapter, index) => chapter === expected[index])
    || progress.completed.length !== expected.length
    || typeof progress.checkpoint !== 'string'
    || !new RegExp(`^chapter-${progress.current}:[a-z0-9-]+$`).test(progress.checkpoint)) return false;
  if (candidate.patchChoice !== null && !patchIds.has(candidate.patchChoice)) return false;
  if (!Array.isArray(candidate.evidence) || !candidate.evidence.every((record) => (
    isRecord(record) && V4_EVIDENCE_IDS.has(record.evidenceId) && evidenceActions.has(record.action)
      && Number.isInteger(record.chapter) && record.chapter >= 1 && record.chapter <= 5
  ))) return false;
  if (new Set(candidate.evidence.map(({ evidenceId }) => evidenceId)).size !== candidate.evidence.length) return false;
  return isRecord(candidate.settings)
    && typeof candidate.settings.sound === 'boolean'
    && motionSettings.has(candidate.settings.motion)
    && qualitySettings.has(candidate.settings.quality);
}

function migratedProgress(progress) {
  if (progress.current !== 5) return { progress, recoveredCheckpoint: false };
  const suffix = progress.checkpoint.slice('chapter-5:'.length);
  const known = FINALE_CHECKPOINTS.has(suffix);
  return {
    progress: {
      completed: [1, 2, 3, 4, 5],
      current: 6,
      checkpoint: known ? `chapter-6:${suffix}` : 'chapter-6:broadcast-room'
    },
    recoveredCheckpoint: !known
  };
}

function legacyAttempts(progress, nextProgress) {
  const completed = [...nextProgress.completed];
  if (progress.current === 5 && progress.checkpoint.includes(':resolved-')) completed.push(6);
  return completed.map((chapter) => ({
    chapter,
    gateId: LEGACY_GATE_IDS[chapter],
    outcome: 'unknown'
  }));
}

export function migrateV4State(candidate) {
  if (isValidRebootState(candidate)) {
    return deepFreeze({ recoveredCheckpoint: false, state: normalizeRebootState(candidate) });
  }
  if (!isV4State(candidate)) return null;
  const { progress, recoveredCheckpoint } = migratedProgress(candidate.chapterProgress);
  const state = deepFreeze({
    schemaVersion: 5,
    integrity: { ...candidate.integrity },
    exposure: { ...candidate.exposure },
    trust: Object.fromEntries(CHARACTER_IDS.map((id) => [id, candidate.trust[id]])),
    chapterProgress: { ...progress, completed: [...progress.completed] },
    patchChoice: candidate.patchChoice,
    evidence: candidate.evidence.map(({ action, chapter, evidenceId }) => ({
      action,
      chapter: evidenceId === 'broadcast-queue' && chapter === 5 ? 6 : chapter,
      evidenceId
    })),
    gateAttempts: legacyAttempts(candidate.chapterProgress, progress),
    settings: createDefaultSettings(candidate.settings)
  });
  return deepFreeze({ recoveredCheckpoint, state: normalizeRebootState(state) });
}

export function migrateV4Save(raw) {
  if (raw === null) return null;
  try {
    return migrateV4State(JSON.parse(raw));
  } catch {
    return null;
  }
}
