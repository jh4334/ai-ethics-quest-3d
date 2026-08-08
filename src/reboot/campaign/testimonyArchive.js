function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function spawn(definitionId, id, x, z) {
  return { definitionId, facing: 0, id, position: { x, z }, zoneId: 'arena' };
}

function encounter(id, objective, spawns) {
  return { entryGraceTicks: 72, id, objective, spawns, zoneMode: 'room' };
}

export const TESTIMONY_ZONES = deepFreeze([
  {
    anchorZ: -2,
    clueAction: 'trace',
    clueKo: 'E 추적으로 증언 원본과 실행 로그의 출처 표식을 맞추세요.',
    encounter: encounter('testimony-intake-raid', '증언 접수 단말을 지우개에게서 되찾기', [
      spawn('eraser', 'archive-intake-eraser', 0, -3.8)
    ]),
    id: 'testimony-intake',
    landmarkId: 'witness-source-terminal',
    titleKo: '증언 접수실'
  },
  {
    anchorZ: -22,
    clueAction: 'reflect',
    clueKo: 'K 반사로 동의 범위를 벗어난 복사 승인 명령을 되돌리세요.',
    encounter: encounter('consent-redaction-breach', '무단 복사 승인관의 방어를 반사로 열기', [
      spawn('approval', 'redaction-approval', -2.2, -2.6),
      spawn('stamper', 'redaction-stamper', 2.5, -3.4)
    ]),
    id: 'consent-redaction-lab',
    landmarkId: 'consent-mask-table',
    titleKo: '동의·가림 작업실'
  },
  {
    anchorZ: -46,
    clueAction: 'trace',
    clueKo: 'E 추적으로 이름·연락 표식을 가리고 사건 순서만 남기세요.',
    encounter: encounter('privacy-crosscheck-ambush', '개인 표식을 노리는 지우개와 복사본 정리', [
      spawn('eraser', 'privacy-eraser', -2.4, -2.8),
      spawn('copycat', 'privacy-copycat', 2.4, -3.2)
    ]),
    id: 'privacy-crosscheck',
    landmarkId: 'privacy-crosscheck-grid',
    titleKo: '개인정보 대조실'
  },
  {
    anchorZ: -71,
    clueAction: null,
    clueKo: '검증 패키지에 넣을 기록을 F 확보 또는 Q 소거로 결정하세요.',
    encounter: encounter('verification-vault-warden', '출처·동의·가림 표식을 지키며 금고 수호자 격파', [
      spawn('approval', 'vault-approval', -2.6, -2.4),
      spawn('eraser', 'vault-eraser', 2.6, -3.5)
    ]),
    id: 'verification-vault',
    landmarkId: 'verified-package-vault',
    titleKo: '검증 패키지 금고'
  }
]);

export function createTestimonyArchiveProgress() {
  return deepFreeze({ expectedAction: 'attack', phase: 'combat', zoneIndex: 0 });
}

export function getTestimonyEncounter(zoneIndex) {
  const zone = TESTIMONY_ZONES[zoneIndex];
  if (!zone) throw new RangeError(`증언 보관소 구역 ${zoneIndex}가 없습니다.`);
  return zone.encounter;
}

export function unlockedTestimonySegmentIds(progress) {
  return Object.freeze(TESTIMONY_ZONES.slice(0, progress.zoneIndex + 1).map(({ id }) => id));
}

export function testimonyArchiveCheckpoint(progress) {
  if (progress.phase === 'decision') return 'chapter-5:decision';
  const zone = TESTIMONY_ZONES[progress.zoneIndex];
  if (!zone) throw new TypeError('체크포인트를 만들 증언 보관소 구역이 없습니다.');
  return `chapter-5:${zone.id}${progress.phase === 'clue' ? ':clue' : ''}`;
}

export function restoreTestimonyArchiveProgress(checkpoint) {
  if (!checkpoint || checkpoint === 'chapter-5:start') return createTestimonyArchiveProgress();
  if (checkpoint === 'chapter-5:decision') {
    return deepFreeze({ expectedAction: 'decision', phase: 'decision', zoneIndex: TESTIMONY_ZONES.length - 1 });
  }
  const match = /^chapter-5:([a-z0-9-]+)(:clue)?$/.exec(checkpoint);
  const zoneIndex = match ? TESTIMONY_ZONES.findIndex(({ id }) => id === match[1]) : -1;
  if (zoneIndex < 0) return createTestimonyArchiveProgress();
  const clue = Boolean(match[2]);
  return deepFreeze({
    expectedAction: clue ? TESTIMONY_ZONES[zoneIndex].clueAction : 'attack',
    phase: clue ? 'clue' : 'combat',
    zoneIndex
  });
}

export function advanceTestimonyArchive(progress, action) {
  if (!progress || !TESTIMONY_ZONES[progress.zoneIndex]) {
    throw new TypeError('유효한 증언 보관소 진행 상태가 필요합니다.');
  }
  const zone = TESTIMONY_ZONES[progress.zoneIndex];
  if (progress.phase === 'combat') {
    if (action !== 'combat-cleared') return progress;
    return deepFreeze({
      expectedAction: zone.clueAction ?? 'decision',
      phase: zone.clueAction ? 'clue' : 'decision',
      zoneIndex: progress.zoneIndex
    });
  }
  if (progress.phase !== 'clue' || action !== zone.clueAction) return progress;
  return deepFreeze({ expectedAction: 'attack', phase: 'combat', zoneIndex: progress.zoneIndex + 1 });
}
