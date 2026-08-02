function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

// S6a 난이도 하향(초등 5–6 기준): 적 이동은 플레이어(0.1/틱)보다 느리거나 비슷하게,
// 윈드업은 길게(≥1/3초), 피해는 반으로 — '이동+공격+가끔 반사'만으로 1~2회 시도 내 클리어.
export const ERASER_DEFINITION = deepFreeze({
  id: 'eraser',
  role: 'melee-pressure',
  stats: { maxHp: 72, speed: 0.12, turnRadians: 0.32 },
  perception: { acquireRange: 8, lossRange: 10 },
  collider: { height: 1.8, radius: 0.62 },
  armor: { hits: 1, breaksOnKinds: ['reflected-projectile'] },
  reward: { id: 'eraser-armor-open', onceOn: 'armor-broken' },
  moves: [{
    id: 'eraser-sweep',
    kind: 'melee',
    socket: 'right-hand',
    timing: { activeTicks: 1, recoveryTicks: 30, windupTicks: 20 },
    range: { max: 1.8, min: 0, preferred: 1.2 },
    facingDot: 0.85,
    requiredFacingTicks: 2,
    damage: 7,
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
  // 도주 속도(0.08)는 플레이어(0.1)보다 느리다 — 벽 구석까지 몰지 않아도 따라잡힌다.
  stats: { maxHp: 48, speed: 0.08, turnRadians: 0.25 },
  perception: { acquireRange: 11, lossRange: 13 },
  collider: { height: 1.7, radius: 0.55 },
  armor: { hits: 0, breaksOnKinds: [] },
  reward: { id: 'stamper-command-ended', onceOn: 'defeat' },
  moves: [{
    id: 'stamper-shot',
    kind: 'projectile',
    socket: 'stamp-muzzle',
    timing: { activeTicks: 1, recoveryTicks: 36, windupTicks: 42 },
    range: { max: 9, min: 3, preferred: 6 },
    facingDot: 0.9,
    requiredFacingTicks: 3,
    damage: 6,
    projectile: { radius: 0.28, reflectable: true, speed: 0.34 },
    feedback: {
      windup: 'stamper-shot-windup',
      contact: 'stamper-shot-launch',
      recover: 'stamper-shot-recover'
    }
  }]
});

export const COPYCAT_DEFINITION = deepFreeze({
  id: 'copycat',
  role: 'multiplying-source-trap',
  stats: { maxHp: 60, speed: 0.18, turnRadians: 0.28 },
  perception: { acquireRange: 9, lossRange: 11 },
  collider: { height: 1.65, radius: 0.54 },
  armor: { hits: 0, breaksOnKinds: [] },
  reward: { id: 'copycat-source-found', onceOn: 'defeat' },
  moves: [{
    id: 'copycat-swipe',
    kind: 'melee',
    socket: 'source-hand',
    timing: { activeTicks: 1, recoveryTicks: 20, windupTicks: 16 },
    range: { max: 1.7, min: 0, preferred: 1.1 },
    facingDot: 0.82,
    requiredFacingTicks: 2,
    damage: 9,
    feedback: {
      windup: 'copycat-swipe-windup',
      contact: 'copycat-swipe-contact',
      recover: 'copycat-swipe-recover'
    }
  }]
});

export const RECOMMENDER_DEFINITION = deepFreeze({
  id: 'recommender',
  role: 'spatial-layer-split',
  stats: { maxHp: 70, speed: 0.14, turnRadians: 0.24 },
  perception: { acquireRange: 10, lossRange: 12 },
  collider: { height: 1.9, radius: 0.58 },
  armor: { hits: 0, breaksOnKinds: [] },
  reward: { id: 'recommender-route-open', onceOn: 'defeat' },
  moves: [{
    id: 'recommender-pulse',
    kind: 'control',
    socket: 'lens-core',
    timing: { activeTicks: 2, recoveryTicks: 26, windupTicks: 24 },
    range: { max: 6, min: 2, preferred: 4 },
    facingDot: 0.78,
    requiredFacingTicks: 3,
    damage: 8,
    feedback: {
      windup: 'recommender-pulse-windup',
      contact: 'recommender-pulse-contact',
      recover: 'recommender-pulse-recover'
    }
  }]
});

export const APPROVAL_DEFINITION = deepFreeze({
  id: 'approval',
  role: 'pipeline-support',
  stats: { maxHp: 80, speed: 0.16, turnRadians: 0.26 },
  perception: { acquireRange: 9, lossRange: 12 },
  collider: { height: 1.9, radius: 0.6 },
  armor: { hits: 1, breaksOnKinds: ['reflected-projectile'] },
  reward: { id: 'approval-window-reversed', onceOn: 'armor-broken' },
  moves: [{
    id: 'approval-command',
    kind: 'control',
    socket: 'approval-terminal',
    timing: { activeTicks: 2, recoveryTicks: 24, windupTicks: 22 },
    range: { max: 6.5, min: 1.5, preferred: 4.5 },
    facingDot: 0.8,
    requiredFacingTicks: 3,
    damage: 8,
    feedback: {
      windup: 'approval-command-windup',
      contact: 'approval-command-contact',
      recover: 'approval-command-recover'
    }
  }]
});

export const ENEMY_DEFINITIONS = deepFreeze({
  eraser: ERASER_DEFINITION,
  stamper: STAMPER_DEFINITION,
  copycat: COPYCAT_DEFINITION,
  recommender: RECOMMENDER_DEFINITION,
  approval: APPROVAL_DEFINITION
});
