import { createAppLifecycle } from './app/lifecycle.js';
import { resolveBootScene } from './app/fixtures.js';
import { createInputRouter } from './app/input.js';
import { createQaSceneFixtures } from './app/qaSceneFixtures.js';
import { createRebootSession } from './app/session.js';
import { createSceneRegistry } from './app/sceneRegistry.js';
import { createTouchControls } from './input/touchControls.js';
import { createVisibilityPause } from './input/visibilityPause.js';
import { applyViewportFixture, configureRuntime, withRuntimeSettings } from './settings/runtime.js';
import { createRenderer } from './render/renderer.js';
import { createSchoolNightScene } from './render/schoolNightScene.js';
import {
  LEGACY_BACKUP_KEY, LEGACY_V3_KEY, V4_SAVE_KEY, V4_TEMP_KEY
} from './save/repository.js';

const root = document.querySelector('[data-reboot-root]');
const canvas = root?.querySelector('[data-reboot-canvas]');
if (!root || !canvas) throw new Error('H-17 reboot root and canvas are required');

const session = createRebootSession({ storage: window.localStorage });
const searchParams = new URLSearchParams(window.location.search);
const testHook = window.__ETHICS_TEST_HOOK__ === true
  || window.sessionStorage.getItem('h17.testHook') === 'true'
  || searchParams.get('testHook') === 'h17';
const runtimeSettings = configureRuntime({ canvas, root, savedSettings: session.getState().settings, searchParams, testHook });
const renderer = createRenderer(canvas, { quality: runtimeSettings.quality, windowRef: window });
const input = createInputRouter({ target: window });
const touchControls = createTouchControls({ input, root });
const sceneUi = Object.freeze({
  action: root.querySelector('[data-combat-action]'), chain: root.querySelector('[data-combat-chain]'),
  enemy: root.querySelector('[data-enemy-status]'), feedback: root.querySelector('[data-feedback-prompts]'),
  health: root.querySelector('[data-combat-health]'), objective: root.querySelector('[data-route-objective]'),
  radio: root.querySelector('[data-radio-subtitle]'), radioSpeaker: root.querySelector('[data-radio-speaker]'),
  radioText: root.querySelector('[data-radio-text]'), result: root.querySelector('[data-chapter-result]'),
  resultAction: root.querySelector('[data-result-action]'),
  resultConsequence: root.querySelector('[data-result-consequence]'), resultReversal: root.querySelector('[data-result-reversal]')
});
const patchPanel = root.querySelector('[data-patch-picker]');
let choosePatch = null;
const bossUiBridge = Object.freeze({
  onPatchReady(handler) {
    choosePatch = handler;
    patchPanel.hidden = false;
  },
  onPatchResolved() {
    choosePatch = null;
    patchPanel.hidden = true;
  }
});
for (const button of patchPanel.querySelectorAll('[data-patch-id]')) {
  button.addEventListener('click', () => choosePatch?.(button.dataset.patchId));
}
const createScene = (
  startPosition = { x: 0, y: 0 }, encounterOptions = {}, storyOptions = null,
  bossOptions = { enabled: true }
) => (
  createSchoolNightScene({
    bossOptions: { ...bossOptions, ...bossUiBridge },
    canvas,
    encounterOptions,
    input,
    renderer,
    startPosition,
    storyOptions: storyOptions ? {
      ...storyOptions,
      campaign: withRuntimeSettings(storyOptions.campaign, runtimeSettings)
    } : {
      campaign: withRuntimeSettings(session.getState(), runtimeSettings),
      persist: (campaign) => session.update(() => campaign)
    },
    ui: sceneUi
  })
);
const sceneRegistry = createSceneRegistry([
  ['school-night', () => createScene()],
  ...createQaSceneFixtures({
    createScene,
    persist: (campaign) => session.update(() => campaign)
  })
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
const visibilityPause = createVisibilityPause({
  documentRef: document,
  pause: () => app.pause(),
  sync: syncStatus
});

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
  visibilityPause.detach();
  touchControls.detach();
  input.detach();
  app.destroy();
  renderer.dispose();
}, { once: true });

input.attach();
touchControls.attach();
visibilityPause.attach();
app.start(sceneId);
syncStatus();

if (testHook) {
  const testPanel = root.querySelector('[data-test-storage]');
  const viewportTools = root.querySelector('[data-test-viewport-tools]');
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
  viewportTools.hidden = searchParams.get('orientationTools') !== 'show';
  for (const button of viewportTools.querySelectorAll('[data-test-viewport]')) {
    button.addEventListener('click', () => {
      if (applyViewportFixture({ canvas, name: button.dataset.testViewport, root })) {
        window.dispatchEvent(new Event('resize'));
      }
    });
  }
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
    getTouchDebugState: () => touchControls.getDebugState(),
    pause: () => { app.pause(); syncStatus(); },
    restart: () => { app.restart(); syncStatus(); },
    resume: () => { app.resume(); syncStatus(); },
    seedLegacyForTest: (raw) => {
      window.localStorage.removeItem(LEGACY_BACKUP_KEY);
      window.localStorage.removeItem(V4_SAVE_KEY);
      window.localStorage.removeItem(V4_TEMP_KEY);
      window.localStorage.setItem(LEGACY_V3_KEY, raw);
    },
    setViewportForTest: (name) => {
      const changed = applyViewportFixture({ canvas, name, root });
      if (changed) window.dispatchEvent(new Event('resize'));
      return changed;
    },
    setCheckpointForTest: (checkpoint) => session.update((state) => ({
      ...state,
      chapterProgress: { completed: [], current: 1, checkpoint }
    })),
    sceneId
  });
  syncTestOutput();
}
