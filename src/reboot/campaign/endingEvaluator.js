import { recordEvidenceOutcome, setChapterCheckpoint } from '../state/consequences.js';
import { deepFreeze, isValidRebootState, normalizeRebootState } from '../state/model.js';

const REQUIRED_REDACTED = Object.freeze([
  'player-approval-record', 'original-upload-trace', 'dot-deletion-log', 'support-record'
]);

const OUTCOMES = deepFreeze({
  'redacted-broadcast': {
    titleKo: '개인정보를 가린 검증 방송',
    peopleChanges: [
      '하루가 방송실에서 돌아와 감사 기록의 맥락을 직접 설명한다.',
      'DOT는 동의 없는 삭제 권한을 내려놓고 학생 검토 요청을 받는다.',
      '윤서는 3초 승인 목표를 중단하고 승인 사유를 공개 기록으로 남긴다.'
    ],
    worldChanges: [
      '사적인 표식이 가려진 사건 경로가 학교 검토 채널에 방송된다.',
      '긴급 지원 기록은 분리 보관되어 필요한 학생에게 계속 연결된다.'
    ],
    costs: ['검증과 가림 작업 때문에 방송은 늦어졌고 관련자들은 공개 검토에 참여해야 한다.']
  },
  'raw-disclosure': {
    titleKo: '원본 공개',
    peopleChanges: [
      '하루는 사건이 묻히지 않았음을 확인하지만 주변 학생의 노출을 함께 감당한다.',
      'DOT는 삭제 대신 공개 범위 경고를 반복하는 제한 모드로 전환된다.',
      '윤서는 빠른 승인과 무가림 공개 양쪽의 책임을 검토 회의에서 설명한다.'
    ],
    worldChanges: [
      '원본 기록이 방송되어 삭제 경로는 증명되지만 관련 없는 표식도 넓게 퍼진다.',
      '학교는 공개본 회수와 당사자 지원 절차를 동시에 시작한다.'
    ],
    costs: ['사실은 남았지만 되돌릴 수 없는 사생활 노출이 생겼다.']
  },
  'sealed-incident': {
    titleKo: '사건 봉인',
    peopleChanges: [
      '하루는 방송실을 떠나지만 공개 검토가 미뤄진 이유를 기록으로 남긴다.',
      'DOT와 LUMEN의 학생 기록 권한은 외부 검토가 끝날 때까지 정지된다.',
      '윤서는 남은 증거를 보존하며 재검토 요청 창구를 연다.'
    ],
    worldChanges: [
      '당장의 확산은 멈췄지만 삭제 경로는 학교 밖에 공개되지 않는다.',
      '봉인된 기록은 보존 기한과 재개 조건이 표시된 검토함으로 이동한다.'
    ],
    costs: ['피해 확산은 막았지만 공개 검증과 제도 변경은 뒤로 미뤄졌다.']
  }
});

function evidenceAction(state, evidenceId) {
  return state.evidence.find((record) => record.evidenceId === evidenceId)?.action ?? null;
}

function resolvedId(state) {
  const match = /^chapter-5:resolved-(redacted|raw|sealed)$/.exec(state.chapterProgress.checkpoint);
  return match ? { redacted: 'redacted-broadcast', raw: 'raw-disclosure', sealed: 'sealed-incident' }[match[1]] : null;
}

export function evaluateEnding(seed, decision) {
  const state = normalizeRebootState(seed);
  const alreadyResolved = resolvedId(state);
  if (alreadyResolved) return alreadyResolved;
  if (decision === 'contain') return 'sealed-incident';
  const protectedCore = REQUIRED_REDACTED.every((id) => evidenceAction(state, id) === 'secure');
  if (decision === 'broadcast' && protectedCore && state.integrity.secured >= 4 && state.exposure.disclosed <= 1) {
    return 'redacted-broadcast';
  }
  const proofCount = REQUIRED_REDACTED.filter((id) => {
    const action = evidenceAction(state, id);
    return action === 'secure' || action === 'expose';
  }).length;
  return decision === 'broadcast' && proofCount >= 2 ? 'raw-disclosure' : 'sealed-incident';
}

function outcomeFor(state, id) {
  const template = OUTCOMES[id];
  return deepFreeze({
    ...template,
    actionHistory: state.evidence.map(({ action, evidenceId }) => `${evidenceId}:${action}`),
    id
  });
}

export function finalizeCampaign(seed, { decision } = {}) {
  const state = isValidRebootState(seed) && Object.isFrozen(seed) ? seed : normalizeRebootState(seed);
  const existingId = resolvedId(state);
  if (existingId) return Object.freeze({ outcome: outcomeFor(state, existingId), state });
  const id = evaluateEnding(state, decision);
  const action = id === 'raw-disclosure' ? 'expose' : 'secure';
  let finalState = recordEvidenceOutcome(state, { action, chapter: 5, evidenceId: 'broadcast-queue' });
  const checkpoint = {
    'redacted-broadcast': 'chapter-5:resolved-redacted',
    'raw-disclosure': 'chapter-5:resolved-raw',
    'sealed-incident': 'chapter-5:resolved-sealed'
  }[id];
  finalState = setChapterCheckpoint(finalState, 5, checkpoint);
  return Object.freeze({ outcome: outcomeFor(finalState, id), state: finalState });
}
