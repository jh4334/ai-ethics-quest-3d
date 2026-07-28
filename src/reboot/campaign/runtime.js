import { CHAPTERS_2_3, CHAPTERS_2_5 } from '../content/chapters/catalog.js';
import { deepFreeze, normalizeRebootState } from '../state/model.js';

function issue(code, chapterId = null) {
  return Object.freeze({ chapterId, code });
}

export function validateChapterDefinitions(definitions) {
  const errors = [];
  const ids = new Set();
  for (const chapter of Array.isArray(definitions) ? definitions : []) {
    if (typeof chapter?.id !== 'string') errors.push(issue('INVALID_ID'));
    if (ids.has(chapter?.id)) errors.push(issue('DUPLICATE_ID', chapter?.id));
    ids.add(chapter?.id);
    if (!chapter?.loop || chapter.loop.targetSeconds !== 30 || chapter.loop.steps?.length < 4) {
      errors.push(issue('INVALID_LOOP', chapter?.id));
    }
    if (!Array.isArray(chapter?.consequenceEchoes) || chapter.consequenceEchoes.length !== 2) {
      errors.push(issue('MISSING_ECHOES', chapter?.id));
    }
    if (!Array.isArray(chapter?.boss?.phases) || chapter.boss.phases.length < 3) {
      errors.push(issue('MISSING_BOSS', chapter?.id));
    }
    if (!chapter?.patchReward?.id || !chapter.patchReward.verb) errors.push(issue('MISSING_PATCH', chapter?.id));
    if (!Array.isArray(chapter?.reversal?.foreshadowIds) || chapter.reversal.foreshadowIds.length < 2) {
      errors.push(issue('MISSING_FORESHADOW', chapter?.id));
    }
    if (!(chapter?.timeline?.desktopMinutes >= 25 && chapter.timeline.desktopMinutes <= 35)
      || !(chapter?.timeline?.touchMinutes >= 25 && chapter.timeline.touchMinutes <= 35)
      || !(chapter?.timeline?.chapterSelectMinutes >= 25 && chapter.timeline.chapterSelectMinutes <= 35)) {
      errors.push(issue('INVALID_TIMELINE', chapter?.id));
    }
    if (!chapter?.carryover?.secure || !chapter?.carryover?.purge) {
      errors.push(issue('MISSING_CARRYOVER', chapter?.id));
    }
  }
  return Object.freeze({ errors: Object.freeze(errors), valid: errors.length === 0 });
}

validateChapterDefinitions(CHAPTERS_2_5);

function memoryAction(state) {
  return state.evidence.find((record) => record.evidenceId === 'haru-memory-backup')?.action ?? 'purge';
}

export function createCampaignRoute(seed) {
  const state = normalizeRebootState(seed);
  const action = memoryAction(state);
  const chapters = CHAPTERS_2_3.map((definition) => {
    const echo = definition.carryover[action];
    return deepFreeze({
      chapterId: definition.id,
      dialogueCue: echo.dialogueCue,
      encounterVariant: echo.encounterVariant,
      evidenceAccess: echo.evidenceAccess,
      playable: true,
      reversalId: definition.reversal.revealId
    });
  });
  return deepFreeze({
    chapters,
    seedAction: action,
    tradeoffs: {
      advantages: CHAPTERS_2_3.map((definition) => definition.carryover[action].advantage),
      costs: CHAPTERS_2_3.map((definition) => definition.carryover[action].cost)
    }
  });
}
