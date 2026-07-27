import { createAppLifecycle } from './app/lifecycle.js';
import { resolveBootScene } from './app/fixtures.js';
import { createInputRouter } from './app/input.js';
import { createSceneRegistry } from './app/sceneRegistry.js';
import { createRenderer } from './render/renderer.js';
import { createSchoolNightScene } from './render/schoolNightScene.js';

const root = document.querySelector('[data-reboot-root]');
const canvas = root?.querySelector('[data-reboot-canvas]');
if (!root || !canvas) throw new Error('H-17 reboot root and canvas are required');

const renderer = createRenderer(canvas);
const input = createInputRouter({ target: window });
const sceneRegistry = createSceneRegistry([
  ['school-night', () => createSchoolNightScene({ canvas, input, renderer })],
  ['disposal-fixture', () => createSchoolNightScene({ canvas, input, renderer })]
]);
const scheduler = Object.freeze({
  cancel: (id) => window.cancelAnimationFrame(id),
  request: (callback) => window.requestAnimationFrame(callback)
});
const app = createAppLifecycle({ registry: sceneRegistry, scheduler });
const sceneId = resolveBootScene({
  defaultId: 'school-night',
  fixtureIds: sceneRegistry.list(),
  search: window.location.search,
  testHook: window.__ETHICS_TEST_HOOK__ === true
});
const status = root.querySelector('[data-reboot-status]');

function syncStatus() {
  const state = app.getState();
  status.textContent = state.status === 'paused' ? '일시정지' : '학교 기록 연결됨';
  root.dataset.status = state.status;
}
function togglePause() {
  if (app.getState().status === 'paused') app.resume();
  else app.pause();
  syncStatus();
}

input.subscribe(({ action, active }) => {
  if (!active) return;
  if (action === 'pause') togglePause();
  if (action === 'restart') {
    app.restart();
    syncStatus();
  }
});
root.querySelector('[data-pause]')?.addEventListener('click', togglePause);
root.querySelector('[data-restart]')?.addEventListener('click', () => {
  app.restart();
  syncStatus();
});
window.addEventListener('pagehide', () => {
  input.detach();
  app.destroy();
  renderer.dispose();
}, { once: true });

input.attach();
app.start(sceneId);
syncStatus();

if (window.__ETHICS_TEST_HOOK__ === true) {
  window.__ethicsReboot = Object.freeze({
    getState: () => app.getState(),
    pause: () => { app.pause(); syncStatus(); },
    restart: () => { app.restart(); syncStatus(); },
    resume: () => { app.resume(); syncStatus(); },
    sceneId
  });
}
