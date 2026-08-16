import { createInputState } from './actionInput.js';
import { CAMPAIGN_CHAPTERS, CAMPAIGN_WORLD } from './campaignContent.js';
import { deriveCampaignModifiers, getChapterMechanics } from './campaignMechanics.js';
import { clamp, evidenceKey } from './campaignSave.js';

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
      hp: guarded?.collected ? 0 : 3,
      maxHp: 3,
      defeated: guarded?.collected === true,
      traced: false,
      attackCooldown: 0.4,
      hitFlash: 0
    };
  });
}

function createBoss(chapter, mechanics, decided, active) {
  const phaseHp = Math.ceil(chapter.boss.hp / mechanics.bossPhases.length);
  return {
    ...chapter.boss,
    phases: mechanics.bossPhases,
    maxHp: chapter.boss.hp,
    hp: decided ? 0 : chapter.boss.hp,
    phaseIndex: decided ? mechanics.bossPhases.length - 1 : 0,
    phaseHp: decided ? 0 : phaseHp,
    maxPhaseHp: phaseHp,
    active: decided || active,
    staggered: decided,
    traced: false,
    attackCooldown: chapter.boss.cadence,
    hitFlash: 0
  };
}

function createEthicsState(mechanics) {
  return {
    id: mechanics.id,
    status: '미확인',
    blindActions: 0,
    exposure: 0,
    reflections: 0,
    spread: 0,
    pairedSources: [],
    automaticApprovals: 0,
    chainProgress: 0,
    lesson: mechanics.lesson,
    transitionTimer: 0
  };
}

function createSafeguards(modifiers, chapterIndex) {
  return {
    privacyMask: chapterIndex === 1 && modifiers.includes('privacy-mask') ? 1 : 0,
    restrictedOriginal: chapterIndex === 1 && modifiers.includes('restricted-original'),
    originLabel: chapterIndex === 2 && modifiers.includes('origin-label'),
    spreadWarning: chapterIndex === 2 && modifiers.includes('spread-warning') ? 1 : 0,
    recoveryRoute: chapterIndex === 3 && modifiers.includes('recovery-route'),
    consentWindow: chapterIndex === 3 && modifiers.includes('consent-window') ? 1 : 0,
    pairedView: chapterIndex === 4 && modifiers.includes('paired-view'),
    recommendationAudit: chapterIndex === 4 && modifiers.includes('recommendation-audit'),
    reviewerPresent: chapterIndex === 5 && modifiers.includes('reviewer-present'),
    appealOpen: chapterIndex === 5 && modifiers.includes('appeal-open') ? 1 : 0
  };
}

export function resetChapterRuntime(state, chapterIndex, checkpointX = 150) {
  const chapter = CAMPAIGN_CHAPTERS[chapterIndex];
  const mechanics = getChapterMechanics(chapter.id);
  const evidence = createChapterEvidence(chapter, state.collectedEvidence);
  const decided = Boolean(state.decisions[chapter.id]);
  state.chapterIndex = chapterIndex;
  state.world = { ...CAMPAIGN_WORLD };
  state.player = {
    x: clamp(checkpointX, 100, CAMPAIGN_WORLD.width - 100),
    y: CAMPAIGN_WORLD.groundY,
    vx: 0,
    vy: 0,
    hp: 5,
    maxHp: 5,
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
  state.boss = createBoss(chapter, mechanics, decided, evidence.every(({ collected }) => collected));
  state.mechanics = mechanics;
  state.modifiers = deriveCampaignModifiers(state.decisions);
  state.safeguards = createSafeguards(state.modifiers, chapterIndex);
  if (state.safeguards.restrictedOriginal) state.enemies[0].traced = true;
  if (state.safeguards.recommendationAudit) state.boss.cadence += 0.35;
  state.ethics = createEthicsState(mechanics);
  state.projectiles = [];
  state.checkpointX = clamp(checkpointX, 100, CAMPAIGN_WORLD.width - 100);
  state.currentZone = chapter.zone;
  state.cameraX = 0;
  state.previousInput = createInputState();
  state.phase = decided ? 'chapter-result' : 'playing';
  state.message = decided
    ? chapter.choice.options.find(({ id }) => id === state.decisions[chapter.id])?.consequence ?? '이 장의 결정이 기록됐다.'
    : `${chapter.intro.at(-1).line} ${mechanics.tracePrompt}`;
  state.messageKind = decided ? 'complete' : 'guide';
  state.lastEvent = `chapter:${chapter.id}`;
}
