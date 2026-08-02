// 1장 진행 게이트 — 순수 로직(THREE·DOM 무의존, node 테스트 대상).
// 시퀀스 브레이크 차단(S6a): 스토리 phase가 문을 열어 주기 전에는 남쪽(-Z) 다음 구간의
// 통행 사각형을 잘라내 직진 스킵을 막는다. 게이트 경계는 레벨 collision 레이어에서 유도한다.
// 이미 문 너머에 있는 위치(QA fixture 스폰)는 막지 않는다 — 뒤로 끌어당기는 클램프 금지.
import { chapterOneLevel } from '../content/levels/chapter1.js';

function collisionMinZ(segmentId) {
  const entry = chapterOneLevel.layers.collision.find((candidate) => candidate.segmentId === segmentId);
  return entry.walkableBounds.minZ;
}

// 아레나 남쪽 문: 첫 아레나 적 전멸(first-arena-cleared) 전 잠김.
// 기억 단말 남쪽 문: 백업 결정(F 확보 / Q 소거) 전 잠김.
const GATES = Object.freeze({
  'arena-clear': Object.freeze({
    id: 'arena-clear',
    minZ: collisionMinZ('first-arena'),
    prompt: Object.freeze({
      desktop: '남은 적을 정리해야 남쪽 문이 열려',
      touch: '남은 적을 정리해야 남쪽 문이 열려'
    }),
    radio: Object.freeze({
      desktop: Object.freeze({
        id: 'gate-arena-clear', speaker: 'DOT',
        textKo: '문이 잠겼어. 남은 지우개·도장기를 정리해야 열려.', durationMs: 3600
      }),
      touch: Object.freeze({
        id: 'gate-arena-clear', speaker: 'DOT',
        textKo: '문이 잠겼어. 남은 지우개·도장기를 정리해야 열려.', durationMs: 3600
      })
    })
  }),
  'memory-decision': Object.freeze({
    id: 'memory-decision',
    minZ: collisionMinZ('memory-backup-decision'),
    prompt: Object.freeze({
      desktop: '백업 결정 전엔 못 지나가 — E 추적 / Q 소거',
      touch: '백업 결정 전엔 못 지나가 — 추적/소거 버튼'
    }),
    radio: Object.freeze({
      desktop: Object.freeze({
        id: 'gate-memory-decision', speaker: 'DOT',
        textKo: '하루의 백업을 정해야 문이 열려. E로 추적하거나 Q로 소거해.', durationMs: 4200
      }),
      touch: Object.freeze({
        id: 'gate-memory-decision', speaker: 'DOT',
        textKo: '하루의 백업을 정해야 문이 열려. 추적 버튼이나 소거 버튼을 눌러.', durationMs: 4200
      })
    })
  })
});

const GATE_BY_PHASE = Object.freeze({
  'cold-open': GATES['arena-clear'],
  corridor: GATES['arena-clear'],
  'first-arena': GATES['arena-clear'],
  'memory-decision': GATES['memory-decision'],
  'memory-traced': GATES['memory-decision'],
  'memory-secure-ready': GATES['memory-decision']
});

export function chapterOneGateForPhase(phase) {
  return GATE_BY_PHASE[phase] ?? null;
}

// 게이트 적용 통행 사각형 — 플레이어가 아직 문 앞(북쪽)일 때만 문 너머 구간을 잘라낸다.
// 게이트가 없거나 플레이어가 이미 문 너머면 원본 목록을 그대로 돌려준다(참조 동일성 = 미적용 신호).
export function chapterOneWalkableFor(rects, phase, playerZ) {
  const gate = chapterOneGateForPhase(phase);
  if (!gate || !Number.isFinite(playerZ) || playerZ < gate.minZ) return rects;
  return rects.filter((rect) => rect.minZ >= gate.minZ - 1e-6);
}

// 저장 체크포인트 → 리스폰·재부팅 스폰(레벨 checkpoint 레이어의 저작값).
const SEGMENT_BY_CHECKPOINT = Object.freeze({
  'chapter-1:start': 'classroom-cold-open',
  'chapter-1:corridor': 'classroom-cold-open',
  'chapter-1:first-arena': 'first-arena',
  'chapter-1:memory-decision': 'memory-backup-decision',
  'chapter-1:memory-traced': 'memory-backup-decision',
  'chapter-1:memory-pressure-cleared': 'memory-backup-decision',
  'chapter-1:pursuit': 'scanner-pursuit',
  'chapter-1:boss': 'gym-boss-arena',
  'chapter-1:boss-defeated': 'gym-boss-arena',
  'chapter-1:signature-revealed': 'gym-boss-arena'
});

export function chapterOneSpawnForCheckpoint(checkpoint) {
  const segmentId = SEGMENT_BY_CHECKPOINT[checkpoint] ?? 'classroom-cold-open';
  const segment = chapterOneLevel.segments.find((candidate) => candidate.id === segmentId);
  const spawn = chapterOneLevel.layers.checkpoint
    .find((entry) => entry.id === segment.checkpointId).spawn;
  // 시뮬 좌표계: player.position.y = 월드 z.
  return Object.freeze({ x: spawn.x, y: spawn.z });
}

// 첫 아레나가 이미 정리된 phase — 리스폰·재부팅 때 그 적들을 되살리지 않는다.
const ARENA_RESOLVED_PHASES = new Set([
  'memory-decision', 'memory-traced', 'memory-secure-ready',
  'pursuit', 'boss', 'post-boss', 'chapter-ending', 'complete'
]);

export function isChapterOneArenaResolved(phase) {
  return ARENA_RESOLVED_PHASES.has(phase);
}

// 보스 격파 직후 저장(PATCH 미선택) — 재부팅 시 승리 상태의 보스로 복원해야 하는 체크포인트.
export const CHAPTER_ONE_POST_BOSS_CHECKPOINTS = Object.freeze([
  'chapter-1:boss-defeated', 'chapter-1:signature-revealed'
]);
