import './style.css';

import { createStorybookAdventureScene } from './adventureScene.js';
import { stepAdventure } from './adventureGame.js';
import { STORYBOOK_CHAPTERS } from './content.js';
import {
  advanceSpread,
  createStorybookState,
  resolveStorybookChoice,
  selectStorybookChapter,
  serializeStorybookState,
  startStorybook,
  STORYBOOK_SAVE_KEY,
  updateStorybookAdventure
} from './state.js';
import { createStorybookUi } from './ui.js';

const root = document.querySelector('[data-storybook-root]');
const canvas = document.querySelector('[data-storybook-canvas]');
if (!root || !canvas) throw new Error('3D 동화 모험 루트와 캔버스가 필요합니다.');

function readSavedState() {
  try {
    const raw = localStorage.getItem(STORYBOOK_SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let stored = readSavedState();
let state = createStorybookState();
let scene = null;
let frame = 0;
let activeChapterIndex = -1;
let previousTime = performance.now();
let accumulator = 0;
let lastPersistedEvent = '';
const FIXED_STEP = 1 / 60;
const input = { up: false, down: false, left: false, right: false, attack: false, guard: false, interact: false };
const queuedInput = { attack: false, interact: false };

const handlers = {
  choose: (choiceId) => replaceState(resolveStorybookChoice(state, choiceId), '고른 길의 가치와 비용이 기록되었습니다.'),
  continueBook: () => {
    stored = readSavedState();
    const restored = createStorybookState(stored ?? {});
    replaceState(restored.phase === 'title' ? startStorybook(restored) : restored, '마지막 등불에서 모험을 이어갑니다.');
  },
  continueChapter: () => {
    const next = advanceSpread(state);
    if (next === state) return;
    replaceState(next, next.phase === 'complete' ? '하루의 이름이 돌아왔습니다.' : `${next.chapterIndex + 1}장 섬으로 건너갑니다.`);
  },
  newBook: () => replaceState(startStorybook(createStorybookState()), '금빛 실을 들고 첫 섬에 섰습니다.'),
  restartBook: () => replaceState(startStorybook(createStorybookState()), '첫 번째 등불로 돌아왔습니다.'),
  selectChapter: (index) => replaceState(selectStorybookChapter(state, index), `${index + 1}장 섬으로 이동했습니다.`)
};

const ui = createStorybookUi(root, handlers, { hasSave: Boolean(stored) });

function persist() {
  if (state.phase === 'title') return;
  try {
    localStorage.setItem(STORYBOOK_SAVE_KEY, serializeStorybookState(state));
  } catch {
    ui.announce('이 기기에서는 모험을 저장할 수 없습니다.');
  }
}

async function syncScene() {
  if (!scene) return;
  const chapter = STORYBOOK_CHAPTERS[state.chapterIndex];
  if (activeChapterIndex !== state.chapterIndex) {
    activeChapterIndex = state.chapterIndex;
    root.dataset.loading = 'true';
    await scene.setChapter(chapter, state.adventure);
    root.dataset.loading = 'false';
    canvas.dataset.chapter = String(state.chapterIndex + 1);
    canvas.dataset.assetFailures = String(scene.metrics().assetFailures.length);
  } else {
    scene.updateState(state.adventure);
  }
}

async function replaceState(next, announcement) {
  const changed = next !== state;
  state = next;
  ui.render(state);
  if (!changed) return;
  persist();
  await syncScene();
  if (announcement) ui.announce(announcement);
}

function clearInputs() {
  for (const key of Object.keys(input)) input[key] = false;
  for (const key of Object.keys(queuedInput)) queuedInput[key] = false;
}

function updateAdventure() {
  if (state.phase !== 'reading' || state.adventure.phase !== 'explore') return;
  const previousEvent = state.adventure.lastEvent;
  const nextAdventure = stepAdventure(state.adventure, {
    ...input,
    attack: input.attack || queuedInput.attack,
    interact: input.interact || queuedInput.interact
  }, FIXED_STEP);
  queuedInput.attack = false;
  queuedInput.interact = false;
  input.interact = false;
  state = updateStorybookAdventure(state, nextAdventure);
  scene?.updateState(nextAdventure);
  ui.render(state);
  if (nextAdventure.lastEvent !== previousEvent && nextAdventure.lastEvent !== lastPersistedEvent) {
    lastPersistedEvent = nextAdventure.lastEvent;
    persist();
    ui.announce(nextAdventure.message);
  }
}

function animate(now) {
  if (!scene) return;
  const delta = Math.min((now - previousTime) / 1000, 0.1);
  previousTime = now;
  accumulator += delta;
  let steps = 0;
  while (accumulator >= FIXED_STEP && steps < 5) {
    updateAdventure();
    accumulator -= FIXED_STEP;
    steps += 1;
  }
  scene.render(delta);
  frame = requestAnimationFrame(animate);
}

const KEY_BINDINGS = Object.freeze({
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyJ: 'attack', KeyK: 'guard', KeyE: 'interact', Enter: 'interact', Space: 'attack'
});

function installKeyboard() {
  window.addEventListener('keydown', (event) => {
    if (document.querySelector('[data-help-dialog]')?.open) return;
    const action = KEY_BINDINGS[event.code];
    if (!action) return;
    event.preventDefault();
    if (action === 'interact' && event.repeat) return;
    input[action] = true;
    if (action === 'attack' || action === 'interact') queuedInput[action] = true;
  });
  window.addEventListener('keyup', (event) => {
    const action = KEY_BINDINGS[event.code];
    if (action) input[action] = false;
  });
  window.addEventListener('blur', clearInputs);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInputs(); });
}

function installTouch() {
  for (const button of root.querySelectorAll('[data-control]')) {
    const action = button.dataset.control;
    const press = (event) => {
      event.preventDefault();
      input[action] = true;
      if (action === 'attack' || action === 'interact') queuedInput[action] = true;
      button.dataset.pressed = 'true';
      try {
        button.setPointerCapture?.(event.pointerId);
      } catch {
        return;
      }
    };
    const release = (event) => {
      event.preventDefault();
      input[action] = false;
      button.dataset.pressed = 'false';
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }
}

async function boot() {
  ui.render(state);
  try {
    const quality = new URLSearchParams(location.search).get('quality') ?? 'auto';
    scene = createStorybookAdventureScene(canvas, { quality });
    canvas.dataset.renderer = 'webgl';
    canvas.dataset.mode = 'topdown-adventure';
    installKeyboard();
    installTouch();
    window.addEventListener('resize', scene.resize);
    await syncScene();
    canvas.dataset.ready = 'true';
    frame = requestAnimationFrame(animate);
  } catch (error) {
    root.dataset.webgl = 'failed';
    ui.showFallback(`3D 모험을 시작하지 못했습니다. ${error.message} 하드웨어 가속을 확인하거나 2D 보존판을 열어 주세요.`);
  }
}

const testHook = new URLSearchParams(location.search).has('testHook') || window.__ETHICS_TEST_HOOK__ === true;
if (testHook) {
  window.__storybook3d = Object.freeze({
    choose: handlers.choose,
    continueChapter: handlers.continueChapter,
    getMetrics: () => scene?.metrics() ?? null,
    getState: () => structuredClone(state),
    selectChapter: handlers.selectChapter,
    teleport(x, z) {
      state = updateStorybookAdventure(state, {
        ...state.adventure,
        player: { ...state.adventure.player, x, z }
      });
      scene?.updateState(state.adventure);
      ui.render(state);
    }
  });
}

window.addEventListener('beforeunload', () => {
  cancelAnimationFrame(frame);
  scene?.dispose();
}, { once: true });

boot();
