import {
  SAVE_SCHEMA_VERSION,
  isValidRebootState,
  normalizeRebootState
} from '../state/model.js';

export function parseStoredSave(raw) {
  if (raw === null) return Object.freeze({ kind: 'empty', state: null });
  let candidate;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return Object.freeze({ kind: 'malformed', state: null });
  }
  if (candidate && typeof candidate === 'object' && Number.isInteger(candidate.schemaVersion)
    && candidate.schemaVersion > SAVE_SCHEMA_VERSION) {
    return Object.freeze({ kind: 'future', state: null });
  }
  if (!isValidRebootState(candidate)) return Object.freeze({ kind: 'malformed', state: null });
  return Object.freeze({ kind: 'valid', state: normalizeRebootState(candidate) });
}

export function serializeSave(state) {
  if (!isValidRebootState(state)) throw new TypeError(`유효한 v${SAVE_SCHEMA_VERSION} 저장 상태가 필요합니다.`);
  return JSON.stringify(normalizeRebootState(state));
}
