import { CAMPAIGN_CHAPTERS } from './campaignContent.js';
import { SAVE_VERSION } from './campaignSave.js';

const DECISION_RESULTS = Object.freeze({
  'protect-context': '민감정보를 가린 맥락 기록이 이후 조사에 사용됐다.',
  'open-raw': '원본은 제한 감사함에 보존되고 모든 접근이 기록됐다.',
  'label-and-freeze': '생성 표시와 최초 파일이 복제본의 출처를 드러냈다.',
  'remove-and-notify': '복제본을 내리고 피해자에게 확산 사실을 먼저 알렸다.',
  'notify-and-repair': '피해 통지와 회복 지원이 삭제 절차에 함께 연결됐다.',
  'quiet-freeze': '재공유를 잠그고 회복 방식은 하루의 선택을 기다렸다.',
  'paired-sources': '상반된 출처와 날짜가 한 화면에서 교차 검증됐다.',
  'open-recommendation-path': '서로 다른 추천 경로와 누락 자료가 함께 공개됐다.',
  'human-review': '중요 결정마다 이름 있는 사람의 재검토가 추가됐다.',
  'appeal-first': '결정 이유 통지와 이의제기 창구가 먼저 복구됐다.'
});

export function resolveChapterDecision(state, choiceId) {
  if (state.phase !== 'choice') return state;
  const chapter = CAMPAIGN_CHAPTERS[state.chapterIndex];
  const choice = chapter.choice.options.find(({ id }) => id === choiceId);
  if (!choice) return state;
  state.decisions[chapter.id] = choice.id;
  state.unlockedChapter = Math.max(state.unlockedChapter, Math.min(state.chapterIndex + 1, CAMPAIGN_CHAPTERS.length - 1));
  state.phase = 'chapter-result';
  state.message = choice.consequence;
  state.messageKind = 'complete';
  state.lastEvent = `choice:${chapter.id}:${choice.id}`;
  return state;
}

function processSummary(decisions) {
  const visibleResults = Object.values(decisions)
    .map((choiceId) => DECISION_RESULTS[choiceId])
    .filter(Boolean);
  return visibleResults.length > 0
    ? visibleResults.join(' ')
    : '아직 결정 이후의 절차는 열리지 않았다.';
}

export function getCampaignEnding(state) {
  const publicHearing = state.decisions['chapter-6'] === 'public-hearing';
  const processResult = processSummary(state.decisions);
  return publicHearing
    ? {
        id: 'public-hearing',
        title: '하루의 이름이 명단으로 돌아왔다',
        summary: `민감정보를 가린 증거로 공개 심리가 열렸다. 루멘의 계산과 사람의 승인이 함께 검토됐다. ${processResult}`,
        cost: '학교는 느려져도 중요한 결정을 사람이 다시 확인해야 한다.'
      }
    : {
        id: 'sealed-audit',
        title: '증거는 하루의 시간을 기다린다',
        summary: `WHITEOUT은 멈췄고 증거는 훼손 없이 봉인됐다. ${processResult}`,
        cost: '추가 피해는 막았지만 같은 결정 구조를 공개적으로 고치는 일은 남았다.'
      };
}

export function getCampaignReport(state) {
  const ending = getCampaignEnding(state);
  return {
    version: SAVE_VERSION,
    title: 'H-17 조사 기록',
    summary: `사라진 학생 하루(H-17)의 기록을 따라 ${Object.keys(state.decisions).length}개 장의 결정 경로를 확인했다.`,
    ending,
    evidenceIds: [...state.collectedEvidence],
    totalRespawns: state.totalRespawns,
    ethicsEvents: {
      blindActions: state.ethics?.blindActions ?? 0,
      exposure: state.ethics?.exposure ?? 0,
      reflections: state.ethics?.reflections ?? 0,
      spread: state.ethics?.spread ?? 0,
      automaticApprovals: state.ethics?.automaticApprovals ?? 0
    },
    chapters: CAMPAIGN_CHAPTERS.map((chapterData) => {
      const choiceId = state.decisions[chapterData.id] ?? null;
      const choice = chapterData.choice.options.find(({ id }) => id === choiceId);
      return {
        id: chapterData.id,
        title: chapterData.title,
        topic: chapterData.topic,
        decision: choice?.label ?? '아직 결정하지 않음',
        consequence: choice?.consequence ?? '아직 결과 기록 없음',
        cost: choice?.cost ?? '아직 비용 기록 없음'
      };
    })
  };
}
