import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import sharp from 'sharp';
import * as THREE from 'three';

import {
  CHARACTER_ASSET_PATHS,
  CHARACTER_ROSTER,
  getCharacterProfile
} from '../src/reboot/characters/catalog.js';
import { chooseCharacterAnimation } from '../src/reboot/characters/animationState.js';
import { createCharacterCast } from '../src/reboot/characters/cast.js';
import { createCharacterFactory } from '../src/reboot/characters/factory.js';

const REQUIRED_CHARACTER_IDS = [
  'player',
  'dot',
  'haru',
  'yoonseo',
  'student-a',
  'student-b',
  'storybook-reader',
  'storybook-haru',
  'eraser',
  'stamper',
  'copycat',
  'recommender',
  'approval',
  'attendance-proctor',
  'lumen'
];

test('reboot roster gives every story role an explicit licensed or procedural profile', () => {
  // Given: the complete reboot story roster.
  const rosterIds = Object.keys(CHARACTER_ROSTER).sort();

  // When: each authored role is inspected.
  // Then: human roles point to imported models while DOT is the explicit procedural machine.
  assert.deepEqual(rosterIds, [...REQUIRED_CHARACTER_IDS].sort());
  for (const id of REQUIRED_CHARACTER_IDS) {
    const profile = getCharacterProfile(id);
    assert.equal(profile.id, id);
    if (id === 'dot') {
      assert.equal(profile.body, null);
      assert.equal(profile.outfit, null);
    } else {
      assert.match(profile.body, /^(female|male)$/);
      assert.match(profile.outfit, /^(peasant|ranger|student)$/);
    }
    assert.match(profile.tint, /^#[0-9a-f]{6}$/i);
    const minimumScale = id === 'dot' ? 0.6 : id === 'player' ? 0.7 : 0.8;
    assert.ok(profile.scale >= minimumScale && profile.scale <= 1.31);
    assert.deepEqual(Object.keys(profile.animations).sort(), ['action', 'defeat', 'hit', 'idle', 'move']);
  }
  assert.throws(() => getCharacterProfile('missing-role'), /missing-role/);
});

test('main cast identity metadata separates three visible humans from the DOT audit drone', () => {
  // Given: the four characters shown together in the live school camera.
  const mainCast = ['player', 'dot', 'haru', 'yoonseo'].map(getCharacterProfile);

  // When: their authored identity contracts are compared.
  const humans = mainCast.filter((profile) => profile.identity.kind === 'human');
  const signatures = mainCast.map((profile) => [
    profile.identity.kind,
    profile.identity.face,
    profile.identity.hair,
    profile.identity.outfit,
    profile.identity.silhouette
  ].join(':'));

  // Then: the humans have visible, different hair/outfit silhouettes and DOT is a machine.
  assert.equal(humans.length, 3);
  assert.equal(new Set(humans.map((profile) => profile.identity.hair)).size, 3);
  assert.equal(new Set(signatures).size, 4);
  assert.equal(getCharacterProfile('dot').identity.kind, 'audit-drone');
  assert.equal(getCharacterProfile('dot').body, null);
  assert.equal(getCharacterProfile('dot').outfit, null);
});

test('storybook children use dedicated licensed mini-character GLBs', () => {
  const profiles = ['storybook-reader', 'storybook-haru'].map(getCharacterProfile);
  assert.deepEqual(profiles.map(({ identity }) => identity.silhouette), [
    'storybook-reader-mini-child',
    'storybook-haru-mini-child'
  ]);
  for (const profile of profiles) {
    assert.equal(profile.outfit, 'peasant');
    assert.match(profile.standaloneAsset, /^\.\/assets\/storybook3d\/characters\/.+-mini\.glb$/);
    assert.equal(profile.animations.idle, 'idle');
    assert.equal(profile.animations.action, 'interact-right');
  }
});

test('enemy roster gives each of the five foes a distinct accessory-driven silhouette', () => {
  // Given: 장별 적 5종(삭제자·도장꾼·복제자·추천자·승인관)의 프로필.
  const enemyIds = ['eraser', 'stamper', 'copycat', 'recommender', 'approval'];
  const profiles = enemyIds.map(getCharacterProfile);

  // When: 실루엣 문자열과 액세서리 계약을 비교한다.
  const silhouettes = profiles.map((profile) => profile.identity.silhouette);
  const accessories = profiles.map((profile) => profile.identity.accessory);

  // Then: 다섯 실루엣이 서로 다르고, 몸-의상 기본값에 기대지 않으며, 액세서리가 모두 존재한다.
  assert.equal(new Set(silhouettes).size, enemyIds.length);
  assert.equal(new Set(accessories).size, enemyIds.length);
  for (const profile of profiles) {
    assert.notEqual(profile.identity.accessory, 'none');
    assert.notEqual(profile.identity.silhouette, `${profile.body}-${profile.outfit}`);
  }
});

test('enemy accessories attach as shadowless procedural meshes that survive dispose', async (t) => {
  // Given: 기존 팩토리 테스트와 같은 mock 로더로 적 5종을 조립한다.
  const makeMesh = (name) => {
    const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    texture.needsUpdate = true;
    const material = new THREE.MeshStandardMaterial({ color: 0x778899, map: texture });
    material.name = name;
    return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  };
  const loader = {
    async loadAsync(url) {
      const scene = new THREE.Group();
      if (url.includes('/base/')) {
        scene.add(makeMesh('MI_Regular'), makeMesh('MI_Eyes'));
      } else if (url.includes('/outfits/')) {
        scene.add(makeMesh(url.includes('Ranger') ? 'MI_Ranger' : 'MI_Peasant'));
      }
      const animations = [
        'Interact', 'Death01', 'Hit_Chest', 'Idle_Loop', 'Jog_Fwd_Loop',
        'Melee_Hook', 'Hit_Knockback', 'Idle_FoldArms_Loop', 'Zombie_Walk_Fwd_Loop'
      ].map((name) => new THREE.AnimationClip(name, 1, []));
      return { animations, scene };
    }
  };
  const factory = createCharacterFactory({ loader });
  t.after(() => factory.dispose());

  for (const id of ['eraser', 'stamper', 'copycat', 'recommender', 'approval']) {
    // When: 각 적을 생성해 GLTF 재질(name 있음)이 아닌 프로시저럴 액세서리 메시를 찾는다.
    const character = await factory.create(id);
    const accessoryMeshes = [];
    character.root.traverse((object) => {
      if (object.isMesh && !object.material.name) accessoryMeshes.push(object);
    });

    // Then: 액세서리 메시가 실제로 붙어 있고 그림자 캐스터가 아니며 dispose가 안전하다.
    assert.ok(accessoryMeshes.length >= 1, `${id} 액세서리 메시가 없음`);
    for (const mesh of accessoryMeshes) {
      assert.equal(mesh.castShadow, false);
      assert.equal(mesh.receiveShadow, false);
    }
    character.dispose();
    character.dispose();
  }
});

test('fractured DOT gains crack marks over the default drone without breaking dispose', async (t) => {
  // Given: DOT는 GLTF를 전혀 로드하지 않으므로 로더 호출 자체가 실패해야 한다.
  const loader = {
    async loadAsync() {
      throw new Error('DOT 드론은 GLTF를 로드하지 않아야 합니다.');
    }
  };
  const factory = createCharacterFactory({ loader });
  t.after(() => factory.dispose());
  const countMeshes = (character) => {
    let count = 0;
    character.root.traverse((object) => {
      if (object.isMesh) count += 1;
    });
    return count;
  };

  // When: 기본 DOT와 균열 표식 DOT를 나란히 만든다.
  const plain = await factory.create('dot');
  const fractured = await factory.create('dot', { fractured: true });

  // Then: 균열 표식만큼 메시가 늘고, 전부 그림자 없이 붙으며, 이중 dispose도 안전하다.
  assert.ok(countMeshes(fractured) > countMeshes(plain));
  fractured.root.traverse((object) => {
    if (!object.isMesh) return;
    assert.equal(object.castShadow, false);
    assert.equal(object.receiveShadow, false);
  });
  fractured.update(1 / 60);
  fractured.dispose();
  fractured.dispose();
  plain.dispose();
});

test('main cast presentation stays large and texture-lit enough for the live school camera', () => {
  // Given: the four characters viewed together at desktop and mobile gameplay distance.
  const mainCast = ['player', 'dot', 'haru', 'yoonseo'].map(getCharacterProfile);
  const humans = mainCast.filter((profile) => profile.identity.kind === 'human');

  // When: their authored presentation bounds are inspected.
  // Then: humans keep readable scale while the player exposes hair, face, coat, and narrow scarf layers.
  assert.equal(getCharacterProfile('player').scale, 1.18);
  assert.equal(humans.filter(({ id }) => id !== 'player').every((profile) => profile.scale === 1.3), true);
  assert.equal(getCharacterProfile('dot').scale, 0.62);
  assert.equal(getCharacterProfile('player').body, 'male');
  assert.equal(getCharacterProfile('player').outfit, 'student');
  assert.equal(getCharacterProfile('player').outfitTint, '#ffffff');
  assert.equal(getCharacterProfile('player').hairTint, '#1c2538');
  assert.equal(getCharacterProfile('player').hair, 'simpleParted');
  assert.equal(getCharacterProfile('player').standaloneAsset, null);
  assert.deepEqual(getCharacterProfile('player').animations, {
    action: 'Interact', defeat: 'Death01', hit: 'Hit_Chest', idle: 'Idle_Loop', move: 'Jog_Fwd_Loop'
  });
  assert.equal(getCharacterProfile('player').identity.silhouette, 'reference-navy-student-coat-scarf');
  for (const profile of humans) {
    assert.deepEqual(Object.keys(profile.presentation).sort(), ['hairEmissive', 'outfitEmissive', 'skinEmissive']);
    assert.ok(profile.presentation.outfitEmissive >= 0.08);
    assert.ok(profile.presentation.skinEmissive > profile.presentation.outfitEmissive);
    assert.ok(profile.presentation.hairEmissive >= profile.presentation.skinEmissive);
    assert.ok(Math.max(...Object.values(profile.presentation)) <= 0.22);
  }
});

test('character factory assembles the visible-haired student ranger and adds only narrow ochre scarf tails', async (t) => {
  // Given: mapped body, outfit, and hair sources with a neutral base color.
  const loadedUrls = [];
  const makeMesh = (name) => {
    const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    texture.needsUpdate = true;
    const material = new THREE.MeshStandardMaterial({ color: 0x778899, map: texture });
    material.name = name;
    return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  };
  const loader = {
    async loadAsync(url) {
      loadedUrls.push(url);
      const scene = new THREE.Group();
      if (url.includes('/rpg/Ranger-runtime.glb')) {
        const ranger = makeMesh('Ranger_Texture');
        ranger.name = 'Ranger';
        const bow = makeMesh('Bow_Texture');
        bow.name = 'Ranger_Bow';
        scene.add(ranger, bow);
      } else if (url.includes('/Hair_')) {
        scene.add(makeMesh('MI_Hair_1'));
      } else if (url.includes('/base/')) {
        scene.add(makeMesh('MI_Regular_Female'), makeMesh('MI_Eyes'));
      } else if (url.includes('/outfits/')) {
        if (url.includes('Player_Student')) {
          const hood = makeMesh('MI_Ranger');
          hood.name = 'Male_Ranger_Head_Hood';
          scene.add(makeMesh('MI_Ranger'), hood);
        } else {
          const outfit = makeMesh(url.includes('Ranger') ? 'MI_Ranger' : 'MI_Peasant');
          if (url.includes('Male_Ranger')) outfit.name = 'Male_Ranger_Head_Hood';
          scene.add(outfit);
        }
      }
      const animations = [
        'Interact', 'Death01', 'Hit_Chest', 'Idle_Loop', 'Jog_Fwd_Loop',
        'Punch', 'Death', 'RecieveHit', 'Idle', 'Run'
      ]
        .map((name) => new THREE.AnimationClip(name, 1, []));
      return { animations, scene };
    }
  };
  const factory = createCharacterFactory({ loader });
  t.after(() => factory.dispose());

  // When: the player presentation is assembled.
  assert.deepEqual(getCharacterProfile('player').hiddenParts, ['Male_Ranger_Head_Hood']);
  const character = await factory.create('player');
  const materials = [];
  character.root.traverse((object) => {
    if (!object.isMesh) return;
    const entries = Array.isArray(object.material) ? object.material : [object.material];
    materials.push(...entries);
  });

  // Then: the shared body, student tunic, visible hair, and UAL clips form the student silhouette.
  const importedMaterials = materials.filter((material) => material.name);
  assert.deepEqual(loadedUrls, [
    CHARACTER_ASSET_PATHS.maleBody,
    CHARACTER_ASSET_PATHS.maleStudent,
    CHARACTER_ASSET_PATHS.hairSimpleParted,
    CHARACTER_ASSET_PATHS.animationLibrary1
  ]);
  assert.equal(importedMaterials.length, 5);
  assert.equal(importedMaterials.every((material) => material.map?.isTexture), true);
  assert.equal(importedMaterials.every((material) => material.emissiveMap === material.map), true);
  assert.equal(importedMaterials.find((material) => material.name === 'MI_Ranger').polygonOffset, true);
  assert.equal(character.root.getObjectByName('character-player-outfit').scale.x, 1.01);
  assert.equal(character.root.getObjectByName('Male_Ranger_Head_Hood').visible, false);
  assert.equal(importedMaterials.every((material) => material.emissiveIntensity <= 0.22), true);
  assert.equal(Boolean(character.root.getObjectByName('player-navy-coat')), false);
  assert.equal(Boolean(character.root.getObjectByName('player-gold-coat-trim')), false);
  assert.ok(character.root.getObjectByName('player-ochre-scarf-knot'));
  assert.ok(character.root.getObjectByName('player-ochre-scarf-tail-left'));
  assert.ok(character.root.getObjectByName('player-ochre-scarf-tail-right'));

  const haru = await factory.create('haru');
  assert.equal(haru.root.getObjectByName('Male_Ranger_Head_Hood').visible, false);
});

test('character animation priority is deterministic across combat and movement', () => {
  // Given: a profile with five named clips.
  const profile = getCharacterProfile('player');

  // When: overlapping state flags are resolved.
  // Then: terminal and one-shot states outrank locomotion without randomness.
  assert.equal(chooseCharacterAnimation(profile, {}), profile.animations.idle);
  assert.equal(chooseCharacterAnimation(profile, { moving: true }), profile.animations.move);
  assert.equal(chooseCharacterAnimation(profile, { acting: true, moving: true }), profile.animations.action);
  assert.equal(chooseCharacterAnimation(profile, { hit: true, acting: true }), profile.animations.hit);
  assert.equal(chooseCharacterAnimation(profile, { defeated: true, hit: true }), profile.animations.defeat);
});

test('character cast accepts the authoritative simulation pose without moving itself', () => {
  // Given: 아직 에셋을 로드하지 않은 학교 캐릭터 캐스트가 있다.
  const scene = new THREE.Scene();
  const cast = createCharacterCast({ scene });
  assert.deepEqual(cast.getDebugState().visibleIds, ['player', 'dot']);

  // When: 고정 스텝 시뮬레이션 위치와 상태를 적용한다.
  cast.setPlayerState({
    action: 'attack1',
    facing: { x: 1, y: 0 },
    position: { x: 2.5, y: -7 },
    status: 'active'
  });
  cast.update(1 / 60);

  // Then: Three 앵커는 x/z 평면에 그대로 반영된다.
  assert.deepEqual(cast.getPlayerPosition().toArray(), [2.5, 0, -7]);
  cast.dispose();
});

test('runtime character assets exist locally and are documented as CC0', () => {
  // Given: every runtime file declared by the character catalog.
  const projectRoot = new URL('../', import.meta.url);

  // When: paths and provenance are checked from disk.
  // Then: the build is self-contained and every external pack is attributed.
  for (const path of Object.values(CHARACTER_ASSET_PATHS)) {
    assert.match(path, /^\.\/assets\//, `배포 하위 경로를 보존해야 함: ${path}`);
    assert.equal(existsSync(new URL(`../public/${path.slice(2)}`, import.meta.url)), true, path);
  }
  const licenses = readFileSync(new URL('../ASSET_LICENSES.md', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../public/reboot-assets.json', import.meta.url), 'utf8'));
  assert.equal(manifest.includes(CHARACTER_ASSET_PATHS.rpgRanger), true);
  for (const name of ['Hair_Buns', 'Hair_Long', 'Hair_SimpleParted']) {
    for (const extension of ['bin', 'gltf']) {
      const path = `./assets/reboot/characters/base/${name}.${extension}`;
      assert.equal(existsSync(new URL(`../public/${path.slice(2)}`, import.meta.url)), true, path);
      assert.equal(manifest.includes(path), true, `${path} manifest`);
    }
    assert.match(licenses, new RegExp(name));
  }
  assert.match(licenses, /Universal Base Characters/i);
  assert.match(licenses, /Modular Character Outfits - Fantasy/i);
  assert.match(licenses, /Universal Animation Library(?: 2)?/i);
  assert.match(licenses, /RPG Character Pack/i);
  assert.match(licenses, /CC0 1\.0/i);
  assert.ok(projectRoot);
});

test('reference-derived player texture fully decodes as a browser-ready RGBA atlas', async () => {
  // Given: 플레이어 GLTF가 상대 경로로 읽는 생성 텍스처.
  const texture = readFileSync(new URL(
    '../public/assets/reboot/characters/outfits/T_Player_Student_BaseColor.png',
    import.meta.url
  ));

  // When: PNG 전체 픽셀을 디코드한다. 헤더만 읽으면 잘린 파일을 놓칠 수 있다.
  const image = sharp(texture);
  const metadata = await image.metadata();
  await image.stats();

  // Then: Three.js가 기대하는 Ranger 아틀라스 크기와 알파 채널을 유지한다.
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 1024);
  assert.equal(metadata.channels, 4);
  assert.equal(metadata.hasAlpha, true);
});

test('school scene uses the imported character pipeline instead of primitive avatars', () => {
  // Given: the authored school scene source.
  const source = readFileSync(new URL('../src/reboot/render/schoolNightScene.js', import.meta.url), 'utf8');
  const cameraSource = readFileSync(new URL('../src/reboot/render/schoolSceneCamera.js', import.meta.url), 'utf8');

  // When: its player construction is inspected.
  // Then: no capsule or other primitive avatar remains in the reboot runtime.
  assert.match(source, /createCharacterCast/);
  assert.match(source, /createSchoolRoute/);
  assert.match(source, /createEncounterGameRuntime/);
  assert.match(source, /startFacing:\s*\{\s*x:\s*0,\s*y:\s*-1\s*\}/);
  assert.match(source, /createEnemyCast/);
  assert.match(source, /createCombatPresentationAdapter/);
  assert.match(source, /createCameraController[\s\S]*updateSchoolCamera/);
  assert.match(cameraSource, /updateCameraController/);
  assert.match(source, /canvas\.dataset\.lastAction/);
  assert.doesNotMatch(source, /CapsuleGeometry|playerGeometry|playerMaterial/);
  assert.doesNotMatch(source, /new THREE\.PlaneGeometry/);
});
