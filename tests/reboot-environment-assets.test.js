import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
  ENVIRONMENT_ASSETS,
  ENVIRONMENT_DEPENDENCIES,
  ENVIRONMENT_MATERIALS,
  ENVIRONMENT_SOURCES,
  resolveEnvironmentAssetUrl
} from '../src/reboot/environment/catalog.js';
import { createEnvironmentAssetLoader } from '../src/reboot/environment/loader.js';

globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const publicRoot = resolve(projectRoot, 'public');
const environmentRoot = resolve(publicRoot, 'assets/reboot/environment');

function collectEnvironmentFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectEnvironmentFiles(path));
    else files.push(path);
  }
  return files;
}

function toManifestPath(path) {
  return `./${relative(publicRoot, path).split(sep).join('/')}`;
}

function readJpegDimensions(bytes) {
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    const blockLength = bytes.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5)
      };
    }
    offset += blockLength;
  }
  throw new Error('JPEG 크기 정보를 찾지 못했습니다.');
}

test('Given the environment catalog, When release assets are audited, Then files, manifest, license, and GLB payloads match exactly', async () => {
  // Given: Chapter 1 environment assets declared by the runtime catalog.
  const catalogPaths = [
    ...ENVIRONMENT_ASSETS.map((asset) => asset.path),
    ...ENVIRONMENT_DEPENDENCIES,
    ...ENVIRONMENT_MATERIALS.flatMap((material) => Object.values(material.maps))
  ].sort();
  const manifest = JSON.parse(readFileSync(resolve(publicRoot, 'reboot-assets.json'), 'utf8'));
  const licenses = readFileSync(resolve(projectRoot, 'ASSET_LICENSES.md'), 'utf8');

  // When: the repository files and release records are compared.
  const filePaths = collectEnvironmentFiles(environmentRoot).map(toManifestPath).sort();
  const manifestPaths = manifest.filter((path) => path.startsWith('./assets/reboot/environment/')).sort();

  // Then: no untracked or fake environment payload can enter the release.
  assert.deepEqual(filePaths, catalogPaths);
  assert.deepEqual(manifestPaths, catalogPaths);
  assert.equal(new Set(catalogPaths).size, catalogPaths.length);
  for (const source of Object.values(ENVIRONMENT_SOURCES)) {
    assert.match(licenses, new RegExp(source.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(licenses, new RegExp(source.pageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(licenses.includes(source.downloadUrl), source.downloadUrl);
    assert.ok(licenses.includes(source.archiveSha256), source.archiveSha256);
    assert.ok(licenses.includes(source.license), source.name);
  }
  for (const item of [...ENVIRONMENT_ASSETS, ...ENVIRONMENT_MATERIALS]) {
    assert.ok(ENVIRONMENT_SOURCES[item.source], `${item.id}: ${item.source}`);
  }

  const materialBytes = new Map();
  for (const material of ENVIRONMENT_MATERIALS) {
    assert.deepEqual(Object.keys(material.maps), ['color', 'normal', 'roughness']);
    let bytesForMaterial = 0;
    for (const path of Object.values(material.maps)) {
      const bytes = readFileSync(resolve(publicRoot, path.slice(2)));
      bytesForMaterial += bytes.byteLength;
      const dimensions = readJpegDimensions(bytes);
      assert.ok(dimensions.width <= 1024 && dimensions.height <= 1024, path);
      assert.equal(Math.max(dimensions.width, dimensions.height), 1024, path);
    }
    materialBytes.set(material.id, bytesForMaterial);
    assert.ok(bytesForMaterial <= 4 * 1024 * 1024, `${material.id}: ${bytesForMaterial}`);
  }

  const sharedModelBytes = [...ENVIRONMENT_ASSETS.map((asset) => asset.path), ...ENVIRONMENT_DEPENDENCIES]
    .reduce((sum, path) => sum + readFileSync(resolve(publicRoot, path.slice(2))).byteLength, 0);
  const firstScreenBytes = sharedModelBytes + materialBytes.get('structural-concrete');
  assert.ok(firstScreenBytes <= 5 * 1024 * 1024, `first screen: ${firstScreenBytes}`);

  const colormap = readFileSync(resolve(publicRoot, ENVIRONMENT_DEPENDENCIES[0].slice(2)));
  assert.equal(colormap.subarray(1, 4).toString('ascii'), 'PNG');
  assert.ok(colormap.byteLength > 1024);
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => url.endsWith('Textures/colormap.png')
    ? `data:image/png;base64,${colormap.toString('base64')}`
    : url);
  const gltfLoader = new GLTFLoader(manager);
  for (const asset of ENVIRONMENT_ASSETS) {
    const diskPath = resolve(publicRoot, asset.path.slice(2));
    assert.equal(existsSync(diskPath), true, asset.path);
    const bytes = readFileSync(diskPath);
    assert.equal(bytes.subarray(0, 4).toString('ascii'), 'glTF', asset.path);
    assert.ok(bytes.byteLength > 1024, asset.path);
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const parsed = await gltfLoader.parseAsync(data, '');
    assert.equal(parsed.scene.isObject3D, true, asset.path);
  }
});

test('Given a GitHub Pages base URL, When an environment path resolves, Then the repository subpath is preserved', () => {
  // Given: a deployment mounted below the origin root.
  const baseUrl = 'https://school.example/ai-ethics/reboot.html';
  const asset = ENVIRONMENT_ASSETS.find(({ id }) => id === 'campus-wall');

  // When: the catalog path is resolved for GLTFLoader.
  const url = resolveEnvironmentAssetUrl(asset, baseUrl);

  // Then: resolution remains relative to the deployed application base.
  assert.equal(url, 'https://school.example/ai-ethics/assets/reboot/environment/building/wall.glb');
});

test('Given an unavailable GLB, When the environment loader runs, Then it returns and disposes one visible placeholder', async () => {
  // Given: an offline loader that cannot fetch the requested model.
  const factory = createEnvironmentAssetLoader({
    baseUrl: 'https://school.example/ai-ethics/reboot.html',
    loader: { async loadAsync() { throw new Error('offline'); } }
  });

  // When: a catalog asset is requested.
  const instance = await factory.load('campus-wall');
  const disposed = [];
  instance.root.traverse((object) => {
    object.geometry?.addEventListener('dispose', () => disposed.push(object.geometry.uuid));
    object.material?.addEventListener('dispose', () => disposed.push(object.material.uuid));
  });
  instance.dispose();
  instance.dispose();

  // Then: the fallback is explicit and every owned resource is released once.
  assert.equal(instance.isPlaceholder, true);
  assert.equal(instance.root.userData.environmentAssetStatus, 'placeholder');
  assert.equal(disposed.length, 2);
  assert.equal(new Set(disposed).size, 2);
  factory.dispose();
});

test('Given a loaded environment scene, When the factory is disposed, Then geometry, material, and texture are released once', async () => {
  // Given: one real loader result with independently owned resources.
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const material = new THREE.MeshStandardMaterial({ map: texture });
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(geometry, material));
  const disposed = [];
  for (const resource of [geometry, material, texture]) {
    resource.addEventListener('dispose', () => disposed.push(resource.uuid));
  }
  let loadedUrl = '';
  const factory = createEnvironmentAssetLoader({
    baseUrl: 'https://school.example/ai-ethics/reboot.html',
    loader: { async loadAsync(url) { loadedUrl = url; return { scene }; } }
  });

  // When: the model is loaded and the owning factory ends its lifetime.
  const instance = await factory.load('classroom-desk');
  factory.dispose();
  factory.dispose();

  // Then: the base-relative URL is used and all resources are reclaimed once.
  assert.equal(loadedUrl, 'https://school.example/ai-ethics/assets/reboot/environment/furniture/desk.glb');
  assert.equal(instance.isPlaceholder, false);
  assert.deepEqual(new Set(disposed), new Set([geometry.uuid, material.uuid, texture.uuid]));
  assert.equal(disposed.length, 3);
  await assert.rejects(() => factory.load('campus-wall'), /폐기/);
});

test('Given a PBR material definition, When it loads, Then distinct color, normal, and roughness maps are configured and disposed', async () => {
  // Given: a deterministic texture loader standing in for the browser decoder.
  const loadedUrls = [];
  const textures = [];
  const textureLoader = {
    async loadAsync(url) {
      loadedUrls.push(url);
      const texture = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
      textures.push(texture);
      return texture;
    }
  };
  const factory = createEnvironmentAssetLoader({
    baseUrl: 'https://school.example/ai-ethics/reboot.html',
    textureLoader
  });

  // When: the brick material is loaded and the factory lifetime ends.
  const instance = await factory.loadMaterial('masonry-brick');
  const disposed = [];
  for (const resource of [...textures, instance.material]) {
    resource.addEventListener('dispose', () => disposed.push(resource.uuid));
  }
  factory.dispose();
  factory.dispose();

  // Then: Three.js receives three semantically distinct PBR channels and releases them once.
  assert.deepEqual(loadedUrls, [
    'https://school.example/ai-ethics/assets/reboot/environment/materials/bricks/Bricks001_1K-JPG_Color.jpg',
    'https://school.example/ai-ethics/assets/reboot/environment/materials/bricks/Bricks001_1K-JPG_NormalGL.jpg',
    'https://school.example/ai-ethics/assets/reboot/environment/materials/bricks/Bricks001_1K-JPG_Roughness.jpg'
  ]);
  assert.equal(instance.isPlaceholder, false);
  assert.equal(instance.material.map, textures[0]);
  assert.equal(instance.material.normalMap, textures[1]);
  assert.equal(instance.material.roughnessMap, textures[2]);
  assert.equal(instance.material.map.colorSpace, THREE.SRGBColorSpace);
  assert.equal(instance.material.userData.environmentMaterialStatus, 'loaded');
  assert.equal(disposed.length, 4);
  assert.equal(new Set(disposed).size, 4);
});
