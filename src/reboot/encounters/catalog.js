function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const SOLO_TUTORIAL = deepFreeze({
  id: 'stamper-reflect-tutorial',
  objective: '투사체를 반사해 명령의 출처를 되돌려 보내기',
  decision: '피할지, 읽고 반사할지 선택한다.',
  spawns: [{
    definitionId: 'stamper',
    facing: 0,
    id: 'stamper-tutorial',
    position: { x: 0, z: 0 },
    zoneId: 'arena'
  }]
});

export const MIXED_ARENA = deepFreeze({
  id: 'eraser-stamper-mixed-arena',
  objective: '스탬퍼의 투사체를 반사해 이레이저의 방어를 열기',
  decision: '근접 압박을 피하며 원거리 명령을 공격 기회로 바꾼다.',
  spawns: [{
    definitionId: 'eraser',
    facing: 0,
    id: 'eraser-mixed',
    position: { x: 1.5, z: 0 },
    zoneId: 'arena'
  }, {
    definitionId: 'stamper',
    facing: 0,
    id: 'stamper-mixed',
    position: { x: -2, z: 2 },
    zoneId: 'arena'
  }]
});

export const ENCOUNTERS = deepFreeze({
  mixedArena: MIXED_ARENA,
  soloTutorial: SOLO_TUTORIAL
});
