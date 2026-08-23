import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.STORYBOOK_CAPTURE_URL ?? 'http://127.0.0.1:8899/';
const evidenceDir = '.omo/evidence/h17-storybook3d';
const browser = await chromium.launch({ headless: true });
const errors = [];

function watch(page, surface) {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${surface}:console:${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`${surface}:page:${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${surface}:http:${response.status()}:${response.url()}`);
  });
}

async function openFresh(context) {
  const page = await context.newPage();
  watch(page, context.pages().length === 1 ? 'capture' : 'capture-extra');
  await page.addInitScript(() => {
    if (sessionStorage.getItem('storybook-capture-initialized')) return;
    localStorage.removeItem('ethics-quest-storybook3d-v1');
    sessionStorage.setItem('storybook-capture-initialized', 'true');
  });
  await page.goto(`${baseUrl}?testHook=1&quality=high&sw=off`);
  await page.locator('[data-storybook-canvas][data-ready=true]').waitFor({ timeout: 120_000 });
  return page;
}

const desktopContext = await browser.newContext({ viewport: { height: 900, width: 1440 } });
const desktop = await openFresh(desktopContext);
await desktop.screenshot({ path: `${evidenceDir}/desktop-title.png` });
await desktop.getByRole('button', { name: '첫 장 펼치기' }).click();
const chapters = [];

for (let chapter = 1; chapter <= 6; chapter += 1) {
  await desktop.locator(`[data-storybook-root][data-chapter="${chapter}"][data-loading=false]`).waitFor({ timeout: 120_000 });
  await desktop.waitForTimeout(500);
  await desktop.screenshot({ path: `${evidenceDir}/desktop-chapter-${chapter}.png` });
  chapters.push({
    chapter,
    metrics: await desktop.evaluate(() => window.__storybook3d.getMetrics())
  });
  await desktop.locator('[data-next-page]').click();
  const clues = desktop.locator('.clue-button');
  await clues.nth(0).click();
  await clues.nth(1).click();
  await desktop.locator('[data-next-page]').click();
  await desktop.locator('[data-choice-list] button').first().click();
  await desktop.locator('[data-next-page]').click();
}

await desktop.locator('[data-ending-screen]').waitFor();
await desktop.screenshot({ path: `${evidenceDir}/desktop-ending.png` });
await desktop.reload();
await desktop.getByRole('button', { name: '이어 읽기' }).click();
await desktop.locator('[data-ending-screen]').waitFor();

const mobileContext = await browser.newContext({
  hasTouch: true,
  isMobile: true,
  viewport: { height: 844, width: 390 }
});
const mobile = await openFresh(mobileContext);
await mobile.screenshot({ path: `${evidenceDir}/mobile-title.png` });
await mobile.getByRole('button', { name: '첫 장 펼치기' }).click();
await mobile.locator('[data-storybook-root][data-loading=false]').waitFor({ timeout: 120_000 });
await mobile.locator('[data-next-page]').click();
await mobile.screenshot({ path: `${evidenceDir}/mobile-clues.png` });

const mobileMetrics = await mobile.evaluate(() => {
  const visibleButtons = [...document.querySelectorAll('button')].filter((button) => {
    const style = getComputedStyle(button);
    return style.display !== 'none' && style.visibility !== 'hidden' && button.getBoundingClientRect().height > 0;
  });
  const buttons = visibleButtons.map((button) => {
    const rect = button.getBoundingClientRect();
    return {
      label: button.textContent.trim(),
      width: rect.width,
      height: rect.height,
      visible: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
    };
  });
  const clues = [...document.querySelectorAll('.clue-button')].map((button) => {
    const rect = button.getBoundingClientRect();
    return {
      label: button.getAttribute('aria-label'), left: rect.left, right: rect.right,
      top: rect.top, bottom: rect.bottom
    };
  });
  return {
    width: innerWidth,
    height: innerHeight,
    overflow: document.documentElement.scrollWidth > innerWidth,
    minimumButton: Math.min(...buttons.map(({ height, width }) => Math.min(height, width))),
    buttons,
    clues
  };
});

await writeFile(`${evidenceDir}/capture-report.json`, `${JSON.stringify({
  url: baseUrl,
  chapters,
  desktop: { width: 1440, height: 900 },
  mobile: mobileMetrics,
  errors
}, null, 2)}\n`);

await desktopContext.close();
await mobileContext.close();
await browser.close();

if (errors.length > 0) throw new Error(errors.join('\n'));
console.log(JSON.stringify({ chapters: chapters.length, errors: errors.length, mobile: mobileMetrics }));
