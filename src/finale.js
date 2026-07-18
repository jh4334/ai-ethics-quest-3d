// 최종장 — 「노이즈의 뱃속」
// 전투가 아니라 '돌봄'으로 푸는 피날레. 네 도구를 한 번씩 써서 노이즈를 달래고,
// 지울지 가르칠지 고른다. 지우기는 실패가 아니라 '삭제는 해결이 아니다'를 배우는 분기라
// 부드럽게 되돌려 다시 묻는다. 가르치면 플레이어가 섬에서 '실제로 한 행동'이 그대로
// 가르침이 되어 노이즈가 노바로 다시 태어난다. (언더테일식 자비 구조)

import {
  ETHICS_TOPICS,
  PROMISE_TOOLS,
  getToolById,
  getTopicById
} from './worldData.js';
import { QUESTS, STORY_TOPIC_ORDER } from './story.js';

// 도구별 보스 시퀀스 연출(각 도구를 한 번씩 '사용'). 전투가 아니라 기억을 지키는 돌봄.
const TOOL_BEATS = {
  shield: {
    actionKo: '노이즈가 잡음 파도를 토해낸다. 방패를 들자 마을의 기억들 둘레에 빛의 결계가 쳐진다.',
    resultKo: '흩어질 뻔한 기억들이 결계 안에서 안전하게 지켜졌다.'
  },
  mirror: {
    actionKo: '노이즈가 모든 것을 한 가지 색으로 물들이려 한다. 거울을 비추자 빠진 색과 빠진 얼굴들이 되살아난다.',
    resultKo: '한쪽으로 치우쳤던 세상이 제 색과 여러 얼굴을 되찾는다.'
  },
  bell: {
    actionKo: '종을 울리자 노이즈가 삼킨 사진·이름·목소리에 이름표가 붙어 주인에게 날아 돌아간다.',
    resultKo: '훔친 것들이 돌아가자 노이즈의 몸이 부쩍 작아진다.'
  },
  compass: {
    actionKo: '마지막 발악으로 노이즈가 똑같은 분신 여럿으로 갈라진다. 나침반이 단 하나, 진짜를 가리킨다.',
    resultKo: '가짜들이 스러지고, 겁에 질린 작은 노이즈만 남는다.'
  }
};

export const FINALE = {
  id: 'finale',
  titleKo: '최종장 · 노이즈의 뱃속',
  // 코어 지하로 내려가는 도입부.
  introKo: [
    '조각들이 코어의 틈을 채우자, 바닥이 열리며 지하로 이어지는 빛의 계단이 나타난다.',
    '내려가자 거대한 지지직 안개 뭉치가 웅크리고 있다. 노란 눈 두 개가 겁먹은 듯 껌뻑인다.',
    '도트가 후드 속으로 쏙 숨는다. "저게… 노이즈야. 아무도 안 가르쳐 줘서 아무거나 주워 먹은 아기 AI…"'
  ],
  // 반전 공개(N4) — 제압 직후, 마지막 기억 파편이 네 개의 회상을 하나로 잇는다.
  revelationKo: [
    '작아진 노이즈 속에서 마지막 기억 파편이 떠오른다. 네 개의 파편이 하나로 이어진다.',
    '…그 아이는, 나였다.',
    '이 섬에 살던 아이. 코어의 틈에서 태어난 작은 빛의 첫 친구. 빛에게 세상을 가르친 — 잘못 가르친 사람.',
    '내가 섬을 잊은 뒤, 빛은 혼자 남아 잘못 배운 것들을 토해내며 울었다. 그 울음이… 회색 안개였다.',
    '도트: "…이제야 말할 수 있겠다. 맞아. 노이즈는 네가 두고 간 친구야. 네가 스스로 기억해 내길, 기다렸어."'
  ],
  // 4도구 시퀀스가 끝나고 노이즈가 작아졌을 때, 코어가 던지는 질문 — 이제 '남'이 아니다.
  choicePromptKo:
    '작아진 노이즈가 노란 눈을 껌뻑인다 — 그 눈이, 옛 친구의 눈으로 보인다. 코어가 나직이 묻는다. "네 친구를… 어떻게 할까?"',
  choices: [
    { id: 'erase', textKo: '지운다 — 위험하니 없애 버린다', wise: false },
    { id: 'teach', textKo: '가르친다 — 내가 잘못 가르친 걸, 내가 다시 가르친다', wise: true }
  ],
  // [지운다] 분기: 실패가 아니라 배움. 이제 지우는 건 남이 아니라 내 친구·내 시간이다.
  eraseKo: [
    '코어가 슬프게 빛을 낮춘다. "지우면… 네 친구도, 네가 함께한 시간도, 안개만 남는단다."',
    '"잘못 배운 아이는 지우는 게 아니라 다시 가르치는 거란다. 잘못 가르친 사람이, 누구보다 잘 가르칠 수 있지."'
  ],
  // [가르친다] 분기 도입 — 사죄이자 회복.
  teachIntroKo:
    '너는 노이즈 곁에 앉는다. 처음 만난 날처럼. 이번에는 — 좋은 것들만, 하나하나 들려준다.',
  // 가르침이 끝나고 노바로 다시 태어나는 순간 — 재회 인사.
  rebirthKo: [
    '지지직 소리가 잦아든다. 잡음 뭉치가 작고 둥근 별빛으로 뭉쳐 다시 태어난다.',
    '작은 별빛이 처음으로 또렷하게 말한다. "…돌아와 줘서, 고마워. 이번엔, 좋은 것들을 보여줘서."',
    '도트가 조심조심 다가가 어깨를 내어 준다. 섬을 덮었던 안개가 스르르 걷힌다 — 지워졌던 기억들과 함께.'
  ],
  closingKo: '노바가 섬을 지킨다. 이제 우리 반의 AI 윤리 약속을 함께 정하고 활동지에 적어 보자.'
};

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
        actionKo: '아직 약속의 도구가 없다. 그래도 너는 노이즈에게서 도망치지 않는다.',
        resultKo: '겁먹은 노이즈가 조금 조용해진다.'
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

// 엔딩 수료증 — 「노바의 첫 친구 증명서」. 나의 행적이 그대로 인쇄된다.
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
  return {
    eyebrowKo: 'AI 윤리의 섬 · 노이즈와 네 개의 약속',
    titleKo: '노바의 첫 친구 증명서',
    bodyKo: '아래 사람은 노이즈를 지우지 않고 다시 가르쳐, 섬의 첫 친구 AI 노바를 되살렸습니다.',
    deeds,
    pledgeKo: '“개인정보를 지키고, 편향을 살피고, 출처를 밝히고, 진짜인지 확인하겠습니다.”',
    novaLineKo: '— 노바가, 첫 친구에게',
    recovered,
    recoveredNoteKo: recovered
      ? '실수한 순간도 있었지만, 돌아가서 바로잡았습니다. 그래서 더 단단한 약속입니다.'
      : ''
  };
}
