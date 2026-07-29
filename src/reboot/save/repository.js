import { createInitialRebootState, deepFreeze } from '../state/model.js';
import { parseStoredSave, serializeSave } from './codec.js';
import { migrateLegacySettings, preserveLegacyBackup } from './legacyMigration.js';
import { createResilientStorage } from './resilientStorage.js';

export const V4_SAVE_KEY = 'h17.null.save.v4';
export const V4_TEMP_KEY = 'h17.null.save.v4.tmp';
export const LEGACY_BACKUP_KEY = 'h17.legacy.v3.backup';
export const LEGACY_V3_KEY = 'ai-ethics-quest-3d/progress/h17-v4';

function result(state, recoveryNotice = null) {
  return deepFreeze({ state, recoveryNotice });
}

export function createSaveRepository(rawStorage) {
  const usable = rawStorage && typeof rawStorage.getItem === 'function'
    && typeof rawStorage.setItem === 'function' && typeof rawStorage.removeItem === 'function';
  // 저장소가 없거나 막힌 환경에서도 게임은 켜져야 한다 — 강등 어댑터가 세션 메모리로 이어간다.
  const storage = createResilientStorage(usable ? rawStorage : null);

  function write(state) {
    const serialized = serializeSave(state);
    if (storage.getItem(V4_SAVE_KEY) === serialized) {
      storage.removeItem(V4_TEMP_KEY);
      return state;
    }

    storage.setItem(V4_TEMP_KEY, serialized);
    if (storage.getItem(V4_TEMP_KEY) !== serialized) {
      throw new Error('임시 저장 검증에 실패했습니다.');
    }
    storage.setItem(V4_SAVE_KEY, serialized);
    if (storage.getItem(V4_SAVE_KEY) !== serialized) {
      throw new Error('저장 교체 검증에 실패했습니다.');
    }
    storage.removeItem(V4_TEMP_KEY);
    return state;
  }

  function legacySettings() {
    const original = storage.getItem(LEGACY_V3_KEY) ?? storage.getItem(LEGACY_BACKUP_KEY);
    return migrateLegacySettings(original);
  }

  function boot() {
    preserveLegacyBackup(storage, LEGACY_V3_KEY, LEGACY_BACKUP_KEY);
    const parsed = parseStoredSave(storage.getItem(V4_SAVE_KEY));
    if (parsed.kind === 'valid') {
      storage.removeItem(V4_TEMP_KEY);
      return result(parsed.state);
    }

    const pending = parseStoredSave(storage.getItem(V4_TEMP_KEY));
    if (pending.kind === 'valid') {
      write(pending.state);
      return result(pending.state, '중단된 저장을 복구했습니다.');
    }

    const fresh = createInitialRebootState(legacySettings());
    write(fresh);
    if (parsed.kind === 'future') return result(fresh, '지원하지 않는 저장 버전이라 새 게임을 시작했습니다.');
    if (parsed.kind === 'malformed') return result(fresh, '손상된 저장을 복구하고 새 게임을 시작했습니다.');
    if (storage.isDegraded()) {
      return result(fresh, '저장 공간을 쓸 수 없어 진행이 이 세션에만 유지됩니다.');
    }
    return result(fresh);
  }

  function reset() {
    preserveLegacyBackup(storage, LEGACY_V3_KEY, LEGACY_BACKUP_KEY);
    const parsed = parseStoredSave(storage.getItem(V4_SAVE_KEY));
    const settings = parsed.kind === 'valid' ? parsed.state.settings : legacySettings();
    const fresh = createInitialRebootState(settings);
    write(fresh);
    return fresh;
  }

  return Object.freeze({
    boot,
    getLegacyBackup: () => storage.getItem(LEGACY_BACKUP_KEY),
    isStorageDegraded: () => storage.isDegraded(),
    reset,
    write
  });
}
