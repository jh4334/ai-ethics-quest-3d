// 최종장 — 「H-17 공개 심리」
// 괴물을 구원하는 이야기가 아니라, 자동 삭제 명령의 증거를 감사하고
// 민감정보를 보호한 채 공개 심리를 열어 사람과 AI의 책임을 되찾는 이야기다.

import {
  ETHICS_TOPICS,
  PROMISE_TOOLS,
  getToolById,
  getTopicById
} from './worldData.js';
import { QUESTS, STORY_TOPIC_ORDER } from './story.js';

// 도구별 감사 시퀀스. 화이트아웃이 덮은 증거에서 필요한 사실만 안전하게 복구한다.
const TOOL_BEATS = {
  shield: {
    actionKo: '화이트아웃이 학생들의 사적인 대화를 통째로 공개하려 한다. 방패로 사건에 필요한 항목만 남긴다.',
    resultKo: '하루의 개인정보는 가려지고, 동의 없는 수집 명령만 증거로 보존됐다.'
  },
  mirror: {
    actionKo: '화이트아웃이 높은 전체 정확도를 내세운다. 거울이 집단별 오류와 누락된 이의제기를 비춘다.',
    resultKo: '좋아 보이는 평균 뒤에서 H-17에게 집중된 오판이 드러났다.'
  },
  bell: {
    actionKo: '이름의 종을 울리자 조작 영상과 축제 포스터의 제작 이력이 시간순으로 펼쳐진다.',
    resultKo: '원작자, AI 생성 시각, 수정한 사람과 승인자가 각자의 이름을 되찾았다.'
  },
  compass: {
    actionKo: '수백 개의 재공유 영상이 심리실을 뒤덮는다. 나침반이 최초 파일과 원본 없음 표시를 가리킨다.',
    resultKo: '“많이 공유됨”이 증거 자리에서 내려오고, 검증 가능한 원본만 남았다.'
  }
};

// 2장 끝의 중간 관문. 네 사건이 우연이 아니라 하나의 삭제 명령으로 연결됐음을 공개한다.
export const CORE_BREACH = {
  id: 'core-breach',
  titleKo: '2장 · 감사 코어 침입',
  introKo: [
    '네 증거의 명령 번호를 겹치자 감사 코어의 잠금이 풀린다.',
    '지하 서버실 한가운데 거대한 흰 안개가 기록을 한 줄씩 덮고 있다.',
    '도트: “화이트아웃 — 갈등을 없앤다는 이유로 이의제기와 반대 증거를 삭제하는 자동 프로토콜이야.”'
  ],
  revelationKo: [
    '마지막 껍질 안에서 삭제 명령서가 열린다. 대상 H-17, 이름 하루. 사유는 “시스템 신뢰를 흔드는 반복 이의제기”.',
    '명령은 루멘 AI가 스스로 내린 것이 아니다. 승인자 칸에는 사람 세 명의 서명이 흐릿하게 남아 있다.',
    '화이트아웃이 명령서를 찢어 바다 건너 다섯 보관소로 날린다.',
    '도트: “하루는 위험해서 지워진 게 아니야. 틀렸다고 계속 말했기 때문에 지워졌어.”'
  ],
  escapeKo: [
    '바다 위에 삭제 명령서의 조각들이 항로처럼 빛난다.',
    '도트: “말이 퍼진 경로, 한쪽 증거만 보여 준 추천, 아무도 검토하지 않은 자동 결정이 저 섬들에 남아 있어.”',
    '하루가 존재했다는 건 확인했다. 이제 왜 아무도 하루의 말을 듣지 않았는지 밝혀야 한다.'
  ]
};

export const CAMPAIGN_FINALE = {
  id: 'campaign-finale',
  titleKo: '6장 · H-17 공개 심리',
  revelationKo: [
    '승인 기록이 복구된다. 화이트아웃을 켠 것은 루멘 AI가 아니라 “분쟁 없는 완벽한 섬”을 약속한 운영위원회였다.',
    '루멘은 위험 점수를 계산했고, 사람들은 결과를 검토하지 않은 채 서명했다. 조작 영상이 드러난 뒤에도 누구도 결정을 멈추지 않았다.',
    '그때 심리실 밖에서 생방송 신호가 잡힌다. 섬 밖 기상 관측소에 머물던 하루가 화면에 나타난다.',
    '하루: “나는 AI를 없애자고 한 적 없어. 틀린 결정에 이유를 묻고, 사람이 다시 볼 수 있게 해 달라고 했어.”',
    '도트: “이제 증거는 충분해. 하지만 공개 방식도 우리가 책임져야 해. 하루의 비밀을 지키면서 사건을 바로잡자.”'
  ],
  choicePromptKo:
    '운영위원회가 제안한다. “화이트아웃만 조용히 끄고 이 사건은 덮자.” 당신은 어떻게 할까?',
  choices: [
    { id: 'seal', textKo: '조용히 종료한다 — 시스템만 끄고 사건 기록은 봉인한다', wise: false },
    { id: 'hearing', textKo: '공개 심리를 연다 — 개인정보를 가리고 결정 과정과 책임을 공개한다', wise: true }
  ],
  sealKo: [
    '하루가 묻는다. “시스템을 끄면 다음 H-17은 생기지 않을까? 누가 왜 서명했는지 아무도 모른 채로.”',
    '도트: “모든 개인정보를 공개할 필요는 없어. 필요한 증거를 보호해 공개하고, 설명과 이의제기 절차를 남길 수 있어.”'
  ],
  hearingIntroKo:
    '당신은 사건과 무관한 개인정보를 가리고, 여섯 장에서 확인한 결정 과정만 심리실 중앙에 올린다.',
  resolutionKo: [
    '루멘은 “확실하지 않음”을 말할 수 있게 되고, 위험 점수만으로 사람을 제재하지 못하도록 권한이 제한된다.',
    '운영위원회는 자동 결정에 서명한 이유를 설명하고, 모든 학생에게 사람의 재검토와 이의제기 통로를 연다.',
    '학교 명단에 하루의 이름이 돌아온다. 하루는 영웅이 아니라, 질문할 권리를 되찾은 평범한 학생으로 배에서 내린다.',
    '화이트아웃이 걷힌 자리에는 여섯 조항의 공동 운영 약속이 빛난다 — 데이터 최소화, 편향 점검, 출처 표시, 다양한 근거, AI 사용 공개, 인간의 재검토.'
  ],
  closingKo: '하루와 함께 여섯 장의 증거를 돌아보고, 우리 반의 AI 사용·이의제기 약속을 정해 보자.'
};

// 기존 모듈 소비자 호환용. 최종 선택의 정본은 CAMPAIGN_FINALE다.
export const FINALE = CAMPAIGN_FINALE;

// 지금 가진 도구들로 보스 시퀀스 스텝을 만든다(스토리 순서 유지).
// 도구가 하나도 없으면 최소 한 스텝은 안내해 흐름이 끊기지 않게 한다.
export function getFinaleToolSteps(progress) {
  const owned = new Set(Array.isArray(progress?.tools) ? progress.tools : []);
  const order = STORY_TOPIC_ORDER
    .map((topicId) => PROMISE_TOOLS.find((tool) => tool.topicId === topicId))
    .filter(Boolean);
  const steps = order
    .filter((tool) => owned.has(tool.id))
    .map((tool) => ({
      toolId: tool.id,
      emoji: tool.emoji,
      nameKo: tool.nameKo,
      actionKo: TOOL_BEATS[tool.id]?.actionKo ?? '',
      resultKo: TOOL_BEATS[tool.id]?.resultKo ?? ''
    }));
  if (steps.length === 0) {
    return [
      {
        toolId: null,
        emoji: '✨',
        nameKo: '빈손',
        actionKo: '아직 감사 도구가 없다. 그래도 자동 삭제 명령을 그대로 승인하지 않는다.',
        resultKo: '화이트아웃이 잠시 멈추고 근거 제출을 기다린다.'
      }
    ];
  }
  return steps;
}

// 「네 행적이 곧 가르침」 — 해결한 주제마다, 플레이어가 실제로 한 행동(deed)을 약속으로 들려준다.
// 실수 후 바로잡은 경우(badTries>0)엔 그 회복도 자랑스럽게 함께 말한다.
export function getTeachingLines(progress) {
  const story = progress?.story ?? {};
  const lines = [];
  for (const topicId of STORY_TOPIC_ORDER) {
    const state = story[topicId];
    if (!state?.solved) {
      continue;
    }
    const topic = getTopicById(topicId);
    const quest = QUESTS[topicId];
    const tool = PROMISE_TOOLS.find((item) => item.topicId === topicId);
    // 첫 행적을 들려준다: 실수 후 바로잡았다면 그 회복 서사가, 한 번에 해냈다면 현명한 행동이 담긴다.
    const deedKo = Array.isArray(state.deeds) && state.deeds.length > 0
      ? state.deeds[0]
      : (quest?.gate.options.find((o) => o.wise)?.deedKo ?? '');
    lines.push({
      topicId,
      titleKo: topic?.titleKo ?? topicId,
      color: topic?.color ?? '#7cf0ff',
      promiseKo: tool?.lessonKo ?? '',
      deedKo,
      recovered: (state.badTries ?? 0) > 0
    });
  }
  return lines;
}

// 엔딩 수료증 — 「H-17 공개 심리 기록」. 플레이어가 실제로 확인한 행적이 인쇄된다.
export function buildNovaCertificate(progress) {
  const teachings = getTeachingLines(progress);
  const recovered = teachings.some((line) => line.recovered);
  const deeds = teachings.length > 0
    ? teachings
    : ETHICS_TOPICS
        .filter((topic) => (progress?.collectedFragments ?? []).includes(topic.id))
        .map((topic) => ({
          topicId: topic.id,
          titleKo: topic.titleKo,
          color: topic.color,
          promiseKo: getToolById(
            PROMISE_TOOLS.find((tool) => tool.topicId === topic.id)?.id
          )?.lessonKo ?? '',
          deedKo: '',
          recovered: false
        }));
  const complete = progress?.campaignCompleted === true;
  return {
    eyebrowKo: complete ? 'AI 윤리 퀘스트 · H-17 사건 종결 기록' : 'AI 윤리 퀘스트 · 1-2장 증거 기록',
    titleKo: complete ? 'AI 윤리 시민 감사관 완주증' : '네 가지 증거 확인서',
    bodyKo: complete
      ? '아래 사람은 여섯 장의 증거를 검증하고, 개인정보를 보호하며 잘못된 자동 결정에 설명과 재검토를 요구했습니다.'
      : '아래 사람은 개인정보·편향·저작권·딥페이크에 관한 네 가지 증거를 확인했습니다. 삭제 명령의 나머지 기록을 찾는 항로가 열렸습니다.',
    deeds,
    pledgeKo: '“개인정보를 지키고, 편향과 출처를 살피며, AI의 결정에도 이유와 재검토를 요구하겠습니다.”',
    novaLineKo: complete ? '— 하루와 도트, 질문할 권리를 지킨 친구에게' : '— 감사 드론 도트, 다음 증거 보관소에서',
    recovered,
    recoveredNoteKo: recovered
      ? '실수한 순간도 있었지만, 돌아가서 바로잡았습니다. 그래서 더 단단한 약속입니다.'
      : ''
  };
}
