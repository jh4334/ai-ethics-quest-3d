import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DUNGEON_ROOMS,
  cellToWorld,
  countRemaining,
  createRoomState,
  getDungeonRoom,
  hasDungeonRoom,
  isRoomSolved,
  pushCrate,
  roomBounds,
  worldToCell
} from '../src/dungeonPuzzles.js';

test('privacy room exists and is wired to its shrine', () => {
  assert.ok(hasDungeonRoom('privacy'));
  const room = getDungeonRoom('privacy');
  assert.equal(room.shrineId, 'privacy-shrine');
  assert.ok(room.crates.length >= 3);
  assert.ok(room.zones.length >= 2);
  // 존 수용량이 상자 수와 맞아야 해가 존재한다.
  const capacity = room.zones.reduce((sum, z) => sum + z.cells.length, 0);
  assert.equal(capacity, room.crates.length);
});

test('a fresh room starts unsolved (crates off their zones)', () => {
  const state = createRoomState('privacy');
  assert.equal(isRoomSolved('privacy', state), false);
  assert.ok(countRemaining('privacy', state) >= 1);
});

test('pushing a crate into the wrong zone is refused and records nothing moved', () => {
  const state = createRoomState('privacy');
  // 내 그림(p2)을 잠금 금고 방향으로 밀어 금고 칸에 넣으려 하면 거부돼야 한다.
  // p2 시작 [5,3]; board는 [7,1](my-drawing 허용), vault는 [1,1],[1,2](friend-photo 전용).
  // friend-photo(p1 [3,3])을 board 칸으로 몰아넣으려는 시도를 검증.
  const room = DUNGEON_ROOMS.privacy;
  // p1을 board 셀 [7,1]에 억지로 인접시켜 밀어보는 대신, wrong-zone 거부 규칙을 직접 검증:
  let s = { crates: { p1: [6, 1], p2: [5, 3], p3: [4, 4] } };
  const res = pushCrate('privacy', s, 'p1', [1, 0]); // → [7,1] board(my-drawing 전용)로 진입 시도
  assert.equal(res.moved, false);
  assert.equal(res.event, 'wrong-zone');
  assert.deepEqual(res.state.crates.p1, [6, 1], 'refused push leaves crate in place');
  void room;
});

test('pushing a crate into its matching zone marks it placed and can solve the room', () => {
  // 정답 배치를 직접 구성해 solved 판정을 확인.
  const solved = { crates: { p1: [1, 1], p2: [7, 1], p3: [1, 2] } };
  assert.equal(isRoomSolved('privacy', solved), true);
  assert.equal(countRemaining('privacy', solved), 0);
  // placed 이벤트: friend-photo를 vault 칸으로 한 칸 밀어 넣기.
  const s = { crates: { p1: [2, 1], p2: [7, 1], p3: [1, 2] } };
  const res = pushCrate('privacy', s, 'p1', [-1, 0]); // [2,1] → [1,1] vault
  assert.equal(res.moved, true);
  assert.equal(res.event, 'placed');
});

test('crates block each other and walls, staying in bounds (deterministic)', () => {
  const s = { crates: { p1: [0, 3], p2: [1, 3], p3: [4, 4] } };
  // p1을 서쪽 벽 밖으로 밀면 막힌다.
  const wall = pushCrate('privacy', s, 'p1', [-1, 0]);
  assert.equal(wall.moved, false);
  assert.equal(wall.event, 'blocked');
  // p2를 p1 쪽(서쪽)으로 밀면 상자끼리 막힌다.
  const stack = pushCrate('privacy', s, 'p2', [-1, 0]);
  assert.equal(stack.moved, false);
  assert.equal(stack.event, 'blocked');
});

test('cellToWorld/worldToCell round-trip and room is centered on the origin', () => {
  const room = DUNGEON_ROOMS.privacy;
  const center = [(room.grid.cols - 1) / 2, (room.grid.rows - 1) / 2];
  const w = cellToWorld('privacy', center);
  assert.ok(Math.abs(w.x) < 1e-9 && Math.abs(w.z) < 1e-9, 'grid center is world origin');
  for (const cell of [[0, 0], [3, 3], [8, 6], [1, 2]]) {
    const world = cellToWorld('privacy', cell);
    assert.deepEqual(worldToCell('privacy', world.x, world.z), cell);
  }
});

test('roomBounds encloses every cell', () => {
  const b = roomBounds('privacy');
  const room = DUNGEON_ROOMS.privacy;
  for (let c = 0; c < room.grid.cols; c += 1) {
    for (let r = 0; r < room.grid.rows; r += 1) {
      const { x, z } = cellToWorld('privacy', [c, r]);
      assert.ok(x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);
    }
  }
});

test('room logic module uses no Math.random (classroom determinism)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/dungeonPuzzles.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /Math\.random/);
});
