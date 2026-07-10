// 사당 던전 퍼즐 — 순수 로직(THREE 무의존, node 테스트 가능).
// 그리드 좌표는 [col, row]. col: 0..cols-1(서→동, +x), row: 0..rows-1(북→남, +z).
// 방은 원점 중심이라 카메라 중심 편향 로직을 그대로 재사용한다.
// 각 방은 mechanic으로 상호작용 방식을 고른다: 'push'(밀기)·'carry'(집어 옮기기)·'beam'(빛 반사).

export const DUNGEON_ROOMS = {
  privacy: {
    shrineId: 'privacy-shrine',
    topicId: 'privacy',
    mechanic: 'push',
    titleKo: '동의의 금고',
    goalKo: '친구 사진은 잠금 금고🔒로, 내 그림만 공개 게시판🔓으로 밀어 넣어요.',
    lessonKo: '남의 정보는 함부로 공개하지 않아요. 올릴 수 있는 건 내 것뿐이에요.',
    grid: { cols: 9, rows: 7, cell: 1.2 },
    crates: [
      { id: 'p1', kind: 'friend-photo', start: [3, 3], emoji: '🖼️', labelKo: '친구 사진' },
      { id: 'p2', kind: 'my-drawing', start: [5, 3], emoji: '🎨', labelKo: '내 그림' },
      { id: 'p3', kind: 'friend-photo', start: [4, 4], emoji: '📷', labelKo: '친구 사진' }
    ],
    zones: [
      { id: 'vault', accepts: 'friend-photo', cells: [[1, 1], [1, 2]], emoji: '🔒', labelKo: '잠금 금고' },
      { id: 'board', accepts: 'my-drawing', cells: [[7, 1]], emoji: '🔓', labelKo: '공개 게시판' }
    ],
    entry: [4, 6],
    pedestal: [4, 0]
  },

  // 편향: 같은 색만 심으면 안 된다. 씨앗 통(무한)에서 색을 골라 네 밭을 서로 다르게 채운다.
  bias: {
    shrineId: 'bias-shrine',
    topicId: 'bias',
    mechanic: 'carry',
    titleKo: '모두의 꽃밭',
    goalKo: '노이즈가 같은 색만 심어 뒀어요! 씨앗을 되집고 바꿔서 네 밭을 서로 다른 색으로 채우세요.',
    lessonKo: '데이터가 다양해야 편향이 줄어요. 같은 것만 모으면 모두의 꽃밭이 안 돼요.',
    grid: { cols: 9, rows: 7, cell: 1.2 },
    dispensers: [
      { id: 'red', colorIdx: 0, emoji: '🔴', labelKo: '빨강 씨앗', cell: [0, 1] },
      { id: 'blue', colorIdx: 1, emoji: '🔵', labelKo: '파랑 씨앗', cell: [0, 2] },
      { id: 'yellow', colorIdx: 2, emoji: '🟡', labelKo: '노랑 씨앗', cell: [0, 4] },
      { id: 'purple', colorIdx: 3, emoji: '🟣', labelKo: '보라 씨앗', cell: [0, 5] }
    ],
    beds: [
      { id: 'bed1', cell: [3, 3] },
      { id: 'bed2', cell: [4, 3] },
      { id: 'bed3', cell: [5, 3] },
      { id: 'bed4', cell: [6, 3] }
    ],
    // 노이즈가 미리 잘못 심어둔 시작 배치 — 빨강이 두 밭에 중복.
    // 빈 밭만 채우면 끝나지 않고, 중복을 되집어 고쳐야 한다(편향 교정 경험).
    preset: [0, 0, null, null],
    // 밭 색 팔레트(렌더 참고용, 논리와 무관).
    palette: ['🔴', '🔵', '🟡', '🟣'],
    entry: [4, 6],
    pedestal: [4, 0]
  },

  // 저작권: 작품마다 진짜 만든 이의 이름표를 달아야 한다. 가짜 이름표는 걸리지 않는다.
  copyright: {
    shrineId: 'copyright-shrine',
    topicId: 'copyright',
    mechanic: 'carry',
    titleKo: '이름의 전당',
    goalKo: '작품마다 진짜 만든 이의 이름표를 찾아 달아 주세요.',
    lessonKo: '만든 이를 밝혀 저작권을 존중해요. 가짜 이름표는 소용없어요.',
    grid: { cols: 9, rows: 7, cell: 1.2 },
    exhibits: [
      { id: 'star', emoji: '🎨', labelKo: '별 그림', correctPlateId: 'muro', cell: [2, 2] },
      { id: 'wave', emoji: '🌊', labelKo: '파도 노래', correctPlateId: 'echo', cell: [4, 2] },
      { id: 'forest', emoji: '🌲', labelKo: '숲 이야기', correctPlateId: 'mori', cell: [6, 2] }
    ],
    plates: [
      { id: 'muro', emoji: '🏷️', labelKo: '무로', fake: false, cell: [1, 4] },
      { id: 'echo', emoji: '🏷️', labelKo: '에코', fake: false, cell: [2, 4] },
      { id: 'mori', emoji: '🏷️', labelKo: '모리', fake: false, cell: [4, 4] },
      { id: 'anyone', emoji: '🏷️', labelKo: '아무나', fake: true, cell: [6, 4] },
      { id: 'myname', emoji: '🏷️', labelKo: '내 이름', fake: true, cell: [7, 4] }
    ],
    entry: [4, 6],
    pedestal: [4, 0]
  },

  // 딥페이크: 진실의 빛을 거울로 돌려 진짜 얼굴을 비춘다. 멈추고 살펴야 진짜가 보인다.
  deepfake: {
    shrineId: 'deepfake-shrine',
    topicId: 'deepfake',
    mechanic: 'beam',
    titleKo: '진실의 동굴',
    goalKo: '진실의 빛💡을 거울로 돌려 진짜 얼굴을 비추세요.',
    lessonKo: '멈추고 확인하는 사람에게 진실이 보여요. 매끈하고 흔들리는 건 가짜예요.',
    grid: { cols: 9, rows: 7, cell: 1.2 },
    source: { cell: [2, 5], dir: [0, -1], emoji: '💡', labelKo: '진실의 빛' },
    // orientation 0 = '/', 1 = '\\'. 거울 3장 — 정답은 두 번의 조작({m1:0,m2:1,m3:1}).
    // 8조합 전수: 초기(000)는 벽, m1을 돌리면(1xx) 매끈한 가짜, 010은 흔들리는 가짜, 011만 진짜.
    mirrors: [
      { id: 'm1', cell: [2, 1], states: 2, emoji: '🪞', labelKo: '거울' },
      { id: 'm2', cell: [5, 1], states: 2, emoji: '🪞', labelKo: '거울' },
      { id: 'm3', cell: [5, 4], states: 2, emoji: '🪞', labelKo: '거울' }
    ],
    orbs: [
      { id: 'o_real', cell: [7, 4], real: true, emoji: '😊', labelKo: '진짜 얼굴', hintKo: '또렷하고 자연스러워요.' },
      { id: 'o_fake1', cell: [3, 4], real: false, emoji: '🎭', labelKo: '가짜 얼굴', hintKo: '경계가 흔들려요.' },
      { id: 'o_fake2', cell: [1, 1], real: false, emoji: '👾', labelKo: '가짜 얼굴', hintKo: '너무 매끈해 어색해요.' }
    ],
    entry: [4, 6],
    pedestal: [4, 0]
  }
};

export function getDungeonRoom(topicId) {
  return DUNGEON_ROOMS[topicId] ?? null;
}

export function hasDungeonRoom(topicId) {
  return Boolean(DUNGEON_ROOMS[topicId]);
}

// 방 상태 초기화. mechanic 별로 모양이 다르다(모두 JSON 직렬화 가능).
// push  : { crates: { id: [c,r] } }        — 상자 위치.
// carry : { held, beds } 또는 { held, exhibits } — 손에 든 것 + 배치.
// beam  : { mirrors: { id: 0|1 } }         — 거울 방향.
export function createRoomState(topicId) {
  const room = DUNGEON_ROOMS[topicId];
  if (!room) {
    return null;
  }
  switch (room.mechanic) {
    case 'push': {
      const crates = {};
      for (const crate of room.crates) {
        crates[crate.id] = [crate.start[0], crate.start[1]];
      }
      return { crates };
    }
    case 'carry': {
      if (room.beds) {
        // preset이 있으면 노이즈가 미리 심어둔 배치로 시작(중복을 되집어 고쳐야 함).
        return { held: null, beds: room.preset ? room.preset.slice() : room.beds.map(() => null) };
      }
      if (room.exhibits) {
        const exhibits = {};
        for (const ex of room.exhibits) {
          exhibits[ex.id] = null;
        }
        return { held: null, exhibits };
      }
      return { held: null };
    }
    case 'beam': {
      const mirrors = {};
      for (const m of room.mirrors) {
        mirrors[m.id] = 0;
      }
      return { mirrors };
    }
    default:
      return null;
  }
}

function inBounds(room, c, r) {
  return c >= 0 && c < room.grid.cols && r >= 0 && r < room.grid.rows;
}

// ─────────────────────────────────────────────────────────────
// push(privacy) — 상자 밀기.
// ─────────────────────────────────────────────────────────────

function zoneAt(room, c, r) {
  for (const zone of room.zones) {
    if (zone.cells.some(([zc, zr]) => zc === c && zr === r)) {
      return zone;
    }
  }
  return null;
}

function crateAt(room, state, c, r, exceptId) {
  for (const crate of room.crates) {
    if (crate.id === exceptId) {
      continue;
    }
    const [cc, cr] = state.crates[crate.id];
    if (cc === c && cr === r) {
      return crate.id;
    }
  }
  return null;
}

function crateKind(room, crateId) {
  return room.crates.find((c) => c.id === crateId)?.kind ?? null;
}

// 시선 방향 직선에서 처음 만나는 상자(나침반 '끌어당기기' 대상 탐색).
// fromCell에서 dir로 한 칸씩 나아가며 maxRange 안의 첫 상자 id를 돌려준다. 없으면 null.
export function firstCrateInLine(topicId, state, fromCell, dir, maxRange = 5) {
  const room = DUNGEON_ROOMS[topicId];
  if (!room || room.mechanic !== 'push') {
    return null;
  }
  let [c, r] = fromCell;
  for (let step = 0; step < maxRange; step += 1) {
    c += dir[0];
    r += dir[1];
    if (!inBounds(room, c, r)) {
      return null;
    }
    const hit = crateAt(room, state, c, r, null);
    if (hit) {
      return hit;
    }
  }
  return null;
}

// 상자를 dir([dCol,dRow]) 방향으로 한 칸 민다.
// 반환: { state, moved, event }. event: null | 'blocked' | 'wrong-zone' | 'placed'.
export function pushCrate(topicId, state, crateId, dir) {
  const room = DUNGEON_ROOMS[topicId];
  const cur = state.crates[crateId];
  if (!room || !cur) {
    return { state, moved: false, event: null };
  }
  const [c, r] = cur;
  const nc = c + dir[0];
  const nr = r + dir[1];
  // 벽/경계 충돌.
  if (!inBounds(room, nc, nr)) {
    return { state, moved: false, event: 'blocked' };
  }
  // 다른 상자 충돌.
  if (crateAt(room, state, nc, nr, crateId)) {
    return { state, moved: false, event: 'blocked' };
  }
  // 존 진입: 맞는 종류만 허용, 아니면 거부(밀리지 않음).
  const zone = zoneAt(room, nc, nr);
  if (zone && zone.accepts !== crateKind(room, crateId)) {
    return { state, moved: false, event: 'wrong-zone' };
  }
  const nextCrates = { ...state.crates, [crateId]: [nc, nr] };
  const nextState = { ...state, crates: nextCrates };
  return { state: nextState, moved: true, event: zone ? 'placed' : null };
}

// ─────────────────────────────────────────────────────────────
// carry(bias/copyright) — 집어서 옮기기. 공통 진입점 pickOrPlace.
// ─────────────────────────────────────────────────────────────

// A 입력: 대상 targetId(씨앗 통/밭 또는 이름표/작품)에 집거나 놓는다.
// 반환: { state, event }. 순수 함수(state 불변).
export function pickOrPlace(topicId, state, targetId) {
  const room = DUNGEON_ROOMS[topicId];
  if (!room || room.mechanic !== 'carry') {
    return { state, event: null };
  }
  if (room.beds) {
    return pickOrPlaceBeds(room, state, targetId);
  }
  if (room.exhibits) {
    return pickOrPlacePlates(room, state, targetId);
  }
  return { state, event: null };
}

// bias: 씨앗 통(무한) → 손에 색. 밭에 놓기(중복이면 거부). 채운 밭 되집기.
// event: 'picked' | 'placed' | 'duplicate' | null.
function pickOrPlaceBeds(room, state, targetId) {
  const dispenser = room.dispensers.find((d) => d.id === targetId);
  if (dispenser) {
    // 통에서 색을 집는다(들고 있어도 새 색으로 교체).
    return { state: { ...state, held: dispenser.colorIdx }, event: 'picked' };
  }
  const bedIdx = room.beds.findIndex((b) => b.id === targetId);
  if (bedIdx === -1) {
    return { state, event: null };
  }
  const current = state.beds[bedIdx];
  if (current === null) {
    // 빈 밭에 심기.
    if (state.held === null) {
      return { state, event: null };
    }
    // 편향 방지: 같은 색이 다른 밭에 이미 있으면 거부.
    if (state.beds.some((b, i) => i !== bedIdx && b === state.held)) {
      return { state, event: 'duplicate' };
    }
    const beds = state.beds.slice();
    beds[bedIdx] = state.held;
    return { state: { ...state, beds, held: null }, event: 'placed' };
  }
  // 채워진 밭: 손이 비었으면 되집고, 아니면 거부.
  if (state.held === null) {
    const beds = state.beds.slice();
    beds[bedIdx] = null;
    return { state: { ...state, beds, held: current }, event: 'picked' };
  }
  return { state, event: null };
}

// copyright: 선반의 이름표를 집어 작품에 단다. 진짜 만든 이만 걸리고, 가짜/틀린 주인은 거부.
// event: 'picked' | 'placed' | 'placed-back' | 'fake' | 'wrong-owner' | null.
function pickOrPlacePlates(room, state, targetId) {
  const plate = room.plates.find((p) => p.id === targetId);
  if (plate) {
    // 들고 있던 그 이름표를 다시 제 선반에 내려놓기.
    if (state.held === plate.id) {
      return { state: { ...state, held: null }, event: 'placed-back' };
    }
    // 이미 어떤 작품에 걸린 이름표는 선반에 없다.
    if (Object.values(state.exhibits).includes(plate.id)) {
      return { state, event: null };
    }
    // 선반에서 집기(들고 있어도 교체 = 이전 것은 자동으로 선반에 남음).
    return { state: { ...state, held: plate.id }, event: 'picked' };
  }
  const exhibit = room.exhibits.find((e) => e.id === targetId);
  if (!exhibit) {
    return { state, event: null };
  }
  // 이미 이름표가 걸려 잠긴 작품 — 아무 일도 없음.
  if (state.exhibits[exhibit.id] !== null) {
    return { state, event: null };
  }
  if (state.held === null) {
    return { state, event: null };
  }
  const heldPlate = room.plates.find((p) => p.id === state.held);
  if (!heldPlate) {
    return { state, event: null };
  }
  if (heldPlate.fake) {
    return { state, event: 'fake' };
  }
  if (heldPlate.id === exhibit.correctPlateId) {
    return {
      state: { ...state, exhibits: { ...state.exhibits, [exhibit.id]: heldPlate.id }, held: null },
      event: 'placed'
    };
  }
  return { state, event: 'wrong-owner' };
}

// ─────────────────────────────────────────────────────────────
// beam(deepfake) — 거울로 진실의 빛을 반사시켜 진짜 얼굴 맞히기.
// ─────────────────────────────────────────────────────────────

// 거울을 한 번 돌린다(0 '/' ↔ 1 '\\'). 반환: { state, event: 'rotated' | null }.
export function rotateMirror(topicId, state, mirrorId) {
  const room = DUNGEON_ROOMS[topicId];
  if (!room || room.mechanic !== 'beam' || !(mirrorId in state.mirrors)) {
    return { state, event: null };
  }
  const mirrors = { ...state.mirrors, [mirrorId]: state.mirrors[mirrorId] === 0 ? 1 : 0 };
  return { state: { ...state, mirrors }, event: 'rotated' };
}

// 빛의 진행 방향을 거울 방향에 맞춰 튼다.
// '/'(0): [dx,dy] → [-dy,-dx] (N↔E, S↔W).  '\\'(1): [dx,dy] → [dy,dx] (N↔W, S↔E).
function reflect(dir, orientation) {
  const [dx, dy] = dir;
  return orientation === 0 ? [-dy, -dx] : [dy, dx];
}

// 광원에서 한 칸씩 빛을 따라간다. 거울이면 방향을 틀고, 구슬이면 멈추고, 벽 밖이면 벽.
// 반환: { cells: [[c,r],...], hit: null | {kind:'wall'} | {kind:'orb',orbId,real} }.
// 루프 방지 최대 200스텝.
export function computeBeamPath(topicId, state) {
  const room = DUNGEON_ROOMS[topicId];
  if (!room || room.mechanic !== 'beam') {
    return { cells: [], hit: null };
  }
  const mirrorAt = (c, r) => room.mirrors.find((m) => m.cell[0] === c && m.cell[1] === r) ?? null;
  const orbAt = (c, r) => room.orbs.find((o) => o.cell[0] === c && o.cell[1] === r) ?? null;

  let [c, r] = room.source.cell;
  let dir = [room.source.dir[0], room.source.dir[1]];
  const cells = [[c, r]];

  for (let step = 0; step < 200; step += 1) {
    const nc = c + dir[0];
    const nr = r + dir[1];
    if (!inBounds(room, nc, nr)) {
      return { cells, hit: { kind: 'wall' } };
    }
    c = nc;
    r = nr;
    cells.push([c, r]);
    const orb = orbAt(c, r);
    if (orb) {
      return { cells, hit: { kind: 'orb', orbId: orb.id, real: orb.real } };
    }
    const mirror = mirrorAt(c, r);
    if (mirror) {
      dir = reflect(dir, state.mirrors[mirror.id]);
    }
  }
  return { cells, hit: null };
}

// ─────────────────────────────────────────────────────────────
// 공통 판정 — mechanic 별로 분기.
// ─────────────────────────────────────────────────────────────

// 방이 풀렸는가.
export function isRoomSolved(topicId, state) {
  const room = DUNGEON_ROOMS[topicId];
  switch (room.mechanic) {
    case 'push':
      // 모든 상자가 자기 종류를 받는 존 칸 위에 있으면 해결.
      return room.crates.every((crate) => {
        const [c, r] = state.crates[crate.id];
        const zone = zoneAt(room, c, r);
        return zone !== null && zone.accepts === crate.kind;
      });
    case 'carry':
      if (room.beds) {
        // 프리셋 중복이 남아 있을 수 있으므로 '다 찼다'만으로는 부족 — 서로 달라야 해결.
        const filled = state.beds.filter((b) => b !== null);
        return filled.length === state.beds.length && new Set(filled).size === filled.length;
      }
      if (room.exhibits) {
        // 진짜 이름표만 걸리므로 다 채워지면 곧 정답.
        return room.exhibits.every((ex) => state.exhibits[ex.id] !== null);
      }
      return false;
    case 'beam': {
      const { hit } = computeBeamPath(topicId, state);
      return Boolean(hit && hit.kind === 'orb' && hit.real === true);
    }
    default:
      return false;
  }
}

// 남은 과제 수(스포일러 없는 힌트용). 0이면 해결.
export function countRemaining(topicId, state) {
  const room = DUNGEON_ROOMS[topicId];
  switch (room.mechanic) {
    case 'push':
      return room.crates.reduce((sum, crate) => {
        const [c, r] = state.crates[crate.id];
        const zone = zoneAt(room, c, r);
        return sum + (zone && zone.accepts === crate.kind ? 0 : 1);
      }, 0);
    case 'carry':
      if (room.beds) {
        // 빈 밭 수 + 중복으로 바꿔야 할 밭 수.
        const filled = state.beds.filter((b) => b !== null);
        const empties = state.beds.length - filled.length;
        const duplicates = filled.length - new Set(filled).size;
        return empties + duplicates;
      }
      if (room.exhibits) {
        return room.exhibits.filter((ex) => state.exhibits[ex.id] === null).length;
      }
      return 0;
    case 'beam':
      return isRoomSolved(topicId, state) ? 0 : 1;
    default:
      return 0;
  }
}

// 그리드 칸 → 월드 xz(원점 중심 평면).
export function cellToWorld(topicId, cell) {
  const { cols, rows, cell: size } = DUNGEON_ROOMS[topicId].grid;
  const [c, r] = cell;
  return {
    x: (c - (cols - 1) / 2) * size,
    z: (r - (rows - 1) / 2) * size
  };
}

// 월드 xz → 가장 가까운 그리드 칸(플레이어 위치 판정용).
export function worldToCell(topicId, x, z) {
  const { cols, rows, cell: size } = DUNGEON_ROOMS[topicId].grid;
  const c = Math.round(x / size + (cols - 1) / 2);
  const r = Math.round(z / size + (rows - 1) / 2);
  return [
    Math.max(0, Math.min(cols - 1, c)),
    Math.max(0, Math.min(rows - 1, r))
  ];
}

// 방의 이동 가능 AABB(플레이어 클램프용). 벽 안쪽 반 칸 여유.
export function roomBounds(topicId) {
  const { cols, rows, cell: size } = DUNGEON_ROOMS[topicId].grid;
  const halfW = ((cols - 1) / 2) * size + size * 0.5;
  const halfH = ((rows - 1) / 2) * size + size * 0.5;
  return { minX: -halfW, maxX: halfW, minZ: -halfH, maxZ: halfH };
}
