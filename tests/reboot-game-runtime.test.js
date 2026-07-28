import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameRuntime } from '../src/reboot/app/gameRuntime.js';

test('game runtime preserves edge actions and emits one authoritative start', () => {
  // Given: 렌더 프레임과 독립된 60Hz 게임 런타임이 있다.
  const game = createGameRuntime();

  // When: fixed tick이 없는 프레임에 공격을 누른 뒤 다음 프레임을 진행한다.
  game.queueAction('attack');
  const waiting = game.update(1 / 120, { horizontal: 0, vertical: 0 });
  const started = game.update(1 / 120, { horizontal: 0, vertical: 0 });

  // Then: 입력은 사라지지 않고 정확히 한 번만 권위 이벤트가 된다.
  assert.equal(waiting.events.length, 0);
  assert.equal(started.events.filter((event) => event.type === 'action-started').length, 1);
  assert.equal(started.state.player.action.name, 'attack1');
});

test('game runtime maps route movement to combat coordinates and resets cleanly', () => {
  // Given: 플레이어가 학교 복도 원점에 있다.
  const game = createGameRuntime();

  // When: 오른쪽 위 방향을 한 tick 이동하고 런타임을 초기화한다.
  const moved = game.update(1 / 60, { horizontal: 1, vertical: -1 });
  const reset = game.reset();

  // Then: 이동은 정규화되고 재시작은 모든 transient 상태를 제거한다.
  assert.ok(moved.state.player.position.x > 0);
  assert.ok(moved.state.player.position.y < 0);
  assert.deepEqual(reset.player.position, { x: 0, y: 0 });
  assert.equal(reset.tick, 0);
  assert.deepEqual(reset.transient.processedContacts, []);
});

test('game runtime starts and resets at an authored route fixture position', () => {
  // Given: 체육관 구간을 직접 여는 브라우저 픽스처다.
  const game = createGameRuntime({ startPosition: { x: 0, y: -104 } });

  // When: 한 번 이동한 뒤 다시 시작한다.
  game.update(1 / 60, { horizontal: 1, vertical: 0 });
  const reset = game.reset();

  // Then: 픽스처 시작점이 최초 상태와 재시작 상태에 동일하게 적용된다.
  assert.deepEqual(reset.player.position, { x: 0, y: -104 });
});

test('default browser encounter keeps the memory target inside TRACE range', () => {
  // Given: 학교 씬의 첫 전투 픽스처다.
  const game = createGameRuntime();

  // When: 움직이지 않고 기억 백업을 TRACE한다.
  game.queueAction('trace', 'memory-backup');
  for (let tick = 0; tick < 20; tick += 1) game.update(1 / 60);

  // Then: 브라우저 입력만으로 TRACE→SECURE 학습 루프를 시작할 수 있다.
  const memory = game.getState().targets.find((target) => target.id === 'memory-backup');
  assert.equal(memory.traced, true);
});
