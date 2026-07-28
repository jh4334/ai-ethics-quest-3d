import { expect, test } from '@playwright/test';

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
