import backgroundUrl from '../../public/assets/illustrated/h17-side-scroll-background-v1.png?url';
import spriteAtlasUrl from '../../public/assets/illustrated/h17-action-sprites-v1.png?url';
import './style.css';

import {
  ACTION_ENDING,
  ACTION_PROLOGUE,
  createActionGameState,
  createInputState,
  mapControlAction,
  serializeActionGame,
  setInputAction,
  stepActionGame
} from './story.js';

const SAVE_KEY = 'ethics-quest-illustrated-action-v2';
const LOGICAL_WIDTH = 1280;
const LOGICAL_HEIGHT = 720;
const FIXED_STEP = 1 / 60;
const game = document.querySelector('[data-illustrated-game]');
const canvas = game.querySelector('[data-action-canvas]');
const context = canvas.getContext('2d', { alpha: false });
const storyPanel = game.querySelector('[data-story-panel]');
const storySpeaker = game.querySelector('[data-story-speaker]');
const storyLine = game.querySelector('[data-story-line]');
const storyNext = game.querySelector('[data-story-next]');
const endingPanel = game.querySelector('[data-ending-panel]');
const endingLine = game.querySelector('[data-ending-line]');
const prompt = game.querySelector('[data-objective-prompt]');
const mission = game.querySelector('[data-mission]');
const zone = game.querySelector('[data-zone]');
const health = game.querySelector('[data-health]');
const liveStatus = game.querySelector('[data-live-status]');
const evidenceItems = [...game.querySelectorAll('[data-evidence-id]')];
const controls = [...game.querySelectorAll('[data-control]')];
const helpButton = game.querySelector('[data-game-help]');
const helpDialog = game.querySelector('[data-help-dialog]');
const helpClose = game.querySelector('[data-help-close]');
const restartButton = game.querySelector('[data-restart]');

const images = {
  background: loadImage(backgroundUrl),
  sprites: loadImage(spriteAtlasUrl)
};
const input = createInputState();
let state = createActionGameState(readSave());
const resumed = state.collectedEvidence.length > 0;
const touchPrompts = matchMedia('(pointer: coarse)').matches;
let prologueStep = state.phase === 'complete' || resumed ? ACTION_PROLOGUE.length : 0;
let presentationPhase = state.phase === 'complete' ? 'complete' : resumed ? 'playing' : 'prologue';
let lastTimestamp = performance.now();
let accumulator = 0;
let lastEvent = state.lastEvent;

function loadImage(url) {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  return image;
}

function readSave() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    return parsed?.version === 2 ? parsed : {};
  } catch {
    localStorage.removeItem(SAVE_KEY);
    return {};
  }
}

function writeSave() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(serializeActionGame(state)));
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
  context.drawImage(
    atlas,
    column * sourceWidth,
    row * sourceHeight,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height
  );
  context.restore();
}

function drawBackground() {
  const image = images.background;
  context.fillStyle = '#071127';
  context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  if (!image.complete || image.naturalWidth === 0) return;
  const cameraRange = state.world.width - LOGICAL_WIDTH;
  const progress = cameraRange > 0 ? state.cameraX / cameraRange : 0;
  const sourceAspect = LOGICAL_WIDTH / LOGICAL_HEIGHT;
  const sourceHeight = image.naturalHeight * 0.8;
  const sourceWidth = sourceHeight * sourceAspect;
  const sourceX = (image.naturalWidth - sourceWidth) * progress;
  const sourceY = image.naturalHeight - sourceHeight;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  context.fillStyle = 'rgba(3, 9, 25, 0.08)';
  context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
}

function drawGlow(x, y, radius, color, strength = 0.62) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.28, color);
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
    if (x < -120 || x > LOGICAL_WIDTH + 120) continue;
    const guardian = state.enemies.find(({ id }) => id === evidence.enemyId);
    const available = guardian?.defeated;
    const bob = Math.sin(state.time * 2.4 + evidence.x * 0.01) * 7;
    drawGlow(x, 474 + bob, available ? 74 : 46, available ? 'rgba(255, 186, 72, 0.95)' : 'rgba(112, 138, 192, 0.72)');
    drawAtlasCell(0, 1, x - 38, 432 + bob, 76, 76, 1, available ? 1 : 0.48);
    context.save();
    context.font = '700 18px Pretendard, system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillStyle = available ? '#ffe4a4' : '#b9c9ed';
    context.strokeStyle = 'rgba(5, 12, 30, 0.94)';
    context.lineWidth = 5;
    context.strokeText(evidence.label, x, 425 + bob);
    context.fillText(evidence.label, x, 425 + bob);
    context.restore();
  }
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    if (enemy.defeated) continue;
    const x = enemy.x - state.cameraX;
    if (x < -150 || x > LOGICAL_WIDTH + 150) continue;
    drawGlow(x, 513, 54, 'rgba(128, 164, 226, 0.72)', 0.32);
    drawAtlasCell(1, 1, x - 64, 438, 128, 128, state.player.x < enemy.x ? -1 : 1, enemy.hitFlash > 0 ? 0.58 : 1);
  }
}

function drawBoss() {
  if (!state.boss.active && state.collectedEvidence.length < 4) return;
  const x = state.boss.x - state.cameraX;
  if (x < -260 || x > LOGICAL_WIDTH + 260) return;
  drawGlow(x, 438, state.boss.staggered ? 160 : 110, 'rgba(255, 166, 55, 0.88)', state.boss.staggered ? 0.68 : 0.26);
  drawAtlasCell(state.boss.staggered ? 3 : 2, 1, x - 125, 296, 250, 250, -1, state.boss.hitFlash > 0 ? 0.58 : 1);
  context.save();
  context.fillStyle = 'rgba(5, 9, 24, 0.82)';
  context.fillRect(x - 96, 278, 192, 14);
  context.fillStyle = state.boss.staggered ? '#f2b657' : '#c8d5ef';
  context.fillRect(x - 92, 282, 184 * (state.boss.hp / state.boss.maxHp), 6);
  context.font = '800 16px Pretendard, system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillStyle = '#f7ead1';
  context.fillText('WHITEOUT', x, 267);
  context.restore();
}

function drawProjectiles() {
  for (const projectile of state.projectiles) {
    const x = projectile.x - state.cameraX;
    drawGlow(x, projectile.y, 44, 'rgba(204, 226, 255, 0.8)', 0.3);
    drawAtlasCell(1, 1, x - 34, projectile.y - 34, 68, 68, -1, 0.78);
  }
}

function drawPlayer() {
  const player = state.player;
  const x = player.x - state.cameraX;
  const moving = Math.abs(player.vx) > 1;
  let column = moving ? 1 : 0;
  if (!player.onGround) column = 2;
  if (player.attackTimer > 0) column = 3;
  drawGlow(x, player.y - 15, 92, 'rgba(241, 170, 65, 0.9)', 0.22);
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
  const nearbyEnemy = state.enemies.find(({ defeated, x }) => !defeated && Math.abs(x - state.player.x) <= 170);
  if (nearbyEnemy) return { key: key('J', '공격'), line: '말소 드론을 공격해 조사 신호 열기' };
  const nextEvidence = state.evidence.find(({ collected }) => !collected);
  if (nextEvidence && Math.abs(nextEvidence.x - state.player.x) <= 135) {
    const enemy = state.enemies.find(({ id }) => id === nextEvidence.enemyId);
    return enemy?.defeated
      ? { key: key('E', 'TRACE'), line: `${nextEvidence.label} 증거 TRACE` }
      : { key: key('J', '공격'), line: '말소 드론을 공격해 조사 신호 열기' };
  }
  if (state.boss.active && Math.abs(state.boss.x - state.player.x) <= 220) {
    return state.boss.staggered
      ? { key: key('E', 'TRACE'), line: 'WHITEOUT 핵 TRACE' }
      : { key: key('J', '공격'), line: 'SIGNAL BLADE로 WHITEOUT 공격' };
  }
  return { key: key('D', '이동'), line: '황금 발자국을 따라 오른쪽으로 이동' };
}

function syncUi(forceAnnouncement = false) {
  const completed = state.phase === 'complete';
  if (completed) presentationPhase = 'complete';
  game.dataset.gamePhase = presentationPhase;
  game.dataset.evidenceCount = String(state.collectedEvidence.length);
  game.dataset.playerX = String(Math.round(state.player.x));
  game.dataset.bossHp = String(state.boss.hp);
  game.dataset.lastEvent = state.lastEvent;
  zone.textContent = state.currentZone;
  health.setAttribute('aria-label', `체력 ${state.player.hp}`);
  health.querySelector('span').textContent = `${state.player.hp} / ${state.player.maxHp}`;
  mission.textContent = state.boss.active ? 'WHITEOUT 말소 명령을 중지하라' : '하루의 감사 증거 4개를 복구하라';
  for (const item of evidenceItems) {
    const collected = state.collectedEvidence.includes(item.dataset.evidenceId);
    item.classList.toggle('is-collected', collected);
    item.setAttribute('aria-current', collected ? 'step' : 'false');
  }
  const nextPrompt = getPrompt();
  prompt.querySelector('kbd').textContent = nextPrompt.key;
  prompt.querySelector('span').textContent = nextPrompt.line;
  endingPanel.hidden = !completed;
  if (completed) endingLine.textContent = `${ACTION_ENDING.line} ${state.message}`;
  if (forceAnnouncement || state.lastEvent !== lastEvent) {
    liveStatus.textContent = state.message;
    lastEvent = state.lastEvent;
    if (state.lastEvent.startsWith('evidence:') || state.lastEvent === 'complete') writeSave();
  }
}

function showPrologue() {
  const beat = ACTION_PROLOGUE[prologueStep];
  if (!beat) {
    presentationPhase = 'playing';
    storyPanel.hidden = true;
    syncUi(true);
    return;
  }
  storySpeaker.textContent = beat.speaker;
  storyLine.textContent = beat.line;
  storyPanel.hidden = false;
  game.dataset.gamePhase = 'prologue';
}

function advancePrologue() {
  if (presentationPhase !== 'prologue') return false;
  prologueStep += 1;
  showPrologue();
  return true;
}

function activateControl(action, active) {
  if (presentationPhase === 'prologue') {
    if (active && (action === 'trace' || action === 'jump' || action === 'attack')) advancePrologue();
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
  if (presentationPhase === 'prologue' && ['Enter', 'Space', 'KeyE', 'KeyJ'].includes(event.code)) {
    event.preventDefault();
    advancePrologue();
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
storyNext.addEventListener('click', advancePrologue);

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
restartButton.addEventListener('click', () => {
  localStorage.removeItem(SAVE_KEY);
  state = createActionGameState();
  prologueStep = 0;
  presentationPhase = 'prologue';
  lastEvent = state.lastEvent;
  resetInput();
  showPrologue();
  syncUi(true);
});

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

showPrologue();
syncUi(true);
Promise.all([images.background.decode(), images.sprites.decode()]).catch(() => {}).finally(() => render());
requestAnimationFrame(frame);

if (new URLSearchParams(location.search).has('testHook')) {
  window.__illustratedAction = {
    getState: () => state,
    getSave: () => serializeActionGame(state),
    getPresentationPhase: () => presentationPhase
  };
}
