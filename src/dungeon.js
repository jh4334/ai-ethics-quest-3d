import * as THREE from 'three';
import { DUNGEON_ROOMS, cellToWorld, roomBounds } from './dungeonPuzzles.js';

// 사당 던전의 3D 표현 계층 — 전부 프리미티브, 외부 에셋 0.
// 원점 중심의 어두운 방 하나를 짓고, dispose로 깔끔히 걷어낸다.
// 로직(dungeonPuzzles.js)은 순수 상태만 다루고, 여기서 상태→비주얼 동기화를 맡는다.

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
// 씨앗/꽃 색(편향 방 colorIdx 0..3).
const SEED_COLOR = [0xff5a5a, 0x4f9dff, 0xffd23f, 0xa88bff];

// 이모지/기호 스프라이트(캔버스 생성 — 파일 에셋 없음).
export function makeGlyphSprite(glyph, scale = 0.9) {
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
const BEAM_GEO_H = new THREE.BoxGeometry(1.2, 0.09, 0.09);
const BEAM_GEO_V = new THREE.BoxGeometry(0.09, 0.09, 1.2);
const SHARED = new Set([CRATE_GEO, BEAM_GEO_H, BEAM_GEO_V]);

function buildShell(room, topicId, makeLabel) {
  const root = new THREE.Group();
  root.userData.isDungeon = true;
  const { cols, rows, cell } = room.grid;
  const width = cols * cell;
  const depth = rows * cell;

  // 그레이딩(노출<1·콘트라스트)이 어두운 실내를 짓누르므로 바닥은 자체 발광을 살짝 준다.
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.4, depth),
    new THREE.MeshStandardMaterial({ color: 0x453c68, roughness: 0.9, emissive: 0x1c1636, emissiveIntensity: 0.6 })
  );
  floor.position.y = -0.2;
  root.add(floor);

  const gridHelper = new THREE.GridHelper(Math.max(width, depth), Math.max(cols, rows), 0x4a3f70, 0x372f57);
  gridHelper.position.y = 0.02;
  root.add(gridHelper);

  // 벽 안쪽면이 화면 하단을 크게 차지하므로 완전 검정이 되지 않게 발광을 준다.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x38305c, roughness: 1, emissive: 0x1a1433, emissiveIntensity: 0.7 });
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

  // 방 전용 조명(그림자 캐스터 0) — 구석 소품(씨앗 통·거울)까지 읽히게 충분히.
  const hemi = new THREE.HemisphereLight(0x8a7cc0, 0x2a2140, 2.0);
  root.add(hemi);
  const key = new THREE.PointLight(0xcfbcff, 2.4, 34);
  key.position.set(0, 5.5, 2);
  root.add(key);
  const warm = new THREE.PointLight(0xffcf7a, 0.7, 14);
  warm.position.set(ped.x, 3, ped.z);
  root.add(warm);

  const addLabel = (text, colorHex, x, y, z) => {
    if (!makeLabel) {
      return;
    }
    const tag = makeLabel(text, colorHex);
    tag.scale.set(1.7, 0.42, 1);
    tag.position.set(x, y, z);
    root.add(tag);
  };

  return { root, pedestal: pedGroup, pedGlow, door, cell, addLabel };
}

function buildPushProps(room, topicId, root, addLabel, cell) {
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
    const head = cellToWorld(topicId, zone.cells[0]);
    const glyph = makeGlyphSprite(zone.emoji, 0.8);
    glyph.position.set(head.x, 1.5, head.z);
    root.add(glyph);
    addLabel(zone.labelKo, `#${color.toString(16).padStart(6, '0')}`, head.x, 1.0, head.z);
  }

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
  return { crateMeshes, zoneMeshes };
}

function buildCarryProps(room, topicId, root, addLabel) {
  const props = { dispenserMeshes: new Map(), bedMeshes: new Map(), exhibitMeshes: new Map(), plateMeshes: new Map() };
  // 편향: 씨앗 통 + 꽃밭.
  for (const d of room.dispensers ?? []) {
    const { x, z } = cellToWorld(topicId, d.cell);
    const group = new THREE.Group();
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.4, 0.62, 12),
      new THREE.MeshStandardMaterial({ color: 0x4a4066, roughness: 0.8 })
    );
    barrel.position.y = 0.31;
    const seed = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.2, 0),
      new THREE.MeshStandardMaterial({ color: SEED_COLOR[d.colorIdx], emissive: SEED_COLOR[d.colorIdx], emissiveIntensity: 0.55, flatShading: true })
    );
    seed.position.y = 0.85;
    group.add(barrel, seed);
    group.position.set(x, 0, z);
    root.add(group);
    addLabel(d.labelKo, `#${SEED_COLOR[d.colorIdx].toString(16).padStart(6, '0')}`, x, 1.35, z);
    props.dispenserMeshes.set(d.id, { group, seed });
  }
  (room.beds ?? []).forEach((b, i) => {
    const { x, z } = cellToWorld(topicId, b.cell);
    const group = new THREE.Group();
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.5, 0.16, 14),
      new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1, emissive: 0x2a1e12, emissiveIntensity: 0.5 })
    );
    soil.position.y = 0.08;
    // 심으면 나타나는 꽃(줄기+머리) — sync에서 색·표시 갱신.
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x4f9d5a, roughness: 0.8 })
    );
    stem.position.y = 0.42;
    const bloomMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5, flatShading: true });
    const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), bloomMat);
    bloom.position.y = 0.72;
    const flower = new THREE.Group();
    flower.add(stem, bloom);
    flower.visible = false;
    group.add(soil, flower);
    group.position.set(x, 0, z);
    root.add(group);
    props.bedMeshes.set(i, { group, flower, bloomMat });
  });
  // 저작권: 전시대 + 이름표.
  for (const ex of room.exhibits ?? []) {
    const { x, z } = cellToWorld(topicId, ex.cell);
    const group = new THREE.Group();
    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.5, 0.85, 12),
      new THREE.MeshStandardMaterial({ color: 0x3a3358, roughness: 0.7, emissive: 0x241f3d, emissiveIntensity: 0.5 })
    );
    stand.position.y = 0.42;
    group.add(stand);
    const glyph = makeGlyphSprite(ex.emoji, 0.75);
    glyph.position.y = 1.2;
    group.add(glyph);
    group.position.set(x, 0, z);
    root.add(group);
    addLabel(ex.labelKo, '#ffd76a', x, 1.7, z);
    props.exhibitMeshes.set(ex.id, { group });
  }
  for (const p of room.plates ?? []) {
    const { x, z } = cellToWorld(topicId, p.cell);
    const group = new THREE.Group();
    const tablet = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.42, 0.1),
      new THREE.MeshStandardMaterial({ color: p.fake ? 0x8a8098 : 0xd9c27a, roughness: 0.5, emissive: p.fake ? 0x3a3444 : 0x6a5a24, emissiveIntensity: 0.35 })
    );
    tablet.position.y = 0.5;
    group.add(tablet);
    group.position.set(x, 0, z);
    root.add(group);
    addLabel(p.labelKo, p.fake ? '#b9b0c8' : '#ffd76a', x, 0.95, z);
    props.plateMeshes.set(p.id, { group, shelf: { x, z } });
  }
  return props;
}

function buildBeamProps(room, topicId, root, addLabel) {
  const props = { mirrorMeshes: new Map(), orbMeshes: new Map(), beamGroup: new THREE.Group() };
  // 광원.
  const src = cellToWorld(topicId, room.source.cell);
  const emitter = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.8, 10),
    new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd76a, emissiveIntensity: 1.2 })
  );
  emitter.position.set(src.x, 0.4, src.z);
  root.add(emitter);
  addLabel(room.source.labelKo, '#ffd76a', src.x, 1.3, src.z);

  // 거울(얇은 판) — sync에서 방향 갱신: 0 '/' = y +45°, 1 '\' = y -45°.
  for (const m of room.mirrors) {
    const { x, z } = cellToWorld(topicId, m.cell);
    const group = new THREE.Group();
    const pane = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.95, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.15, metalness: 0.4, emissive: 0x3a6a88, emissiveIntensity: 0.4 })
    );
    pane.position.y = 0.65;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 0.3, 10),
      new THREE.MeshStandardMaterial({ color: 0x4a4066, roughness: 0.8 })
    );
    base.position.y = 0.15;
    group.add(base, pane);
    group.position.set(x, 0, z);
    root.add(group);
    props.mirrorMeshes.set(m.id, { group, pane });
  }

  // 얼굴 구슬(진짜/가짜).
  for (const o of room.orbs) {
    const { x, z } = cellToWorld(topicId, o.cell);
    const group = new THREE.Group();
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 16, 12),
      new THREE.MeshStandardMaterial({
        color: o.real ? 0xbfffe0 : 0xcdc4e0,
        emissive: o.real ? 0x2fae74 : 0x6a5d8a,
        emissiveIntensity: 0.35,
        roughness: 0.4
      })
    );
    orb.position.y = 0.8;
    group.add(orb);
    const glyph = makeGlyphSprite(o.emoji, 0.62);
    glyph.position.y = 1.35;
    group.add(glyph);
    group.position.set(x, 0, z);
    root.add(group);
    props.orbMeshes.set(o.id, { group, orb });
  }

  props.beamGroup.position.y = 0.55;
  root.add(props.beamGroup);
  props.beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.85 });
  return props;
}

export function buildDungeonRoom(topicId, opts = {}) {
  const room = DUNGEON_ROOMS[topicId];
  const shell = buildShell(room, topicId, opts.makeLabel);
  const { root, addLabel, cell } = shell;

  let props = {};
  if (room.mechanic === 'push') {
    props = buildPushProps(room, topicId, root, addLabel, cell);
  } else if (room.mechanic === 'carry') {
    props = buildCarryProps(room, topicId, root, addLabel);
  } else if (room.mechanic === 'beam') {
    props = buildBeamProps(room, topicId, root, addLabel);
  }

  return {
    root,
    pedestal: shell.pedestal,
    pedGlow: shell.pedGlow,
    door: shell.door,
    ...props,
    crateMeshes: props.crateMeshes ?? new Map(),
    bounds: roomBounds(topicId)
  };
}

// 상태 → 비주얼 동기화(모든 mechanic 공용 진입점).
// extras.beam: computeBeamPath 결과({cells, hit}) — beam 방에서만 사용.
export function syncDungeonVisuals(topicId, built, state, extras = {}) {
  const room = DUNGEON_ROOMS[topicId];
  if (!room || !built || !state) {
    return;
  }
  if (room.mechanic === 'push') {
    for (const crate of room.crates) {
      const mesh = built.crateMeshes.get(crate.id);
      if (mesh) {
        const world = cellToWorld(topicId, state.crates[crate.id]);
        mesh.group.position.set(world.x, 0, world.z);
      }
    }
    return;
  }
  if (room.mechanic === 'carry') {
    (room.beds ?? []).forEach((b, i) => {
      const mesh = built.bedMeshes?.get(i);
      if (!mesh) {
        return;
      }
      const colorIdx = state.beds[i];
      mesh.flower.visible = colorIdx !== null;
      if (colorIdx !== null) {
        mesh.bloomMat.color.setHex(SEED_COLOR[colorIdx]);
        mesh.bloomMat.emissive.setHex(SEED_COLOR[colorIdx]);
      }
    });
    for (const p of room.plates ?? []) {
      const mesh = built.plateMeshes?.get(p.id);
      if (!mesh) {
        continue;
      }
      const placedExhibit = Object.entries(state.exhibits ?? {}).find(([, plateId]) => plateId === p.id)?.[0];
      if (state.held === p.id) {
        mesh.group.visible = false; // 손에 든 이름표(HUD의 A 라벨로 표시)
      } else if (placedExhibit) {
        const ex = room.exhibits.find((e) => e.id === placedExhibit);
        const { x, z } = cellToWorld(topicId, ex.cell);
        mesh.group.visible = true;
        mesh.group.position.set(x, 0.85, z + 0.42); // 전시대 앞면에 걸린 모습
      } else {
        mesh.group.visible = true;
        mesh.group.position.set(mesh.shelf.x, 0, mesh.shelf.z);
      }
    }
    return;
  }
  if (room.mechanic === 'beam') {
    for (const m of room.mirrors) {
      const mesh = built.mirrorMeshes?.get(m.id);
      if (mesh) {
        // 0 '/' → +45°, 1 '\' → -45°.
        mesh.group.rotation.y = state.mirrors[m.id] === 0 ? Math.PI / 4 : -Math.PI / 4;
      }
    }
    const beam = extras.beam;
    if (beam && built.beamGroup) {
      built.beamGroup.clear(); // 공유 지오메트리라 dispose 불필요
      for (let i = 0; i + 1 < beam.cells.length; i += 1) {
        const a = cellToWorld(topicId, beam.cells[i]);
        const b = cellToWorld(topicId, beam.cells[i + 1]);
        const horizontal = Math.abs(b.x - a.x) > Math.abs(b.z - a.z);
        const seg = new THREE.Mesh(horizontal ? BEAM_GEO_H : BEAM_GEO_V, built.beamMat);
        seg.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
        built.beamGroup.add(seg);
      }
    }
  }
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
