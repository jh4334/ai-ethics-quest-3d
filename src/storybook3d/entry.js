import './style.css';

import { createStorybookDiorama } from './dioramaScene.js';
import { STORYBOOK_CHAPTERS } from './content.js';
import {
  advanceSpread,
  createStorybookState,
  inspectClue,
  previousSpread,
  resolveStorybookChoice,
  selectStorybookChapter,
  serializeStorybookState,
  startStorybook,
  STORYBOOK_SAVE_KEY
} from './state.js';
import { createStorybookUi } from './ui.js';

const root = document.querySelector('[data-storybook-root]');
const canvas = document.querySelector('[data-storybook-canvas]');
if (!root || !canvas) throw new Error('3D 동화책 루트와 캔버스가 필요합니다.');

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
let diorama = null;
let frame = 0;
let spreadStartedAt = performance.now();
let activeChapterIndex = -1;

const handlers = {
  choose: (choiceId) => replaceState(resolveStorybookChoice(state, choiceId), '고른 길의 흔적이 책 위에 남았습니다.'),
  continueBook: () => {
    stored = readSavedState();
    const restored = createStorybookState(stored ?? {});
    replaceState(restored.phase === 'title' ? startStorybook(restored) : restored, '마지막으로 읽던 펼침면을 열었습니다.');
  },
  inspectClue: (clueId) => {
    const chapter = STORYBOOK_CHAPTERS[state.chapterIndex];
    const clue = chapter.clues.find((candidate) => candidate.id === clueId);
    replaceState(inspectClue(state, clueId), clue?.detail ?? '흔적을 살펴봤습니다.');
  },
  newBook: () => replaceState(startStorybook(createStorybookState()), '첫 장을 펼쳤습니다.'),
  nextPage: () => {
    const next = advanceSpread(state);
    if (next === state) {
      const message = state.spreadIndex === 1 ? '빛나는 물건 두 개를 모두 살펴보세요.' : '두 길 가운데 하나를 골라 주세요.';
      ui.announce(message);
      return;
    }
    replaceState(next, next.phase === 'complete' ? '하루의 이름이 돌아왔습니다.' : '다음 펼침면을 열었습니다.');
  },
  previousPage: () => replaceState(previousSpread(state), '앞 펼침면으로 돌아갔습니다.'),
  restartBook: () => replaceState(startStorybook(createStorybookState()), '금빛 실의 처음으로 돌아왔습니다.'),
  selectChapter: (index) => replaceState(selectStorybookChapter(state, index), `${index + 1}장을 펼쳤습니다.`)
};

const ui = createStorybookUi(root, handlers, { hasSave: Boolean(stored) });

function persist() {
  if (state.phase === 'title') return;
  try {
    localStorage.setItem(STORYBOOK_SAVE_KEY, serializeStorybookState(state));
  } catch {
    ui.announce('이 기기에서는 읽던 자리를 저장할 수 없습니다.');
  }
}

async function syncDiorama() {
  if (!diorama) return;
  const chapter = STORYBOOK_CHAPTERS[state.chapterIndex];
  if (activeChapterIndex !== state.chapterIndex) {
    activeChapterIndex = state.chapterIndex;
    root.dataset.loading = 'true';
    await diorama.setChapter(chapter, state);
    root.dataset.loading = 'false';
    canvas.dataset.chapter = String(state.chapterIndex + 1);
    const metrics = diorama.metrics();
    canvas.dataset.assetFailures = String(metrics.assetFailures.length);
  } else {
    diorama.updateState(state);
  }
}

async function replaceState(next, announcement) {
  const changed = next !== state;
  state = next;
  ui.render(state);
  if (!changed) return;
  spreadStartedAt = performance.now();
  ui.setHint(0);
  persist();
  await syncDiorama();
  if (announcement) ui.announce(announcement);
}

function animate(now) {
  if (!diorama) return;
  diorama.render();
  ui.syncHotspots(diorama.clueScreenPositions());
  if (state.phase === 'reading' && state.spreadIndex === 1) {
    const elapsed = now - spreadStartedAt;
    ui.setHint(elapsed > 15000 ? 2 : (elapsed > 8000 ? 1 : 0));
  }
  frame = requestAnimationFrame(animate);
}

function installPointerLook() {
  let pointerId = null;
  let previousX = 0;
  canvas.addEventListener('pointerdown', (event) => {
    pointerId = event.pointerId;
    previousX = event.clientX;
    canvas.setPointerCapture(pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    diorama?.rotateBy(event.clientX - previousX);
    previousX = event.clientX;
  });
  const end = (event) => {
    if (event.pointerId === pointerId) pointerId = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

function installKeyboard() {
  window.addEventListener('keydown', (event) => {
    if (document.querySelector('[data-help-dialog]')?.open) return;
    if (event.key === 'ArrowRight') handlers.nextPage();
    else if (event.key === 'ArrowLeft') handlers.previousPage();
  });
}

async function boot() {
  ui.render(state);
  try {
    const quality = new URLSearchParams(location.search).get('quality') ?? 'auto';
    diorama = createStorybookDiorama(canvas, { quality });
    canvas.dataset.renderer = 'webgl';
    installPointerLook();
    installKeyboard();
    window.addEventListener('resize', diorama.resize);
    await syncDiorama();
    canvas.dataset.ready = 'true';
    frame = requestAnimationFrame(animate);
  } catch (error) {
    root.dataset.webgl = 'failed';
    ui.showFallback(`3D 장면을 만들지 못했습니다. ${error.message} 하드웨어 가속을 확인하거나 2D 보존판을 열어 주세요.`);
  }
}

const testHook = new URLSearchParams(location.search).has('testHook') || window.__ETHICS_TEST_HOOK__ === true;
if (testHook) {
  window.__storybook3d = Object.freeze({
    advance: handlers.nextPage,
    choose: handlers.choose,
    getMetrics: () => diorama?.metrics() ?? null,
    getState: () => structuredClone(state),
    inspectClue: handlers.inspectClue,
    selectChapter: handlers.selectChapter
  });
}

window.addEventListener('beforeunload', () => {
  cancelAnimationFrame(frame);
  diorama?.dispose();
}, { once: true });

boot();
