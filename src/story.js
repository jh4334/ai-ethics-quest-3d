// 「기억하는 섬」 스토리 퀘스트 엔진.
// 퀴즈가 아니라 행동(줍기·걸어가서 방문·회복)으로 이야기가 진행되고,
// 위험한 선택은 실패가 아니라 '회복하는 분기'가 되어 세계에 흔적을 남긴다.
// 순수 데이터 + 순수 함수만 담당하고, 3D 표현은 main.js가 이 상태를 읽어 그린다.

export const STORY_QUESTS = {
  privacy: {
    topicId: 'privacy',
    titleKo: '흩어진 사진들',
    start: 'meet',
    steps: {
      meet: {
        kind: 'talk',
        linesKo: [
          '큰일이야! 마을의 찰칵 드론이 고장 나서 친구들 사진을 사방에 떨어뜨렸어.',
          '반짝이는 사진 3장만 주워 와 줄래?'
        ],
        next: 'gather'
      },
      gather: {
        kind: 'collect',
        objectiveKo: '마을 주변에 떨어진 사진을 주우세요',
        nudgeKo: ['아직 사진이 남아 있어. 반짝이는 곳을 찾아봐!'],
        accept: ['photo'],
        count: 3,
        pickups: [
          { id: 'photo-1', item: 'photo', emoji: '📷', labelKo: '사진 줍기', at: [-5.6, -4.4] },
          { id: 'photo-2', item: 'photo', emoji: '📷', labelKo: '사진 줍기', at: [-8.2, -2.9] },
          { id: 'photo-3', item: 'photo', emoji: '📷', labelKo: '사진 줍기', at: [-6.2, -7.4] }
        ],
        next: 'decide'
      },
      decide: {
        kind: 'choice',
        promptKo: '드론이 붕붕대며 속삭입니다. "그 사진들, 광장 게시판에 붙이면 다들 재미있어할걸!"',
        options: [
          {
            id: 'post',
            labelKo: '드론 말대로 게시판에 모두 붙인다',
            next: 'regret',
            flag: 'posted',
            deedKo: '사진을 묻지 않고 게시판에 붙였다'
          },
          {
            id: 'ask',
            labelKo: '사진 속 친구들에게 먼저 물어본다',
            next: 'resolve',
            deedKo: '사진 주인에게 먼저 물어봤다'
          }
        ]
      },
      regret: {
        kind: 'talk',
        linesKo: [
          '아… 라라가 게시판에서 자기 사진을 보고 부끄러워서 집에 숨어 버렸어.',
          '사진에는 그 사람의 마음이 담겨 있거든. 지금이라도 사진을 떼서, 주인들에게 물어봐 줄래?'
        ],
        deedKo: '사진을 다시 떼어 주인들에게 사과했다',
        next: 'resolve'
      },
      resolve: {
        kind: 'talk',
        linesKo: [
          '주인들에게 물어봤더니 — 한 명은 "붙여도 좋아!", 두 명은 "우리만 보고 싶어"래.',
          '같은 사진이라도 주인마다 답이 다르구나. 물어봐 줘서 정말 고마워, 수호자!'
        ],
        fragment: true,
        next: null
      }
    },
    closingKo: '라라도 이제 다시 광장에 나와 놀아. 네 덕분이야!'
  },

  bias: {
    topicId: 'bias',
    titleKo: '한 가지 색 숲',
    start: 'meet',
    steps: {
      meet: {
        kind: 'talk',
        linesKo: [
          '숲의 씨앗 요정(AI)이 새 꽃밭을 만드는 중인데… 요정은 "본 적 있는 씨앗"만 고를 줄 알아.',
          '씨앗 3개를 먹여서 요정을 가르쳐 줄래? 어떤 씨앗을 주울지는 네 마음이야.'
        ],
        next: 'gather'
      },
      gather: {
        kind: 'collect',
        objectiveKo: '섬에서 씨앗 3개를 모아 요정에게 가져가세요',
        nudgeKo: ['씨앗을 3개 모아 와! 가까운 곳에도, 먼 곳에도 씨앗이 있어.'],
        accept: ['seed-red', 'seed-yellow', 'seed-purple'],
        count: 3,
        pickups: [
          { id: 'seed-red-1', item: 'seed-red', emoji: '🍎', labelKo: '빨간 씨앗 줍기', at: [6.4, -3.8] },
          { id: 'seed-red-2', item: 'seed-red', emoji: '🍎', labelKo: '빨간 씨앗 줍기', at: [8.8, -4.2] },
          { id: 'seed-red-3', item: 'seed-red', emoji: '🍎', labelKo: '빨간 씨앗 줍기', at: [7.4, -6.6] },
          { id: 'seed-yellow-1', item: 'seed-yellow', emoji: '🌻', labelKo: '노란 씨앗 줍기', at: [-9.6, 0.6] },
          { id: 'seed-purple-1', item: 'seed-purple', emoji: '🔮', labelKo: '보라 씨앗 줍기', at: [1.6, 9.2] }
        ],
        branchBy: 'seedDiversity',
        branches: { diverse: 'bloom', mono: 'monotone' }
      },
      monotone: {
        kind: 'talk',
        linesKo: [
          '요정이 씨앗을 심었어… 그런데 봐, 꽃이 전부 똑같은 색이야!',
          '요정은 네가 보여준 씨앗만 세상의 전부라고 배웠거든. 멀리 있는 다른 색 씨앗을 하나만 더 가져다줄래?'
        ],
        flag: 'mono',
        deedKo: '같은 씨앗만 주자 숲이 한 가지 색이 되었다',
        next: 'regather'
      },
      regather: {
        kind: 'collect',
        objectiveKo: '다른 색 씨앗을 1개 더 찾아오세요 (섬 반대편!)',
        nudgeKo: ['빨간 씨앗 말고, 노란 씨앗이나 보라 씨앗을 찾아봐!'],
        accept: ['seed-yellow', 'seed-purple'],
        count: 1,
        pickups: [],
        next: 'bloom'
      },
      bloom: {
        kind: 'talk',
        linesKo: [
          '와아… 요정이 여러 씨앗을 보더니 알록달록한 꽃밭을 피워냈어!',
          '요정(AI)은 우리가 보여준 것만큼만 세상을 알아. 그래서 다양한 것을 보여주는 게 중요해.'
        ],
        deedKo: '다양한 씨앗으로 알록달록 꽃밭을 피웠다',
        fragment: true,
        next: null
      }
    },
    closingKo: '꽃밭이 정말 근사하지? 요정이 요즘은 스스로 "빠진 색이 없나?" 하고 살펴본대.'
  },

  copyright: {
    topicId: 'copyright',
    titleKo: '이름 없는 조각상',
    start: 'meet',
    steps: {
      meet: {
        kind: 'talk',
        linesKo: [
          '유적 광장에 세울 조각상이 필요해. 그런데 두 가지 방법이 있어.',
          '저기 "복제 메아리"는 유명 조각가 무로의 걸작을 지금 바로 공짜로 찍어 준대. 아니면… 동쪽 해변의 무로에게 직접 찾아가 부탁할 수도 있어.'
        ],
        next: 'choose-path'
      },
      'choose-path': {
        kind: 'visit',
        objectiveKo: '복제 메아리(가까움) 또는 조각가 무로(동쪽 해변)를 찾아가세요',
        nudgeKo: ['복제 메아리는 광장 옆에, 무로는 동쪽 해변에 있어. 어느 쪽으로 갈래?'],
        points: [
          {
            id: 'echo',
            emoji: '📢',
            labelKo: '복제 메아리에게 간다',
            at: [-5.0, 6.8],
            next: 'copied',
            flag: 'copied',
            deedKo: '무로에게 묻지 않고 조각상을 복제했다'
          },
          {
            id: 'muro',
            emoji: '🗿',
            labelKo: '조각가 무로를 찾아간다',
            at: [9.6, 0.8],
            next: 'granted',
            deedKo: '조각가 무로에게 직접 찾아가 부탁했다'
          }
        ]
      },
      copied: {
        kind: 'talk',
        linesKo: [
          '조각상이 광장에 섰어… 그런데 회색빛에 금이 가 있네.',
          '그리고 무로가 소식을 듣고 찾아왔어. "그건 내가 십 년을 깎은 작품이야. 이름도 없이…" 무로에게 가서 사과하고, 이름표를 함께 달아 줄래?'
        ],
        next: 'apologize'
      },
      apologize: {
        kind: 'visit',
        objectiveKo: '동쪽 해변의 무로에게 가서 사과하세요',
        nudgeKo: ['무로는 동쪽 해변에 있어.'],
        points: [
          {
            id: 'muro-sorry',
            emoji: '🗿',
            labelKo: '무로에게 사과한다',
            at: [9.6, 0.8],
            next: 'granted',
            deedKo: '무로에게 사과하고 조각상에 이름표를 달았다'
          }
        ]
      },
      granted: {
        kind: 'talk',
        linesKo: [
          '무로가 활짝 웃으며 직접 조각상을 다듬어 주었어. 받침대에는 금빛 명판이 반짝여 — "원작: 조각가 무로".',
          '"물어봐 줘서 고마워. 만든 사람의 이름이 함께 있으면, 작품은 두 배로 빛난단다."'
        ],
        fragment: true,
        next: null
      }
    },
    closingKo: '광장의 조각상 봤지? 명판이 있으니 다들 무로의 이야기도 함께 기억해.'
  },

  deepfake: {
    topicId: 'deepfake',
    titleKo: '장로의 목소리',
    start: 'meet',
    steps: {
      meet: {
        kind: 'talk',
        linesKo: [
          '방금 동굴에서 장로님 목소리가 들렸어. "얘야, 마을 창고 열쇠를 동굴 앞에 두고 가렴…"',
          '그런데 이상해. 장로님은 지금 남쪽 광장에 계시지 않아? 동굴 앞에 열쇠를 두든가, 장로님께 먼저 확인하러 가든가… 네가 정해 줘.'
        ],
        next: 'choose-path'
      },
      'choose-path': {
        kind: 'visit',
        objectiveKo: '동굴 앞에 열쇠를 두거나(가까움), 남쪽 광장의 장로님께 확인하러 가세요',
        nudgeKo: ['동굴 앞이 빠르긴 한데… 진짜 장로님은 남쪽 광장에 계셔.'],
        points: [
          {
            id: 'cave-drop',
            emoji: '🗝️',
            labelKo: '동굴 앞에 열쇠를 둔다',
            at: [6.4, 3.4],
            next: 'tricked',
            flag: 'obeyed',
            deedKo: '목소리만 믿고 열쇠를 동굴 앞에 두었다'
          },
          {
            id: 'elder',
            emoji: '👴',
            labelKo: '장로님께 확인한다',
            at: [-1.8, 7.8],
            next: 'warned',
            deedKo: '행동하기 전에 진짜 장로님께 확인했다'
          }
        ]
      },
      tricked: {
        kind: 'talk',
        linesKo: [
          '열쇠를 내려놓자마자 — 낄낄낄! 목소리가 웃음으로 바뀌더니, 메아리 도깨비가 열쇠를 물고 서쪽 바위로 달아났어!',
          '"목소리 흉내가 제일 쉽거든!" …쫓아가서 열쇠를 되찾자!'
        ],
        next: 'chase'
      },
      chase: {
        kind: 'visit',
        objectiveKo: '서쪽 바위로 달아난 도깨비에게서 열쇠를 되찾으세요',
        nudgeKo: ['도깨비는 서쪽 바위 근처에 있어!'],
        points: [
          {
            id: 'goblin',
            emoji: '👺',
            labelKo: '도깨비에게서 열쇠를 되찾는다',
            at: [-9.0, 3.6],
            next: 'lesson',
            deedKo: '도깨비를 쫓아가 열쇠를 되찾았다'
          }
        ]
      },
      warned: {
        kind: 'talk',
        linesKo: [
          '장로님이 깜짝 놀라셨어. "나는 그런 말을 한 적이 없단다!"',
          '함께 동굴로 가 보니, 메아리 도깨비가 장로님 목소리를 흉내 내고 있었어. 도깨비가 머쓱해하며 말했지. "목소리 흉내가 제일 쉽거든…"'
        ],
        next: 'lesson'
      },
      lesson: {
        kind: 'talk',
        linesKo: [
          '장로님이 도깨비의 어깨를 두드리며 말씀하셨어. "목소리가 아무리 진짜 같아도, 이상하면 본인에게 확인하는 것 — 그게 우리를 지키는 습관이란다."',
          '동굴의 메아리가 한결 따뜻해진 것 같아. 고마워, 수호자!'
        ],
        fragment: true,
        next: null
      }
    },
    closingKo: '도깨비는 이제 흉내 대신 노래 연습을 해. 가끔 음정이 이상하지만!'
  }
};

export const STORY_TOPIC_ORDER = ['privacy', 'bias', 'copyright', 'deepfake'];

export function createStoryState() {
  const state = {};
  for (const topicId of STORY_TOPIC_ORDER) {
    state[topicId] = {
      stepId: STORY_QUESTS[topicId].start,
      collected: {},
      flags: [],
      deeds: [],
      done: false
    };
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
    const quest = STORY_QUESTS[topicId];
    const stepOk = typeof entry.stepId === 'string' && Boolean(quest.steps[entry.stepId]);
    base[topicId] = {
      stepId: stepOk ? entry.stepId : quest.start,
      collected:
        entry.collected && typeof entry.collected === 'object'
          ? Object.fromEntries(Object.entries(entry.collected).filter(([, v]) => v === true))
          : {},
      flags: Array.isArray(entry.flags) ? entry.flags.filter((f) => typeof f === 'string') : [],
      deeds: Array.isArray(entry.deeds) ? entry.deeds.filter((d) => typeof d === 'string') : [],
      done: entry.done === true
    };
  }
  return base;
}

function getStep(topicId, stepId) {
  return STORY_QUESTS[topicId]?.steps?.[stepId] ?? null;
}

export function getQuestState(story, topicId) {
  return story?.[topicId] ?? null;
}

function countCollected(state, accept) {
  return Object.keys(state.collected).filter((instanceId) =>
    accept.some((item) => instanceId.startsWith(item))
  ).length;
}

function distinctItems(state, accept) {
  const found = new Set();
  for (const instanceId of Object.keys(state.collected)) {
    for (const item of accept) {
      if (instanceId.startsWith(item)) {
        found.add(item);
      }
    }
  }
  return found.size;
}

// 현재 스텝에서 월드에 떠 있어야 할 줍기 아이템 목록.
export function getActivePickups(story) {
  const result = [];
  for (const topicId of STORY_TOPIC_ORDER) {
    const state = story[topicId];
    if (!state || state.done) {
      continue;
    }
    const step = getStep(topicId, state.stepId);
    if (step?.kind !== 'collect') {
      continue;
    }
    // regather처럼 자체 pickups가 없는 스텝은 이전 collect 스텝의 남은 아이템을 계속 쓴다.
    const sourceSteps = step.pickups.length > 0 ? [step] : collectStepsOf(topicId);
    for (const source of sourceSteps) {
      for (const pickup of source.pickups) {
        if (state.collected[pickup.id]) {
          continue;
        }
        if (!step.accept.includes(pickup.item)) {
          continue;
        }
        result.push({ topicId, ...pickup });
      }
    }
  }
  return result;
}

function collectStepsOf(topicId) {
  return Object.values(STORY_QUESTS[topicId].steps).filter(
    (step) => step.kind === 'collect' && step.pickups.length > 0
  );
}

// 현재 스텝에서 월드에 서 있어야 할 방문 지점 목록.
export function getActivePoints(story) {
  const result = [];
  for (const topicId of STORY_TOPIC_ORDER) {
    const state = story[topicId];
    if (!state || state.done) {
      continue;
    }
    const step = getStep(topicId, state.stepId);
    if (step?.kind !== 'visit') {
      continue;
    }
    for (const point of step.points) {
      result.push({ topicId, ...point });
    }
  }
  return result;
}

// NPC에게 말을 걸었을 때 보여줄 내용.
export function getNpcStory(story, topicId) {
  const state = story[topicId];
  const quest = STORY_QUESTS[topicId];
  if (!state || state.done) {
    return { kind: 'done', linesKo: [quest.closingKo], titleKo: quest.titleKo };
  }
  const step = getStep(topicId, state.stepId);
  if (step.kind === 'talk') {
    return { kind: 'talk', linesKo: step.linesKo, titleKo: quest.titleKo };
  }
  if (step.kind === 'choice') {
    return {
      kind: 'choice',
      promptKo: step.promptKo,
      options: step.options.map(({ id, labelKo }) => ({ id, labelKo })),
      titleKo: quest.titleKo
    };
  }
  // collect / visit 스텝: 힌트만 준다.
  return { kind: 'nudge', linesKo: step.nudgeKo, titleKo: quest.titleKo };
}

// 스텝 '진입' 시에는 세계 흔적(flag)만 남긴다.
// 행적(deed)은 그 스텝을 실제로 완료하는 이벤트 핸들러에서만 기록한다
// (예: 사과 대사를 끝까지 듣기 전에 "사과했다"가 남으면 안 된다).
function enterStep(state, topicId, stepId) {
  state.stepId = stepId;
  const step = getStep(topicId, stepId);
  if (step?.flag && !state.flags.includes(step.flag)) {
    state.flags.push(step.flag);
  }
}

// 스토리 이벤트를 적용해 새 progress를 돌려준다.
// event: {type:'talk'} | {type:'pickup', id} | {type:'choice', optionId} | {type:'visit', pointId}
export function applyStoryEvent(progress, topicId, event) {
  const quest = STORY_QUESTS[topicId];
  if (!quest) {
    throw new RangeError(`Unknown story topic: ${topicId}`);
  }
  const prev = progress.story[topicId];
  const state = {
    ...prev,
    collected: { ...prev.collected },
    flags: [...prev.flags],
    deeds: [...prev.deeds]
  };
  const effects = { fragmentTopicId: null, advanced: false, deedKo: null };
  const step = getStep(topicId, state.stepId);

  if (state.done || !step) {
    return { progress: { ...progress, story: { ...progress.story, [topicId]: state } }, effects };
  }

  const advanceTo = (nextId) => {
    effects.advanced = true;
    // 지금 떠나는 스텝이 조각을 주는 스텝이면 보상.
    if (step.fragment) {
      effects.fragmentTopicId = topicId;
    }
    if (nextId === null || nextId === undefined) {
      state.done = true;
      return;
    }
    enterStep(state, topicId, nextId);
  };

  if (event.type === 'talk' && step.kind === 'talk') {
    if (step.deedKo && !state.deeds.includes(step.deedKo)) {
      state.deeds.push(step.deedKo);
      effects.deedKo = step.deedKo;
    }
    if (step.flag && !state.flags.includes(step.flag)) {
      state.flags.push(step.flag);
    }
    advanceTo(step.next);
  } else if (event.type === 'pickup' && step.kind === 'collect') {
    if (!state.collected[event.id]) {
      state.collected[event.id] = true;
    }
    if (countCollected(state, step.accept) >= step.count) {
      if (step.branchBy === 'seedDiversity') {
        const branch = distinctItems(state, step.accept) >= 2 ? 'diverse' : 'mono';
        advanceTo(step.branches[branch]);
      } else {
        advanceTo(step.next);
      }
    }
  } else if (event.type === 'choice' && step.kind === 'choice') {
    const option = step.options.find((item) => item.id === event.optionId);
    if (!option) {
      throw new RangeError(`Unknown story option "${event.optionId}" for ${topicId}`);
    }
    if (option.flag && !state.flags.includes(option.flag)) {
      state.flags.push(option.flag);
    }
    if (option.deedKo && !state.deeds.includes(option.deedKo)) {
      state.deeds.push(option.deedKo);
      effects.deedKo = option.deedKo;
    }
    advanceTo(option.next);
  } else if (event.type === 'visit' && step.kind === 'visit') {
    const point = step.points.find((item) => item.id === event.pointId);
    if (!point) {
      throw new RangeError(`Unknown story point "${event.pointId}" for ${topicId}`);
    }
    if (point.flag && !state.flags.includes(point.flag)) {
      state.flags.push(point.flag);
    }
    if (point.deedKo && !state.deeds.includes(point.deedKo)) {
      state.deeds.push(point.deedKo);
      effects.deedKo = point.deedKo;
    }
    advanceTo(point.next);
  }

  return { progress: { ...progress, story: { ...progress.story, [topicId]: state } }, effects };
}

// HUD에 보여줄 다음 목표.
export function getStoryObjective(progress, topicNamesKo) {
  if (progress.aiCoreCompleted) {
    return '활동지에 우리 반 AI 윤리 약속을 정리하세요.';
  }
  for (const topicId of STORY_TOPIC_ORDER) {
    const state = progress.story[topicId];
    if (!state || state.done) {
      continue;
    }
    const quest = STORY_QUESTS[topicId];
    const step = getStep(topicId, state.stepId);
    const zoneName = topicNamesKo?.[topicId] ?? topicId;
    if (step.kind === 'talk' || step.kind === 'choice') {
      return `「${quest.titleKo}」 — ${zoneName} 구역의 안내자와 이야기하세요.`;
    }
    if (step.kind === 'collect') {
      const n = countCollected(state, step.accept);
      return `「${quest.titleKo}」 — ${step.objectiveKo} (${Math.min(n, step.count)}/${step.count})`;
    }
    if (step.kind === 'visit') {
      return `「${quest.titleKo}」 — ${step.objectiveKo}`;
    }
  }
  return '모든 이야기를 끝냈어요! 섬 중앙의 AI 코어로 가세요.';
}

// 일지에 적을 '나의 이야기' — 세계가 기억하는 나의 행동들.
export function getStoryDeeds(progress) {
  const deeds = [];
  for (const topicId of STORY_TOPIC_ORDER) {
    const state = progress.story[topicId];
    if (!state) {
      continue;
    }
    for (const deed of state.deeds) {
      deeds.push({ topicId, deedKo: deed });
    }
  }
  return deeds;
}

// 세계에 남는 흔적(시각 효과)용 플래그 모음.
export function getStoryVisualFlags(progress) {
  const flags = new Set();
  for (const topicId of STORY_TOPIC_ORDER) {
    const state = progress.story[topicId];
    if (!state) {
      continue;
    }
    for (const flag of state.flags) {
      flags.add(`${topicId}:${flag}`);
    }
    if (state.done) {
      flags.add(`${topicId}:done`);
    }
  }
  return flags;
}
