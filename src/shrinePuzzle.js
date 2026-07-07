// 사당 3D 조작 퍼즐 — 선택지 대신 '직접 조작해서 바로잡기'.
// 각 사당은 구역의 윤리 주제와 연결된다. 플레이어는 돌(오브젝트)에 다가가 A로 상태를 바꿔
// 목표 배치를 완성하면 사당을 통과하고 약속의 도구를 얻는다.
// 이 파일은 데이터 + 순수 로직만. 3D/입력은 main.js가 이 상태를 읽어 그린다.

// 각 퍼즐: objects(돌들, 각각 states 링을 A로 순환) + solved(states)가 참이면 통과.
export const SHRINE_PUZZLES = {
  privacy: {
    shrineId: 'privacy-shrine',
    titleKo: '동의의 자물쇠',
    goalKo: '친구 사진은 잠그고(🔒), 내 그림만 공개(🔓)하세요.',
    lessonKo: '동의 없이는 공유하지 않아요.',
    objects: [
      { id: 'p1', labelKo: '친구 사진', states: ['🔓', '🔒'], correct: 1, color: '#7cc6ff' },
      { id: 'p2', labelKo: '내 그림', states: ['🔓', '🔒'], correct: 0, color: '#8ef0b0' },
      { id: 'p3', labelKo: '친구 사진', states: ['🔓', '🔒'], correct: 1, color: '#7cc6ff' }
    ],
    // 각 돌이 정답 상태면 통과.
    solved: (states, objects) => objects.every((o, i) => states[i] === o.correct)
  },
  bias: {
    shrineId: 'bias-shrine',
    titleKo: '모두의 꽃밭',
    goalKo: '꽃 색이 모두 빨강이에요. 네 색이 서로 다르게 바꿔 다양성을 채우세요.',
    lessonKo: '데이터가 다양해야 편향이 줄어요.',
    objects: [
      { id: 'b1', labelKo: '꽃', states: ['🔴', '🔵', '🟡', '🟣'], correct: null, color: '#ff6b6b' },
      { id: 'b2', labelKo: '꽃', states: ['🔴', '🔵', '🟡', '🟣'], correct: null, color: '#ff6b6b' },
      { id: 'b3', labelKo: '꽃', states: ['🔴', '🔵', '🟡', '🟣'], correct: null, color: '#ff6b6b' },
      { id: 'b4', labelKo: '꽃', states: ['🔴', '🔵', '🟡', '🟣'], correct: null, color: '#ff6b6b' }
    ],
    // 모든 꽃 색이 서로 달라야 통과(관계형 목표).
    solved: (states) => new Set(states).size === states.length
  },
  copyright: {
    shrineId: 'copyright-shrine',
    titleKo: '이름표',
    goalKo: '작품마다 진짜 만든 이의 이름표를 맞춰 다세요.',
    lessonKo: '출처를 밝히면 진짜와 가짜가 갈려요.',
    objects: [
      { id: 'c1', labelKo: '별 그림', states: ['이름 없음', '무로', '가짜'], correct: 1, color: '#ffd76a' },
      { id: 'c2', labelKo: '파도 노래', states: ['이름 없음', '에코', '가짜'], correct: 1, color: '#7cc6ff' },
      { id: 'c3', labelKo: '숲 이야기', states: ['이름 없음', '모리', '가짜'], correct: 1, color: '#8ef0b0' }
    ],
    solved: (states, objects) => objects.every((o, i) => states[i] === o.correct)
  },
  deepfake: {
    shrineId: 'deepfake-shrine',
    titleKo: '진짜 목소리',
    goalKo: '흔들리는(가짜) 목소리는 🎭, 또렷한(진짜) 목소리는 🔊로 판정하세요.',
    lessonKo: '멈추고 확인하는 사람에게 진실이 보여요.',
    objects: [
      { id: 'd1', labelKo: '떨리는 목소리', states: ['🔊', '🎭'], correct: 1, color: '#c9a6ff' },
      { id: 'd2', labelKo: '또렷한 목소리', states: ['🔊', '🎭'], correct: 0, color: '#8ef0b0' },
      { id: 'd3', labelKo: '떨리는 목소리', states: ['🔊', '🎭'], correct: 1, color: '#c9a6ff' }
    ],
    solved: (states, objects) => objects.every((o, i) => states[i] === o.correct)
  }
};

export const PUZZLE_TOPIC_ORDER = ['privacy', 'bias', 'copyright', 'deepfake'];

export function getShrinePuzzle(topicId) {
  return SHRINE_PUZZLES[topicId] ?? null;
}

// 퍼즐 시작 상태(모든 돌 index 0). 이미 잘못된 배치에서 출발해 '바로잡게' 만든다.
export function createPuzzleState(topicId) {
  const puzzle = SHRINE_PUZZLES[topicId];
  if (!puzzle) {
    return [];
  }
  return puzzle.objects.map(() => 0);
}

// 한 돌의 상태를 다음으로 순환(A 입력).
export function cyclePuzzleObject(topicId, states, index) {
  const puzzle = SHRINE_PUZZLES[topicId];
  if (!puzzle || index < 0 || index >= puzzle.objects.length) {
    return states;
  }
  const next = states.slice();
  const ring = puzzle.objects[index].states.length;
  next[index] = (next[index] + 1) % ring;
  return next;
}

export function isPuzzleSolved(topicId, states) {
  const puzzle = SHRINE_PUZZLES[topicId];
  if (!puzzle) {
    return false;
  }
  return puzzle.solved(states, puzzle.objects);
}
