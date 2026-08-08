import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.H17_BASE_URL ?? 'http://127.0.0.1:4174';
const outputDirectory = '.omo/evidence/h17-six-chapter/p0';
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const captures = [];

async function capture(name, viewport, options = {}) {
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    hasTouch: options.hasTouch === true,
    isMobile: options.hasTouch === true,
    viewport
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedResponses = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
  });
  await page.addInitScript(() => { window.__ETHICS_TEST_HOOK__ = true; });
  await page.goto(`${baseUrl}/reboot.html?tools=hidden&sw=off&testHook=h17`, { waitUntil: 'networkidle' });
  if (options.checkpoint) {
    await page.evaluate((checkpoint) => window.__ethicsReboot.setCheckpointForTest(checkpoint), options.checkpoint);
    await page.reload({ waitUntil: 'networkidle' });
  }
  await page.waitForFunction(() => {
    const status = document.querySelector('[data-reboot-canvas]')?.dataset.environmentStatus;
    return status && status !== 'loading';
  }, { timeout: 60000 });
  await page.waitForFunction(() => {
    const status = document.querySelector('[data-reboot-canvas]')?.dataset.characters;
    return status === 'ready' || status === 'error';
  }, { timeout: 60000 });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(3200);
  const screenshotPath = `${outputDirectory}/${name}.png`;
  await page.screenshot({ path: screenshotPath });
  const surface = await page.evaluate(() => ({
    canvas: { ...document.querySelector('[data-reboot-canvas]').dataset },
    chapterStrip: [...document.querySelectorAll('[data-chapter-progress] [data-chapter]')].map((item) => ({
      chapter: item.dataset.chapter,
      state: item.dataset.state
    })),
    debug: window.__ethicsReboot.getSceneDebugState(),
    save: window.__ethicsReboot.getSaveState()
  }));
  captures.push({ consoleErrors, failedResponses, name, screenshotPath, surface, viewport });
  await context.close();
}

try {
  await capture('chapter-1-classroom-desktop-1440x900', { width: 1440, height: 900 });
  await capture('chapter-1-desktop-1440x900', { width: 1440, height: 900 }, {
    checkpoint: 'chapter-1:first-arena'
  });
  await capture('chapter-1-mobile-390x844', { width: 390, height: 844 }, {
    checkpoint: 'chapter-1:first-arena', hasTouch: true
  });
} finally {
  await browser.close();
}

await writeFile(`${outputDirectory}/capture-report.json`, `${JSON.stringify({ baseUrl, captures }, null, 2)}\n`, 'utf8');

const failures = captures.flatMap(({ consoleErrors, failedResponses, name }) => [
  ...consoleErrors.map((message) => `${name}: console: ${message}`),
  ...failedResponses.map(({ status, url }) => `${name}: HTTP ${status}: ${url}`)
]);
if (failures.length > 0) throw new Error(failures.join('\n'));
