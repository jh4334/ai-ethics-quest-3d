import { expect, test } from '@playwright/test';
import { copyFile } from 'node:fs/promises';

import { serializeSave } from '../../src/reboot/save/codec.js';
import { V5_SAVE_KEY } from '../../src/reboot/save/repository.js';
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

// 2~4장 방 실전투 헬퍼 — 페이지 안 루프에서 실제 KeyboardEvent를 입력 라우터로 흘려
// 살아 있는 가장 가까운 적을 향해 이동을 유지하고(마지막 이동 방향 = 칼날·반사 조준)
// 동사 키·공격 키를 반복한다. CDP 키 왕복(키당 수백 ms)로는 다인 웨이브의 피해 교환을
// 못 따라가 리스폰 루프에 빠지므로 조준·연타는 페이지 안에서 굴린다. 주기는 rAF가 아니라
// 짧은 타임아웃 — 헤드리스 저사양에서 rAF는 6~10fps로 떨어져 프레임당 시뮬 틱이 몰리므로,
// 매 반복 공격을 큐에 채워야 씹히지 않는다. 단계 전진 단언은 Playwright 쪽에서 유지한다.
async function clearCampaignWave(page, canvas, verbKey, clearedWaves) {
  await page.evaluate(async ({ targetStep, verbCode }) => {
    const dispatch = (type, code) => window.dispatchEvent(
      new KeyboardEvent(type, { bubbles: true, cancelable: true, code })
    );
    const held = new Set();
    const hold = (code, active) => {
      if (active && !held.has(code)) { held.add(code); dispatch('keydown', code); }
      else if (!active && held.has(code)) { held.delete(code); dispatch('keyup', code); }
    };
    const tap = (code) => { dispatch('keydown', code); dispatch('keyup', code); };
    const sceneCanvas = document.querySelector('[data-reboot-canvas]');
    const nextBeat = () => new Promise((resolve) => setTimeout(resolve, 16));
    const deadline = performance.now() + 60_000;
    let beat = 0;
    try {
      while (performance.now() < deadline) {
        if (Number(sceneCanvas.dataset.campaignStep) >= targetStep) return;
        const debug = window.__ethicsReboot.getSceneDebugState();
        const target = debug.enemies.find((enemy) => enemy.phase !== 'defeat');
        if (target) {
          if (sceneCanvas.dataset.campaignInteractionStatus !== 'resolved') {
            tap(verbCode);
            beat += 1;
            await nextBeat();
            continue;
          }
          // 전투 시뮬 좌표: player.position.y = 월드 z. 1.2보다 멀면 적 방향 축 키를 유지한다.
          const dx = target.position.x - debug.player.position.x;
          const dz = target.position.z - debug.player.position.y;
          const far = Math.hypot(dx, dz) > 1.2;
          hold('KeyD', far && dx > 0.4);
          hold('KeyA', far && dx < -0.4);
          hold('KeyS', far && dz > 0.4);
          hold('KeyW', far && dz < -0.4);
          tap('KeyJ');
        }
        beat += 1;
        await nextBeat();
      }
    } finally {
      for (const code of [...held]) dispatch('keyup', code);
    }
  }, { targetStep: clearedWaves, verbCode: verbKey });
  await expect.poll(
    async () => Number(await canvas.getAttribute('data-campaign-step')),
    { timeout: 10_000 }
  ).toBeGreaterThanOrEqual(clearedWaves);
}

// 웨이브 i 전멸 = 단계 i+1 — 세 웨이브를 모두 깨면 결정 단계(F/Q)가 열린다.
async function fightCampaignChapter(page, canvas, verbKeys) {
  await expect(canvas).toHaveAttribute('data-campaign-step', '0');
  const visitedZones = [];
  for (const [wave, verbKey] of verbKeys.entries()) {
    visitedZones.push(await canvas.getAttribute('data-campaign-zone'));
    await clearCampaignWave(page, canvas, verbKey, wave + 1);
  }
  await expect(canvas).toHaveAttribute('data-campaign-expected-action', 'decision');
  await expect(canvas).toHaveAttribute('data-campaign-enemies-alive', '0');
  const resolvedInteractions = (await canvas.getAttribute('data-campaign-resolved-interactions'))
    ?.split(',').filter(Boolean) ?? [];
  expect(resolvedInteractions).toHaveLength(3);
  return visitedZones;
}

// S3c: LUMEN 압박 펄스 — 윈드업(data-protocol-pulse=windup)이 보이면 단계 키보다 먼저 K로
// 방어한다(reflect-shield에서는 방어가 우선 소비되므로 다음 반복에서 단계 키를 다시 누른다).
// 폴 간격은 윈드업 창(30틱 = 0.5초)보다 짧게 유지해 무방비 명중·단계 리셋을 피한다.
async function masterFinale(page, canvas) {
  const sequence = [
    ['reflect-shield', 'k'],
    ['trace-consent', 'e'],
    ['dash-relay', 'Space'],
    ['signal-core', 'j']
  ];
  for (const [phase, key] of sequence) {
    await expect(canvas).toHaveAttribute('data-protocol-phase', phase);
    await expect.poll(async () => {
      if (await canvas.getAttribute('data-protocol-status') !== 'active') return 'cleared';
      if (await canvas.getAttribute('data-protocol-phase') !== phase) return 'cleared';
      if (await canvas.getAttribute('data-protocol-pulse') === 'windup') {
        await page.keyboard.press('k');
      } else if (Number(await canvas.getAttribute('data-protocol-phase-tick')) >= 18) {
        await page.keyboard.press(key);
      }
      return 'pending';
    }, { intervals: [120], timeout: 30_000 }).toBe('cleared');
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
    // 실전투 헬퍼가 __ethicsReboot 디버그 훅으로 적 위치를 읽는다(운영 URL은 그대로 유지).
    sessionStorage.setItem('h17.testHook', 'true');
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
  await expect.poll(async () => Number(await canvas.getAttribute('data-draw-calls'))).toBeGreaterThan(0);
  await expect.poll(async () => Number(await canvas.getAttribute('data-triangles'))).toBeGreaterThan(0);
  await expect.poll(async () => Number(await canvas.getAttribute('data-p95-frame-ms'))).toBeLessThanOrEqual(100);
  await expect(canvas).toHaveAttribute('data-light-count', '2');

  // 실전투 — 2장 웨이브 동사 순서(REFLECT·TRACE·ATTACK)대로 세 웨이브를 전멸시킨 뒤 F로 보존한다.
  const visitedZones = await fightCampaignChapter(page, canvas, ['KeyK', 'KeyE', 'KeyJ']);
  expect(new Set(visitedZones).size).toBe(3);
  const spatialDebug = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState());
  expect(spatialDebug.player.position.y).toBeLessThan(-58);
  await page.keyboard.press('KeyF');
  await expect(canvas).toHaveAttribute('data-campaign-completed', 'true');
  await expect(page.locator('[data-campaign-continue]')).toBeVisible();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), V5_SAVE_KEY);
  expect(saved.chapterProgress).toEqual({ completed: [1, 2], current: 3, checkpoint: 'chapter-3:start' });
  expect(saved.evidence.at(-1)).toEqual({ action: 'secure', chapter: 2, evidenceId: 'original-upload-trace' });

  await page.locator('[data-campaign-continue]').click();
  await expect(page.locator('[data-reboot-canvas]')).toHaveAttribute('data-campaign-chapter', '3');
  await expect(page.locator('[data-reboot-canvas]')).toHaveAttribute('data-characters', 'ready', { timeout: 60_000 });
  expect(errors).toEqual([]);
});

for (const [chapter, verbKeys] of [[3, ['KeyE', 'KeyE', 'KeyJ']], [4, ['KeyK', 'KeyE', 'KeyJ']]]) {
  test(`Given ${chapter}장 저장, When 실제 이동과 전투를 반복하면, Then 서로 다른 세 공간을 완주한다`, async ({ page }) => {
    const errors = captureErrors(page);
    const state = setChapterCheckpoint(createInitialRebootState({
      motion: 'reduced', quality: 'low', sound: false
    }), chapter, `chapter-${chapter}:start`);
    await page.addInitScript(({ bytes, key }) => {
      sessionStorage.setItem('h17.testHook', 'true');
      localStorage.setItem(key, bytes);
    }, { bytes: serializeSave(state), key: V5_SAVE_KEY });

    await page.goto('/?sw=off', { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('[data-reboot-canvas]');
    await expect(canvas).toHaveAttribute('data-campaign-chapter', String(chapter));
    await expect(canvas).toHaveAttribute('data-characters', 'ready', { timeout: 60_000 });

    const visitedZones = await fightCampaignChapter(page, canvas, verbKeys);
    const debug = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState());
    expect(new Set(visitedZones).size).toBe(3);
    expect(debug.player.position.y).toBeLessThan(-58);
    expect(debug.performance.render.calls).toBeGreaterThan(0);
    expect(debug.performance.render.triangles).toBeGreaterThan(0);
    expect(debug.performance.render.lights).toBe(2);
    expect(errors).toEqual([]);
  });
}

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
