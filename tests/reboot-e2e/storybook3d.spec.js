import { expect, test } from '@playwright/test';

function collectRuntimeErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console:${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page:${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`http:${response.status()}:${response.url()}`);
  });
  return errors;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('storybook3d-test-initialized')) return;
    localStorage.removeItem('ethics-quest-storybook3d-v1');
    sessionStorage.setItem('storybook3d-test-initialized', 'true');
  });
});

test('키보드 화면에서 6장 3D 동화를 끝까지 읽고 저장 뒤 이어 읽는다', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/?testHook=1&quality=low');
  await expect(page).toHaveTitle(/하루와 사라진 이름/);
  await expect(page.locator('[data-storybook-canvas]')).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
  await expect(page.locator('[data-action-canvas]')).toHaveCount(0);
  await page.getByRole('button', { name: '첫 장 펼치기' }).click();

  for (let chapter = 1; chapter <= 6; chapter += 1) {
    await expect(page.locator('[data-storybook-root]')).toHaveAttribute('data-chapter', String(chapter));
    await page.locator('[data-next-page]').click();
    const clues = page.locator('.clue-button');
    await expect(clues).toHaveCount(2);
    await clues.nth(0).click();
    await clues.nth(1).click();
    await expect(page.locator('[data-clue-progress] b')).toHaveText('2 / 2');
    await page.locator('[data-next-page]').click();
    await page.locator('[data-choice-list] button').first().click();
    await expect(page.locator('[data-choice-result]')).toBeVisible();
    await page.locator('[data-next-page]').click();
    if (chapter < 6) {
      await expect(page.locator('[data-storybook-root]')).toHaveAttribute('data-chapter', String(chapter + 1));
      await expect(page.locator('[data-storybook-root]')).toHaveAttribute('data-loading', 'false', { timeout: 120_000 });
    }
  }

  await expect(page.locator('[data-ending-screen]')).toBeVisible();
  await expect(page.locator('[data-reading-report] li')).toHaveCount(6);
  await page.reload();
  await expect(page.getByRole('button', { name: '이어 읽기' })).toBeEnabled();
  await page.getByRole('button', { name: '이어 읽기' }).click();
  await expect(page.locator('[data-ending-screen]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('모바일에서 제목과 3D 장면, 44px 이상의 읽기 조작이 겹치지 않는다', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?testHook=1&quality=low');
  await expect(page.locator('[data-storybook-canvas]')).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
  await page.getByRole('button', { name: '첫 장 펼치기' }).click();
  await page.locator('[data-next-page]').click();
  for (const selector of ['[data-previous-page]', '[data-next-page]', '[data-help-open]', '.clue-button']) {
    const boxes = await page.locator(selector).evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { height: rect.height, width: rect.width };
    }));
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  const clueBounds = await page.locator('.clue-button').evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
  }));
  for (const bounds of clueBounds) {
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(390);
    expect(bounds.bottom).toBeLessThanOrEqual(844);
  }
  expect(errors).toEqual([]);
});

test('WebGL을 만들 수 없으면 검은 화면 대신 2D 보존판 안내를 보인다', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.goto('/');
  await expect(page.locator('[data-webgl-fallback]')).toBeVisible();
  await expect(page.getByRole('link', { name: '2D 보존판 열기' })).toHaveAttribute('href', './illustrated.html');
});
