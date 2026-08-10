import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { NodeIO } from '@gltf-transform/core';
import { KHRMaterialsUnlit } from '@gltf-transform/extensions';

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

test('Given the standalone player ranger, When its embedded clips are inspected, Then only runtime moves ship', async () => {
  const profile = getCharacterProfile('player');
  const document = await new NodeIO().registerExtensions([KHRMaterialsUnlit])
    .read(fileURLToPath(animationFile(profile.standaloneAsset)));
  const clips = document.getRoot().listAnimations().map((clip) => clip.getName()).sort();
  const bytes = (await readFile(animationFile(profile.standaloneAsset))).byteLength;
  assert.deepEqual(clips, Object.values(profile.animations).toSorted());
  assert.ok(bytes <= 2 * 1024 * 1024, `플레이어 Ranger ${bytes}바이트가 2MiB 예산을 초과함`);
});

test('Given both shipped animation GLBs, When their bytes are totalled, Then the school-network budget is respected', async () => {
  const libraries = await Promise.all(Object.values(ANIMATION_ASSETS).map(inspectAnimationLibrary));
  const combinedBytes = libraries.reduce((total, library) => total + library.bytes, 0);
  assert.ok(
    combinedBytes <= MAX_COMBINED_ANIMATION_BYTES,
    `애니메이션 ${combinedBytes}바이트가 ${MAX_COMBINED_ANIMATION_BYTES}바이트 예산을 초과함`
  );
});
