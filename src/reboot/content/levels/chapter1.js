// 1장은 한 평면 위 학교 동선을 따라 진행한다. 렌더러는 각 레이어를 독립적으로 소비한다.
export const chapterOneLevel = {
  bossExitId: 'chapter-one-complete',
  id: 'chapter-one-school-night',
  planeY: 0,
  startSegmentId: 'classroom-cold-open',
  segments: [
    {
      anchor: { x: 0, y: 0, z: -1 },
      checkpointId: 'checkpoint-classroom',
      collisionId: 'collision-classroom',
      exits: [{ kind: 'segment', to: 'collapsing-corridor' }],
      id: 'classroom-cold-open',
      label: '교실 콜드 오픈',
      navigationId: 'nav-classroom'
    },
    {
      anchor: { x: 0, y: 0, z: -18 },
      checkpointId: 'checkpoint-corridor',
      collisionId: 'collision-corridor',
      exits: [{ kind: 'segment', to: 'first-arena' }],
      id: 'collapsing-corridor',
      label: '무너지는 복도',
      navigationId: 'nav-corridor'
    },
    {
      anchor: { x: 0, y: 0, z: -39 },
      checkpointId: 'checkpoint-first-arena',
      collisionId: 'collision-first-arena',
      exits: [{ kind: 'segment', to: 'memory-backup-decision' }],
      id: 'first-arena',
      label: '첫 전투 교실',
      navigationId: 'nav-first-arena'
    },
    {
      anchor: { x: 0, y: 0, z: -54 },
      checkpointId: 'checkpoint-memory',
      collisionId: 'collision-memory',
      exits: [{ kind: 'segment', to: 'scanner-pursuit' }],
      id: 'memory-backup-decision',
      label: '기억 백업 결정',
      navigationId: 'nav-memory'
    },
    {
      anchor: { x: 0, y: 0, z: -76 },
      checkpointId: 'checkpoint-pursuit',
      collisionId: 'collision-pursuit',
      exits: [{ kind: 'segment', to: 'gym-boss-arena' }],
      id: 'scanner-pursuit',
      label: '스캐너 추격',
      navigationId: 'nav-pursuit'
    },
    {
      anchor: { x: 0, y: 0, z: -104 },
      checkpointId: 'checkpoint-gym',
      collisionId: 'collision-gym',
      exits: [{ kind: 'chapter-exit', to: 'chapter-one-complete' }],
      id: 'gym-boss-arena',
      label: '체육관 보스 아레나',
      navigationId: 'nav-gym'
    }
  ],
  layers: {
    collision: [
      { id: 'collision-classroom', segmentId: 'classroom-cold-open', walkableBounds: { maxX: 6, maxZ: 6, minX: -6, minZ: -6 } },
      { id: 'collision-corridor', segmentId: 'collapsing-corridor', walkableBounds: { maxX: 3, maxZ: -6, minX: -3, minZ: -30 } },
      { id: 'collision-first-arena', segmentId: 'first-arena', walkableBounds: { maxX: 9, maxZ: -30, minX: -9, minZ: -48 } },
      { id: 'collision-memory', segmentId: 'memory-backup-decision', walkableBounds: { maxX: 6, maxZ: -48, minX: -6, minZ: -61 } },
      { id: 'collision-pursuit', segmentId: 'scanner-pursuit', walkableBounds: { maxX: 4, maxZ: -61, minX: -4, minZ: -91 } },
      { id: 'collision-gym', segmentId: 'gym-boss-arena', walkableBounds: { maxX: 13, maxZ: -91, minX: -13, minZ: -119 } }
    ],
    navigation: [
      { bounds: { maxX: 6, maxZ: 6, minX: -6, minZ: -6 }, id: 'nav-classroom', segmentId: 'classroom-cold-open' },
      { bounds: { maxX: 3, maxZ: -6, minX: -3, minZ: -30 }, id: 'nav-corridor', segmentId: 'collapsing-corridor' },
      { bounds: { maxX: 9, maxZ: -30, minX: -9, minZ: -48 }, id: 'nav-first-arena', segmentId: 'first-arena' },
      { bounds: { maxX: 6, maxZ: -48, minX: -6, minZ: -61 }, id: 'nav-memory', segmentId: 'memory-backup-decision' },
      { bounds: { maxX: 4, maxZ: -61, minX: -4, minZ: -91 }, id: 'nav-pursuit', segmentId: 'scanner-pursuit' },
      { bounds: { maxX: 13, maxZ: -91, minX: -13, minZ: -119 }, id: 'nav-gym', segmentId: 'gym-boss-arena' }
    ],
    visual: [
      { id: 'visual-classroom-lamps', kind: 'classroom', segmentId: 'classroom-cold-open' },
      { id: 'visual-corridor-emergency', kind: 'corridor', segmentId: 'collapsing-corridor' },
      { id: 'visual-arena-projector', kind: 'arena', segmentId: 'first-arena' },
      { id: 'visual-memory-terminal', kind: 'decision', segmentId: 'memory-backup-decision' },
      { id: 'visual-scanner-beacons', kind: 'pursuit', segmentId: 'scanner-pursuit' },
      { id: 'visual-gym-scoreboard', kind: 'boss-arena', segmentId: 'gym-boss-arena' }
    ],
    encounter: [
      { id: 'encounter-corridor-collapse', kind: 'escape', segmentId: 'collapsing-corridor' },
      { id: 'encounter-first-trace', kind: 'arena', segmentId: 'first-arena' },
      { id: 'encounter-memory-choice', kind: 'decision', segmentId: 'memory-backup-decision' },
      { id: 'encounter-scanner-chase', kind: 'pursuit', segmentId: 'scanner-pursuit' },
      { id: 'encounter-gym-boss', kind: 'boss', segmentId: 'gym-boss-arena' }
    ],
    checkpoint: [
      { id: 'checkpoint-classroom', segmentId: 'classroom-cold-open', spawn: { x: 0, y: 0, z: 1 } },
      { id: 'checkpoint-corridor', segmentId: 'collapsing-corridor', spawn: { x: 0, y: 0, z: -9 } },
      { id: 'checkpoint-first-arena', segmentId: 'first-arena', spawn: { x: 0, y: 0, z: -33 } },
      { id: 'checkpoint-memory', segmentId: 'memory-backup-decision', spawn: { x: 0, y: 0, z: -51 } },
      { id: 'checkpoint-pursuit', segmentId: 'scanner-pursuit', spawn: { x: 0, y: 0, z: -64 } },
      { id: 'checkpoint-gym', segmentId: 'gym-boss-arena', spawn: { x: 0, y: 0, z: -95 } }
    ],
    localLight: [
      { color: '#f3b36c', id: 'light-classroom', position: { x: 0, y: 2.8, z: 0 }, segmentId: 'classroom-cold-open', visualId: 'visual-classroom-lamps' },
      { color: '#d74732', id: 'light-corridor', position: { x: 0, y: 2.4, z: -18 }, segmentId: 'collapsing-corridor', visualId: 'visual-corridor-emergency' },
      { color: '#6aa9ff', id: 'light-arena', position: { x: 0, y: 4, z: -39 }, segmentId: 'first-arena', visualId: 'visual-arena-projector' },
      { color: '#f3b36c', id: 'light-memory', position: { x: 0, y: 2.2, z: -54 }, segmentId: 'memory-backup-decision', visualId: 'visual-memory-terminal' },
      { color: '#d74732', id: 'light-pursuit', position: { x: 0, y: 2.5, z: -76 }, segmentId: 'scanner-pursuit', visualId: 'visual-scanner-beacons' },
      { color: '#6aa9ff', id: 'light-gym', position: { x: 0, y: 5, z: -104 }, segmentId: 'gym-boss-arena', visualId: 'visual-gym-scoreboard' }
    ]
  }
};
