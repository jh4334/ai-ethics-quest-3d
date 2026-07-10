// 확장 섬(스테이지) 지형 — 표현 계층. 1호: 속삭임 곶 (악플·혐오표현 + 디지털 발자국).
// 저사양 원칙: 그림자 캐스터 0, 라이트 2개, 지오메트리 전부 코드 생성, 배치 좌표 전부 상수(결정성).
import * as THREE from 'three';
import { CORRIDOR } from './corridorLogic.js';

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

  // 소문의 벽 — 같은 말만 되풀이하는 웅얼돌 무리(후속 도전 자리).
  const murmurMat = new THREE.MeshStandardMaterial({
    color: 0x4a4258,
    emissive: 0x2c2440,
    emissiveIntensity: 0.6,
    roughness: 0.9,
    flatShading: true
  });
  for (let i = 0; i < 5; i += 1) {
    const stone = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.7 + (i % 3) * 0.4, 0.7), murmurMat);
    const angle = -0.5 + i * 0.28;
    stone.position.set(6.2 - Math.cos(angle) * 1.4, 0.85, -3.6 + i * 1.5);
    stone.rotation.y = angle;
    root.add(stone);
  }
  const wallLabel = makeLabel('🗿 소문의 벽', '#b8a8d8');
  wallLabel.position.set(5.6, 3.1, -1.4);
  root.add(wallLabel);

  // 갇힌 고래 정령 — 웅덩이에 떠서 잿빛 메아리 링에 둘러싸여 있다.
  const spirit = new THREE.Group();
  const whaleMat = new THREE.MeshStandardMaterial({
    color: healed ? 0x9fd8ec : 0x93a0b4,
    emissive: healed ? 0x3a6a80 : 0x2a3240,
    emissiveIntensity: healed ? 0.55 : 0.35,
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
    ring.visible = !healed;
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
  };

  // 치유 연출(후속 도전에서 호출): 메아리 링이 걷히고 몸빛이 맑아진다.
  const heal = () => {
    rings.forEach((ring) => {
      ring.visible = false;
    });
    whaleMat.color.setHex(0x9fd8ec);
    whaleMat.emissive.setHex(0x3a6a80);
    whaleMat.emissiveIntensity = 0.55;
  };

  return { root, spirit, interactables, animate, heal };
}

// 스테이지 id → 섬 씬 빌더. 상륙 가능한 섬이 늘 때마다 여기에 등록한다.
export const ISLE_SCENES = {
  'whisper-cape': buildWhisperCapeScene,
  'echo-cave': buildEchoCaveScene
};
