import { createAppLifecycle } from './app/lifecycle.js';
import { resolveBootScene } from './app/fixtures.js';
import { createInputRouter } from './app/input.js';
import { createRebootSession } from './app/session.js';
import { createSceneRegistry } from './app/sceneRegistry.js';
import { createRenderer } from './render/renderer.js';
import { createSchoolNightScene } from './render/schoolNightScene.js';
import {
  LEGACY_BACKUP_KEY, LEGACY_V3_KEY, V4_SAVE_KEY, V4_TEMP_KEY
} from './save/repository.js';

const root = document.querySelector('[data-reboot-root]');
const canvas = root?.querySelector('[data-reboot-canvas]');
if (!root || !canvas) throw new Error('H-17 reboot root and canvas are required');

const renderer = createRenderer(canvas);
const input = createInputRouter({ target: window });
const session = createRebootSession({ storage: window.localStorage });
const searchParams = new URLSearchParams(window.location.search);
const testHook = window.__ETHICS_TEST_HOOK__ === true
  || window.sessionStorage.getItem('h17.testHook') === 'true'
  || searchParams.get('testHook') === 'h17';
if (testHook && searchParams.get('viewport') === 'touch') {
  root.style.width = '390px';
  root.style.height = '720px';
  root.style.minHeight = '720px';
  canvas.style.width = '390px';
  canvas.style.height = '720px';
}
const sceneUi = Object.freeze({
  action: root.querySelector('[data-combat-action]'),
  chain: root.querySelector('[data-combat-chain]'),
  health: root.querySelector('[data-combat-health]'),
  objective: root.querySelector('[data-route-objective]')
});
const routeFixtures = Object.freeze([
  ['route-classroom', { x: 0, y: -1 }],
  ['route-corridor', { x: 0, y: -18 }],
  ['route-first-arena', { x: 0, y: -39 }],
  ['route-memory', { x: 0, y: -54 }],
  ['route-pursuit', { x: 0, y: -76 }],
  ['route-gym', { x: 0, y: -104 }]
]);
const createScene = (startPosition = { x: 0, y: 0 }) => (
  createSchoolNightScene({ canvas, input, renderer, startPosition, ui: sceneUi })
);
const sceneRegistry = createSceneRegistry([
  ['school-night', () => createScene()],
  ['disposal-fixture', () => createScene()],
  ...routeFixtures.map(([id, startPosition]) => [id, () => createScene(startPosition)])
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
  testHook
});
const status = root.querySelector('[data-reboot-status]');
const recoveryNotice = root.querySelector('[data-recovery-notice]');

if (session.getRecoveryNotice()) {
  recoveryNotice.hidden = false;
  recoveryNotice.textContent = session.getRecoveryNotice();
}

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

if (testHook) {
  const testPanel = root.querySelector('[data-test-storage]');
  const testOutput = testPanel.querySelector('[data-test-output]');
  const legacyFixture = JSON.stringify({
    version: 3,
    visitedTopics: ['privacy'],
    settings: { sound: false, motion: 'reduced', quality: 'low' }
  });
  const syncTestOutput = () => {
    testOutput.textContent = JSON.stringify({
      backup: session.getLegacyBackup(),
      legacy: window.localStorage.getItem(LEGACY_V3_KEY),
      notice: session.getRecoveryNotice(),
      save: session.getState()
    });
  };
  testPanel.hidden = searchParams.get('tools') === 'hidden';
  testPanel.querySelector('[data-test-seed-v3]').addEventListener('click', () => {
    window.__ethicsReboot.clearStorageForTest();
    window.localStorage.setItem(LEGACY_V3_KEY, legacyFixture);
    window.location.reload();
  });
  testPanel.querySelector('[data-test-checkpoint]').addEventListener('click', () => {
    session.update((state) => ({
      ...state,
      chapterProgress: { completed: [], current: 1, checkpoint: 'chapter-1:first-arena' }
    }));
    syncTestOutput();
  });
  testPanel.querySelector('[data-test-corrupt]').addEventListener('click', () => {
    window.localStorage.setItem(V4_SAVE_KEY, '{bad');
    window.location.reload();
  });
  window.__ethicsReboot = Object.freeze({
    clearStorageForTest: () => {
      for (const key of [LEGACY_BACKUP_KEY, LEGACY_V3_KEY, V4_SAVE_KEY, V4_TEMP_KEY]) {
        window.localStorage.removeItem(key);
      }
    },
    corruptV4ForTest: (raw) => window.localStorage.setItem(V4_SAVE_KEY, raw),
    getState: () => app.getState(),
    getSaveState: () => session.getState(),
    getRecoveryNotice: () => session.getRecoveryNotice(),
    getLegacyBackup: () => session.getLegacyBackup(),
    getSceneDebugState: () => app.getSceneDebugState(),
    pause: () => { app.pause(); syncStatus(); },
    restart: () => { app.restart(); syncStatus(); },
    resume: () => { app.resume(); syncStatus(); },
    seedLegacyForTest: (raw) => {
      window.localStorage.removeItem(LEGACY_BACKUP_KEY);
      window.localStorage.removeItem(V4_SAVE_KEY);
      window.localStorage.removeItem(V4_TEMP_KEY);
      window.localStorage.setItem(LEGACY_V3_KEY, raw);
    },
    setCheckpointForTest: (checkpoint) => session.update((state) => ({
      ...state,
      chapterProgress: { completed: [], current: 1, checkpoint }
    })),
    sceneId
  });
  syncTestOutput();
}
