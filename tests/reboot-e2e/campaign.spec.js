import { expect, test } from '@playwright/test';
import { copyFile } from 'node:fs/promises';

import { serializeSave } from '../../src/reboot/save/codec.js';
import { finalizeCampaign } from '../../src/reboot/campaign/endingEvaluator.js';
import { createFinaleFixture } from '../../src/reboot/campaign/finaleFixtures.js';
import { setChapterCheckpoint } from '../../src/reboot/state/consequences.js';
import { createInitialRebootState } from '../../src/reboot/state/model.js';

const QUERY = 'testHook=h17&tools=hidden&motion=reduced&sound=off&sw=off&quality=low';

function captureErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function openLayer(page, layer) {
  await page.goto(`/reboot.html?${QUERY}&fixture=qa-dual-school-${layer}&viewport=landscape`, {
    waitUntil: 'domcontentloaded'
  });
  const canvas = page.locator('[data-reboot-canvas]');
  await expect(canvas).toHaveAttribute('data-characters', 'ready', { timeout: 60_000 });
  await expect(canvas).toHaveAttribute('data-dual-school-layer', layer);
  return canvas;
}

async function openFinale(page, ending) {
  await page.goto(`/reboot.html?${QUERY}&fixture=qa-final-${ending}&viewport=landscape`, {
    waitUntil: 'domcontentloaded'
  });
  const canvas = page.locator('[data-reboot-canvas]');
  await expect(canvas).toHaveAttribute('data-characters', 'ready', { timeout: 60_000 });
  return canvas;
}

async function masterFinale(page, canvas) {
  const sequence = [
    ['reflect-shield', 'k'],
    ['trace-consent', 'e'],
    ['dash-relay', 'Space'],
    ['signal-core', 'j']
  ];
  for (const [phase, key] of sequence) {
    await expect(canvas).toHaveAttribute('data-protocol-phase', phase);
    await expect.poll(async () => Number(await canvas.getAttribute('data-protocol-phase-tick')) >= 18).toBe(true);
    await page.keyboard.press(key);
  }
  await expect(canvas).toHaveAttribute('data-protocol-status', 'victory');
  await expect(page.locator('[data-chapter-result]')).toBeVisible();
}

test('운영 루트는 저장된 2장을 열고 전투 결정 뒤 3장으로 계속한다', async ({ page }) => {
  const errors = captureErrors(page);
  const chapterTwo = setChapterCheckpoint(createInitialRebootState({
    motion: 'reduced', quality: 'low', sound: false
  }), 2, 'chapter-2:start');
  await page.addInitScript((bytes) => {
    if (sessionStorage.getItem('h17.production-seeded') !== 'true') {
      localStorage.setItem('h17.null.save.v4', bytes);
      sessionStorage.setItem('h17.production-seeded', 'true');
    }
  }, serializeSave(chapterTwo));

  await page.goto('/?sw=off', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/reboot\.html\?sw=off$/);
  const canvas = page.locator('[data-reboot-canvas]');
  await expect(canvas).toHaveAttribute('data-campaign-chapter', '2');
  await expect(canvas).toHaveAttribute('data-characters', 'ready', { timeout: 60_000 });

  for (const key of ['k', 'e', 'j', 'f']) await page.keyboard.press(key);
  await expect(canvas).toHaveAttribute('data-campaign-completed', 'true');
  await expect(page.locator('[data-campaign-continue]')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('h17.null.save.v4')));
  expect(saved.chapterProgress).toEqual({ completed: [1, 2], current: 3, checkpoint: 'chapter-3:start' });
  expect(saved.evidence.at(-1)).toEqual({ action: 'secure', chapter: 2, evidenceId: 'original-upload-trace' });

  await page.locator('[data-campaign-continue]').click();
  await expect(page.locator('[data-reboot-canvas]')).toHaveAttribute('data-campaign-chapter', '3');
  await expect(page.locator('[data-reboot-canvas]')).toHaveAttribute('data-characters', 'ready', { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test('완료된 마지막 방송 저장은 보스 재전을 열지 않고 기록된 결말을 복원한다', async ({ page }) => {
  const errors = captureErrors(page);
  const fixture = createFinaleFixture('sealed');
  const resolved = finalizeCampaign(fixture.campaign, { decision: fixture.decision }).state;
  await page.addInitScript((bytes) => localStorage.setItem('h17.null.save.v4', bytes), serializeSave(resolved));

  await page.goto('/reboot.html?sw=off', { waitUntil: 'domcontentloaded' });
  const canvas = page.locator('[data-reboot-canvas]');
  await expect(canvas).toHaveAttribute('data-protocol-status', 'resolved');
  await expect(canvas).toHaveAttribute('data-campaign-ending', 'sealed-incident');
  await expect(page.locator('[data-chapter-result]')).toBeVisible();
  await expect(page.locator('[data-route-objective]')).toContainText('기록된 마지막 방송 결과');
  await expect(canvas).toHaveAttribute('data-characters', 'ready', { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test('두 개의 학교는 교체 캐릭터를 로드하고 TRACE로 현실을 전환한다', async ({ page }) => {
  const errors = captureErrors(page);
  const canvas = await openLayer(page, 'comfort');
  const initial = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState());
  expect(initial.characterIds).toEqual([
    'player', 'recommender-comfort', 'recommender-verified'
  ]);
  expect(initial.characterErrors).toEqual([]);

  await page.keyboard.press('e');
  await expect(canvas).toHaveAttribute('data-dual-school-layer', 'verified');
  await expect(page.locator('[data-route-objective]')).toContainText('검증된 현실');
  await page.screenshot({
    animations: 'disabled',
    path: '.omo/evidence/task-13-dual-school.png'
  });

  await openLayer(page, 'verified');
  expect(errors).toEqual([]);
});

test('보존 경로는 네 숙련 동사 뒤 개인정보를 가린 검증 방송으로 끝난다', async ({ page }) => {
  const errors = captureErrors(page);
  const canvas = await openFinale(page, 'redacted');
  const debug = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState());
  expect([...debug.characterIds].sort()).toEqual(['dot', 'haru', 'lumen', 'player']);
  expect(debug.characterErrors).toEqual([]);

  await masterFinale(page, canvas);
  await expect(canvas).toHaveAttribute('data-campaign-ending', 'redacted-broadcast');
  await expect(page.locator('[data-chapter-result] h2')).toContainText('가린 검증 방송');
  expect(errors).toEqual([]);

  const video = page.video();
  await page.close();
  await copyFile(await video.path(), '.omo/evidence/task-14-redacted-ending.webm');
});

test('노출이 큰 경로도 설교 없이 원본 공개의 구체적 비용으로 끝난다', async ({ page }) => {
  const errors = captureErrors(page);
  const canvas = await openFinale(page, 'raw');
  await masterFinale(page, canvas);
  await expect(canvas).toHaveAttribute('data-campaign-ending', 'raw-disclosure');
  await expect(page.locator('[data-result-reversal]')).toContainText('사생활 노출');
  await page.screenshot({
    animations: 'disabled',
    path: '.omo/evidence/task-14-imperfect-ending.png'
  });
  expect(errors).toEqual([]);
});
