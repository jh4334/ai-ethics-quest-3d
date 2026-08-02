// 2~4장 방 전투 웨이브 — 순수 로직(THREE 무의존, node 테스트 대상).
// 동사 단계 = 웨이브: 웨이브 i의 적을 전멸시키면 다음 웨이브가 저작 상수 위치에 스폰되고,
// 마지막 웨이브 전멸 시 결정 단계(F/Q)로 진입한다. 스폰·전진 전부 결정적 상수만 쓴다.

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

// 방 전투 기준점 — 씬의 결정 링(0, -23)과 동일한 월드 좌표.
export const ROOM_ENCOUNTER_ORIGIN = deepFreeze({ x: 0, z: -23 });
// 플레이어 시작(리스폰 체크포인트) — 링 남쪽 6m, 전투 리시 반경(12) 안.
export const ROOM_START_POSITION = deepFreeze({ x: 0, y: -17 });
// 진입·리스폰 그레이스 — 웨이브 런타임이 새로 심긴 뒤 90틱(1.5초) 동안 적 지각을 잠근다.
// 방 입장 즉시 피격(HP 100 미만 진입)과 리스폰 지점 캠핑 데스루프를 함께 막는다(결정적 틱 기준).
export const ROOM_ENTRY_GRACE_TICKS = 90;

function spawn(definitionId, id, x, z) {
  return { definitionId, facing: 0, id, position: { x, z }, zoneId: 'arena' };
}

// 방 전투 공통 규칙 — zoneMode 'room'은 리시 존 동결을 끄고 방 walkable 전체를 교전 구역으로 삼는다
// (경계 밖 한 걸음에서 적이 굳는 무저항 처치 악용 방지). entryGraceTicks는 위 그레이스 상수.
function roomWave(wave) {
  return { ...wave, entryGraceTicks: ROOM_ENTRY_GRACE_TICKS, zoneMode: 'room' };
}

// 장별 웨이브 구성 — 스폰 위치는 방 원점 기준 상대 좌표(저작 상수).
// 스폰은 플레이어 시작점(월드 0,-17)에서 10유닛 이상 북쪽(z -4.6 이하)에 둬서, 그레이스가 끝나도
// 적 획득 반경(9~10) 밖에서 대기하다가 플레이어가 다가가야 교전이 열리게 한다(리스폰 캠핑 방지).
// 2장: 복제자 3웨이브(1·1·2), 3장: 추천자 중심(1·1·2), 4장: 승인관 중심(1·혼성·2).
const ROOM_WAVE_TABLE = deepFreeze({
  2: [
    roomWave({
      id: 'ch2-wave1-first-copy',
      objective: '첫 복사본과 마주 서서 공유 명령을 되짚기',
      spawns: [spawn('copycat', 'ch2-w1-copycat-a', 0, -5)]
    }),
    roomWave({
      id: 'ch2-wave2-return-path',
      objective: '되돌아온 복사본에서 최초 업로드 시각 추적',
      spawns: [spawn('copycat', 'ch2-w2-copycat-a', -2.4, -4.6)]
    }),
    roomWave({
      id: 'ch2-wave3-chain-cut',
      objective: '남은 복사본 두 기를 끊고 사슬 종료',
      spawns: [
        spawn('copycat', 'ch2-w3-copycat-a', 2.6, -4.8),
        spawn('copycat', 'ch2-w3-copycat-b', -2.6, -5.6)
      ]
    })
  ],
  3: [
    roomWave({
      id: 'ch3-wave1-comfort-layer',
      objective: '편한 현실의 추천자를 멈추고 정리 로그 읽기',
      spawns: [spawn('recommender', 'ch3-w1-recommender-a', 0, -5.4)]
    }),
    roomWave({
      id: 'ch3-wave2-verified-layer',
      objective: '검증 현실의 추천자에게서 실행 명령 번호 추적',
      spawns: [spawn('recommender', 'ch3-w2-recommender-a', 2.4, -5)]
    }),
    roomWave({
      id: 'ch3-wave3-layer-merge',
      objective: '두 현실을 가르는 추천자 둘을 겹쳐 깨기',
      spawns: [
        spawn('recommender', 'ch3-w3-recommender-a', -2.6, -4.8),
        spawn('recommender', 'ch3-w3-recommender-b', 2.6, -4.8)
      ]
    })
  ],
  4: [
    roomWave({
      id: 'ch4-wave1-approval-gate',
      objective: '첫 승인관의 명령을 반사해 승인 창 되돌리기',
      spawns: [spawn('approval', 'ch4-w1-approval-a', 0, -5)]
    }),
    roomWave({
      id: 'ch4-wave2-pipeline-mix',
      objective: '승인 큐에 끼어든 복사본과 승인관에게서 기록 추적',
      spawns: [
        spawn('approval', 'ch4-w2-approval-a', -2.4, -4.8),
        spawn('copycat', 'ch4-w2-copycat-a', 2.4, -4.6)
      ]
    }),
    roomWave({
      id: 'ch4-wave3-policy-core',
      objective: '마지막 승인관 둘을 멈추고 승인 경로 중단',
      spawns: [
        spawn('approval', 'ch4-w3-approval-a', 2.2, -5.4),
        spawn('approval', 'ch4-w3-approval-b', -2.2, -5.4)
      ]
    })
  ]
});

export const ROOM_WAVES = ROOM_WAVE_TABLE;

function requireWaves(chapter) {
  const waves = ROOM_WAVE_TABLE[chapter];
  if (!waves) throw new RangeError('방 전투 웨이브는 2장부터 4장까지 지원합니다.');
  return waves;
}

export function getRoomWaveCount(chapter) {
  return requireWaves(chapter).length;
}

// encounterGameRuntime에 그대로 꽂을 수 있는 인카운터 정의를 돌려준다(항상 동일한 동결 객체).
export function getRoomWaveEncounter(chapter, waveIndex) {
  const waves = requireWaves(chapter);
  const wave = waves[waveIndex];
  if (!wave) throw new RangeError(`${chapter}장에는 웨이브 ${waveIndex}가 없습니다.`);
  return wave;
}

export function createRoomWaveProgress(chapter) {
  const total = getRoomWaveCount(chapter);
  return Object.freeze({ chapter, finished: false, total, waveIndex: 0 });
}

// 웨이브 전멸 판정 — 권위 상태(encounter.enemies)의 phase만 본다(빈 배열은 전멸이 아니다).
export function isRoomWaveCleared(enemies) {
  return Array.isArray(enemies)
    && enemies.length > 0
    && enemies.every((enemy) => enemy.phase === 'defeat');
}

// 웨이브 전멸 → 다음 웨이브 인덱스 또는 결정 단계(finished). 이미 끝난 진행은 전진할 수 없다.
export function advanceRoomWave(progress) {
  if (progress.finished) throw new RangeError('이미 결정 단계에 도달한 웨이브 진행입니다.');
  const nextIndex = progress.waveIndex + 1;
  return Object.freeze({
    chapter: progress.chapter,
    finished: nextIndex >= progress.total,
    total: progress.total,
    waveIndex: nextIndex
  });
}
