import * as THREE from 'three';

import { createDisposableRegistry } from './dispose.js';

const MATERIALS = Object.freeze({
  amber: { color: 0xf0b86b, emissive: 0x6b3f12, emissiveIntensity: 0.82, roughness: 0.7 },
  moon: { color: 0x7aaeea, emissive: 0x173c72, emissiveIntensity: 0.74, roughness: 0.64 },
  navy: { color: 0x29436d, emissive: 0x0b1732, emissiveIntensity: 0.34, roughness: 0.86 },
  signal: { color: 0x58d8c0, emissive: 0x0c514a, emissiveIntensity: 0.84, roughness: 0.62 },
  warning: { color: 0xe45d52, emissive: 0x5c1712, emissiveIntensity: 0.9, roughness: 0.68 }
});

const part = (material, x, y, z, sx, sy, sz, yaw = 0) => ({
  material, position: { x, y, z }, scale: { x: sx, y: sy, z: sz }, yaw
});
const landmark = (id, role, parts) => ({ id, parts, role });

const RECIPES = Object.freeze({
  classroom: [
    landmark('classroom-teacher-terminal', 'teacher-terminal', [
      part('navy', -4.5, 0.65, -3.8, 1.3, 1.3, 0.7),
      part('moon', -4.5, 1.45, -3.95, 1.05, 0.65, 0.12),
      part('amber', -4.5, 1.45, -3.87, 0.7, 0.32, 0.08)
    ]),
    landmark('classroom-student-desks', 'student-desk-rows', Array.from({ length: 6 }, (_, index) => (
      part('navy', index % 2 === 0 ? -2.1 : 2.1, 0.42, 2.2 - Math.floor(index / 2) * 2.15, 2.1, 0.75, 0.85)
    ))),
    landmark('classroom-board', 'board-silhouette', [part('signal', -5.72, 2.15, -2.2, 0.12, 1.65, 5.4)]),
    landmark('classroom-clock', 'clock-silhouette', [
      part('amber', -5.58, 2.62, -4.35, 0.08, 0.68, 0.68),
      part('navy', -5.48, 2.62, -4.35, 0.06, 0.43, 0.09, -0.45)
    ])
  ],
  corridor: [
    landmark('corridor-locker-banks', 'locker-banks', Array.from({ length: 6 }, (_, index) => (
      [-1, 1].map((side) => part('navy', side * 2.72, 1.05, -6 + index * 2.35, 0.48, 2.1, 1.8))
    )).flat()),
    landmark('corridor-room-number', 'room-number-cues', [-5.7, -1.8, 2.1, 5.8].map((z, index) => (
      part('moon', index % 2 === 0 ? -2.52 : 2.52, 2.3, z, 0.12, 0.52, 0.85)
    ))),
    landmark('corridor-emergency-sign', 'emergency-sign', [
      part('warning', 0, 2.65, 0, 1.25, 0.5, 0.14),
      part('amber', 0, 2.65, -0.1, 0.64, 0.14, 0.08)
    ])
  ],
  arena: [
    landmark('arena-projector-source', 'projector-source', [
      part('navy', 0, 2.5, -7.2, 2.2, 0.7, 1.35),
      part('moon', 0, 2.45, -6.48, 1.3, 0.32, 0.12),
      part('signal', 0, 1.75, -5.95, 0.32, 0.32, 0.32)
    ]),
    landmark('arena-source-grid', 'source-grid', [
      ...[-5.5, -1.8, 1.8, 5.5].map((x) => part('signal', x, 0.03, 0, 0.1, 0.05, 12)),
      ...[-5, 0, 5].map((z) => part('amber', 0, 0.035, z, 12, 0.045, 0.1))
    ]),
    landmark('arena-damaged-desk-perimeter', 'damaged-desk-perimeter', [
      part('navy', -7.2, 0.48, -5.2, 2.3, 0.8, 0.85, 0.22),
      part('navy', 7.2, 0.48, -4.8, 2.3, 0.8, 0.85, -0.3),
      part('navy', -7.4, 0.48, 0.2, 2.3, 0.8, 0.85, -0.48),
      part('navy', 7.3, 0.48, 0.4, 2.3, 0.8, 0.85, 0.38),
      part('navy', -6.8, 0.48, 5.2, 2.3, 0.8, 0.85, 0.18),
      part('navy', 6.8, 0.48, 5.1, 2.3, 0.8, 0.85, -0.18)
    ])
  ],
  decision: [
    landmark('memory-backup-terminal', 'backup-terminal', [
      part('navy', 0, 0.9, -5.25, 2.4, 1.8, 1.1),
      part('amber', 0, 1.42, -4.65, 1.55, 0.62, 0.12),
      part('signal', 0, 0.42, -4.62, 0.72, 0.16, 0.09)
    ]),
    landmark('memory-server-rack', 'server-rack', [
      part('navy', -4.65, 1.25, -1.6, 1.15, 2.5, 1.2),
      part('navy', 4.65, 1.25, -1.6, 1.15, 2.5, 1.2),
      ...[-0.62, 0, 0.62, 1.24].map((y, index) => part(index % 2 ? 'moon' : 'signal', -4.65, 1.05 + y, -0.93, 0.72, 0.12, 0.08))
    ]),
    landmark('memory-evidence-frame', 'evidence-frame', [
      part('amber', 3.9, 2.1, -5.7, 2.6, 0.12, 0.12),
      part('amber', 3.9, 0.8, -5.7, 2.6, 0.12, 0.12),
      part('amber', 2.6, 1.45, -5.7, 0.12, 1.4, 0.12),
      part('amber', 5.2, 1.45, -5.7, 0.12, 1.4, 0.12)
    ])
  ],
  pursuit: [
    landmark('pursuit-scanner-beacons', 'scanner-beacons', [-10, -3.5, 3.5, 10].flatMap((z, index) => [
      part(index % 2 ? 'warning' : 'signal', -3.35, 1.5, z, 0.38, 0.55, 0.38),
      part(index % 2 ? 'warning' : 'signal', 3.35, 1.5, z, 0.38, 0.55, 0.38)
    ])),
    landmark('pursuit-gate-rhythm', 'scanner-gate-rhythm', [-10, -3.5, 3.5, 10].flatMap((z) => [
      part('navy', -3.35, 1.1, z, 0.34, 2.2, 0.34),
      part('navy', 3.35, 1.1, z, 0.34, 2.2, 0.34),
      part('moon', 0, 2.25, z, 7, 0.22, 0.3)
    ]))
  ],
  'boss-arena': [
    landmark('gym-court-markings', 'court-markings', [
      part('amber', -8.5, 0.025, 0, 0.12, 0.04, 22),
      part('amber', 8.5, 0.025, 0, 0.12, 0.04, 22),
      part('amber', 0, 0.025, -11, 17, 0.04, 0.12),
      part('amber', 0, 0.025, 11, 17, 0.04, 0.12),
      part('moon', 0, 0.03, 0, 17, 0.035, 0.1),
      part('moon', -3, 0.035, 0, 0.1, 0.035, 5.5),
      part('moon', 3, 0.035, 0, 0.1, 0.035, 5.5)
    ]),
    landmark('gym-scoreboard', 'scoreboard', [
      part('navy', 0, 2, -8.5, 5.8, 2.1, 0.35),
      part('warning', -1.45, 2, -8.28, 1.55, 0.65, 0.12),
      part('signal', 1.45, 2, -8.28, 1.55, 0.65, 0.12)
    ]),
    landmark('gym-broadcast-door', 'broadcast-door', [
      part('navy', -8.2, 1.25, -8.8, 3.2, 2.5, 0.48),
      part('moon', -8.2, 2.65, -8.53, 2.5, 0.42, 0.12),
      part('warning', -7.25, 1.15, -8.52, 0.16, 0.16, 0.08)
    ]),
    landmark('gym-approval-server', 'approval-server-focus', [
      part('navy', 8.4, 1.15, -7.5, 2.8, 2.3, 1.4),
      part('amber', 8.4, 1.58, -6.75, 1.8, 0.65, 0.12),
      part('signal', 8.4, 0.72, -6.73, 1.1, 0.16, 0.09),
      part('moon', 7.55, 2.05, -6.72, 0.18, 0.18, 0.08),
      part('warning', 8.05, 2.05, -6.72, 0.18, 0.18, 0.08)
    ])
  ]
});

function addInstances(group, geometry, material, materialRole, parts) {
  const mesh = new THREE.InstancedMesh(geometry, material, parts.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  for (const [index, entry] of parts.entries()) {
    quaternion.setFromAxisAngle(axis, entry.yaw);
    matrix.compose(
      new THREE.Vector3(entry.position.x, entry.position.y, entry.position.z),
      quaternion,
      new THREE.Vector3(entry.scale.x, entry.scale.y, entry.scale.z)
    );
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.name = `school-dressing-${materialRole}`;
  mesh.userData = { routeRole: 'dressing', sourceIds: parts.map((entry) => entry.landmarkId) };
  group.add(mesh);
}

export function createSchoolRouteDressing({ level }) {
  const resources = createDisposableRegistry();
  const group = new THREE.Group();
  group.name = 'chapter-one-school-dressing';
  const segmentById = new Map(level.segments.map((segment) => [segment.id, segment]));
  const landmarks = [];
  const parts = [];

  for (const visual of level.layers.visual) {
    const segment = segmentById.get(visual.segmentId);
    const allowedIds = new Set(visual.landmarkIds ?? []);
    const recipe = (RECIPES[visual.kind] ?? []).filter((entry) => allowedIds.has(entry.id));
    for (const entry of recipe) {
      const transformed = entry.parts.map((item) => ({
        ...item,
        landmarkId: entry.id,
        position: {
          x: segment.anchor.x + item.position.x,
          y: level.planeY + item.position.y,
          z: segment.anchor.z + item.position.z
        }
      }));
      landmarks.push(Object.freeze({
        id: entry.id, kind: visual.kind, partCount: transformed.length,
        role: entry.role, segmentId: segment.id
      }));
      parts.push(...transformed);
    }
  }

  const geometry = parts.length > 0
    ? resources.register(new THREE.BoxGeometry(1, 1, 1), 'dressing-box-geometry')
    : null;
  for (const [materialRole, parameters] of Object.entries(MATERIALS)) {
    const matching = parts.filter((entry) => entry.material === materialRole);
    if (matching.length === 0) continue;
    const material = resources.register(
      new THREE.MeshStandardMaterial(parameters),
      `dressing-${materialRole}-material`
    );
    addInstances(group, geometry, material, materialRole, matching);
  }

  const landmarksBySegment = Object.freeze(Object.fromEntries(level.segments.map((segment) => [
    segment.id,
    Object.freeze(landmarks.filter((entry) => entry.segmentId === segment.id))
  ])));
  const drawCalls = group.children.filter((object) => object.isInstancedMesh).length;
  const budget = Object.freeze({
    drawCalls,
    instances: parts.length,
    resources: resources.size(),
    triangles: geometry ? (geometry.index.count / 3) * parts.length : 0
  });
  let disposed = false;

  return Object.freeze({
    dispose() {
      if (disposed) return 0;
      disposed = true;
      group.removeFromParent();
      group.clear();
      return resources.disposeAll();
    },
    getDebugState: () => Object.freeze({ budget, disposed, landmarksBySegment }),
    group
  });
}
