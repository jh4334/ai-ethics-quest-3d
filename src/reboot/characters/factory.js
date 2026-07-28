import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

import { chooseCharacterAnimation } from './animationState.js';
import {
  ANIMATION_ASSETS,
  BODY_ASSETS,
  getCharacterProfile,
  OUTFIT_ASSETS
} from './catalog.js';

function forEachMaterial(object, callback) {
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of materials) if (material) callback(material);
}

function prepareModel(model, { tint, tintOutfit }, ownedMaterials) {
  const tintColor = new THREE.Color(tint).lerp(new THREE.Color(0xffffff), 0.12);
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = false;
    object.receiveShadow = false;
    const materials = [];
    forEachMaterial(object, (source) => {
      const material = source.clone();
      const isSkin = /regular_(female|male)/i.test(material.name);
      if (tintOutfit && !isSkin && material.color) material.color.lerp(tintColor, 0.78);
      if (material.emissive) {
        material.emissive.set(isSkin ? 0x18131a : 0x151b2b);
        material.emissiveIntensity = isSkin ? 0.35 : 0.55;
      }
      ownedMaterials.add(material);
      materials.push(material);
    });
    object.material = Array.isArray(object.material) ? materials : materials[0];
  });
}

function registerSourceResources(gltf, resources) {
  gltf.scene.traverse((object) => {
    if (object.geometry) resources.geometries.add(object.geometry);
    forEachMaterial(object, (material) => {
      resources.materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) resources.textures.add(value);
      }
    });
  });
}

function disposeSourceResources(resources) {
  for (const texture of resources.textures) texture.dispose();
  for (const material of resources.materials) material.dispose();
  for (const geometry of resources.geometries) geometry.dispose();
  resources.textures.clear();
  resources.materials.clear();
  resources.geometries.clear();
}

export function createCharacterFactory({ loader = new GLTFLoader() } = {}) {
  const cache = new Map();
  const instances = new Set();
  const sourceResources = {
    geometries: new Set(),
    materials: new Set(),
    textures: new Set()
  };
  let disposed = false;

  function load(url) {
    if (!cache.has(url)) {
      const pending = loader.loadAsync(url).then((gltf) => {
        registerSourceResources(gltf, sourceResources);
        if (disposed) disposeSourceResources(sourceResources);
        return gltf;
      });
      cache.set(url, pending);
    }
    return cache.get(url);
  }

  async function create(id) {
    if (disposed) throw new Error('폐기된 캐릭터 팩토리는 사용할 수 없습니다.');
    const profile = getCharacterProfile(id);
    const needsBaseBody = profile.outfit === 'peasant';
    const [bodySource, outfitSource, animationSource] = await Promise.all([
      needsBaseBody ? load(BODY_ASSETS[profile.body]) : Promise.resolve(null),
      load(OUTFIT_ASSETS[profile.body][profile.outfit]),
      load(ANIMATION_ASSETS[profile.library])
    ]);
    if (disposed) throw new Error(`캐릭터 로딩 중 장면이 종료됨: ${id}`);

    const root = new THREE.Group();
    root.name = `character-${id}`;
    root.scale.setScalar(profile.scale);

    const outfit = cloneSkeleton(outfitSource.scene);
    const ownedMaterials = new Set();
    prepareModel(outfit, { tint: profile.tint, tintOutfit: true }, ownedMaterials);
    const animatedModels = [outfit];
    if (bodySource) {
      const body = cloneSkeleton(bodySource.scene);
      prepareModel(body, { tint: profile.tint, tintOutfit: false }, ownedMaterials);
      animatedModels.unshift(body);
    }
    root.add(...animatedModels);

    const clips = new Map(animationSource.animations.map((clip) => [clip.name, clip]));
    const mixers = animatedModels.map((model) => new THREE.AnimationMixer(model));
    let activeActions = [];
    let currentClip = null;
    let released = false;

    function play(clipName) {
      if (released || currentClip === clipName) return;
      const clip = clips.get(clipName);
      if (!clip) throw new Error(`${id} 애니메이션을 찾을 수 없습니다: ${clipName}`);
      for (const action of activeActions) action.fadeOut(0.14);
      const nextActions = [];
      for (const mixer of mixers) {
        const action = mixer.clipAction(clip).reset().fadeIn(0.14).play();
        nextActions.push(action);
      }
      activeActions = nextActions;
      currentClip = clipName;
    }

    const character = Object.freeze({
      dispose() {
        if (released) return;
        released = true;
        instances.delete(character);
        for (const mixer of mixers) {
          mixer.stopAllAction();
          mixer.uncacheRoot(mixer.getRoot());
        }
        for (const material of ownedMaterials) material.dispose();
        root.removeFromParent();
      },
      id,
      play,
      profile,
      root,
      update(delta, state = {}) {
        play(chooseCharacterAnimation(profile, state));
        for (const mixer of mixers) mixer.update(delta);
      }
    });
    instances.add(character);
    character.update(0);
    return character;
  }

  return Object.freeze({
    create,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const instance of [...instances]) instance.dispose();
      disposeSourceResources(sourceResources);
      cache.clear();
    }
  });
}
