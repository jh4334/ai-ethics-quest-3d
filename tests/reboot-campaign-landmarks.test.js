import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

const landmarksModule = await import('../src/reboot/render/campaignLandmarks.js').catch(() => ({}));
const { createCampaignLandmarks } = landmarksModule;

const EXPECTED = Object.freeze({
  'approval-room': ['approval-dossier-queue', 'approval-conveyor', 'approval-yoonseo-terminal',
    'approval-review-gate', 'approval-marquee-panel', 'approval-flow-documents'],
  'dual-school': ['dual-comfort-school', 'dual-verified-school', 'dual-unequal-records',
    'dual-sync-pillar', 'dual-log-cabinets'],
  finale: ['finale-haru-stage', 'finale-dot-stage', 'finale-lumen-stage', 'finale-broadcast-booth', 'finale-evidence-beam', 'finale-public-feed',
    'finale-console-desk', 'finale-console-monitors', 'finale-wall-clock', 'finale-onair-sign'],
  'share-chain': ['share-source-trace', 'share-copy-chain', 'share-clone-output',
    'share-poster-wall', 'share-chain-links', 'share-copy-piles']
});

test('campaign landmark layer gives chapters two through five distinct semantic spaces', () => {
  // Given: the four campaign spaces that currently share generic corridor geometry.
  assert.equal(typeof createCampaignLandmarks, 'function');
  const built = Object.keys(EXPECTED).map((type) => {
    const scene = new THREE.Scene();
    return createCampaignLandmarks({ scene, type, variant: type === 'finale' ? 'secure' : 'default' });
  });

  // When: each render-only landmark signature is inspected.
  const signatures = built.map((layer) => layer.getDebugState().landmarkIds.join(':'));

  // Then: every chapter exposes its own required visual conflict with no shared signature.
  assert.equal(new Set(signatures).size, 4);
  for (const [index, type] of Object.keys(EXPECTED).entries()) {
    const debug = built[index].getDebugState();
    for (const id of EXPECTED[type]) assert.equal(debug.landmarkIds.includes(id), true, `${type}:${id}`);
    built[index].dispose();
  }
});

test('campaign landmarks stay deterministic and inside the low-spec render budget', () => {
  // Given: two independently built finale layers with the same authored variant.
  assert.equal(typeof createCampaignLandmarks, 'function');
  const firstScene = new THREE.Scene();
  const secondScene = new THREE.Scene();
  const first = createCampaignLandmarks({ scene: firstScene, type: 'finale', variant: 'purge' });
  const second = createCampaignLandmarks({ scene: secondScene, type: 'finale', variant: 'purge' });

  // When: debug signatures and budgets are compared.
  const firstDebug = first.getDebugState();
  const secondDebug = second.getDebugState();

  // Then: authored output matches exactly and adds no expensive scene resources.
  assert.deepEqual(secondDebug, firstDebug);
  assert.ok(firstDebug.budget.drawCalls <= 8);
  assert.ok(firstDebug.budget.instances <= 48);
  assert.ok(firstDebug.budget.triangles <= 1600);
  assert.ok(firstDebug.budget.resources <= 8);
  assert.equal(firstDebug.variant, 'purge');
  first.dispose();
  second.dispose();
});

test('every campaign landmark type stays inside the shared low-spec budget', () => {
  // Given: 확장된 네 종류의 캠페인 공간(S2 배경 재구성 이후).
  assert.equal(typeof createCampaignLandmarks, 'function');

  for (const type of Object.keys(EXPECTED)) {
    // When: 각 타입의 예산을 측정한다(피날레는 더 무거운 purge 변형으로).
    const layer = createCampaignLandmarks({
      scene: new THREE.Scene(), type, variant: type === 'finale' ? 'purge' : 'default'
    });
    const budget = layer.getDebugState().budget;

    // Then: 타입당 예산 상한을 어느 공간도 넘지 않는다.
    assert.ok(budget.drawCalls <= 8, `${type} drawCalls ${budget.drawCalls}`);
    assert.ok(budget.instances <= 48, `${type} instances ${budget.instances}`);
    assert.ok(budget.triangles <= 1600, `${type} triangles ${budget.triangles}`);
    assert.ok(budget.resources <= 8, `${type} resources ${budget.resources}`);
    layer.dispose();
  }
});

test('approval-room document flow is a pure function of accumulated elapsed time', () => {
  // Given: 같은 데이터로 만든 두 결재 컨베이어(서로 다른 delta 분할).
  assert.equal(typeof createCampaignLandmarks, 'function');
  const first = createCampaignLandmarks({ scene: new THREE.Scene(), type: 'approval-room' });
  const second = createCampaignLandmarks({ scene: new THREE.Scene(), type: 'approval-room' });
  const readMatrices = (layer) => [
    ...layer.root.getObjectByName('campaign-landmark-flow-documents').instanceMatrix.array
  ];

  // When: 누적 elapsed가 같도록 delta를 다르게 쪼개 흘린다(0.25+0.25 == 0.5, 이진 표현 정확).
  first.update(0.25);
  first.update(0.25);
  second.update(0.5);

  // Then: 서류 위치는 누적 elapsed만의 함수이고, debug 상태에는 가변값이 새지 않는다.
  assert.deepEqual(readMatrices(first), readMatrices(second));
  assert.deepEqual(first.getDebugState(), second.getDebugState());

  // And: 주기를 여러 번 넘겨도(모듈로 순환) 서류는 컨베이어 범위 안에 남는다.
  for (let step = 0; step < 100; step += 1) first.update(0.5);
  const matrices = readMatrices(first);
  for (let index = 0; index < 6; index += 1) {
    const z = matrices[index * 16 + 14];
    assert.ok(z >= -30.2 && z <= -19.7, `서류 ${index} z=${z}`);
  }
  first.dispose();
  second.dispose();
});

test('finale ON AIR sign lights up only through setOnAir', () => {
  // Given: 결말 확정 전의 피날레 방송실.
  assert.equal(typeof createCampaignLandmarks, 'function');
  const layer = createCampaignLandmarks({ scene: new THREE.Scene(), type: 'finale', variant: 'secure' });
  const sign = layer.root.getObjectByName('campaign-landmark-onair-sign');
  assert.ok(sign?.isInstancedMesh);
  assert.equal(layer.getDebugState().onAir, false);
  const unlitIntensity = sign.material.emissiveIntensity;

  // When: showOutcome 배선이 setOnAir(true)를 호출한다.
  assert.equal(layer.setOnAir(true), true);

  // Then: 전용 재질만 밝아지고, 끄면 원래 강도로 복귀한다.
  assert.equal(layer.getDebugState().onAir, true);
  assert.ok(sign.material.emissiveIntensity > unlitIntensity);
  assert.equal(layer.setOnAir(false), false);
  assert.equal(sign.material.emissiveIntensity, unlitIntensity);
  layer.dispose();

  // And: 사인이 없는 타입은 onAir=null로 관측되고 setOnAir는 no-op이다.
  const chapterTwo = createCampaignLandmarks({ scene: new THREE.Scene(), type: 'share-chain' });
  assert.equal(chapterTwo.getDebugState().onAir, null);
  assert.equal(chapterTwo.setOnAir(true), false);
  chapterTwo.dispose();
});

test('campaign landmark disposal is owned, complete, and idempotent', () => {
  // Given: a live approval-room landmark layer with tracked GPU resources.
  assert.equal(typeof createCampaignLandmarks, 'function');
  const scene = new THREE.Scene();
  const layer = createCampaignLandmarks({ scene, type: 'approval-room' });
  const disposed = [];
  layer.root.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry.addEventListener('dispose', () => disposed.push(object.geometry.uuid));
    object.material.addEventListener('dispose', () => disposed.push(object.material.uuid));
  });
  const resourceCount = layer.getDebugState().budget.resources;

  // When: disposal is requested twice.
  const first = layer.dispose();
  const second = layer.dispose();

  // Then: the root detaches and each owned resource is released once.
  assert.equal(first, resourceCount);
  assert.equal(second, 0);
  assert.equal(layer.root.parent, null);
  assert.equal(new Set(disposed).size, resourceCount);
  assert.equal(layer.getDebugState().disposed, true);
});
