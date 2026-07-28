function frozenArray(values) {
  return Object.freeze([...(values ?? [])]);
}

export function freezeBossState(value) {
  return Object.freeze({
    ...value,
    knowledge: frozenArray(value.knowledge),
    processedActionIds: frozenArray(value.processedActionIds)
  });
}

export function patchBossState(state, changes) {
  return freezeBossState({ ...state, ...changes });
}

export function freezeBossEvents(events) {
  return Object.freeze(events.map((event) => Object.freeze({ ...event })));
}
