import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { QA_SCENE_IDS } from '../../src/reboot/app/qaSceneFixtures.js';

const rootUrl = new URL('../../', import.meta.url);

test('QA fixture는 튜토리얼부터 보스 전 단계와 복구 화면까지 고정 ID를 제공한다', () => {
  const required = [
    'qa-tutorial', 'qa-arena', 'qa-consequence-secure', 'qa-consequence-purge',
    'qa-boss-phase-1', 'qa-boss-phase-2', 'qa-boss-phase-3',
    'qa-result-secure', 'qa-corrupt-save', 'qa-low-performance',
    'qa-dual-school-comfort', 'qa-dual-school-verified',
    'qa-final-redacted', 'qa-final-raw', 'qa-final-sealed'
  ];
  assert.deepEqual(required.filter((id) => !QA_SCENE_IDS.includes(id)), []);
  assert.equal(new Set(QA_SCENE_IDS).size, QA_SCENE_IDS.length);
});

test('로컬과 CI는 같은 Playwright Chromium 설치 및 중첩 테스트 명령을 사용한다', () => {
  const pkg = JSON.parse(readFileSync(new URL('package.json', rootUrl), 'utf8'));
  const workflow = readFileSync(new URL('.github/workflows/pages.yml', rootUrl), 'utf8');
  assert.equal(pkg.devDependencies['@playwright/test'], '1.62.0');
  assert.equal(pkg.scripts.test, 'node tests/run-node-tests.mjs');
  assert.equal(pkg.scripts['browser:install'], 'playwright install chromium');
  assert.match(workflow, /npx playwright install --with-deps chromium/);
  assert.match(workflow, /npm run e2e/);
});

test('서비스 워커는 reboot 문서와 양쪽 빌드 자산을 오프라인 캐시에 포함한다', () => {
  const sw = readFileSync(new URL('public/sw.js', rootUrl), 'utf8');
  const reboot = readFileSync(new URL('reboot.html', rootUrl), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('public/reboot-assets.json', rootUrl), 'utf8'));
  assert.match(sw, /\.\/reboot\.html/);
  assert.match(sw, /\['\.\/index\.html', '\.\/reboot\.html'\]/);
  assert.equal(manifest.some((asset) => asset.endsWith('ual2-standard.glb')), true);
  assert.equal(manifest.some((asset) => asset.endsWith('Male_Ranger.gltf')), true);
  assert.match(reboot, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/);
});
