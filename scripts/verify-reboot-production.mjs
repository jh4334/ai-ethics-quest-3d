import assert from 'node:assert/strict';
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { serializeSave } from '../src/reboot/save/codec.js';
import { setChapterCheckpoint } from '../src/reboot/state/consequences.js';
import { createInitialRebootState } from '../src/reboot/state/model.js';

const baseUrl = process.env.H17_PRODUCTION_URL ?? 'https://jh4334.github.io/ai-ethics-quest-3d/';
const evidenceDir = fileURLToPath(new URL('../.omo/evidence/task-15-production-video/', import.meta.url));
const evidenceFile = fileURLToPath(new URL('../.omo/evidence/task-15-production-proof.webm', import.meta.url));
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({
  hasTouch: true,
  locale: 'ko-KR',
  recordVideo: { dir: evidenceDir, size: { width: 1180, height: 820 } },
  reducedMotion: 'reduce',
  serviceWorkers: 'allow',
  timezoneId: 'Asia/Seoul',
  viewport: { width: 1180, height: 820 }
});
const page = await context.newPage();
const errors = [];
const failedRequests = [];
page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('requestfailed', (request) => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForURL((url) => url.pathname.endsWith('/reboot.html'), { timeout: 20_000 });
  const canvas = page.locator('[data-reboot-canvas]');
  await canvas.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('[data-reboot-canvas]')?.dataset.characters === 'ready', null, {
    timeout: 60_000
  });
  assert.equal(await page.evaluate(() => Boolean(window.__ethicsReboot)), false, '운영 URL에 QA 훅이 노출됨');

  await page.keyboard.down('w');
  await page.waitForFunction(() => document.querySelector('[data-reboot-canvas]')?.dataset.routeSegment === 'first-arena', null, {
    timeout: 20_000
  });
  await page.keyboard.up('w');
  await page.keyboard.press('j');
  await page.waitForFunction(() => document.querySelector('[data-reboot-canvas]')?.dataset.lastAction !== 'none');
  await page.waitForFunction(() => Number(document.querySelector('[data-reboot-canvas]')?.dataset.p95FrameMs) > 0);
  const performance = await page.evaluate(() => {
    const data = document.querySelector('[data-reboot-canvas]').dataset;
    return {
      drawCalls: Number(data.drawCalls),
      lights: Number(data.lightCount),
      p95FrameMs: Number(data.p95FrameMs),
      triangles: Number(data.triangles)
    };
  });
  assert.ok(performance.p95FrameMs <= 100, `p95 frame budget exceeded: ${performance.p95FrameMs}`);
  assert.ok(performance.drawCalls <= 250, `draw-call budget exceeded: ${performance.drawCalls}`);
  assert.ok(performance.triangles <= 150_000, `triangle budget exceeded: ${performance.triangles}`);
  assert.ok(performance.lights <= 4, `light budget exceeded: ${performance.lights}`);

  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  }

  const chapterTwo = setChapterCheckpoint(createInitialRebootState({
    motion: 'reduced', quality: 'low', sound: false
  }), 2, 'chapter-2:start');
  await page.evaluate((bytes) => localStorage.setItem('h17.null.save.v4', bytes), serializeSave(chapterTwo));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('[data-reboot-canvas]')?.dataset.campaignChapter === '2');
  await page.waitForFunction(() => document.querySelector('[data-reboot-canvas]')?.dataset.characters === 'ready', null, {
    timeout: 60_000
  });
  for (const key of ['k', 'e', 'j', 'f']) await page.keyboard.press(key);
  await page.waitForFunction(() => document.querySelector('[data-reboot-canvas]')?.dataset.campaignCompleted === 'true');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('h17.null.save.v4')));
  assert.deepEqual(saved.chapterProgress, { completed: [1, 2], current: 3, checkpoint: 'chapter-3:start' });
  assert.equal(saved.settings.motion, 'reduced');
  await page.locator('[data-campaign-continue]').click();
  await page.waitForFunction(() => document.querySelector('[data-reboot-canvas]')?.dataset.campaignChapter === '3');
  await page.waitForFunction(() => document.querySelector('[data-reboot-canvas]')?.dataset.characters === 'ready', null, {
    timeout: 60_000
  });

  await page.setViewportSize({ width: 430, height: 840 });
  assert.equal(await page.locator('[data-touch-stick]').isVisible(), true, '좁은 화면에서 이동 스틱이 숨겨짐');
  assert.equal(await page.locator('[data-touch-action="attack"]').isVisible(), true, '좁은 화면에서 공격 버튼이 숨겨짐');
  const cacheNames = await page.evaluate(() => caches.keys());
  assert.ok(cacheNames.includes('ethics-quest-h17-v10'), '운영 서비스워커 v10 캐시가 없음');

  failedRequests.length = 0;
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('[data-reboot-canvas]')?.dataset.campaignChapter === '3');
  await page.waitForFunction(() => document.querySelector('[data-reboot-canvas]')?.dataset.characters === 'ready', null, {
    timeout: 60_000
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);

  const report = {
    cache: 'ethics-quest-h17-v10',
    deployedSha: process.env.H17_PRODUCTION_SHA ?? null,
    offlineChapter: 3,
    performance,
    productionUrl: page.url(),
    savedCheckpoint: saved.chapterProgress.checkpoint
  };
  console.log(JSON.stringify(report, null, 2));
} finally {
  await context.setOffline(false).catch(() => {});
  const video = page.video();
  await page.close();
  if (video) await copyFile(await video.path(), evidenceFile);
  await context.close();
  await browser.close();
}
