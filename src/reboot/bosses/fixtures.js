import { ATTENDANCE_PROCTOR } from '../content/bosses/attendanceProctor.js';
import { createBossState } from './runtime.js';

export const BOSS_FIXTURE_IDS = Object.freeze([
  'phase-1-start', 'phase-1-window', 'phase-2-start', 'phase-2-window',
  'phase-3-start', 'phase-3-window', 'low-health', 'stagger', 'victory',
  'death-retry', 'purge-path', 'secure-path'
]);

const FIXTURES = Object.freeze({
  'phase-1-start': {},
  'phase-1-window': { phaseTick: ATTENDANCE_PROCTOR.phases[0].timing.windupTicks },
  'phase-2-start': { hp: 180, knowledge: ['reflect-scan'], phaseIndex: 1 },
  'phase-2-window': {
    hp: 180,
    knowledge: ['reflect-scan'],
    phaseIndex: 1,
    phaseTick: ATTENDANCE_PROCTOR.phases[1].timing.windupTicks
  },
  'phase-3-start': { hp: 120, knowledge: ['reflect-scan', 'trace-roster'], phaseIndex: 2 },
  'phase-3-window': {
    hp: 120,
    knowledge: ['reflect-scan', 'trace-roster'],
    phaseIndex: 2,
    phaseTick: ATTENDANCE_PROCTOR.phases[2].timing.windupTicks
  },
  'low-health': {
    hp: 40,
    knowledge: ['reflect-scan', 'trace-roster', 'approval-core'],
    phaseIndex: 2,
    phaseSuccesses: 2
  },
  stagger: { hp: 180, knowledge: ['reflect-scan'], phaseIndex: 1, staggerTicks: 12 },
  victory: {
    hp: 0,
    knowledge: ['reflect-scan', 'trace-roster', 'approval-core'],
    phaseIndex: 2,
    phaseSuccesses: 3,
    status: 'victory'
  },
  'death-retry': { knowledge: ['reflect-scan'], retryTicks: 90, status: 'defeated' },
  'purge-path': { consequencePath: 'purge' },
  'secure-path': { consequencePath: 'secure' }
});

export function createBossFixture(id) {
  if (!BOSS_FIXTURE_IDS.includes(id)) throw new RangeError(`등록되지 않은 보스 fixture: ${id}`);
  return createBossState(ATTENDANCE_PROCTOR, FIXTURES[id]);
}
