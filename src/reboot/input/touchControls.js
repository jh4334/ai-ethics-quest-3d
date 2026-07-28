const MOVE_ACTIONS = Object.freeze(['move-left', 'move-right', 'move-up', 'move-down']);

export function directionFromStick(dx, dy, deadZone = 12) {
  const threshold = Number.isFinite(deadZone) ? Math.max(0, deadZone) : 12;
  return Object.freeze({
    horizontal: Math.abs(dx) <= threshold ? 0 : Math.sign(dx),
    vertical: Math.abs(dy) <= threshold ? 0 : Math.sign(dy)
  });
}

export function createTouchControls({ input, root }) {
  const stick = root?.querySelector?.('[data-touch-stick]') ?? null;
  const knob = root?.querySelector?.('[data-touch-stick-knob]') ?? null;
  const buttons = [...(root?.querySelectorAll?.('[data-touch-action]') ?? [])];
  const cleanups = [];
  let attached = false;
  let pointerId = null;

  function setDirection(direction) {
    input.setActive('move-left', direction.horizontal < 0);
    input.setActive('move-right', direction.horizontal > 0);
    input.setActive('move-up', direction.vertical < 0);
    input.setActive('move-down', direction.vertical > 0);
  }

  function releaseStick() {
    pointerId = null;
    setDirection({ horizontal: 0, vertical: 0 });
    if (knob) knob.style.transform = 'translate(0px, 0px)';
  }

  function moveStick(event) {
    if (pointerId !== event.pointerId) return;
    const rect = stick.getBoundingClientRect();
    const dx = Math.max(-42, Math.min(42, event.clientX - (rect.left + rect.width / 2)));
    const dy = Math.max(-42, Math.min(42, event.clientY - (rect.top + rect.height / 2)));
    setDirection(directionFromStick(dx, dy));
    if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;
    event.preventDefault();
  }

  function listen(target, type, listener) {
    target.addEventListener(type, listener);
    cleanups.push(() => target.removeEventListener(type, listener));
  }

  return Object.freeze({
    attach() {
      if (attached) return;
      attached = true;
      if (stick) {
        listen(stick, 'pointerdown', (event) => {
          pointerId = event.pointerId;
          stick.setPointerCapture?.(event.pointerId);
          moveStick(event);
        });
        listen(stick, 'pointermove', moveStick);
        listen(stick, 'pointerup', releaseStick);
        listen(stick, 'pointercancel', releaseStick);
      }
      for (const button of buttons) {
        const action = button.dataset.touchAction;
        const press = (event) => { event.preventDefault(); input.setActive(action, true); };
        const release = (event) => { event.preventDefault(); input.setActive(action, false); };
        listen(button, 'pointerdown', press);
        listen(button, 'pointerup', release);
        listen(button, 'pointercancel', release);
        listen(button, 'pointerleave', release);
      }
    },
    detach() {
      if (!attached) return;
      attached = false;
      while (cleanups.length > 0) cleanups.pop()();
      releaseStick();
      for (const action of MOVE_ACTIONS) input.setActive(action, false);
      for (const button of buttons) input.setActive(button.dataset.touchAction, false);
    },
    getDebugState() {
      return Object.freeze({ attached, buttonCount: buttons.length, hasStick: stick !== null, pointerActive: pointerId !== null });
    }
  });
}
