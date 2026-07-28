import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('canonical root, legacy route, and service worker form one release boundary', () => {
  const index = read('index.html');
  const legacy = read('legacy.html');
  const sw = read('public/sw.js');
  assert.match(index, /location\.replace\(rebootUrl\.href\)/);
  assert.match(legacy, /src="\/src\/main\.js"/);
  assert.match(sw, /ethics-quest-h17-v10/);
  assert.match(sw, /\.\/index\.html', '\.\/reboot\.html', '\.\/legacy\.html/);
});

test('release docs record the exact non-destructive rollback and current five chapters', () => {
  const release = read('docs/reboot/release.md');
  const readme = read('README.md');
  assert.match(release, /pre-reboot-fa1ac50/);
  assert.match(release, /fa1ac503d7d21dce0ff7c43b1268fd1207f24f4c/);
  assert.match(release, /gh workflow run pages\.yml --ref main -f deploy_ref=pre-reboot-fa1ac50/);
  assert.match(release, /h17\.null\.save\.v4/);
  assert.match(release, /h17\.legacy\.v3\.backup/);
  assert.doesNotMatch(release, /git reset --hard|localStorage\.clear\(\)/);
  for (const title of ['00:17 — 출석번호 없음', '웃는 얼굴의 폭동', '두 개의 학교', '3초 승인실', '마지막 방송']) {
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
