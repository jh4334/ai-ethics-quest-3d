import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DUNGEON_ROOMS,
  cellToWorld,
  computeBeamPath,
  countRemaining,
  createRoomState,
  firstCrateInLine,
  getDungeonRoom,
  hasDungeonRoom,
  isRoomSolved,
  pickOrPlace,
  pushCrate,
  roomBounds,
  rotateMirror,
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

test('privacy room now declares its mechanic without changing behavior', () => {
  assert.equal(DUNGEON_ROOMS.privacy.mechanic, 'push');
  // 기존 상태 모양/판정 그대로.
  const state = createRoomState('privacy');
  assert.deepEqual(state, { crates: { p1: [3, 3], p2: [5, 3], p3: [4, 4] } });
});

// ── bias — 모두의 꽃밭 (carry) ───────────────────────────────

test('bias room exists with 4 dispensers, 4 beds, wired to its shrine', () => {
  assert.ok(hasDungeonRoom('bias'));
  const room = getDungeonRoom('bias');
  assert.equal(room.shrineId, 'bias-shrine');
  assert.equal(room.mechanic, 'carry');
  assert.equal(room.dispensers.length, 4);
  assert.equal(room.beds.length, 4);
  assert.deepEqual(room.dispensers.map((d) => d.colorIdx), [0, 1, 2, 3]);
  assert.deepEqual(room.entry, [4, 6]);
  assert.deepEqual(room.pedestal, [4, 0]);
});

test('bias fresh state starts with the Noise preset (duplicate reds) and is unsolved', () => {
  const state = createRoomState('bias');
  // 노이즈가 빨강을 두 밭에 미리 심어둠 — 빈 밭만 채워서는 끝나지 않는다.
  assert.deepEqual(state, { held: null, beds: [0, 0, null, null] });
  assert.equal(isRoomSolved('bias', state), false);
  // 빈 밭 2 + 중복 1 = 3곳을 바꿔야 한다.
  assert.equal(countRemaining('bias', state), 3);
});

test('bias happy path: lift a duplicate red, swap it, fill the rest, room solves', () => {
  let state = createRoomState('bias'); // [0,0,null,null]
  // 중복 빨강 하나를 되집는다(빈 손 + 채워진 밭 = picked).
  const lift = pickOrPlace('bias', state, 'bed2');
  assert.equal(lift.event, 'picked');
  assert.equal(lift.state.held, 0);
  state = lift.state; // beds [0,null,null,null], held red
  // 들고 있던 빨강은 통에서 다른 색으로 교체(무한 공급 모델).
  state = pickOrPlace('bias', state, 'blue').state;
  state = pickOrPlace('bias', state, 'bed2').state; // 파랑 심기
  state = pickOrPlace('bias', state, 'yellow').state;
  state = pickOrPlace('bias', state, 'bed3').state;
  state = pickOrPlace('bias', state, 'purple').state;
  const last = pickOrPlace('bias', state, 'bed4');
  assert.equal(last.event, 'placed');
  state = last.state;
  assert.deepEqual(state.beds, [0, 1, 2, 3]);
  assert.equal(isRoomSolved('bias', state), true);
  assert.equal(countRemaining('bias', state), 0);
});

test('bias refuses planting a color that already grows in another bed (편향 방지)', () => {
  let state = createRoomState('bias'); // bed1·bed2에 빨강
  state = pickOrPlace('bias', state, 'red').state; // 통에서 또 빨강을 집어
  const dup = pickOrPlace('bias', state, 'bed3'); // 빈 밭에 심으려 하면
  assert.equal(dup.event, 'duplicate'); // 거부.
  assert.deepEqual(dup.state.beds, [0, 0, null, null]);
  // 밭이 다 찼어도 중복이 남으면 미해결(프리셋 함정의 핵심).
  const fullDup = { held: null, beds: [0, 0, 1, 2] };
  assert.equal(isRoomSolved('bias', fullDup), false);
  assert.equal(countRemaining('bias', fullDup), 1);
});

test('bias dispenser swaps held color; functions stay pure', () => {
  const start = createRoomState('bias');
  const r1 = pickOrPlace('bias', start, 'red');
  assert.equal(r1.state.held, 0);
  const r2 = pickOrPlace('bias', r1.state, 'purple');
  assert.equal(r2.event, 'picked');
  assert.equal(r2.state.held, 3);
  // 원본 불변(프리셋 포함).
  assert.deepEqual(start, { held: null, beds: [0, 0, null, null] });
});

// ── copyright — 이름의 전당 (carry) ─────────────────────────

test('copyright room exists with 3 exhibits and 5 plates (3 real + 2 fake)', () => {
  assert.ok(hasDungeonRoom('copyright'));
  const room = getDungeonRoom('copyright');
  assert.equal(room.shrineId, 'copyright-shrine');
  assert.equal(room.mechanic, 'carry');
  assert.equal(room.exhibits.length, 3);
  assert.equal(room.plates.length, 5);
  assert.equal(room.plates.filter((p) => p.fake).length, 2);
  // 각 작품의 정답 이름표가 실제로 진짜 이름표 목록에 있어야 한다.
  for (const ex of room.exhibits) {
    const plate = room.plates.find((p) => p.id === ex.correctPlateId);
    assert.ok(plate && !plate.fake);
  }
});

test('copyright fresh state starts unlabeled and unsolved', () => {
  const state = createRoomState('copyright');
  assert.deepEqual(state, { held: null, exhibits: { star: null, wave: null, forest: null } });
  assert.equal(isRoomSolved('copyright', state), false);
  assert.equal(countRemaining('copyright', state), 3);
});

test('copyright happy path: match each exhibit to its true creator, room solves', () => {
  let state = createRoomState('copyright');
  const plan = [
    ['muro', 'star'],
    ['echo', 'wave'],
    ['mori', 'forest']
  ];
  for (const [plateId, exhibitId] of plan) {
    const pick = pickOrPlace('copyright', state, plateId);
    assert.equal(pick.event, 'picked');
    state = pick.state;
    const place = pickOrPlace('copyright', state, exhibitId);
    assert.equal(place.event, 'placed');
    state = place.state;
    assert.equal(state.held, null);
  }
  assert.deepEqual(state.exhibits, { star: 'muro', wave: 'echo', forest: 'mori' });
  assert.equal(isRoomSolved('copyright', state), true);
  assert.equal(countRemaining('copyright', state), 0);
});

test('copyright refuses fake plates and wrong owners, allows return-to-shelf', () => {
  let state = createRoomState('copyright');
  // 가짜 이름표('아무나')는 걸리지 않는다.
  state = pickOrPlace('copyright', state, 'anyone').state;
  const fake = pickOrPlace('copyright', state, 'star');
  assert.equal(fake.event, 'fake');
  assert.equal(fake.state.exhibits.star, null);
  // 다시 내려놓기.
  const back = pickOrPlace('copyright', fake.state, 'anyone');
  assert.equal(back.event, 'placed-back');
  assert.equal(back.state.held, null);
  // 진짜지만 주인이 아닌 이름표(무로=별 그림)를 파도 노래에 달면 거부.
  let s2 = pickOrPlace('copyright', createRoomState('copyright'), 'muro').state;
  const wrong = pickOrPlace('copyright', s2, 'wave');
  assert.equal(wrong.event, 'wrong-owner');
  assert.equal(wrong.state.exhibits.wave, null);
});

test('copyright locked exhibit ignores further input; swap keeps prior plate on shelf', () => {
  let state = createRoomState('copyright');
  state = pickOrPlace('copyright', state, 'muro').state;
  state = pickOrPlace('copyright', state, 'star').state; // star locked with muro
  // 잠긴 작품은 눌러도 아무 일 없음.
  const locked = pickOrPlace('copyright', state, 'star');
  assert.equal(locked.event, null);
  // 이미 걸린 이름표는 선반에서 다시 집히지 않는다.
  const relift = pickOrPlace('copyright', state, 'muro');
  assert.equal(relift.event, null);
  // 손에 든 채 다른 이름표를 누르면 교체(이전 것은 자동으로 선반에 남음).
  let s2 = pickOrPlace('copyright', createRoomState('copyright'), 'echo').state;
  const swap = pickOrPlace('copyright', s2, 'mori');
  assert.equal(swap.event, 'picked');
  assert.equal(swap.state.held, 'mori');
});

// ── deepfake — 진실의 동굴 (beam) ───────────────────────────

test('deepfake room exists: source north, 3 mirrors, 3 orbs (exactly one real)', () => {
  assert.ok(hasDungeonRoom('deepfake'));
  const room = getDungeonRoom('deepfake');
  assert.equal(room.shrineId, 'deepfake-shrine');
  assert.equal(room.mechanic, 'beam');
  assert.deepEqual(room.source.dir, [0, -1]);
  assert.equal(room.mirrors.length, 3);
  assert.equal(room.orbs.length, 3);
  assert.equal(room.orbs.filter((o) => o.real).length, 1);
});

test('deepfake fresh state has all mirrors at 0 and is unsolved (beam hits wall)', () => {
  const state = createRoomState('deepfake');
  assert.deepEqual(state, { mirrors: { m1: 0, m2: 0, m3: 0 } });
  const path = computeBeamPath('deepfake', state);
  assert.equal(path.hit.kind, 'wall');
  assert.equal(isRoomSolved('deepfake', state), false);
  assert.equal(countRemaining('deepfake', state), 1);
});

test('deepfake exhaustive 8-combo check: initial wall, exactly one real, both fakes reachable', () => {
  const results = {};
  for (const m1 of [0, 1]) {
    for (const m2 of [0, 1]) {
      for (const m3 of [0, 1]) {
        const state = { mirrors: { m1, m2, m3 } };
        const { hit } = computeBeamPath('deepfake', state);
        results[`${m1}${m2}${m3}`] = hit.kind === 'orb'
          ? (hit.real ? 'real' : `fake:${hit.orbId}`)
          : hit.kind;
      }
    }
  }
  // 설계된 정확한 결과: 초기 벽, m1을 돌리면 매끈한 가짜(o_fake2),
  // m2만 돌리면 흔들리는 가짜(o_fake1) 경로, m2+m3 두 번을 돌려야 진짜.
  assert.deepEqual(results, {
    '000': 'wall',
    '001': 'wall',
    '010': 'fake:o_fake1',
    '011': 'real',
    '100': 'fake:o_fake2',
    '101': 'fake:o_fake2',
    '110': 'fake:o_fake2',
    '111': 'fake:o_fake2'
  });
  assert.equal(Object.values(results).filter((v) => v === 'real').length, 1);
  // 두 가짜 모두 실제로 도달 가능한 경로가 있어야 교훈이 산다.
  assert.ok(Object.values(results).some((v) => v === 'fake:o_fake1'));
  assert.ok(Object.values(results).some((v) => v === 'fake:o_fake2'));
});

test('deepfake happy path needs two rotations (m2 then m3) to hit the real orb', () => {
  let state = createRoomState('deepfake');
  state = rotateMirror('deepfake', state, 'm2').state;
  // 한 번으로는 아직 — 흔들리는 가짜에 닿는다(교훈 순간).
  assert.equal(computeBeamPath('deepfake', state).hit.real, false);
  const rot = rotateMirror('deepfake', state, 'm3');
  assert.equal(rot.event, 'rotated');
  state = rot.state;
  assert.deepEqual(state.mirrors, { m1: 0, m2: 1, m3: 1 });
  const path = computeBeamPath('deepfake', state);
  assert.equal(path.hit.kind, 'orb');
  assert.equal(path.hit.real, true);
  assert.equal(isRoomSolved('deepfake', state), true);
  assert.equal(countRemaining('deepfake', state), 0);
});

test('deepfake rotateMirror toggles and is pure/deterministic; bad id is a no-op', () => {
  const start = createRoomState('deepfake');
  const a = rotateMirror('deepfake', start, 'm1');
  const b = rotateMirror('deepfake', a.state, 'm1');
  assert.equal(a.state.mirrors.m1, 1);
  assert.equal(b.state.mirrors.m1, 0);
  assert.deepEqual(start, { mirrors: { m1: 0, m2: 0, m3: 0 } }); // 원본 불변
  const bad = rotateMirror('deepfake', start, 'nope');
  assert.equal(bad.event, null);
  // 같은 입력 → 같은 경로.
  const p1 = computeBeamPath('deepfake', { mirrors: { m1: 0, m2: 1, m3: 1 } });
  const p2 = computeBeamPath('deepfake', { mirrors: { m1: 0, m2: 1, m3: 1 } });
  assert.deepEqual(p1, p2);
});

// ── compass pull (나침반 끌어당기기) 탐색 ─────────────────────

test('firstCrateInLine finds the nearest crate along the facing axis within range', () => {
  const state = createRoomState('privacy'); // p1[3,3] p2[5,3] p3[4,4]
  // [0,3]에서 동쪽을 보면 3칸 앞의 p1이 먼저 잡힌다(p2는 그 뒤).
  assert.equal(firstCrateInLine('privacy', state, [0, 3], [1, 0]), 'p1');
  // [4,6]에서 북쪽을 보면 2칸 앞의 p3.
  assert.equal(firstCrateInLine('privacy', state, [4, 6], [0, -1]), 'p3');
  // 사거리 밖(기본 5칸)이면 null: [0,3]→동쪽 p1은 3칸이라 잡히지만, 사거리 2로 줄이면 못 잡는다.
  assert.equal(firstCrateInLine('privacy', state, [0, 3], [1, 0], 2), null);
  // 상자가 없는 방향은 null, 경계 밖으로 나가도 null.
  assert.equal(firstCrateInLine('privacy', state, [0, 0], [0, -1]), null);
  // push 방이 아니면 null(안전).
  assert.equal(firstCrateInLine('bias', createRoomState('bias'), [4, 6], [0, -1]), null);
});

// ── shared generics work across new rooms ───────────────────

test('cellToWorld/worldToCell/roomBounds work for every dungeon room', () => {
  for (const topicId of Object.keys(DUNGEON_ROOMS)) {
    const room = DUNGEON_ROOMS[topicId];
    const b = roomBounds(topicId);
    for (let c = 0; c < room.grid.cols; c += 1) {
      for (let r = 0; r < room.grid.rows; r += 1) {
        const w = cellToWorld(topicId, [c, r]);
        assert.deepEqual(worldToCell(topicId, w.x, w.z), [c, r]);
        assert.ok(w.x >= b.minX && w.x <= b.maxX && w.z >= b.minZ && w.z <= b.maxZ);
      }
    }
  }
});
