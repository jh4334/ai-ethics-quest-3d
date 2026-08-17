import { expect, test } from '@playwright/test';

const SAVE_KEY = 'ethics-quest-illustrated-action-v3';

function captureBrowserErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`);
  });
  return errors;
}

test('2장 카피캣이 실제 키보드 SIGNAL을 복제해 플레이어에게 되돌린다', async ({ page }, testInfo) => {
  const errors = captureBrowserErrors(page);
  await page.addInitScript(({ key }) => {
    localStorage.setItem(key, JSON.stringify({
      version: 3,
      chapterIndex: 1,
      unlockedChapter: 1,
      checkpointX: 898,
      evidenceIds: [],
      decisions: {},
      completed: false
    }));
  }, { key: SAVE_KEY });

  await page.goto('/?testHook=1', { waitUntil: 'domcontentloaded' });
  const game = page.locator('[data-illustrated-game]');
  await expect(game).toHaveAttribute('data-game-phase', 'title');
  await page.locator('[data-continue-game]').click();
  await expect(game).toHaveAttribute('data-chapter', '2');
  await expect(game).toHaveAttribute('data-game-phase', 'intro');

  while (await game.getAttribute('data-game-phase') === 'intro') {
    await page.locator('[data-story-next]').click();
  }
  await expect(game).toHaveAttribute('data-game-phase', 'playing');
  await page.evaluate(() => {
    const state = window.__illustratedAction.getState();
    const enemy = state.enemies[0];
    state.player.x = enemy.x - 42;
    state.player.y = state.world.groundY;
    state.player.invulnerable = 0;
    for (const target of state.enemies) target.attackCooldown = 999;
  });

  await expect(page.locator('[data-health]')).toHaveAttribute('aria-label', '기록 안정도 5');
  await page.keyboard.down('j');
  await expect(game).toHaveAttribute('data-last-event', 'signal-copied');
  await expect(game).toHaveAttribute('data-ethics-status', '복제 반격 예정');
  await page.keyboard.up('j');
  await expect(page.locator('[data-health]')).toHaveAttribute('aria-label', '기록 안정도 4', { timeout: 3_000 });

  const combatState = await page.evaluate(() => {
    const state = window.__illustratedAction.getState();
    return {
      enemyHp: state.enemies[0].hp,
      playerHp: state.player.hp,
      lastEvent: state.lastEvent
    };
  });
  expect(combatState).toEqual({ enemyHp: 3, playerHp: 4, lastEvent: 'player-hit' });
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('chapter-2-copycat-return.png'), fullPage: true });
});
