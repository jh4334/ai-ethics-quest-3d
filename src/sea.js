// 항해 씬(잡음의 군도 바다) — 표현 계층. 섬 배치·상태 데이터는 stageData.js가 단일 출처다.
// 저사양 원칙: 그림자 캐스터 0, 라이트는 반구광+방향광 2개뿐, 지오메트리 전부 코드 생성.
import * as THREE from 'three';
import { STAGES } from './stageData.js';

// sea 좌표 → 월드 배율. 가장 먼 섬(기억의 심장 심부)이 시속 7 뗏목으로 십수 초 거리.
export const SEA_SCALE = 2.2;
// 뗏목이 나갈 수 있는 바다 반경 / 섬 접근 인식 반경.
export const SEA_RADIUS = 92;
export const SEA_APPROACH = 7;

export function seaWorldPosition(stage) {
  return { x: stage.sea[0] * SEA_SCALE, z: stage.sea[1] * SEA_SCALE };
}

// 섬 실루엣 하나 — 안개에 잠긴 섬은 어두운 덩어리, 열린 섬은 또렷한 초록 + 등불.
function buildIsland(stage, open, makeLabel) {
  const group = new THREE.Group();
  const { x, z } = seaWorldPosition(stage);
  group.position.set(x, 0, z);

  const bodyColor = open ? 0x3f7a55 : 0x232a4d;
  const bodyEmissive = open ? 0x14301f : 0x11162e;
  const size = stage.id === 'prologue' ? 1.35 : 1;
  const hill = new THREE.Mesh(
    new THREE.ConeGeometry(3.1 * size, 3.4 * size, 7),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      emissive: bodyEmissive,
      emissiveIntensity: 0.7,
      roughness: 0.95,
      flatShading: true
    })
  );
  hill.position.y = 1.15 * size;
  group.add(hill);

  const shore = new THREE.Mesh(
    new THREE.CylinderGeometry(4.1 * size, 4.6 * size, 0.5, 10),
    new THREE.MeshStandardMaterial({
      color: open ? 0xcbb27d : 0x1d2340,
      emissive: open ? 0x3a3222 : 0x0e1226,
      emissiveIntensity: 0.6,
      roughness: 0.9,
      flatShading: true
    })
  );
  shore.position.y = -0.05;
  group.add(shore);

  let connectRing = null;
  if (open) {
    // 귀항 지점 표시: 따뜻한 등불 + 물 위 접속 링(정보의 바다에 연결된 섬 — 맥동은 main이 구동).
    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd88a })
    );
    lantern.position.set(0, 3.4 * size, 0);
    group.add(lantern);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5.6, 0.1, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.55 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.24;
    group.add(ring);
    connectRing = ring;
  }

  const label = makeLabel(
    open ? `${stage.emoji} ${stage.nameKo}` : `🌫️ ${stage.nameKo}`,
    open ? '#ffd88a' : '#8b93b8'
  );
  label.position.set(0, 4.6 * size, 0);
  group.add(label);

  return { group, connectRing };
}

// 뗏목 — 판자 4장 + 돛대 + 돛. 플레이어가 위에 올라선다.
function buildRaft() {
  const raft = new THREE.Group();
  const plankMat = new THREE.MeshStandardMaterial({
    color: 0x8a6a3f,
    emissive: 0x241a0c,
    emissiveIntensity: 0.5,
    roughness: 0.9
  });
  for (let i = 0; i < 4; i += 1) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 2.2), plankMat);
    plank.position.set((i - 1.5) * 0.56, 0, 0);
    raft.add(plank);
  }
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 1.9, 8),
    new THREE.MeshStandardMaterial({ color: 0x6d5230, emissive: 0x1c1408, emissiveIntensity: 0.5 })
  );
  mast.position.set(0.7, 1.0, -0.6);
  raft.add(mast);
  const sail = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 1.25),
    new THREE.MeshStandardMaterial({
      color: 0xe8e2d2,
      emissive: 0x4a463c,
      emissiveIntensity: 0.4,
      side: THREE.DoubleSide
    })
  );
  sail.position.set(0.16, 1.05, -0.6);
  raft.add(sail);
  return raft;
}

// 바다 씬 전체를 만든다. isOpen(stage)로 진입 가능 여부를 판정해 실루엣을 나눈다.
export function buildSeaScene({ makeLabel, isOpen }) {
  const root = new THREE.Group();

  // 밤바다: 짙은 남색 + 약한 자체 발광(오버월드 톤 교정에 짓눌리지 않게 — 던전과 같은 원칙).
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x152250,
    emissive: 0x0c1638,
    emissiveIntensity: 0.55,
    roughness: 0.82
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(SEA_RADIUS + 30, 48), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.1;
  root.add(water);

  // 달 — 스프라이트 대신 저렴한 원판 하나.
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff3cf })
  );
  moon.position.set(26, 30, -70);
  moon.lookAt(0, 6, 20);
  root.add(moon);

  // 조명: 달빛 반구광 + 푸른 방향광. 그림자 없음.
  root.add(new THREE.HemisphereLight(0x8fa8ff, 0x0c1430, 1.2));
  const moonlight = new THREE.DirectionalLight(0xbfd4ff, 0.85);
  moonlight.position.set(18, 24, -30);
  root.add(moonlight);

  const islands = [];
  const connectRings = [];
  for (const stage of STAGES) {
    const open = isOpen(stage);
    const { group, connectRing } = buildIsland(stage, open, makeLabel);
    root.add(group);
    islands.push({ stage, open, group });
    if (connectRing) {
      connectRings.push(connectRing);
    }
  }

  // 데이터 해류(Z3) — 열린 항로(연속으로 열린 두 섬 사이)를 따라 흐르는 빛 입자 스트림.
  // "정보는 바다를 흘러다닌다"는 컨셉의 시각화. 입자 위치는 main의 updateVoyage가
  // elapsed 기반으로 결정적으로 구동한다.
  const currentSegments = [];
  for (let i = 0; i < islands.length - 1; i += 1) {
    if (islands[i].open && islands[i + 1].open) {
      const a = seaWorldPosition(islands[i].stage);
      const b = seaWorldPosition(islands[i + 1].stage);
      currentSegments.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z });
    }
  }
  const PARTICLES_PER_SEGMENT = 14;
  let currents = null;
  if (currentSegments.length > 0) {
    const count = currentSegments.length * PARTICLES_PER_SEGMENT;
    const positions = new Float32Array(count * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0x8fe0ff,
        size: 1.05,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    points.frustumCulled = false; // 입자가 전 바다에 퍼져 있어 컬링 계산이 오히려 손해
    root.add(points);
    currents = { points, segments: currentSegments, perSegment: PARTICLES_PER_SEGMENT };
  }

  // 해류 줄무늬 — 수면을 따라 흐르는 가늘고 긴 빛줄기(바람의 지휘봉식 바다 표정).
  const streaks = [];
  for (let i = 0; i < 12; i += 1) {
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(7.5, 0.16),
      new THREE.MeshBasicMaterial({ color: 0xa8d8ef, transparent: true, opacity: 0.14, depthWrite: false })
    );
    streak.rotation.x = -Math.PI / 2;
    const angle = i * 2.4;
    const radius = 12 + ((i * 0.618) % 1) * 66;
    streak.userData = {
      baseX: Math.cos(angle) * radius,
      baseZ: Math.sin(angle) * radius,
      dirX: Math.cos(angle + 1.2),
      dirZ: Math.sin(angle + 1.2),
      phase: i * 1.31
    };
    streak.rotation.z = -(angle + 1.2); // 흐르는 방향으로 눕힌다
    streak.position.y = 0.06;
    root.add(streak);
    streaks.push(streak);
  }

  const raft = buildRaft();
  root.add(raft);

  // 가이드 화살표 — 다음 목적지 섬을 가리킨다(방향·표시는 main의 updateVoyage가 구동).
  const guideArrow = new THREE.Group();
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffd88a });
  const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 6), arrowMat);
  arrowHead.rotation.x = Math.PI / 2; // 그룹의 +z(바라보는 방향)를 가리키게
  arrowHead.position.z = 0.55;
  guideArrow.add(arrowHead);
  const arrowTail = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.7, 6), arrowMat);
  arrowTail.rotation.x = Math.PI / 2;
  arrowTail.position.z = -0.15;
  guideArrow.add(arrowTail);
  guideArrow.visible = false;
  root.add(guideArrow);

  return { root, islands, raft, waterMat, guideArrow, currents, streaks, connectRings };
}
