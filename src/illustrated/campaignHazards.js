const ENEMY_PATTERNS = Object.freeze({
  'consent-claw': { kind: 'data-leak', cadence: 2.2, speed: 250, height: 26 },
  'bias-scanner': { kind: 'scanner-line', cadence: 1.8, speed: 330, height: 108 },
  'copycat-lens': { kind: 'copied-frame', cadence: 2.1, speed: 290, height: 38 },
  'forgery-mimic': { kind: 'fake-frame', cadence: 1.65, speed: 370, height: 126 },
  'echo-relay': { kind: 'echo-wave', cadence: 1.8, speed: 270, height: 38 },
  'reaction-swarm': { kind: 'reaction-burst', cadence: 1.45, speed: 350, height: 118 },
  'warm-bubble': { kind: 'warm-feed', cadence: 2.0, speed: 240, height: 36 },
  'cold-bubble': { kind: 'cold-feed', cadence: 1.55, speed: 390, height: 132 },
  'approval-stamp': { kind: 'approval-stamp', cadence: 1.75, speed: 255, height: 44, reviewable: true },
  'score-clerk': { kind: 'score-card', cadence: 1.4, speed: 360, height: 124 },
  'whiteout-shard': { kind: 'whiteout-shard', cadence: 1.35, speed: 410, height: 42 },
  'chain-scrambler': { kind: 'chain-fragment', cadence: 1.7, speed: 300, height: 138 }
});

const BOSS_PATTERNS = Object.freeze({
  'consent-sweep': [{ kind: 'consent-wave', speed: 315, height: 34 }],
  'bias-grid': [
    { kind: 'bias-low', speed: 340, height: 34 },
    { kind: 'bias-high', speed: 285, height: 154 }
  ],
  'delete-lock': [{ kind: 'delete-lock', speed: 470, height: 62 }],
  'copied-signal': [{ kind: 'mirrored-signal', speed: 390, height: 42 }],
  'deepfake-swap': [
    { kind: 'fake-frame', speed: 310, height: 48 },
    { kind: 'fake-frame', speed: 355, height: 146 }
  ],
  'credit-collapse': [{ kind: 'credit-shard', speed: 510, height: 92 }],
  'echo-pulse': [{ kind: 'echo-wave', speed: 285, height: 44 }],
  'recommend-rain': [
    { kind: 'reaction-burst', speed: 300, height: 36 },
    { kind: 'reaction-burst', speed: 340, height: 138 }
  ],
  'harm-wave': [{ kind: 'harm-wave', speed: 460, height: 78 }],
  'warm-wall': [{ kind: 'warm-feed', speed: 255, height: 44 }],
  'cold-wall': [{ kind: 'cold-feed', speed: 440, height: 146 }],
  'cross-check': [
    { kind: 'warm-feed', speed: 320, height: 40 },
    { kind: 'cold-feed', speed: 375, height: 142 }
  ],
  'model-stamp': [{ kind: 'approval-stamp', speed: 270, height: 46, reviewable: true }],
  'signature-barrage': [
    { kind: 'approval-stamp', speed: 290, height: 46, reviewable: true },
    { kind: 'approval-stamp', speed: 245, height: 146, reviewable: true }
  ],
  'appeal-clock': [{ kind: 'approval-stamp', speed: 390, height: 84, reviewable: true }],
  'score-fragments': [{ kind: 'score-fragment', speed: 340, height: 48 }],
  'approval-chain': [
    { kind: 'chain-fragment', speed: 335, height: 44 },
    { kind: 'chain-fragment', speed: 300, height: 150 }
  ],
  'whiteout-chain': [{ kind: 'whiteout-shard', speed: 520, height: 86 }]
});

function projectileFrom(sourceX, direction, groundY, pattern, owner) {
  return {
    x: sourceX + direction * 54,
    y: groundY - pattern.height,
    vx: direction * pattern.speed,
    active: true,
    owner,
    kind: pattern.kind,
    reviewable: pattern.reviewable === true,
    reviewed: false
  };
}

export function spawnMirroredSignal(state, sourceX) {
  const direction = state.player.x < sourceX ? -1 : 1;
  const projectile = projectileFrom(sourceX, direction, state.world.groundY, {
    kind: 'mirrored-signal',
    speed: 470,
    height: 42
  }, 'enemy');
  projectile.x = sourceX - direction * 160;
  state.projectiles.push(projectile);
}

export function spawnSpreadBurst(state, sourceX) {
  const direction = state.player.x < sourceX ? -1 : 1;
  const count = state.safeguards.originLabel ? 1 : Math.min(3, state.ethics.spread);
  for (let index = 0; index < count; index += 1) {
    const projectile = projectileFrom(sourceX, direction, state.world.groundY, {
      kind: 'echo-wave',
      speed: 265 + index * 55,
      height: 38 + index * 72
    }, 'enemy');
    projectile.x = sourceX + direction * (150 + index * 42);
    state.projectiles.push(projectile);
  }
}

export function updateEnemyHazards(state, delta, hitPlayer) {
  for (const enemy of state.enemies) {
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
    if (enemy.defeated) continue;
    const distance = Math.abs(enemy.x - state.player.x);
    if (distance <= 38 && enemy.attackCooldown <= 0) {
      enemy.attackCooldown = 1.1;
      hitPlayer(state, state.player.x < enemy.x ? -250 : 250);
      continue;
    }
    const pattern = ENEMY_PATTERNS[enemy.kind];
    if (!pattern || distance > 620 || enemy.attackCooldown > 0) continue;
    const direction = state.player.x < enemy.x ? -1 : 1;
    enemy.attackCooldown = pattern.cadence;
    state.projectiles.push(projectileFrom(enemy.x, direction, state.world.groundY, pattern, 'enemy'));
    state.lastEvent = `enemy-pattern:${enemy.kind}`;
  }
}

export function updateBossHazards(state, delta) {
  const boss = state.boss;
  boss.hitFlash = Math.max(0, boss.hitFlash - delta);
  if (!boss.active || boss.staggered || state.phase !== 'playing') return;
  boss.attackCooldown -= delta;
  if (boss.attackCooldown > 0 || Math.abs(boss.x - state.player.x) > 960) return;
  boss.attackCooldown = Math.max(0.72, boss.cadence - boss.phaseIndex * 0.12);
  const phase = boss.phases[boss.phaseIndex];
  const patterns = BOSS_PATTERNS[phase.pattern] ?? BOSS_PATTERNS['delete-lock'];
  const direction = state.player.x < boss.x ? -1 : 1;
  for (const pattern of patterns) {
    state.projectiles.push(projectileFrom(boss.x, direction, state.world.groundY, pattern, 'boss'));
  }
  state.lastEvent = `boss-pattern:${phase.pattern}`;
}

export function updateProjectiles(state, delta, hitPlayer) {
  for (const projectile of state.projectiles) {
    if (!projectile.active) continue;
    projectile.x += projectile.vx * delta;
    if (projectile.x < state.player.x - 1500 || projectile.x > state.player.x + 1500) projectile.active = false;
    if (!projectile.active || projectile.reviewed) continue;
    if (Math.abs(projectile.x - state.player.x) > 42 || Math.abs(projectile.y - state.player.y) > 58) continue;
    projectile.active = false;
    if (projectile.kind === 'approval-stamp') {
      state.ethics.automaticApprovals += 1;
      state.message = '자동 결재가 검토 없이 통과됐다. 다음 도장은 TRACE로 멈춰야 해.';
      state.messageKind = 'warning';
      state.lastEvent = 'automatic-approval-hit';
    }
    hitPlayer(state, projectile.vx < 0 ? -300 : 300);
  }
  state.projectiles = state.projectiles.filter(({ active }) => active);
}
