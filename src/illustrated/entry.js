import './style.css';
import { queryCampaignDom } from './campaignDom.js';
import { createCampaignPresentation } from './campaignPresentation.js';
import { createCampaignVisualAssets } from './campaignVisualAssets.js';
import { createSideScrollRenderer } from './sideScrollScene.js';
import {
  advanceChapter,
  createActionGameState,
  createInputState,
  getCampaignReport,
  mapControlAction,
  restartCampaign,
  selectChapter,
  serializeActionGame,
  setInputAction,
  stepActionGame
} from './story.js';

const SAVE_KEY = 'ethics-quest-illustrated-action-v3';
const OLD_SAVE_KEY = 'ethics-quest-illustrated-action-v2';
const LOGICAL_WIDTH = 1280;
const LOGICAL_HEIGHT = 720;
const FIXED_STEP = 1 / 60;
const rootStyles = getComputedStyle(document.documentElement);
const designColor = (name) => rootStyles.getPropertyValue(name).trim();

const ui = queryCampaignDom(document.querySelector('[data-illustrated-game]'));
const context = ui.canvas.getContext('2d', { alpha: false });
const { images, palette } = createCampaignVisualAssets(designColor);
const renderScene = createSideScrollRenderer({ context, images, palette, width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT });
const input = createInputState();

function readSave() {
  try {
    const current = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    if (current?.version === 3) return current;
    const old = JSON.parse(localStorage.getItem(OLD_SAVE_KEY) ?? 'null');
    return old?.version === 2 ? old : null;
  } catch {
    localStorage.removeItem(SAVE_KEY);
    return null;
  }
}

let state = createActionGameState(readSave() ?? {});

function writeSave() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(serializeActionGame(state)));
  ui.continueButton.disabled = false;
}

function resetInput() {
  for (const action of Object.keys(input)) setInputAction(input, action, false);
}

const touchPrompts = matchMedia('(pointer: coarse)').matches;
const presentation = createCampaignPresentation({
  ui,
  getState: () => state,
  writeSave,
  resetInput,
  touchPrompts
});
ui.continueButton.disabled = !readSave();

function beginCampaign(fresh) {
  if (fresh) {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(OLD_SAVE_KEY);
    state = restartCampaign();
  } else {
    state = createActionGameState(readSave() ?? {});
  }
  presentation.resetEventCursor();
  resetInput();
  if (state.phase === 'campaign-complete') presentation.showEnding();
  else if (state.phase === 'chapter-result') presentation.showResult();
  else presentation.showChapterIntro();
}

function goToNextChapter() {
  advanceChapter(state);
  writeSave();
  if (state.phase === 'campaign-complete') presentation.showEnding();
  else presentation.showChapterIntro();
}

function activateControl(action, active) {
  const phase = presentation.getPhase();
  if (phase === 'intro') {
    if (active && (action === 'trace' || action === 'jump' || action === 'attack')) presentation.advanceStory();
    return;
  }
  if (phase === 'result') {
    if (active && (action === 'trace' || action === 'jump' || action === 'attack')) goToNextChapter();
    return;
  }
  if (phase !== 'playing' || ui.helpDialog.open) return;
  setInputAction(input, action, active);
}

window.addEventListener('keydown', (event) => {
  if (event.repeat || ui.helpDialog.open) return;
  const phase = presentation.getPhase();
  if (phase === 'title' && event.code === 'Enter') {
    event.preventDefault();
    beginCampaign(!readSave());
    return;
  }
  if (phase === 'intro' && ['Enter', 'Space', 'KeyE', 'KeyJ'].includes(event.code)) {
    event.preventDefault();
    presentation.advanceStory();
    return;
  }
  if (phase === 'result' && ['Enter', 'Space', 'KeyE', 'KeyJ'].includes(event.code)) {
    event.preventDefault();
    goToNextChapter();
    return;
  }
  const action = mapControlAction(event.code);
  if (!action) return;
  event.preventDefault();
  activateControl(action, true);
});

window.addEventListener('keyup', (event) => {
  const action = mapControlAction(event.code);
  if (!action) return;
  event.preventDefault();
  activateControl(action, false);
});
window.addEventListener('blur', resetInput);

ui.storyNext.addEventListener('click', presentation.advanceStory);
ui.newGameButton.addEventListener('click', () => beginCampaign(true));
ui.continueButton.addEventListener('click', () => beginCampaign(false));
ui.nextChapterButton.addEventListener('click', goToNextChapter);
for (const button of ui.chapterButtons) {
  button.addEventListener('click', () => {
    if (presentation.getPhase() === 'title') return;
    selectChapter(state, Number(button.dataset.chapterButton));
    writeSave();
    if (state.phase === 'chapter-result') presentation.showResult();
    else presentation.showChapterIntro();
  });
}

for (const control of ui.controls) {
  const action = mapControlAction(`touch-${control.dataset.control}`);
  const release = (event) => {
    event.preventDefault();
    activateControl(action, false);
  };
  control.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    try { control.setPointerCapture?.(event.pointerId); } catch {}
    activateControl(action, true);
  });
  control.addEventListener('pointerup', release);
  control.addEventListener('pointercancel', release);
  control.addEventListener('lostpointercapture', release);
}

ui.helpButton.addEventListener('click', () => {
  resetInput();
  ui.helpDialog.showModal();
  ui.helpButton.setAttribute('aria-expanded', 'true');
});
ui.helpClose.addEventListener('click', () => ui.helpDialog.close());
ui.helpDialog.addEventListener('close', () => ui.helpButton.setAttribute('aria-expanded', 'false'));
ui.restartButton.addEventListener('click', () => beginCampaign(true));
ui.printButton.addEventListener('click', () => window.print());

let lastTimestamp = performance.now();
let accumulator = 0;
function frame(timestamp) {
  const frameDelta = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
  lastTimestamp = timestamp;
  if (presentation.getPhase() === 'playing' && !ui.helpDialog.open) {
    accumulator += frameDelta;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 6) {
      stepActionGame(state, input, FIXED_STEP, touchPrompts ? 640 : 360);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
  }
  renderScene(state);
  presentation.syncUi();
  requestAnimationFrame(frame);
}

if (new URLSearchParams(location.search).has('showcase')) {
  ui.primitiveShowcase.hidden = false;
  ui.game.dataset.showcase = 'true';
}
presentation.showTitle();
presentation.syncUi(true);
Promise.all([
  images.background,
  images.sprites,
  images.evidence,
  images.ground,
  ...images.enemies
].map((image) => image.decode())).catch(() => {}).finally(() => renderScene(state));
requestAnimationFrame(frame);

if (new URLSearchParams(location.search).has('testHook')) {
  window.__illustratedAction = {
    getState: () => state,
    getSave: () => serializeActionGame(state),
    getReport: () => getCampaignReport(state),
    getPresentationPhase: presentation.getPhase,
    startNew: () => beginCampaign(true),
    continueGame: () => beginCampaign(false),
    advanceStory: presentation.advanceStory,
    choose: presentation.chooseOption,
    advance: goToNextChapter,
    select: (index) => {
      selectChapter(state, index);
      presentation.showChapterIntro();
    }
  };
}
