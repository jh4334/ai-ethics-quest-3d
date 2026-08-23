import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const baseUrl = process.env.ILLUSTRATED_QA_URL ?? 'http://127.0.0.1:8899/illustrated.html?testHook=1';
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

async function moveRight(page, profile, duration, pointerId) {
  if (profile.touch) {
    await page.dispatchEvent('[data-control="right"]', 'pointerdown', { pointerId, pointerType: 'touch', bubbles: true, buttons: 1 });
    await page.waitForTimeout(duration);
    await page.dispatchEvent('[data-control="right"]', 'pointerup', { pointerId, pointerType: 'touch', bubbles: true, buttons: 0 });
    return;
  }
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(duration);
  await page.keyboard.up('KeyD');
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

async function advanceIntro(page) {
  for (let step = 0; step < 6; step += 1) {
    const phase = await page.locator('[data-illustrated-game]').getAttribute('data-game-phase');
    if (phase === 'playing') return;
    await page.locator('[data-story-next]').click();
  }
  throw new Error('chapter intro did not enter playing phase');
}

async function clearChapterEnemies(page, profile, chapterNumber, pointerSeed) {
  const enemyCount = await page.evaluate(() => window.__illustratedAction.getState().enemies.length);
  for (let index = 0; index < enemyCount; index += 1) {
    await teleport(page, { collection: 'enemies', index });
    await action(page, profile, 'trace', pointerSeed + index * 10);
  }
  for (let index = 0; index < enemyCount; index += 1) {
    await teleport(page, { collection: 'enemies', index });
    for (let hit = 0; hit < 4; hit += 1) {
      const defeated = await page.evaluate((targetIndex) => window.__illustratedAction.getState().enemies[targetIndex].defeated, index);
      if (defeated) break;
      await action(page, profile, 'attack', pointerSeed + index * 10 + hit + 1);
    }
    const guardian = await page.evaluate((targetIndex) => window.__illustratedAction.getState().enemies[targetIndex], index);
    assert.equal(guardian.defeated, true, `chapter ${chapterNumber} guardian ${index + 1} remained at ${guardian.hp} HP`);
  }
}

async function collectChapterEvidence(page, profile, chapterNumber, pointerSeed) {
  const evidenceCount = await page.evaluate(() => window.__illustratedAction.getState().evidence.length);
  for (let index = 0; index < evidenceCount; index += 1) {
    await teleport(page, { collection: 'evidence', index }, 0);
    await action(page, profile, 'trace', pointerSeed + index);
    const traceState = await page.evaluate((targetIndex) => {
      const state = window.__illustratedAction.getState();
      return { collected: state.evidence[targetIndex].collected, event: state.lastEvent, message: state.message };
    }, index);
    assert.equal(traceState.collected, true, `chapter ${chapterNumber} evidence ${index + 1} failed: ${traceState.event} / ${traceState.message}`);
  }
}

async function clearSignalBoss(page, profile, chapterNumber, pointerSeed) {
  await teleport(page, 'boss');
  for (let step = 0; step < 18; step += 1) {
    const boss = await page.evaluate(() => {
      const { hp, traced, staggered, phaseIndex } = window.__illustratedAction.getState().boss;
      return { hp, traced, staggered, phaseIndex };
    });
    if (boss.hp === 0 || boss.staggered) return;
    await action(page, profile, boss.traced ? 'attack' : 'trace', pointerSeed + step);
  }
  throw new Error(`chapter ${chapterNumber} SIGNAL boss did not stagger`);
}

async function clearApprovalBoss(page, profile, pointerSeed) {
  await teleport(page, 'boss', -360);
  await page.evaluate(() => { window.__illustratedAction.getState().projectiles.length = 0; });
  for (let hit = 0; hit < 12; hit += 1) {
    const hp = await page.evaluate(() => window.__illustratedAction.getState().boss.hp);
    if (hp === 0) return;
    await page.evaluate(() => {
      const state = window.__illustratedAction.getState();
      state.projectiles.length = 0;
      state.player.x = state.boss.x - 360;
      state.player.y = state.world.groundY;
      state.player.invulnerable = 10;
      state.boss.attackCooldown = 0;
    });
    await page.waitForFunction(() => window.__illustratedAction.getState().projectiles.some(({ active, kind }) => active && kind === 'approval-stamp'));
    await page.evaluate(() => {
      const state = window.__illustratedAction.getState();
      const stamp = state.projectiles.find(({ active, kind }) => active && kind === 'approval-stamp');
      state.player.x = stamp.x + (stamp.vx < 0 ? -90 : 90);
      state.player.y = state.world.groundY;
      state.player.facing = stamp.vx < 0 ? 1 : -1;
      state.player.invulnerable = 1;
    });
    await action(page, profile, 'trace', pointerSeed + hit * 2);
    await action(page, profile, 'attack', pointerSeed + hit * 2 + 1);
  }
  throw new Error('chapter 5 reviewed approval boss did not stagger');
}

async function completeChapter(page, profile, chapterNumber, pointerSeed) {
  const start = Date.now();
  await page.waitForFunction(() => document.querySelector('[data-illustrated-game]').dataset.gamePhase === 'playing');
  await moveRight(page, profile, 2800, pointerSeed);
  const scroll = await page.evaluate(() => {
    const game = document.querySelector('[data-illustrated-game]');
    return {
      playerX: Number(game.dataset.playerX),
      cameraX: Number(game.dataset.cameraX),
      playerScreenX: Number(game.dataset.playerScreenX)
    };
  });
  const trackingX = profile.touch ? 640 : 360;
  assert.ok(scroll.playerX > 1000, `chapter ${chapterNumber} did not traverse the world: ${scroll.playerX}`);
  assert.ok(scroll.cameraX > (profile.touch ? 350 : 650), `chapter ${chapterNumber} camera did not follow: ${scroll.cameraX}`);
  assert.ok(scroll.playerScreenX >= trackingX - 20 && scroll.playerScreenX <= trackingX + 20, `chapter ${chapterNumber} player left tracking lane: ${scroll.playerScreenX}`);
  await page.screenshot({ path: path.join(evidenceDir, `${profile.id}-chapter-${chapterNumber}-scroll.png`) });
  await clearChapterEnemies(page, profile, chapterNumber, pointerSeed);
  await collectChapterEvidence(page, profile, chapterNumber, pointerSeed + 80);
  if (chapterNumber === 5) await clearApprovalBoss(page, profile, pointerSeed + 100);
  else await clearSignalBoss(page, profile, chapterNumber, pointerSeed + 100);
  await page.waitForFunction(() => Number(document.querySelector('[data-illustrated-game]').dataset.bossHp) === 0);
  await teleport(page, 'boss', -70);
  await action(page, profile, 'trace', pointerSeed + 140);
  await page.waitForFunction(() => document.querySelector('[data-illustrated-game]').dataset.gamePhase === 'choice');
  await page.locator('[data-choice-options] button').nth(profile.choiceIndex).click();
  await page.waitForFunction(() => document.querySelector('[data-illustrated-game]').dataset.gamePhase === 'result');
  const result = {
    chapter: chapterNumber,
    evidence: Number(await page.locator('[data-illustrated-game]').getAttribute('data-evidence-count')),
    decision: await page.locator('[data-result-title]').textContent(),
    scroll,
    elapsedMs: Date.now() - start
  };
  if (chapterNumber === 6) await page.screenshot({ path: path.join(evidenceDir, `${profile.id}-chapter-6-result.png`) });
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
  assert.equal(new URL(page.url()).pathname, '/illustrated.html');
  assert.equal(await page.locator('canvas').count(), 1);
  assert.equal(await page.locator('script[src*="reboot"], script[src="/src/main.js"]').count(), 0);
  await page.screenshot({ path: path.join(evidenceDir, `${profile.id}-title.png`) });
  await page.locator('[data-new-game]').click();
  await advanceIntro(page);

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
  await page.screenshot({ path: path.join(evidenceDir, `${profile.id}-chapter-1.png`) });

  const chapters = [];
  for (let chapterNumber = 1; chapterNumber <= 6; chapterNumber += 1) {
    chapters.push(await completeChapter(page, profile, chapterNumber, 100 + chapterNumber * 50));
    if (chapterNumber < 6) await advanceIntro(page);
  }

  await page.waitForFunction(() => document.querySelector('[data-illustrated-game]').dataset.gamePhase === 'complete');
  await page.screenshot({ path: path.join(evidenceDir, `${profile.id}-ending.png`) });
  const saveBeforeReload = await page.evaluate(() => window.__illustratedAction.getSave());
  const reportBeforeReload = await page.evaluate(() => window.__illustratedAction.getReport());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-continue-game]').click();
  await page.waitForFunction(() => document.querySelector('[data-illustrated-game]').dataset.gamePhase === 'complete');

  const layout = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    touchVisible: getComputedStyle(document.querySelector('[data-touch-controls]')).display !== 'none',
    endingRowsVisible: [...document.querySelectorAll('[data-report-list] li')].every((row) => {
      const rowBox = row.getBoundingClientRect();
      const panelBox = document.querySelector('[data-ending-panel]').getBoundingClientRect();
      return rowBox.top >= panelBox.top && rowBox.bottom <= panelBox.bottom && rowBox.bottom <= innerHeight;
    }),
    chapterTitle: document.querySelector('[data-chapter-time]').textContent,
    chapterTitleClipped: document.querySelector('[data-chapter-time]').scrollWidth > document.querySelector('[data-chapter-time]').clientWidth,
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
  assert.equal(layout.endingRowsVisible, true);
  assert.equal(layout.chapterTitle, 'WHITEOUT/H-17');
  assert.equal(layout.chapterTitleClipped, false, `${profile.id}: chapter title must fit inside the HUD`);
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
  const implementation = await sharp(path.join(evidenceDir, 'desktop-1440x900-chapter-1-scroll.png')).resize(1440, 900, { fit: 'cover' }).png().toBuffer();
  await sharp({ create: { width: 2880, height: 900, channels: 4, background: '#050918' } })
    .composite([{ input: reference, left: 0, top: 0 }, { input: implementation, left: 1440, top: 0 }])
    .png()
    .toFile(path.join(evidenceDir, 'reference-vs-desktop-chapter-1.png'));

  const directPixels = await sharp(path.join(evidenceDir, 'desktop-1440x900-chapter-1-scroll.png')).ensureAlpha().raw().toBuffer();
  const comparisonPixels = await sharp(path.join(evidenceDir, 'reference-vs-desktop-chapter-1.png'))
    .extract({ left: 1440, top: 0, width: 1440, height: 900 })
    .ensureAlpha()
    .raw()
    .toBuffer();
  assert.equal(comparisonPixels.equals(directPixels), true, 'reference comparison must contain the exact direct chapter-one capture');
}

try {
  await mkdir(evidenceDir, { recursive: true });
  const desktop = await runProfile({ id: 'desktop-1440x900', viewport: { width: 1440, height: 900 }, touch: false, choiceIndex: 0 });
  const mobile = await runProfile({ id: 'mobile-390x844', viewport: { width: 390, height: 844 }, touch: true, choiceIndex: 1 });
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
