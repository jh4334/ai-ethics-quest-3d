import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serializeSave } from '../src/reboot/save/codec.js';
import { V5_SAVE_KEY } from '../src/reboot/save/repository.js';
import { setChapterCheckpoint } from '../src/reboot/state/consequences.js';
import { createInitialRebootState } from '../src/reboot/state/model.js';

const baseUrl = process.env.H17_PLAYTHROUGH_URL ?? 'http://127.0.0.1:4174/';
const evidenceDirectory = fileURLToPath(new URL('../.omo/evidence/h17-six-chapter/playthrough/', import.meta.url));
const query = 'testHook=h17&tools=hidden&motion=reduced&sound=off&sw=off&quality=low';
const startingChapter = Number(process.env.H17_PLAYTHROUGH_START ?? 1);
const inputMode = process.env.H17_PLAYTHROUGH_INPUT ?? 'keyboard';
if (!Number.isInteger(startingChapter) || startingChapter < 1 || startingChapter > 6) {
  throw new RangeError('H17_PLAYTHROUGH_START는 1~6이어야 합니다.');
}
if (!['keyboard', 'touch'].includes(inputMode)) throw new RangeError('입력 모드는 keyboard 또는 touch여야 합니다.');
const chapterStartedAt = new Map();
const chapterReports = [];

function relativeEvidencePath(path) {
  return relative(process.cwd(), path).replaceAll('\\', '/');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForDataset(page, key, expected, timeout = 90_000) {
  await page.waitForFunction(({ expectedValue, property }) => (
    document.querySelector('[data-reboot-canvas]')?.dataset[property] === expectedValue
  ), { expectedValue: String(expected), property: key }, { timeout });
}

async function tap(page, code) {
  if (inputMode === 'keyboard') {
    await page.keyboard.press(code);
    return;
  }
  const action = ({ KeyE: 'trace', KeyF: 'secure', KeyJ: 'attack', KeyK: 'reflect', KeyQ: 'purge', Space: 'dash' })[code];
  if (!action) throw new RangeError(`터치 버튼으로 바꿀 수 없는 입력입니다: ${code}`);
  await page.locator(`[data-touch-action="${action}"]`).evaluate((button) => {
    const pointerId = 700 + Number(button.dataset.touchSequence ?? 0);
    button.dataset.touchSequence = String(pointerId - 699);
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerId }));
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, isPrimary: true, pointerId }));
  });
}

async function setTouchMovement(page, x, y, active) {
  await page.locator('[data-touch-stick]').evaluate((stick, movement) => {
    const pointerId = 690;
    const rect = stick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    if (movement.active && stick.dataset.qaPointerActive !== 'true') {
      stick.dataset.qaPointerActive = 'true';
      stick.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, clientX: centerX, clientY: centerY, isPrimary: true, pointerId
      }));
    }
    stick.dispatchEvent(new PointerEvent(movement.active ? 'pointermove' : 'pointerup', {
      bubbles: true, clientX: centerX + movement.x * 40, clientY: centerY + movement.y * 40,
      isPrimary: true, pointerId
    }));
    if (!movement.active) delete stick.dataset.qaPointerActive;
  }, { active, x, y });
}

async function moveUntil(page, predicate, timeout = 90_000) {
  const deadline = Date.now() + timeout;
  let leftHeld = false;
  let rightHeld = false;
  if (inputMode === 'keyboard') await page.keyboard.down('KeyW');
  try {
    while (Date.now() < deadline) {
      if (await page.evaluate(predicate)) return;
      const x = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState().combat.player.x);
      const horizontal = Math.abs(x) > 0.65 ? -Math.sign(x) : 0;
      if (inputMode === 'touch') {
        await setTouchMovement(page, horizontal, -1, true);
      } else {
        if (horizontal < 0 && !leftHeld) { await page.keyboard.down('KeyA'); leftHeld = true; }
        if (horizontal >= 0 && leftHeld) { await page.keyboard.up('KeyA'); leftHeld = false; }
        if (horizontal > 0 && !rightHeld) { await page.keyboard.down('KeyD'); rightHeld = true; }
        if (horizontal <= 0 && rightHeld) { await page.keyboard.up('KeyD'); rightHeld = false; }
      }
      await page.waitForTimeout(100);
    }
    throw new Error('이동 조건을 제한 시간 안에 충족하지 못했습니다.');
  } catch (error) {
    const debug = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState());
    throw new Error(`이동 제한 시간을 넘었습니다: ${JSON.stringify(debug)}`, { cause: error });
  } finally {
    if (inputMode === 'touch') await setTouchMovement(page, 0, 0, false);
    else {
      await page.keyboard.up('KeyW');
      if (leftHeld) await page.keyboard.up('KeyA');
      if (rightHeld) await page.keyboard.up('KeyD');
    }
  }
}

async function fightNearest(page, { kind, targetStep = null, verbCode = 'KeyJ' }) {
  await page.evaluate(async ({ fightKind, requiredCode, step, touch }) => {
    const dispatch = (type, code) => window.dispatchEvent(
      new KeyboardEvent(type, { bubbles: true, cancelable: true, code })
    );
    const held = new Set();
    const hold = (code, active) => {
      if (active && !held.has(code)) { held.add(code); dispatch('keydown', code); }
      else if (!active && held.has(code)) { held.delete(code); dispatch('keyup', code); }
    };
    let pointerSequence = 800;
    let touchMoving = false;
    const touchAction = (code) => ({
      KeyE: 'trace', KeyF: 'secure', KeyJ: 'attack', KeyK: 'reflect', KeyQ: 'purge', Space: 'dash'
    })[code];
    const tapKey = (code) => {
      if (!touch) { dispatch('keydown', code); dispatch('keyup', code); return; }
      const button = document.querySelector(`[data-touch-action="${touchAction(code)}"]`);
      pointerSequence += 1;
      button.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, isPrimary: true, pointerId: pointerSequence
      }));
      button.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true, isPrimary: true, pointerId: pointerSequence
      }));
    };
    const moveTouch = (x, y, active = true) => {
      if (!touch) return;
      const stick = document.querySelector('[data-touch-stick]');
      const rect = stick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      if (active && !touchMoving) {
        touchMoving = true;
        stick.dispatchEvent(new PointerEvent('pointerdown', {
          bubbles: true, clientX: centerX, clientY: centerY, isPrimary: true, pointerId: 790
        }));
      }
      stick.dispatchEvent(new PointerEvent(active ? 'pointermove' : 'pointerup', {
        bubbles: true, clientX: centerX + x * 40, clientY: centerY + y * 40,
        isPrimary: true, pointerId: 790
      }));
      if (!active) touchMoving = false;
    };
    const canvas = document.querySelector('[data-reboot-canvas]');
    const deadline = performance.now() + 90_000;
    let beat = 0;
    try {
      while (performance.now() < deadline) {
        const debug = window.__ethicsReboot.getSceneDebugState();
        const finished = fightKind === 'chapter-one'
          ? debug.story.phase !== 'first-arena'
          : fightKind === 'campaign'
            ? Number(canvas.dataset.campaignStep) >= step
            : canvas.dataset.testimonyPhase !== 'combat';
        if (finished) return;
        const enemies = fightKind === 'chapter-one' ? debug.encounter.enemies : debug.enemies;
        const player = fightKind === 'chapter-one'
          ? { x: debug.combat.player.x, z: debug.combat.player.z }
          : { x: debug.player.position.x, z: debug.player.position.y };
        const target = enemies
          .filter((enemy) => enemy.phase !== 'defeat')
          .toSorted((left, right) => (
            Math.hypot(left.position.x - player.x, left.position.z - player.z)
            - Math.hypot(right.position.x - player.x, right.position.z - player.z)
          ))[0];
        if (target) {
          if (fightKind === 'campaign' && canvas.dataset.campaignInteractionStatus !== 'resolved') {
            moveTouch(0, 0, false);
            tapKey(requiredCode);
            beat += 1;
            await new Promise((resolve) => setTimeout(resolve, 16));
            continue;
          }
          const dx = target.position.x - player.x;
          const dz = target.position.z - player.z;
          const far = Math.hypot(dx, dz) > 1.25;
          if (touch) {
            moveTouch(far ? Math.sign(dx) : 0, far ? Math.sign(dz) : 0, far);
          } else {
            hold('KeyD', far && dx > 0.35);
            hold('KeyA', far && dx < -0.35);
            hold('KeyS', far && dz > 0.35);
            hold('KeyW', far && dz < -0.35);
          }
          tapKey('KeyJ');
          if (beat % 18 === 4) tapKey(requiredCode);
          if (beat % 28 === 10) tapKey('KeyK');
          if (beat % 31 === 13) tapKey('KeyE');
        }
        beat += 1;
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
      const debug = window.__ethicsReboot.getSceneDebugState();
      throw new Error(`${fightKind} 전투 제한 시간을 넘었습니다: ${JSON.stringify({
        campaignInteractionStatus: canvas.dataset.campaignInteractionStatus,
        campaignStep: canvas.dataset.campaignStep,
        enemies: fightKind === 'chapter-one' ? debug.encounter.enemies : debug.enemies,
        player: fightKind === 'chapter-one' ? debug.combat.player : debug.player,
        testimonyPhase: canvas.dataset.testimonyPhase,
        testimonyZone: canvas.dataset.testimonyZone
      })}`);
    } finally {
      moveTouch(0, 0, false);
      for (const code of [...held]) dispatch('keyup', code);
    }
  }, { fightKind: kind, requiredCode: verbCode, step: targetStep, touch: inputMode === 'touch' });
}

async function startChapterReport(page, chapter) {
  chapterStartedAt.set(chapter, Date.now());
  await waitForDataset(page, 'campaignChapter', chapter);
  await waitForDataset(page, 'characters', 'ready');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForDataset(page, 'campaignChapter', chapter);
  await waitForDataset(page, 'characters', 'ready');
}

async function finishChapterReport(page, chapter) {
  const canvasData = await page.locator('[data-reboot-canvas]').evaluate((canvas) => ({
    checkpoint: JSON.parse(localStorage.getItem('h17.null.save.v5')).chapterProgress.checkpoint,
    drawCalls: Number(canvas.dataset.drawCalls),
    p95FrameMs: Number(canvas.dataset.p95FrameMs),
    triangles: Number(canvas.dataset.triangles)
  }));
  const screenshotPath = `${evidenceDirectory}/chapter-${chapter}-${inputMode}-result.png`;
  await page.screenshot({ animations: 'disabled', path: screenshotPath });
  chapterReports.push({
    ...canvasData,
    chapter,
    elapsedSeconds: Math.round((Date.now() - chapterStartedAt.get(chapter)) / 100) / 10,
    inputMode,
    screenshotPath: relativeEvidencePath(screenshotPath)
  });
}

async function completeChapterOne(page) {
  await startChapterReport(page, 1);
  await moveUntil(page, () => window.__ethicsReboot.getSceneDebugState().routeSegmentId === 'first-arena');
  await page.waitForFunction(() => window.__ethicsReboot.getSceneDebugState().story.phase === 'first-arena');
  await fightNearest(page, { kind: 'chapter-one', verbCode: 'KeyK' });
  await moveUntil(page, () => {
    const debug = window.__ethicsReboot.getSceneDebugState();
    return debug.routeSegmentId === 'memory-backup-decision' && debug.combat.player.z <= -52.5;
  });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const phase = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState().story.phase);
    if (phase !== 'memory-decision') break;
    await tap(page, 'KeyE');
    await page.waitForTimeout(240);
  }
  await page.waitForFunction(() => window.__ethicsReboot.getSceneDebugState().story.phase === 'memory-traced');
  await page.waitForFunction(() => window.__ethicsReboot.getSceneDebugState().story.phase === 'memory-secure-ready');
  await tap(page, 'KeyF');
  await page.waitForFunction(() => window.__ethicsReboot.getSceneDebugState().story.phase === 'pursuit');
  await moveUntil(page, () => window.__ethicsReboot.getSceneDebugState().routeSegmentId === 'gym-boss-arena');
  const bossSequence = [
    ['KeyK', '210'], ['KeyK', '180'], ['KeyE', '150'], ['KeyE', '120'],
    ['KeyJ', '80'], ['KeyJ', '40'], ['KeyJ', '0']
  ];
  for (const [code, hp] of bossSequence) {
    await tap(page, code);
    await waitForDataset(page, 'bossHp', hp);
  }
  await page.locator('[data-patch-id="reflect-arc"]').click();
  await waitForDataset(page, 'savedChapter', 2);
  await finishChapterReport(page, 1);
  await page.locator('[data-campaign-continue]').click();
}

async function completeCampaignChapter(page, chapter, verbs) {
  await startChapterReport(page, chapter);
  for (const [waveIndex, verbCode] of verbs.entries()) {
    await fightNearest(page, { kind: 'campaign', targetStep: waveIndex + 1, verbCode });
  }
  await waitForDataset(page, 'campaignExpectedAction', 'decision');
  await tap(page, 'KeyF');
  await waitForDataset(page, 'campaignCompleted', 'true');
  await finishChapterReport(page, chapter);
  await page.locator('[data-campaign-continue]').click();
}

async function completeTestimonyArchive(page) {
  await startChapterReport(page, 5);
  const clues = ['KeyE', 'KeyK', 'KeyE'];
  for (let zone = 0; zone < 4; zone += 1) {
    await fightNearest(page, { kind: 'archive', verbCode: zone === 1 ? 'KeyK' : 'KeyE' });
    if (zone < clues.length) {
      await waitForDataset(page, 'testimonyPhase', 'clue');
      await tap(page, clues[zone]);
      await waitForDataset(page, 'campaignStep', zone + 1);
    }
  }
  await waitForDataset(page, 'testimonyPhase', 'decision');
  await tap(page, 'KeyF');
  await waitForDataset(page, 'campaignCompleted', 'true');
  await finishChapterReport(page, 5);
  await page.locator('[data-campaign-continue]').click();
}

async function completeFinalBroadcast(page) {
  await startChapterReport(page, 6);
  const sequence = [
    ['reflect-shield', 'KeyK'], ['trace-consent', 'KeyE'],
    ['dash-relay', 'Space'], ['signal-core', 'KeyJ']
  ];
  const canvas = page.locator('[data-reboot-canvas]');
  for (const [phase, code] of sequence) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const state = await canvas.evaluate((element) => ({
        phase: element.dataset.protocolPhase,
        phaseTick: Number(element.dataset.protocolPhaseTick),
        pulse: element.dataset.protocolPulse,
        ready: element.dataset.finalBroadcastZoneReady === 'true',
        status: element.dataset.protocolStatus
      }));
      if (state.phase !== phase || state.status === 'victory') break;
      if (inputMode === 'touch') await setTouchMovement(page, 0, -1, !state.ready);
      else if (state.ready) await page.keyboard.up('KeyW');
      else await page.keyboard.down('KeyW');
      if (state.pulse === 'windup') await tap(page, 'KeyK');
      else if (state.ready && state.phaseTick >= 18) await tap(page, code);
      await page.waitForTimeout(60);
    }
    if (inputMode === 'touch') await setTouchMovement(page, 0, 0, false);
    else await page.keyboard.up('KeyW');
    const unresolved = await canvas.evaluate((element, expectedPhase) => (
      element.dataset.protocolPhase === expectedPhase && element.dataset.protocolStatus !== 'victory'
    ), phase);
    if (unresolved) throw new Error(`${phase} 방송 단계 제한 시간을 넘었습니다.`);
  }
  await waitForDataset(page, 'protocolStatus', 'victory');
  await tap(page, 'KeyF');
  await page.waitForFunction(() => Boolean(document.querySelector('[data-reboot-canvas]')?.dataset.campaignEnding));
  await finishChapterReport(page, 6);
}

await mkdir(evidenceDirectory, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const context = await browser.newContext({
  colorScheme: 'dark', hasTouch: inputMode === 'touch', locale: 'ko-KR', reducedMotion: 'reduce',
  serviceWorkers: 'block', viewport: inputMode === 'touch' ? { height: 844, width: 390 } : { height: 900, width: 1440 }
});
const page = await context.newPage();
const consoleErrors = [];
const failedResponses = [];
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', (error) => consoleErrors.push(error.message));
page.on('response', (response) => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });
const seedBytes = startingChapter === 1 ? null : serializeSave(setChapterCheckpoint(
  createInitialRebootState({ motion: 'reduced', quality: 'low', sound: false }),
  startingChapter,
  `chapter-${startingChapter}:start`
));
await page.addInitScript(({ bytes, key }) => {
  if (sessionStorage.getItem('h17.fullRunInitialized') !== 'true') {
    localStorage.clear();
    sessionStorage.clear();
    if (bytes) localStorage.setItem(key, bytes);
    sessionStorage.setItem('h17.fullRunInitialized', 'true');
  }
  window.__ETHICS_TEST_HOOK__ = true;
}, { bytes: seedBytes, key: V5_SAVE_KEY });

try {
  await page.goto(new URL(`reboot.html?${query}`, baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  if (startingChapter <= 1) await completeChapterOne(page);
  if (startingChapter <= 2) await completeCampaignChapter(page, 2, ['KeyK', 'KeyE', 'KeyJ']);
  if (startingChapter <= 3) await completeCampaignChapter(page, 3, ['KeyE', 'KeyE', 'KeyJ']);
  if (startingChapter <= 4) await completeCampaignChapter(page, 4, ['KeyK', 'KeyE', 'KeyJ']);
  if (startingChapter <= 5) await completeTestimonyArchive(page);
  if (startingChapter <= 6) await completeFinalBroadcast(page);
  const finalSave = await page.evaluate(() => JSON.parse(localStorage.getItem('h17.null.save.v5')));
  assert(finalSave.chapterProgress.checkpoint.startsWith('chapter-6:resolved-'), '6장 결말 저장이 없습니다.');
  assert(consoleErrors.length === 0, `콘솔 오류:\n${consoleErrors.join('\n')}`);
  assert(failedResponses.length === 0, `누락 응답:\n${failedResponses.join('\n')}`);
  const touch = inputMode === 'touch' ? await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('[data-touch-action]')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { action: button.dataset.touchAction, height: rect.height, width: rect.width };
    });
    return { buttons, debug: window.__ethicsReboot.getTouchDebugState() };
  }) : null;
  const report = {
    baseUrl, chapterReports, consoleErrors, failedResponses,
    finalCheckpoint: finalSave.chapterProgress.checkpoint, inputMode, touch
  };
  await writeFile(`${evidenceDirectory}/${inputMode}-playthrough-report.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await context.close();
  await browser.close();
}
