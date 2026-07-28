import { expect, test } from '@playwright/test';
import { copyFile } from 'node:fs/promises';

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
