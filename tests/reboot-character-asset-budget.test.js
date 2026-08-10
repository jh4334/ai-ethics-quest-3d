import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
  ANIMATION_ASSETS, CHARACTER_ROSTER, getCharacterProfile
} from '../src/reboot/characters/catalog.js';

const MAX_COMBINED_ANIMATION_BYTES = 4 * 1024 * 1024;

function animationFile(assetPath) {
  return new URL(`../public/${assetPath.replace('./', '')}`, import.meta.url);
}

function requiredClips(library) {
  return [...new Set(Object.values(CHARACTER_ROSTER)
    .filter((profile) => (
      profile.identity.kind === 'human' && profile.library === library && !profile.standaloneAsset
    ))
    .flatMap((profile) => Object.values(profile.animations)))].sort();
}

async function inspectAnimationLibrary(assetPath) {
  const bytes = await readFile(animationFile(assetPath));
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new Promise((resolve, reject) => {
    new GLTFLoader().parse(arrayBuffer, '', resolve, reject);
  });
  return Object.freeze({
    bytes: bytes.byteLength,
    clips: Object.freeze(gltf.animations.map((clip) => clip.name).sort())
  });
}

test('Given shipped animation GLBs, When runtime clip usage is compared, Then no unused clip is transferred', async () => {
  for (const [library, assetPath] of Object.entries(ANIMATION_ASSETS)) {
    const result = await inspectAnimationLibrary(assetPath);
    assert.deepEqual(result.clips, requiredClips(library), `${library} 애니메이션 집합`);
  }
});

test('Given the player presentation, When its asset strategy is inspected, Then it reuses the shared modular cast libraries', () => {
  const profile = getCharacterProfile('player');
  assert.equal(profile.standaloneAsset, null);
  assert.equal(profile.library, 'ual1');
  assert.equal(profile.hair, 'simpleParted');
});

test('Given both shipped animation GLBs, When their bytes are totalled, Then the school-network budget is respected', async () => {
  const libraries = await Promise.all(Object.values(ANIMATION_ASSETS).map(inspectAnimationLibrary));
  const combinedBytes = libraries.reduce((total, library) => total + library.bytes, 0);
  assert.ok(
    combinedBytes <= MAX_COMBINED_ANIMATION_BYTES,
    `애니메이션 ${combinedBytes}바이트가 ${MAX_COMBINED_ANIMATION_BYTES}바이트 예산을 초과함`
  );
});
