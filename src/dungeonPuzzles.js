// 사당 던전 퍼즐 — 순수 로직(THREE 무의존, node 테스트 가능).
// 그리드 좌표는 [col, row]. col: 0..cols-1(서→동, +x), row: 0..rows-1(북→남, +z).
// 방은 원점 중심이라 카메라 중심 편향 로직을 그대로 재사용한다.

export const DUNGEON_ROOMS = {
  privacy: {
    shrineId: 'privacy-shrine',
    topicId: 'privacy',
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
  }
};

export function getDungeonRoom(topicId) {
  return DUNGEON_ROOMS[topicId] ?? null;
}

export function hasDungeonRoom(topicId) {
  return Boolean(DUNGEON_ROOMS[topicId]);
}

// 방 상태: 각 상자의 현재 [col,row]. 시작은 정답이 아니게(밀어 옮겨야 풀림).
export function createRoomState(topicId) {
  const room = DUNGEON_ROOMS[topicId];
  const crates = {};
  for (const crate of room.crates) {
    crates[crate.id] = [crate.start[0], crate.start[1]];
  }
  return { crates };
}

function inBounds(room, c, r) {
  return c >= 0 && c < room.grid.cols && r >= 0 && r < room.grid.rows;
}

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

// 모든 상자가 자기 종류를 받는 존 칸 위에 있으면 해결.
export function isRoomSolved(topicId, state) {
  const room = DUNGEON_ROOMS[topicId];
  return room.crates.every((crate) => {
    const [c, r] = state.crates[crate.id];
    const zone = zoneAt(room, c, r);
    return zone !== null && zone.accepts === crate.kind;
  });
}

// 아직 제자리를 못 찾은 상자 수(스포일러 없는 힌트용).
export function countRemaining(topicId, state) {
  const room = DUNGEON_ROOMS[topicId];
  return room.crates.reduce((sum, crate) => {
    const [c, r] = state.crates[crate.id];
    const zone = zoneAt(room, c, r);
    return sum + (zone && zone.accepts === crate.kind ? 0 : 1);
  }, 0);
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
