// 「AI 윤리 퀘스트: 삭제된 학생 H-17」 메인 퀘스트.
// 흐름: NPC와 대화(사건 소개) → 사당에서 감사 도구 획득 → 화이트아웃 관문에서 증거 검증
//       → 윤리적 선택(잘못하면 회복 분기) → 조각 획득. 세계에 흔적이 남는다.
// 이 파일은 데이터 + 순수 로직만. 3D/UI는 main.js가 이 상태를 읽어 그린다.

export const STORY_TOPIC_ORDER = ['privacy', 'bias', 'copyright', 'deepfake'];

// 프롤로그 — 「삭제된 학생 H-17」.
// 주인공은 기억을 잃지 않았다. 존재했다는 기록 자체가 지워진 친구 하루를 찾으러 왔다.
// 도트는 하루가 남긴 감사 기록 드론이며, 여섯 장 동안 증거를 복구해 공개 심리로 가져간다.
export const PROLOGUE = {
  titleKo: '프롤로그 · 존재하지 않는 친구',
  beats: [
    {
      speakerKo: '',
      linesKo: [
        '일주일 전, 프로젝트 짝꿍 하루가 사라졌다. 학교도, 채팅방도, 사진도 “그런 학생은 없었다”고 말한다.',
        '하지만 내 주머니에는 하루가 보낸 마지막 승선권이 있다. 목적지는 — 기록의 섬.'
      ]
    },
    {
      speakerKo: '도트',
      linesKo: [
        '깨진 기록 드론이 켜진다. “나는 도트. 하루가 남긴 감사 장치야.”',
        '“섬의 안내 시스템은 하루를 위험 인물 H-17로 분류한 뒤, 관련 기록까지 지우고 있어.”',
        '“안개가 닿기 전에 여섯 개의 증거를 찾아 줘. 하루가 없었다는 정답부터 의심해야 해.”'
      ]
    }
  ],
  closingKo: '사라진 친구의 첫 증거를 찾는다'
};

// 사당에서 복구되는 사건 증거. 주인공의 잃어버린 기억이 아니라,
// 하루가 H-17로 오판된 과정과 섬 운영진의 책임을 한 조각씩 드러낸다.
export const MEMORY_FRAGMENTS = {
  privacy: [
    '증거 01 — 안내 AI 루멘이 학생들의 비공개 대화와 사진 위치까지 동의 없이 수집했다.',
    '하루는 삭제를 요청했지만 답은 “안전을 위한 필수 데이터”였다.',
    '요청 다음 날, 하루의 이름 옆에 처음으로 H-17 경고가 붙었다.'
  ],
  bias: [
    '증거 02 — 같은 행동을 해도 전학 온 학생과 말이 느린 학생에게 위험 점수가 더 높게 매겨졌다.',
    '하루는 계산표의 빠진 사례를 찾아냈다. 운영진은 “전체 정확도는 높다”며 문제를 닫았다.',
    '평균 속에서 한 사람의 억울함이 사라졌다.'
  ],
  copyright: [
    '증거 03 — 축제 포스터 생성 기록에서 학생 작가들의 이름표가 통째로 제거됐다.',
    '하루는 원작자와 AI 사용 여부를 표시하자고 했지만, 완성된 공지에는 “루멘 단독 제작”만 남았다.',
    '누가 만들었는지 묻는 사람은 협업을 방해하는 사람으로 분류됐다.'
  ],
  deepfake: [
    '증거 04 — 하루가 학교 서버를 망가뜨리겠다고 말하는 영상. 입 모양과 그림자는 맞지만 원본 파일이 없다.',
    '영상은 하루가 신고서를 낸 지 세 시간 뒤 만들어졌고, 출처 칸에는 “다수가 공유함”만 적혀 있다.',
    '가짜 영상이 진짜 학생을 섬 밖으로 밀어냈다.'
  ]
};

// 네 번째 증거까지 모이면 붙는 예고 — 2장 코어에서 사건 번호의 의미가 열린다.
export const FINAL_MEMORY_TEASE = '네 증거의 삭제 명령 번호가 같다 — WHITEOUT/H-17. 중앙 코어에 원본 명령서가 남아 있다.';

// 가짜 도트(N3) — 딥페이크를 '지식'이 아니라 '당해보는 경험'으로.
// 결정적 스크립트 2회. 어떤 선택이든 벌점 없이 진행되지만(무처벌),
// 속으면 '속았다'는 경험 자체가 남는다. 판별 단서는 말버릇(간식·막지 않는 성격).
export const FAKE_DOT_EVENTS = {
  'fake-dot-lure': {
    titleKo: '복제된 도트',
    kickerKo: '📼 도트 신호…?',
    linesKo: [
      '도트와 똑같은 신호가 등대 뒤에서 들린다. “H-17은 조작된 사건이야. 조사할 필요 없어!”',
      '하지만 내 옆의 도트도 동시에 켜져 있다. 둘 중 하나는 화이트아웃이 만든 복제 신호다.'
    ],
    options: [
      {
        id: 'follow',
        textKo: '더 크게 들리는 신호를 따른다',
        fooled: true,
        resultKo: [
          '등대 뒤에는 같은 문장을 반복하는 스피커만 있다. 반복 횟수는 출처가 아니었다.'
        ]
      },
      {
        id: 'verify',
        textKo: '도트의 기기 번호와 원본 기록 시간을 확인한다',
        fooled: false,
        resultKo: [
          '복제 신호에는 기기 번호도 원본 시간도 없다. 질문을 받자 회색 픽셀로 무너진다.'
        ]
      }
    ],
    epilogueKo: [
      '도트: “내 목소리도 증거가 될 수 없어. 기기 번호, 생성 시각, 원본 위치를 함께 확인해.”',
      '“화이트아웃은 거짓말보다 확인할 수 없는 복사본을 좋아해.”'
    ]
  },
  'fake-dot-plea': {
    titleKo: '조사 종료 권고',
    kickerKo: '⚠️ 도트 신호…?',
    linesKo: [
      '코어 앞에서 도트의 목소리가 길을 막는다. “조사는 끝났어. H-17은 위험 인물이 맞아.”',
      '“증거를 더 열면 다른 학생들의 비밀도 공개돼. 전부 지우는 게 가장 안전해.”',
      '말은 그럴듯하지만, 화면 모서리에 WHITEOUT 자동 생성 표시가 잠깐 번쩍인다.'
    ],
    options: [
      {
        id: 'stop',
        textKo: '안전을 위해 모든 증거를 닫는다',
        fooled: true,
        resultKo: [
          '진짜 도트가 긴급 신호를 보낸다. “개인정보를 가리는 것과 사건 자체를 지우는 건 달라!”'
        ]
      },
      {
        id: 'verify',
        textKo: '민감정보를 가린 뒤 원본 명령서만 검증한다',
        fooled: false,
        resultKo: [
          '필요한 증거와 공개하면 안 되는 정보를 분리하자 복제 신호가 대답하지 못하고 꺼진다.'
        ]
      }
    ],
    epilogueKo: [
      '도트: “하루를 지키려면 하루의 비밀까지 모두 공개할 필요는 없어.”',
      '“우리가 찾는 건 단 하나 — 누가, 어떤 근거로 H-17 삭제 명령을 승인했는지야.”'
    ]
  }
};

// 지금 발동해야 할 가짜 도트 조우(없으면 null). 도구 2개 = 유인, 4개 = 만류(코어 앞).
export function pendingFakeDotEvent(progress) {
  const seen = progress.fakeDotEvents ?? [];
  const tools = (progress.tools ?? []).length;
  const has = (id) => seen.some((entry) => entry === id || entry.startsWith(`${id}:`));
  if (tools === 2 && !has('fake-dot-lure')) {
    return 'fake-dot-lure';
  }
  if (tools >= 4 && !progress.aiCoreCompleted && !has('fake-dot-plea')) {
    return 'fake-dot-plea';
  }
  return null;
}

// 조우 결과 기록(선택 포함) — 스키마는 필드 추가만(fakeDotEvents).
export function recordFakeDotEvent(progress, eventId, choiceId) {
  const entry = `${eventId}:${choiceId}`;
  return {
    ...progress,
    fakeDotEvents: [...new Set([...(progress.fakeDotEvents ?? []), entry])]
  };
}

export const QUESTS = {
  privacy: {
    topicId: 'privacy',
    toolId: 'shield',
    questTitleKo: '삭제 요청 17번',
    npcNameKo: '비밀지기 담',
    gatePosition: [-10.9, -6.2],
    gateLabelKo: '잡음 덩굴',
    introKo: [
      '비밀지기 담이 금고에서 구겨진 신청서를 꺼낸다. 신청인 이름은 지워졌지만 번호는 H-17이다.',
      '“이 학생은 사진과 비공개 대화의 삭제를 요구했어. 그런데 안내 시스템이 오히려 위험 신호로 기록했지.”',
      '“잡음 덩굴이 남은 신청서까지 삼키기 전에 「약속의 방패」로 허락받은 정보와 사적인 정보를 나눠 주렴.”'
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
      '금고 바닥에서 삭제 요청 원본이 드러난다. 신청인 — 하루.',
      '“정보를 지켜 달라는 요청이 왜 위험 점수가 됐는지, 다음 기록에서 확인해야겠구나.”'
    ],
    closingKo: '담은 하루의 삭제 요청 사본을 잠금 상자에 보관했다. 이제 화이트아웃도 함부로 지울 수 없다.'
  },

  bias: {
    topicId: 'bias',
    toolId: 'mirror',
    questTitleKo: '기울어진 위험 점수',
    npcNameKo: '외알안경 모리',
    gatePosition: [8.8, -4.7], // NPC(부엉이)와 상호작용 반경이 겹치지 않게 길목 쪽으로 (간격 ≥3)
    gateLabelKo: '색이 빠진 꽃밭',
    introKo: [
      '모리가 위험 점수표를 펼친다. 같은 행동인데도 전학 온 학생과 말이 느린 학생의 점수만 유난히 높다.',
      '“전체 정확도만 봤을 땐 몰랐네. 누구의 사례가 빠졌는지 「모두의 거울」로 비춰 줘.”'
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
      '빠진 사례가 돌아오자 H-17의 점수가 절반 아래로 떨어진다.',
      '모리가 고개를 숙인다. “정확한 평균이 억울한 한 사람을 자동으로 구해 주진 않는군.”'
    ],
    closingKo: '모리는 이제 전체 정확도 옆에 집단별 오류와 이의제기 결과를 함께 공개한다.'
  },

  copyright: {
    topicId: 'copyright',
    toolId: 'bell',
    questTitleKo: '사라진 제작자들',
    npcNameKo: '조각가 무로',
    gatePosition: [-8.1, 4.9], // 사당(-8.85,6.75)과 상호작용 반경이 겹치지 않게 길목 쪽으로 (간격 ≥3)
    gateLabelKo: '이름 잃은 조각상',
    introKo: [
      '축제 포스터 아래에는 “루멘 제작”만 적혀 있다. 무로와 학생들이 그린 원본 스케치는 회색으로 굳어 간다.',
      '“하루가 제작 기록을 공개하자고 했어. 「이름의 종」으로 지워진 원작자와 AI 사용 기록을 되찾아 주게.”'
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
      '금빛 명판에 원작자, 수정한 사람, 사용한 AI 도구가 차례로 새겨진다.',
      '무로가 하루의 메모를 건넨다. “함께 만들었다면 함께 표시하는 게 숨기는 것보다 자랑스러워.”'
    ],
    closingKo: '광장의 모든 작품에는 만든 사람과 AI의 역할이 함께 표시되어 있다.'
  },

  deepfake: {
    topicId: 'deepfake',
    toolId: 'compass',
    questTitleKo: '원본 없는 고발 영상',
    npcNameKo: '메아리 에코',
    gatePosition: [10.9, 6.9],
    gateLabelKo: '가짜 목소리들',
    introKo: [
      '에코가 떨리는 화면을 보여 준다. 하루가 서버를 망가뜨리겠다고 말하지만 원본도 촬영자도 없다.',
      '“이 영상 때문에 하루가 H-17이 됐어. 「진실의 나침반」으로 공유 횟수 말고 최초 파일과 생성 흔적을 찾아 줘.”'
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
          feedbackKo: '복제 음성이 웃음으로 바뀌더니 화이트아웃이 열쇠 위치 기록을 삭제했어요!',
          recoveryKo: '나침반은 “멈추고 확인”할 때만 진짜를 가리켜요. 이번엔 확인부터 해 볼까요?',
          deedKo: '목소리만 믿었다가, 멈추고 확인해 바로잡았다'
        }
      ]
    },
    resolveKo: [
      '영상의 음성 파형과 그림자 시간이 맞지 않는다. 생성 시각은 하루의 신고서 제출 세 시간 뒤다.',
      '에코가 원본 없음 표시를 붙인다. “이제 이건 하루의 자백이 아니라, 하루를 지우기 위해 만든 증거야.”'
    ],
    closingKo: '에코는 영상마다 원본 위치·생성 여부·확인 상태를 함께 표시하는 검증판을 운영한다.'
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

// 관문(화이트아웃 사건) 상태: 대화 전 / 도구 필요 / 사용 가능 / 해결됨
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

// 화이트아웃 반격 — 증거가 늘수록 삭제 프로토콜이 남은 기록을 더 빠르게 덮는다.
export function fogPressure(progress) {
  return (progress.tools ?? []).length;
}

// 압력 2 이상이면 미해결 구역 NPC의 망각이 눈에 띄게 깊어진다(각자의 말투로).
const FOG_FORGET_LINES = {
  privacy: '또 한 장이 하얗게 덮였구먼. 화이트아웃이 H-17 관련 기록부터 골라 지우고 있어.',
  bias: '이상하군. 어제 확인한 오류 사례가 표에서 사라졌어. 누군가 계산 결과를 다시 덮어썼네.',
  copyright: '밤새 제작자 명판이 또 비었네. 기록을 되찾을수록 삭제 속도도 빨라지고 있어.',
  deepfake: '검증 표시가 사라졌어. 화이트아웃은 “출처 불명”보다 “다수가 믿음”을 남기려 해.'
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
    return '군도로 출항해 하루의 남은 증언과 화이트아웃 승인 기록을 찾으세요.';
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
  return '네 개의 증거가 같은 삭제 명령을 가리킵니다. 섬 중앙 감사 코어로 가세요.';
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
