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

// 3장 배경의 좌우 대비 톤(호박 vs 시안)을 추천자의 반반 패널에도 재사용한다.
const SPLIT_PANEL_TINTS = Object.freeze({ left: '#e0a04a', right: '#35d2dc' });

function createAccessoryMaterial(color, overrides = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.16,
    metalness: 0.15,
    roughness: 0.48,
    ...overrides
  });
}

function addRoleAccessory(profile, root, ownedGeometries, ownedMaterials) {
  switch (profile.identity.accessory) {
    case 'record-ring': {
      const ring = addMesh(root, new THREE.TorusGeometry(0.28, 0.045, 8, 18), createAccessoryMaterial(profile.tint), ownedGeometries, ownedMaterials);
      ring.position.set(0.36, 1.2, 0.02);
      ring.rotation.y = Math.PI / 2;
      break;
    }
    case 'policy-tablet-line': {
      // 정책 태블릿 + 어깨를 가로지르는 얇은 라인.
      const material = createAccessoryMaterial(profile.tint);
      const tablet = addMesh(root, new THREE.BoxGeometry(0.24, 0.36, 0.055), material, ownedGeometries, ownedMaterials);
      tablet.position.set(-0.38, 1.02, 0.02);
      tablet.rotation.z = -0.16;
      const line = addMesh(root, new THREE.BoxGeometry(0.62, 0.035, 0.05), material, ownedGeometries, ownedMaterials);
      line.position.set(0, 1.4, 0.08);
      line.rotation.z = 0.1;
      break;
    }
    case 'scarf-pauldron': {
      // 기존 견갑은 의상 파츠 그대로 두고, 하루 톤 스카프(목 링 + 앞자락)를 더한다.
      const material = createAccessoryMaterial(profile.tint, { emissiveIntensity: 0.2, roughness: 0.62 });
      const scarf = addMesh(root, new THREE.TorusGeometry(0.16, 0.055, 8, 16), material, ownedGeometries, ownedMaterials);
      scarf.position.set(0, 1.42, 0.01);
      scarf.rotation.x = Math.PI / 2;
      const tail = addMesh(root, new THREE.BoxGeometry(0.09, 0.3, 0.035), material, ownedGeometries, ownedMaterials);
      tail.position.set(0.07, 1.24, 0.14);
      tail.rotation.z = -0.14;
      break;
    }
    case 'wide-arm-panels': {
      // 지우개 — 양옆으로 넓적한 판 형태의 팔 패널.
      const material = createAccessoryMaterial(profile.tint);
      const panelGeometry = new THREE.BoxGeometry(0.14, 0.56, 0.34);
      for (const side of [-1, 1]) {
        const panel = addMesh(root, panelGeometry, material, ownedGeometries, ownedMaterials);
        panel.position.set(side * 0.44, 1.02, 0);
        panel.rotation.z = side * 0.1;
      }
      break;
    }
    case 'stamp-head': {
      // 도장기 — 머리 위 도장 헤드(원기둥)와 손잡이.
      const material = createAccessoryMaterial(profile.tint);
      const head = addMesh(root, new THREE.CylinderGeometry(0.17, 0.19, 0.12, 12), material, ownedGeometries, ownedMaterials);
      head.position.set(0, 1.86, 0);
      const handle = addMesh(root, new THREE.CylinderGeometry(0.045, 0.045, 0.22, 8), material, ownedGeometries, ownedMaterials);
      handle.position.set(0, 2.03, 0);
      break;
    }
    case 'twin-afterimage': {
      // 카피캣 — 몸 옆에 살짝 어긋난 반투명 잔상 패널로 쌍둥이 틴트를 낸다.
      const material = createAccessoryMaterial(profile.tint, {
        depthWrite: false, emissiveIntensity: 0.24, opacity: 0.42, transparent: true
      });
      const afterimage = addMesh(root, new THREE.BoxGeometry(0.3, 0.92, 0.14), material, ownedGeometries, ownedMaterials);
      afterimage.position.set(0.27, 0.92, -0.09);
      afterimage.rotation.y = 0.18;
      break;
    }
    case 'split-tint-panel': {
      // 추천자 — 가슴에 왼쪽 호박·오른쪽 시안으로 갈라진 반반 패널.
      const halfGeometry = new THREE.BoxGeometry(0.13, 0.3, 0.05);
      const halves = [
        { color: SPLIT_PANEL_TINTS.left, x: -0.068 },
        { color: SPLIT_PANEL_TINTS.right, x: 0.068 }
      ];
      for (const half of halves) {
        const panel = addMesh(root, halfGeometry, createAccessoryMaterial(half.color, { emissiveIntensity: 0.24 }), ownedGeometries, ownedMaterials);
        panel.position.set(half.x, 1.16, 0.16);
      }
      break;
    }
    case 'gate-epaulet': {
      // 승인관 — 양어깨에 관문 기둥 모양 견장(기둥 + 갓돌).
      const material = createAccessoryMaterial(profile.tint);
      const pillarGeometry = new THREE.BoxGeometry(0.09, 0.3, 0.09);
      const capGeometry = new THREE.BoxGeometry(0.15, 0.05, 0.15);
      for (const side of [-1, 1]) {
        const pillar = addMesh(root, pillarGeometry, material, ownedGeometries, ownedMaterials);
        pillar.position.set(side * 0.3, 1.52, 0);
        const cap = addMesh(root, capGeometry, material, ownedGeometries, ownedMaterials);
        cap.position.set(side * 0.3, 1.69, 0);
      }
      break;
    }
    default:
      break;
  }
}

// 3장 이후의 DOT — 어긋난 어두운 판과 가는 발광 균열 선으로 '금 간 신뢰'를 몸체에 새긴다.
function addFractureMarks(profile, drone, ownedGeometries, ownedMaterials) {
  const plateMaterial = new THREE.MeshStandardMaterial({ color: 0x16222b, metalness: 0.42, roughness: 0.6 });
  const crackMaterial = new THREE.MeshStandardMaterial({
    color: 0x0c1418, emissive: profile.tint, emissiveIntensity: 0.85, metalness: 0.2, roughness: 0.4
  });
  const plateSpecs = [
    { position: [0.17, 0.15, 0.25], rotation: [0.32, 0.42, -0.22], size: [0.17, 0.13, 0.03] },
    { position: [-0.2, -0.11, 0.22], rotation: [-0.24, -0.5, 0.3], size: [0.14, 0.11, 0.03] }
  ];
  for (const spec of plateSpecs) {
    const plate = addMesh(drone, new THREE.BoxGeometry(...spec.size), plateMaterial, ownedGeometries, ownedMaterials);
    plate.position.set(...spec.position);
    plate.rotation.set(...spec.rotation);
  }
  const crackSpecs = [
    { position: [0.05, 0.06, 0.3], rotation: [0, 0.14, 0.62], size: [0.28, 0.014, 0.014] },
    { position: [-0.08, -0.05, 0.3], rotation: [0, -0.1, -0.48], size: [0.2, 0.012, 0.012] },
    { position: [0.12, -0.14, 0.26], rotation: [0.2, 0.3, 0.9], size: [0.16, 0.012, 0.012] }
  ];
  for (const spec of crackSpecs) {
    const crack = addMesh(drone, new THREE.BoxGeometry(...spec.size), crackMaterial, ownedGeometries, ownedMaterials);
    crack.position.set(...spec.position);
    crack.rotation.set(...spec.rotation);
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

  // fractured=true는 3장 이후 DOT에만 균열 표식을 붙인다. 기본값이면 기존 호출과 완전히 동일하다.
  async function create(id, { fractured = false } = {}) {
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
      if (fractured) addFractureMarks(profile, drone, ownedGeometries, ownedMaterials);
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
