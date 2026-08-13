import backgroundUrl from '../../public/assets/illustrated/h17-side-scroll-background-v1.png?url';
import spriteAtlasUrl from '../../public/assets/illustrated/h17-action-sprites-v1.png?url';
import evidenceAtlasUrl from '../../public/assets/illustrated/h17-evidence-relics-v1.png?url';
import groundTextureUrl from '../../public/assets/reboot/environment/materials/h17-stone/H17Stone_1K-JPG_Color.jpg?url';
import './style.css';
import { createSideScrollRenderer } from './sideScrollScene.js';

import {
  CAMPAIGN_CHAPTERS,
  advanceChapter,
  createActionGameState,
  createInputState,
  getCampaignEnding,
  getCampaignReport,
  mapControlAction,
  resolveChapterChoice,
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
const canvasPalette = Object.freeze({
  surfaceNight: designColor('--surface-night'),
  textPrimary: designColor('--text-primary'),
  textSecondary: designColor('--text-secondary'),
  amberBright: designColor('--amber-bright'),
  cyan: designColor('--cyan'),
  danger: designColor('--danger'),
  veilSoft: designColor('--canvas-veil-soft'),
  veilMedium: designColor('--canvas-veil-medium'),
  veilDeep: designColor('--canvas-veil-deep'),
  glowFade: designColor('--canvas-glow-fade'),
  evidenceGlow: designColor('--canvas-evidence-glow'),
  lockedGlow: designColor('--canvas-locked-glow'),
  labelStroke: designColor('--canvas-label-stroke'),
  healthSurface: designColor('--canvas-health-surface'),
  enemyGlow: designColor('--canvas-enemy-glow'),
  bossGlow: designColor('--canvas-boss-glow'),
  bossSurface: designColor('--canvas-boss-surface'),
  projectileGlow: designColor('--canvas-projectile-glow'),
  playerGlow: designColor('--canvas-player-glow')
});
const game = document.querySelector('[data-illustrated-game]');
const canvas = game.querySelector('[data-action-canvas]');
const context = canvas.getContext('2d', { alpha: false });
const titleScreen = game.querySelector('[data-title-screen]');
const newGameButton = game.querySelector('[data-new-game]');
const continueButton = game.querySelector('[data-continue-game]');
const storyPanel = game.querySelector('[data-story-panel]');
const storySpeaker = game.querySelector('[data-story-speaker]');
const storyLine = game.querySelector('[data-story-line]');
const storyNext = game.querySelector('[data-story-next]');
const choicePanel = game.querySelector('[data-choice-panel]');
const choicePrompt = game.querySelector('[data-choice-prompt]');
const choiceOptions = game.querySelector('[data-choice-options]');
const resultPanel = game.querySelector('[data-result-panel]');
const resultKicker = game.querySelector('[data-result-kicker]');
const resultTitle = game.querySelector('[data-result-title]');
const resultLine = game.querySelector('[data-result-line]');
const resultCost = game.querySelector('[data-result-cost]');
const nextChapterButton = game.querySelector('[data-next-chapter]');
const endingPanel = game.querySelector('[data-ending-panel]');
const endingTitle = game.querySelector('[data-ending-title]');
const endingLine = game.querySelector('[data-ending-line]');
const endingCost = game.querySelector('[data-ending-cost]');
const reportList = game.querySelector('[data-report-list]');
const prompt = game.querySelector('[data-objective-prompt]');
const mission = game.querySelector('[data-mission]');
const zone = game.querySelector('[data-zone]');
const chapterNumber = game.querySelector('[data-chapter-number]');
const chapterTime = game.querySelector('[data-chapter-time]');
const chapterTopic = game.querySelector('[data-chapter-topic]');
const chapterButtons = [...game.querySelectorAll('[data-chapter-button]')];
const health = game.querySelector('[data-health]');
const liveStatus = game.querySelector('[data-live-status]');
const controls = [...game.querySelectorAll('[data-control]')];
const helpButton = game.querySelector('[data-game-help]');
const helpDialog = game.querySelector('[data-help-dialog]');
const helpClose = game.querySelector('[data-help-close]');
const restartButton = game.querySelector('[data-restart]');
const printButton = game.querySelector('[data-print-report]');
const primitiveShowcase = game.querySelector('[data-primitive-showcase]');

const images = {
  background: loadImage(backgroundUrl),
  sprites: loadImage(spriteAtlasUrl),
  evidence: loadImage(evidenceAtlasUrl),
  ground: loadImage(groundTextureUrl)
};
const renderScene = createSideScrollRenderer({ context, images, palette: canvasPalette, width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT });
const input = createInputState();
const savedPayload = readSave();
let state = createActionGameState(savedPayload);
let presentationPhase = 'title';
let storyStep = 0;
let lastTimestamp = performance.now();
let accumulator = 0;
let lastEvent = state.lastEvent;
const touchPrompts = matchMedia('(pointer: coarse)').matches;
continueButton.disabled = !savedPayload;

function loadImage(url) {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  return image;
}

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

function writeSave() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(serializeActionGame(state)));
  continueButton.disabled = false;
}

function currentChapter() {
  return CAMPAIGN_CHAPTERS[state.chapterIndex];
}

function getPrompt() {
  const key = (keyboard, touch) => touchPrompts ? touch : keyboard;
  const nearbyEnemy = state.enemies.find(({ defeated, x }) => !defeated && Math.abs(x - state.player.x) <= 174);
  if (nearbyEnemy) return { key: key('J', 'SIGNAL'), line: '짧게 세 번 공격하면 강한 세 번째 타격이 나갑니다' };
  const nearbyEvidence = state.evidence.find(({ collected, x }) => !collected && Math.abs(x - state.player.x) <= 140);
  if (nearbyEvidence) {
    const enemy = state.enemies.find(({ id }) => id === nearbyEvidence.enemyId);
    return enemy?.defeated
      ? { key: key('E', 'TRACE'), line: `${nearbyEvidence.label} 조사` }
      : { key: key('J', 'SIGNAL'), line: '말소 드론을 먼저 멈추세요' };
  }
  if (state.boss.active && Math.abs(state.boss.x - state.player.x) <= 230) {
    return state.boss.staggered
      ? { key: key('E', 'TRACE'), line: `${state.boss.label} 핵 조사` }
      : { key: key('J', 'SIGNAL'), line: `${state.boss.label}의 파동을 지우세요` };
  }
  return { key: key('D', '이동'), line: '황금 발자국을 따라 오른쪽으로 이동' };
}

function updateChapterRail() {
  for (const button of chapterButtons) {
    const index = Number(button.dataset.chapterButton);
    const chapter = CAMPAIGN_CHAPTERS[index];
    const complete = Boolean(state.decisions[chapter.id]);
    button.disabled = index > state.unlockedChapter;
    button.classList.toggle('is-complete', complete);
    button.classList.toggle('is-current', index === state.chapterIndex);
    button.setAttribute('aria-current', index === state.chapterIndex ? 'step' : 'false');
    button.dataset.status = complete ? '완료' : button.disabled ? '잠김' : '진행 가능';
  }
}

function syncUi(forceAnnouncement = false) {
  const chapter = currentChapter();
  game.dataset.gamePhase = presentationPhase;
  game.dataset.chapter = String(chapter.number);
  game.dataset.evidenceCount = String(state.evidence.filter(({ collected }) => collected).length);
  game.dataset.playerX = String(Math.round(state.player.x));
  game.dataset.cameraX = String(Math.round(state.cameraX));
  game.dataset.playerScreenX = String(Math.round(state.player.x - state.cameraX));
  game.dataset.bossHp = String(state.boss.hp);
  game.dataset.lastEvent = state.lastEvent;
  chapterNumber.textContent = `${chapter.number}장`;
  chapterTime.textContent = chapter.timecode;
  chapterTopic.textContent = chapter.topic;
  zone.textContent = state.currentZone;
  health.setAttribute('aria-label', `기록 안정도 ${state.player.hp}`);
  health.querySelector('span').textContent = `${state.player.hp} / ${state.player.maxHp}`;
  mission.textContent = state.boss.active ? `${state.boss.label}을 멈추고 결정 경로를 복구하라` : chapter.mission;
  updateChapterRail();

  const nextPrompt = getPrompt();
  prompt.querySelector('kbd').textContent = nextPrompt.key;
  prompt.querySelector('span').textContent = nextPrompt.line;
  prompt.hidden = presentationPhase !== 'playing';

  if (presentationPhase === 'playing' && state.phase === 'choice') showChoice();
  if (forceAnnouncement || state.lastEvent !== lastEvent) {
    liveStatus.textContent = state.message;
    lastEvent = state.lastEvent;
    if (state.lastEvent.startsWith('evidence:') || state.lastEvent === 'respawn') writeSave();
  }
}

function hidePanels() {
  resetInput();
  titleScreen.hidden = true;
  storyPanel.hidden = true;
  choicePanel.hidden = true;
  resultPanel.hidden = true;
  endingPanel.hidden = true;
}

function showTitle() {
  hidePanels();
  presentationPhase = 'title';
  titleScreen.hidden = false;
  syncUi(true);
}

function showChapterIntro() {
  hidePanels();
  presentationPhase = 'intro';
  storyStep = 0;
  const beat = currentChapter().intro[storyStep];
  storySpeaker.textContent = beat.speaker;
  storyLine.textContent = beat.line;
  storyPanel.hidden = false;
  syncUi(true);
}

function advanceStory() {
  if (presentationPhase !== 'intro') return false;
  storyStep += 1;
  const beat = currentChapter().intro[storyStep];
  if (!beat) {
    presentationPhase = 'playing';
    storyPanel.hidden = true;
    state.phase = 'playing';
    syncUi(true);
    return true;
  }
  storySpeaker.textContent = beat.speaker;
  storyLine.textContent = beat.line;
  return true;
}

function showChoice() {
  hidePanels();
  presentationPhase = 'choice';
  const chapter = currentChapter();
  choicePrompt.textContent = chapter.choice.prompt;
  choiceOptions.replaceChildren();
  for (const option of chapter.choice.options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.choice = option.id;
    const label = document.createElement('strong');
    label.textContent = option.label;
    const cost = document.createElement('span');
    cost.textContent = option.cost;
    button.append(label, cost);
    button.addEventListener('click', () => chooseOption(option.id));
    choiceOptions.append(button);
  }
  choicePanel.hidden = false;
  choiceOptions.querySelector('button')?.focus();
  syncUi(true);
}

function chooseOption(choiceId) {
  resolveChapterChoice(state, choiceId);
  writeSave();
  showResult();
}

function showResult() {
  hidePanels();
  presentationPhase = 'result';
  const chapter = currentChapter();
  const choiceId = state.decisions[chapter.id];
  const choice = chapter.choice.options.find(({ id }) => id === choiceId);
  resultKicker.textContent = `${chapter.number}장 기록 완료`;
  resultTitle.textContent = choice?.label ?? chapter.title;
  resultLine.textContent = choice?.consequence ?? state.message;
  resultCost.textContent = `남은 비용: ${choice?.cost ?? '다음 조사에서 확인'}`;
  nextChapterButton.textContent = chapter.number === CAMPAIGN_CHAPTERS.length ? '최종 기록 보기' : `${chapter.number + 1}장으로`;
  resultPanel.hidden = false;
  syncUi(true);
}

function showEnding() {
  hidePanels();
  presentationPhase = 'complete';
  const ending = getCampaignEnding(state);
  const report = getCampaignReport(state);
  endingTitle.textContent = ending.title;
  endingLine.textContent = ending.summary;
  endingCost.textContent = `남은 비용: ${ending.cost}`;
  reportList.replaceChildren();
  for (const chapter of report.chapters) {
    const item = document.createElement('li');
    const heading = document.createElement('strong');
    heading.textContent = `${chapter.id.replace('chapter-', '')}장 · ${chapter.decision}`;
    const consequence = document.createElement('span');
    consequence.textContent = chapter.consequence;
    item.append(heading, consequence);
    reportList.append(item);
  }
  endingPanel.hidden = false;
  writeSave();
  syncUi(true);
}

function beginCampaign(fresh) {
  if (fresh) {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(OLD_SAVE_KEY);
    state = restartCampaign();
  } else {
    state = createActionGameState(readSave() ?? {});
  }
  lastEvent = state.lastEvent;
  resetInput();
  if (state.phase === 'campaign-complete') showEnding();
  else if (state.phase === 'chapter-result') showResult();
  else showChapterIntro();
}

function goToNextChapter() {
  advanceChapter(state);
  writeSave();
  if (state.phase === 'campaign-complete') showEnding();
  else showChapterIntro();
}

function activateControl(action, active) {
  if (presentationPhase === 'intro') {
    if (active && (action === 'trace' || action === 'jump' || action === 'attack')) advanceStory();
    return;
  }
  if (presentationPhase === 'result') {
    if (active && (action === 'trace' || action === 'jump' || action === 'attack')) goToNextChapter();
    return;
  }
  if (presentationPhase !== 'playing' || helpDialog.open) return;
  setInputAction(input, action, active);
}

function resetInput() {
  for (const action of Object.keys(input)) setInputAction(input, action, false);
}

window.addEventListener('keydown', (event) => {
  if (event.repeat || helpDialog.open) return;
  if (presentationPhase === 'title' && event.code === 'Enter') {
    event.preventDefault();
    beginCampaign(!readSave());
    return;
  }
  if (presentationPhase === 'intro' && ['Enter', 'Space', 'KeyE', 'KeyJ'].includes(event.code)) {
    event.preventDefault();
    advanceStory();
    return;
  }
  if (presentationPhase === 'result' && ['Enter', 'Space', 'KeyE', 'KeyJ'].includes(event.code)) {
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
storyNext.addEventListener('click', advanceStory);
newGameButton.addEventListener('click', () => beginCampaign(true));
continueButton.addEventListener('click', () => beginCampaign(false));
nextChapterButton.addEventListener('click', goToNextChapter);

for (const button of chapterButtons) {
  button.addEventListener('click', () => {
    if (presentationPhase === 'title') return;
    selectChapter(state, Number(button.dataset.chapterButton));
    writeSave();
    if (state.phase === 'chapter-result') showResult();
    else showChapterIntro();
  });
}

for (const control of controls) {
  const action = mapControlAction(`touch-${control.dataset.control}`);
  const press = (event) => {
    event.preventDefault();
    try {
      control.setPointerCapture?.(event.pointerId);
    } catch {}
    activateControl(action, true);
  };
  const release = (event) => {
    event.preventDefault();
    activateControl(action, false);
  };
  control.addEventListener('pointerdown', press);
  control.addEventListener('pointerup', release);
  control.addEventListener('pointercancel', release);
  control.addEventListener('lostpointercapture', release);
}

helpButton.addEventListener('click', () => {
  resetInput();
  helpDialog.showModal();
  helpButton.setAttribute('aria-expanded', 'true');
});
helpClose.addEventListener('click', () => helpDialog.close());
helpDialog.addEventListener('close', () => helpButton.setAttribute('aria-expanded', 'false'));
restartButton.addEventListener('click', () => beginCampaign(true));
printButton.addEventListener('click', () => window.print());

function frame(timestamp) {
  const frameDelta = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
  lastTimestamp = timestamp;
  if (presentationPhase === 'playing' && !helpDialog.open) {
    accumulator += frameDelta;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 6) {
      stepActionGame(state, input, FIXED_STEP, touchPrompts ? 640 : 360);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
  }
  renderScene(state);
  syncUi();
  requestAnimationFrame(frame);
}

if (new URLSearchParams(location.search).has('showcase')) {
  primitiveShowcase.hidden = false;
  game.dataset.showcase = 'true';
}
showTitle();
syncUi(true);
Promise.all(Object.values(images).map((image) => image.decode())).catch(() => {}).finally(() => renderScene(state));
requestAnimationFrame(frame);

if (new URLSearchParams(location.search).has('testHook')) {
  window.__illustratedAction = {
    getState: () => state,
    getSave: () => serializeActionGame(state),
    getReport: () => getCampaignReport(state),
    getPresentationPhase: () => presentationPhase,
    startNew: () => beginCampaign(true),
    continueGame: () => beginCampaign(false),
    advanceStory,
    choose: chooseOption,
    advance: goToNextChapter,
    select: (index) => {
      selectChapter(state, index);
      showChapterIntro();
    }
  };
}
