import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createChapterOneEndingFixture } from '../src/reboot/story/chapterOneDirector.js';

test('Given the integrated chapter, When both routes end, Then reports differ but the signature reversal matches', () => {
  // Given: 현재 브라우저 런타임이 사용하는 두 개의 1장 결말 fixture.
  const secure = createChapterOneEndingFixture('secure');
  const purge = createChapterOneEndingFixture('purge');

  // When: 행동 결과와 마지막 반전을 비교한다.
  const secureOutcome = secure.outcome;
  const purgeOutcome = purge.outcome;

  // Then: 선택의 비용은 다르고 필수 서명 반전은 동일하다.
  assert.notEqual(secureOutcome.routeConsequenceKo, purgeOutcome.routeConsequenceKo);
  assert.equal(secureOutcome.reversalKo, purgeOutcome.reversalKo);
  assert.equal(secureOutcome.signatureRevealed, true);
  assert.equal(purgeOutcome.signatureRevealed, true);
});

test('Given each route fixture, When its authored pace is inspected, Then completion stays inside the 25–35 minute gate', () => {
  // Given: 같은 공간을 지나지만 선택 비용이 다른 두 경로.
  const secure = createChapterOneEndingFixture('secure');
  const purge = createChapterOneEndingFixture('purge');

  // When: 고정된 수직 슬라이스 시간표를 읽는다.
  const timelines = [secure.sliceTimeline, purge.sliceTimeline];

  // Then: 첫 조작·첫 전투·첫 결과와 총 완주 시간이 모두 출시 예산 안이다.
  assert.deepEqual(timelines.map((timeline) => timeline.contractVersion), [1, 1]);
  for (const timeline of timelines) {
    assert.ok(timeline.completionMinutes >= 25 && timeline.completionMinutes <= 35);
    assert.ok(timeline.firstControlSeconds <= 20);
    assert.ok(timeline.firstCombatMinutes <= 3);
    assert.ok(timeline.firstConsequenceMinutes <= 10);
  }
});

function completeManifest() {
  const run = (branch, device, p95FrameMs) => ({
    branch,
    consoleErrors: 0,
    device,
    gates: {
      automated: true, mobile: true, offline: true, performance: true,
      reducedMotion: true, saveRetry: true, visual: true
    },
    metrics: { drawCalls: 80, lights: 4, p95FrameMs, triangles: 42_000 },
    reportId: `report-${branch}`,
    signatureRevealed: true,
    timeline: createChapterOneEndingFixture(branch).sliceTimeline
  });
  return {
    blockers: [],
    runs: [run('secure', 'desktop', 16.7), run('purge', 'touch', 33.3)],
    schemaVersion: 1
  };
}

test('Given complete desktop and touch evidence, When the slice gate runs, Then expansion is allowed', async () => {
  // Given: 출시 예산과 두 갈래 결말을 모두 담은 증거 묶음.
  const contract = await import('../src/reboot/slice/contract.js');
  assert.equal(typeof contract.evaluateSliceManifest, 'function');

  // When: 수직 슬라이스 게이트를 평가한다.
  const result = contract.evaluateSliceManifest(completeManifest());

  // Then: 누락 항목 없이 다음 장 제작이 열린다.
  assert.deepEqual(result, { failures: [], pass: true });
});

test('Given incomplete and over-budget evidence, When the slice gate runs, Then every failed criterion is named', async () => {
  // Given: 모바일 완주가 없고 프레임과 오프라인 증거도 실패한 묶음.
  const contract = await import('../src/reboot/slice/contract.js');
  assert.equal(typeof contract.evaluateSliceManifest, 'function');
  const manifest = completeManifest();
  manifest.runs = [
    {
      ...manifest.runs[0],
      gates: { ...manifest.runs[0].gates, offline: false },
      metrics: { ...manifest.runs[0].metrics, p95FrameMs: 22 }
    }
  ];

  // When: 불완전한 묶음을 평가한다.
  const result = contract.evaluateSliceManifest(manifest);

  // Then: 첫 실패에서 멈추지 않고 수정할 항목을 전부 돌려준다.
  assert.equal(result.pass, false);
  assert.deepEqual(result.failures, [
    'desktop-frame-budget', 'offline-gate', 'purge-route', 'touch-completion'
  ]);
});

test('Given the repository scripts, When the slice gate command is inspected, Then it uses the deterministic manifest verifier', () => {
  // Given: CI가 읽는 package scripts.
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

  // When / Then: 증거 게이트가 단일 명령으로 고정돼 있다.
  assert.equal(packageJson.scripts['slice:gate'], 'node scripts/verify-reboot-slice.mjs');
});

test('Given a broken evidence file, When the CLI gate runs, Then it exits nonzero and names every failed criterion', () => {
  // Given: 모바일·오프라인·프레임 증거가 불완전한 임시 manifest.
  const directory = mkdtempSync(join(tmpdir(), 'h17-slice-'));
  const manifestPath = join(directory, 'broken.json');
  const manifest = completeManifest();
  manifest.runs = [{
    ...manifest.runs[0],
    gates: { ...manifest.runs[0].gates, offline: false },
    metrics: { ...manifest.runs[0].metrics, p95FrameMs: 22 }
  }];
  writeFileSync(manifestPath, JSON.stringify(manifest));

  // When: 실제 Node CLI 어댑터를 실행한다.
  const result = spawnSync(process.execPath, ['scripts/verify-reboot-slice.mjs', manifestPath], {
    encoding: 'utf8'
  });
  rmSync(directory, { force: true, recursive: true });

  // Then: 수정할 네 항목을 모두 출력하고 출시를 막는다.
  assert.equal(result.status, 1);
  assert.match(result.stderr, /desktop-frame-budget/);
  assert.match(result.stderr, /offline-gate/);
  assert.match(result.stderr, /purge-route/);
  assert.match(result.stderr, /touch-completion/);
});
