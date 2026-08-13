const CONTROL_ACTIONS = Object.freeze({
  ArrowLeft: 'left',
  KeyA: 'left',
  'touch-left': 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  'touch-right': 'right',
  Space: 'jump',
  'touch-jump': 'jump',
  KeyJ: 'attack',
  'touch-attack': 'attack',
  KeyE: 'trace',
  'touch-trace': 'trace'
});

export function createInputState() {
  return { left: false, right: false, jump: false, attack: false, trace: false };
}

export function mapControlAction(control) {
  return CONTROL_ACTIONS[control] ?? null;
}

export function setInputAction(input, action, active) {
  if (action && Object.hasOwn(input, action)) input[action] = Boolean(active);
  return input;
}
