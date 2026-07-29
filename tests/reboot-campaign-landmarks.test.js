import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

const landmarksModule = await import('../src/reboot/render/campaignLandmarks.js').catch(() => ({}));
const { createCampaignLandmarks } = landmarksModule;

const EXPECTED = Object.freeze({
  'approval-room': ['approval-dossier-queue', 'approval-conveyor', 'approval-yoonseo-terminal'],
  'dual-school': ['dual-comfort-school', 'dual-verified-school', 'dual-unequal-records'],
  finale: ['finale-haru-stage', 'finale-dot-stage', 'finale-lumen-stage', 'finale-broadcast-booth', 'finale-evidence-beam', 'finale-public-feed'],
  'share-chain': ['share-source-trace', 'share-copy-chain', 'share-clone-output']
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
