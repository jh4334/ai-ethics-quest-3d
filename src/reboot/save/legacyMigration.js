import { createDefaultSettings } from '../state/model.js';

function parseLegacy(raw) {
  if (raw === null) return null;
  try {
    const candidate = JSON.parse(raw);
    if (!candidate || typeof candidate !== 'object') return null;
    if (candidate.version !== 3 && candidate.schemaVersion !== 3) return null;
    return candidate;
  } catch {
    return null;
  }
}

export function migrateLegacySettings(raw) {
  const legacy = parseLegacy(raw);
  if (!legacy) return createDefaultSettings();
  const source = legacy.settings && typeof legacy.settings === 'object' ? legacy.settings : legacy;
  return createDefaultSettings({
    sound: source.sound,
    motion: source.motion,
    quality: source.quality
  });
}

export function preserveLegacyBackup(storage, sourceKey, backupKey) {
  const existingBackup = storage.getItem(backupKey);
  if (existingBackup !== null) return existingBackup;
  const original = storage.getItem(sourceKey);
  if (original === null) return null;
  storage.setItem(backupKey, original);
  return original;
}
