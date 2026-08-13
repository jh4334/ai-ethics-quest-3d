import { ENEMY_DATA, EVIDENCE_DATA, FIXED_WORLD } from './actionContent.js';
import { createInputState } from './actionInput.js';

export { serializeActionGame } from './actionSave.js';

export const ACTION_EVIDENCE = Object.freeze(EVIDENCE_DATA.map((item) => Object.freeze({ ...item })));

function createEvidence(savedIds) {
  return EVIDENCE_DATA.map((item) => ({ ...item, collected: savedIds.has(item.id) }));
}

function createEnemies(savedIds) {
  return ENEMY_DATA.map((item) => {
    const evidence = EVIDENCE_DATA.find(({ enemyId }) => enemyId === item.id);
    const defeated = evidence ? savedIds.has(evidence.id) : false;
    return {
      ...item,
      hp: defeated ? 0 : 2,
      defeated,
      attackCooldown: 0,
      hitFlash: 0
    };
  });
}

export function createActionGameState(saved = {}) {
  const savedIds = new Set(Array.isArray(saved.evidenceIds) ? saved.evidenceIds : []);
  const collectedEvidence = EVIDENCE_DATA.filter(({ id }) => savedIds.has(id)).map(({ id }) => id);
  const checkpointX = Number.isFinite(saved.checkpointX) ? saved.checkpointX : 150;
  const complete = saved.completed === true;
  return {
    version: 2,
    phase: complete ? 'complete' : 'playing',
    outcome: complete ? 'protected' : null,
    time: 0,
    world: { ...FIXED_WORLD },
    player: {
      x: Math.max(100, Math.min(FIXED_WORLD.width - 100, checkpointX)),
      y: FIXED_WORLD.groundY,
      vx: 0,
      vy: 0,
      hp: 3,
      maxHp: 3,
      facing: 1,
      onGround: true,
      attackCooldown: 0,
      attackTimer: 0,
      invulnerable: 0
    },
    evidence: createEvidence(savedIds),
    collectedEvidence,
    enemies: createEnemies(savedIds),
    boss: {
      id: 'whiteout',
      x: 5570,
      hp: complete ? 0 : 5,
      maxHp: 5,
      active: !complete && collectedEvidence.length === EVIDENCE_DATA.length,
      staggered: complete,
      attackCooldown: 1.2,
      hitFlash: 0
    },
    projectiles: [],
    checkpointX,
    message: complete
      ? '하루의 기록은 가려서 보호했고, 원본은 하루의 확인을 기다리고 있어.'
      : '도트: 하루가 남긴 네 개의 감사 증거를 찾아줘. 황금 발자국을 따라가자.',
    messageKind: complete ? 'complete' : 'guide',
    currentZone: '출석 기록길',
    previousInput: createInputState(),
    cameraX: 0,
    respawns: 0,
    lastEvent: 'start'
  };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function updateZone(state) {
  const x = state.player.x;
  if (x < 1260) state.currentZone = '출석 기록길';
  else if (x < 2400) state.currentZone = '누락 판정교';
  else if (x < 3540) state.currentZone = '창작 기록탑';
  else if (x < 4800) state.currentZone = '합성 영상광장';
  else state.currentZone = 'WHITEOUT 말소실';
}

function hitPlayer(state, knockback) {
  const player = state.player;
  if (player.invulnerable > 0 || state.phase !== 'playing') return;
  player.hp -= 1;
  player.invulnerable = 0.9;
  player.vx = knockback;
  player.vy = -260;
  player.onGround = false;
  state.lastEvent = 'player-hit';
  if (player.hp > 0) {
    state.message = '도트: 괜찮아. 빛나기 직전에 피하거나 점프하면 돼.';
    state.messageKind = 'warning';
    return;
  }
  player.hp = player.maxHp;
  player.x = state.checkpointX;
  player.y = state.world.groundY;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.invulnerable = 1.2;
  state.projectiles.length = 0;
  state.respawns += 1;
  state.message = '도트: 회수한 증거는 안전해. 마지막 기록 지점에서 다시 시작하자.';
  state.messageKind = 'guide';
  state.lastEvent = 'respawn';
}

function damageTarget(target, amount) {
  target.hp = Math.max(0, target.hp - amount);
  target.hitFlash = 0.12;
}

function performAttack(state) {
  const player = state.player;
  if (player.attackCooldown > 0) return;
  player.attackCooldown = 0.22;
  player.attackTimer = 0.13;
  state.lastEvent = 'attack';

  const target = state.enemies.find((enemy) => {
    if (enemy.defeated) return false;
    const offset = enemy.x - player.x;
    return Math.abs(offset) <= 112 && (Math.sign(offset) === player.facing || Math.abs(offset) < 44);
  });
  if (target) {
    damageTarget(target, 1);
    if (target.hp === 0) {
      target.defeated = true;
      state.message = '도트: 말소 드론이 멈췄어. 가까운 증거를 TRACE 하자.';
      state.messageKind = 'guide';
      state.lastEvent = `defeat:${target.id}`;
    }
    return;
  }

  const boss = state.boss;
  if (!boss.active || boss.staggered || Math.abs(boss.x - player.x) > 152) return;
  const offset = boss.x - player.x;
  if (Math.sign(offset) !== player.facing && Math.abs(offset) >= 54) return;
  damageTarget(boss, 1);
  if (boss.hp === 0) {
    boss.staggered = true;
    state.projectiles.length = 0;
    state.message = 'WHITEOUT의 핵이 열렸어. 가까이 가서 TRACE로 맥락을 복구해!';
    state.messageKind = 'objective';
    state.lastEvent = 'boss-staggered';
  }
}

function performTrace(state) {
  const nextEvidence = state.evidence.find(({ collected }) => !collected);
  if (nextEvidence && Math.abs(nextEvidence.x - state.player.x) <= 118) {
    const guardian = state.enemies.find(({ id }) => id === nextEvidence.enemyId);
    if (!guardian?.defeated) {
      state.message = '도트: 말소 드론의 방해 신호를 먼저 멈춰야 원본을 읽을 수 있어.';
      state.messageKind = 'warning';
      state.lastEvent = 'trace-blocked';
      return;
    }
    nextEvidence.collected = true;
    state.collectedEvidence.push(nextEvidence.id);
    state.checkpointX = nextEvidence.checkpointX;
    state.message = `${nextEvidence.label} 증거 복구: ${nextEvidence.message}`;
    state.messageKind = 'evidence';
    state.lastEvent = `evidence:${nextEvidence.id}`;
    if (state.collectedEvidence.length === EVIDENCE_DATA.length) {
      state.boss.active = true;
      state.message += ' 이제 WHITEOUT 말소실로 가자.';
      state.messageKind = 'objective';
    }
    return;
  }

  if (state.boss.active && state.boss.staggered && Math.abs(state.boss.x - state.player.x) <= 178) {
    state.phase = 'complete';
    state.outcome = 'protected';
    state.message = '하루야, 네 기록을 함부로 공개하지 않을게. 개인정보를 가린 검증본을 만들고 네 확인을 기다릴게.';
    state.messageKind = 'complete';
    state.lastEvent = 'complete';
    return;
  }

  state.message = '도트: 호박색 원 안에서 TRACE를 사용해 줘.';
  state.messageKind = 'guide';
  state.lastEvent = 'trace-empty';
}

function updateEnemies(state, delta) {
  for (const enemy of state.enemies) {
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
    if (enemy.defeated || Math.abs(enemy.x - state.player.x) > 40 || enemy.attackCooldown > 0) continue;
    enemy.attackCooldown = 1.1;
    hitPlayer(state, state.player.x < enemy.x ? -250 : 250);
  }
}

function updateBoss(state, delta) {
  const boss = state.boss;
  boss.hitFlash = Math.max(0, boss.hitFlash - delta);
  if (!boss.active || boss.staggered || state.phase !== 'playing') return;
  boss.attackCooldown -= delta;
  if (boss.attackCooldown > 0 || Math.abs(boss.x - state.player.x) > 980) return;
  boss.attackCooldown = 1.45;
  state.projectiles.push({ x: boss.x - 74, y: state.world.groundY - 32, vx: -410, active: true });
  state.lastEvent = 'boss-wave';
}

function updateProjectiles(state, delta) {
  for (const projectile of state.projectiles) {
    if (!projectile.active) continue;
    projectile.x += projectile.vx * delta;
    if (projectile.x < state.boss.x - 1280) projectile.active = false;
    if (Math.abs(projectile.x - state.player.x) > 42 || Math.abs(projectile.y - state.player.y) > 54) continue;
    projectile.active = false;
    hitPlayer(state, -310);
  }
  state.projectiles = state.projectiles.filter(({ active }) => active);
}

export function stepActionGame(state, input, deltaSeconds) {
  if (!state || !input || state.phase !== 'playing') return state;
  const delta = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 1 / 60, 0, 1 / 30);
  const player = state.player;
  const pressed = {
    jump: input.jump && !state.previousInput.jump,
    attack: input.attack && !state.previousInput.attack,
    trace: input.trace && !state.previousInput.trace
  };

  state.time += delta;
  player.attackCooldown = Math.max(0, player.attackCooldown - delta);
  player.attackTimer = Math.max(0, player.attackTimer - delta);
  player.invulnerable = Math.max(0, player.invulnerable - delta);

  const direction = Number(input.right) - Number(input.left);
  if (direction !== 0) player.facing = direction;
  player.vx = direction * state.world.moveSpeed;
  if (pressed.jump && player.onGround) {
    player.vy = -state.world.jumpSpeed;
    player.onGround = false;
    state.lastEvent = 'jump';
  }
  if (pressed.attack) performAttack(state);
  if (pressed.trace) performTrace(state);

  player.vy += state.world.gravity * delta;
  player.x = clamp(player.x + player.vx * delta, 78, state.world.width - 78);
  player.y += player.vy * delta;
  if (player.y >= state.world.groundY) {
    player.y = state.world.groundY;
    player.vy = 0;
    player.onGround = true;
  }

  updateEnemies(state, delta);
  updateBoss(state, delta);
  updateProjectiles(state, delta);
  updateZone(state);
  state.cameraX = clamp(state.player.x - 430, 0, state.world.width - 1280);
  state.previousInput = { ...input };
  return state;
}
