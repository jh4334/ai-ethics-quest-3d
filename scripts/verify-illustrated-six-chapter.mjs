import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const baseUrl = process.env.ILLUSTRATED_QA_URL ?? 'http://127.0.0.1:8899/?testHook=1';
const evidenceDir = path.resolve('.omo/evidence/h17-2d-campaign');
const referencePath = path.resolve('docs/design/concepts/gameplay-screen-v3.webp');
const browser = await chromium.launch({ headless: true });

async function press(page, code) {
  await page.keyboard.down(code);
  await page.waitForTimeout(80);
  await page.keyboard.up(code);
  await page.waitForTimeout(230);
}

async function touch(page, control, pointerId) {
  const selector = `[data-control="${control}"]`;
  await page.dispatchEvent(selector, 'pointerdown', {
    pointerId,
    pointerType: 'touch',
    isPrimary: true,
    bubbles: true,
    buttons: 1
  });
  await page.waitForTimeout(80);
  await page.dispatchEvent(selector, 'pointerup', {
    pointerId,
    pointerType: 'touch',
    isPrimary: true,
    bubbles: true,
    buttons: 0
  });
  await page.waitForTimeout(230);
}

async function action(page, profile, name, pointerId) {
  const keys = { attack: 'KeyJ', trace: 'KeyE', jump: 'Space' };
  if (profile.touch) await touch(page, name, pointerId);
  else await press(page, keys[name]);
}

async function teleport(page, selector, offset = -64) {
  await page.evaluate(({ selector, offset }) => {
    const state = window.__illustratedAction.getState();
    const target = selector === 'boss'
      ? state.boss
      : state[selector.collection][selector.index];
    state.player.x = target.x + offset;
    state.player.facing = offset <= 0 ? 1 : -1;
    state.player.invulnerable = 1;
  }, { selector, offset });
  await page.waitForTimeout(80);
}

async function completeChapter(page, profile, chapterNumber, pointerSeed) {
  const start = Date.now();
  await page.waitForFunction(() => document.querySelector('[data-illustrated-game]').dataset.gamePhase === 'playing');
  for (let index = 0; index < 2; index += 1) {
    await teleport(page, { collection: 'enemies', index });
    await action(page, profile, 'attack', pointerSeed + index * 5);
    await action(page, profile, 'attack', pointerSeed + index * 5 + 1);
    const guardian = await page.evaluate((targetIndex) => window.__illustratedAction.getState().enemies[targetIndex], index);
    assert.equal(guardian.defeated, true, `chapter ${chapterNumber} guardian ${index + 1} remained at ${guardian.hp} HP`);
    await teleport(page, { collection: 'evidence', index }, 0);
    await action(page, profile, 'trace', pointerSeed + index * 5 + 2);
    const traceState = await page.evaluate((targetIndex) => {
      const state = window.__illustratedAction.getState();
      return { collected: state.evidence[targetIndex].collected, event: state.lastEvent, message: state.message };
    }, index);
    assert.equal(traceState.collected, true, `chapter ${chapterNumber} evidence ${index + 1} failed: ${traceState.event} / ${traceState.message}`);
  }

  await teleport(page, 'boss');
  for (let hit = 0; hit < 7; hit += 1) {
    if (Number(await page.locator('[data-illustrated-game]').getAttribute('data-boss-hp')) === 0) break;
    await action(page, profile, 'attack', pointerSeed + 20 + hit);
  }
  await page.waitForFunction(() => Number(document.querySelector('[data-illustrated-game]').dataset.bossHp) === 0);
  await teleport(page, 'boss', -70);
  await action(page, profile, 'trace', pointerSeed + 30);
  await page.waitForFunction(() => document.querySelector('[data-illustrated-game]').dataset.gamePhase === 'choice');
  await page.locator('[data-choice-options] button').first().click();
  await page.waitForFunction(() => document.querySelector('[data-illustrated-game]').dataset.gamePhase === 'result');
  const result = {
    chapter: chapterNumber,
    evidence: Number(await page.locator('[data-illustrated-game]').getAttribute('data-evidence-count')),
    decision: await page.locator('[data-result-title]').textContent(),
    elapsedMs: Date.now() - start
  };
  if (chapterNumber === 6) await page.screenshot({ path: path.join(evidenceDir, `${profile.id}-chapter-6-result.png`), fullPage: true });
  await page.locator('[data-next-chapter]').click();
  return result;
}

async function runProfile(profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    hasTouch: profile.touch,
    isMobile: profile.touch,
    deviceScaleFactor: profile.touch ? 2 : 1,
    reducedMotion: 'reduce',
    locale: 'ko-KR'
  });
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
    if (sessionStorage.getItem('h17-2d-qa-ready')) return;
    localStorage.clear();
    sessionStorage.setItem('h17-2d-qa-ready', '1');
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('[data-action-canvas]').waitFor({ state: 'visible' });
  assert.equal(new URL(page.url()).pathname, '/');
  assert.equal(await page.locator('canvas').count(), 1);
  assert.equal(await page.locator('script[src*="reboot"], script[src="/src/main.js"]').count(), 0);
  await page.screenshot({ path: path.join(evidenceDir, `${profile.id}-title.png`), fullPage: true });
  await page.locator('[data-new-game]').click();
  await page.locator('[data-story-next]').click();
  await page.locator('[data-story-next]').click();
  await page.waitForFunction(() => document.querySelector('[data-illustrated-game]').dataset.gamePhase === 'playing');

  const xBefore = Number(await page.locator('[data-illustrated-game]').getAttribute('data-player-x'));
  if (profile.touch) {
    await page.dispatchEvent('[data-control="right"]', 'pointerdown', { pointerId: 10, pointerType: 'touch', bubbles: true, buttons: 1 });
    await page.waitForTimeout(420);
    await page.dispatchEvent('[data-control="right"]', 'pointerup', { pointerId: 10, pointerType: 'touch', bubbles: true, buttons: 0 });
  } else {
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(420);
    await page.keyboard.up('KeyD');
  }
  const xAfter = Number(await page.locator('[data-illustrated-game]').getAttribute('data-player-x'));
  assert.ok(xAfter > xBefore + 60);
  await action(page, profile, 'jump', 11);
  await page.screenshot({ path: path.join(evidenceDir, `${profile.id}-chapter-1.png`), fullPage: true });

  const chapters = [];
  for (let chapterNumber = 1; chapterNumber <= 6; chapterNumber += 1) {
    chapters.push(await completeChapter(page, profile, chapterNumber, 100 + chapterNumber * 50));
    if (chapterNumber < 6) {
      await page.locator('[data-story-next]').click();
      await page.locator('[data-story-next]').click();
    }
  }

  await page.waitForFunction(() => document.querySelector('[data-illustrated-game]').dataset.gamePhase === 'complete');
  await page.screenshot({ path: path.join(evidenceDir, `${profile.id}-ending.png`), fullPage: true });
  const saveBeforeReload = await page.evaluate(() => window.__illustratedAction.getSave());
  const reportBeforeReload = await page.evaluate(() => window.__illustratedAction.getReport());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-continue-game]').click();
  await page.waitForFunction(() => document.querySelector('[data-illustrated-game]').dataset.gamePhase === 'complete');

  const layout = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    touchVisible: getComputedStyle(document.querySelector('[data-touch-controls]')).display !== 'none',
    buttons: [...document.querySelectorAll('button')].filter((button) => !button.hidden && getComputedStyle(button).display !== 'none').map((button) => {
      const box = button.getBoundingClientRect();
      return { text: button.textContent.trim(), width: Math.round(box.width), height: Math.round(box.height) };
    })
  }));
  assert.equal(saveBeforeReload.completed, true);
  assert.equal(saveBeforeReload.version, 3);
  assert.equal(Object.keys(saveBeforeReload.decisions).length, 6);
  assert.equal(reportBeforeReload.chapters.length, 6);
  assert.equal(reportBeforeReload.chapters.every(({ decision }) => decision !== '아직 결정하지 않음'), true);
  assert.equal(layout.scrollWidth <= layout.width, true);
  if (profile.touch) {
    assert.equal(layout.touchVisible, true);
    assert.equal(layout.buttons.filter(({ width, height }) => width > 0 && height > 0).every(({ width, height }) => width >= 44 && height >= 44), true);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failedResponses, []);
  const result = { profile, chapters, saveBeforeReload, reportBeforeReload, layout, errors, failedResponses };
  await writeFile(path.join(evidenceDir, `${profile.id}-report.json`), `${JSON.stringify(result, null, 2)}\n`);
  await context.close();
  return result;
}

async function makeComparison() {
  const reference = await sharp(referencePath).resize(1440, 900, { fit: 'cover' }).png().toBuffer();
  const implementation = await sharp(path.join(evidenceDir, 'desktop-1440x900-chapter-1.png')).resize(1440, 900, { fit: 'cover' }).png().toBuffer();
  await sharp({ create: { width: 2880, height: 900, channels: 4, background: '#050918' } })
    .composite([{ input: reference, left: 0, top: 0 }, { input: implementation, left: 1440, top: 0 }])
    .png()
    .toFile(path.join(evidenceDir, 'reference-vs-desktop-chapter-1.png'));
}

try {
  await mkdir(evidenceDir, { recursive: true });
  const desktop = await runProfile({ id: 'desktop-1440x900', viewport: { width: 1440, height: 900 }, touch: false });
  const mobile = await runProfile({ id: 'mobile-390x844', viewport: { width: 390, height: 844 }, touch: true });
  await makeComparison();
  const summary = {
    baseUrl,
    desktopChapters: desktop.chapters.length,
    mobileChapters: mobile.chapters.length,
    consoleErrors: desktop.errors.length + mobile.errors.length,
    failedResponses: desktop.failedResponses.length + mobile.failedResponses.length,
    createdAt: new Date().toISOString()
  };
  await writeFile(path.join(evidenceDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}
