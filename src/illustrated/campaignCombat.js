import { applyBlindEffect } from './campaignBlindEffects.js';
import { updateBossHazards, updateEnemyHazards, updateProjectiles } from './campaignHazards.js';
import { clamp } from './campaignSave.js';
import { performCampaignTrace } from './campaignTrace.js';

function setCombatMessage(state, message, kind, event) {
  state.message = message;
  state.messageKind = kind;
  state.lastEvent = event;
  state.ethics.transitionTimer = 0.24;
}

function hitPlayer(state, knockback) {
  const player = state.player;
  if (player.invulnerable > 0 || state.phase !== 'playing') return;
  player.hp -= 1;
  player.invulnerable = 1;
  player.vx = knockback;
  player.vy = -260;
  player.onGround = false;
  state.lastEvent = 'player-hit';
  if (player.hp > 0) {
    state.message = '도트: 공격 예고 문양을 보고 점프하거나, TRACE 가능한 신호인지 먼저 확인해.';
    state.messageKind = 'warning';
    return;
  }
  player.hp = player.maxHp;
  player.x = state.checkpointX;
  player.y = state.world.groundY;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.invulnerable = 1.4;
  state.projectiles.length = 0;
  state.respawns += 1;
  state.totalRespawns += 1;
  setCombatMessage(state, '도트: 찾은 근거는 유지돼. 마지막 기록 지점부터 패턴을 다시 읽자.', 'guide', 'respawn');
}

function damageTarget(target, amount) {
  target.hp = Math.max(0, target.hp - amount);
  target.hitFlash = 0.12;
}

function isSourcePairReady(state, target) {
  if (!target.pairId) return false;
  const pair = state.enemies.filter(({ pairId }) => pairId === target.pairId);
  return pair.length === 2 && pair.every(({ traced }) => traced);
}

function damageBossPhase(state, amount) {
  const boss = state.boss;
  const applied = Math.min(amount, boss.phaseHp);
  damageTarget(boss, applied);
  boss.phaseHp = Math.max(0, boss.phaseHp - applied);
  if (boss.phaseHp > 0) return;
  if (boss.phaseIndex < boss.phases.length - 1) {
    boss.phaseIndex += 1;
    boss.phaseHp = boss.maxPhaseHp;
    boss.traced = false;
    boss.attackCooldown = 0.45;
    const phase = boss.phases[boss.phaseIndex];
    state.ethics.status = `${boss.phaseIndex + 1}/3 단계 미확인`;
    setCombatMessage(state, `${phase.label} 단계: ${phase.instruction} TRACE로 확인해야 SIGNAL이 닿는다.`, 'objective', `boss-phase:${phase.id}`);
    return;
  }
  boss.hp = 0;
  boss.staggered = true;
  boss.traced = true;
  state.projectiles.length = 0;
  state.ethics.status = '책임 기록 개방';
  setCombatMessage(state, `${boss.label}의 책임 기록이 열렸다. 가까이에서 TRACE해 장의 결정을 남기자.`, 'objective', 'boss-staggered');
}

function attackProjectile(state, projectile) {
  if (projectile.kind === 'approval-stamp') {
    projectile.active = false;
    if (projectile.reviewed) {
      damageBossPhase(state, 1);
      setCombatMessage(state, '검토한 결재를 승인자에게 반송했다. 자동 결정이 한 단계 멈췄다.', 'evidence', 'reviewed-approval-returned');
    } else {
      state.ethics.blindActions += 1;
      state.ethics.automaticApprovals += 1;
      setCombatMessage(state, '검토 없이 도장을 부숴 자동 승인이 남았다. 먼저 TRACE해야 해.', 'warning', 'automatic-approval');
    }
    return;
  }
  projectile.active = false;
  setCombatMessage(state, projectile.kind === 'mirrored-signal'
    ? '되돌아온 SIGNAL을 겨우 상쇄했다. 다음 공격 전에는 제작 이력을 확인하자.'
    : 'SIGNAL로 위험 파동을 지웠다.', 'guide', 'projectile-cleared');
}

function performAttack(state) {
  const player = state.player;
  if (player.attackCooldown > 0) return;
  player.combo = player.comboWindow > 0 ? (player.combo % 3) + 1 : 1;
  player.comboWindow = 0.52;
  player.attackCooldown = 0.18;
  player.attackTimer = 0.13;

  const projectile = state.projectiles.find(({ active, x }) => active && Math.abs(x - player.x) <= 118);
  if (projectile) {
    attackProjectile(state, projectile);
    return;
  }

  const target = state.enemies.find((enemy) => {
    if (enemy.defeated) return false;
    const offset = enemy.x - player.x;
    return Math.abs(offset) <= 126 && (Math.sign(offset) === player.facing || Math.abs(offset) < 48);
  });
  if (target) {
    const ready = state.chapterIndex === 3 ? isSourcePairReady(state, target) : target.traced;
    if (!ready) {
      applyBlindEffect(state, target);
      return;
    }
    damageTarget(target, player.combo === 3 ? 2 : 1);
    state.lastEvent = `verified-hit:${target.id}`;
    if (target.hp === 0) {
      target.defeated = true;
      setCombatMessage(state, '확인한 근거로 방해 신호를 멈췄다. 빛나는 기록에 TRACE를 사용하자.', 'guide', `defeat:${target.id}`);
    }
    return;
  }

  const boss = state.boss;
  if (!boss.active || boss.staggered || Math.abs(boss.x - player.x) > 158) return;
  const offset = boss.x - player.x;
  if (Math.sign(offset) !== player.facing && Math.abs(offset) >= 58) return;
  if (state.chapterIndex === 4 || !boss.traced) {
    applyBlindEffect(state, boss);
    return;
  }
  damageBossPhase(state, player.combo === 3 ? 2 : 1);
}

export function stepCampaignCombat(state, input, deltaSeconds, cameraTargetX = 360) {
  if (!state || !input || state.phase !== 'playing') return state;
  const delta = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 1 / 60, 0, 1 / 30);
  const player = state.player;
  const pressed = {
    jump: input.jump && !state.previousInput.jump,
    attack: input.attack && !state.previousInput.attack,
    trace: input.trace && !state.previousInput.trace
  };
  state.time += delta;
  state.ethics.transitionTimer = Math.max(0, state.ethics.transitionTimer - delta);
  player.attackCooldown = Math.max(0, player.attackCooldown - delta);
  player.attackTimer = Math.max(0, player.attackTimer - delta);
  player.comboWindow = Math.max(0, player.comboWindow - delta);
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
  if (pressed.trace) performCampaignTrace(state);

  player.vy += state.world.gravity * delta;
  player.x = clamp(player.x + player.vx * delta, 78, state.world.width - 78);
  player.y += player.vy * delta;
  if (player.y >= state.world.groundY) {
    player.y = state.world.groundY;
    player.vy = 0;
    player.onGround = true;
  }
  updateEnemyHazards(state, delta, hitPlayer);
  updateBossHazards(state, delta);
  updateProjectiles(state, delta, hitPlayer);
  state.cameraX = clamp(state.player.x - cameraTargetX, 0, state.world.width - 1280);
  state.previousInput = { ...input };
  return state;
}
