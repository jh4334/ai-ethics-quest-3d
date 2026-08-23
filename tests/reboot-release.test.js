import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('canonical 3D storybook root, preserved rollback routes, and service worker form one release boundary', () => {
  const index = read('index.html');
  const legacy = read('legacy.html');
  const sw = read('public/sw.js');
  const manifest = JSON.parse(read('public/reboot-assets.json'));
  assert.match(index, /data-storybook-canvas/);
  assert.match(index, /src="\/src\/storybook3d\/entry\.js"/);
  assert.match(index, /illustrated\.html/);
  assert.doesNotMatch(index, /data-action-canvas|location\.replace/);
  assert.match(legacy, /src="\/src\/main\.js"/);
  assert.match(sw, /ENTRY_DOCUMENTS = \['\.\/index\.html', '\.\/illustrated\.html'\]/);
  assert.match(sw, /ARCHIVE_DOCUMENTS = \['\.\/reboot\.html', '\.\/legacy\.html'\]/);
  assert.match(sw, /LAZY_ASSET_PREFIXES/);
  assert.ok(manifest.some((path) => path.includes('/environment/building/')));
  assert.ok(manifest.some((path) => path.includes('/environment/materials/')));
});

test('release docs record the exact non-destructive rollback and current six-chapter 3D storybook', () => {
  const release = read('docs/reboot/release.md');
  const readme = read('README.md');
  assert.match(release, /pre-reboot-fa1ac50/);
  assert.match(release, /fa1ac503d7d21dce0ff7c43b1268fd1207f24f4c/);
  assert.match(release, /gh workflow run pages\.yml --ref main -f deploy_ref=pre-reboot-fa1ac50/);
  assert.match(release, /ethics-quest-illustrated-action-v3/);
  assert.match(release, /h17\.null\.save\.v4/);
  assert.match(release, /h17\.legacy\.v3\.backup/);
  assert.doesNotMatch(release, /git reset --hard|localStorage\.clear\(\)/);
  for (const title of ['빈자리의 서랍', '저울나무가 기운 쪽', '이름을 삼킨 축제', '목소리를 입은 종이새', '손 없는 도장', '하얀 방의 반딧불']) {
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
