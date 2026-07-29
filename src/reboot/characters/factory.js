import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

import { chooseCharacterAnimation } from './animationState.js';
import {
  ANIMATION_ASSETS,
  BODY_ASSETS,
  getCharacterProfile,
  HAIR_ASSETS,
  OUTFIT_ASSETS
} from './catalog.js';
import { disposeCharacterSourceResources, prepareCharacterModel, registerCharacterSourceResources } from './materialPresentation.js';

function addMesh(parent, geometry, material, ownedGeometries, ownedMaterials) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  ownedGeometries.add(geometry);
  ownedMaterials.add(material);
  parent.add(mesh);
  return mesh;
}

function addRoleAccessory(profile, root, ownedGeometries, ownedMaterials) {
  const material = new THREE.MeshStandardMaterial({
    color: profile.tint,
    emissive: profile.tint,
    emissiveIntensity: 0.16,
    metalness: 0.15,
    roughness: 0.48
  });
  if (profile.identity.accessory === 'record-ring') {
    const ring = addMesh(root, new THREE.TorusGeometry(0.28, 0.045, 8, 18), material, ownedGeometries, ownedMaterials);
    ring.position.set(0.36, 1.2, 0.02);
    ring.rotation.y = Math.PI / 2;
  } else if (profile.identity.accessory === 'policy-tablet') {
    const tablet = addMesh(root, new THREE.BoxGeometry(0.24, 0.36, 0.055), material, ownedGeometries, ownedMaterials);
    tablet.position.set(-0.38, 1.02, 0.02);
    tablet.rotation.z = -0.16;
  } else {
    material.dispose();
  }
}

function buildAuditDrone(profile, ownedGeometries, ownedMaterials) {
  const model = new THREE.Group();
  model.name = 'dot-audit-drone';
  const shell = new THREE.MeshStandardMaterial({ color: 0x28687c, metalness: 0.48, roughness: 0.34 });
  const accent = new THREE.MeshStandardMaterial({ color: profile.tint, metalness: 0.28, roughness: 0.42 });
  const sensor = new THREE.MeshStandardMaterial({
    color: 0xb9ffff, emissive: profile.tint, emissiveIntensity: 0.72, metalness: 0.2, roughness: 0.25
  });
  const body = addMesh(model, new THREE.OctahedronGeometry(0.34, 1), shell, ownedGeometries, ownedMaterials);
  body.scale.set(1.05, 1.18, 0.92);
  const ring = addMesh(model, new THREE.TorusGeometry(0.47, 0.045, 8, 20), accent, ownedGeometries, ownedMaterials);
  ring.rotation.x = 0.18;
  ring.scale.y = 1.35;
  for (const side of [-1, 1]) {
    const fin = addMesh(model, new THREE.BoxGeometry(0.22, 0.08, 0.34), accent.clone(), ownedGeometries, ownedMaterials);
    fin.position.set(side * 0.46, 0, 0);
    fin.rotation.z = side * 0.24;
  }
  const eye = addMesh(model, new THREE.SphereGeometry(0.105, 12, 8), sensor, ownedGeometries, ownedMaterials);
  eye.position.set(0, 0.02, 0.31);
  model.position.y = 1.25;
  return model;
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
        registerCharacterSourceResources(gltf, sourceResources);
        if (disposed) disposeCharacterSourceResources(sourceResources);
        return gltf;
      }, (error) => {
        // 실패한 프로미스를 캐시에 남기면 같은 장면 안에서 재시도가 영영 막힌다 — 지우고 전파.
        cache.delete(url);
        throw error;
      });
      cache.set(url, pending);
    }
    return cache.get(url);
  }

  async function create(id) {
    if (disposed) throw new Error('폐기된 캐릭터 팩토리는 사용할 수 없습니다.');
    const profile = getCharacterProfile(id);
    const root = new THREE.Group();
    root.name = `character-${id}`;
    root.scale.setScalar(profile.scale);
    const ownedGeometries = new Set();
    const ownedMaterials = new Set();
    let released = false;

    if (profile.identity.kind === 'audit-drone') {
      const drone = buildAuditDrone(profile, ownedGeometries, ownedMaterials);
      root.add(drone);
      let elapsed = 0;
      const character = Object.freeze({
        dispose() {
          if (released) return;
          released = true;
          instances.delete(character);
          for (const material of ownedMaterials) material.dispose();
          for (const geometry of ownedGeometries) geometry.dispose();
          root.removeFromParent();
        },
        id,
        play() {},
        profile,
        root,
        update(delta) {
          elapsed += delta;
          drone.position.y = 1.25 + Math.sin(elapsed * 2.2) * 0.055;
          drone.rotation.y = Math.sin(elapsed * 0.9) * 0.2;
        }
      });
      instances.add(character);
      return character;
    }

    const needsBaseBody = profile.outfit === 'peasant' || Boolean(profile.hair);
    const [bodySource, outfitSource, hairSource, animationSource] = await Promise.all([
      needsBaseBody ? load(BODY_ASSETS[profile.body]) : Promise.resolve(null),
      load(OUTFIT_ASSETS[profile.body][profile.outfit]),
      profile.hair ? load(HAIR_ASSETS[profile.hair]) : Promise.resolve(null),
      load(ANIMATION_ASSETS[profile.library])
    ]);
    if (disposed) throw new Error(`캐릭터 로딩 중 장면이 종료됨: ${id}`);

    const outfit = cloneSkeleton(outfitSource.scene);
    prepareCharacterModel({
      hiddenParts: profile.hiddenParts, model: outfit, ownedMaterials,
      presentation: profile.presentation
    });
    const animatedModels = [outfit];
    if (bodySource) {
      const body = cloneSkeleton(bodySource.scene);
      prepareCharacterModel({ hiddenParts: [], model: body, ownedMaterials, presentation: profile.presentation });
      animatedModels.unshift(body);
    }
    if (hairSource) {
      const hair = cloneSkeleton(hairSource.scene);
      prepareCharacterModel({ hiddenParts: [], model: hair, ownedMaterials, presentation: profile.presentation });
      animatedModels.push(hair);
    }
    root.add(...animatedModels);
    addRoleAccessory(profile, root, ownedGeometries, ownedMaterials);

    const clips = new Map(animationSource.animations.map((clip) => [clip.name, clip]));
    const mixers = animatedModels.map((model) => new THREE.AnimationMixer(model));
    let activeActions = [];
    let currentClip = null;
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
        for (const geometry of ownedGeometries) geometry.dispose();
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
      disposeCharacterSourceResources(sourceResources);
      cache.clear();
    }
  });
}
