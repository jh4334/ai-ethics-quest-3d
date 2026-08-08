import assert from 'node:assert/strict';
import test from 'node:test';

import { createWebglBootController } from '../src/reboot/app/bootController.js';
import { createAppLifecycle } from '../src/reboot/app/lifecycle.js';
import { createSceneRegistry } from '../src/reboot/app/sceneRegistry.js';
import { createRenderer } from '../src/reboot/render/renderer.js';

function createScheduler() {
  let nextId = 1;
  const callbacks = new Map();

  return {
    cancel(id) {
      callbacks.delete(id);
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

function createBootDom() {
  const canvas = new EventTarget();
  canvas.setAttribute = () => {};
  const retry = new EventTarget();
  const message = { textContent: '' };
  const failure = {
    hidden: true,
    querySelector: (selector) => selector === '[data-webgl-retry]' ? retry : message
  };
  const status = { textContent: '' };
  const root = { dataset: {} };
  return { canvas, failure, message, retry, root, status };
}

test('Given WebGL 초기화가 실패하면 When 부팅하면 Then 접근 가능한 안내와 새로고침 선택지를 표시한다', () => {
  // Given: WebGL 생성자가 컨텍스트를 만들지 못하는 장치다.
  const { canvas, failure, message, retry, root, status } = createBootDom();
  let reloads = 0;
  const boot = createWebglBootController({ canvas, failure, reload: () => { reloads += 1; }, root, status });

  // When: 렌더러 부팅 경계가 생성 실패를 만난다.
  const renderer = boot.createRenderer(() => { throw new Error('WebGL unavailable'); });
  retry.dispatchEvent(new Event('click'));

  // Then: 검은 캔버스 대신 상태 안내와 복구 동작이 남는다.
  assert.equal(renderer, null);
  assert.equal(failure.hidden, false);
  assert.match(status.textContent, /WebGL|그래픽/);
  assert.match(message.textContent, /새로고침/);
  assert.equal(root.dataset.webglUnavailable, 'true');
  assert.equal(reloads, 1);
});

test('Given WebGL을 지원하지 않는 캔버스 When 렌더러를 만들면 Then Three 초기화 전에 명시적으로 실패한다', () => {
  // Given: 브라우저가 어떤 WebGL 컨텍스트도 제공하지 않는다.
  const canvas = { getContext: () => null };
  let created = false;

  // When/Then: Three 렌더러 생성기에는 도달하지 않고 지원 오류가 난다.
  assert.throws(
    () => createRenderer(canvas, { rendererFactory: () => { created = true; }, windowRef: { devicePixelRatio: 1 } }),
    /WebGL is not supported/
  );
  assert.equal(created, false);
});

test('Given H-17 야간 장면 When 렌더러를 만들면 Then 기준 톤매핑과 노출을 적용한다', () => {
  const renderer = {
    setClearColor() {},
    setPixelRatio() {},
    userData: {}
  };
  const canvas = { getContext: () => ({}) };

  createRenderer(canvas, { rendererFactory: () => renderer, windowRef: { devicePixelRatio: 1 } });

  assert.equal(renderer.toneMappingExposure, 0.82);
  assert.ok(Number.isInteger(renderer.toneMapping));
});

test('Given 실행 중인 WebGL 캔버스 When 컨텍스트를 잃으면 Then 기본 동작을 막고 일시정지 안내를 남긴다', () => {
  // Given: 정상적으로 렌더러를 만든 뒤 손실 콜백을 연결한 상태다.
  const { canvas, failure, message, root, status } = createBootDom();
  let pauses = 0;
  const boot = createWebglBootController({ canvas, failure, root, status });
  const renderer = boot.createRenderer(() => ({ dispose() {} }));
  boot.onContextLost(() => { pauses += 1; });
  const event = new Event('webglcontextlost', { cancelable: true });

  // When: 브라우저가 WebGL 컨텍스트 손실을 알린다.
  canvas.dispatchEvent(event);

  // Then: 자동 복구 경합 없이 게임은 멈추고 사용자가 다음 행동을 알 수 있다.
  assert.ok(renderer);
  assert.equal(event.defaultPrevented, true);
  assert.equal(pauses, 1);
  assert.equal(failure.hidden, false);
  assert.match(status.textContent, /그래픽|중단/);
  assert.match(message.textContent, /새로고침/);
});

test('Given 실행 중인 장면 When transition으로 다른 장면으로 바꾸면 Then 이전 장면을 정리하고 RAF 하나만 유지한다', () => {
  // Given: 순서를 관찰할 수 있는 두 장면과 수동 RAF 스케줄러가 있다.
  const calls = [];
  const scheduler = createScheduler();
  const registry = createSceneRegistry([
    ['first', () => ({ dispose: () => calls.push('first:dispose'), enter: () => calls.push('first:enter'), exit: () => calls.push('first:exit'), update() {} })],
    ['second', () => ({ dispose: () => calls.push('second:dispose'), enter: () => calls.push('second:enter'), exit: () => calls.push('second:exit'), update() {} })]
  ]);
  const app = createAppLifecycle({ registry, scheduler });
  app.start('first');

  // When: 페이지를 다시 읽지 않고 두 번째 장면으로 전환한다.
  app.transition('second');

  // Then: 새 장면만 실행 중이며 예약된 애니메이션 프레임은 정확히 하나다.
  assert.equal(scheduler.pendingCount(), 1);
  assert.deepEqual(calls, ['first:enter', 'first:exit', 'first:dispose', 'second:enter']);
  assert.deepEqual(app.getState(), { framePending: true, sceneId: 'second', status: 'running' });
});
