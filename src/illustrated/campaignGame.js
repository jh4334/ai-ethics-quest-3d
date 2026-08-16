import { CAMPAIGN_CHAPTERS, CAMPAIGN_WORLD, ORIGINAL_TOPIC_ORDER } from './campaignContent.js';
import { stepCampaignCombat } from './campaignCombat.js';
import { CAMPAIGN_MECHANICS } from './campaignMechanics.js';
import { getCampaignEnding, getCampaignReport, resolveChapterDecision } from './campaignProgress.js';
import {
  migrateSave,
  normalizeChapterIndex,
  SAVE_VERSION,
  serializeCampaignState
} from './campaignSave.js';
import { resetChapterRuntime } from './campaignState.js';

export { CAMPAIGN_CHAPTERS, CAMPAIGN_WORLD, CAMPAIGN_MECHANICS };
export const ACTION_EVIDENCE = ORIGINAL_TOPIC_ORDER;

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

export function stepActionGame(state, input, deltaSeconds, cameraTargetX = 360) {
  return stepCampaignCombat(state, input, deltaSeconds, cameraTargetX);
}

export function resolveChapterChoice(state, choiceId) {
  return resolveChapterDecision(state, choiceId);
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
  return serializeCampaignState(state);
}

export { getCampaignEnding, getCampaignReport };
