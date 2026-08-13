import { createLearningReport } from '../state/learningReport.js';
import { deepFreeze, normalizeRebootState } from '../state/model.js';

const REPORT_GATES = Object.freeze([
  { chapter: 1, gateId: 'attendance-proctor' },
  { chapter: 2, gateId: 'source-chain' },
  { chapter: 3, gateId: 'dual-school' },
  { chapter: 4, gateId: 'approval-chain' },
  { chapter: 5, gateId: 'testimony-archive' },
  { chapter: 6, gateId: 'broadcast-protocol' }
]);

export function createTeacherInvestigationReport(seed) {
  const state = normalizeRebootState(seed);
  const learning = createLearningReport(state, REPORT_GATES);
  const gateAttempts = learning.gates
    .filter(({ attempts, status }) => attempts > 0 || status !== 'unattempted')
    .map(({ attempts, chapter, gateId, status }) => ({ attempts, chapter, gateId, status }));
  return deepFreeze({
    decisions: state.evidence.map(({ action, chapter, evidenceId }) => ({ action, chapter, evidenceId })),
    evidence: state.evidence.map(({ chapter, evidenceId }) => ({ chapter, evidenceId })),
    gateAttempts,
    outcomes: {
      exposure: { ...state.exposure },
      integrity: { ...state.integrity }
    },
    progress: { ...state.chapterProgress },
    summary: { firstTryCount: learning.firstTryCount, retryCount: learning.retryCount }
  });
}
