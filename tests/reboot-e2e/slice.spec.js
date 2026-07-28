import { expect, test } from '@playwright/test';

const QUERY = 'testHook=h17&tools=hidden&motion=reduced&sound=off&sw=off&quality=low';

test.beforeEach(async ({ request }) => {
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

async function openFixture(page, fixture, viewport) {
  await page.goto(`/reboot.html?${QUERY}&fixture=${fixture}&viewport=${viewport}`, {
    waitUntil: 'domcontentloaded'
  });
  const canvas = page.locator('[data-reboot-canvas]');
  await expect(canvas).toHaveAttribute('data-characters', 'ready', { timeout: 60_000 });
  return canvas;
}

async function pressBossKey(page, canvas, key, hp) {
  await page.keyboard.press(key);
  await expect.poll(() => canvas.getAttribute('data-boss-hp')).toBe(String(hp));
}

async function pressTouchBossAction(page, canvas, action, hp, pointerId) {
  const button = page.locator(`[data-touch-action="${action}"]`);
  await button.dispatchEvent('pointerdown', { button: 0, isPrimary: true, pointerId });
  await button.dispatchEvent('pointerup', { button: 0, isPrimary: true, pointerId });
  await expect.poll(() => canvas.getAttribute('data-boss-hp')).toBe(String(hp));
}

test('SECURE desktop checkpoints and live boss conclude with the shared signature reversal', async ({ page }) => {
  const errors = captureErrors(page);
  for (const [fixture, segment] of [
    ['qa-tutorial', 'classroom-cold-open'],
    ['qa-arena', 'first-arena'],
    ['qa-consequence-secure', 'gym-boss-arena']
  ]) {
    const checkpointCanvas = await openFixture(page, fixture, 'landscape');
    await expect(checkpointCanvas).toHaveAttribute('data-route-segment', segment);
  }

  const canvas = await openFixture(page, 'boss-secure', 'landscape');
  for (const [key, hp] of [['k', 210], ['k', 180], ['e', 150], ['e', 120], ['j', 80], ['j', 40], ['j', 0]]) {
    await pressBossKey(page, canvas, key, hp);
  }
  await page.locator('[data-patch-id="reflect-arc"]').click();
  const result = page.locator('[data-chapter-result]');
  await expect(result).toBeVisible();
  await expect(canvas).toHaveAttribute('data-memory-outcome', 'secure');
  await result.screenshot({ path: '.omo/evidence/task-12-secure-desktop.png' });
  expect(errors).toEqual([]);
});

test('PURGE touch checkpoints and live boss remain playable with a distinct report', async ({ page }) => {
  const errors = captureErrors(page);
  for (const fixture of ['qa-tutorial', 'qa-arena', 'qa-consequence-purge']) {
    await openFixture(page, fixture, 'portrait');
  }

  const canvas = await openFixture(page, 'boss-purge', 'portrait');
  let pointerId = 30;
  for (const [action, hp] of [
    ['reflect', 210], ['reflect', 180], ['trace', 150], ['trace', 120],
    ['attack', 80], ['attack', 40], ['attack', 0]
  ]) {
    await pressTouchBossAction(page, canvas, action, hp, pointerId);
    pointerId += 1;
  }
  await page.locator('[data-patch-id="trace-speed"]').click();
  const result = page.locator('[data-chapter-result]');
  await expect(result).toBeVisible();
  await expect(canvas).toHaveAttribute('data-memory-outcome', 'purge');
  await result.screenshot({ path: '.omo/evidence/task-12-purge-touch.png' });
  expect(errors).toEqual([]);
});
