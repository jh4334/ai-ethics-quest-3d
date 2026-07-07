import * as THREE from 'three';
import { DUNGEON_ROOMS, cellToWorld, roomBounds } from './dungeonPuzzles.js';

// 사당 던전의 3D 표현 계층 — 전부 프리미티브, 외부 에셋 0.
// 원점 중심의 어두운 방 하나를 짓고, dispose로 깔끔히 걷어낸다.

// 종류별 상자 색(사적=따뜻한 경고색, 내 것=시원한 공유색).
const CRATE_COLOR = {
  'friend-photo': 0xff8f6b,
  'my-drawing': 0x64c8ff
};
// 존 색(잠금=보라, 공개=초록).
const ZONE_COLOR = {
  vault: 0x8a5bff,
  board: 0x5bd08a
};

// 이모지/기호 스프라이트(캔버스 생성 — 파일 에셋 없음).
function makeGlyphSprite(glyph, scale = 0.9) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = '96px system-ui, -apple-system, "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, 64, 72);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

// 공유 지오메트리(재생성·중복 dispose 방지 위해 모듈 스코프 캐시).
const CRATE_GEO = new THREE.BoxGeometry(0.86, 0.86, 0.86);
const SHARED = new Set([CRATE_GEO]);

export function buildDungeonRoom(topicId, opts = {}) {
  const room = DUNGEON_ROOMS[topicId];
  const makeLabel = opts.makeLabel;
  const root = new THREE.Group();
  root.userData.isDungeon = true;
  const { cols, rows, cell } = room.grid;
  const width = cols * cell;
  const depth = rows * cell;

  // 바닥.
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.4, depth),
    new THREE.MeshStandardMaterial({ color: 0x2a2440, roughness: 0.95 })
  );
  floor.position.y = -0.2;
  floor.receiveShadow = false;
  root.add(floor);

  // 격자 라인(옅은 발광 선)으로 칸을 읽기 쉽게.
  const gridHelper = new THREE.GridHelper(Math.max(width, depth), Math.max(cols, rows), 0x4a3f70, 0x372f57);
  gridHelper.position.y = 0.02;
  root.add(gridHelper);

  // 벽 4면.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1c1730, roughness: 1, emissive: 0x0d0a1a, emissiveIntensity: 0.4 });
  const wallH = 2.2;
  const walls = [
    [width + 0.4, wallH, 0.4, 0, wallH / 2 - 0.2, -depth / 2],
    [width + 0.4, wallH, 0.4, 0, wallH / 2 - 0.2, depth / 2],
    [0.4, wallH, depth + 0.4, -width / 2, wallH / 2 - 0.2, 0],
    [0.4, wallH, depth + 0.4, width / 2, wallH / 2 - 0.2, 0]
  ];
  for (const [w, h, d, x, y, z] of walls) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    wall.position.set(x, y, z);
    root.add(wall);
  }

  // 존 발광 타일 + 라벨.
  const zoneMeshes = [];
  for (const zone of room.zones) {
    const color = ZONE_COLOR[zone.id] ?? 0x8a5bff;
    for (const cellPos of zone.cells) {
      const { x, z } = cellToWorld(topicId, cellPos);
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(cell * 0.92, cell * 0.92),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 })
      );
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(x, 0.05, z);
      root.add(tile);
      zoneMeshes.push(tile);
    }
    // 존 대표 칸 위에 이모지 + 이름표.
    const head = cellToWorld(topicId, zone.cells[0]);
    const glyph = makeGlyphSprite(zone.emoji, 0.8);
    glyph.position.set(head.x, 1.5, head.z);
    root.add(glyph);
    if (makeLabel) {
      const tag = makeLabel(zone.labelKo, `#${color.toString(16).padStart(6, '0')}`);
      tag.scale.set(1.7, 0.42, 1);
      tag.position.set(head.x, 1.0, head.z);
      root.add(tag);
    }
  }

  // 상자들.
  const crateMeshes = new Map();
  for (const crate of room.crates) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: CRATE_COLOR[crate.kind] ?? 0xcccccc,
      roughness: 0.55,
      emissive: CRATE_COLOR[crate.kind] ?? 0xcccccc,
      emissiveIntensity: 0.18,
      flatShading: true
    });
    const box = new THREE.Mesh(CRATE_GEO, mat);
    box.position.y = 0.5;
    group.add(box);
    const glyph = makeGlyphSprite(crate.emoji, 0.7);
    glyph.position.y = 1.15;
    group.add(glyph);
    const { x, z } = cellToWorld(topicId, crate.start);
    group.position.set(x, 0, z);
    root.add(group);
    crateMeshes.set(crate.id, { group, box });
  }

  // 북쪽 제단(아이템 획득 자리).
  const pedGroup = new THREE.Group();
  const ped = cellToWorld(topicId, room.pedestal);
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.62, 0.9, 16),
    new THREE.MeshStandardMaterial({ color: 0x3a3358, roughness: 0.7, emissive: 0x2a2348, emissiveIntensity: 0.5 })
  );
  pedestal.position.y = 0.45;
  const pedGlow = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.24, 0),
    new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffcf5a, emissiveIntensity: 1.2, roughness: 0.3 })
  );
  pedGlow.position.y = 1.15;
  pedGroup.add(pedestal, pedGlow);
  pedGroup.position.set(ped.x, 0, ped.z);
  root.add(pedGroup);

  // 남쪽 출구 문(빛 아치).
  const exit = cellToWorld(topicId, room.entry);
  const door = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.12, 10, 20, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x7be0ff, emissive: 0x37c6ff, emissiveIntensity: 0.9, roughness: 0.4 })
  );
  door.position.set(exit.x, 0.1, exit.z + cell * 0.5);
  root.add(door);

  // 방 전용 조명(그림자 캐스터 0).
  const hemi = new THREE.HemisphereLight(0x5a4d88, 0x14101f, 0.9);
  root.add(hemi);
  const key = new THREE.PointLight(0xbfa8ff, 1.1, 22);
  key.position.set(0, 5, 3);
  root.add(key);
  const warm = new THREE.PointLight(0xffcf7a, 0.7, 14);
  warm.position.set(ped.x, 3, ped.z);
  root.add(warm);

  return {
    root,
    crateMeshes,
    pedestal: pedGroup,
    pedGlow,
    door,
    zoneMeshes,
    bounds: roomBounds(topicId)
  };
}

export function disposeDungeonRoom(root, scene) {
  if (!root) {
    return;
  }
  root.traverse((child) => {
    // GridHelper는 LineSegments(isLine)이라 mesh/sprite 검사만으론 누수된다.
    if (child.isMesh || child.isSprite || child.isLine) {
      if (child.geometry && !SHARED.has(child.geometry)) {
        child.geometry.dispose?.();
      }
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        material?.map?.dispose?.();
        material?.dispose?.();
      }
    }
  });
  scene?.remove(root);
}
