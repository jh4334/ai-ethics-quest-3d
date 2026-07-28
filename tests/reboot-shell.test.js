import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createAppLifecycle } from '../src/reboot/app/lifecycle.js';
import { resolveBootScene } from '../src/reboot/app/fixtures.js';
import { DEFAULT_BINDINGS, createInputRouter } from '../src/reboot/app/input.js';
import { createRebootSession } from '../src/reboot/app/session.js';
import { createSceneRegistry } from '../src/reboot/app/sceneRegistry.js';
import { createDisposableRegistry } from '../src/reboot/render/dispose.js';

function createScheduler() {
  let nextId = 1;
  const callbacks = new Map();

  return {
    cancel(id) {
      callbacks.delete(id);
    },
    flush(time = 16) {
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const callback of pending) callback(time);
    },
    pendingCount() {
      return callbacks.size;
    },
    request(callback) {
      const id = nextId;
      nextId += 1;
      callbacks.set(id, callback);
      return id;
    }
  };
}

function createKeyboardEvent(type, code) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, 'code', { value: code });
  Object.defineProperty(event, 'repeat', { value: false });
  return event;
}

function createMemoryStorage(entries = []) {
  const values = new Map(entries);
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value)
  };
}

test('reboot session boots v4 storage and persists checkpoint changes', () => {
  // Given: 실제 브라우저 localStorage와 같은 최소 저장소가 있다.
  const storage = createMemoryStorage();
  const first = createRebootSession({ storage });

  // When: 진행 체크포인트를 저장하고 새 세션으로 다시 연다.
  first.update((state) => ({
    ...state,
    chapterProgress: { completed: [], current: 1, checkpoint: 'chapter-1:first-arena' }
  }));
  const continued = createRebootSession({ storage });

  // Then: v4 진행이 실제 부트 경계에서 이어진다.
  assert.equal(continued.getState().chapterProgress.checkpoint, 'chapter-1:first-arena');
  assert.equal(continued.getRecoveryNotice(), null);
});

test('app lifecycle owns one frame loop through pause, resume, and restart', () => {
  // Given: one valid scene factory and an inspectable animation scheduler.
  const calls = [];
  const scheduler = createScheduler();
  const registry = createSceneRegistry([
    ['school-night', () => ({
      dispose: () => calls.push('dispose'),
      enter: () => calls.push('enter'),
      exit: () => calls.push('exit'),
      getDebugState: () => ({ encounter: 'training' }),
      update: () => calls.push('update')
    })]
  ]);
  const app = createAppLifecycle({ registry, scheduler });

  // When: the app runs, pauses, resumes, and restarts once.
  app.start('school-night');
  scheduler.flush();
  app.pause();
  app.resume();
  app.restart();

  // Then: one loop is pending and the replaced scene was fully cleaned up.
  assert.equal(scheduler.pendingCount(), 1);
  assert.deepEqual(calls, ['enter', 'update', 'exit', 'dispose', 'enter']);
  assert.equal(app.getState().status, 'running');
  assert.deepEqual(app.getSceneDebugState(), { encounter: 'training' });
});

test('restart disposes every scene instance across fifty cycles', () => {
  // Given: each scene owns one disposable resource.
  const scheduler = createScheduler();
  let created = 0;
  let disposed = 0;
  const registry = createSceneRegistry([
    ['school-night', () => {
      created += 1;
      const resources = createDisposableRegistry();
      resources.register({ dispose: () => { disposed += 1; } }, `scene-${created}`);
      return {
        dispose: () => resources.disposeAll(),
        enter() {},
        exit() {},
        update() {}
      };
    }]
  ]);
  const app = createAppLifecycle({ registry, scheduler });
  app.start('school-night');

  // When: the same scene is restarted fifty times and then destroyed.
  for (let index = 0; index < 50; index += 1) app.restart();
  app.destroy();

  // Then: all fifty replacements and the final scene release their resources.
  assert.equal(created, 51);
  assert.equal(disposed, 51);
  assert.equal(scheduler.pendingCount(), 0);
});

test('scene registry enforces lifecycle contracts and stable ids', () => {
  // Given: entries are authored in a non-alphabetical order.
  const scene = { dispose() {}, enter() {}, exit() {}, update() {} };
  const registry = createSceneRegistry([
    ['z-scene', () => scene],
    ['a-scene', () => scene]
  ]);

  // When: the ids and a created scene are requested.
  const ids = registry.list();
  const created = registry.create('a-scene');

  // Then: ids are deterministic and malformed scene contracts are rejected.
  assert.deepEqual(ids, ['a-scene', 'z-scene']);
  assert.equal(created, scene);
  assert.throws(
    () => createSceneRegistry([['broken', () => ({ enter() {} })]]).create('broken'),
    /dispose.*enter.*exit.*update|scene contract/i
  );
});

test('fixture bootstrap accepts query fixtures only behind the explicit test hook', () => {
  // Given: a production scene and a deterministic test fixture exist.
  const ids = ['school-night', 'disposal-fixture'];

  // When: the same fixture query is resolved with and without the test hook.
  const productionId = resolveBootScene({
    defaultId: 'school-night',
    fixtureIds: ids,
    search: '?fixture=disposal-fixture',
    testHook: false
  });
  const testId = resolveBootScene({
    defaultId: 'school-night',
    fixtureIds: ids,
    search: '?fixture=disposal-fixture',
    testHook: true
  });

  // Then: production ignores the fixture while tests select it exactly.
  assert.equal(productionId, 'school-night');
  assert.equal(testId, 'disposal-fixture');
  assert.equal(resolveBootScene({ defaultId: 'school-night', fixtureIds: ids, search: '?fixture=unknown', testHook: true }), 'school-night');
});

test('input router maps key state once and detaches cleanly', () => {
  // Given: an event target and one keyboard binding.
  const target = new EventTarget();
  const changes = [];
  const input = createInputRouter({ bindings: { KeyW: 'move-up' }, target });
  input.subscribe((change) => changes.push(change));
  input.attach();

  // When: the key is pressed twice, released, and pressed after detach.
  target.dispatchEvent(createKeyboardEvent('keydown', 'KeyW'));
  target.dispatchEvent(createKeyboardEvent('keydown', 'KeyW'));
  target.dispatchEvent(createKeyboardEvent('keyup', 'KeyW'));
  input.detach();
  target.dispatchEvent(createKeyboardEvent('keydown', 'KeyW'));

  // Then: only real state transitions are emitted and no key stays active.
  assert.deepEqual(changes, [
    { action: 'move-up', active: true },
    { action: 'move-up', active: false }
  ]);
  assert.equal(input.isActive('move-up'), false);
});

test('input router exposes combat verbs to keyboard and touch adapters', () => {
  // Given: 기본 전투 키와 버튼이 함께 쓰는 입력 라우터가 있다.
  const target = new EventTarget();
  const changes = [];
  const input = createInputRouter({ target });
  input.subscribe((change) => changes.push(change));

  // When: 키보드 공격과 터치 어댑터 대시를 각각 한 번 입력한다.
  input.attach();
  target.dispatchEvent(createKeyboardEvent('keydown', 'KeyJ'));
  target.dispatchEvent(createKeyboardEvent('keyup', 'KeyJ'));
  input.setActive('dash', true);
  input.setActive('dash', false);

  // Then: 모든 전투 동사가 고정 키에 있고 같은 상태 변경 경계를 지난다.
  assert.deepEqual(
    Object.fromEntries(['KeyJ', 'Space', 'KeyK', 'KeyE', 'KeyF', 'KeyQ'].map((key) => [key, DEFAULT_BINDINGS[key]])),
    { KeyJ: 'attack', Space: 'dash', KeyK: 'reflect', KeyE: 'trace', KeyF: 'secure', KeyQ: 'purge' }
  );
  assert.deepEqual(changes.map(({ action, active }) => [action, active]), [
    ['attack', true], ['attack', false], ['dash', true], ['dash', false]
  ]);
  input.detach();
});

test('Vite builds isolated legacy and reboot entries with one Three chunk rule', () => {
  // Given: the authored HTML entries, Vite config, and reboot entry source.
  const legacyHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const rebootHtml = readFileSync(new URL('../reboot.html', import.meta.url), 'utf8');
  const vite = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  const rebootEntry = readFileSync(new URL('../src/reboot/entry.js', import.meta.url), 'utf8');
  const runtimeSettings = readFileSync(new URL('../src/reboot/settings/runtime.js', import.meta.url), 'utf8');

  // When: their static entry contracts are inspected.
  // Then: legacy stays default, reboot is isolated, and both share the pinned Three chunk.
  assert.match(legacyHtml, /src="\/src\/main\.js"/);
  assert.match(rebootHtml, /src="\/src\/reboot\/entry\.js"/);
  assert.match(vite, /input:\s*\{[\s\S]*main:[\s\S]*reboot:/);
  assert.match(vite, /node_modules\/three[\s\S]*return 'three'/);
  assert.doesNotMatch(rebootEntry, /(?:\.\.\/)+main\.js|\/src\/main\.js/);
  assert.match(rebootEntry, /createRebootSession\(\{ storage: window\.localStorage \}\)/);
  assert.match(rebootEntry, /health:\s*root\.querySelector\('\[data-combat-health\]'\)/);
  assert.match(rebootEntry, /getSceneDebugState:\s*\(\) => app\.getSceneDebugState\(\)/);
  for (const fixture of ['classroom', 'corridor', 'first-arena', 'memory', 'pursuit', 'gym']) {
    assert.match(rebootEntry, new RegExp(`route-${fixture}`));
  }
  for (const fixture of ['enemy-mixed', 'enemy-blocked', 'enemy-offscreen']) {
    assert.match(rebootEntry, new RegExp(fixture));
  }
  assert.match(rebootEntry, /\['secure', 'purge'\]\.map/);
  assert.match(rebootEntry, /`story-\$\{branch\}-ending`/);
  assert.match(rebootEntry, /`boss-\$\{branch\}`/);
  assert.match(rebootEntry, /sessionStorage\.getItem\('h17\.testHook'\) === 'true'/);
  assert.match(rebootEntry, /URLSearchParams\(window\.location\.search\)[\s\S]*testHook[\s\S]*h17/);
  assert.match(runtimeSettings, /VIEWPORT_FIXTURES[\s\S]*landscape:[\s\S]*1180[\s\S]*portrait:[\s\S]*844[\s\S]*touch:[\s\S]*720/);
  assert.match(rebootEntry, /createTouchControls[\s\S]*createVisibilityPause/);
  assert.match(rebootEntry, /seedLegacyForTest/);
  assert.match(rebootEntry, /corruptV4ForTest/);
  assert.match(rebootHtml, /data-recovery-notice/);
  assert.match(rebootHtml, /data-combat-health[\s\S]*data-combat-action[\s\S]*data-combat-chain[\s\S]*data-enemy-status[\s\S]*data-route-objective/);
  assert.match(rebootHtml, /data-chapter-result[\s\S]*data-result-action[\s\S]*data-result-consequence[\s\S]*data-result-reversal/);
  assert.match(rebootHtml, /data-patch-picker[\s\S]*data-patch-id="reflect-arc"[\s\S]*data-patch-id="trace-speed"[\s\S]*data-patch-id="chain-persistence"/);
  assert.match(rebootHtml, /data-test-storage[\s\S]*data-test-seed-v3[\s\S]*data-test-checkpoint[\s\S]*data-test-corrupt[\s\S]*data-test-output/);
  assert.match(rebootHtml, /data-test-viewport="portrait"[\s\S]*data-test-viewport="landscape"/);
  assert.match(rebootEntry, /data-test-seed-v3[\s\S]*data-test-checkpoint[\s\S]*data-test-corrupt/);
});
