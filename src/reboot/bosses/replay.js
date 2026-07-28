import { createBossState, stepBoss } from './runtime.js';

const FIXED_HZ = 60;
const EPSILON = 0.000000001;

export function replayBossAtRate({ inputLog = [], renderHz, totalTicks }) {
  if (![30, 60, 120].includes(renderHz)) throw new RangeError('지원하는 렌더 주기는 30, 60, 120Hz입니다.');
  if (!Number.isInteger(totalTicks) || totalTicks < 1) throw new RangeError('양의 전체 tick이 필요합니다.');
  let accumulator = 0;
  let simulatedTicks = 0;
  let state = createBossState();
  const log = [];
  while (simulatedTicks < totalTicks) {
    accumulator += FIXED_HZ / renderHz;
    while (accumulator + EPSILON >= 1 && simulatedTicks < totalTicks) {
      const actions = inputLog.filter((entry) => entry.tick === simulatedTicks).map((entry) => entry.action);
      const result = stepBoss(state, { actions });
      state = result.state;
      for (const event of result.events) {
        if (['boss-telegraph', 'mastery-success', 'boss-phase-changed', 'boss-defeated'].includes(event.type)) {
          log.push({ phaseId: event.phaseId ?? null, tick: simulatedTicks, type: event.type });
        }
      }
      accumulator -= 1;
      simulatedTicks += 1;
    }
  }
  return Object.freeze({
    hp: state.hp,
    log: Object.freeze(log.map(Object.freeze)),
    phaseIndex: state.phaseIndex,
    status: state.status
  });
}
