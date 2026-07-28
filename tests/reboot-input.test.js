import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_BINDINGS, createInputRouter, normalizeKeyboardBindings } from '../src/reboot/app/input.js';
import { directionFromStick } from '../src/reboot/input/touchControls.js';
import { createVisibilityPause } from '../src/reboot/input/visibilityPause.js';
import { createFrameMetrics } from '../src/reboot/perf/frameMetrics.js';
import { resolveQualityProfile } from '../src/reboot/settings/quality.js';
import { applyViewportFixture, configureRuntime } from '../src/reboot/settings/runtime.js';

test('가상 조이스틱은 데드존과 대각선 방향을 안정적인 이동 상태로 바꾼다', () => {
  assert.deepEqual(directionFromStick(2, 3, 12), { horizontal: 0, vertical: 0 });
  assert.deepEqual(directionFromStick(30, -40, 12), { horizontal: 1, vertical: -1 });
  assert.deepEqual(directionFromStick(-50, 4, 12), { horizontal: -1, vertical: 0 });
});

test('키보드 기본값은 재매핑할 수 있고 중복되거나 모르는 키는 안전하게 거부한다', () => {
  const remapped = normalizeKeyboardBindings({ KeyL: 'attack', KeyJ: 'reflect', KeyZ: 'unknown' });
  const target = new EventTarget();
  const input = createInputRouter({ bindings: remapped, target });

  assert.equal(remapped.KeyL, 'attack');
  assert.equal(remapped.KeyJ, 'reflect');
  assert.equal(Object.hasOwn(remapped, 'KeyZ'), false);
  assert.equal(DEFAULT_BINDINGS.KeyJ, 'attack');
  input.attach();
  input.detach();
});

test('숨김 탭은 한 번만 일시정지하며 복귀해도 전투를 자동 재개하지 않는다', () => {
  const documentRef = new EventTarget();
  Object.defineProperty(documentRef, 'hidden', { configurable: true, value: false, writable: true });
  const calls = [];
  const controller = createVisibilityPause({
    documentRef,
    pause: () => calls.push('pause'),
    sync: () => calls.push('sync')
  });
  controller.attach();
  documentRef.hidden = true;
  documentRef.dispatchEvent(new Event('visibilitychange'));
  documentRef.hidden = false;
  documentRef.dispatchEvent(new Event('visibilitychange'));
  controller.detach();

  assert.deepEqual(calls, ['pause', 'sync']);
});

test('품질 계층은 시뮬레이션 속도를 건드리지 않고 장식과 DPR만 제한한다', () => {
  assert.deepEqual(resolveQualityProfile('low', 3), {
    dpr: 1, feedbackCapacity: 10, maxDecorations: 8, simulationHz: 60
  });
  assert.equal(resolveQualityProfile('high', 3).dpr, 1.75);
  assert.equal(resolveQualityProfile('auto', 1.5).simulationHz, 60);
});

test('성능 계측은 p95 프레임과 렌더 예산을 정확히 보고하며 표본을 제한한다', () => {
  const metrics = createFrameMetrics({ maxSamples: 120 });
  for (let index = 1; index <= 200; index += 1) {
    metrics.record(index / 1000, {
      calls: 7, heapBytes: 20_000_000, lights: 2, particles: 10, triangles: 9000
    });
  }
  const report = metrics.report();

  assert.equal(report.samples, 120);
  assert.equal(report.p95FrameMs, 195);
  assert.deepEqual(report.render, { calls: 7, heapBytes: 20_000_000, lights: 2, particles: 10, triangles: 9000 });
  assert.equal(report.simulationHz, 60);
});

test('테스트 화면 회전은 캔버스 크기만 바꾸고 저장 설정을 정규화해 전달한다', () => {
  const root = { dataset: {}, style: { setProperty(name, value) { this[name] = value; } } };
  const canvas = { style: {} };
  const settings = configureRuntime({
    canvas,
    root,
    savedSettings: { motion: 'full', quality: 'auto', sound: true },
    searchParams: new URLSearchParams('?viewport=portrait&motion=reduced&quality=low&sound=off'),
    testHook: true
  });
  const rotated = applyViewportFixture({ canvas, name: 'landscape', root });

  assert.deepEqual(settings, { motion: 'reduced', quality: 'low', sound: false });
  assert.equal(rotated, true);
  assert.equal(root.style.width, '1180px');
  assert.equal(root.style.height, '820px');
  assert.equal(root.dataset.viewportFixture, 'landscape');
});
