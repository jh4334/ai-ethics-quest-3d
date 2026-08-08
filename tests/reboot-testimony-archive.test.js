import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';

import {
  TESTIMONY_ZONES,
  advanceTestimonyArchive,
  createTestimonyArchiveProgress,
  getTestimonyEncounter,
  restoreTestimonyArchiveProgress,
  testimonyArchiveCheckpoint,
  unlockedTestimonySegmentIds
} from '../src/reboot/campaign/testimonyArchive.js';
import { createTestimonyArchiveEnvironment } from '../src/reboot/render/testimonyArchiveEnvironment.js';
import { setChapterCheckpoint } from '../src/reboot/state/consequences.js';
import { createInitialRebootState } from '../src/reboot/state/model.js';

test('증언 보관소는 서로 떨어진 네 공간에 고유 조사·전투 계약을 둔다', () => {
  assert.deepEqual(TESTIMONY_ZONES.map(({ id }) => id), [
    'testimony-intake', 'consent-redaction-lab', 'privacy-crosscheck', 'verification-vault'
  ]);
  assert.equal(new Set(TESTIMONY_ZONES.map(({ landmarkId }) => landmarkId)).size, 4);
  assert.equal(TESTIMONY_ZONES.every(({ encounter }) => encounter.spawns.length > 0), true);
  assert.equal(TESTIMONY_ZONES.every((zone, index) => index === 0
    || Math.abs(zone.anchorZ - TESTIMONY_ZONES[index - 1].anchorZ) >= 16), true);
});

test('각 전투 뒤 출처 추적·무단 복사 반사·개인정보 대조를 거쳐 결정 금고가 열린다', () => {
  let progress = createTestimonyArchiveProgress();
  assert.deepEqual(unlockedTestimonySegmentIds(progress), ['testimony-intake']);

  progress = advanceTestimonyArchive(progress, 'combat-cleared');
  assert.equal(progress.phase, 'clue');
  assert.equal(progress.expectedAction, 'trace');
  assert.equal(advanceTestimonyArchive(progress, 'reflect'), progress);
  progress = advanceTestimonyArchive(progress, 'trace');
  assert.equal(progress.zoneIndex, 1);

  progress = advanceTestimonyArchive(progress, 'combat-cleared');
  assert.equal(progress.expectedAction, 'reflect');
  progress = advanceTestimonyArchive(progress, 'reflect');
  progress = advanceTestimonyArchive(progress, 'combat-cleared');
  assert.equal(progress.expectedAction, 'trace');
  progress = advanceTestimonyArchive(progress, 'trace');
  progress = advanceTestimonyArchive(progress, 'combat-cleared');

  assert.equal(progress.zoneIndex, 3);
  assert.equal(progress.phase, 'decision');
  assert.deepEqual(unlockedTestimonySegmentIds(progress), TESTIMONY_ZONES.map(({ id }) => id));
});

test('장소별 적 정의는 고정 상수이며 호출할 때마다 같은 동결 객체를 돌려준다', () => {
  for (let index = 0; index < TESTIMONY_ZONES.length; index += 1) {
    const encounter = getTestimonyEncounter(index);
    assert.equal(encounter, getTestimonyEncounter(index));
    assert.equal(Object.isFrozen(encounter), true);
    assert.equal(encounter.spawns.every(({ zoneId }) => zoneId === 'arena'), true);
  }
  assert.throws(() => getTestimonyEncounter(4), RangeError);
});

test('장소·단서·결정 체크포인트는 재접속 뒤 같은 단계로 복원된다', () => {
  let progress = advanceTestimonyArchive(createTestimonyArchiveProgress(), 'combat-cleared');
  assert.equal(testimonyArchiveCheckpoint(progress), 'chapter-5:testimony-intake-clue');
  assert.deepEqual(restoreTestimonyArchiveProgress(testimonyArchiveCheckpoint(progress)), progress);
  progress = advanceTestimonyArchive(progress, 'trace');
  assert.equal(testimonyArchiveCheckpoint(progress), 'chapter-5:consent-redaction-lab');
  assert.deepEqual(restoreTestimonyArchiveProgress(testimonyArchiveCheckpoint(progress)), progress);
  assert.equal(restoreTestimonyArchiveProgress('chapter-5:decision').phase, 'decision');
  assert.deepEqual(restoreTestimonyArchiveProgress('chapter-5:unknown'), createTestimonyArchiveProgress());
});

test('증언 보관소의 모든 전투·단서 체크포인트는 실제 v5 저장 경계를 통과한다', () => {
  let progress = createTestimonyArchiveProgress();
  let campaign = setChapterCheckpoint(createInitialRebootState(), 5, 'chapter-5:start');
  for (let zone = 0; zone < TESTIMONY_ZONES.length; zone += 1) {
    campaign = setChapterCheckpoint(campaign, 5, testimonyArchiveCheckpoint(progress));
    progress = advanceTestimonyArchive(progress, 'combat-cleared');
    campaign = setChapterCheckpoint(campaign, 5, testimonyArchiveCheckpoint(progress));
    if (progress.phase === 'clue') progress = advanceTestimonyArchive(progress, TESTIMONY_ZONES[zone].clueAction);
  }
  assert.equal(campaign.chapterProgress.current, 5);
});

test('증언 보관소 렌더 환경은 실제 GLB 배치와 곡면 랜드마크 네 곳을 함께 폐기한다', async () => {
  let disposed = false;
  const loader = {
    dispose() { disposed = true; },
    async load() {
      const root = new THREE.Group();
      root.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.5, 6), new THREE.MeshStandardMaterial()));
      return { isPlaceholder: false, root };
    },
    async loadMaterial(id) {
      const material = new THREE.MeshStandardMaterial({ color: 0x667788 });
      material.name = id;
      return { isPlaceholder: false, material };
    }
  };
  const scene = new THREE.Scene();
  const environment = createTestimonyArchiveEnvironment({ assetLoader: loader, scene });
  const report = await environment.ready;

  assert.equal(report.placedInstances >= 18, true);
  assert.equal(environment.getDebugState().zoneCount, 4);
  assert.ok(scene.getObjectByName('witness-source-terminal'));
  assert.ok(scene.getObjectByName('consent-mask-table'));
  assert.ok(scene.getObjectByName('privacy-crosscheck-grid-0'));
  assert.ok(scene.getObjectByName('verified-package-vault'));
  environment.setActiveZone(2);
  assert.equal(scene.getObjectByName('testimony-zone-beacon-privacy-crosscheck').visible, true);
  environment.dispose();
  assert.equal(disposed, true);
  assert.equal(scene.getObjectByName('testimony-archive-environment'), undefined);
});

test('증언 보관소의 주요 랜드마크는 BoxGeometry 대체물이 아니다', () => {
  const source = readFileSync(new URL('../src/reboot/render/testimonyArchiveEnvironment.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /BoxGeometry/);
  assert.match(source, /ExtrudeGeometry/);
  assert.match(source, /TorusGeometry/);
  assert.match(source, /CylinderGeometry/);
});
