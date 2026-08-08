import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serializeSave } from '../src/reboot/save/codec.js';
import { V5_SAVE_KEY } from '../src/reboot/save/repository.js';
import { setChapterCheckpoint } from '../src/reboot/state/consequences.js';
import { createInitialRebootState } from '../src/reboot/state/model.js';

const baseUrl = process.env.H17_CAPTURE_URL ?? 'http://127.0.0.1:4174/';
const outputDirectory = fileURLToPath(new URL('../.omo/evidence/h17-six-chapter/chapters/', import.meta.url));
const rendererProfile = process.env.H17_CAPTURE_RENDERER === 'hardware' ? 'hardware' : 'swiftshader';
const headless = process.env.H17_CAPTURE_HEADFUL !== 'true';
const profiles = Object.freeze([
  Object.freeze({ height: 900, id: 'desktop-1440x900', quality: 'high', touch: false, width: 1440 }),
  Object.freeze({ height: 844, id: 'mobile-390x844', quality: 'low', touch: true, width: 390 })
]);
const chapters = (process.env.H17_CAPTURE_CHAPTERS ?? '1,2,3,4,5,6')
  .split(',').map(Number).filter((chapter) => Number.isInteger(chapter) && chapter >= 1 && chapter <= 6);
const selectedProfiles = process.env.H17_CAPTURE_PROFILE
  ? profiles.filter(({ id }) => id === process.env.H17_CAPTURE_PROFILE)
  : profiles;
if (chapters.length === 0 || selectedProfiles.length === 0) throw new Error('캡처할 장과 화면 프로필이 필요합니다.');

function relativeEvidencePath(path) {
  return relative(process.cwd(), path).replaceAll('\\', '/');
}

function campaignAt(chapter) {
  const initial = createInitialRebootState({ motion: 'reduced', quality: 'low', sound: false });
  return chapter === 1 ? initial : setChapterCheckpoint(initial, chapter, `chapter-${chapter}:start`);
}

async function captureChapter(browser, chapter, profile) {
  const context = await browser.newContext({
    colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: profile.touch,
    locale: 'ko-KR', reducedMotion: 'reduce', serviceWorkers: 'block',
    viewport: { height: profile.height, width: profile.width }
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedResponses = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const sourceUrl = message.location().url;
    consoleErrors.push(sourceUrl ? `${message.text()} @ ${sourceUrl}` : message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  await page.addInitScript(({ bytes, key }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(key, bytes);
    window.__ETHICS_TEST_HOOK__ = true;
  }, { bytes: serializeSave(campaignAt(chapter)), key: V5_SAVE_KEY });
  const query = `testHook=h17&tools=hidden&motion=reduced&sound=off&sw=off&quality=${profile.quality}`;
  await page.goto(new URL(`reboot.html?${query}`, baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  const canvas = page.locator('[data-reboot-canvas]');
  await canvas.waitFor({ state: 'visible' });
  await page.waitForFunction((expected) => {
    const target = document.querySelector('[data-reboot-canvas]');
    return target?.dataset.campaignChapter === String(expected)
      && target.dataset.characters === 'ready'
      && Number(target.dataset.p95FrameMs) > 0;
  }, chapter, { timeout: 90_000 });
  await page.waitForTimeout(900);
  const name = `chapter-${chapter}-${profile.id}`;
  const screenshotPath = `${outputDirectory}/${name}.png`;
  await page.screenshot({ animations: 'disabled', path: screenshotPath });
  const report = await page.evaluate(() => {
    const canvasElement = document.querySelector('[data-reboot-canvas]');
    const data = canvasElement.dataset;
    const resources = performance.getEntriesByType('resource');
    return {
      dataset: {
        campaignChapter: data.campaignChapter,
        campaignStep: data.campaignStep,
        characters: data.characters,
        drawCalls: Number(data.drawCalls),
        environmentStatus: data.environmentStatus ?? null,
        lightCount: Number(data.lightCount),
        p95FrameMs: Number(data.p95FrameMs),
        triangles: Number(data.triangles)
      },
      resources: {
        encodedBodyBytes: resources.reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0),
        requests: resources.length,
        transferBytes: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0)
      },
      renderer: (() => {
        const gl = canvasElement.getContext('webgl2');
        const info = gl?.getExtension('WEBGL_debug_renderer_info');
        return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'masked';
      })(),
      touchControlsVisible: getComputedStyle(document.querySelector('[data-touch-controls]')).display !== 'none'
    };
  });
  await context.close();
  return {
    chapter, consoleErrors, failedResponses, name, profile: profile.id,
    screenshotPath: relativeEvidencePath(screenshotPath), ...report
  };
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({
  headless,
  args: rendererProfile === 'hardware'
    ? ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding']
    : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']
});
const captures = [];
try {
  for (const profile of selectedProfiles) {
    for (const chapter of chapters) {
      captures.push(await captureChapter(browser, chapter, profile));
    }
  }
} finally {
  await browser.close();
}

const reportPath = `${outputDirectory}/capture-report.json`;
await writeFile(reportPath, `${JSON.stringify({ baseUrl, captures, headless, rendererProfile }, null, 2)}\n`, 'utf8');
const failures = captures.flatMap(({ chapter, consoleErrors, failedResponses, profile }) => [
  ...consoleErrors.map((message) => `${chapter}장 ${profile} console: ${message}`),
  ...failedResponses.map((message) => `${chapter}장 ${profile} response: ${message}`)
]);
if (failures.length > 0) throw new Error(failures.join('\n'));
console.log(JSON.stringify({ captures: captures.length, reportPath: relativeEvidencePath(reportPath), rendererProfile }, null, 2));
