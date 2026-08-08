import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
  getEnvironmentAsset,
  getEnvironmentMaterial,
  resolveEnvironmentAssetUrl
} from './catalog.js';

function disposeScene(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const ownedMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of ownedMaterials) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
    }
  });

  root.removeFromParent();
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

function createPlaceholder(asset, error) {
  const { width, height, depth, color } = asset.placeholder;
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshBasicMaterial({ color, wireframe: true });
  const mesh = new THREE.Mesh(geometry, material);
  const root = new THREE.Group();
  root.name = `${asset.id}-placeholder`;
  root.userData.environmentAssetStatus = 'placeholder';
  root.userData.environmentAssetError = error instanceof Error ? error.message : String(error);
  root.add(mesh);
  return root;
}

function createInstance(asset, root, isPlaceholder, release) {
  let disposed = false;
  const instance = {
    asset,
    root,
    isPlaceholder,
    dispose() {
      if (disposed) return;
      disposed = true;
      release(instance);
      disposeScene(root);
    }
  };
  return Object.freeze(instance);
}

function disposeMaterial(material) {
  const textures = new Set(Object.values(material).filter((value) => value?.isTexture));
  for (const texture of textures) texture.dispose();
  material.dispose();
}

function createMaterialInstance(definition, material, isPlaceholder, release) {
  let disposed = false;
  const instance = {
    definition,
    material,
    isPlaceholder,
    dispose() {
      if (disposed) return;
      disposed = true;
      release(instance);
      disposeMaterial(material);
    }
  };
  return Object.freeze(instance);
}

export function createEnvironmentAssetLoader({
  baseUrl = globalThis.document?.baseURI,
  loader = new GLTFLoader(),
  textureLoader = new THREE.TextureLoader()
} = {}) {
  const activeInstances = new Set();
  let disposed = false;

  function release(instance) {
    activeInstances.delete(instance);
  }

  return Object.freeze({
    async load(id) {
      if (disposed) throw new Error('폐기된 환경 에셋 로더는 사용할 수 없습니다.');
      const asset = getEnvironmentAsset(id);
      const url = resolveEnvironmentAssetUrl(asset, baseUrl);
      let root;
      let isPlaceholder = false;

      try {
        const gltf = await loader.loadAsync(url);
        root = gltf.scene;
        if (!root?.isObject3D) throw new TypeError('GLB 장면이 없습니다.');
        root.userData.environmentAssetStatus = 'loaded';
      } catch (error) {
        root = createPlaceholder(asset, error);
        isPlaceholder = true;
      }

      const instance = createInstance(asset, root, isPlaceholder, release);
      if (disposed) {
        instance.dispose();
        throw new Error('폐기된 환경 에셋 로더는 사용할 수 없습니다.');
      }
      activeInstances.add(instance);
      return instance;
    },
    async loadMaterial(id) {
      if (disposed) throw new Error('폐기된 환경 에셋 로더는 사용할 수 없습니다.');
      const definition = getEnvironmentMaterial(id);
      const loadedTextures = [];
      let material;
      let isPlaceholder = false;

      try {
        for (const path of Object.values(definition.maps)) {
          const texture = await textureLoader.loadAsync(resolveEnvironmentAssetUrl({ path }, baseUrl));
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          loadedTextures.push(texture);
        }
        loadedTextures[0].colorSpace = THREE.SRGBColorSpace;
        material = new THREE.MeshStandardMaterial({
          map: loadedTextures[0],
          normalMap: loadedTextures[1],
          roughnessMap: loadedTextures[2],
          roughness: 1,
          metalness: 0
        });
        material.userData.environmentMaterialStatus = 'loaded';
      } catch (error) {
        for (const texture of loadedTextures) texture.dispose();
        material = new THREE.MeshStandardMaterial({
          color: definition.placeholderColor,
          roughness: 0.9,
          metalness: 0
        });
        material.userData.environmentMaterialStatus = 'placeholder';
        material.userData.environmentMaterialError = error instanceof Error ? error.message : String(error);
        isPlaceholder = true;
      }

      material.name = id;
      const instance = createMaterialInstance(definition, material, isPlaceholder, release);
      if (disposed) {
        instance.dispose();
        throw new Error('폐기된 환경 에셋 로더는 사용할 수 없습니다.');
      }
      activeInstances.add(instance);
      return instance;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const instance of [...activeInstances]) instance.dispose();
    }
  });
}
