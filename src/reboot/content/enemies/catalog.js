function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const ERASER_DEFINITION = deepFreeze({
  id: 'eraser',
  role: 'melee-pressure',
  stats: { maxHp: 90, speed: 0.22, turnRadians: 0.32 },
  perception: { acquireRange: 8, lossRange: 10 },
  collider: { height: 1.8, radius: 0.62 },
  armor: { hits: 1, breaksOnKinds: ['reflected-projectile'] },
  reward: { id: 'eraser-armor-open', onceOn: 'armor-broken' },
  moves: [{
    id: 'eraser-sweep',
    kind: 'melee',
    socket: 'right-hand',
    timing: { activeTicks: 1, recoveryTicks: 18, windupTicks: 12 },
    range: { max: 1.8, min: 0, preferred: 1.2 },
    facingDot: 0.85,
    requiredFacingTicks: 2,
    damage: 12,
    feedback: {
      windup: 'eraser-sweep-windup',
      contact: 'eraser-sweep-contact',
      recover: 'eraser-sweep-recover'
    }
  }]
});

export const STAMPER_DEFINITION = deepFreeze({
  id: 'stamper',
  role: 'reflected-ranged-command',
  stats: { maxHp: 55, speed: 0.16, turnRadians: 0.25 },
  perception: { acquireRange: 11, lossRange: 13 },
  collider: { height: 1.7, radius: 0.55 },
  armor: { hits: 0, breaksOnKinds: [] },
  reward: { id: 'stamper-command-ended', onceOn: 'defeat' },
  moves: [{
    id: 'stamper-shot',
    kind: 'projectile',
    socket: 'stamp-muzzle',
    timing: { activeTicks: 1, recoveryTicks: 24, windupTicks: 42 },
    range: { max: 9, min: 3, preferred: 6 },
    facingDot: 0.9,
    requiredFacingTicks: 3,
    damage: 10,
    projectile: { radius: 0.28, reflectable: true, speed: 0.34 },
    feedback: {
      windup: 'stamper-shot-windup',
      contact: 'stamper-shot-launch',
      recover: 'stamper-shot-recover'
    }
  }]
});

export const ENEMY_DEFINITIONS = deepFreeze({
  eraser: ERASER_DEFINITION,
  stamper: STAMPER_DEFINITION
});
