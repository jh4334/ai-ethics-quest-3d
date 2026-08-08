import { createInitialRebootState, deepFreeze } from '../state/model.js';
import { parseStoredSave, serializeSave } from './codec.js';
import { migrateLegacySettings, preserveLegacyBackup } from './legacyMigration.js';
import { createResilientStorage } from './resilientStorage.js';
import { migrateV4Save } from './v4Migration.js';

export const V4_SAVE_KEY = 'h17.null.save.v4';
export const V4_TEMP_KEY = 'h17.null.save.v4.tmp';
export const V4_BACKUP_KEY = 'h17.null.save.v4.backup';
export const V5_SAVE_KEY = 'h17.null.save.v5';
export const V5_TEMP_KEY = 'h17.null.save.v5.tmp';
export const LEGACY_BACKUP_KEY = 'h17.legacy.v3.backup';
export const LEGACY_V3_KEY = 'ai-ethics-quest-3d/progress/h17-v4';

function result(state, recoveryCode = null, recoveryNotice = null) {
  return deepFreeze({ state, recoveryCode, recoveryNotice });
}

export function createSaveRepository(rawStorage) {
  const usable = rawStorage && typeof rawStorage.getItem === 'function'
    && typeof rawStorage.setItem === 'function' && typeof rawStorage.removeItem === 'function';
  // 저장소가 없거나 막힌 환경에서도 게임은 켜져야 한다 — 강등 어댑터가 세션 메모리로 이어간다.
  const storage = createResilientStorage(usable ? rawStorage : null);

  function write(state) {
    const serialized = serializeSave(state);
    if (storage.getItem(V5_SAVE_KEY) === serialized) {
      storage.removeItem(V5_TEMP_KEY);
      return state;
    }

    storage.setItem(V5_TEMP_KEY, serialized);
    if (storage.getItem(V5_TEMP_KEY) !== serialized) {
      throw new Error('임시 저장 검증에 실패했습니다.');
    }
    storage.setItem(V5_SAVE_KEY, serialized);
    if (storage.getItem(V5_SAVE_KEY) !== serialized) {
      throw new Error('저장 교체 검증에 실패했습니다.');
    }
    storage.removeItem(V5_TEMP_KEY);
    return state;
  }

  function legacySettings() {
    const original = storage.getItem(LEGACY_V3_KEY) ?? storage.getItem(LEGACY_BACKUP_KEY);
    return migrateLegacySettings(original);
  }

  function boot() {
    preserveLegacyBackup(storage, LEGACY_V3_KEY, LEGACY_BACKUP_KEY);
    preserveLegacyBackup(storage, V4_SAVE_KEY, V4_BACKUP_KEY);
    const parsed = parseStoredSave(storage.getItem(V5_SAVE_KEY));
    if (parsed.kind === 'valid') {
      storage.removeItem(V5_TEMP_KEY);
      return result(parsed.state);
    }

    const pending = parseStoredSave(storage.getItem(V5_TEMP_KEY));
    if (parsed.kind !== 'future' && pending.kind === 'valid') {
      write(pending.state);
      return result(pending.state, 'pending-recovered', '중단된 저장을 복구했습니다.');
    }

    if (parsed.kind === 'empty') {
      const migrated = migrateV4Save(storage.getItem(V4_SAVE_KEY));
      if (migrated) {
        write(migrated.state);
        return migrated.recoveredCheckpoint
          ? result(migrated.state, 'v4-checkpoint-recovered', '이전 마지막 방송 위치를 안전한 지점으로 복구했습니다.')
          : result(migrated.state, 'v4-migrated', '이전 진행을 새 캠페인 저장으로 옮겼습니다.');
      }
    }

    const fresh = createInitialRebootState(legacySettings());
    write(fresh);
    if (parsed.kind === 'future') {
      return result(fresh, 'future-version', '지원하지 않는 저장 버전이라 새 게임을 시작했습니다.');
    }
    if (parsed.kind === 'malformed') {
      return result(fresh, 'malformed-save', '손상된 저장을 복구하고 새 게임을 시작했습니다.');
    }
    if (storage.isDegraded()) {
      return result(fresh, 'storage-degraded', '저장 공간을 쓸 수 없어 진행이 이 세션에만 유지됩니다.');
    }
    return result(fresh);
  }

  function reset() {
    preserveLegacyBackup(storage, LEGACY_V3_KEY, LEGACY_BACKUP_KEY);
    preserveLegacyBackup(storage, V4_SAVE_KEY, V4_BACKUP_KEY);
    const parsed = parseStoredSave(storage.getItem(V5_SAVE_KEY));
    const migrated = parsed.kind === 'empty' ? migrateV4Save(storage.getItem(V4_SAVE_KEY)) : null;
    const settings = parsed.kind === 'valid'
      ? parsed.state.settings
      : migrated?.state.settings ?? legacySettings();
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
