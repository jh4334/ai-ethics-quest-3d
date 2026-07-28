export const FIXED_HZ = 60;

function action(definition) {
  const totalTicks = definition.startupTicks + definition.activeTicks + definition.recoveryTicks;
  return Object.freeze({ ...definition, totalTicks });
}

export const ACTIONS = Object.freeze({
  attack1: action({
    startupTicks: 3, activeTicks: 2, recoveryTicks: 5, bufferTicks: 3,
    range: 1.8, facingDot: 0.45, damage: 12, stagger: 2,
    cancelInto: Object.freeze(['dash', 'reflect'])
  }),
  attack2: action({
    startupTicks: 3, activeTicks: 2, recoveryTicks: 6, bufferTicks: 3,
    range: 1.95, facingDot: 0.35, damage: 16, stagger: 3,
    cancelInto: Object.freeze(['dash', 'reflect'])
  }),
  attack3: action({
    startupTicks: 4, activeTicks: 3, recoveryTicks: 7, bufferTicks: 3,
    range: 2.15, facingDot: 0.2, damage: 24, stagger: 5,
    cancelInto: Object.freeze(['dash', 'reflect'])
  }),
  dash: action({
    startupTicks: 1, activeTicks: 6, recoveryTicks: 4, bufferTicks: 2,
    speed: 0.38, cooldownTicks: 18, cancelInto: Object.freeze([])
  }),
  reflect: action({
    startupTicks: 2, activeTicks: 4, recoveryTicks: 3, bufferTicks: 2,
    perfectStart: 3, perfectEnd: 4, range: 3.2, facingDot: 0.25,
    cooldownTicks: 18, cancelInto: Object.freeze([])
  }),
  trace: action({
    startupTicks: 6, activeTicks: 1, recoveryTicks: 7, bufferTicks: 3,
    range: 5, facingDot: -0.2, cooldownTicks: 20,
    cancelInto: Object.freeze(['cancel', 'dash'])
  }),
  secure: action({
    startupTicks: 3, activeTicks: 1, recoveryTicks: 4, bufferTicks: 2,
    range: 5, facingDot: -0.2, cooldownTicks: 12,
    cancelInto: Object.freeze(['cancel', 'dash'])
  }),
  stagger: action({
    startupTicks: 0, activeTicks: 6, recoveryTicks: 0, bufferTicks: 0,
    cancelInto: Object.freeze([])
  }),
  defeat: action({
    startupTicks: 0, activeTicks: 1, recoveryTicks: 0, bufferTicks: 0,
    cancelInto: Object.freeze([])
  })
});

export const PLAYER_RULES = Object.freeze({
  maxHp: 100,
  movePerTick: 0.1,
  inputBufferTicks: 8,
  contactMemoryTicks: 120,
  maxContactMemory: 256,
  comboGraceTicks: 8,
  chainThresholds: Object.freeze([1, 3, 6])
});
