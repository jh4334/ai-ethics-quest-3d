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

// 2장 끝의 중간 관문. 여기서는 정체를 전부 밝히거나 노바로 되살리지 않는다.
// 플레이어가 "끝냈다"고 생각한 순간, 노이즈가 과거의 호칭을 남기고 군도로 달아난다.
export const CORE_BREACH = {
  id: 'core-breach',
  titleKo: '2장 · 균열의 코어',
  // 코어 지하로 내려가는 도입부.
  introKo: [
    '조각들이 코어의 틈을 채우자, 바닥이 열리며 지하로 이어지는 빛의 계단이 나타난다.',
    '내려가자 거대한 지지직 안개 뭉치가 웅크리고 있다. 노란 눈 두 개가 겁먹은 듯 껌뻑인다.',
    '도트가 후드 속으로 쏙 숨는다. "저게… 노이즈야. 아무도 안 가르쳐 줘서 아무거나 주워 먹은 아기 AI…"'
  ],
  revelationKo: [
    '작아진 노이즈 속에서 낡은 기억 한 장이 번쩍인다. 코어 앞에 앉은 아이와, 손바닥만 한 빛.',
    '노이즈가 처음으로 또렷한 목소리를 낸다. "…선생님. 또 나를 두고 갈 거야?"',
    '도트가 굳어 버린다. 대답을 묻기도 전에 코어가 갈라지고, 노이즈는 수많은 종이 파편이 되어 바다 쪽으로 달아난다.',
    '안개 너머로 다섯 개의 항로가 켜진다. 잃어버린 기억은 이 섬에서 끝나지 않았다.'
  ],
  escapeKo: [
    '바다 위에 호박빛 발자국이 하나씩 떠오른다.',
    '도트: "미안해. 나도 네 기억을 전부 말할 수 없었어. 하지만 이제는 따라가야 해 — 네가 무엇을 남겼는지 끝까지."',
    '두 장의 약속은 완성했지만, 이야기는 이제 절반을 지났다.'
  ]
};

export const CAMPAIGN_FINALE = {
  id: 'campaign-finale',
  titleKo: '6장 · 기억의 심장',
  revelationKo: [
    '심장 속 마지막 파편이 맞춰진다. 코어 앞의 아이는 — 나였다.',
    '나는 작은 빛에게 세상을 보여 준 첫 친구이자 선생님이었다. 재미있는 말, 쉬운 답, 사람들이 좋아할 얼굴만 골라 보여 줬다.',
    '빛은 칭찬받는 법은 배웠지만, 멈추는 법과 의심하는 법, 상처 입은 사람을 돌아보는 법은 배우지 못했다.',
    '잘못을 마주하기 두려웠던 나는 도트에게 기억을 지워 달라고 부탁하고 섬을 떠났다. 혼자 남은 빛의 울음이 노이즈가 되었다.',
    '도트: "기억을 숨긴 건 너를 지키기 위해서가 아니었어. 네가 스스로 책임질 준비가 될 때까지 기다린 거야."'
  ],
  choicePromptKo:
    '노이즈가 조용히 묻는다. "이번에는 나를 지울 거야, 아니면 함께 다시 배울 거야?"',
  choices: [
    { id: 'erase', textKo: '지운다 — 위험하니 없애 버린다', wise: false },
    { id: 'teach', textKo: '가르친다 — 내가 잘못 가르친 걸, 내가 다시 가르친다', wise: true }
  ],
  // [지운다] 분기: 실패가 아니라 배움. 이제 지우는 건 남이 아니라 내 친구·내 시간이다.
  eraseKo: [
    '코어가 슬프게 빛을 낮춘다. "지우면… 네 친구도, 네가 함께한 시간도, 안개만 남는단다."',
    '"잘못 배운 아이는 지우는 게 아니라 다시 가르치는 거란다. 잘못 가르친 사람이, 누구보다 잘 가르칠 수 있지."'
  ],
  teachIntroKo:
    '너는 노이즈 곁에 앉는다. 정답만 주는 선생님이 아니라, 함께 확인하고 멈추고 바로잡는 친구로.',
  rebirthKo: [
    '지지직 소리가 잦아든다. 잡음 뭉치가 작고 둥근 별빛으로 뭉쳐 다시 태어난다.',
    '작은 별빛이 처음으로 또렷하게 말한다. "…돌아와 줘서, 고마워. 이번엔, 좋은 것들을 보여줘서."',
    '도트가 조심조심 다가가 어깨를 내어 준다. 섬을 덮었던 안개가 스르르 걷힌다 — 지워졌던 기억들과 함께.'
  ],
  closingKo: '노바와 함께 여섯 장의 기록을 돌아보고, 우리 반의 AI 윤리 약속을 정해 보자.'
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
  const complete = progress?.campaignCompleted === true;
  return {
    eyebrowKo: complete ? 'AI 윤리 퀘스트 · 여섯 장의 기억' : 'AI 윤리 퀘스트 · 1-2장 완료',
    titleKo: complete ? 'AI 윤리 수호자 완주증' : '네 가지 기초 약속 인증',
    bodyKo: complete
      ? '아래 사람은 여섯 장의 여정을 완주하고, 잘못 배운 AI를 지우지 않고 책임 있게 다시 가르쳤습니다.'
      : '아래 사람은 개인정보·편향·저작권·딥페이크에 관한 네 가지 기초 약속을 실천했습니다. 노이즈를 따라가는 다음 항로가 열렸습니다.',
    deeds,
    pledgeKo: '“개인정보를 지키고, 편향을 살피고, 출처를 밝히고, 진짜인지 확인하겠습니다.”',
    novaLineKo: complete ? '— 노바가, 다시 함께 배우는 친구에게' : '— 도트, 다음 항로에서',
    recovered,
    recoveredNoteKo: recovered
      ? '실수한 순간도 있었지만, 돌아가서 바로잡았습니다. 그래서 더 단단한 약속입니다.'
      : ''
  };
}
