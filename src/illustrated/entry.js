import backgroundUrl from '../../public/assets/illustrated/h17-side-scroll-background-v1.png?url';
import spriteAtlasUrl from '../../public/assets/illustrated/h17-action-sprites-v1.png?url';
import evidenceAtlasUrl from '../../public/assets/illustrated/h17-evidence-relics-v1.png?url';
import './style.css';

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
  evidence: loadImage(evidenceAtlasUrl)
};
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

function drawAtlasCell(column, row, x, y, width, height, facing = 1, alpha = 1) {
  const atlas = images.sprites;
  if (!atlas.complete || atlas.naturalWidth === 0) return;
  const sourceWidth = atlas.naturalWidth / 4;
  const sourceHeight = atlas.naturalHeight / 2;
  context.save();
  context.globalAlpha = alpha;
  if (facing < 0) {
    context.translate(x + width, 0);
    context.scale(-1, 1);
    x = 0;
  }
  context.drawImage(atlas, column * sourceWidth, row * sourceHeight, sourceWidth, sourceHeight, x, y, width, height);
  context.restore();
}

function drawEvidenceCell(chapterIndex, x, y, width, height, alpha = 1) {
  const atlas = images.evidence;
  if (!atlas.complete || atlas.naturalWidth === 0) return;
  const column = chapterIndex % 3;
  const row = Math.floor(chapterIndex / 3);
  const sourceWidth = atlas.naturalWidth / 3;
  const sourceHeight = atlas.naturalHeight / 2;
  context.save();
  context.globalAlpha = alpha;
  context.drawImage(atlas, column * sourceWidth, row * sourceHeight, sourceWidth, sourceHeight, x, y, width, height);
  context.restore();
}

function drawBackground() {
  const image = images.background;
  context.fillStyle = '#071127';
  context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  if (!image.complete || image.naturalWidth === 0) return;
  const cameraRange = state.world.width - LOGICAL_WIDTH;
  const localProgress = cameraRange > 0 ? state.cameraX / cameraRange : 0;
  const sourceHeight = image.naturalHeight * 0.8;
  const sourceWidth = sourceHeight * (LOGICAL_WIDTH / LOGICAL_HEIGHT);
  const chapterProgress = (state.chapterIndex + localProgress * 0.78) / (CAMPAIGN_CHAPTERS.length - 0.22);
  const sourceX = (image.naturalWidth - sourceWidth) * chapterProgress;
  const sourceY = image.naturalHeight - sourceHeight;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  const veil = context.createLinearGradient(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  veil.addColorStop(0, 'rgba(5, 9, 24, 0.05)');
  veil.addColorStop(0.7, 'rgba(5, 9, 24, 0.12)');
  veil.addColorStop(1, 'rgba(5, 9, 24, 0.3)');
  context.fillStyle = veil;
  context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
}

function drawGlow(x, y, radius, color, strength = 0.62) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.3, color);
  gradient.addColorStop(1, 'rgba(255, 184, 78, 0)');
  context.save();
  context.globalAlpha = strength;
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawEvidence() {
  for (const evidence of state.evidence) {
    if (evidence.collected) continue;
    const x = evidence.x - state.cameraX;
    if (x < -140 || x > LOGICAL_WIDTH + 140) continue;
    const guardian = state.enemies.find(({ id }) => id === evidence.enemyId);
    const available = guardian?.defeated;
    const bob = Math.sin(state.time * 2.4 + evidence.x * 0.01) * 7;
    drawGlow(x, 474 + bob, available ? 92 : 58, available ? 'rgba(255, 186, 72, 0.95)' : 'rgba(95, 196, 201, 0.7)');
    drawEvidenceCell(state.chapterIndex, x - 62, 402 + bob, 124, 124, available ? 1 : 0.62);
    context.save();
    context.font = '800 18px Pretendard, system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillStyle = available ? '#ffe4a4' : '#b9c9ed';
    context.strokeStyle = 'rgba(5, 12, 30, 0.94)';
    context.lineWidth = 5;
    context.strokeText(evidence.label, x, 408 + bob);
    context.fillText(evidence.label, x, 408 + bob);
    context.restore();
  }
}

function drawEnemyHealth(enemy, x) {
  context.save();
  context.fillStyle = 'rgba(5, 9, 24, 0.82)';
  context.fillRect(x - 43, 430, 86, 9);
  context.fillStyle = '#e26f78';
  context.fillRect(x - 40, 433, 80 * (enemy.hp / enemy.maxHp), 3);
  context.restore();
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    if (enemy.defeated) continue;
    const x = enemy.x - state.cameraX;
    if (x < -150 || x > LOGICAL_WIDTH + 150) continue;
    drawGlow(x, 513, 58, 'rgba(128, 164, 226, 0.72)', 0.28);
    drawAtlasCell(1, 1, x - 64, 438, 128, 128, state.player.x < enemy.x ? -1 : 1, enemy.hitFlash > 0 ? 0.55 : 1);
    drawEnemyHealth(enemy, x);
  }
}

function drawBoss() {
  if (!state.boss.active) return;
  const x = state.boss.x - state.cameraX;
  if (x < -280 || x > LOGICAL_WIDTH + 280) return;
  drawGlow(x, 438, state.boss.staggered ? 170 : 120, 'rgba(255, 166, 55, 0.88)', state.boss.staggered ? 0.7 : 0.28);
  drawAtlasCell(state.boss.staggered ? 3 : 2, 1, x - 125, 296, 250, 250, -1, state.boss.hitFlash > 0 ? 0.55 : 1);
  context.save();
  context.fillStyle = 'rgba(5, 9, 24, 0.86)';
  context.fillRect(x - 104, 272, 208, 16);
  context.fillStyle = state.boss.staggered ? '#6fe0d1' : '#e26f78';
  context.fillRect(x - 100, 277, 200 * (state.boss.hp / state.boss.maxHp), 6);
  context.font = '800 16px Pretendard, system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillStyle = '#f7ead1';
  context.fillText(state.boss.label, x, 260);
  context.restore();
}

function drawProjectiles() {
  for (const projectile of state.projectiles) {
    const x = projectile.x - state.cameraX;
    drawGlow(x, projectile.y, 48, 'rgba(226, 111, 120, 0.86)', 0.36);
    drawAtlasCell(1, 1, x - 34, projectile.y - 34, 68, 68, -1, 0.8);
  }
}

function drawPlayer() {
  const player = state.player;
  const x = player.x - state.cameraX;
  const moving = Math.abs(player.vx) > 1;
  let column = moving ? 1 : 0;
  if (!player.onGround) column = 2;
  if (player.attackTimer > 0) column = 3;
  drawGlow(x, player.y - 15, 92, 'rgba(241, 170, 65, 0.9)', 0.2);
  const flicker = player.invulnerable > 0 && Math.floor(state.time * 16) % 2 === 0;
  drawAtlasCell(column, 0, x - 82, player.y - 166, 164, 164, player.facing, flicker ? 0.42 : 1);
  const dotBob = Math.sin(state.time * 3.2) * 5;
  drawAtlasCell(0, 1, x - player.facing * 74 - 30, player.y - 138 + dotBob, 60, 60, 1, 0.96);
}

function render() {
  drawBackground();
  drawEvidence();
  drawEnemies();
  drawBoss();
  drawProjectiles();
  drawPlayer();
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
      stepActionGame(state, input, FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
  }
  render();
  syncUi();
  requestAnimationFrame(frame);
}

if (new URLSearchParams(location.search).has('showcase')) {
  primitiveShowcase.hidden = false;
  game.dataset.showcase = 'true';
}
showTitle();
syncUi(true);
Promise.all([images.background.decode(), images.sprites.decode(), images.evidence.decode()]).catch(() => {}).finally(() => render());
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
