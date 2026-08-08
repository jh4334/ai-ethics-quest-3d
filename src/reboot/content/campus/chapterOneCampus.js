const placement = (assetId, districtId, position, scale = 1, rotationY = 0) => Object.freeze({
  assetId,
  districtId,
  position: Object.freeze(position),
  rotationY,
  scale
});

export const CAMPUS_MATERIAL_ROLES = Object.freeze([
  'brick', 'concrete', 'glass', 'metal', 'wood', 'track', 'foliage'
]);

export const CAMPUS_DISTRICTS = Object.freeze([
  Object.freeze({
    id: 'open-classroom', labelKo: '열린 교실', segmentId: 'classroom-cold-open',
    center: Object.freeze({ x: 0, y: 0, z: 0 })
  }),
  Object.freeze({
    id: 'roster-tower', labelKo: '중앙 명단·출석 기록탑', segmentId: 'collapsing-corridor',
    center: Object.freeze({ x: -4.6, y: 0, z: -18 })
  }),
  Object.freeze({
    id: 'athletics-field', labelKo: '운동장·지문 기록 장치', segmentId: 'first-arena',
    center: Object.freeze({ x: 0, y: 0, z: -39 })
  }),
  Object.freeze({
    id: 'library-archive', labelKo: '도서관·기록보관소', segmentId: 'memory-backup-decision',
    center: Object.freeze({ x: 0, y: 0, z: -54 })
  }),
  Object.freeze({
    id: 'glass-administration', labelKo: '유리 행정 타워', segmentId: 'scanner-pursuit',
    center: Object.freeze({ x: 0, y: 0, z: -76 })
  }),
  Object.freeze({
    id: 'gymnasium', labelKo: '부유 체육관', segmentId: 'gym-boss-arena',
    center: Object.freeze({ x: 0, y: 0, z: -104 })
  })
]);

export const CAMPUS_LANDMARKS = Object.freeze([
  Object.freeze({ districtId: 'open-classroom', id: 'h17-empty-seat', labelKo: '빈 H-17 자리', objectiveOrder: 1 }),
  Object.freeze({ districtId: 'open-classroom', id: 'classroom-record-terminal', labelKo: '교실 기록 단말', objectiveOrder: 2 }),
  Object.freeze({ districtId: 'roster-tower', id: 'central-roster-spire', labelKo: '중앙 명단탑', objectiveOrder: 3 }),
  Object.freeze({ districtId: 'athletics-field', id: 'athletics-track', labelKo: '부유 운동장 트랙', objectiveOrder: 4 }),
  Object.freeze({ districtId: 'athletics-field', id: 'fingerprint-recorder', labelKo: '지문 기록 장치', objectiveOrder: 5 }),
  Object.freeze({ districtId: 'library-archive', id: 'night-library', labelKo: '야간 도서관', objectiveOrder: 6 }),
  Object.freeze({ districtId: 'library-archive', id: 'memory-archive', labelKo: '기록보관소', objectiveOrder: 7 }),
  Object.freeze({ districtId: 'glass-administration', id: 'deletion-glass-tower', labelKo: '삭제 광선 행정 타워', objectiveOrder: 8 }),
  Object.freeze({ districtId: 'gymnasium', id: 'floating-gym', labelKo: '출석 감독관 체육관', objectiveOrder: 9 })
]);

const classroomFurniture = [
  [-3.4, 1.9], [-1.2, 1.9], [1.2, 1.9], [3.4, 1.9],
  [-3.4, -0.2], [-1.2, -0.2], [1.2, -0.2], [3.4, -0.2]
].flatMap(([x, z], index) => [
  placement('classroom-desk', 'open-classroom', { x, y: 0.08, z }, 0.82, Math.PI),
  placement('classroom-chair', 'open-classroom', { x, y: 0.08, z: z + 0.7 }, 0.78, Math.PI),
  ...(index === 5 ? [placement('classroom-screen', 'open-classroom', { x, y: 0.83, z: z - 0.12 }, 0.75, Math.PI)] : [])
]);

const classroomShell = [
  placement('campus-floor', 'open-classroom', { x: -4, y: -0.08, z: 0 }, 2),
  placement('campus-floor', 'open-classroom', { x: 4, y: -0.08, z: 0 }, 2),
  placement('campus-window', 'open-classroom', { x: -5.85, y: 0, z: -2 }, 1.45, Math.PI / 2),
  placement('campus-window', 'open-classroom', { x: -5.85, y: 0, z: 2 }, 1.45, Math.PI / 2),
  placement('campus-wall', 'open-classroom', { x: 5.85, y: 0, z: 2 }, 1.45, Math.PI / 2),
  placement('campus-doorway', 'open-classroom', { x: 5.85, y: 0, z: -2 }, 1.45, Math.PI / 2),
  ...[-5.7, 5.7].flatMap((x) => [-4.8, 4.8].map((z) => placement('campus-column', 'open-classroom', { x, y: 0, z }, 1.35)))
];

const libraryProps = [-4.7, -2.8, 2.8, 4.7].flatMap((x, index) => [
  placement('library-bookcase', 'library-archive', { x, y: 0.05, z: -56.2 }, 1.1, index < 2 ? 0 : Math.PI),
  placement('library-books', 'library-archive', { x, y: 1.15, z: -55.75 }, 1.05, index < 2 ? 0 : Math.PI)
]);

const vegetation = [
  [-8, -33], [8, -34], [-8.5, -44], [8.5, -45], [-7, -56], [7, -58],
  [-3.8, -70], [3.8, -82], [-9.5, -96], [9.5, -111]
].flatMap(([x, z], index) => [
  placement(index % 3 === 0 ? 'campus-tree' : 'campus-bush', index < 4 ? 'athletics-field' : index < 6 ? 'library-archive' : index < 8 ? 'glass-administration' : 'gymnasium', { x, y: 0, z }, index % 3 === 0 ? 2.35 : 1.45, index * 0.47),
  ...(index % 3 === 1 ? [placement('campus-rock', 'athletics-field', { x: x + 0.8, y: 0, z: z - 0.5 }, 0.65, index)] : [])
]);

export const CAMPUS_ASSET_PLACEMENTS = Object.freeze([
  ...classroomShell,
  ...classroomFurniture,
  ...libraryProps,
  ...vegetation,
  placement('campus-window', 'library-archive', { x: -5.4, y: 0.15, z: -48.62 }, 1.25, 0),
  placement('campus-doorway', 'library-archive', { x: 5.4, y: 0.15, z: -48.62 }, 1.25, 0),
  placement('campus-column', 'library-archive', { x: -7.65, y: 0, z: -48.55 }, 1.15, 0),
  placement('campus-column', 'library-archive', { x: -3.15, y: 0, z: -48.55 }, 1.15, 0),
  placement('campus-column', 'library-archive', { x: 3.15, y: 0, z: -48.55 }, 1.15, 0),
  placement('campus-column', 'library-archive', { x: 7.65, y: 0, z: -48.55 }, 1.15, 0),
  placement('campus-doorway', 'gymnasium', { x: 0, y: 0, z: -91.35 }, 1.7, 0),
  placement('campus-window', 'gymnasium', { x: -5.6, y: 0.6, z: -91.5 }, 1.45, 0),
  placement('campus-window', 'gymnasium', { x: 5.6, y: 0.6, z: -91.5 }, 1.45, 0),
  ...[-3.1, 3.1].flatMap((x) => [
    placement('campus-column', 'glass-administration', { x, y: 0, z: -71.5 }, 1.3, 0),
    placement('campus-column', 'glass-administration', { x, y: 0, z: -80.5 }, 1.3, Math.PI)
  ]),
  placement('campus-stairs', 'roster-tower', { x: 0, y: 0, z: -11 }, 1.25, Math.PI),
  placement('campus-stairs', 'roster-tower', { x: 0, y: 0, z: -25 }, 1.25, 0),
  placement('classroom-screen', 'roster-tower', { x: -4.6, y: 1.6, z: -14.7 }, 1.3, 0),
  placement('classroom-screen', 'glass-administration', { x: -2.8, y: 1.25, z: -75 }, 1.1, Math.PI / 2),
  placement('classroom-screen', 'glass-administration', { x: 2.8, y: 1.25, z: -77 }, 1.1, -Math.PI / 2)
]);

export const CAMPUS_REQUIRED_ASSET_IDS = Object.freeze([
  ...new Set(CAMPUS_ASSET_PLACEMENTS.map((entry) => entry.assetId))
]);
