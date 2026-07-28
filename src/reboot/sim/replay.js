import { stepCombat } from './combatSimulation.js';

function stableSerialize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const fields = Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`);
  return `{${fields.join(',')}}`;
}

export function hashState(state) {
  const source = stableSerialize(state);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function runReplay({ initialState, inputLog = [], ticks }) {
  const byTick = new Map();
  for (const entry of inputLog) {
    if (!Number.isInteger(entry?.tick) || !Array.isArray(entry.commands)) continue;
    const commands = byTick.get(entry.tick) ?? [];
    commands.push(...entry.commands);
    byTick.set(entry.tick, commands);
  }
  let state = initialState;
  const events = [];
  const count = Number.isInteger(ticks) ? Math.max(0, ticks) : 0;
  for (let offset = 0; offset < count; offset += 1) {
    const result = stepCombat(state, byTick.get(state.tick) ?? []);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events, hash: hashState(state) };
}
