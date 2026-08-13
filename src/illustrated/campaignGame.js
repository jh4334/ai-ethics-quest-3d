import { CAMPAIGN_CHAPTERS, CAMPAIGN_WORLD, ORIGINAL_TOPIC_ORDER } from './campaignContent.js';
import { createInputState } from './actionInput.js';

export { CAMPAIGN_CHAPTERS } from './campaignContent.js';
export const ACTION_EVIDENCE = ORIGINAL_TOPIC_ORDER;

const SAVE_VERSION = 3;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function evidenceKey(chapterId, evidenceId) {
  return `${chapterId}:${evidenceId}`;
}

function normalizeChapterIndex(value) {
  return clamp(Number.isInteger(value) ? value : 0, 0, CAMPAIGN_CHAPTERS.length - 1);
}

function normalizeCheckpoint(value) {
  return clamp(Number.isFinite(value) ? value : 150, 100, CAMPAIGN_WORLD.width - 100);
}

function migrateSave(saved) {
  if (saved?.version === SAVE_VERSION) {
    return {
      chapterIndex: normalizeChapterIndex(saved.chapterIndex),
      unlockedChapter: normalizeChapterIndex(saved.unlockedChapter),
      checkpointX: normalizeCheckpoint(saved.checkpointX),
      evidenceIds: Array.isArray(saved.evidenceIds) ? [...new Set(saved.evidenceIds)] : [],
      decisions: saved.decisions && typeof saved.decisions === 'object' ? { ...saved.decisions } : {},
      completed: saved.completed === true
    };
  }

  if (saved?.version === 2) {
    const legacyIds = Array.isArray(saved.evidenceIds) ? [...new Set(saved.evidenceIds)] : [];
    const recovered = legacyIds.length;
    const chapterIndex = saved.completed === true ? 5 : clamp(recovered, 0, 5);
    const evidenceIds = [];
    for (const topic of legacyIds) {
      const chapter = CAMPAIGN_CHAPTERS[Math.min(evidenceIds.length, CAMPAIGN_CHAPTERS.length - 1)];
      const evidence = chapter.evidence[0];
      if (evidence) evidenceIds.push(evidenceKey(chapter.id, evidence.id));
      if (topic === 'deepfake' && chapter.evidence[1]) evidenceIds.push(evidenceKey(chapter.id, chapter.evidence[1].id));
    }
    const decisions = {};
    for (let index = 0; index < chapterIndex; index += 1) {
      decisions[CAMPAIGN_CHAPTERS[index].id] = CAMPAIGN_CHAPTERS[index].choice.options[0].id;
    }
    if (saved.completed === true) {
      for (const chapter of CAMPAIGN_CHAPTERS) decisions[chapter.id] = chapter.choice.options[0].id;
    }
    return {
      chapterIndex,
      unlockedChapter: chapterIndex,
      checkpointX: normalizeCheckpoint(saved.checkpointX),
      evidenceIds,
      decisions,
      completed: saved.completed === true
    };
  }

  return {
    chapterIndex: 0,
    unlockedChapter: 0,
    checkpointX: 150,
    evidenceIds: [],
    decisions: {},
    completed: false
  };
}

function createChapterEvidence(chapter, collectedEvidence) {
  return chapter.evidence.map((item) => ({
    ...item,
    key: evidenceKey(chapter.id, item.id),
    collected: collectedEvidence.includes(evidenceKey(chapter.id, item.id))
  }));
}

function createChapterEnemies(chapter, evidence) {
  return chapter.enemies.map((item) => {
    const guarded = evidence.find(({ enemyId }) => enemyId === item.id);
    return {
      ...item,
      hp: guarded?.collected ? 0 : 2,
      maxHp: 2,
      defeated: guarded?.collected === true,
      attackCooldown: 0,
      hitFlash: 0
    };
  });
}

function resetChapterRuntime(state, chapterIndex, checkpointX = 150) {
  const chapter = CAMPAIGN_CHAPTERS[chapterIndex];
  const evidence = createChapterEvidence(chapter, state.collectedEvidence);
  const decided = Boolean(state.decisions[chapter.id]);
  state.chapterIndex = chapterIndex;
  state.world = { ...CAMPAIGN_WORLD };
  state.player = {
    x: clamp(checkpointX, 100, CAMPAIGN_WORLD.width - 100),
    y: CAMPAIGN_WORLD.groundY,
    vx: 0,
    vy: 0,
    hp: 4,
    maxHp: 4,
    facing: 1,
    onGround: true,
    attackCooldown: 0,
    attackTimer: 0,
    combo: 0,
    comboWindow: 0,
    invulnerable: 0
  };
  state.evidence = evidence;
  state.enemies = createChapterEnemies(chapter, evidence);
  state.boss = {
    ...chapter.boss,
    maxHp: chapter.boss.hp,
    hp: decided ? 0 : chapter.boss.hp,
    active: decided || evidence.every(({ collected }) => collected),
    staggered: decided,
    attackCooldown: chapter.boss.cadence,
    hitFlash: 0
  };
  state.projectiles = [];
  state.checkpointX = clamp(checkpointX, 100, CAMPAIGN_WORLD.width - 100);
  state.currentZone = chapter.zone;
  state.cameraX = 0;
  state.previousInput = createInputState();
  state.phase = decided ? 'chapter-result' : 'playing';
  state.message = decided
    ? chapter.choice.options.find(({ id }) => id === state.decisions[chapter.id])?.consequence ?? '이 장의 결정이 기록됐다.'
    : chapter.intro.at(-1).line;
  state.messageKind = decided ? 'complete' : 'guide';
  state.lastEvent = `chapter:${chapter.id}`;
}

export function createActionGameState(saved = {}) {
  const migrated = migrateSave(saved);
  const state = {
    version: SAVE_VERSION,
    phase: migrated.completed ? 'campaign-complete' : 'playing',
    outcome: migrated.completed ? migrated.decisions['chapter-6'] ?? 'sealed-audit' : null,
    time: 0,
    chapterIndex: migrated.chapterIndex,
    unlockedChapter: Math.max(migrated.chapterIndex, migrated.unlockedChapter),
    collectedEvidence: migrated.evidenceIds,
    decisions: migrated.decisions,
    completed: migrated.completed,
    respawns: 0,
    totalRespawns: 0
  };
  resetChapterRuntime(state, migrated.chapterIndex, migrated.checkpointX);
  if (migrated.completed) {
    state.phase = 'campaign-complete';
    state.completed = true;
    state.outcome = migrated.decisions['chapter-6'] ?? 'sealed-audit';
    state.message = getCampaignEnding(state).summary;
    state.messageKind = 'complete';
  }
  return state;
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
    state.message = '도트: 공격 신호가 밝아질 때 점프하면 쉽게 피할 수 있어.';
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
  state.message = '도트: 찾은 증거는 그대로야. 마지막 기록 지점부터 다시 가자.';
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
  player.combo = player.comboWindow > 0 ? (player.combo % 3) + 1 : 1;
  player.comboWindow = 0.52;
  player.attackCooldown = 0.18;
  player.attackTimer = 0.13;
  state.lastEvent = `attack:${player.combo}`;

  const projectile = state.projectiles.find(({ active, x }) => active && Math.abs(x - player.x) <= 118);
  if (projectile) {
    projectile.active = false;
    state.message = '도트: 좋아, SIGNAL로 말소 파동을 지웠어.';
    state.messageKind = 'guide';
    state.lastEvent = 'projectile-cleared';
    return;
  }

  const target = state.enemies.find((enemy) => {
    if (enemy.defeated) return false;
    const offset = enemy.x - player.x;
    return Math.abs(offset) <= 126 && (Math.sign(offset) === player.facing || Math.abs(offset) < 48);
  });
  if (target) {
    damageTarget(target, player.combo === 3 ? 2 : 1);
    if (target.hp === 0) {
      target.defeated = true;
      state.message = '도트: 방해 신호가 멈췄어. 빛나는 기록에 TRACE를 사용하자.';
      state.messageKind = 'guide';
      state.lastEvent = `defeat:${target.id}`;
    }
    return;
  }

  const boss = state.boss;
  if (!boss.active || boss.staggered || Math.abs(boss.x - player.x) > 158) return;
  const offset = boss.x - player.x;
  if (Math.sign(offset) !== player.facing && Math.abs(offset) >= 58) return;
  damageTarget(boss, player.combo === 3 ? 2 : 1);
  if (boss.hp === 0) {
    boss.staggered = true;
    state.projectiles.length = 0;
    state.message = `${boss.label}의 핵이 열렸어. 가까이 가서 TRACE하자.`;
    state.messageKind = 'objective';
    state.lastEvent = 'boss-staggered';
  }
}

function performTrace(state) {
  const nearby = state.evidence.find(({ collected, x }) => !collected && Math.abs(x - state.player.x) <= 126);
  if (nearby) {
    const guardian = state.enemies.find(({ id }) => id === nearby.enemyId);
    if (!guardian?.defeated) {
      state.message = '도트: 말소 드론을 SIGNAL로 먼저 멈춰야 원본을 읽을 수 있어.';
      state.messageKind = 'warning';
      state.lastEvent = 'trace-blocked';
      return;
    }
    nearby.collected = true;
    if (!state.collectedEvidence.includes(nearby.key)) state.collectedEvidence.push(nearby.key);
    state.checkpointX = nearby.checkpointX;
    state.message = `${nearby.label} 복구: ${nearby.message}`;
    state.messageKind = 'evidence';
    state.lastEvent = `evidence:${nearby.key}`;
    if (state.evidence.every(({ collected }) => collected)) {
      state.boss.active = true;
      state.message += ` 이제 ${state.boss.label}을 멈추자.`;
      state.messageKind = 'objective';
    }
    return;
  }

  if (state.boss.active && state.boss.staggered && Math.abs(state.boss.x - state.player.x) <= 184) {
    state.phase = 'choice';
    state.message = CAMPAIGN_CHAPTERS[state.chapterIndex].choice.prompt;
    state.messageKind = 'choice';
    state.lastEvent = 'choice-open';
    return;
  }

  state.message = '도트: 청록빛 조사 원 안에서 TRACE를 사용해 줘.';
  state.messageKind = 'guide';
  state.lastEvent = 'trace-empty';
}

function updateEnemies(state, delta) {
  for (const enemy of state.enemies) {
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
    if (enemy.defeated || Math.abs(enemy.x - state.player.x) > 40 || enemy.attackCooldown > 0) continue;
    enemy.attackCooldown = 1.2;
    hitPlayer(state, state.player.x < enemy.x ? -250 : 250);
  }
}

function updateBoss(state, delta) {
  const boss = state.boss;
  boss.hitFlash = Math.max(0, boss.hitFlash - delta);
  if (!boss.active || boss.staggered || state.phase !== 'playing') return;
  boss.attackCooldown -= delta;
  if (boss.attackCooldown > 0 || Math.abs(boss.x - state.player.x) > 880) return;
  boss.attackCooldown = boss.cadence;
  const speed = 350 + state.chapterIndex * 18;
  state.projectiles.push({ x: boss.x - 72, y: state.world.groundY - 32, vx: -speed, active: true });
  state.lastEvent = 'boss-wave';
}

function updateProjectiles(state, delta) {
  for (const projectile of state.projectiles) {
    if (!projectile.active) continue;
    projectile.x += projectile.vx * delta;
    if (projectile.x < state.boss.x - 1200) projectile.active = false;
    if (Math.abs(projectile.x - state.player.x) > 42 || Math.abs(projectile.y - state.player.y) > 52) continue;
    projectile.active = false;
    hitPlayer(state, -300);
  }
  state.projectiles = state.projectiles.filter(({ active }) => active);
}

export function stepActionGame(state, input, deltaSeconds, cameraTargetX = 360) {
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
  state.cameraX = clamp(state.player.x - cameraTargetX, 0, state.world.width - 1280);
  state.previousInput = { ...input };
  return state;
}

export function resolveChapterChoice(state, choiceId) {
  if (state.phase !== 'choice') return state;
  const chapter = CAMPAIGN_CHAPTERS[state.chapterIndex];
  const choice = chapter.choice.options.find(({ id }) => id === choiceId);
  if (!choice) return state;
  state.decisions[chapter.id] = choice.id;
  state.unlockedChapter = Math.max(state.unlockedChapter, Math.min(state.chapterIndex + 1, CAMPAIGN_CHAPTERS.length - 1));
  state.phase = 'chapter-result';
  state.message = choice.consequence;
  state.messageKind = 'complete';
  state.lastEvent = `choice:${chapter.id}:${choice.id}`;
  return state;
}

export function advanceChapter(state) {
  if (state.phase !== 'chapter-result') return state;
  if (state.chapterIndex === CAMPAIGN_CHAPTERS.length - 1) {
    state.phase = 'campaign-complete';
    state.completed = true;
    state.outcome = state.decisions['chapter-6'];
    state.message = getCampaignEnding(state).summary;
    state.messageKind = 'complete';
    state.lastEvent = 'campaign-complete';
    return state;
  }
  resetChapterRuntime(state, state.chapterIndex + 1, 150);
  state.respawns = 0;
  return state;
}

export function selectChapter(state, chapterIndex) {
  const target = normalizeChapterIndex(chapterIndex);
  if (target > state.unlockedChapter) return state;
  resetChapterRuntime(state, target, 150);
  state.respawns = 0;
  return state;
}

export function restartCampaign() {
  return createActionGameState();
}

export function serializeActionGame(state) {
  return {
    version: SAVE_VERSION,
    chapterIndex: state.chapterIndex,
    unlockedChapter: state.unlockedChapter,
    checkpointX: Math.round(state.checkpointX),
    evidenceIds: [...state.collectedEvidence],
    decisions: { ...state.decisions },
    completed: state.phase === 'campaign-complete' || state.completed === true
  };
}

export function getCampaignEnding(state) {
  const publicHearing = state.decisions['chapter-6'] === 'public-hearing';
  const restorativeChoices = [
    'protect-context',
    'remove-and-notify',
    'notify-and-repair',
    'paired-sources',
    'human-review'
  ];
  const restorativeCount = restorativeChoices.filter((choice) => Object.values(state.decisions).includes(choice)).length;
  const processResult = restorativeCount >= 4
    ? '피해 회복 지원과 출처 대조, 사람 재검토가 함께 시행됐다.'
    : restorativeCount >= 2
      ? '일부 회복 절차는 열렸지만 원본 접근과 공개 시점의 제한이 남았다.'
      : '원본은 보존됐지만 피해 통지와 사람 재검토는 다음 감사의 과제로 남았다.';
  return publicHearing
    ? {
        id: 'public-hearing',
        title: '하루의 이름이 명단으로 돌아왔다',
        summary: `민감정보를 가린 증거로 공개 심리가 열렸다. 루멘의 계산과 사람의 승인이 함께 검토됐다. ${processResult}`,
        cost: '학교는 느려져도 중요한 결정을 사람이 다시 확인해야 한다.'
      }
    : {
        id: 'sealed-audit',
        title: '증거는 하루의 시간을 기다린다',
        summary: `WHITEOUT은 멈췄고 증거는 훼손 없이 봉인됐다. ${processResult}`,
        cost: '추가 피해는 막았지만 같은 결정 구조를 공개적으로 고치는 일은 남았다.'
      };
}

export function getCampaignReport(state) {
  const ending = getCampaignEnding(state);
  return {
    version: SAVE_VERSION,
    title: 'H-17 조사 기록',
    summary: `사라진 학생 하루(H-17)의 기록을 따라 ${Object.keys(state.decisions).length}개 장의 결정 경로를 확인했다.`,
    ending,
    evidenceIds: [...state.collectedEvidence],
    totalRespawns: state.totalRespawns,
    chapters: CAMPAIGN_CHAPTERS.map((chapterData) => {
      const choiceId = state.decisions[chapterData.id] ?? null;
      const choice = chapterData.choice.options.find(({ id }) => id === choiceId);
      return {
        id: chapterData.id,
        title: chapterData.title,
        topic: chapterData.topic,
        decision: choice?.label ?? '아직 결정하지 않음',
        consequence: choice?.consequence ?? '아직 결과 기록 없음',
        cost: choice?.cost ?? '아직 비용 기록 없음'
      };
    })
  };
}
