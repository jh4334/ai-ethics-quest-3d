import { deepFreeze } from '../state/model.js';

const STAGES = Object.freeze(['deletion', 'approval', 'score', 'capture']);
const DECISIONS = new Set(['fast-shutdown', 'preserve-support']);

function freezeState(state) {
  return deepFreeze({ ...state, reversedStages: [...state.reversedStages] });
}

export function createApprovalPipelineState() {
  return freezeState({
    finalPressure: null,
    inspected: false,
    readyForDecision: false,
    reversedStages: [],
    stageIndex: 0,
    status: 'reversing',
    supportRecordAction: null,
    version: 1
  });
}

function event(type, values = {}) {
  return Object.freeze({ type, ...values });
}

export function applyApprovalCommand(current, command) {
  if (current?.version !== 1 || !STAGES[current.stageIndex] || typeof command?.type !== 'string') {
    throw new TypeError('유효한 승인 파이프라인 상태와 명령이 필요합니다.');
  }
  if (current.status === 'complete') return Object.freeze({ event: event('pipeline-complete'), state: current });
  if (command.type === 'inspect') {
    return Object.freeze({
      event: event('stage-inspected', { stageId: STAGES[current.stageIndex] }),
      state: freezeState({ ...current, inspected: true })
    });
  }
  if (command.type === 'reverse') {
    if (!current.inspected) return Object.freeze({ event: event('reverse-blocked-uninspected'), state: current });
    const stageId = STAGES[current.stageIndex];
    const reversedStages = [...current.reversedStages, stageId];
    const readyForDecision = current.stageIndex === STAGES.length - 1;
    return Object.freeze({
      event: event(readyForDecision ? 'pipeline-origin-found' : 'stage-reversed', { stageId }),
      state: freezeState({
        ...current,
        inspected: false,
        readyForDecision,
        reversedStages,
        stageIndex: readyForDecision ? current.stageIndex : current.stageIndex + 1
      })
    });
  }
  if (command.type === 'decide' && current.readyForDecision && DECISIONS.has(command.decision)) {
    const preserve = command.decision === 'preserve-support';
    return Object.freeze({
      event: event('pipeline-decided', {
        costKo: preserve
          ? '지원 기록 보존에 시간이 걸려 방송실 추격이 한 차례 늘어난다.'
          : '빠른 중단으로 긴급 지원 기록까지 닫힌다.',
        decision: command.decision
      }),
      state: freezeState({
        ...current,
        finalPressure: preserve ? 'pursuit-wave' : 'narrow-window',
        status: 'complete',
        supportRecordAction: preserve ? 'secure' : 'purge'
      })
    });
  }
  return Object.freeze({ event: event('command-rejected', { command: command.type }), state: current });
}
