export const DEFAULT_BINDINGS = Object.freeze({
  ArrowDown: 'move-down',
  ArrowLeft: 'move-left',
  ArrowRight: 'move-right',
  ArrowUp: 'move-up',
  Escape: 'pause',
  KeyE: 'trace',
  KeyF: 'secure',
  KeyJ: 'attack',
  KeyK: 'reflect',
  KeyA: 'move-left',
  KeyD: 'move-right',
  KeyR: 'restart',
  KeyS: 'move-down',
  KeyW: 'move-up',
  Space: 'dash'
});

export function createInputRouter({ bindings = DEFAULT_BINDINGS, target }) {
  const active = new Set();
  const listeners = new Set();
  let attached = false;

  function emit(action, nextActive) {
    if (active.has(action) === nextActive) return;
    if (nextActive) active.add(action);
    else active.delete(action);
    const change = Object.freeze({ action, active: nextActive });
    for (const listener of listeners) listener(change);
  }

  function handleKeyDown(event) {
    const action = bindings[event.code];
    if (!action || event.repeat) return;
    event.preventDefault();
    emit(action, true);
  }

  function handleKeyUp(event) {
    const action = bindings[event.code];
    if (!action) return;
    event.preventDefault();
    emit(action, false);
  }

  return Object.freeze({
    attach() {
      if (attached) return;
      target.addEventListener('keydown', handleKeyDown);
      target.addEventListener('keyup', handleKeyUp);
      attached = true;
    },
    detach() {
      if (!attached) return;
      target.removeEventListener('keydown', handleKeyDown);
      target.removeEventListener('keyup', handleKeyUp);
      attached = false;
      for (const action of [...active]) emit(action, false);
    },
    isActive(action) {
      return active.has(action);
    },
    setActive(action, nextActive) {
      if (typeof action !== 'string') return;
      emit(action, nextActive === true);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  });
}
