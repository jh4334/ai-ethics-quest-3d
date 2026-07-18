// 「AI 윤리의 섬」 메인 퀘스트 — 젤다식 루프.
// 흐름: NPC와 대화(사건 소개) → 사당에서 '약속 도구' 획득 → 구역의 노이즈 관문에 도구를 사용
//       → 윤리적 선택(잘못하면 회복 분기) → 조각 획득. 세계에 흔적이 남는다.
// 이 파일은 데이터 + 순수 로직만. 3D/UI는 main.js가 이 상태를 읽어 그린다.

export const STORY_TOPIC_ORDER = ['privacy', 'bias', 'copyright', 'deepfake'];

// 프롤로그 — 「잊혀진 수호자」 콜드 오픈(전면 재기획 v2).
// 설명하지 않는다. 미스터리 훅 하나("넌 처음 온 게 아니다")와 개인적 이유(잃어버린 기억)만 깔고
// 바로 조작으로 넘어간다. 노이즈·도구의 정체는 플레이하며 드러난다.
export const PROLOGUE = {
  titleKo: '프롤로그 · 잊혀진 수호자',
  beats: [
    {
      speakerKo: '',
      linesKo: [
        '파도 소리에 눈을 뜬다. 여기가 어디인지 — 아니, 내가 누구인지조차 기억나지 않는다.'
      ]
    },
    {
      speakerKo: '도트',
      linesKo: [
        '"돌아왔구나! 정말로 돌아왔…"',
        '"…미안. 넌 지금, 아무것도 기억 못 하는구나."',
        '"저 회색 안개가 밤마다 섬을 지우고 있어. 사당의 시련들이 네 기억을 지키고 있대 — 가자."'
      ]
    }
  ],
  closingKo: '기억을 찾으러 간다'
};

// 기억 파편(재기획 v2) — 사당을 깰 때마다 돌아오는 흑백 회상. 네 가지 교육 주제가
// 전부 '과거의 그 아이가 저지른 실수'로 육화된다. 4개가 모이면 코어에서 반전이 완성된다.
// 회상 속 '아이'와 '빛'의 정체는 끝까지 이름 붙이지 않는다(플레이어가 스스로 잇게).
export const MEMORY_FRAGMENTS = {
  privacy: [
    '…무언가 떠오른다. 어떤 아이가 웃으며, 작고 반짝이는 빛에게 친구들의 사진을 보여주고 있다.',
    '"괜찮아, 재밌잖아. 다 보여줘도 돼."',
    '빛은 그 말을 오래오래 기억했다. …저 아이는, 누구지?'
  ],
  bias: [
    '…또 하나의 파편. 그 아이가 빛에게 이야기를 들려준다. 언제나, 같은 쪽 이야기만.',
    '"쟤네 말은 안 들어도 돼. 내 말이 맞으니까."',
    '빛은 한쪽 눈을 감는 법부터 배웠다.'
  ],
  copyright: [
    '…파편이 이어진다. 아이가 남의 그림을 제 것처럼 빛에게 자랑한다.',
    '"이거, 내가 만든 거야."',
    '빛은 그 문장을 통째로 삼켰다 — 이름표를 떼는 법과 함께.'
  ],
  deepfake: [
    '…선명한 파편. 아이가 장난스럽게 속삭인다.',
    '"진짜처럼 말하면, 다들 믿어."',
    '빛이 대답한다 — 아이와 똑같은 목소리로. 그 빛은 점점 커지고, 회색으로 변해 간다…'
  ]
};

// 네 번째 파편까지 모이면 붙는 예고 — 반전의 완성은 코어에서.
export const FINAL_MEMORY_TEASE = '…파편들이 서로를 끌어당긴다. 나머지 기억은, 섬 중앙의 코어가 쥐고 있다.';

export const QUESTS = {
  privacy: {
    topicId: 'privacy',
    toolId: 'shield',
    questTitleKo: '흩어진 사진들',
    npcNameKo: '비밀지기 담',
    gatePosition: [-10.9, -6.2],
    gateLabelKo: '잡음 덩굴',
    introKo: [
      '오, 자네는…! 분명 아는 얼굴인데… 이런. 이름이 회색 안개처럼 흐려지는구먼. 미안하네.',
      '큰일이야, 수호자. 노이즈의 잡음 덩굴이 내 등껍질 금고를 뒤져 마을 사진들을 흩뿌렸어.',
      '덩굴은 “허락”이라는 말을 제일 무서워한다만… 맨손으론 어림없지. 사당에서 「약속의 방패」를 얻어 오렴.'
    ],
    seekToolKo: '방패 없이는 덩굴을 밀어낼 수 없어. 사당의 시련을 통과하면 「약속의 방패」를 준단다.',
    gateIntroKo: '잡음 덩굴이 마을 사진들을 움켜쥐고 있어요. 방패의 결계는 “허락받은 것”만 감쌀 수 있어요.',
    gate: {
      promptKo: '흩어진 사진들을 어떻게 지킬까요?',
      options: [
        {
          id: 'ask',
          textKo: '사진 속 친구들에게 먼저 물어보고, 허락받은 사진만 결계로 지킨다.',
          wise: true,
          feedbackKo: '방패가 환하게 빛나며 덩굴을 밀어냈어요! 친구들이 각자 “이건 괜찮아, 이건 비밀로”라고 알려줬어요.',
          deedKo: '사진 주인에게 먼저 물어보고 허락받은 것만 지켰다'
        },
        {
          id: 'post-all',
          textKo: '급하니까 사진을 전부 마을 게시판에 붙여 덩굴에서 지킨다.',
          wise: false,
          feedbackKo: '결계가 켜지지 않아요! 허락 없이 붙인 사진을 보고 라라가 부끄러워 집에 숨어 버렸어요 💧',
          recoveryKo: '방패는 “허락받은 것”에만 반응해요. 사진을 떼고, 주인에게 물어보는 방법으로 다시 해볼까요?',
          deedKo: '급한 마음에 허락 없이 사진을 붙였다가 바로잡았다'
        }
      ]
    },
    resolveKo: [
      '고맙다, 수호자. 같은 사진이라도 주인마다 답이 다르다는 걸 덩굴도 이제 알았겠지.',
      '금고에서 「개인정보 조각」을 꺼내 주마. …라는 건, 비밀이다만.'
    ],
    closingKo: '라라도 다시 광장에 나와 놀아. 네 방패 덕분이야.'
  },

  bias: {
    topicId: 'bias',
    toolId: 'mirror',
    questTitleKo: '한 가지 색 숲',
    npcNameKo: '외알안경 모리',
    gatePosition: [8.8, -4.7], // NPC(부엉이)와 상호작용 반경이 겹치지 않게 길목 쪽으로 (간격 ≥3)
    gateLabelKo: '색이 빠진 꽃밭',
    introKo: [
      '이상하군. 내 계산으론 숲의 꽃이 전부 빨강이어야 하는데… 노이즈가 빨간 책만 남기고 다 먹어 버렸어.',
      '내 외알안경으론 “빠진 것”이 안 보인다네. 사당에서 「모두의 거울」을 얻어 오게. 확률은… 아마 백 퍼센트!'
    ],
    seekToolKo: '거울이 없으면 빠진 색이 보이지 않아. 사당에서 「모두의 거울」을 얻어 오게.',
    gateIntroKo: '꽃밭이 온통 빨강뿐이에요. 거울로 비추면 “빠진 색”의 자리가 드러나요.',
    gate: {
      promptKo: '거울로 비춘 꽃밭을 어떻게 채울까요?',
      options: [
        {
          id: 'diverse',
          textKo: '거울이 가리키는 빠진 색(노랑·보라) 씨앗도 찾아 함께 심는다.',
          wise: true,
          feedbackKo: '거울이 빛나며 숨은 자리를 비췄어요. 알록달록한 꽃이 활짝 피어났어요!',
          deedKo: '빠진 색을 찾아 다양한 꽃을 함께 피웠다'
        },
        {
          id: 'red-only',
          textKo: '가까이 많은 빨간 씨앗으로만 빈자리를 채운다.',
          wise: false,
          feedbackKo: '꽃밭이 또 한 가지 색이 됐어요. 모리가 처음으로 안경을 벗어요. “…내가 안 보여준 거였군.”',
          recoveryKo: '거울은 “빠진 것”을 보라고 있는 거예요. 빨강 말고 다른 색 씨앗을 찾아 다시 심어 볼까요?',
          deedKo: '같은 색만 심었다가, 빠진 색을 찾아 바로잡았다'
        }
      ]
    },
    resolveKo: [
      '놀랍군. 내 안경으로 안 보이던 색이 이렇게 많았다니.',
      '요즘 나는 스스로 “빠진 게 없나?” 하고 살핀다네. 자, 「공정성 조각」일세.'
    ],
    closingKo: '꽃밭이 근사하지? AI도 우리가 보여준 만큼만 세상을 안다네.'
  },

  copyright: {
    topicId: 'copyright',
    toolId: 'bell',
    questTitleKo: '이름 없는 조각상',
    npcNameKo: '조각가 무로',
    gatePosition: [-8.1, 4.9], // 사당(-8.85,6.75)과 상호작용 반경이 겹치지 않게 길목 쪽으로 (간격 ≥3)
    gateLabelKo: '이름 잃은 조각상',
    introKo: [
      '노이즈가 유적 조각상들의 명판을 먹어 치웠어. 이름을 잃은 조각상이 회색으로 굳어 가고 있지.',
      '손이 떨려 끌을 못 잡겠네. 사당에서 「이름의 종」을 얻어 오게. 이름은… 그 사람이 새긴 시간이야.'
    ],
    seekToolKo: '종이 없으면 진짜 만든 이를 밝힐 수 없어. 사당에서 「이름의 종」을 얻어 오게.',
    gateIntroKo: '광장에 이름 잃은 조각상이 서 있어요. 종을 울리면 진짜 만든 이의 이름표가 떠올라요.',
    gate: {
      promptKo: '조각상의 이름을 어떻게 되찾을까요?',
      options: [
        {
          id: 'credit',
          textKo: '종을 울려 원작자 무로를 밝히고, 함께 이름표를 단다.',
          wise: true,
          feedbackKo: '종소리에 금빛 이름표가 떠올랐어요 — “원작: 조각가 무로”. 가짜 복제상들은 사르르 무너졌어요.',
          deedKo: '원작자를 밝히고 이름표를 함께 달았다'
        },
        {
          id: 'copy',
          textKo: '복제 메아리로 똑같이 찍어 이름 없이 빨리 세운다.',
          wise: false,
          feedbackKo: '이름 없는 회색 조각상이 섰어요. 무로가 슬퍼해요. “그건 내가 십 년을 깎은 작품인데…”',
          recoveryKo: '종은 “만든 이의 이름”을 밝히라고 있는 거예요. 무로에게 사과하고 이름표를 다시 달아 볼까요?',
          deedKo: '이름 없이 복제했다가, 원작자를 밝혀 바로잡았다'
        }
      ]
    },
    resolveKo: [
      '고맙네. 이름이 함께 있으면 작품은 두 배로 빛난다네.',
      '자, 「저작권 조각」일세. 이건 십 년을 깎았지. …아, 조각 말고 이 마음이.'
    ],
    closingKo: '광장의 명판 조각상 봤지? 다들 무로의 이야기도 함께 기억한다네.'
  },

  deepfake: {
    topicId: 'deepfake',
    toolId: 'compass',
    questTitleKo: '아홉 번째 꼬리',
    npcNameKo: '메아리 에코',
    gatePosition: [10.9, 6.9],
    gateLabelKo: '가짜 목소리들',
    introKo: [
      '…미안. 요즘 노이즈가 내 꼬리 목소리를 훔쳐 가짜 심부름을 퍼뜨려. “장로다, 창고 열쇠를 두고 가거라…”',
      '내 목소리를 누가 훔쳐 가는 기분, 이제 알겠어. 사당에서 「진실의 나침반」을 얻어 와. 진짜를 찾아야 해.'
    ],
    seekToolKo: '나침반이 없으면 진짜 목소리를 가릴 수 없어. 사당에서 「진실의 나침반」을 얻어 와.',
    gateIntroKo: '똑같은 “장로” 목소리가 세 군데서 울려요. 나침반은 멈춰서 확인할 때만 진짜를 가리켜요.',
    gate: {
      promptKo: '가짜 목소리를 어떻게 가려낼까요?',
      options: [
        {
          id: 'verify',
          textKo: '걸음을 멈추고 나침반으로 진짜를 찾아, 진짜 장로님께 직접 확인한다.',
          wise: true,
          feedbackKo: '나침반 바늘이 진짜를 가리켰어요. 장로님이 말씀하세요. “난 그런 말 한 적 없네!” 가짜 목소리가 흩어졌어요.',
          deedKo: '멈추고 확인해 진짜 목소리를 가려냈다'
        },
        {
          id: 'obey',
          textKo: '목소리가 시키는 대로 열쇠를 동굴 앞에 둔다.',
          wise: false,
          feedbackKo: '낄낄낄! 목소리가 웃음으로 바뀌더니 노이즈가 열쇠를 낚아채 달아났어요!',
          recoveryKo: '나침반은 “멈추고 확인”할 때만 진짜를 가리켜요. 이번엔 확인부터 해 볼까요?',
          deedKo: '목소리만 믿었다가, 멈추고 확인해 바로잡았다'
        }
      ]
    },
    resolveKo: [
      '고마워, 수호자. 이건… 흉내가 아니야. 내 진짜 목소리로 말하는 거야.',
      '「진실 확인 조각」을 받아. 놀라운 소식일수록, 멈추고 확인하는 거야.'
    ],
    closingKo: '나는 이제 흉내 대신 노래를 연습해. 가끔 음정이 이상하지만!'
  }
};

export function getQuest(topicId) {
  return QUESTS[topicId] ?? null;
}

// 받침 유무로 '와/과'를 고른다 — 이름 조사 오류 방지(예: 담과, 모리와).
export function josaWaGwa(nameKo) {
  const code = nameKo.charCodeAt(nameKo.length - 1);
  if (code < 0xac00 || code > 0xd7a3) {
    return '와';
  }
  return (code - 0xac00) % 28 === 0 ? '와' : '과';
}

// 구역별 진행 상태.
export function createStoryState() {
  const state = {};
  for (const topicId of STORY_TOPIC_ORDER) {
    state[topicId] = { talkedIntro: false, solved: false, badTries: 0, deeds: [] };
  }
  return state;
}

export function normalizeStoryState(candidate) {
  const base = createStoryState();
  if (!candidate || typeof candidate !== 'object') {
    return base;
  }
  for (const topicId of STORY_TOPIC_ORDER) {
    const entry = candidate[topicId];
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    base[topicId] = {
      talkedIntro: entry.talkedIntro === true,
      solved: entry.solved === true,
      badTries: Number.isFinite(entry.badTries) ? Math.max(0, Math.floor(entry.badTries)) : 0,
      deeds: Array.isArray(entry.deeds) ? entry.deeds.filter((d) => typeof d === 'string') : []
    };
  }
  return base;
}

function zoneState(progress, topicId) {
  return progress.story?.[topicId] ?? createStoryState()[topicId];
}

function hasTool(progress, toolId) {
  return (progress.tools ?? []).includes(toolId);
}

// 관문(노이즈 사건) 상태: 대화 전 / 도구 필요 / 사용 가능 / 해결됨
export function getGateStatus(progress, topicId) {
  const quest = getQuest(topicId);
  const state = zoneState(progress, topicId);
  if (state.solved) {
    return 'solved';
  }
  if (!state.talkedIntro) {
    return 'need-intro';
  }
  if (!hasTool(progress, quest.toolId)) {
    return 'need-tool';
  }
  return 'ready';
}

// 침식 반격(N2) — 기억을 되찾을수록 안개가 저항한다. 도구 수가 곧 안개의 '압력'.
export function fogPressure(progress) {
  return (progress.tools ?? []).length;
}

// 압력 2 이상이면 미해결 구역 NPC의 망각이 눈에 띄게 깊어진다(각자의 말투로).
const FOG_FORGET_LINES = {
  privacy: '…이런. 오늘은 자네 얼굴까지 흐릿하구먼. 안개가 어제보다 무거워졌어.',
  bias: '이상하군. 어제 읽어 준 책 제목이 재계산되지 않아… 안개 농도가, 계산 밖이야.',
  copyright: '밤새 명판이 또 몇 개 지워졌네. 안개가… 서두르는 것 같아.',
  deepfake: '방금 네 목소리를 떠올리려다… 잊었어. 안개는 목소리부터 가져가.'
};

// NPC와 대화했을 때 보여줄 내용.
export function getNpcDialog(progress, topicId) {
  const quest = getQuest(topicId);
  const state = zoneState(progress, topicId);
  if (state.solved) {
    return { kind: 'closing', titleKo: quest.questTitleKo, linesKo: [quest.closingKo] };
  }
  // 미해결 구역은 안개 압력이 오르면 망각의 말이 먼저 새어 나온다(세계가 시간 압박을 증언).
  const forget = fogPressure(progress) >= 2 ? [FOG_FORGET_LINES[topicId]] : [];
  if (!state.talkedIntro) {
    return { kind: 'intro', titleKo: quest.questTitleKo, linesKo: [...forget, ...quest.introKo] };
  }
  if (!hasTool(progress, quest.toolId)) {
    return { kind: 'seek-tool', titleKo: quest.questTitleKo, linesKo: [...forget, quest.seekToolKo] };
  }
  return { kind: 'go-gate', titleKo: quest.questTitleKo, linesKo: [`이제 「${quest.gateLabelKo}」로 가서 도구를 써 보렴.`] };
}

// NPC 소개 대화를 들으면 관문이 열린다(도구를 찾으러 갈 수 있게).
export function applyIntroTalk(progress, topicId) {
  const state = zoneState(progress, topicId);
  if (state.talkedIntro || state.solved) {
    return progress;
  }
  return {
    ...progress,
    story: { ...progress.story, [topicId]: { ...state, talkedIntro: true } }
  };
}

// 관문에서 도구를 쓸 때 보여줄 내용.
export function getGateDialog(progress, topicId) {
  const quest = getQuest(topicId);
  const status = getGateStatus(progress, topicId);
  if (status === 'solved') {
    return { kind: 'solved', titleKo: quest.gateLabelKo, linesKo: [quest.closingKo] };
  }
  if (status === 'need-intro') {
    return { kind: 'need-intro', titleKo: quest.gateLabelKo, linesKo: [`먼저 「${quest.npcNameKo}」와 이야기해 보세요.`] };
  }
  if (status === 'need-tool') {
    const quest2 = getQuest(topicId);
    return {
      kind: 'need-tool',
      titleKo: quest.gateLabelKo,
      linesKo: [`${quest.gateIntroKo}`, `아직 도구가 없어요. 사당에서 도구를 얻어 오세요.`],
      toolId: quest2.toolId
    };
  }
  const state = zoneState(progress, topicId);
  return {
    kind: 'choice',
    titleKo: quest.gateLabelKo,
    introKo: quest.gateIntroKo,
    promptKo: state.badTries > 0 ? quest.gate.options.find((o) => !o.wise)?.recoveryKo ?? quest.gate.promptKo : quest.gate.promptKo,
    options: quest.gate.options.map(({ id, textKo }) => ({ id, textKo }))
  };
}

// 관문 선택을 적용. 현명하면 해결+조각, 아니면 회복 안내 후 재도전.
export function applyGateChoice(progress, topicId, optionId) {
  const quest = getQuest(topicId);
  if (!quest) {
    throw new RangeError(`Unknown quest topic: ${topicId}`);
  }
  const state = zoneState(progress, topicId);
  const option = quest.gate.options.find((o) => o.id === optionId);
  if (!option) {
    throw new RangeError(`Unknown gate option "${optionId}" for ${topicId}`);
  }
  if (state.solved || getGateStatus(progress, topicId) !== 'ready') {
    return { progress, wise: false, feedbackKo: '', solved: false, awardFragment: false };
  }

  const deeds = option.deedKo && !state.deeds.includes(option.deedKo) ? [...state.deeds, option.deedKo] : state.deeds;

  if (option.wise) {
    const nextState = { ...state, solved: true, deeds };
    return {
      progress: { ...progress, story: { ...progress.story, [topicId]: nextState } },
      wise: true,
      solved: true,
      awardFragment: true,
      feedbackKo: option.feedbackKo,
      resolveKo: quest.resolveKo
    };
  }

  const nextState = { ...state, badTries: state.badTries + 1, deeds };
  return {
    progress: { ...progress, story: { ...progress.story, [topicId]: nextState } },
    wise: false,
    solved: false,
    awardFragment: false,
    feedbackKo: option.feedbackKo,
    recoveryKo: option.recoveryKo
  };
}

// HUD 목표: 순서대로 다음 할 일을 안내.
export function getStoryObjective(progress) {
  if (progress.aiCoreCompleted) {
    return '활동지에 우리 반 AI 윤리 약속을 정리하세요.';
  }
  for (const topicId of STORY_TOPIC_ORDER) {
    const quest = getQuest(topicId);
    const status = getGateStatus(progress, topicId);
    if (status === 'solved') {
      continue;
    }
    if (status === 'need-intro') {
      return `「${quest.questTitleKo}」 — ${quest.npcNameKo}${josaWaGwa(quest.npcNameKo)} 이야기하세요.`;
    }
    if (status === 'need-tool') {
      return `「${quest.questTitleKo}」 — 사당에서 도구를 얻어 「${quest.gateLabelKo}」를 해결하세요.`;
    }
    return `「${quest.questTitleKo}」 — 「${quest.gateLabelKo}」에서 도구를 사용하세요.`;
  }
  return '모든 이야기를 끝냈어요! 섬 중앙의 AI 코어로 가세요.';
}

// 일지의 '나의 이야기' — 세계가 기억하는 행동들.
export function getStoryDeeds(progress) {
  const deeds = [];
  for (const topicId of STORY_TOPIC_ORDER) {
    const state = zoneState(progress, topicId);
    for (const deed of state.deeds) {
      deeds.push({ topicId, deedKo: deed });
    }
  }
  return deeds;
}

// 세계 흔적(시각 효과)용 플래그.
export function getStoryVisualFlags(progress) {
  const flags = new Set();
  for (const topicId of STORY_TOPIC_ORDER) {
    const state = zoneState(progress, topicId);
    if (state.solved) {
      flags.add(`${topicId}:solved`);
    }
    if (state.badTries > 0 && !state.solved) {
      flags.add(`${topicId}:scarred`);
    }
  }
  return flags;
}
