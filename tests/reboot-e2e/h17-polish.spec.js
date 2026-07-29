import { expect, test } from '@playwright/test';

const QUERY = 'testHook=h17&tools=hidden&motion=reduced&sound=off&sw=off';

function captureErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function openFixture(page, fixture, suffix = '') {
  await page.goto(`/reboot.html?${QUERY}&fixture=${fixture}${suffix}`, {
    waitUntil: 'domcontentloaded'
  });
  const canvas = page.locator('[data-reboot-canvas]');
  await expect(canvas).toHaveAttribute('data-characters', 'ready', { timeout: 60_000 });
  return canvas;
}

async function expectNoOverlap(first, second) {
  const [firstBox, secondBox] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  const overlaps = firstBox.x < secondBox.x + secondBox.width
    && firstBox.x + firstBox.width > secondBox.x
    && firstBox.y < secondBox.y + secondBox.height
    && firstBox.y + firstBox.height > secondBox.y;
  expect(overlaps).toBe(false);
}

async function masterLoop4Finale(page, canvas) {
  const sequence = [
    ['reflect-shield', 'k'], ['trace-consent', 'e'], ['dash-relay', 'Space'], ['signal-core', 'j']
  ];
  for (const [phase, key] of sequence) {
    await expect(canvas).toHaveAttribute('data-protocol-phase', phase);
    await expect.poll(async () => Number(await canvas.getAttribute('data-protocol-phase-tick')) >= 18).toBe(true);
    await page.keyboard.press(key);
  }
  await expect(canvas).toHaveAttribute('data-protocol-status', 'victory');
  await expect(page.locator('[data-chapter-result]')).toBeVisible();
}

async function masterFinaleWithTouch(page, canvas) {
  const sequence = [
    ['reflect-shield', 'reflect'], ['trace-consent', 'trace'],
    ['dash-relay', 'dash'], ['signal-core', 'attack']
  ];
  let pointerId = 50;
  for (const [phase, action] of sequence) {
    await expect(canvas).toHaveAttribute('data-protocol-phase', phase);
    await expect.poll(async () => Number(await canvas.getAttribute('data-protocol-phase-tick')) >= 18).toBe(true);
    const button = page.locator(`[data-touch-action="${action}"]`);
    await button.dispatchEvent('pointerdown', { button: 0, isPrimary: true, pointerId });
    await button.dispatchEvent('pointerup', { button: 0, isPrimary: true, pointerId });
    pointerId += 1;
  }
  await expect(canvas).toHaveAttribute('data-protocol-status', 'victory');
  await expect(page.locator('[data-chapter-result]')).toBeVisible();
}

test('@loop1-desktop shows four distinct live-camera character identities', async ({ page }) => {
  const errors = captureErrors(page);
  await page.setViewportSize({ width: 1180, height: 820 });
  await openFixture(page, 'qa-tutorial', '&viewport=landscape');
  const debug = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState());
  const identities = debug.characters.identities;
  expect(debug.characters.errors).toEqual([]);
  expect(identities.map(({ id }) => id)).toEqual(['player', 'dot', 'haru', 'yoonseo']);
  expect(new Set(identities.map(({ silhouette }) => silhouette)).size).toBe(4);
  expect(identities.find(({ id }) => id === 'dot').kind).toBe('audit-drone');
  const humans = identities.filter(({ kind }) => kind === 'human');
  expect(humans.every(({ visualScale }) => visualScale === 1.3)).toBe(true);
  expect(humans.every(({ presentation }) => (
    presentation.hairEmissive >= presentation.skinEmissive
    && presentation.skinEmissive > presentation.outfitEmissive
    && Math.max(...Object.values(presentation)) <= 0.22
  ))).toBe(true);
  await page.screenshot({ path: '.omo/evidence/h17-loop-1-characters-desktop.png' });
  expect(errors).toEqual([]);
});

test('@loop1-mobile preserves cast and controls at the combat-camera edge', async ({ page }) => {
  const errors = captureErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const arenaCanvas = await openFixture(page, 'qa-arena', '&quality=low&viewport=portrait');
  let debug;
  await expect.poll(async () => {
    const candidate = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState());
    if (candidate.camera.combatSafeArea?.mode === 'arena') {
      debug = candidate;
      await page.screenshot({ path: '.omo/evidence/h17-loop-1-characters-mobile-combat.png' });
    }
    return candidate.camera.combatSafeArea?.mode;
  }, { intervals: [50], timeout: 15_000 }).toBe('arena');
  expect(debug.characters.errors).toEqual([]);
  expect(debug.characters.identities).toHaveLength(4);
  expect(debug.camera.combatSafeArea?.mode).toBe('arena');
  expect(debug.camera.combatSafeArea?.allIncluded, JSON.stringify(debug.camera.combatSafeArea)).toBe(true);
  expect(debug.camera.combatSafeArea?.includedIds).toEqual(['player', 'threat', 'telegraph']);
  expect(debug.camera.combatSafeArea?.bounds.every((bounds) => (
    bounds.left >= debug.camera.combatSafeArea.safeRect.left
    && bounds.right <= debug.camera.combatSafeArea.safeRect.right
    && bounds.top >= debug.camera.combatSafeArea.safeRect.top
    && bounds.bottom <= debug.camera.combatSafeArea.safeRect.bottom
  ))).toBe(true);
  expect(debug.characters.identities.filter(({ kind }) => kind === 'human')
    .every(({ visualScale }) => visualScale === 1.3)).toBe(true);
  await expect(arenaCanvas).toHaveAttribute('data-dpr', '1');
  expect(Number(await arenaCanvas.getAttribute('data-light-count'))).toBeLessThanOrEqual(4);
  await expect(page.locator('[data-touch-action="attack"]')).toBeVisible();

  const tutorialCanvas = await openFixture(page, 'qa-tutorial', '&quality=low&viewport=portrait');
  debug = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState());
  expect(debug.characters.identities).toHaveLength(4);
  await expect(tutorialCanvas).toHaveAttribute('data-dpr', '1');
  await page.screenshot({ path: '.omo/evidence/h17-loop-1-characters-mobile.png' });
  expect(errors).toEqual([]);
});

test('@loop2-desktop keeps story cues readable during arena actions', async ({ page }) => {
  const errors = captureErrors(page);
  await page.setViewportSize({ width: 1180, height: 820 });
  const canvas = await openFixture(page, 'qa-arena', '&viewport=landscape');
  const objective = page.locator('[data-route-objective]');
  const radio = page.locator('[data-radio-subtitle]');
  const feedback = page.locator('[data-feedback-prompts]');
  const touchControls = page.locator('[data-touch-controls]');
  await expect(objective).toContainText('명령 번호 추적');
  await expect(radio).toBeVisible();
  await expect(radio).toContainText('검증용 백업');
  await page.keyboard.press('e');
  await page.keyboard.press('k');
  await page.keyboard.press('j');
  await expect.poll(async () => Number(await canvas.getAttribute('data-feedback-prompt-count')))
    .toBeGreaterThan(0);
  await expect(feedback).toBeVisible();
  await expectNoOverlap(radio, feedback);
  await expect(page.locator('[data-reboot-root]')).toHaveAttribute('data-touch-mode', 'false');
  await expect(touchControls).toBeHidden();
  const visibleCopy = await page.locator('[data-route-objective], [data-radio-subtitle], [data-feedback-prompts]')
    .allTextContents();
  expect(visibleCopy.join(' ')).not.toMatch(/PLAYER-ID|정답|오답|도덕 점수|벌점/);
  await page.screenshot({ path: '.omo/evidence/h17-loop-2-story-desktop.png' });
  expect(errors).toEqual([]);
});

test('@loop2-mobile separates result semantics from touch controls', async ({ page }) => {
  const errors = captureErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page, 'qa-consequence-secure', '&quality=low&viewport=portrait');
  const result = page.locator('[data-chapter-result]');
  const touchActions = page.locator('.touch-actions');
  await expect(result).toBeVisible();
  await expect(result.locator('[data-result-action]')).toContainText('내 선택');
  await expect(result.locator('[data-result-consequence]')).toContainText('변화');
  await expect(result.locator('[data-result-reversal]')).toContainText('남은 질문');
  await expect(page.locator('[data-touch-action="attack"]')).toBeVisible();
  await expectNoOverlap(result, touchActions);
  const fit = await result.locator('h2, p').evaluateAll((elements) => elements.every((element) => (
    element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1
  )));
  expect(fit).toBe(true);
  expect(await result.textContent()).not.toMatch(/정답|오답|도덕 점수|벌점/);
  await page.screenshot({ path: '.omo/evidence/h17-loop-2-story-mobile.png' });
  expect(errors).toEqual([]);
});

test('@loop3-desktop distinguishes the chapter-one school spaces within route budgets', async ({ page }) => {
  const errors = captureErrors(page);
  await page.setViewportSize({ width: 1180, height: 820 });
  await openFixture(page, 'qa-tutorial', '&viewport=landscape');
  let debug = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState());
  expect(debug.route.landmarksBySegment['classroom-cold-open'].map(({ id }) => id)).toContain('classroom-student-desks');

  const canvas = await openFixture(page, 'qa-arena', '&viewport=landscape');
  debug = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState());
  expect(debug.route.landmarksBySegment['first-arena'].map(({ id }) => id)).toContain('arena-source-grid');
  expect(debug.route.budget.drawCalls).toBeLessThanOrEqual(18);
  expect(debug.route.budget.triangles).toBeLessThanOrEqual(5000);
  expect(Number(await canvas.getAttribute('data-draw-calls'))).toBeLessThanOrEqual(250);
  expect(Number(await canvas.getAttribute('data-triangles'))).toBeLessThanOrEqual(150_000);
  expect(Number(await canvas.getAttribute('data-light-count'))).toBeLessThanOrEqual(4);
  await page.screenshot({ path: '.omo/evidence/h17-loop-3-school-desktop.png' });

  await openFixture(page, 'route-memory', '&viewport=landscape');
  debug = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState());
  expect(debug.route.landmarksBySegment['memory-backup-decision'].map(({ id }) => id)).toContain('memory-evidence-frame');
  await page.screenshot({ path: '.omo/evidence/h17-loop-3-school-memory.png' });

  await openFixture(page, 'boss-secure', '&viewport=landscape');
  debug = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState());
  expect(debug.route.landmarksBySegment['gym-boss-arena'].map(({ id }) => id)).toContain('gym-approval-server');
  await page.screenshot({ path: '.omo/evidence/h17-loop-3-school-boss.png' });

  await openFixture(page, 'route-gym', '&viewport=landscape');
  debug = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState());
  expect(debug.routeSegmentId).toBe('gym-boss-arena');
  await page.screenshot({ path: '.omo/evidence/h17-loop-3-school-gym.png' });
  expect(errors).toEqual([]);
});

test('@loop3-mobile keeps classroom landmarks readable beside touch controls', async ({ page }) => {
  const errors = captureErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const canvas = await openFixture(page, 'qa-tutorial', '&quality=low&viewport=portrait');
  const debug = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState());
  expect(debug.route.landmarksBySegment['classroom-cold-open']).toHaveLength(4);
  expect(debug.camera.allIncluded).toBe(true);
  await expect(canvas).toHaveAttribute('data-dpr', '1');
  expect(Number(await canvas.getAttribute('data-light-count'))).toBeLessThanOrEqual(4);
  await expect(page.locator('[data-touch-action="attack"]')).toBeVisible();
  await expectNoOverlap(page.locator('[data-route-objective]'), page.locator('.touch-actions'));
  await page.screenshot({ path: '.omo/evidence/h17-loop-3-school-mobile.png' });
  expect(errors).toEqual([]);
});

test('@loop4-desktop separates share-chain dual-school and approval-room spaces', async ({ page }) => {
  const errors = captureErrors(page);
  await page.setViewportSize({ width: 1180, height: 820 });
  const fixtures = [
    ['campaign-chapter-2', 'share-chain', 'share-source-trace', 'h17-loop-4-share-chain-desktop.png'],
    ['qa-dual-school-comfort', 'dual-school', 'dual-unequal-records', 'h17-loop-4-dual-school-desktop.png'],
    ['campaign-chapter-4', 'approval-room', 'approval-yoonseo-terminal', 'h17-loop-4-campaign-desktop.png']
  ];
  const captures = [];
  for (const [fixture, type, landmarkId, filename] of fixtures) {
    await openFixture(page, fixture, '&quality=low&viewport=landscape');
    captures.push({ debug: await page.evaluate(() => window.__ethicsReboot.getSceneDebugState()), landmarkId, type });
    await page.screenshot({ path: `.omo/evidence/${filename}` });
  }
  for (const { debug, landmarkId, type } of captures) {
    expect(debug.landmarks?.type).toBe(type);
    expect(debug.landmarks?.landmarkIds).toContain(landmarkId);
    expect(debug.landmarks?.budget.drawCalls).toBeLessThanOrEqual(8);
    expect(debug.landmarks?.budget.triangles).toBeLessThanOrEqual(1600);
  }
  expect(new Set(captures.map(({ debug }) => debug.landmarks.landmarkIds.join(':'))).size).toBe(3);
  expect(errors).toEqual([]);
});

test('@loop4-desktop stages the public broadcast conflict as a distinct finale', async ({ page }) => {
  const errors = captureErrors(page);
  await page.setViewportSize({ width: 1180, height: 820 });
  await openFixture(page, 'qa-final-redacted', '&quality=low&viewport=landscape');
  const debug = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState());
  await page.screenshot({ path: '.omo/evidence/h17-loop-4-finale-desktop.png' });
  expect(debug.landmarks?.type).toBe('finale');
  expect(debug.landmarks?.variant).toBe('secure');
  expect(debug.landmarks?.landmarkIds).toEqual(expect.arrayContaining([
    'finale-haru-stage', 'finale-dot-stage', 'finale-lumen-stage',
    'finale-broadcast-booth', 'finale-evidence-beam', 'finale-public-feed'
  ]));
  expect(errors).toEqual([]);
});

test('@loop4-mobile keeps secure and purge finale staging distinct above touch controls', async ({ page }) => {
  const errors = captureErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const variants = [
    ['qa-final-redacted', 'secure', 'h17-loop-4-finale-secure-mobile.png'],
    ['qa-final-sealed', 'purge', 'h17-loop-4-finale-purge-mobile.png']
  ];
  const captures = [];
  for (const [fixture, variant, filename] of variants) {
    const canvas = await openFixture(page, fixture, '&quality=low&viewport=portrait');
    const debug = await page.evaluate(() => window.__ethicsReboot.getSceneDebugState());
    captures.push({ debug, variant });
    expect(debug.finaleFrame?.allIncluded).toBe(true);
    expect(debug.finaleFrame?.includedIds).toEqual(['player', 'haru-platform', 'dot-platform', 'lumen-platform']);
    expect(debug.finaleFrame?.bounds.every((bounds) => (
      bounds.left >= debug.finaleFrame.safeRect.left
      && bounds.right <= debug.finaleFrame.safeRect.right
      && bounds.top >= debug.finaleFrame.safeRect.top
      && bounds.bottom <= debug.finaleFrame.safeRect.bottom
    ))).toBe(true);
    await expect(page.locator('[data-touch-action="attack"]')).toBeVisible();
    await masterLoop4Finale(page, canvas);
    const result = page.locator('[data-chapter-result]');
    await expectNoOverlap(result, page.locator('.touch-actions'));
    const fit = await result.locator('h2, p').evaluateAll((elements) => elements.every((element) => (
      element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1
    )));
    expect(fit).toBe(true);
    await page.screenshot({ path: `.omo/evidence/${filename}` });
  }
  for (const { debug, variant } of captures) {
    expect(debug.landmarks?.variant).toBe(variant);
    expect(debug.landmarks?.budget.drawCalls).toBeLessThanOrEqual(8);
    expect(debug.landmarks?.budget.instances).toBeLessThanOrEqual(48);
  }
  expect(captures[0].debug.landmarks.landmarkIds).not.toEqual(captures[1].debug.landmarks.landmarkIds);
  expect(errors).toEqual([]);
});

test('@final-desktop completes the secure route with keyboard and accessible results', async ({ page }) => {
  const errors = captureErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1180, height: 820 });
  const canvas = await openFixture(page, 'qa-final-redacted', '&quality=low&viewport=landscape');
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await expect(page.locator('[data-reboot-root]')).toHaveAttribute('data-touch-mode', 'false');
  await expect(page.locator('[data-touch-controls]')).toBeHidden();

  await page.keyboard.press('Tab');
  await expect(page.locator('[data-pause]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-restart]')).toBeFocused();
  await masterLoop4Finale(page, canvas);

  const result = page.locator('[data-chapter-result]');
  await expect(result).toHaveAttribute('role', 'status');
  await expect(result).toHaveAttribute('aria-live', 'polite');
  await expect(result).toHaveAttribute('aria-atomic', 'true');
  await expect(page.locator('[data-reboot-status][aria-live="polite"]')).toBeVisible();
  await expect(page.locator('.hint')).toBeHidden();
  await expectNoOverlap(result, page.locator('.actions'));
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-campaign-continue]')).toBeFocused();
  await page.screenshot({ path: '.omo/evidence/h17-loop-5-final-desktop.png' });
  expect(errors).toEqual([]);
});

test('@final-mobile completes the purge route with touch and unobstructed accessible results', async ({ page }) => {
  const errors = captureErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  const canvas = await openFixture(page, 'qa-final-sealed', '&quality=low&viewport=portrait');
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);

  const touchButtons = page.locator('.touch-actions [data-touch-action]');
  await expect(touchButtons).toHaveCount(8);
  const touchTargetsPass = await touchButtons.evaluateAll((buttons) => buttons.every((button) => {
    const bounds = button.getBoundingClientRect();
    return bounds.width >= 50 && bounds.height >= 52;
  }));
  expect(touchTargetsPass).toBe(true);
  await masterFinaleWithTouch(page, canvas);

  const result = page.locator('[data-chapter-result]');
  const continueButton = page.locator('[data-campaign-continue]');
  await expect(result).toHaveAttribute('role', 'status');
  await expect(result).toHaveAttribute('aria-live', 'polite');
  await expect(result).toHaveAttribute('aria-atomic', 'true');
  await expect(page.locator('[data-reboot-status][aria-live="polite"]')).toBeVisible();
  await expectNoOverlap(result, page.locator('.touch-actions'));
  await expectNoOverlap(continueButton, page.locator('.touch-actions'));
  const textFits = await result.locator('h2, p').evaluateAll((elements) => elements.every((element) => (
    element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1
  )));
  expect(textFits).toBe(true);
  await page.screenshot({ path: '.omo/evidence/h17-loop-5-final-mobile.png' });
  expect(errors).toEqual([]);
});
