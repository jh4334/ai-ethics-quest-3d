import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { chapterTwoLevel } from '../src/reboot/content/levels/chapter2.js';
import { chapterThreeLevel } from '../src/reboot/content/levels/chapter3.js';
import { chapterFourLevel } from '../src/reboot/content/levels/chapter4.js';
import { createCampaignChapterEnvironment } from '../src/reboot/render/campaignChapterEnvironment.js';

const LEVELS = Object.freeze({
  2: chapterTwoLevel,
  3: chapterThreeLevel,
  4: chapterFourLevel
});

function createAssetLoader() {
  return {
    dispose() {},
    async load(id) {
      const root = new THREE.Group();
      root.name = `loaded-${id}`;
      root.add(new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.25),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      ));
      return { id, isPlaceholder: false, root };
    },
    async loadMaterial(id) {
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
      material.name = id;
      return { id, isPlaceholder: false, material };
    }
  };
}

test('Given chapters 2-4, When production dressing loads, Then every zone uses GLB props and textured surfaces', async () => {
  // Given: 각기 다른 4구역을 가진 2~4장과 실제 Object3D를 돌려주는 에셋 로더.
  for (const [chapterText, level] of Object.entries(LEVELS)) {
    const chapter = Number(chapterText);
    const scene = new THREE.Scene();
    const environment = createCampaignChapterEnvironment({
      assetLoader: createAssetLoader(), chapter, level, scene
    });

    // When: 장 전용 환경의 GLB 소품과 PBR 표면을 모두 불러온다.
    await environment.ready;
    const debug = environment.getDebugState();

    // Then: 단순 랜드마크 배치가 아니라 전 구역에 실제 에셋과 재질 층이 존재한다.
    assert.equal(debug.status, 'ready');
    assert.equal(debug.zoneCount, 4);
    assert.ok(debug.assetInstances >= 24, `${chapter}장 GLB 소품 수`);
    assert.ok(debug.uniqueAssetIds >= 7, `${chapter}장 에셋 종류 수`);
    assert.equal(debug.texturedSurfaces, 4);
    assert.deepEqual(debug.failedAssetIds, []);
    assert.equal(scene.children.includes(environment.group), true);
    environment.dispose();
    assert.equal(scene.children.includes(environment.group), false);
  }
});

test('Given different chapter themes, When production layouts are compared, Then their asset compositions are not palette swaps', async () => {
  // Given: 같은 에셋 카탈로그를 쓰되 다른 서사 공간을 가진 세 장.
  const signatures = [];
  for (const [chapterText, level] of Object.entries(LEVELS)) {
    const environment = createCampaignChapterEnvironment({
      assetLoader: createAssetLoader(), chapter: Number(chapterText), level, scene: new THREE.Scene()
    });

    // When: 장별 공간 구성을 로드하고 배치 서명을 읽는다.
    await environment.ready;
    signatures.push(environment.getDebugState().placementSignature);
    environment.dispose();
  }

  // Then: 2~4장은 같은 원룸의 색만 바꾼 구성이 아니다.
  assert.equal(new Set(signatures).size, 3);
});
