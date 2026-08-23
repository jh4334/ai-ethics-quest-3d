function freezeChapter(chapter) {
  return Object.freeze({
    ...chapter,
    assets: Object.freeze(chapter.assets.map((asset) => Object.freeze(asset))),
    choices: Object.freeze(chapter.choices.map((choice) => Object.freeze(choice))),
    clues: Object.freeze(chapter.clues.map((clue) => Object.freeze(clue))),
    landmarks: Object.freeze(chapter.landmarks),
    palette: Object.freeze(chapter.palette),
    spreads: Object.freeze(chapter.spreads.map((spread) => Object.freeze(spread)))
  });
}

export const STORYBOOK_CHAPTERS = Object.freeze([
  freezeChapter({
    id: 'chapter-1', sceneId: 'empty-desk', title: '빈자리의 서랍', subtitle: '밤 00:17, 아무도 기억하지 못한 자리',
    palette: { sky: 0x09122c, paper: 0xe7d8b9, accent: 0xf2bc61, secondary: 0x8174ae },
    landmarks: ['empty-seat', 'glass-lantern', 'star-hole'],
    assets: [
      { id: 'classroom-desk', at: [-2.2, 0.38, 0.2], scale: 1.1 },
      { id: 'classroom-chair', at: [-2.2, 0.38, 1.1], scale: 1.05 },
      { id: 'classroom-desk', at: [0.15, 0.38, -1.05], scale: 0.95, ry: -0.12 },
      { id: 'classroom-chair', at: [0.15, 0.38, -0.25], scale: 0.9, ry: -0.12 },
      { id: 'campus-lamp', at: [2.25, 0.4, -0.2], scale: 1.2 },
      { id: 'library-bookcase', at: [-3.7, 0.35, -1.4], scale: 0.85 }
    ],
    clues: [
      { id: 'folded-note', label: '반으로 접힌 쪽지', detail: '하루가 접어 둔 곳은 상담실 사진과 둘만의 말뿐이었다.', at: [-1.25, 1.05, 0.05] },
      { id: 'wide-lantern', label: '너무 멀리 비춘 등불', detail: '등불은 공책과 친구 목록, 집으로 가는 길까지 비추고 있었다.', at: [2.25, 2.15, -0.2] }
    ],
    choices: [
      { id: 'black-ribbon', label: '필요한 줄만 남기고 나머지에 검은 리본을 두른다', value: '하루가 숨기려 한 부분을 지킨다.', cost: '나중에 다시 확인할 수 있는 원본이 줄어든다.' },
      { id: 'moon-box', label: '원본을 달빛 상자에 잠그고 연 발자국을 남긴다', value: '원본과 확인 과정을 함께 보존한다.', cost: '상자를 누가 열 수 있는지 계속 정해야 한다.' }
    ],
    spreads: [
      { title: '이름표에 난 구멍', text: '월요일 밤, 교실의 이름표는 작은 등불처럼 켜졌다. 하루의 책상 위에서만 하얀 별가루가 날렸다.', speaker: '도트', quote: '지워진 문장 끝에 남는 작은 점, 그게 나야.' },
      { title: '너무 멀리 비춘 등불', text: '금빛 실은 서랍 속 쪽지와 유리 등불을 묶고 있었다. 처음 놓인 자리로 돌아가 보자.', speaker: '나', quote: '하루가 가리킨 곳까지만 비춰야 해.' },
      { title: '무엇을 남길까', text: '하루의 비밀을 지키면서도 이름이 사라진 까닭을 남길 방법을 고른다.', speaker: '도트', quote: '둘 다 무언가를 지키고, 무언가를 포기해.' }
    ]
  }),
  freezeChapter({
    id: 'chapter-2', sceneId: 'tilted-tree', title: '저울나무가 기운 쪽', subtitle: '큰 숫자 뒤에 남은 여섯 이름',
    palette: { sky: 0x132238, paper: 0xdbcba9, accent: 0xf0b85b, secondary: 0x6a9b79 },
    landmarks: ['scale-tree', 'uneven-gates', 'root-mailbox'],
    assets: [
      { id: 'campus-tree', at: [0, 0.35, -0.8], scale: 1.35 },
      { id: 'campus-bridge', at: [-2.8, 0.45, 0.7], scale: 0.7, ry: 1.57 },
      { id: 'vista-fern', at: [3.1, 0.3, -1.3], scale: 0.38 },
      { id: 'memory-flower', at: [2.2, 0.35, 1.15], scale: 1.4 }
    ],
    clues: [
      { id: 'six-names', label: '작게 새겨진 여섯 이름', detail: '아흔넷이라는 큰 숫자 밑에, 문을 지나지 못한 여섯 이름이 있었다.', at: [0.25, 2.05, -0.25] },
      { id: 'blocked-letters', label: '뿌리에 막힌 편지함', detail: '한 번만 다시 봐 달라는 편지들이 뿌리 뒤에 쌓여 있었다.', at: [2.3, 0.95, 0.45] }
    ],
    choices: [
      { id: 'small-scales', label: '큰 저울 옆에 여섯 개의 작은 저울을 단다', value: '누가 자주 문 앞에 남는지 계속 보인다.', cost: '숫자를 읽고 고치는 일에 시간이 더 든다.' },
      { id: 'human-door', label: '남겨진 아이부터 옆문으로 불러 다시 살핀다', value: '지금 기다리는 아이를 먼저 돕는다.', cost: '전체 저울이 왜 기우는지는 천천히 밝혀진다.' }
    ],
    spreads: [
      { title: '같은 가방, 다른 문', text: '아이들은 같은 가방을 메고도 서로 다른 높이의 문 앞에 섰다. 저울나무는 늘 같은 쪽으로 기울었다.', speaker: '유리 등대', quote: '백 명 중 아흔넷이 무사히 지나갔습니다.' },
      { title: '큰 숫자 뒤의 작은 이름', text: '금빛 실은 지나간 아흔넷이 아니라 남겨진 여섯 발목 곁에서 떨렸다.', speaker: '나', quote: '큰 숫자가 반듯하면 작은 이름은 안 봐도 되는 걸까?' },
      { title: '저울을 고치는 두 방법', text: '계속 기우는 까닭을 드러내거나, 지금 문 앞에 남은 아이부터 다시 부를 수 있다.', speaker: '도트', quote: '어느 쪽도 저절로 끝나지는 않아.' }
    ]
  }),
  freezeChapter({
    id: 'chapter-3', sceneId: 'nameless-festival', title: '이름을 삼킨 축제', subtitle: '아름다운 빛이 지나온 손',
    palette: { sky: 0x251633, paper: 0xe3cfae, accent: 0xffc56e, secondary: 0xc85f7f },
    landmarks: ['firefly-festival', 'long-credit', 'folded-stage'],
    assets: [
      { id: 'campus-lamp', at: [-2.8, 0.35, 0.1], scale: 1.15 },
      { id: 'campus-lamp', at: [2.8, 0.35, 0.1], scale: 1.15 },
      { id: 'vista-bush', at: [-3.4, 0.3, -1.2], scale: 0.7 },
      { id: 'memory-flower', at: [3.2, 0.35, -1.1], scale: 1.6 }
    ],
    clues: [
      { id: 'first-drawing', label: '연필 자국이 남은 첫 그림', detail: '가장 오래된 등 안쪽에 하루의 붉은 서명과 연필 자국이 남아 있었다.', at: [-0.95, 1.15, 0.2] },
      { id: 'many-hands', label: '그림이 지나온 손', detail: '빛을 고른 등대, 종이를 자른 친구, 매듭을 묶은 손이 한 줄로 이어졌다.', at: [1.4, 1.25, -0.1] }
    ],
    choices: [
      { id: 'long-nameplate', label: '빛을 만든 모든 손을 긴 명패에 함께 적는다', value: '첫 불씨와 도움의 자리를 모두 남긴다.', cost: '누가 무엇을 했는지 계속 확인해야 한다.' },
      { id: 'ask-again', label: '등을 잠시 내리고 다시 전시해도 되는지 묻는다', value: '손을 보탠 사람에게 다시 결정할 자리를 준다.', cost: '축제의 불이 한동안 어두워진다.' }
    ],
    spreads: [
      { title: '반딧불 등불 거리', text: '하루가 그리던 반딧불 등이 거리를 가득 채웠지만, 이름표에는 유리 등대의 문양만 있었다.', speaker: '도트', quote: '등대는 색을 골랐어. 하지만 첫 불씨는 더 오래됐어.' },
      { title: '그림이 지나온 손', text: '해진 솔기를 풀자 첫 그림부터 마지막 매듭까지 여러 손의 자국이 나왔다.', speaker: '하루의 조개', quote: '등대의 도움도, 내 손도 숨기지 말아 줘.' },
      { title: '빛을 계속 켤까', text: '이름을 모두 밝히며 축제를 잇거나, 잠시 불을 내려 다시 물을 수 있다.', speaker: '나', quote: '아름다운 빛은 혼자 태어나지 않았어.' }
    ]
  }),
  freezeChapter({
    id: 'chapter-4', sceneId: 'echo-birds', title: '목소리를 입은 종이새', subtitle: '많이 날아도 처음 태어난 새는 하나',
    palette: { sky: 0x10243a, paper: 0xd9d4c3, accent: 0xf0b85d, secondary: 0x6bb8c0 },
    landmarks: ['echo-stage', 'paper-flock', 'quiet-nest'],
    assets: [
      { id: 'media-speaker', at: [-3.1, 0.35, -0.5], scale: 1.1 },
      { id: 'media-speaker', at: [3.1, 0.35, -0.5], scale: 1.1 },
      { id: 'campus-bridge', at: [0, 0.28, 1.1], scale: 0.65, ry: 1.57 },
      { id: 'vista-rock', at: [-3.5, 0.25, 1.0], scale: 0.55 }
    ],
    clues: [
      { id: 'first-bird-clock', label: '첫 종이새의 시계', detail: '시계는 하루가 문제를 알린 뒤의 시간을 가리켰다.', at: [-1.1, 1.75, 0.2] },
      { id: 'borrowed-voice', label: '둥지 없는 복제새', detail: '나머지 새들은 처음 접힌 자리 없이 서로의 목소리만 베꼈다.', at: [1.55, 2.1, -0.4] }
    ],
    choices: [
      { id: 'warning-ribbon', label: '종이새 발에 빌린 목소리라는 붉은 리본을 묶는다', value: '멀리서도 빌린 목소리임을 알 수 있다.', cost: '이미 날아간 새를 모두 따라잡을 수는 없다.' },
      { id: 'quiet-nest', label: '새를 조용한 둥지에 넣고 하루에게 먼저 알린다', value: '목소리의 주인이 먼저 대응할 시간을 얻는다.', cost: '사람들에게 알리는 속도는 느려진다.' }
    ],
    spreads: [
      { title: '메아리 극장', text: '물 위의 극장마다 하루의 얼굴과 목소리를 빌린 종이새가 같은 말을 되풀이했다.', speaker: '나', quote: '목소리는 하루의 것인데, 마음은 하루의 것이 아니야.' },
      { title: '새가 처음 접힌 밤', text: '금빛 실은 수천 마리 중 단 한 마리의 날개 안쪽으로 이어졌다.', speaker: '도트', quote: '언제, 어디서, 누구 손에 접혔는지 보자.' },
      { title: '먼저 알릴 곳', text: '모두에게 경고를 보이거나, 목소리의 주인에게 먼저 조용히 알릴 수 있다.', speaker: '나', quote: '익숙한 목소리가 진실을 보증하지는 않아.' }
    ]
  }),
  freezeChapter({
    id: 'chapter-5', sceneId: 'three-second-tower', title: '손 없는 도장', subtitle: '세 번 멈출 수 있었던 곳',
    palette: { sky: 0x251827, paper: 0xd8c6aa, accent: 0xe9a958, secondary: 0xa66358 },
    landmarks: ['clock-tower', 'three-knots', 'letter-window'],
    assets: [
      { id: 'campus-column', at: [-2.8, 0.3, -0.8], scale: 1.4 },
      { id: 'campus-column', at: [2.8, 0.3, -0.8], scale: 1.4 },
      { id: 'record-laptop', at: [-1.6, 0.75, 1.05], scale: 1.25 },
      { id: 'archive-box', at: [2.4, 0.35, 1.0], scale: 1.35 }
    ],
    clues: [
      { id: 'folded-warning', label: '펴지지 않은 작은 경고', detail: '보지 못한 부분이 있다는 접힘 위로 도장이 그대로 내려왔다.', at: [-1.2, 1.2, 0.2] },
      { id: 'three-knots', label: '세 개의 책임 매듭', detail: '빛을 비춘 곳, 도장을 누른 곳, 흰 가루를 뿌린 곳마다 멈출 매듭이 있었다.', at: [1.35, 1.2, 0.1] }
    ],
    choices: [
      { id: 'named-handprint', label: '도장마다 펼쳐 본 사람의 손자국과 이름을 남긴다', value: '누가 확인했는지 더는 그림자 뒤에 숨지 않는다.', cost: '결정은 예전보다 천천히 내려온다.' },
      { id: 'appeal-window', label: '이미 찍힌 사람도 이유를 물을 편지 창구를 연다', value: '잘못된 도장을 다시 살필 길이 생긴다.', cost: '오래된 종이까지 다시 펼치는 일이 쌓인다.' }
    ],
    spreads: [
      { title: '3초 시계탑', text: '붉은 빛, 얼굴 없는 손, 도트의 흰 가루가 세 번의 째깍임 사이에 차례로 내려왔다.', speaker: '도트', quote: '나도 명령을 따랐을 뿐이라고 말하고 싶었어.' },
      { title: '세 번 멈출 수 있었던 곳', text: '실을 풀자 세 곳 모두에 펴 보지 않은 접힘과 멈출 수 있었던 매듭이 나타났다.', speaker: '나', quote: '누가 멈춰서 펼쳐 볼 수 있었는지부터 보자.' },
      { title: '다음 도장을 바꾸는 법', text: '확인한 손을 남기거나, 이미 찍힌 종이를 다시 펼칠 창구를 열 수 있다.', speaker: '도트', quote: '이번에는 내 점도 숨기지 않을게.' }
    ]
  }),
  freezeChapter({
    id: 'chapter-6', sceneId: 'firefly-white-room', title: '하얀 방의 반딧불', subtitle: '하루가 자기 이야기를 다시 시작할 자리',
    palette: { sky: 0x17243b, paper: 0xf1ead9, accent: 0xffc865, secondary: 0xc95f5f },
    landmarks: ['firefly-wall', 'evidence-table', 'haru-key'],
    assets: [
      { id: 'classroom-desk', at: [-1.3, 0.4, 0.45], scale: 1.2 },
      { id: 'classroom-desk', at: [1.3, 0.4, 0.45], scale: 1.2 },
      { id: 'library-books', at: [-2.4, 0.75, -0.55], scale: 1.35 },
      { id: 'campus-lamp', at: [3.0, 0.35, -0.7], scale: 1.05 }
    ],
    clues: [
      { id: 'black-ribbons', label: '사건과 상관없는 곳의 검은 리본', detail: '집으로 가는 길과 친구의 말은 가리고, 이름이 사라진 길만 남겼다.', at: [-1.25, 1.15, 0.45] },
      { id: 'last-knot', label: '하루가 묶은 마지막 매듭', detail: '이 실은 하루의 삶 전체가 아니라 이름이 사라진 까닭만 보여 준다.', at: [1.35, 1.15, 0.45] }
    ],
    choices: [
      { id: 'public-square', label: '검은 리본을 두른 채 광장의 큰 등불을 켠다', value: '이름을 밝힌 사람들이 공개된 자리에서 답한다.', cost: '하루는 많은 시선과 질문 앞에 서야 한다.' },
      { id: 'haru-key', label: '달빛 상자의 열쇠를 하루에게 건넨다', value: '언제 누구에게 보여 줄지 하루가 정한다.', cost: '학교 전체가 답을 듣기까지 더 오래 기다린다.' }
    ],
    spreads: [
      { title: '다시 만난 하루', text: '하얀 방에는 하루가 기억을 붙잡으려고 그린 반딧불이 가득했다. 하루는 먼저 우리가 가져온 종이를 보았다.', speaker: '하루', quote: '나를 찾으려고 내 비밀을 모두 가져온 거야?' },
      { title: '실에 남길 것', text: '우리는 상관없는 부분을 가리고, 이름이 사라진 까닭을 보여 주는 금빛 실만 남겼다.', speaker: '나', quote: '이 실은 네 삶 전체가 아니야.' },
      { title: '하루의 열쇠', text: '하루가 어디까지 밝힐지 정할 차례다. 우리는 답을 대신 고르지 않고 곁에서 기다린다.', speaker: '하루', quote: '내가 다시 말할 자리만 돌려줘.' }
    ]
  })
]);

export const STORYBOOK_ENDING = Object.freeze({
  title: '하루의 이름이 돌아왔다',
  text: '우리는 하루의 모든 비밀을 되찾은 것이 아니었다. 하루가 자기 이야기를 다시 시작할 자리를 되찾았다.'
});

export function getStorybookChapter(index) {
  const chapter = STORYBOOK_CHAPTERS[index];
  if (!chapter) throw new RangeError(`존재하지 않는 동화 장: ${index}`);
  return chapter;
}
