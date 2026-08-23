import { getAdventureZone } from './adventureContent.js';

const MOVE_SPEED = 3.2;
const INTERACT_RANGE = 1.05;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function copyState(state) {
  return {
    ...state,
    player: { ...state.player },
    clues: [...state.clues],
    sigils: [...state.sigils],
    enemies: state.enemies.map((enemy) => ({ ...enemy })),
    boss: { ...state.boss }
  };
}

function cleanIds(values, allowed) {
  const source = Array.isArray(values) ? values : [];
  return [...new Set(source.filter((value) => allowed.has(value)))];
}

export function createAdventureState(chapterIndex = 0, saved = {}) {
  const zone = getAdventureZone(chapterIndex);
  const allowedClues = new Set(zone.clues.map((clue) => clue.id));
  const allowedSigils = new Set(['sigil-1', 'sigil-2']);
  const clues = cleanIds(saved.clues, allowedClues);
  const sigils = cleanIds(saved.sigils, allowedSigils);
  const puzzleSolved = sigils.length === 2;
  const hasKey = saved.hasKey === true;
  const gateOpen = hasKey && saved.gateOpen === true;
  const bossDefeated = gateOpen && saved.boss?.defeated === true;
  const health = clamp(Number.isFinite(saved.player?.health) ? saved.player.health : 5, 1, 5);
  return {
    chapterIndex,
    phase: bossDefeated || saved.phase === 'choice' ? 'choice' : 'explore',
    player: {
      x: clamp(Number.isFinite(saved.player?.x) ? saved.player.x : zone.start.x, zone.bounds.minX, zone.bounds.maxX),
      z: clamp(Number.isFinite(saved.player?.z) ? saved.player.z : zone.start.z, zone.bounds.minZ, zone.bounds.maxZ),
      facingX: Number.isFinite(saved.player?.facingX) ? saved.player.facingX : 0,
      facingZ: Number.isFinite(saved.player?.facingZ) ? saved.player.facingZ : -1,
      health,
      maxHealth: 5,
      invulnerability: 0
    },
    clues,
    sigils,
    puzzleSolved,
    hasKey,
    gateOpen,
    enemies: zone.enemies.map((enemy) => {
      const restored = saved.enemies?.find((candidate) => candidate.id === enemy.id);
      return { ...enemy, hp: clamp(restored?.hp ?? 3, 0, 3), defeated: restored?.defeated === true, attackCooldown: 0 };
    }),
    boss: {
      ...zone.boss,
      hp: bossDefeated ? 0 : clamp(saved.boss?.hp ?? 5, 0, 5),
      active: gateOpen && !bossDefeated,
      defeated: bossDefeated,
      attackCooldown: 0
    },
    attackCooldown: 0,
    attackPulse: 0,
    guarding: false,
    elapsed: 0,
    message: saved.message || '금빛 실을 따라 두 흔적을 찾아보자.',
    lastEvent: 'chapter-start'
  };
}

export function normalizeAdventureState(saved, chapterIndex = 0) {
  if (!saved || saved.chapterIndex !== chapterIndex) return createAdventureState(chapterIndex);
  return createAdventureState(chapterIndex, saved);
}

function isInFront(player, target) {
  const dx = target.x - player.x;
  const dz = target.z - player.z;
  const length = Math.hypot(dx, dz) || 1;
  return (dx / length) * player.facingX + (dz / length) * player.facingZ > 0.15;
}

function applyMovement(next, input, delta, zone) {
  let x = Number(Boolean(input.right)) - Number(Boolean(input.left));
  let z = Number(Boolean(input.down)) - Number(Boolean(input.up));
  const length = Math.hypot(x, z);
  if (!length) return;
  x /= length;
  z /= length;
  next.player.facingX = x;
  next.player.facingZ = z;
  const proposedX = clamp(next.player.x + x * MOVE_SPEED * delta, zone.bounds.minX, zone.bounds.maxX);
  const proposedZ = clamp(next.player.z + z * MOVE_SPEED * delta, zone.bounds.minZ, zone.bounds.maxZ);
  const blockedByGate = !next.gateOpen && proposedZ < -4.15 && Math.abs(proposedX) < 1.9;
  next.player.x = proposedX;
  next.player.z = blockedByGate ? Math.max(next.player.z, -4.15) : proposedZ;
}

function handleInteraction(next, zone) {
  for (const clue of zone.clues) {
    if (!next.clues.includes(clue.id) && distance(next.player, clue) <= INTERACT_RANGE) {
      next.clues.push(clue.id);
      next.message = clue.detail;
      next.lastEvent = `clue:${clue.id}`;
      return;
    }
  }
  for (const [index, sigil] of zone.sigils.entries()) {
    const id = `sigil-${index + 1}`;
    if (!next.sigils.includes(id) && distance(next.player, sigil) <= INTERACT_RANGE) {
      next.sigils.push(id);
      next.puzzleSolved = next.sigils.length === 2;
      next.message = next.puzzleSolved ? '두 기억 문양이 이어져 중앙에 열쇠가 나타났다.' : '첫 번째 기억 문양이 금빛으로 켜졌다.';
      next.lastEvent = `sigil:${id}`;
      return;
    }
  }
  if (!next.hasKey && next.puzzleSolved && next.clues.length === zone.clues.length && distance(next.player, zone.key) <= INTERACT_RANGE) {
    next.hasKey = true;
    next.message = '기억 열쇠를 찾았다. 북쪽 기록문으로 가자.';
    next.lastEvent = 'key-collected';
    return;
  }
  if (!next.gateOpen && distance(next.player, zone.gate) <= INTERACT_RANGE) {
    if (!next.hasKey) {
      next.message = '기록문이 잠겨 있다. 두 흔적과 두 문양 뒤의 열쇠가 필요하다.';
      next.lastEvent = 'gate-locked';
      return;
    }
    next.gateOpen = true;
    next.boss.active = true;
    next.boss.attackCooldown = 1.4;
    next.message = `${zone.boss}가 먹물 속에서 깨어났다.`;
    next.lastEvent = 'gate-opened';
    return;
  }
  next.message = '조금 더 가까이 가서 살펴보자.';
  next.lastEvent = 'nothing-nearby';
}

function damageNearby(next) {
  let hit = false;
  for (const enemy of next.enemies) {
    if (enemy.defeated || distance(next.player, enemy) > 1.35 || !isInFront(next.player, enemy)) continue;
    enemy.hp -= 1;
    enemy.defeated = enemy.hp <= 0;
    hit = true;
  }
  if (next.boss.active && !next.boss.defeated && distance(next.player, next.boss) <= 1.6 && isInFront(next.player, next.boss)) {
    next.boss.hp -= 1;
    next.boss.defeated = next.boss.hp <= 0;
    hit = true;
    if (next.boss.defeated) {
      next.boss.active = false;
      next.phase = 'choice';
      next.message = '먹물이 걷혔다. 이제 무엇을 남길지 고를 차례다.';
      next.lastEvent = 'boss-defeated';
    }
  }
  if (hit && next.lastEvent !== 'boss-defeated') {
    next.message = '금빛 실이 먹물의 매듭을 끊었다.';
    next.lastEvent = 'attack-hit';
  }
}

function enemyAttacks(next) {
  if (next.player.invulnerability > 0) return;
  const attackers = [...next.enemies.filter((enemy) => !enemy.defeated), ...(next.boss.active ? [next.boss] : [])];
  for (const enemy of attackers) {
    if (enemy.attackCooldown > 0 || distance(next.player, enemy) > (enemy === next.boss ? 1.45 : 0.7)) continue;
    enemy.attackCooldown = enemy === next.boss ? 1.2 : 0.9;
    if (next.guarding && isInFront(next.player, enemy)) {
      next.message = '거울잎이 정면의 먹물을 막았다.';
      next.lastEvent = 'guard-block';
    } else if (enemy !== next.boss && next.player.health === 1) {
      next.message = '작은 먹물은 마지막 생명 불씨까지 끌 수 없다.';
      next.lastEvent = 'last-light-protected';
    } else {
      next.player.health -= 1;
      next.player.invulnerability = 0.85;
      next.message = '먹물이 생명 불씨 하나를 흐리게 했다.';
      next.lastEvent = 'player-hit';
    }
  }
}

export function stepAdventure(state, input = {}, delta = 1 / 60) {
  if (state.phase !== 'explore') return state;
  const zone = getAdventureZone(state.chapterIndex);
  const next = copyState(state);
  next.elapsed += delta;
  next.attackCooldown = Math.max(0, next.attackCooldown - delta);
  next.attackPulse = Math.max(0, next.attackPulse - delta);
  next.player.invulnerability = Math.max(0, next.player.invulnerability - delta);
  next.guarding = Boolean(input.guard);
  for (const enemy of [...next.enemies, next.boss]) enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);
  applyMovement(next, input, delta, zone);
  if (input.interact) handleInteraction(next, zone);
  if (input.attack && next.attackCooldown <= 0) {
    next.attackCooldown = 0.36;
    next.attackPulse = 0.14;
    damageNearby(next);
  }
  enemyAttacks(next);
  if (next.player.health <= 0) {
    next.player = { ...next.player, ...zone.start, health: next.player.maxHealth, facingX: 0, facingZ: -1 };
    next.message = '등불 곁에서 다시 일어났다. 찾은 흔적과 문양은 그대로 남았다.';
    next.lastEvent = 'respawn';
  }
  return next;
}

export function getAdventureObjective(state) {
  const zone = getAdventureZone(state.chapterIndex);
  if (state.phase === 'choice') return '먹물이 걷혔다 · 남길 길을 고르자';
  if (state.clues.length < zone.clues.length) return `흔적 찾기 ${state.clues.length} / ${zone.clues.length}`;
  if (!state.puzzleSolved) return `기억 문양 켜기 ${state.sigils.length} / 2`;
  if (!state.hasKey) return '섬 중앙의 기억 열쇠 줍기';
  if (!state.gateOpen) return '북쪽 기록문 열기';
  return `${zone.boss} · 먹물 매듭 ${state.boss.hp} / 5`;
}
