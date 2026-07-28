function assertArray(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} 목록이 필요합니다.`);
}

function assertEarlier(triggerOrder, triggerId, prerequisiteId) {
  if (!triggerOrder.has(prerequisiteId)) {
    throw new RangeError(`존재하지 않는 선행 트리거입니다: ${prerequisiteId}`);
  }
  if (triggerOrder.get(prerequisiteId) >= triggerOrder.get(triggerId)) {
    throw new RangeError(`불가능한 선행 순서입니다: ${triggerId}`);
  }
}

export function validateStoryContent(story) {
  if (!story || typeof story !== 'object') throw new TypeError('스토리 데이터가 필요합니다.');
  assertArray(story.beats, '비트');
  assertArray(story.evidence, '증거');
  assertArray(story.exclusiveTriggerGroups, '배타 트리거');
  assertArray(story.revealRules, '공개 규칙');

  const triggerIds = story.beats.map((beat) => beat.triggerId);
  if (new Set(triggerIds).size !== triggerIds.length) {
    throw new RangeError('중복 트리거가 있습니다.');
  }
  const evidenceIds = story.evidence.map((record) => record.id);
  if (new Set(evidenceIds).size !== evidenceIds.length) {
    throw new RangeError('중복 증거가 있습니다.');
  }
  const evidenceSet = new Set(evidenceIds);
  const triggerOrder = new Map(story.beats.map((beat) => [beat.triggerId, beat.order]));

  for (const beat of story.beats) {
    assertArray(beat.requiresAll, `${beat.triggerId} 선행`);
    assertArray(beat.requiresAny, `${beat.triggerId} 선택 선행`);
    assertArray(beat.radio, `${beat.triggerId} 무전`);
    for (const prerequisiteId of [...beat.requiresAll, ...beat.requiresAny]) {
      assertEarlier(triggerOrder, beat.triggerId, prerequisiteId);
    }
    if (beat.evidenceId && !evidenceSet.has(beat.evidenceId)) {
      throw new RangeError(`등록되지 않은 증거입니다: ${beat.evidenceId}`);
    }
    for (const group of story.exclusiveTriggerGroups) {
      const requiredCount = beat.requiresAll.filter((id) => group.includes(id)).length;
      if (requiredCount > 1) throw new RangeError(`${beat.triggerId}에 동시에 충족할 수 없는 조건이 있습니다.`);
    }
    for (const line of beat.radio) {
      if (typeof line.textKo !== 'string' || Array.from(line.textKo).length > story.budgets.maxCharacters) {
        throw new RangeError(`${beat.triggerId} 무전 길이가 예산을 넘습니다.`);
      }
      if (!Number.isInteger(line.durationMs)
        || line.durationMs < story.budgets.minDurationMs
        || line.durationMs > story.budgets.maxDurationMs) {
        throw new RangeError(`${beat.triggerId} 무전 시간이 예산을 넘습니다.`);
      }
      if (line.interruptible !== true) throw new RangeError(`${beat.triggerId} 무전은 중단 가능해야 합니다.`);
    }
  }

  for (const evidenceId of evidenceIds) {
    if (!story.beats.some((beat) => beat.evidenceId === evidenceId)) {
      throw new RangeError(`사용되지 않은 증거입니다: ${evidenceId}`);
    }
  }
  for (const rule of story.revealRules) {
    const revealBeat = story.beats.find((beat) => beat.revealId === rule.id);
    if (!revealBeat || !revealBeat.requiresAll.includes(rule.afterTriggerId)) {
      throw new RangeError(`${rule.id} 공개 순서가 보장되지 않습니다.`);
    }
    for (const beat of story.beats) {
      if (beat.order >= revealBeat.order) continue;
      const leaked = beat.radio.some((line) => rule.protectedPhrases.some((phrase) => line.textKo.includes(phrase)));
      if (leaked) throw new RangeError(`${rule.id} 공개 순서보다 이른 대사가 있습니다.`);
    }
  }
  return story;
}
