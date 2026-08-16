import { CAMPAIGN_CHAPTERS, CAMPAIGN_WORLD } from './campaignContent.js';

export const SAVE_VERSION = 3;

export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function evidenceKey(chapterId, evidenceId) {
  return `${chapterId}:${evidenceId}`;
}

export function normalizeChapterIndex(value) {
  return clamp(Number.isInteger(value) ? value : 0, 0, CAMPAIGN_CHAPTERS.length - 1);
}

export function normalizeCheckpoint(value) {
  return clamp(Number.isFinite(value) ? value : 150, 100, CAMPAIGN_WORLD.width - 100);
}

export function migrateSave(saved) {
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
    const chapterIndex = saved.completed === true ? 5 : clamp(legacyIds.length, 0, 5);
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

export function serializeCampaignState(state) {
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
