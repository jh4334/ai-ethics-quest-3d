// 확장 섬(스테이지) 지형 — 표현 계층. 1호: 속삭임 곶 (악플·혐오표현 + 디지털 발자국).
// 저사양 원칙: 그림자 캐스터 0, 라이트 2개, 지오메트리 전부 코드 생성, 배치 좌표 전부 상수(결정성).
import * as THREE from 'three';
import { CORRIDOR } from './corridorLogic.js';
import { RUMOR } from './rumorLogic.js';
import { DUNES } from './dunesLogic.js';
import { HEART } from './heartLogic.js';
import { RESIDUE } from './residueLogic.js';

export const ISLE_RADIUS = 12.6;

// 땅에 박힌 '말-화살' — 누군가 내뱉은 뾰족한 말이 아직 남아 있다는 주제 오브젝트.
const WORD_ARROWS = [
  [-4.2, 2.6, 0.5], [3.6, 4.1, -0.4], [-1.8, -2.2, 0.2], [5.4, -1.6, -0.6],
  [-6.6, -3.8, 0.3], [1.2, 6.8, -0.2], [-3.1, 7.4, 0.6], [6.2, 3.2, 0.1]
];

function buildSpirit() {
  // 상처 입은 바닷새 정령 — 바위 둥지에 웅크린 모습. 치료(M3 후속) 전까지 잿빛이 돈다.
  const spirit = new THREE.Group();
  const nest = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.95, flatShading: true })
  );
  nest.scale.set(1.25, 0.55, 1.1);
  nest.position.y = 0.4;
  spirit.add(nest);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xd8dde4,
    emissive: 0x2a2f38,
    emissiveIntensity: 0.35,
    roughness: 0.7
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 12), bodyMat);
  body.scale.set(1, 0.82, 1.15);
  body.position.y = 1.35;
  spirit.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), bodyMat);
  head.position.set(0, 1.95, 0.55);
  spirit.add(head);
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.42, 8),
    new THREE.MeshStandardMaterial({ color: 0xe0a44a, roughness: 0.6 })
  );
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.9, 1.0);
  spirit.add(beak);
  // 축 처진 날개 두 장(치유되면 펴진다).
  const wings = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 1.1), bodyMat);
    wing.position.set(side * 0.78, 1.15, 0);
    wing.rotation.z = side * 0.5;
    wing.userData.side = side;
    spirit.add(wing);
    wings.push(wing);
  }
  // 깃털에 박힌 잡음 파편(주위를 도는 위스프) — updateIsle이 elapsed로 돌린다.
  const wisps = [];
  const wispMat = new THREE.MeshBasicMaterial({ color: 0x4a4458, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 3; i += 1) {
    const wisp = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), wispMat);
    spirit.add(wisp);
    wisps.push(wisp);
  }
  return { spirit, wisps, wings, bodyMat };
}

// 치유 연출: 위스프가 걷히고 깃털이 밝아지며 날개가 펴진다. 빌드(재상륙)와 런타임 둘 다 쓴다.
export function healSpiritVisuals(built) {
  built.wisps.forEach((wisp) => {
    wisp.visible = false;
  });
  built.wings.forEach((wing) => {
    wing.rotation.z = wing.userData.side * 0.14;
    wing.position.y = 1.4;
  });
  built.bodyMat.color.setHex(0xffffff);
  built.bodyMat.emissive.setHex(0x6a5c33);
  built.bodyMat.emissiveIntensity = 0.4;
  built.vortexes.forEach((vortex) => {
    vortex.visible = false;
  });
}

// 회랑 발사대(잡음 소용돌이) + 날아다니는 말-화살 메시.
function buildCorridorProps(root) {
  const vortexes = new Map();
  for (const emitter of CORRIDOR.emitters) {
    const vortex = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x7a5f96, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 2; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46 + i * 0.24, 0.05, 8, 24), ringMat);
      ring.rotation.set(i * 1.1, i * 0.7, 0);
      vortex.add(ring);
    }
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 0),
      new THREE.MeshBasicMaterial({ color: 0x2a2136 })
    );
    vortex.add(core);
    vortex.position.set(emitter.x, 3.0, emitter.z);
    root.add(vortex);
    vortexes.set(emitter.id, vortex);
  }
  const arrowMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 1.0, 5),
    new THREE.MeshBasicMaterial({ color: 0xc25a68 })
  );
  arrowMesh.visible = false;
  root.add(arrowMesh);
  return { vortexes, arrowMesh };
}

// 속삭임 곶 씬 전체. interactables는 씬 로컬(정령·회랑·뗏목) — main이 근접 안내에 쓴다.
// healed: 정령을 이미 치료한 세이브로 재상륙한 경우.
export function buildWhisperCapeScene({ makeLabel, healed = false }) {
  const root = new THREE.Group();

  // 새벽 갯벌 톤: 차분한 반구광 + 약한 아침 해. 그림자 없음.
  root.add(new THREE.HemisphereLight(0xcfd8ea, 0x55604f, 1.5));
  const dawn = new THREE.DirectionalLight(0xffe9c8, 0.9);
  dawn.position.set(14, 18, 8);
  root.add(dawn);

  // 곶 본체: 집 섬보다 작고 물빠진 톤.
  const land = new THREE.Mesh(
    new THREE.CylinderGeometry(13.4, 11.8, 0.9, 64),
    new THREE.MeshStandardMaterial({ color: 0x7fa87c, roughness: 0.95 })
  );
  land.position.y = -0.18;
  root.add(land);
  // 남쪽 갯벌(지워지지 않는 발자국의 무대 — 후속 던전 자리).
  const mudflat = new THREE.Mesh(
    new THREE.CylinderGeometry(6.4, 6.9, 0.94, 40),
    new THREE.MeshStandardMaterial({ color: 0xb3a284, roughness: 1 })
  );
  mudflat.position.set(1.5, -0.17, 8.2);
  root.add(mudflat);
  // 주변 바다.
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(60, 48),
    new THREE.MeshStandardMaterial({ color: 0x4f7fa6, emissive: 0x18303f, emissiveIntensity: 0.35, roughness: 0.8 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.32;
  root.add(water);

  // 북쪽 절벽 — 속삭임이 메아리치는 바위 스파이어.
  // 톤 교정(노출<1)에 짓눌리지 않게 바위도 약한 자체 발광을 준다.
  const cliffMat = new THREE.MeshStandardMaterial({
    color: 0x6b7382,
    emissive: 0x2a3040,
    emissiveIntensity: 0.55,
    roughness: 0.95,
    flatShading: true
  });
  for (const [cx, cz, s] of [[-3.4, -8.6, 1.4], [0.2, -9.8, 1.9], [3.8, -8.2, 1.2], [-6.4, -6.6, 1.0]]) {
    const cliff = new THREE.Mesh(new THREE.ConeGeometry(1.5 * s, 4.6 * s, 6), cliffMat);
    cliff.position.set(cx, 1.7 * s, cz);
    root.add(cliff);
  }

  // 말-화살: 땅에 비스듬히 박힌 어두운 파편들.
  const arrowMat = new THREE.MeshStandardMaterial({
    color: 0x3a3346,
    emissive: 0x1c1626,
    emissiveIntensity: 0.5,
    roughness: 0.7,
    flatShading: true
  });
  for (const [ax, az, tilt] of WORD_ARROWS) {
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.3, 5), arrowMat);
    arrow.position.set(ax, 0.5, az);
    arrow.rotation.set(Math.PI + tilt, 0, tilt * 0.8); // 하늘에서 꽂힌 모양
    root.add(arrow);
  }

  // 병든 바닷새 정령 — 북쪽 절벽 앞 둥지.
  const { spirit, wisps, wings, bodyMat } = buildSpirit();
  spirit.position.set(0.4, 0, -5.6);
  root.add(spirit);
  const spiritLabel = makeLabel('🕊️ 바닷새 정령', '#cfd8ea');
  spiritLabel.position.set(0.4, 3.4, -5.6);
  root.add(spiritLabel);

  // 말-화살 회랑: 절벽의 발사대(잡음 소용돌이)와 화살.
  const { vortexes, arrowMesh } = buildCorridorProps(root);

  // 남쪽 물가의 뗏목 — 바다로 돌아가는 문.
  const raft = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.14, 2.0),
    new THREE.MeshStandardMaterial({ color: 0x8a6a3f, roughness: 0.9 })
  );
  raft.position.set(-3.4, 0.02, 11.2);
  root.add(raft);
  const raftLabel = makeLabel('🛶 뗏목', '#ffd88a');
  raftLabel.position.set(-3.4, 1.6, 11.2);
  root.add(raftLabel);

  const interactables = [
    { id: 'spirit', x: 0.4, z: -4.2, labelKo: '바닷새 정령에게 다가간다' },
    { id: 'corridor', x: 3.2, z: -5.4, labelKo: healed ? '말-화살 회랑 — 고요하다' : '말-화살 회랑 — 잡음을 잠재운다' },
    { id: 'raft', x: -3.4, z: 10.6, labelKo: '뗏목 — 바다로 돌아간다' }
  ];

  const built = { root, spirit, wisps, wings, bodyMat, vortexes, arrowMesh, interactables };
  if (healed) {
    healSpiritVisuals(built);
  }
  return built;
}

// 2호: 메아리 동굴 (가짜뉴스·출처 + 필터버블 — "내게 들어오는 것").
// 어스름 동굴 톤 — 어두운 씬은 발광 재질로 보정(던전 원칙). 그림자 0, 라이트 2개.
export function buildEchoCaveScene({ makeLabel, healed = false }) {
  const root = new THREE.Group();

  root.add(new THREE.HemisphereLight(0x9fb4e8, 0x2c3040, 1.45));
  const caveGlow = new THREE.DirectionalLight(0x9fd8ff, 0.7);
  caveGlow.position.set(-10, 16, 6);
  root.add(caveGlow);

  // 회청빛 바위 섬.
  const land = new THREE.Mesh(
    new THREE.CylinderGeometry(13.0, 11.6, 0.9, 64),
    new THREE.MeshStandardMaterial({ color: 0x5f6a80, emissive: 0x232837, emissiveIntensity: 0.5, roughness: 0.95 })
  );
  land.position.y = -0.18;
  root.add(land);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(60, 48),
    new THREE.MeshStandardMaterial({ color: 0x27405e, emissive: 0x101f30, emissiveIntensity: 0.45, roughness: 0.85 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.32;
  root.add(water);

  // 북쪽 동굴 아치 + 뒤편 언덕 — 메아리가 태어나는 입.
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x6b7488,
    emissive: 0x2a3040,
    emissiveIntensity: 0.55,
    roughness: 0.95,
    flatShading: true
  });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(4.6, 1.0, 8, 20, Math.PI), rockMat);
  arch.position.set(0.6, 0.3, -9.2);
  root.add(arch);
  const hill = new THREE.Mesh(new THREE.ConeGeometry(5.4, 5.8, 7), rockMat);
  hill.position.set(0.6, 2.0, -11.4);
  root.add(hill);

  // 정령이 갇힌 물웅덩이.
  const lagoon = new THREE.Mesh(
    new THREE.CircleGeometry(3.6, 32),
    new THREE.MeshStandardMaterial({ color: 0x2f6f8f, emissive: 0x1a4a63, emissiveIntensity: 0.7, roughness: 0.6 })
  );
  lagoon.rotation.x = -Math.PI / 2;
  lagoon.position.set(0.6, 0.32, -4.2);
  root.add(lagoon);

  // 메아리 결정 — 동굴의 은은한 광원 노릇.
  const crystals = [];
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x7fd4e8,
    emissive: 0x3fb8d8,
    emissiveIntensity: 0.8,
    roughness: 0.3
  });
  for (const [cx, cz, s] of [[-5.8, -5.2, 1.0], [6.4, -6.8, 1.3], [-7.6, 1.8, 0.8], [4.2, 5.8, 0.9]]) {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.6 * s, 0), crystalMat);
    crystal.position.set(cx, 0.7 * s, cz);
    root.add(crystal);
    crystals.push(crystal);
  }

  // 소문의 벽 — 같은 말만 되풀이하는 웅얼돌 무리. 좌표는 rumorLogic(RUMOR.stones)이 단일 출처.
  // 판별 연출을 돌마다 따로 주기 위해 재질은 돌별 사본.
  const rumorStones = new Map();
  const stoneBubbles = new Map();
  RUMOR.stones.forEach((stoneData, i) => {
    const murmurMat = new THREE.MeshStandardMaterial({
      color: 0x4a4258,
      emissive: 0x2c2440,
      emissiveIntensity: 0.6,
      roughness: 0.9,
      flatShading: true
    });
    const stone = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.7 + (i % 3) * 0.4, 0.7), murmurMat);
    stone.position.set(stoneData.x, 0.85, stoneData.z);
    stone.rotation.y = -0.5 + i * 0.28;
    root.add(stone);
    rumorStones.set(stoneData.id, stone);
    // 되풀이되는 소문 말풍선.
    const bubble = makeLabel('💬 …', '#d8c8f0');
    bubble.scale.multiplyScalar(0.55);
    bubble.position.set(stoneData.x, 2.7 + (i % 3) * 0.3, stoneData.z);
    bubble.userData.baseY = bubble.position.y;
    root.add(bubble);
    stoneBubbles.set(stoneData.id, bubble);
  });
  const wallLabel = makeLabel('🗿 소문의 벽', '#b8a8d8');
  wallLabel.position.set(5.6, 4.1, -1.4);
  root.add(wallLabel);

  // 출처의 종 울림 링 — 도전 중 F로 울리면 플레이어에서 퍼져 나간다.
  const bellRing = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.07, 6, 36),
    new THREE.MeshBasicMaterial({ color: 0xffd88a, transparent: true, opacity: 0.7 })
  );
  bellRing.rotation.x = -Math.PI / 2;
  bellRing.visible = false;
  root.add(bellRing);

  // 갇힌 고래 정령 — 웅덩이에 떠서 잿빛 메아리 링에 둘러싸여 있다.
  const spirit = new THREE.Group();
  // 병든 잿빛이 기본 — 치유 시 heal()이 맑은 색으로 바꾼다.
  const whaleMat = new THREE.MeshStandardMaterial({
    color: 0x93a0b4,
    emissive: 0x2a3240,
    emissiveIntensity: 0.35,
    roughness: 0.6
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.0, 14, 12), whaleMat);
  body.scale.set(1.0, 0.72, 1.6);
  body.position.y = 0.55;
  spirit.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4), whaleMat);
  tail.rotation.x = -Math.PI / 2.4;
  tail.position.set(0, 0.75, 1.7);
  spirit.add(tail);
  const spout = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xbfe8f4 })
  );
  spout.position.set(0, 1.35, -0.6);
  spirit.add(spout);
  // 잿빛 메아리 링 — 같은 소리가 자꾸 되돌아오는 감옥. 치유되면 사라진다.
  const rings = [];
  for (let i = 0; i < 3; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.06, 6, 32),
      new THREE.MeshBasicMaterial({ color: 0x6a7288, transparent: true, opacity: 0.5 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.5;
    spirit.add(ring);
    rings.push(ring);
  }
  spirit.position.set(0.6, 0, -4.2);
  root.add(spirit);
  const spiritLabel = makeLabel('🐋 고래 정령', '#bfe8f4');
  spiritLabel.position.set(0.6, 3.2, -4.2);
  root.add(spiritLabel);

  // 남쪽 물가의 뗏목.
  const raft = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.14, 2.0),
    new THREE.MeshStandardMaterial({ color: 0x8a6a3f, roughness: 0.9 })
  );
  raft.position.set(-3.4, 0.02, 11.0);
  root.add(raft);
  const raftLabel = makeLabel('🛶 뗏목', '#ffd88a');
  raftLabel.position.set(-3.4, 1.6, 11.0);
  root.add(raftLabel);

  const interactables = [
    { id: 'spirit', x: 0.6, z: -0.9, labelKo: '고래 정령에게 다가간다' },
    { id: 'rumor-wall', x: 5.0, z: -2.0, labelKo: '소문의 벽을 살펴본다' },
    { id: 'raft', x: -3.4, z: 10.4, labelKo: '뗏목 — 바다로 돌아간다' }
  ];

  // 씬 전용 유휴 애니메이션(결정적) — updateIsle이 매 프레임 부른다.
  const animate = (delta, elapsed) => {
    spirit.position.y = Math.sin(elapsed * 1.1) * 0.08;
    rings.forEach((ring, i) => {
      if (!ring.visible) {
        return;
      }
      const t = (elapsed * 0.35 + i / 3) % 1;
      const scale = 1 + t * 2.1;
      ring.scale.set(scale, scale, 1);
      ring.material.opacity = 0.5 * (1 - t);
    });
    crystals.forEach((crystal, i) => {
      crystal.rotation.y += delta * (0.6 + i * 0.2);
    });
    // 소문 말풍선이 웅얼웅얼 떠다닌다(치유되면 사라진다).
    let bubbleIdx = 0;
    stoneBubbles.forEach((bubble) => {
      if (bubble.visible) {
        bubble.position.y = bubble.userData.baseY + Math.sin(elapsed * 2 + bubbleIdx * 1.7) * 0.12;
      }
      bubbleIdx += 1;
    });
  };

  // 치유 연출(소문의 벽 클리어 시 호출): 메아리 링·말풍선이 걷히고 벽이 고요해진다.
  const heal = () => {
    rings.forEach((ring) => {
      ring.visible = false;
    });
    whaleMat.color.setHex(0x9fd8ec);
    whaleMat.emissive.setHex(0x3a6a80);
    whaleMat.emissiveIntensity = 0.55;
    stoneBubbles.forEach((bubble) => {
      bubble.visible = false;
    });
    rumorStones.forEach((stone) => {
      stone.rotation.z = 0;
      stone.material.color.setHex(0x5f6a80);
      stone.material.emissive.setHex(0x232837);
    });
    bellRing.visible = false;
  };

  const built = { root, spirit, interactables, animate, heal, rumorStones, stoneBubbles, bellRing };
  if (healed) {
    heal();
  }
  return built;
}

// 3호: 모래시계 항구 (스크린타임·디지털 웰빙 + AI 생성물 표시 — "AI와 나의 습관").
// 노을 진 항구 — 등대가 쉬지 않고 깜박여 거북 정령이 잠들지 못한다.
export function buildHourglassPortScene({ makeLabel, healed = false }) {
  const root = new THREE.Group();

  root.add(new THREE.HemisphereLight(0xe8c8b0, 0x3a3448, 1.4));
  const sunset = new THREE.DirectionalLight(0xff9a5c, 0.85);
  sunset.position.set(-14, 12, 10);
  root.add(sunset);

  // 모래빛 항구 섬.
  const land = new THREE.Mesh(
    new THREE.CylinderGeometry(13.2, 11.8, 0.9, 64),
    new THREE.MeshStandardMaterial({ color: 0xd4b98a, emissive: 0x3a3020, emissiveIntensity: 0.35, roughness: 0.95 })
  );
  land.position.y = -0.18;
  root.add(land);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(60, 48),
    new THREE.MeshStandardMaterial({ color: 0x3a4a72, emissive: 0x1a2238, emissiveIntensity: 0.4, roughness: 0.85 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.32;
  root.add(water);

  // 부두 + 표시 없는 화물 상자들(생성물 표시 주제 — 후속 도전 자리).
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x9a7648, emissive: 0x2a2012, emissiveIntensity: 0.35, roughness: 0.9 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 6.0), plankMat);
  pier.position.set(5.2, 0.45, 8.0);
  pier.rotation.y = -0.3;
  root.add(pier);
  const crateMat = new THREE.MeshStandardMaterial({ color: 0xb08a52, emissive: 0x2c2012, emissiveIntensity: 0.35, roughness: 0.85, flatShading: true });
  for (const [cx, cz, s, rot] of [[4.6, 6.6, 1.0, 0.2], [5.6, 5.4, 0.8, -0.4], [4.2, 5.0, 0.7, 0.7]]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.0 * s, 1.0 * s, 1.0 * s), crateMat);
    crate.position.set(cx, 0.5 * s, cz);
    crate.rotation.y = rot;
    root.add(crate);
  }
  const cargoLabel = makeLabel('📦 표시 없는 화물', '#e8c89a');
  cargoLabel.position.set(4.8, 2.4, 5.6);
  root.add(cargoLabel);

  // 뒤집힌 채 멈춘 모래시계 사구 — '멈출 때'를 잃어버린 항구의 상징.
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9fc8d8,
    emissive: 0x3a5866,
    emissiveIntensity: 0.5,
    roughness: 0.35,
    flatShading: true
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x7a5a34, emissive: 0x241a0c, emissiveIntensity: 0.4, roughness: 0.8 });
  // 좌표·주기는 dunesLogic(DUNES.glasses)이 단일 출처 — 도전 중 updateIsle이 기울기를 구동한다.
  const hourglasses = new Map();
  const sandCores = new Map();
  DUNES.glasses.forEach((glassData) => {
    const s = glassData.scale;
    const hourglass = new THREE.Group();
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 1.3 * s, 8), glassMat);
    top.rotation.x = Math.PI;
    top.position.y = 2.0 * s;
    const bottom = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 1.3 * s, 8), glassMat);
    bottom.position.y = 0.7 * s;
    hourglass.add(top, bottom);
    for (const ringY of [0.05, 1.35, 2.65]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.95 * s, 0.09 * s, 8, 18), frameMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = ringY * s;
      hourglass.add(band);
    }
    // 다시 흐르는 모래 — 잠금 성공 시에만 보인다.
    const sand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07 * s, 0.07 * s, 1.1 * s, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd88a })
    );
    sand.position.y = 1.35 * s;
    sand.visible = false;
    hourglass.add(sand);
    hourglass.position.set(glassData.x, 0, glassData.z);
    root.add(hourglass);
    hourglasses.set(glassData.id, hourglass);
    sandCores.set(glassData.id, sand);
  });
  const dunesLabel = makeLabel('⏳ 모래시계 사구', '#e8d8a8');
  dunesLabel.position.set(-6.6, 4.4, -0.2);
  root.add(dunesLabel);

  // 등대 — 밤새 쉬지 않고 깜박이는 불빛(치유되면 느리게 숨 쉰다).
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 1.0, 4.2, 10),
    new THREE.MeshStandardMaterial({ color: 0xe8dccc, emissive: 0x3c362c, emissiveIntensity: 0.4, roughness: 0.8 })
  );
  tower.position.set(2.0, 2.1, -6.5);
  root.add(tower);
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.95, 0.9, 10),
    new THREE.MeshStandardMaterial({ color: 0xb85a4a, emissive: 0x3a1812, emissiveIntensity: 0.4, roughness: 0.8 })
  );
  cap.position.set(2.0, 4.7, -6.5);
  root.add(cap);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 10), lampMat);
  lamp.position.set(2.0, 4.15, -6.5);
  root.add(lamp);

  // 잠들지 못하는 등대거북 정령 — 등대 아래에서 뒤척인다.
  const spirit = new THREE.Group();
  const turtleMat = new THREE.MeshStandardMaterial({
    color: 0x8a927e,
    emissive: 0x262b22,
    emissiveIntensity: 0.4,
    roughness: 0.85,
    flatShading: true
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 8), turtleMat);
  shell.scale.set(1.15, 0.6, 1.3);
  shell.position.y = 0.62;
  spirit.add(shell);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), turtleMat);
  head.position.set(0, 0.55, 1.45);
  spirit.add(head);
  for (const [fx, fz] of [[-1.0, 0.7], [1.0, 0.7], [-1.0, -0.8], [1.0, -0.8]]) {
    const flipper = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.4), turtleMat);
    flipper.position.set(fx, 0.2, fz);
    spirit.add(flipper);
  }
  // 숙면 표시 — 치유되면 나타난다.
  const sleepMark = makeLabel('💤', '#cfe0ff');
  sleepMark.scale.multiplyScalar(0.5);
  sleepMark.position.set(0.9, 2.0, 0.6);
  sleepMark.visible = false;
  spirit.add(sleepMark);
  spirit.position.set(0.5, 0, -4.4);
  root.add(spirit);
  const spiritLabel = makeLabel('🐢 등대거북 정령', '#ffd8a8');
  spiritLabel.position.set(0.5, 3.0, -4.4);
  root.add(spiritLabel);

  // 남쪽 물가의 뗏목.
  const raft = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 2.0), plankMat);
  raft.position.set(-3.4, 0.02, 11.0);
  root.add(raft);
  const raftLabel = makeLabel('🛶 뗏목', '#ffd88a');
  raftLabel.position.set(-3.4, 1.6, 11.0);
  root.add(raftLabel);

  const interactables = [
    { id: 'spirit', x: 0.5, z: -2.8, labelKo: '등대거북 정령에게 다가간다' },
    { id: 'dunes', x: -6.6, z: 0.2, labelKo: '모래시계 사구 — 멈춘 시간을 되돌린다' },
    { id: 'cargo', x: 4.8, z: 5.4, labelKo: '표시 없는 화물을 살펴본다' },
    { id: 'raft', x: -3.4, z: 10.4, labelKo: '뗏목 — 바다로 돌아간다' }
  ];

  let calm = false; // 치유 여부 — 등불·거북 애니메이션 분기
  const animate = (delta, elapsed) => {
    if (calm) {
      // 느리게 숨 쉬는 등불 + 곤히 잠든 거북.
      lampMat.color.setHex(0xffe9a0);
      lamp.scale.setScalar(1 + Math.sin(elapsed * 0.8) * 0.08);
      spirit.rotation.z = 0;
      return;
    }
    // 쉬지 않는 깜박임(결정적 다중 사인) — 거북이 그 리듬에 뒤척인다.
    const blink = Math.sin(elapsed * 7) + Math.sin(elapsed * 11.3);
    lampMat.color.setHex(blink > 0 ? 0xfff3c0 : 0x6a5a30);
    lamp.scale.setScalar(blink > 0 ? 1.25 : 0.85);
    spirit.rotation.z = Math.sin(elapsed * 5.2) * 0.03;
    // 도전 전에는 기울어진 채 멈춰 있다(도전 중엔 updateIsle이 기울기를 구동).
  };

  const heal = () => {
    calm = true;
    turtleMat.color.setHex(0x9ab86a);
    turtleMat.emissive.setHex(0x2c3a1c);
    turtleMat.emissiveIntensity = 0.5;
    sleepMark.visible = true;
    // 모래시계들이 바로 서고 모래가 다시 흐른다.
    hourglasses.forEach((hourglass) => {
      hourglass.rotation.z = 0;
    });
    sandCores.forEach((sand) => {
      sand.visible = true;
    });
  };

  // 병든 상태의 초기 기울기(정지) — 도전 시작 전 모습.
  hourglasses.forEach((hourglass, id) => {
    const index = DUNES.glasses.findIndex((glass) => glass.id === id);
    hourglass.rotation.z = Math.sin(index * 1.3) * DUNES.amplitude || 0.5;
  });

  const built = { root, spirit, interactables, animate, heal, hourglasses, sandCores };
  if (healed) {
    heal();
  }
  return built;
}

// 4호: 기억의 심장 외곽 (종합 + 인간-AI 협업 — "함께 살아가기").
// 보랏빛 결정 섬 — 맥동하는 심장 결정을 네 개의 동사 봉인이 지키고 있다.
export function buildMemoryOuterScene({ makeLabel, healed = false }) {
  const root = new THREE.Group();

  root.add(new THREE.HemisphereLight(0x9a8ac8, 0x241c38, 1.45));
  const glow = new THREE.DirectionalLight(0xc89ae8, 0.75);
  glow.position.set(8, 18, 10);
  root.add(glow);

  // 어두운 결정 대지.
  const land = new THREE.Mesh(
    new THREE.CylinderGeometry(13.2, 11.8, 0.9, 64),
    new THREE.MeshStandardMaterial({ color: 0x4a4468, emissive: 0x1e1a30, emissiveIntensity: 0.5, roughness: 0.95 })
  );
  land.position.y = -0.18;
  root.add(land);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(60, 48),
    new THREE.MeshStandardMaterial({ color: 0x2a2a52, emissive: 0x121228, emissiveIntensity: 0.45, roughness: 0.85 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.32;
  root.add(water);

  // 기억의 심장 — 섬 전체가 이 박동에 맞춰 산다.
  const heartMat = new THREE.MeshStandardMaterial({
    color: 0xa84a6c,
    emissive: 0x7c2846,
    emissiveIntensity: 0.7,
    roughness: 0.35,
    flatShading: true
  });
  const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 0), heartMat);
  heart.position.set(0.4, 3.0, -5.2);
  root.add(heart);
  // 심장을 도는 결정 조각 고리.
  const shards = [];
  const shardMat = new THREE.MeshBasicMaterial({ color: 0xd88ab0, transparent: true, opacity: 0.8 });
  for (let i = 0; i < 5; i += 1) {
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), shardMat);
    root.add(shard);
    shards.push(shard);
  }
  const heartLabel = makeLabel('💠 기억의 심장', '#e8b8d8');
  heartLabel.position.set(0.4, 6.0, -5.2);
  root.add(heartLabel);

  // 심부 관문 — 심장 뒤편, 봉인이 풀리면 빛이 들어온다.
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x6a5a8c, emissive: 0x2a2240, emissiveIntensity: 0.55, roughness: 0.9, flatShading: true });
  for (const px of [-1.6, 2.4]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 3.6, 6), pillarMat);
    pillar.position.set(0.4 + px, 1.6, -9.6);
    root.add(pillar);
  }
  const portalMat = new THREE.MeshBasicMaterial({ color: 0x140f22 });
  const portal = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), portalMat);
  portal.position.set(0.4, 1.7, -9.7);
  root.add(portal);

  // 동사 봉인석 — 좌표·주기는 heartLogic(HEART.seals)이 단일 출처.
  const sealOrbs = new Map();
  HEART.seals.forEach((sealData) => {
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.8, 8), pillarMat);
    pedestal.position.set(sealData.x, 0.4, sealData.z);
    root.add(pedestal);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x8a7ab8,
      emissive: 0x6a5a9c,
      emissiveIntensity: 0.4,
      roughness: 0.3
    });
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), orbMat);
    orb.position.set(sealData.x, 1.35, sealData.z);
    root.add(orb);
    sealOrbs.set(sealData.id, orb);
    const sealLabel = makeLabel(`${sealData.emoji} 봉인`, '#c8b8e8');
    sealLabel.scale.multiplyScalar(0.7);
    sealLabel.position.set(sealData.x, 2.5, sealData.z);
    root.add(sealLabel);
  });

  // 남쪽 물가의 뗏목.
  const raft = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.14, 2.0),
    new THREE.MeshStandardMaterial({ color: 0x8a6a3f, emissive: 0x241a0c, emissiveIntensity: 0.4, roughness: 0.9 })
  );
  raft.position.set(-3.4, 0.02, 11.0);
  root.add(raft);
  const raftLabel = makeLabel('🛶 뗏목', '#ffd88a');
  raftLabel.position.set(-3.4, 1.6, 11.0);
  root.add(raftLabel);

  const interactables = [
    { id: 'spirit', x: 0.4, z: -3.0, labelKo: '기억의 심장에 다가간다' },
    { id: 'portal', x: 0.4, z: -8.0, labelKo: '심부 관문' },
    { id: 'raft', x: -3.4, z: 10.4, labelKo: '뗏목 — 바다로 돌아간다' }
  ];

  let open = false; // 봉인 해제 여부 — 관문·심장 연출 분기
  const animate = (delta, elapsed) => {
    // 심장 박동: 쿵, 쿵 — 두 박자 맥동.
    const beat = Math.max(Math.sin(elapsed * 2.4), Math.sin(elapsed * 2.4 + 0.6) * 0.6);
    heart.scale.setScalar(1 + Math.max(0, beat) * 0.12);
    heart.rotation.y += delta * 0.5;
    heartMat.emissiveIntensity = (open ? 1.0 : 0.7) + Math.max(0, beat) * 0.35;
    shards.forEach((shard, i) => {
      const angle = elapsed * 0.7 + (i / shards.length) * Math.PI * 2;
      shard.position.set(0.4 + Math.cos(angle) * 3.1, 3.0 + Math.sin(elapsed * 1.3 + i) * 0.4, -5.2 + Math.sin(angle) * 3.1);
    });
    if (open) {
      portalMat.color.setHex(0x9fd8ff);
    }
  };

  // 봉인이 모두 풀리면 심부 관문이 빛난다.
  const heal = () => {
    open = true;
    sealOrbs.forEach((orb) => {
      orb.material.color.setHex(0xffd88a);
      orb.material.emissive.setHex(0xc89a40);
      orb.material.emissiveIntensity = 1.0;
    });
    portalMat.color.setHex(0x9fd8ff);
  };

  const built = { root, spirit: heart, interactables, animate, heal, sealOrbs, portalMat };
  if (healed) {
    heal();
  }
  return built;
}

// 5호: 기억의 심장 심부 (최종 재대결) — 심연 위의 아레나, 노이즈의 잔영이 기다린다.
export function buildMemoryCoreScene({ makeLabel, healed = false }) {
  const root = new THREE.Group();

  root.add(new THREE.HemisphereLight(0x8a7ab8, 0x16101f, 1.5));
  const abyssGlow = new THREE.DirectionalLight(0xb88ae8, 0.7);
  abyssGlow.position.set(-8, 16, 8);
  root.add(abyssGlow);

  // 심연 위에 뜬 아레나 원반.
  const arena = new THREE.Mesh(
    new THREE.CylinderGeometry(11.6, 10.2, 1.0, 48),
    new THREE.MeshStandardMaterial({ color: 0x3a3454, emissive: 0x1a1630, emissiveIntensity: 0.55, roughness: 0.9 })
  );
  arena.position.y = -0.2;
  root.add(arena);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(11.0, 0.14, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0x8a6cc8, transparent: true, opacity: 0.6 })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.34;
  root.add(rim);

  // 노이즈의 잔영 — 검은 결정 덩어리. 4껍질(동사 색 고리)이 지키고 있다.
  const bossMat = new THREE.MeshStandardMaterial({
    color: 0x2a2438,
    emissive: 0x4a1a2c,
    emissiveIntensity: 0.5,
    roughness: 0.4,
    flatShading: true
  });
  const boss = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), bossMat);
  boss.position.set(RESIDUE.boss.x, 2.3, RESIDUE.boss.z);
  root.add(boss);
  const bossLabel = makeLabel('⚡ 노이즈의 잔영', '#d8a8c8');
  bossLabel.position.set(RESIDUE.boss.x, 5.2, RESIDUE.boss.z);
  root.add(bossLabel);
  // 페이즈 껍질 고리 — 바깥부터 깨져 나간다.
  const shellRings = [];
  RESIDUE.phases.forEach((phase, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.2 + i * 0.5, 0.09, 8, 36),
      new THREE.MeshBasicMaterial({ color: phase.color, transparent: true, opacity: 0.8 })
    );
    ring.position.copy(boss.position);
    root.add(ring);
    shellRings.push(ring);
  });

  // 정령들의 목소리 — 각성 순간에 나타난다(빛 구슬 셋).
  const spiritOrbs = [];
  const spiritDefs = [
    { emoji: '🕊️', color: 0xcfd8ea, x: -6.5, z: 2.5 },
    { emoji: '🐋', color: 0xbfe8f4, x: 0.4, z: 6.5 },
    { emoji: '🐢', color: 0xd8e8a8, x: 7.0, z: 2.2 }
  ];
  for (const def of spiritDefs) {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 12, 12),
      new THREE.MeshBasicMaterial({ color: def.color })
    );
    orb.position.set(def.x, 1.6, def.z);
    orb.visible = false;
    root.add(orb);
    const label = makeLabel(def.emoji, '#ffffff');
    label.scale.multiplyScalar(0.45);
    label.position.set(def.x, 2.7, def.z);
    label.visible = false;
    root.add(label);
    spiritOrbs.push(orb, label);
  }

  // 기억의 별 — 격파 후 잔영이 흩어져 돌아온 기억들.
  const memoryStars = [];
  const starMat = new THREE.MeshBasicMaterial({ color: 0xfff3c0 });
  for (let i = 0; i < 7; i += 1) {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), starMat);
    star.visible = false;
    root.add(star);
    memoryStars.push(star);
  }

  // 남쪽 가장자리의 뗏목.
  const raft = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.14, 2.0),
    new THREE.MeshStandardMaterial({ color: 0x8a6a3f, emissive: 0x241a0c, emissiveIntensity: 0.4, roughness: 0.9 })
  );
  raft.position.set(-3.4, 0.02, 9.4);
  root.add(raft);
  const raftLabel = makeLabel('🛶 뗏목', '#ffd88a');
  raftLabel.position.set(-3.4, 1.6, 9.4);
  root.add(raftLabel);

  const interactables = [{ id: 'raft', x: -3.4, z: 8.8, labelKo: '뗏목 — 바다로 돌아간다' }];

  let peaceful = healed;
  const animate = (delta, elapsed) => {
    if (peaceful) {
      memoryStars.forEach((star, i) => {
        const angle = elapsed * 0.5 + (i / memoryStars.length) * Math.PI * 2;
        star.position.set(RESIDUE.boss.x + Math.cos(angle) * 3.4, 2.2 + Math.sin(elapsed * 1.2 + i) * 0.6, RESIDUE.boss.z + Math.sin(angle) * 3.4);
        star.rotation.y += delta * 2;
      });
      return;
    }
    boss.rotation.y += delta * 0.8;
    boss.rotation.x = Math.sin(elapsed * 1.7) * 0.15;
    shellRings.forEach((ring, i) => {
      if (!ring.visible) {
        return;
      }
      ring.rotation.x = Math.PI / 2 + Math.sin(elapsed * (0.6 + i * 0.2)) * 0.5;
      ring.rotation.y = elapsed * (0.4 + i * 0.15);
    });
  };

  // 격파 연출: 잔영이 사라지고 기억의 별들이 떠오른다.
  const heal = () => {
    peaceful = true;
    boss.visible = false;
    bossLabel.visible = false;
    shellRings.forEach((ring) => {
      ring.visible = false;
    });
    spiritOrbs.forEach((orb) => {
      orb.visible = true;
    });
    memoryStars.forEach((star) => {
      star.visible = true;
    });
  };

  const built = {
    root,
    spirit: boss,
    interactables,
    animate,
    heal,
    boss,
    bossMat,
    shellRings,
    spiritOrbs,
    memoryStars
  };
  if (healed) {
    heal();
  }
  return built;
}

// 스테이지 id → 섬 씬 빌더. 상륙 가능한 섬이 늘 때마다 여기에 등록한다.
export const ISLE_SCENES = {
  'whisper-cape': buildWhisperCapeScene,
  'echo-cave': buildEchoCaveScene,
  'hourglass-port': buildHourglassPortScene,
  'memory-outer': buildMemoryOuterScene,
  'memory-core': buildMemoryCoreScene
};
