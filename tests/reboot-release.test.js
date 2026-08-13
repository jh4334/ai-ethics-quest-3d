import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('canonical 2D root, preserved 3D routes, and service worker form one release boundary', () => {
  const index = read('index.html');
  const legacy = read('legacy.html');
  const sw = read('public/sw.js');
  const manifest = JSON.parse(read('public/reboot-assets.json'));
  assert.match(index, /data-action-canvas/);
  assert.match(index, /src="\/src\/illustrated\/entry\.js"/);
  assert.doesNotMatch(index, /location\.replace|reboot\.html/);
  assert.match(legacy, /src="\/src\/main\.js"/);
  assert.match(sw, /ENTRY_DOCUMENTS = \['\.\/index\.html', '\.\/illustrated\.html'\]/);
  assert.match(sw, /ARCHIVE_DOCUMENTS = \['\.\/reboot\.html', '\.\/legacy\.html'\]/);
  assert.match(sw, /LAZY_ASSET_PREFIXES/);
  assert.ok(manifest.some((path) => path.includes('/environment/building/')));
  assert.ok(manifest.some((path) => path.includes('/environment/materials/')));
});

test('release docs record the exact non-destructive rollback and current six-chapter 2D campaign', () => {
  const release = read('docs/reboot/release.md');
  const readme = read('README.md');
  assert.match(release, /pre-reboot-fa1ac50/);
  assert.match(release, /fa1ac503d7d21dce0ff7c43b1268fd1207f24f4c/);
  assert.match(release, /gh workflow run pages\.yml --ref main -f deploy_ref=pre-reboot-fa1ac50/);
  assert.match(release, /ethics-quest-illustrated-action-v3/);
  assert.match(release, /h17\.null\.save\.v4/);
  assert.match(release, /h17\.legacy\.v3\.backup/);
  assert.doesNotMatch(release, /git reset --hard|localStorage\.clear\(\)/);
  for (const title of ['명단에서 사라진 아이', '거짓 영상의 주인', '웃음이 만든 폭풍', '두 개의 진실', '아무도 결정하지 않는 밤', '마지막 증언']) {
    assert.match(readme, new RegExp(title));
  }
});

test('Pages CI gates unit, build, smoke, slice, browser, visual, and offline coverage', () => {
  const workflow = read('.github/workflows/pages.yml');
  for (const command of ['npm test', 'npm run build', 'npm run smoke', 'npm run slice:gate', 'npm run e2e']) {
    assert.match(workflow, new RegExp(command.replaceAll(' ', '\\s+')));
  }
  assert.match(workflow, /deploy_ref/);
  assert.match(workflow, /ref: \$\{\{ inputs\.deploy_ref \|\| github\.ref \}\}/);
  assert.match(read('tests/reboot-e2e/reboot.spec.js'), /오프라인 재실행/);
  assert.match(read('playwright.config.js'), /reducedMotion: 'reduce'/);
  assert.match(read('tests/reboot-e2e/campaign.spec.js'), /운영 루트는 저장된 2장/);
});

test('Pages CI bounds each browser suite instead of hiding a multi-hour aggregate hang', () => {
  const workflow = read('.github/workflows/pages.yml');
  assert.match(workflow, /build:\s+timeout-minutes: 120/);
  for (const spec of ['campaign', 'h17-polish', 'reboot', 'slice']) {
    assert.match(
      workflow,
      new RegExp(`npm run e2e -- tests/reboot-e2e/${spec}\\.spec\\.js --max-failures=1`)
    );
  }
  assert.doesNotMatch(workflow, /^\s*run:\s*npm run e2e\s*$/m);
});

test('every imported runtime character family has provenance', () => {
  const licenses = read('ASSET_LICENSES.md');
  const manifest = JSON.parse(read('public/reboot-assets.json'));
  assert.ok(manifest.some((path) => path.includes('/characters/base/')));
  assert.ok(manifest.some((path) => path.includes('/characters/outfits/')));
  assert.ok(manifest.some((path) => path.includes('/characters/animations/')));
  assert.match(licenses, /Universal Base Characters/);
  assert.match(licenses, /Modular Character Outfits/);
  assert.match(licenses, /Universal Animation Library 2/);
  assert.match(licenses, /CC0 1\.0/);
});
