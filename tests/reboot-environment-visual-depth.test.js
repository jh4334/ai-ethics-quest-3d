import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { chapterTwoLevel } from '../src/reboot/content/levels/chapter2.js';
import { chapterThreeLevel } from '../src/reboot/content/levels/chapter3.js';
import { chapterFourLevel } from '../src/reboot/content/levels/chapter4.js';
import { createBroadcastStationEnvironment } from '../src/reboot/render/broadcastStationEnvironment.js';
import { createCampaignChapterEnvironment } from '../src/reboot/render/campaignChapterEnvironment.js';
import { createTestimonyArchiveEnvironment } from '../src/reboot/render/testimonyArchiveEnvironment.js';

const LEVELS = Object.freeze({ 2: chapterTwoLevel, 3: chapterThreeLevel, 4: chapterFourLevel });

function createAssetLoader() {
  const materialIds = [];
  return {
    dispose() {},
    materialIds,
    async load(id) {
      const root = new THREE.Group();
      root.name = id;
      root.add(new THREE.Mesh(new THREE.TetrahedronGeometry(0.2), new THREE.MeshStandardMaterial()));
      return { id, isPlaceholder: false, root };
    },
    async loadMaterial(id) {
      materialIds.push(id);
      const material = new THREE.MeshStandardMaterial({ color: 0x7b8796 });
      material.name = id;
      return { id, isPlaceholder: false, material };
    }
  };
}

test('Given chapters two through four, When environments load, Then each has layered campus depth and a distinct authored identity', async () => {
  // Given
  const identityNames = ['media-festival-rig', 'dual-school-divide', 'approval-conveyor-spine'];

  for (const [chapterText, level] of Object.entries(LEVELS)) {
    const chapter = Number(chapterText);
    const loader = createAssetLoader();
    const scene = new THREE.Scene();
    const environment = createCampaignChapterEnvironment({ assetLoader: loader, chapter, level, scene });

    // When
    await environment.ready;
    const debug = environment.getDebugState();

    // Then
    assert.equal(debug.atmosphericLayers, 3);
    assert.ok(debug.authoredMeshes >= 18, `${chapter}장의 3D 환경 밀도`);
    assert.ok(debug.emissiveAccents >= 8, `${chapter}장의 경로 신호`);
    assert.ok(debug.pbrArchitectureMeshes >= 4, `${chapter}장의 바닥 외 PBR 재질`);
    assert.ok(scene.getObjectByName(identityNames[chapter - 2]));
    environment.group.traverse((object) => {
      if (object.isMesh) assert.equal(object.castShadow, false);
    });
    environment.dispose();
  }
});

test('Given testimony and broadcast routes, When their environments load, Then vertical archive and station silhouettes remain unmistakable', async () => {
  // Given
  const cases = [
    [createTestimonyArchiveEnvironment, 'testimony-archive-crown', 'verticalArchiveMeshes'],
    [createBroadcastStationEnvironment, 'broadcast-antenna-crown', 'stationIdentityMeshes']
  ];

  for (const [factory, landmarkName, metric] of cases) {
    const loader = createAssetLoader();
    const scene = new THREE.Scene();
    const environment = factory({ assetLoader: loader, scene });

    // When
    await environment.ready;
    const debug = environment.getDebugState();

    // Then
    assert.equal(debug.atmosphericLayers, 3);
    assert.ok(debug.emissiveAccents >= 8);
    assert.ok(debug[metric] >= 14);
    assert.ok(debug.pbrArchitectureMeshes >= 4);
    assert.ok(scene.getObjectByName(landmarkName));
    assert.ok(loader.materialIds.length >= 2);
    environment.dispose();
  }
});
