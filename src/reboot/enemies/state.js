function frozenPoint(point) {
  return Object.freeze({ x: point.x, z: point.z });
}
export function freezeEnemyState(value) {
  return Object.freeze({
    ...value,
    position: frozenPoint(value.position),
    processedContacts: Object.freeze([...value.processedContacts]),
    spawn: Object.freeze({
      ...value.spawn,
      position: frozenPoint(value.spawn.position)
    })
  });
}

export function patchEnemyState(state, changes) {
  return freezeEnemyState({ ...state, ...changes });
}

export function freezeEvents(events) {
  return Object.freeze(events.map((event) => Object.freeze({ ...event })));
}
