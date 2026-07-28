import assert from 'node:assert/strict';
import test from 'node:test';

import { createBossGameRuntime } from '../src/reboot/app/bossGameRuntime.js';

function advance(runtime, ticks) {
  const events = [];
  for (let tick = 0; tick < ticks; tick += 1) events.push(...runtime.update(1 / 60).events);
  return events;
}

test('텔레그래프 중 누른 숙련 동사는 활성 창까지 보존된다', () => {
  const runtime = createBossGameRuntime();
  runtime.queueAction('reflect');
  const events = advance(runtime, 30);

  assert.equal(runtime.getState().phaseSuccesses, 1);
  assert.equal(events.filter((event) => event.type === 'mastery-success').length, 1);
});

test('실제 7개 동사 입력으로 세 페이즈를 결정적으로 끝낸다', () => {
  const play = () => {
    const runtime = createBossGameRuntime({ consequencePath: 'purge' });
    const actions = ['reflect', 'reflect', 'trace', 'trace', 'attack', 'attack', 'attack'];
    const events = [];
    for (const action of actions) {
      runtime.queueAction(action);
      const previousHp = runtime.getState().hp;
      while (runtime.getState().hp === previousHp) events.push(...runtime.update(1 / 60).events);
    }
    return { events, state: runtime.getState() };
  };

  const first = play();
  const second = play();
  assert.deepEqual(first, second);
  assert.equal(first.state.status, 'victory');
  assert.equal(first.events.filter((event) => event.type === 'signature-revealed').length, 1);
});

test('패배 재시도는 대기 입력 없이 깨끗한 보스로 돌아온다', () => {
  const runtime = createBossGameRuntime();
  runtime.queueAction('reflect');
  runtime.update(1 / 60, { playerHp: 0 });
  advance(runtime, 90);

  assert.equal(runtime.getState().status, 'active');
  assert.equal(runtime.getState().retries, 1);
  assert.equal(runtime.getState().phaseTick, 0);
});

test('세 번 패배한 뒤에도 한 번의 숙련 루프만 승리를 만든다', () => {
  const runtime = createBossGameRuntime();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    runtime.update(1 / 60, { playerHp: 0 });
    advance(runtime, 90);
  }
  for (const action of ['reflect', 'reflect', 'trace', 'trace', 'attack', 'attack', 'attack']) {
    runtime.queueAction(action);
    const hp = runtime.getState().hp;
    while (runtime.getState().hp === hp) runtime.update(1 / 60);
  }

  assert.equal(runtime.getState().retries, 3);
  assert.equal(runtime.getState().status, 'victory');
  assert.equal(runtime.getState().processedActionIds.length, 7);
});
