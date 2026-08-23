import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const EVIDENCE_DIR = '.omo/evidence/h17-topdown-adventure';

test.use({ serviceWorkers: 'block' });

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

async function adventureState(page) {
  return page.evaluate(() => window.__storybook3d.getState().adventure);
}

async function inspectAt(page, x, z, event) {
  await page.evaluate(([nextX, nextZ]) => window.__storybook3d.teleport(nextX, nextZ), [x, z]);
  await page.waitForTimeout(80);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(180);
  const current = await adventureState(page);
  if (current.lastEvent !== event) {
    throw new Error(`${event} 상호작용 실패: 위치 ${current.player.x.toFixed(2)}, ${current.player.z.toFixed(2)} / ${current.lastEvent}`);
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('storybook3d-adventure-test')) return;
    localStorage.removeItem('ethics-quest-storybook3d-v1');
    sessionStorage.setItem('storybook3d-adventure-test', 'true');
  });
});

test('키보드로 탑다운 3D 섬을 탐색해 열쇠와 보스를 지나 2장을 연다', async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?testHook=1&quality=low');
  await expect(page).toHaveTitle(/하루와 사라진 이름/);
  const canvas = page.locator('[data-storybook-canvas]');
  await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
  await expect(canvas).toHaveAttribute('data-mode', 'topdown-adventure');
  await page.getByRole('button', { name: '모험 시작' }).click();

  const start = await adventureState(page);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(450);
  await page.keyboard.up('KeyD');
  const moved = await adventureState(page);
  expect(moved.player.x).toBeGreaterThan(start.player.x + 0.8);
  await page.screenshot({ path: `${EVIDENCE_DIR}/desktop-chapter-1-explore.png`, fullPage: true });

  await inspectAt(page, -4.5, -2.7, 'clue:folded-note');
  await inspectAt(page, 0.2, -3.7, 'clue:wide-lantern');
  await inspectAt(page, -3.5, 1.8, 'sigil:sigil-1');
  await inspectAt(page, 3.5, 1.8, 'sigil:sigil-2');
  await inspectAt(page, 0, 0.4, 'key-collected');
  await inspectAt(page, 0, -4.05, 'gate-opened');
  await page.evaluate(() => window.__storybook3d.teleport(0, -4.2));
  await page.waitForTimeout(80);
  await page.keyboard.press('KeyW', { delay: 120 });
  for (let hit = 0; hit < 6; hit += 1) {
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(410);
  }
  await expect(page.locator('[data-choice-panel]')).toBeVisible();
  await expect.poll(async () => (await adventureState(page)).boss.defeated).toBe(true);
  await page.locator('[data-choice-list] button').first().click();
  await expect(page.locator('[data-choice-result]')).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE_DIR}/desktop-chapter-1-choice.png`, fullPage: true });
  await page.locator('[data-continue-chapter]').click();
  await expect(page.locator('[data-storybook-root]')).toHaveAttribute('data-chapter', '2');
  await expect(page.locator('[data-storybook-root]')).toHaveAttribute('data-loading', 'false', { timeout: 120_000 });
  expect((await adventureState(page)).chapterIndex).toBe(1);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 });
  await page.getByRole('button', { name: '이어 하기' }).click();
  await expect(page.locator('[data-storybook-root]')).toHaveAttribute('data-chapter', '2');
  expect(errors).toEqual([]);
});

test('모바일 터치로 이동하고 단서를 살피며 조작 버튼이 44px 이상이다', async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?testHook=1&quality=low');
  await expect(page.locator('[data-storybook-canvas]')).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
  await page.getByRole('button', { name: '모험 시작' }).click();
  const right = page.locator('[data-control="right"]');
  const before = await adventureState(page);
  await right.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
  await page.waitForTimeout(650);
  await right.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
  expect((await adventureState(page)).player.x).toBeGreaterThan(before.player.x + 1);

  await page.evaluate(() => window.__storybook3d.teleport(-4.5, -2.7));
  const inspect = page.locator('[data-control="interact"]');
  await inspect.dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch' });
  await page.waitForTimeout(80);
  await inspect.dispatchEvent('pointerup', { pointerId: 2, pointerType: 'touch' });
  await expect.poll(async () => (await adventureState(page)).clues).toContain('folded-note');

  const sizes = await page.locator('[data-control], [data-help-open], .chapter-rail button').evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { height: rect.height, width: rect.width };
  }));
  for (const size of sizes) {
    expect(size.height).toBeGreaterThanOrEqual(44);
    expect(size.width).toBeGreaterThanOrEqual(44);
  }
  const layout = await page.evaluate(() => {
    const dialogue = document.querySelector('[data-dialogue-card]')?.getBoundingClientRect();
    const controls = document.querySelector('[data-touch-controls]')?.getBoundingClientRect();
    return { dialogueBottom: dialogue?.bottom ?? 0, controlsTop: controls?.top ?? innerHeight };
  });
  expect(layout.dialogueBottom).toBeLessThanOrEqual(layout.controlsTop - 8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: `${EVIDENCE_DIR}/mobile-chapter-1-explore.png`, fullPage: true });
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
