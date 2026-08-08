import * as THREE from 'three';

const PALETTES = Object.freeze({
  amber: Object.freeze({ color: 0xbe8954, emissive: 0x3d210f }),
  blue: Object.freeze({ color: 0x5275a8, emissive: 0x112b4b }),
  cyan: Object.freeze({ color: 0x4f9e9b, emissive: 0x104542 }),
  glow: Object.freeze({ color: 0xcffef0, emissive: 0x36d4ae, emissiveIntensity: 1.55 }),
  neutral: Object.freeze({ color: 0x77859b, emissive: 0x151d2b }),
  red: Object.freeze({ color: 0x9f3e39, emissive: 0x3f1412 }),
  violet: Object.freeze({ color: 0x806a9d, emissive: 0x2b1b3c })
});

// 인스턴스 튜플: [x, y, z, sx, sy, sz, rotY=0, rotZ=0] — rotZ는 벽시계 바늘처럼 벽면 회전에만 쓴다.
const DEFINITIONS = Object.freeze({
  'share-chain': Object.freeze([
    { id: 'share-source-trace', palette: 'cyan', shape: 'box', instances: [
      [0, 0.12, -26, 0.32, 0.12, 8], [0, 2.2, -30, 3.2, 3.8, 0.5]
    ] },
    { id: 'share-copy-chain', palette: 'amber', shape: 'cylinder', instances: [
      [-5.2, 0.8, -25, 0.9, 1.6, 0.9], [0, 0.8, -27, 0.9, 1.6, 0.9], [5.2, 0.8, -25, 0.9, 1.6, 0.9]
    ] },
    { id: 'share-copy-chain', palette: 'amber', shape: 'box', instances: [
      [-2.6, 0.22, -26, 5.6, 0.16, 0.22, -0.36], [2.6, 0.22, -26, 5.6, 0.16, 0.22, 0.36]
    ] },
    { id: 'share-clone-output', palette: 'red', shape: 'box', instances: [
      [-6.2, 2, -29, 2.4, 4, 0.45], [6.2, 2, -29, 2.4, 4, 0.45],
      [-6.2, 3.8, -27.8, 2.4, 0.35, 2.4], [6.2, 3.8, -27.8, 2.4, 0.35, 2.4]
    ] },
    // 동일 포스터 반복 게시판 벽 — 같은 크기 패널을 좌측 벽에 3×3 격자로(복사물의 광장 서사).
    { id: 'share-poster-wall', palette: 'amber', shape: 'box', instances: [
      [-7.2, 1.2, -22, 0.18, 0.95, 1.7], [-7.2, 1.2, -24.4, 0.18, 0.95, 1.7], [-7.2, 1.2, -26.8, 0.18, 0.95, 1.7],
      [-7.2, 2.35, -22, 0.18, 0.95, 1.7], [-7.2, 2.35, -24.4, 0.18, 0.95, 1.7], [-7.2, 2.35, -26.8, 0.18, 0.95, 1.7],
      [-7.2, 3.5, -22, 0.18, 0.95, 1.7], [-7.2, 3.5, -24.4, 0.18, 0.95, 1.7], [-7.2, 3.5, -26.8, 0.18, 0.95, 1.7]
    ] },
    // 바닥 공유 사슬 — 게시판에서 복제 출력구까지 이어지는 발광 점선(납작한 대시 8개).
    { id: 'share-chain-links', palette: 'glow', shape: 'box', instances: [
      [-6.3, 0.1, -20.8, 0.7, 0.08, 0.28, 0.43], [-4.5, 0.1, -21.62, 0.7, 0.08, 0.28, 0.43],
      [-2.7, 0.1, -22.44, 0.7, 0.08, 0.28, 0.43], [-0.9, 0.1, -23.26, 0.7, 0.08, 0.28, 0.43],
      [0.9, 0.1, -24.08, 0.7, 0.08, 0.28, 0.43], [2.7, 0.1, -24.9, 0.7, 0.08, 0.28, 0.43],
      [4.5, 0.1, -25.72, 0.7, 0.08, 0.28, 0.43], [6.3, 0.1, -26.54, 0.7, 0.08, 0.28, 0.43]
    ] },
    // 흩어진 복사물 더미 — 낮은 종이 스택 3무더기(각기 다른 흐트러짐 각도, 전부 고정값).
    { id: 'share-copy-piles', palette: 'neutral', shape: 'box', instances: [
      [-3.4, 0.1, -20.2, 1.15, 0.2, 0.85, 0.28], [-3.3, 0.28, -20.1, 1, 0.16, 0.75, -0.18],
      [2.8, 0.1, -21.2, 1.2, 0.2, 0.9, -0.32], [2.9, 0.28, -21.1, 1.05, 0.16, 0.8, 0.22], [2.75, 0.44, -21.2, 0.9, 0.14, 0.7, -0.1],
      [5.9, 0.1, -19.6, 1.1, 0.2, 0.8, 0.4], [5.95, 0.27, -19.6, 0.95, 0.15, 0.7, 0.05]
    ] },
    // 벽가 사물함 줄 — 통행 경계(±8.4) 밖 벽면(±8.7)에 붙어 낮은 시야의 좌우를 채운다.
    { id: 'share-perimeter-lockers', palette: 'neutral', shape: 'box', instances: [
      [-8.7, 1.1, -14, 0.5, 2.2, 3.2], [-8.7, 1.1, -18.6, 0.5, 2.2, 3.2], [-8.7, 1.1, -31.4, 0.5, 2.2, 3.2],
      [8.7, 1.1, -14, 0.5, 2.2, 3.2], [8.7, 1.1, -18.6, 0.5, 2.2, 3.2], [8.7, 1.1, -23.2, 0.5, 2.2, 3.2]
    ] },
    // 천장 트러스 — 낮은 카메라에서 화면 상단을 닫아 '방 안'으로 읽히게 하는 가로 보.
    { id: 'share-ceiling-truss', palette: 'blue', shape: 'box', instances: [
      [0, 4.6, -14, 17.5, 0.3, 0.42], [0, 4.6, -22, 17.5, 0.3, 0.42], [0, 4.6, -30, 17.5, 0.3, 0.42]
    ] }
  ]),
  'dual-school': Object.freeze([
    // 편안층은 호박, 검증층은 시안 — 좌우 재질·명도 대비를 색 온도로 못 박는다.
    { id: 'dual-comfort-school', palette: 'amber', shape: 'box', instances: [
      [-5.6, 1.8, -29, 4.8, 3.6, 0.5], [-7.4, 1.2, -25, 0.45, 2.4, 7]
    ] },
    { id: 'dual-verified-school', palette: 'cyan', shape: 'box', instances: [
      [5.6, 1.8, -29, 4.8, 3.6, 0.5], [7.4, 1.2, -25, 0.45, 2.4, 7]
    ] },
    { id: 'dual-unequal-records', palette: 'amber', shape: 'box', instances: [
      [-5.4, 0.35, -21, 2.2, 0.3, 1.4], [-5.4, 0.75, -21, 1.8, 0.3, 1.2],
      [-5.4, 1.15, -21, 1.4, 0.3, 1], [5.4, 0.35, -21, 1.2, 0.3, 1]
    ] },
    { id: 'dual-layer-divider', palette: 'blue', shape: 'box', instances: [
      [0, 0.1, -25, 0.18, 0.12, 13], [0, 2.1, -30, 0.28, 4.2, 0.5]
    ] },
    // 가운데 동기화 기둥 — 두 층을 잇는 세로 기둥과 발광 밴드 3단.
    { id: 'dual-sync-pillar', palette: 'neutral', shape: 'box', instances: [[0, 1.9, -27.5, 0.9, 3.8, 0.9]] },
    { id: 'dual-sync-pillar', palette: 'glow', shape: 'box', instances: [
      [0, 1.1, -27.5, 1.05, 0.22, 1.05], [0, 2.2, -27.5, 1.05, 0.22, 1.05], [0, 3.3, -27.5, 1.05, 0.22, 1.05]
    ] },
    // 로그 캐비닛 — 검증층(시안, x>0)에만 3대. 기록이 남는 쪽이 어디인지 배치가 말한다.
    { id: 'dual-log-cabinets', palette: 'cyan', shape: 'box', instances: [
      [4.6, 0.95, -22.6, 1.1, 1.9, 0.9], [6, 0.95, -22.6, 1.1, 1.9, 0.9], [5.3, 0.95, -24.2, 1.1, 1.9, 0.9]
    ] },
    // 벽가 책상 열 — 통행 경계(±9.4) 밖 벽면(±9.7)에 각 층의 색으로 책상 실루엣을 세운다.
    { id: 'dual-comfort-desk-row', palette: 'amber', shape: 'box', instances: [
      [-9.7, 0.5, -14, 0.5, 1, 2.6], [-9.7, 0.5, -18.4, 0.5, 1, 2.6], [-9.7, 0.5, -31, 0.5, 1, 2.6]
    ] },
    { id: 'dual-verified-desk-row', palette: 'cyan', shape: 'box', instances: [
      [9.7, 0.5, -14, 0.5, 1, 2.6], [9.7, 0.5, -18.4, 0.5, 1, 2.6], [9.7, 0.5, -31, 0.5, 1, 2.6]
    ] },
    // 천장 트러스 — 두 현실을 하나의 지붕이 덮고 있음을 보이는 가로 보.
    { id: 'dual-ceiling-truss', palette: 'neutral', shape: 'box', instances: [
      [0, 4.7, -15, 19.5, 0.3, 0.42], [0, 4.7, -23, 19.5, 0.3, 0.42], [0, 4.7, -31, 19.5, 0.3, 0.42]
    ] }
  ]),
  'approval-room': Object.freeze([
    { id: 'approval-dossier-queue', palette: 'amber', shape: 'box', instances: [
      [-5.8, 0.25, -20, 2.2, 0.35, 1.4], [-5.8, 0.65, -22, 2, 0.35, 1.3],
      [-5.8, 1.05, -24, 1.8, 0.35, 1.2], [-5.8, 1.45, -26, 1.6, 0.35, 1.1]
    ] },
    { id: 'approval-conveyor', palette: 'red', shape: 'box', instances: [
      [0, 0.22, -25, 2.4, 0.3, 11], [0, 1.25, -30, 6.8, 0.45, 0.55]
    ] },
    { id: 'approval-yoonseo-terminal', palette: 'violet', shape: 'box', instances: [
      [5.6, 1.3, -23.5, 2.6, 2.6, 0.7], [5.6, 0.45, -22.5, 3.2, 0.55, 2.2]
    ] },
    { id: 'approval-review-gate', palette: 'cyan', shape: 'box', instances: [
      [-3.6, 2.1, -29, 0.55, 4.2, 0.55], [3.6, 2.1, -29, 0.55, 4.2, 0.55],
      [0, 4, -29, 7.6, 0.5, 0.55]
    ] },
    // 스탬프 게이트 — 기존 review-gate 상단 크로스바 아래에 스탬프 헤드·자루를 단다.
    { id: 'approval-review-gate', palette: 'red', shape: 'box', instances: [
      [0, 3.1, -29, 1.4, 0.6, 0.9], [0, 3.65, -29, 0.45, 0.5, 0.45]
    ] },
    // 전광 문구 패널 — 게이트 위 발광 패널('3초 승인'의 속도감을 빛으로).
    { id: 'approval-marquee-panel', palette: 'glow', shape: 'box', instances: [[0, 4.9, -29.2, 5.4, 0.8, 0.25]] },
    // 벽가 서류 선반 — 통행 경계(±8.4) 밖 벽면(±8.7)까지 결재 대기 서류가 쌓여 있다.
    { id: 'approval-file-shelves', palette: 'neutral', shape: 'box', instances: [
      [-8.7, 1, -14.5, 0.5, 2, 3], [-8.7, 1, -19.5, 0.5, 2, 3],
      [8.7, 1, -16.5, 0.5, 2, 3], [8.7, 1, -26.5, 0.5, 2, 3]
    ] },
    // 천장 배관 — 승인 파이프라인의 압박감을 머리 위 배관 실루엣으로 잇는다.
    { id: 'approval-ceiling-pipes', palette: 'red', shape: 'box', instances: [
      [-1.3, 4.55, -24.5, 0.34, 0.34, 20], [1.3, 4.66, -24.5, 0.34, 0.34, 20]
    ] }
  ]),
  finale: Object.freeze([
    { id: 'finale-haru-stage', palette: 'amber', shape: 'box', instances: [[-4.3, 0.18, -68, 2.6, 0.35, 3]] },
    { id: 'finale-dot-stage', palette: 'cyan', shape: 'box', instances: [[-1.4, 0.18, -70, 2.2, 0.35, 2.6]] },
    { id: 'finale-lumen-stage', palette: 'violet', shape: 'box', instances: [[2.2, 0.18, -70, 2.8, 0.35, 3]] },
    { id: 'finale-broadcast-booth', palette: 'blue', shape: 'box', instances: [
      [0, 2.5, -75, 13, 5, 0.55], [-6.2, 1.5, -72.5, 0.45, 3, 5], [6.2, 1.5, -72.5, 0.45, 3, 5]
    ] },
    { id: 'finale-evidence-beam', palette: 'cyan', shape: 'box', instances: [[0, 0.1, -66, 0.28, 0.12, 11]] },
    { id: 'finale-public-feed', palette: 'neutral', shape: 'box', instances: [[0, 3.2, -74.6, 2.8, 1.8, 0.3]] },
    // 콘솔 데스크 + 모니터 3장 — 방송 조정실의 물리 스위치가 놓일 자리.
    { id: 'finale-console-desk', palette: 'blue', shape: 'box', instances: [
      [0.4, 0.95, -72.6, 4.8, 0.18, 1.35], [0.4, 0.45, -72.6, 4.2, 0.9, 1.05]
    ] },
    { id: 'finale-console-monitors', palette: 'cyan', shape: 'box', instances: [
      [-0.9, 1.5, -72.75, 1.15, 0.7, 0.1], [0.4, 1.55, -72.8, 1.3, 0.8, 0.1], [1.7, 1.5, -72.75, 1.15, 0.7, 0.1]
    ] },
    // 00:17 벽시계 — 시계판 + 바늘 2개. 분침은 17분(시계방향 102°), 시침은 자정 직후.
    { id: 'finale-wall-clock', palette: 'neutral', shape: 'box', instances: [[-2.2, 4.35, -74.7, 0.95, 0.95, 0.16]] },
    { id: 'finale-wall-clock', palette: 'amber', shape: 'box', instances: [
      [-2.18, 4.5, -74.56, 0.08, 0.32, 0.05, 0, -0.15], [-1.99, 4.3, -74.56, 0.07, 0.44, 0.05, 0, -1.78]
    ] },
    // ON AIR 사인 함체 — 부스 벽 상단에 얹힌 어두운 판. 발광 글자(ONAIR_SIGN)가 이 위에 붙어
    // 결말 화면의 '용도 불명 주황 사각형'이 방송 사인으로 읽히게 한다.
    { id: 'finale-onair-housing', palette: 'neutral', shape: 'box', instances: [[0, 5.2, -74.72, 2.6, 1, 0.14]] }
  ])
});

const FINALE_VARIANTS = Object.freeze({
  purge: Object.freeze([{ id: 'finale-public-feed-purge', palette: 'red', shape: 'box', instances: [
    [-4.2, 3.1, -74.5, 2.4, 1.5, 0.32], [4.2, 3.1, -74.5, 2.4, 1.5, 0.32], [0, 3.2, -74.25, 0.35, 2.2, 0.35]
  ] }]),
  secure: Object.freeze([{ id: 'finale-public-feed-secure', palette: 'cyan', shape: 'box', instances: [
    [-4.2, 3.1, -74.5, 2.4, 1.5, 0.32], [4.2, 3.1, -74.5, 2.4, 1.5, 0.32], [0, 4.6, -74.4, 5.2, 0.22, 0.35]
  ] }])
});

// ON AIR 사인 — 결말 확정 시 점등. 전용 재질이라 setOnAir가 다른 랜드마크에 영향 없이 단독 제어한다.
// 글자는 어두운 함체(finale-onair-housing) 위에 얹은 획 블록 17개("ON AIR") — 평면 사각형이 아니라
// 방송 사인으로 읽힌다. 획 튜플은 [x, y, z, sx, sy, sz, rotY, rotZ] 저작 상수.
const ONAIR_SIGN = Object.freeze({
  emissive: 0xff3b28,
  id: 'finale-onair-sign',
  instances: Object.freeze([
    // O
    [-0.97, 5.2, -74.6, 0.07, 0.42, 0.07], [-0.75, 5.2, -74.6, 0.07, 0.42, 0.07],
    [-0.86, 5.38, -74.6, 0.29, 0.07, 0.07], [-0.86, 5.02, -74.6, 0.29, 0.07, 0.07],
    // N
    [-0.53, 5.2, -74.6, 0.07, 0.43, 0.07], [-0.31, 5.2, -74.6, 0.07, 0.43, 0.07],
    [-0.42, 5.2, -74.6, 0.07, 0.46, 0.07, 0, 0.52],
    // A
    [0.06, 5.2, -74.6, 0.07, 0.44, 0.07, 0, 0.17], [0.22, 5.2, -74.6, 0.07, 0.44, 0.07, 0, -0.17],
    [0.14, 5.1, -74.6, 0.2, 0.06, 0.07],
    // I
    [0.46, 5.2, -74.6, 0.07, 0.42, 0.07],
    // R
    [0.68, 5.28, -74.6, 0.07, 0.28, 0.07], [0.68, 5.03, -74.6, 0.07, 0.24, 0.07],
    [0.85, 5.31, -74.6, 0.07, 0.16, 0.07],
    [0.78, 5.39, -74.6, 0.2, 0.06, 0.07], [0.78, 5.23, -74.6, 0.2, 0.06, 0.07],
    [0.88, 5.06, -74.6, 0.08, 0.3, 0.07, 0, -0.5]
  ]),
  lit: Object.freeze({ color: 0xff6a55, emissiveIntensity: 2.4 }),
  unlit: Object.freeze({ color: 0x7c2d24, emissiveIntensity: 0.24 })
});

// 컨베이어 위 서류 실루엣 — 위치는 누적 elapsed의 순수 함수(모듈로 순환). Math.random 금지 계약.
const FLOW_DOCUMENTS = Object.freeze({
  count: 6,
  cycleZ: 10.4,
  id: 'approval-flow-documents',
  minZ: -30.2,
  palette: 'neutral',
  scale: Object.freeze([1.35, 0.07, 0.9]),
  speed: 1.6,
  x: 0,
  y: 0.46
});

function trianglesOf(geometry) {
  return geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
}

function freezeBudget(groups, geometries, materials, extras) {
  let instances = extras.instances;
  let triangles = extras.triangles;
  for (const { geometry, count } of groups.values()) {
    instances += count;
    triangles += count * trianglesOf(geometry);
  }
  return Object.freeze({
    drawCalls: groups.size + extras.drawCalls,
    instances,
    resources: geometries.size + materials.size,
    triangles
  });
}

export function createCampaignLandmarks({ scene, type, variant = 'default' }) {
  if (!DEFINITIONS[type]) throw new RangeError(`등록되지 않은 캠페인 랜드마크: ${type}`);
  const resolvedVariant = type === 'finale' ? variant : 'default';
  if (type === 'finale' && !FINALE_VARIANTS[resolvedVariant]) throw new RangeError(`등록되지 않은 피날레 변형: ${variant}`);
  const records = [...DEFINITIONS[type], ...(type === 'finale' ? FINALE_VARIANTS[resolvedVariant] : [])];
  const root = new THREE.Group();
  root.name = `campaign-landmarks-${type}`;
  const geometries = new Map();
  const materials = new Map();
  const groups = new Map();
  const dummy = new THREE.Object3D();

  const getGeometry = (shape) => {
    const geometry = geometries.get(shape) ?? (shape === 'cylinder'
      ? new THREE.CylinderGeometry(0.5, 0.5, 1, 12)
      : new THREE.BoxGeometry(1, 1, 1));
    geometries.set(shape, geometry);
    return geometry;
  };
  const getMaterial = (paletteName) => {
    const palette = PALETTES[paletteName];
    const material = materials.get(paletteName) ?? new THREE.MeshStandardMaterial({
      color: palette.color,
      emissive: palette.emissive,
      emissiveIntensity: palette.emissiveIntensity ?? 0.34,
      metalness: 0.14,
      roughness: 0.58
    });
    materials.set(paletteName, material);
    return material;
  };
  const placeInstance = (mesh, index, [x, y, z, sx, sy, sz, rotationY = 0, rotationZ = 0]) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rotationY, rotationZ);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  };

  for (const record of records) {
    const geometry = getGeometry(record.shape);
    const material = getMaterial(record.palette);
    const key = `${record.shape}:${record.palette}`;
    const group = groups.get(key) ?? { geometry, material, records: [], count: 0 };
    group.records.push(record);
    group.count += record.instances.length;
    groups.set(key, group);
  }

  for (const [key, group] of groups) {
    const mesh = new THREE.InstancedMesh(group.geometry, group.material, group.count);
    mesh.name = `campaign-landmark-batch-${key}`;
    let index = 0;
    for (const record of group.records) for (const tuple of record.instances) {
      placeInstance(mesh, index, tuple);
      index += 1;
    }
    mesh.instanceMatrix.needsUpdate = true;
    root.add(mesh);
  }

  // 정적 배치 밖의 특수 메시(전용 재질·움직임)도 같은 예산에 계상한다.
  const extras = { drawCalls: 0, instances: 0, triangles: 0 };
  const extraIds = [];
  let onAirMaterial = null;
  let onAirLit = false;
  let flowMesh = null;
  let flowElapsed = 0;

  if (type === 'finale') {
    const geometry = getGeometry('box');
    onAirMaterial = new THREE.MeshStandardMaterial({
      color: ONAIR_SIGN.unlit.color,
      emissive: ONAIR_SIGN.emissive,
      emissiveIntensity: ONAIR_SIGN.unlit.emissiveIntensity,
      roughness: 0.55
    });
    materials.set('onair-sign', onAirMaterial);
    const mesh = new THREE.InstancedMesh(geometry, onAirMaterial, ONAIR_SIGN.instances.length);
    mesh.name = 'campaign-landmark-onair-sign';
    for (const [index, tuple] of ONAIR_SIGN.instances.entries()) placeInstance(mesh, index, tuple);
    mesh.instanceMatrix.needsUpdate = true;
    root.add(mesh);
    extras.drawCalls += 1;
    extras.instances += ONAIR_SIGN.instances.length;
    extras.triangles += ONAIR_SIGN.instances.length * trianglesOf(geometry);
    extraIds.push(ONAIR_SIGN.id);
  }

  const placeFlowDocuments = (mesh, elapsed) => {
    const spacing = FLOW_DOCUMENTS.cycleZ / FLOW_DOCUMENTS.count;
    for (let index = 0; index < FLOW_DOCUMENTS.count; index += 1) {
      const offset = (elapsed * FLOW_DOCUMENTS.speed + index * spacing) % FLOW_DOCUMENTS.cycleZ;
      placeInstance(mesh, index, [
        FLOW_DOCUMENTS.x, FLOW_DOCUMENTS.y, FLOW_DOCUMENTS.minZ + offset, ...FLOW_DOCUMENTS.scale
      ]);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  if (type === 'approval-room') {
    const geometry = getGeometry('box');
    flowMesh = new THREE.InstancedMesh(geometry, getMaterial(FLOW_DOCUMENTS.palette), FLOW_DOCUMENTS.count);
    flowMesh.name = 'campaign-landmark-flow-documents';
    placeFlowDocuments(flowMesh, 0);
    root.add(flowMesh);
    extras.drawCalls += 1;
    extras.instances += FLOW_DOCUMENTS.count;
    extras.triangles += FLOW_DOCUMENTS.count * trianglesOf(geometry);
    extraIds.push(FLOW_DOCUMENTS.id);
  }

  scene.add(root);
  const budget = freezeBudget(groups, geometries, materials, extras);
  const landmarkIds = Object.freeze([...new Set([...records.map(({ id }) => id), ...extraIds])]);
  let disposed = false;

  return Object.freeze({
    dispose() {
      if (disposed) return 0;
      disposed = true;
      root.removeFromParent();
      for (const geometry of geometries.values()) geometry.dispose();
      for (const material of materials.values()) material.dispose();
      return budget.resources;
    },
    getDebugState: () => Object.freeze({
      budget, disposed, landmarkIds, onAir: onAirMaterial ? onAirLit : null, type, variant: resolvedVariant
    }),
    root,
    // ON AIR 점등 — 결말 확정(showOutcome) 시 true로 배선한다. 사인이 없는 타입이면 아무 일도 없다.
    setOnAir(lit = true) {
      if (!onAirMaterial || disposed) return onAirLit;
      onAirLit = Boolean(lit);
      const preset = onAirLit ? ONAIR_SIGN.lit : ONAIR_SIGN.unlit;
      onAirMaterial.color.setHex(preset.color);
      onAirMaterial.emissiveIntensity = preset.emissiveIntensity;
      return onAirLit;
    },
    // 서류 실루엣 순환 — 누적 elapsed를 주기로 접어(모듈로) 결정적으로 갱신한다.
    update(delta = 0) {
      if (!flowMesh || disposed) return;
      flowElapsed = (flowElapsed + Math.max(0, delta)) % (FLOW_DOCUMENTS.cycleZ / FLOW_DOCUMENTS.speed);
      placeFlowDocuments(flowMesh, flowElapsed);
    }
  });
}
