import { deepFreeze, normalizeRebootState } from '../state/model.js';
import { createResultSummary } from '../state/resultSummary.js';

const routeCopy = Object.freeze({
  none: Object.freeze({
    actionKo: '내 선택 · 기억 백업 처리 기록이 아직 없다.',
    routeConsequenceKo: '변화 · 체육관 출석 서버가 백업 판정을 기다리고 있다.'
  }),
  purge: Object.freeze({
    actionKo: '내 선택 · PURGE로 하루의 기억 백업을 소거했다.',
    routeConsequenceKo: '변화 · 추격은 짧아졌고 백업 내용과 출처 연결은 사라졌다.'
  }),
  secure: Object.freeze({
    actionKo: '내 선택 · TRACE 후 SECURE로 하루의 기억 백업 원본을 고정했다.',
    routeConsequenceKo: '변화 · 백업은 남았고 감독관은 추가 지우개를 호출했다.'
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
      ? '남은 질문 · 승인 기록에는 PLAYER-ID가 있지만 승인 항목은 비어 있다.'
      : '남은 질문 · 격리된 승인 기록은 출석 감독관 뒤에 잠겨 있다.',
    report: createResultSummary(campaign)
  });
}
