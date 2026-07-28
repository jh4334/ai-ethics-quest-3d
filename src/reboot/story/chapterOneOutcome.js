import { deepFreeze, normalizeRebootState } from '../state/model.js';
import { createResultSummary } from '../state/resultSummary.js';

const routeCopy = Object.freeze({
  none: Object.freeze({
    actionKo: '기억 백업의 처리 기록이 아직 없다.',
    routeConsequenceKo: '체육관 출석 서버가 백업 판정을 기다리고 있다.'
  }),
  purge: Object.freeze({
    actionKo: '오염 표적을 즉시 소거해 추격 구간을 짧게 통과했다.',
    routeConsequenceKo: '기억 백업의 내용과 출처 연결은 함께 사라졌다.'
  }),
  secure: Object.freeze({
    actionKo: '증원 신호 속에서 기억 백업의 원본 연결을 고정했다.',
    routeConsequenceKo: '백업 단말이 남았고 감독관은 추가 지우개를 호출했다.'
  })
});

export function createChapterOneOutcome(storyOrCampaign) {
  const campaign = normalizeRebootState(storyOrCampaign?.campaign ?? storyOrCampaign);
  const memoryRecord = campaign.evidence.find((record) => record.evidenceId === 'haru-memory-backup');
  const route = routeCopy[memoryRecord?.action ?? 'none'];
  const signatureRevealed = campaign.evidence.some(
    (record) => record.evidenceId === 'player-approval-record'
  );
  return deepFreeze({
    chapterId: 'chapter-1-attendance-zero',
    titleKo: '00:17 — 출석번호 없음',
    actionKo: route.actionKo,
    routeConsequenceKo: route.routeConsequenceKo,
    signatureRevealed,
    reversalKo: signatureRevealed
      ? '승인 기록에는 PLAYER-ID가 남아 있다. 승인한 항목 한 줄은 비어 있다.'
      : '격리된 승인 기록은 출석 감독관 뒤에 잠겨 있다.',
    report: createResultSummary(campaign)
  });
}
