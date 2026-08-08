import { expect, test } from '@playwright/test';
import { copyFile } from 'node:fs/promises';

const TEST_QUERY = 'testHook=h17&tools=hidden&motion=reduced&sound=off&sw=off';
const OFFLINE_QUERY = TEST_QUERY.replace('&sw=off', '');

test.afterEach(async ({ request }) => {
  await request.post('/__qa__/online');
});

function captureErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function openFixture(page, fixture, suffix = '') {
  await page.goto(`/reboot.html?${TEST_QUERY}&fixture=${fixture}${suffix}`, { waitUntil: 'domcontentloaded' });
  const canvas = page.locator('[data-reboot-canvas]');
  await expect.poll(() => canvas.getAttribute('data-characters'), { timeout: 60_000 }).not.toBe('loading');
  const state = await canvas.getAttribute('data-characters');
  if (state !== 'ready') {
    const debug = await page.evaluate(() => window.__ethicsReboot?.getSceneDebugState());
    throw new Error(`캐릭터 fixture 로드 실패: ${JSON.stringify(debug)}`);
  }
}

async function pressForHp(page, key, hp) {
  await page.keyboard.press(key);
  await expect.poll(async () => Number(await page.locator('[data-reboot-canvas]').getAttribute('data-boss-hp')))
    .toBe(hp);
}

test('운영 URL은 QA fixture를 무시하고 명시적 훅만 모든 보스 단계를 연다', async ({ page }) => {
  const errors = captureErrors(page);
  await page.goto('/reboot.html?sw=off&fixture=qa-boss-phase-3', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-product-shell]')).toBeVisible();
  await expect(page.locator('[data-reboot-canvas]')).not.toHaveAttribute('data-boss-phase', 'approval-core');
  await page.locator('[data-shell-new]').click();
  await expect(page.locator('[data-reboot-canvas]')).toHaveAttribute('data-route-segment', 'classroom-cold-open');
  await expect(page.locator('[data-reboot-canvas]')).not.toHaveAttribute('data-boss-phase', 'approval-core');

  for (const [fixture, phase] of [
    ['qa-boss-phase-1', 'reflect-scan'],
    ['qa-boss-phase-2', 'trace-roster'],
    ['qa-boss-phase-3', 'approval-core']
  ]) {
    await openFixture(page, fixture);
    await expect(page.locator('[data-reboot-canvas]')).toHaveAttribute('data-boss-phase', phase);
  }
  expect(errors).toEqual([]);
});

test('결과·손상 저장·저품질 fixture가 사용자 의미와 예산을 노출한다', async ({ context, page }) => {
  const errors = captureErrors(page);
  await page.goto(`/reboot.html?${TEST_QUERY}&fixture=qa-result-secure`, { waitUntil: 'domcontentloaded' });
  const result = page.locator('[data-chapter-result]');
  await expect(result).toBeVisible();
  await expect(result.locator('h2')).toContainText('00:17 — 출석번호 없음');
  await expect(result.locator('[data-result-action]')).not.toBeEmpty();
  await expect(result.locator('[data-result-consequence]')).not.toBeEmpty();
  await expect(result).toHaveScreenshot('secure-result.png', {
    animations: 'disabled',
    mask: [result.locator('h2'), result.locator('p')],
    maskColor: '#050918',
    maxDiffPixelRatio: 0.015
  });

  const corruptPage = await context.newPage();
  await corruptPage.addInitScript(() => localStorage.setItem('h17.null.save.v5', '{bad'));
  await corruptPage.goto(`/reboot.html?${TEST_QUERY}&fixture=qa-corrupt-save`, { waitUntil: 'domcontentloaded' });
  await expect(corruptPage.locator('[data-recovery-notice]')).toBeVisible();
  await corruptPage.close();

  await openFixture(page, 'qa-low-performance', '&quality=low&viewport=portrait');
  const canvas = page.locator('[data-reboot-canvas]');
  // SwiftShader의 절대 프레임 예산은 Task 10 실브라우저 증거가 담당하고, 여기서는 계측 회귀만 막는다.
  await expect.poll(async () => Number(await canvas.getAttribute('data-p95-frame-ms'))).toBeLessThanOrEqual(100);
  await expect(canvas).toHaveAttribute('data-quality', 'low');
  await expect(canvas).toHaveAttribute('data-dpr', '1');
  expect(Number(await canvas.getAttribute('data-draw-calls'))).toBeLessThanOrEqual(250);
  expect(Number(await canvas.getAttribute('data-triangles'))).toBeLessThanOrEqual(150_000);
  expect(Number(await canvas.getAttribute('data-light-count'))).toBeLessThanOrEqual(4);
  expect(errors).toEqual([]);
});

test('온라인 체크포인트는 오프라인 재실행 뒤 보스 승리까지 이어진다', async ({ page }) => {
  const errors = captureErrors(page);
  const failedRequests = [];
  page.on('requestfailed', (request) => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.goto(`/reboot.html?${OFFLINE_QUERY}&fixture=boss-secure`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-reboot-canvas]')).toHaveAttribute('data-characters', 'ready', { timeout: 20_000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  // 환경 에셋은 설치를 막지 않는 장별 지연 캐시다. 제어권을 얻은 온라인 장면을 한 번
  // 실제로 열어 런타임 캐시를 채운 뒤, 같은 장의 오프라인 재접속을 검증한다.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-reboot-canvas]')).toHaveAttribute('data-characters', 'ready', { timeout: 20_000 });
  await expect(page.locator('[data-reboot-canvas]')).toHaveAttribute('data-environment-status', 'ready', { timeout: 20_000 });
  await expect.poll(async () => page.evaluate(async () => {
    const names = await caches.keys();
    const requests = await Promise.all(names.map(async (name) => (await caches.open(name)).keys()));
    return requests.flat().some(({ url }) => url.includes('/assets/reboot/environment/'));
  })).toBe(true);
  const cachedUrls = await page.evaluate(async () => {
    const names = await caches.keys();
    const requests = await Promise.all(names.map(async (name) => (await caches.open(name)).keys()));
    return requests.flat().map((request) => request.url);
  });
  expect(cachedUrls.some((url) => /assets\/reboot-[^/]+\.js$/.test(url))).toBe(true);
  expect(cachedUrls.some((url) => /assets\/three-[^/]+\.js$/.test(url))).toBe(true);
  await page.evaluate(() => window.__ethicsReboot.setCheckpointForTest('chapter-1:offline-boss'));

  const offlineResponse = await page.evaluate(() => fetch('/__qa__/offline', { method: 'POST' }).then((response) => response.status));
  expect(offlineResponse).toBe(204);
  failedRequests.length = 0;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.__ethicsReboot))).toBe(true);
  await expect(page.locator('[data-reboot-canvas]')).toHaveAttribute('data-characters', 'ready', { timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => window.__ethicsReboot.getSaveState().chapterProgress.checkpoint))
    .toBe('chapter-1:offline-boss');

  for (const [key, hp] of [['k', 210], ['k', 180], ['e', 150], ['e', 120], ['j', 80], ['j', 40], ['j', 0]]) {
    await pressForHp(page, key, hp);
  }
  await expect(page.locator('[data-reboot-canvas]')).toHaveAttribute('data-boss-status', 'victory');
  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
  const video = page.video();
  await page.close();
  await copyFile(await video.path(), '.omo/evidence/task-11-offline.webm');
});
