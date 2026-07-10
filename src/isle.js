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
