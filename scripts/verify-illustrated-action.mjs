import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ILLUSTRATED_QA_URL ?? 'http://127.0.0.1:8899/illustrated.html?testHook=1';
const evidenceDir = path.resolve('.omo/evidence/illustrated-action');
const browser = await chromium.launch({ headless: true });

async function freshPage(context) {
  const page = await context.newPage();
  const errors = [];
  const failedResponses = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('illustrated-qa-ready')) return;
    localStorage.clear();
    sessionStorage.setItem('illustrated-qa-ready', '1');
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('[data-action-canvas]').waitFor({ state: 'visible' });
  return { page, errors, failedResponses };
}

async function tapKey(page, code, hold = 80) {
  await page.keyboard.down(code);
  await page.waitForTimeout(hold);
  await page.keyboard.up(code);
  await page.waitForTimeout(190);
}

async function moveWithKey(page, targetX) {
  await page.keyboard.down('KeyD');
  await page.waitForFunction((target) => Number(document.querySelector('[data-illustrated-game]').dataset.playerX) >= target, targetX, { timeout: 20000 });
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(140);
}

async function pointerHold(page, selector, milliseconds, pointerId) {
  await page.dispatchEvent(selector, 'pointerdown', {
    pointerId,
    pointerType: 'touch',
    isPrimary: true,
    bubbles: true,
    buttons: 1
  });
  await page.waitForTimeout(milliseconds);
  await page.dispatchEvent(selector, 'pointerup', {
    pointerId,
    pointerType: 'touch',
    isPrimary: true,
    bubbles: true,
    buttons: 0
  });
  await page.waitForTimeout(160);
}

async function moveWithTouch(page, targetX, pointerId) {
  const selector = '[data-control="right"]';
  await page.dispatchEvent(selector, 'pointerdown', {
    pointerId,
    pointerType: 'touch',
    isPrimary: true,
    bubbles: true,
    buttons: 1
  });
  await page.waitForFunction((target) => Number(document.querySelector('[data-illustrated-game]').dataset.playerX) >= target, targetX, { timeout: 20000 });
  await page.dispatchEvent(selector, 'pointerup', {
    pointerId,
    pointerType: 'touch',
    isPrimary: true,
    bubbles: true,
    buttons: 0
  });
  await page.waitForTimeout(160);
}

async function runDesktop() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const { page, errors, failedResponses } = await freshPage(context);
  for (let step = 0; step < 3; step += 1) await tapKey(page, 'Enter');
  await page.waitForFunction(() => document.querySelector('[data-illustrated-game]').dataset.gamePhase === 'playing');
  await page.locator('[data-game-help]').click();
  await page.locator('[data-help-dialog]').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.locator('[data-help-dialog]').waitFor({ state: 'hidden' });

  const encounters = [
    { enemy: 820, evidence: 1080 },
    { enemy: 1960, evidence: 2220 },
    { enemy: 3100, evidence: 3360 },
    { enemy: 4240, evidence: 4500 }
  ];
  for (let index = 0; index < encounters.length; index += 1) {
    const encounter = encounters[index];
    await moveWithKey(page, encounter.enemy);
    await tapKey(page, 'KeyJ');
    await tapKey(page, 'KeyJ');
    await moveWithKey(page, encounter.evidence);
    await tapKey(page, 'KeyE');
    await page.waitForFunction((count) => Number(document.querySelector('[data-illustrated-game]').dataset.evidenceCount) >= count, index + 1);
    if (index === 1) await page.screenshot({ path: path.join(evidenceDir, 'desktop-action.png') });
  }

  await moveWithKey(page, 5500);
  for (let hit = 0; hit < 5; hit += 1) await tapKey(page, 'KeyJ', 70);
  await page.waitForFunction(() => Number(document.querySelector('[data-illustrated-game]').dataset.bossHp) === 0);
  await tapKey(page, 'KeyE');
  await page.waitForFunction(() => document.querySelector('[data-illustrated-game]').dataset.gamePhase === 'complete');
  await page.screenshot({ path: path.join(evidenceDir, 'desktop-complete.png'), fullPage: true });
  const save = await page.evaluate(() => window.__illustratedAction.getSave());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('[data-illustrated-game]').dataset.gamePhase === 'complete');

  const report = {
    viewport: await page.viewportSize(),
    phase: await page.locator('[data-illustrated-game]').getAttribute('data-game-phase'),
    evidenceCount: Number(await page.locator('[data-illustrated-game]').getAttribute('data-evidence-count')),
    state: await page.evaluate(() => window.__illustratedAction.getState()),
    save,
    errors,
    failedResponses
  };
  assert.equal(report.phase, 'complete');
  assert.equal(report.evidenceCount, 4);
  assert.equal(report.state.outcome, 'protected');
  assert.deepEqual(Object.keys(save).sort(), ['checkpointX', 'completed', 'evidenceIds', 'version']);
  assert.equal(save.completed, true);
  assert.deepEqual(errors, []);
  assert.deepEqual(failedResponses, []);
  await writeFile(path.join(evidenceDir, 'desktop-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await context.close();
  return report;
}

async function runMobile() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
    reducedMotion: 'reduce'
  });
  const { page, errors, failedResponses } = await freshPage(context);
  for (let step = 0; step < 3; step += 1) {
    const box = await page.locator('[data-story-next]').boundingBox();
    assert.ok(box);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(180);
  }
  await page.waitForFunction(() => document.querySelector('[data-illustrated-game]').dataset.gamePhase === 'playing');
  await moveWithTouch(page, 820, 41);
  await pointerHold(page, '[data-control="attack"]', 90, 42);
  await pointerHold(page, '[data-control="attack"]', 90, 43);
  await moveWithTouch(page, 1080, 44);
  await pointerHold(page, '[data-control="trace"]', 90, 45);
  await page.waitForFunction(() => Number(document.querySelector('[data-illustrated-game]').dataset.evidenceCount) >= 1);
  const save = await page.evaluate(() => window.__illustratedAction.getSave());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('[data-illustrated-game]').dataset.gamePhase === 'playing');
  await page.waitForFunction(() => Number(document.querySelector('[data-illustrated-game]').dataset.evidenceCount) >= 1);

  const buttonBoxes = await page.locator('[data-control]').evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { control: button.dataset.control, width: box.width, height: box.height };
  }));
  const layout = await page.evaluate(() => ({
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    touchVisible: getComputedStyle(document.querySelector('[data-touch-controls]')).display !== 'none'
  }));
  await page.screenshot({ path: path.join(evidenceDir, 'mobile-action.png'), fullPage: true });

  const report = {
    viewport: await page.viewportSize(),
    phase: await page.locator('[data-illustrated-game]').getAttribute('data-game-phase'),
    evidenceCount: Number(await page.locator('[data-illustrated-game]').getAttribute('data-evidence-count')),
    state: await page.evaluate(() => window.__illustratedAction.getState()),
    save,
    promptKey: await page.locator('[data-objective-prompt] kbd').textContent(),
    buttonBoxes,
    layout,
    errors,
    failedResponses
  };
  assert.equal(report.phase, 'playing');
  assert.ok(report.evidenceCount >= 1);
  assert.deepEqual(Object.keys(save).sort(), ['checkpointX', 'completed', 'evidenceIds', 'version']);
  assert.equal(save.checkpointX, 930);
  assert.equal(report.state.player.x, 930);
  assert.notEqual(report.promptKey, 'D');
  assert.ok(buttonBoxes.every(({ width, height }) => width >= 44 && height >= 44));
  assert.ok(layout.scrollWidth <= layout.innerWidth);
  assert.equal(layout.touchVisible, true);
  assert.deepEqual(errors, []);
  assert.deepEqual(failedResponses, []);
  await writeFile(path.join(evidenceDir, 'mobile-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await context.close();
  return report;
}

try {
  await mkdir(evidenceDir, { recursive: true });
  const desktop = await runDesktop();
  const mobile = await runMobile();
  console.log(JSON.stringify({ desktop, mobile }, null, 2));
} finally {
  await browser.close();
}
