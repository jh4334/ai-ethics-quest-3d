const CONTRACT_VERSION = 1;

const SHARED_BEATS = Object.freeze([
  Object.freeze({ id: 'cold-open', seconds: 60 }),
  Object.freeze({ id: 'corridor-training', seconds: 90 }),
  Object.freeze({ id: 'first-arena', seconds: 300 })
]);

const ENDING_BEATS = Object.freeze([
  Object.freeze({ id: 'scanner-pursuit', seconds: 420 }),
  Object.freeze({ id: 'attendance-proctor', seconds: 600 }),
  Object.freeze({ id: 'signature-report', seconds: 120 })
]);

const DECISION_SECONDS = Object.freeze({ purge: 90, secure: 150 });

function freezeTimeline(timeline) {
  return Object.freeze({
    ...timeline,
    beats: Object.freeze(timeline.beats.map((beat) => Object.freeze(beat)))
  });
}

export function createSliceTimeline(branch) {
  if (!Object.hasOwn(DECISION_SECONDS, branch)) {
    throw new RangeError(`지원하지 않는 수직 슬라이스 경로입니다: ${branch}`);
  }
  const decision = Object.freeze({
    id: `memory-${branch}`,
    seconds: DECISION_SECONDS[branch]
  });
  const beats = [...SHARED_BEATS, decision, ...ENDING_BEATS];
  const totalSeconds = beats.reduce((sum, beat) => sum + beat.seconds, 0);
  const firstCombatSeconds = SHARED_BEATS[0].seconds + SHARED_BEATS[1].seconds;
  const firstConsequenceSeconds = SHARED_BEATS.reduce((sum, beat) => sum + beat.seconds, 0)
    + decision.seconds;

  return freezeTimeline({
    branch,
    beats,
    completionMinutes: totalSeconds / 60,
    contractVersion: CONTRACT_VERSION,
    firstCombatMinutes: firstCombatSeconds / 60,
    firstConsequenceMinutes: firstConsequenceSeconds / 60,
    firstControlSeconds: 12
  });
}

export const SLICE_CONTRACT_VERSION = CONTRACT_VERSION;
export { evaluateSliceManifest } from './gate.js';
