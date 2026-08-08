import assert from 'node:assert/strict';
import test from 'node:test';

import { createEncounterGameRuntime } from '../src/reboot/app/encounterGameRuntime.js';
import { ROOM_START_POSITION } from '../src/reboot/campaign/roomWaves.js';
import { chapterOneLevel } from '../src/reboot/content/levels/chapter1.js';
import { chapterTwoLevel } from '../src/reboot/content/levels/chapter2.js';
import { chapterThreeLevel } from '../src/reboot/content/levels/chapter3.js';
import { chapterFourLevel } from '../src/reboot/content/levels/chapter4.js';
import { applyEnemyMotion } from '../src/reboot/enemies/motion.js';
import {
  clampToWalkable, WALKABLE_WALL_INSET, walkableRectsFromLevel
} from '../src/reboot/level/walkableBounds.js';
import { createCombatState, stepCombat } from '../src/reboot/sim/combatSimulation.js';

// 점이 사각형 합집합 안에 있는지(허용 오차 포함) — 테스트 전용 보조.
function insideAny(x, z, rects, epsilon = 1e-6) {
  return rects.some((rect) => (
    x >= rect.minX - epsilon && x <= rect.maxX + epsilon
    && z >= rect.minZ - epsilon && z <= rect.maxZ + epsilon
  ));
}

// 경계 밖으로 향하는 이동 입력을 ticks번 연타한다. 매 틱 경계 안 유지가 계약이다.
function driveAgainstBounds(rects, start, direction, ticks = 240) {
  let state = createCombatState({ targets: [], walkable: rects });
  state.player.position = { x: start.x, y: start.y };
  for (let tick = 0; tick < ticks; tick += 1) {
    state = stepCombat(state, [{ type: 'move', x: direction.x, y: direction.y }]).state;
    assert.ok(
      insideAny(state.player.position.x, state.player.position.y, rects),
      `틱 ${tick}에서 경계 이탈: (${state.player.position.x}, ${state.player.position.y})`
    );
  }
  return state;
}

test('clampToWalkable: 안이면 그대로, 밖이면 가장 가까운 사각형 경계점으로(결정적)', () => {
  const rects = [
    { maxX: 3, maxZ: -6, minX: -3, minZ: -30 },
    { maxX: 6, maxZ: 6, minX: -6, minZ: -6 }
  ];

  // 안: 손대지 않는다(참조 좌표 그대로).
  assert.deepEqual(clampToWalkable(1.5, -10, rects), { x: 1.5, z: -10 });
  // 밖: 가장 가까운 사각형으로 클램프.
  assert.deepEqual(clampToWalkable(10, 0, rects), { x: 6, z: 0 });
  assert.deepEqual(clampToWalkable(-8, -20, rects), { x: -3, z: -20 });
  // 이음새 근처: 더 가까운 사각형(교실)의 경계점으로 붙는다.
  assert.deepEqual(clampToWalkable(5, -6.5, rects), { x: 5, z: -6 });
  // 거리가 같으면 목록의 앞선 사각형을 택한다(strict < — 저작 순서가 곧 우선순위).
  const tied = [{ maxX: 2, maxZ: 2, minX: 0, minZ: 0 }, { maxX: 6, maxZ: 2, minX: 4, minZ: 0 }];
  assert.deepEqual(clampToWalkable(3, 1, tied), { x: 2, z: 1 });
  // 경계가 없으면 클램프하지 않는다(구형 픽스처 호환).
  assert.deepEqual(clampToWalkable(99, 99, []), { x: 99, z: 99 });
});

test('walkableRectsFromLevel: X는 벽 inset, Z는 이음새 보존·경로 양 끝만 inset', () => {
  const rects = walkableRectsFromLevel(chapterOneLevel);
  assert.equal(rects.length, chapterOneLevel.layers.collision.length);

  // X: 모든 세그먼트가 벽 두께만큼 좁아진다(명단광장 ±6 → ±5.4).
  const corridor = rects[1];
  assert.equal(corridor.minX, -6 + WALKABLE_WALL_INSET);
  assert.equal(corridor.maxX, 6 - WALKABLE_WALL_INSET);
  // Z: 중간 이음새는 그대로(-6에서 교실↔복도가 계속 이어진다).
  assert.equal(corridor.maxZ, -6);
  assert.equal(corridor.minZ, -30);
  // Z: 경로 양 끝(교실 북쪽 6, 체육관 남쪽 -119)만 안쪽으로 좁아진다.
  assert.equal(rects[0].maxZ, 6 - WALKABLE_WALL_INSET);
  assert.equal(rects[5].minZ, -119 + WALKABLE_WALL_INSET);
});

test('1장 각 세그먼트: 경계 밖으로 향하는 이동 연타에도 위치가 경계 안에 유지된다', () => {
  const rects = walkableRectsFromLevel(chapterOneLevel);
  // 세그먼트별 시작점(체크포인트)과 밀어붙일 방향 — 좌우 벽·경로 양 끝을 모두 때린다.
  const cases = [
    ['classroom-cold-open', { x: 0, y: 1 }, { x: 0, y: 1 }], // 북쪽 끝
    ['collapsing-corridor', { x: 0, y: -9 }, { x: -1, y: 0 }], // 좁은 복도 왼벽
    ['first-arena', { x: 0, y: -33 }, { x: 1, y: 0 }], // 아레나 오른벽
    ['memory-backup-decision', { x: 0, y: -51 }, { x: -1, y: -0.2 }],
    ['scanner-pursuit', { x: 0, y: -64 }, { x: 1, y: -0.2 }],
    ['gym-boss-arena', { x: 0, y: -95 }, { x: 0, y: -1 }] // 남쪽 끝
  ];
  for (const [label, start, direction] of cases) {
    const state = driveAgainstBounds(rects, start, direction);
    assert.ok(
      insideAny(state.player.position.x, state.player.position.y, rects),
      `${label}: 최종 위치가 경계 밖`
    );
  }
});

test('2~4장 방: 방 시작점에서 사방으로 밀어도 레벨 경계 안에 남는다', () => {
  const levels = [[2, chapterTwoLevel], [3, chapterThreeLevel], [4, chapterFourLevel]];
  for (const [chapter, level] of levels) {
    const rects = walkableRectsFromLevel(level);
    for (const direction of [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      driveAgainstBounds(rects, ROOM_START_POSITION, direction, 300);
    }
    // 방 시작점·전투 원점이 저작 경계 안이어야 스폰이 클램프에 어긋나지 않는다.
    assert.ok(insideAny(ROOM_START_POSITION.x, ROOM_START_POSITION.y, rects), `${chapter}장 시작점`);
    assert.ok(insideAny(0, -23, rects), `${chapter}장 전투 원점`);
  }
});

test('대시 이동도 경계를 뚫지 않는다(복도 벽을 향한 대시)', () => {
  const rects = walkableRectsFromLevel(chapterOneLevel);
  let state = createCombatState({ targets: [], walkable: rects });
  state.player.position = { x: 0, y: -18 };
  // 왼벽을 향해 조향한 뒤 대시 — 대시 프레임(3.8배속) 동안에도 클램프가 잡는다.
  state = stepCombat(state, [{ type: 'move', x: -1, y: 0 }]).state;
  state = stepCombat(state, [{ type: 'dash' }]).state;
  for (let tick = 0; tick < 20; tick += 1) {
    state = stepCombat(state, []).state;
    assert.ok(
      insideAny(state.player.position.x, state.player.position.y, rects),
      `대시 틱 ${tick}에서 경계 이탈: x=${state.player.position.x}`
    );
  }
  assert.ok(state.player.position.x >= -3 + WALKABLE_WALL_INSET - 1e-6);
});

test('런타임 배선: walkable 옵션이 시뮬까지 흘러 플레이어가 아레나 벽을 못 넘는다', () => {
  const rects = walkableRectsFromLevel(chapterOneLevel);
  const runtime = createEncounterGameRuntime({ startPosition: { x: -8, y: -39 }, walkable: rects });
  // 왼쪽(아레나 왼벽 -9, inset 후 -8.4)으로 4초간 밀어붙인다.
  for (let frame = 0; frame < 240; frame += 1) {
    runtime.update(1 / 60, { horizontal: -1, vertical: 0 }, {});
  }
  const player = runtime.getState().combat.player;
  assert.ok(player.position.x >= -9 + WALKABLE_WALL_INSET - 1e-6, `x=${player.position.x}`);
  assert.ok(insideAny(player.position.x, player.position.y, rects));
});

test('적 reposition도 walkable 합집합 안으로 클램프된다(뒷걸음 포함)', () => {
  const rects = [{ maxX: 3, maxZ: -6, minX: -3, minZ: -30 }];
  const enemy = {
    cooldownTicks: 0,
    definition: { stats: { speed: 0.5, turnRadians: 0.2 } },
    faceTicks: 0,
    facing: 0,
    id: 'test-enemy',
    lastIntent: 'idle',
    phase: 'idle',
    phaseDuration: 0,
    phaseTick: 0,
    position: { x: -2.9, z: -10 },
    processedContacts: [],
    spawn: { facing: 0, position: { x: -2.9, z: -10 }, zoneId: 'arena' },
    targetId: 'player',
    zoneId: 'arena'
  };
  // 플레이어가 코앞(preferred보다 가까움) → 벽 쪽으로 뒷걸음치려는 reposition.
  const intent = {
    direction: { x: 1, z: 0 }, distance: 0.5, preferred: 2, type: 'reposition'
  };
  const backedUp = applyEnemyMotion(enemy, intent, rects);
  assert.ok(backedUp.position.x >= -3 && backedUp.position.x <= 3);
  // 경계 없이 호출하면(기존 픽스처) 이전과 동일하게 클램프 없이 움직인다.
  const free = applyEnemyMotion({ ...enemy, position: { x: -3.2, z: -10 } }, intent);
  assert.equal(free.position.x, -3.2 - 0.5);
});
