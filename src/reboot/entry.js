import { createAppLifecycle } from './app/lifecycle.js';
import { createWebglBootController } from './app/bootController.js';
import { resolveCampaignSceneId } from './app/campaignSceneRouting.js';
import { resolveBootScene } from './app/fixtures.js';
import { createBossFixture } from './bosses/fixtures.js';
import {
  CHAPTER_ONE_POST_BOSS_CHECKPOINTS, chapterOneSpawnForCheckpoint
} from './story/chapterOneGates.js';
import { createInputRouter } from './app/input.js';
import { createQaSceneFixtures } from './app/qaSceneFixtures.js';
import { createRebootSession } from './app/session.js';
import { createSceneRegistry } from './app/sceneRegistry.js';
import { createTouchControls } from './input/touchControls.js';
import { createVisibilityPause } from './input/visibilityPause.js';
import { createTeacherReportView } from './report/teacherReportView.js';
import { applyViewportFixture, configureRuntime, withRuntimeSettings } from './settings/runtime.js';
import { createRenderer } from './render/renderer.js';
import { createDualSchoolPreviewScene } from './render/dualSchoolPreviewScene.js';
import { createFinalBroadcastPreviewScene } from './render/finalBroadcastPreviewScene.js';
import { createCampaignChapterScene } from './render/campaignChapterScene.js';
import { createSchoolNightScene } from './render/schoolNightScene.js';
import { createTestimonyArchiveScene } from './render/testimonyArchiveScene.js';
import { createProductShell } from './shell/productShell.js';
import {
  LEGACY_BACKUP_KEY, LEGACY_V3_KEY, V4_SAVE_KEY, V4_TEMP_KEY, V5_SAVE_KEY, V5_TEMP_KEY
} from './save/repository.js';
import { safeLocalStorage } from './save/resilientStorage.js';

const root = document.querySelector('[data-reboot-root]');
const canvas = root?.querySelector('[data-reboot-canvas]');
if (!root || !canvas) throw new Error('H-17 reboot root and canvas are required');

const session = createRebootSession({ storage: safeLocalStorage(window) });
for (const item of root.querySelectorAll('[data-chapter-progress] [data-chapter]')) {
  const chapter = Number(item.dataset.chapter);
  const progress = session.getState().chapterProgress;
  const state = progress.completed.includes(chapter) ? 'complete' : chapter === progress.current ? 'current' : 'locked';
  item.dataset.state = state;
  if (state === 'current') item.setAttribute('aria-current', 'step');
}
const searchParams = new URLSearchParams(window.location.search);
const testHook = window.__ETHICS_TEST_HOOK__ === true
  || window.sessionStorage.getItem('h17.testHook') === 'true'
  || searchParams.get('testHook') === 'h17';
const runtimeSettings = configureRuntime({ canvas, root, savedSettings: session.getState().settings, searchParams, testHook });
// 터치 레이아웃 판정(S4a) — QA 뷰포트 fixture가 이미 정했으면 그대로 두고,
// 실기기에서는 CSS 표시 조건과 같은 기준(coarse 포인터·좁은 화면)으로 data-touch-mode를 맞춘다.
const touchLayoutQuery = window.matchMedia('(pointer: coarse), (max-width: 760px)');
const syncTouchMode = () => {
  if (root.dataset.viewportFixture) return;
  root.dataset.touchMode = touchLayoutQuery.matches ? 'true' : 'false';
};
syncTouchMode();
touchLayoutQuery.addEventListener?.('change', syncTouchMode);
const status = root.querySelector('[data-reboot-status]');
const boot = createWebglBootController({
  canvas,
  failure: root.querySelector('[data-webgl-failure]'),
  reload: () => window.location.reload(),
  root,
  status
});
const renderer = boot.createRenderer(() => createRenderer(canvas, { quality: runtimeSettings.quality, windowRef: window }));

if (renderer) {
const input = createInputRouter({ target: window });
const touchControls = createTouchControls({ input, root });
const sceneUi = Object.freeze({
  action: root.querySelector('[data-combat-action]'), chain: root.querySelector('[data-combat-chain]'),
  enemy: root.querySelector('[data-enemy-status]'), feedback: root.querySelector('[data-feedback-prompts]'),
  health: root.querySelector('[data-combat-health]'), healthFill: root.querySelector('[data-combat-health-fill]'),
  healthLabel: root.querySelector('[data-combat-health-label]'), objective: root.querySelector('[data-route-objective]'),
  signal: root.querySelector('[data-combat-signal]'), signalFill: root.querySelector('[data-combat-signal-fill]'),
  signalLabel: root.querySelector('[data-combat-signal-label]'),
  radio: root.querySelector('[data-radio-subtitle]'), radioSpeaker: root.querySelector('[data-radio-speaker]'),
  radioText: root.querySelector('[data-radio-text]'), result: root.querySelector('[data-chapter-result]'),
  continueButton: root.querySelector('[data-campaign-continue]'),
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
    sceneUi.continueButton.hidden = false;
  }
});
for (const button of patchPanel.querySelectorAll('[data-patch-id]')) {
  button.addEventListener('click', () => choosePatch?.(button.dataset.patchId));
}
sceneUi.continueButton.addEventListener('click', () => {
  app.transition(resolveCampaignSceneId(session.getState()));
  syncStatus();
});
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
// 부팅·재시작 복원(S6a) — 저장 체크포인트의 저작 스폰에서 시작한다. 보스 격파 직후
// (PATCH 미선택) 저장이면 승리 상태의 보스로 복원해 PATCH 선택부터 이어 간다(새로고침 소프트락 방지).
const createChapterOneScene = () => {
  const progress = session.getState().chapterProgress;
  const checkpoint = progress.current === 1 ? progress.checkpoint : 'chapter-1:start';
  const bossOptions = CHAPTER_ONE_POST_BOSS_CHECKPOINTS.includes(checkpoint)
    ? { enabled: true, initialState: createBossFixture('victory') }
    : { enabled: true };
  return createScene(chapterOneSpawnForCheckpoint(checkpoint), {}, null, bossOptions);
};
const sceneRegistry = createSceneRegistry([
  ['school-night', createChapterOneScene],
  ...[2, 3, 4].map((chapter) => [`campaign-chapter-${chapter}`, () => createCampaignChapterScene({
    campaign: session.getState(), canvas, chapter, input,
    persist: (campaign) => session.update(() => campaign), renderer, ui: sceneUi
  })]),
  ['campaign-chapter-5', () => createTestimonyArchiveScene({
    campaign: session.getState(), canvas, input,
    persist: (campaign) => session.update(() => campaign), renderer, ui: sceneUi
  })],
  ['final-broadcast', () => createFinalBroadcastPreviewScene({
    campaign: session.getState(), canvas, input,
    persist: (campaign) => session.update(() => campaign), renderer, ui: sceneUi
  })],
  ...createQaSceneFixtures({
    createDualSchoolScene: (initialLayer) => createDualSchoolPreviewScene({
      canvas, initialLayer, input, renderer, ui: sceneUi
    }),
    createFinalBroadcastScene: (endingId) => createFinalBroadcastPreviewScene({
      canvas, endingId, input, renderer, ui: sceneUi
    }),
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
  defaultId: resolveCampaignSceneId(session.getState()),
  fixtureIds: sceneRegistry.list(),
  search: window.location.search,
  testHook
});
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
boot.onContextLost(() => {
  app.pause();
  root.dataset.status = app.getState().status;
});

// R 오조작 방지(S6a) — 한 번 더 눌러야 실제로 다시 시작한다(진행 소실 방지).
// 확인 창은 UI 표현 전용 벽시계라 시뮬 결정성과 무관하다.
let restartArmedUntil = 0;
let restartDisarmTimer = null;
function requestRestart() {
  const now = Date.now();
  if (restartDisarmTimer !== null) {
    clearTimeout(restartDisarmTimer);
    restartDisarmTimer = null;
  }
  if (now <= restartArmedUntil) {
    restartArmedUntil = 0;
    app.restart();
    syncStatus();
    return;
  }
  restartArmedUntil = now + 3500;
  status.textContent = '다시 시작할까? 한 번 더 누르면 실행';
  restartDisarmTimer = setTimeout(() => {
    restartDisarmTimer = null;
    restartArmedUntil = 0;
    syncStatus();
  }, 3500);
}
input.subscribe(({ action, active }) => {
  if (!active) return;
  if (action === 'pause') togglePause();
  if (action === 'restart') requestRestart();
});
root.querySelector('[data-pause]')?.addEventListener('click', togglePause);
root.querySelector('[data-restart]')?.addEventListener('click', requestRestart);
const productShell = createProductShell({
  onStart: (nextSceneId) => {
    if (app.getState().status === 'idle') app.start(nextSceneId);
    else app.transition(nextSceneId);
    syncStatus();
  },
  root,
  session,
  windowRef: window
});
const teacherReport = createTeacherReportView({
  getState: () => session.getState(),
  root,
  windowRef: window
});
root.querySelector('[data-teacher-report-open]')?.addEventListener('click', () => teacherReport.open());
window.addEventListener('pagehide', () => {
  visibilityPause.detach();
  touchControls.detach();
  input.detach();
  app.destroy();
  boot.dispose();
  renderer.dispose();
}, { once: true });

input.attach();
touchControls.attach();
visibilityPause.attach();
if (testHook) {
  app.start(sceneId);
  syncStatus();
} else {
  productShell.open();
}

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
      for (const key of [LEGACY_BACKUP_KEY, LEGACY_V3_KEY, V4_SAVE_KEY, V4_TEMP_KEY, V5_SAVE_KEY, V5_TEMP_KEY]) {
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
    transition: (nextSceneId) => { app.transition(nextSceneId); syncStatus(); },
    seedLegacyForTest: (raw) => {
      window.localStorage.removeItem(LEGACY_BACKUP_KEY);
      window.localStorage.removeItem(V4_SAVE_KEY);
      window.localStorage.removeItem(V4_TEMP_KEY);
      window.localStorage.removeItem(V5_SAVE_KEY);
      window.localStorage.removeItem(V5_TEMP_KEY);
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
}
