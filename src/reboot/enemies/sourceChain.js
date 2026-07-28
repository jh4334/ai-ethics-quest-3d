function freezeChain(chain) {
  return Object.freeze({
    ...chain,
    members: Object.freeze(chain.members.map((member) => Object.freeze({ ...member })))
  });
}

export function createSourceChain({ maxCopies = 3, sourceId } = {}) {
  if (typeof sourceId !== 'string' || !Number.isInteger(maxCopies) || maxCopies < 1 || maxCopies > 8) {
    throw new RangeError('복사본 원본 ID와 1~8의 복제 상한이 필요합니다.');
  }
  return freezeChain({
    maxCopies,
    members: [{ hp: 100, id: sourceId, source: true }],
    nextCopy: 1,
    sourceId,
    traced: false
  });
}

export function applySourceAction(current, action) {
  if (!current || !Array.isArray(current.members) || !action || typeof action.type !== 'string') {
    throw new TypeError('공유 사슬 상태와 행동이 필요합니다.');
  }
  if (action.type === 'trace' && action.targetId === current.sourceId) {
    return Object.freeze({
      event: Object.freeze({ targetId: action.targetId, type: 'source-traced' }),
      state: freezeChain({ ...current, traced: true })
    });
  }
  if (action.type === 'blade' && action.targetId === current.sourceId && current.traced) {
    const damage = Number.isFinite(action.damage) ? Math.max(0, action.damage) : 0;
    const members = current.members.map((member) => member.id === current.sourceId
      ? { ...member, hp: Math.max(0, member.hp - damage) }
      : member);
    return Object.freeze({
      event: Object.freeze({ damage, targetId: action.targetId, type: 'source-damaged' }),
      state: freezeChain({ ...current, members })
    });
  }
  if (action.type === 'blade' && current.members.length < current.maxCopies) {
    const copyId = `${current.sourceId}-copy-${current.nextCopy}`;
    return Object.freeze({
      event: Object.freeze({ copyId, type: 'copy-spawned' }),
      state: freezeChain({
        ...current,
        members: [...current.members, { hp: 40, id: copyId, source: false }],
        nextCopy: current.nextCopy + 1
      })
    });
  }
  return Object.freeze({
    event: Object.freeze({ type: 'source-action-ignored' }),
    state: current
  });
}
