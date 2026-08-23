import { getStorybookChapter, STORYBOOK_CHAPTERS } from './content.js';

export const STORYBOOK_SAVE_KEY = 'ethics-quest-storybook3d-v1';
export const STORYBOOK_SAVE_VERSION = 1;

function clampInteger(value, min, max) {
  const number = Number.isInteger(value) ? value : min;
  return Math.min(max, Math.max(min, number));
}

function cleanDiscoveries(source = {}) {
  return Object.fromEntries(STORYBOOK_CHAPTERS.map((chapter) => {
    const allowed = new Set(chapter.clues.map((clue) => clue.id));
    const values = Array.isArray(source[chapter.id]) ? source[chapter.id] : [];
    return [chapter.id, [...new Set(values.filter((id) => allowed.has(id)))]];
  }));
}

function cleanDecisions(source = {}) {
  const decisions = {};
  for (const chapter of STORYBOOK_CHAPTERS) {
    const selected = source[chapter.id];
    const choice = chapter.choices.find((candidate) => candidate.id === selected?.choiceId);
    if (choice) decisions[chapter.id] = { choiceId: choice.id, value: choice.value, cost: choice.cost };
  }
  return decisions;
}

function copyState(state, changes = {}) {
  return {
    ...state,
    discoveries: Object.fromEntries(Object.entries(state.discoveries).map(([id, values]) => [id, [...values]])),
    decisions: Object.fromEntries(Object.entries(state.decisions).map(([id, value]) => [id, { ...value }])),
    ...changes
  };
}

export function createStorybookState(saved = {}) {
  const chapterIndex = clampInteger(saved.chapterIndex, 0, STORYBOOK_CHAPTERS.length - 1);
  const completed = saved.completed === true;
  const phase = completed ? 'complete' : (saved.phase === 'reading' ? 'reading' : 'title');
  return {
    version: STORYBOOK_SAVE_VERSION,
    phase,
    chapterIndex,
    spreadIndex: clampInteger(saved.spreadIndex, 0, 2),
    unlockedChapter: Math.max(chapterIndex, clampInteger(saved.unlockedChapter, 0, STORYBOOK_CHAPTERS.length - 1)),
    discoveries: cleanDiscoveries(saved.discoveries),
    decisions: cleanDecisions(saved.decisions),
    completed
  };
}

export function startStorybook(state) {
  if (state.phase === 'complete') return state;
  return copyState(state, { phase: 'reading' });
}

export function inspectClue(state, clueId) {
  if (state.phase !== 'reading' || state.spreadIndex !== 1) return state;
  const chapter = getStorybookChapter(state.chapterIndex);
  if (!chapter.clues.some((clue) => clue.id === clueId)) return state;
  const current = state.discoveries[chapter.id];
  if (current.includes(clueId)) return state;
  const next = copyState(state);
  next.discoveries[chapter.id] = [...current, clueId];
  return next;
}

export function resolveStorybookChoice(state, choiceId) {
  if (state.phase !== 'reading' || state.spreadIndex !== 2) return state;
  const chapter = getStorybookChapter(state.chapterIndex);
  const choice = chapter.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) return state;
  const next = copyState(state);
  next.decisions[chapter.id] = { choiceId: choice.id, value: choice.value, cost: choice.cost };
  return next;
}

export function canAdvanceSpread(state) {
  if (state.phase !== 'reading') return false;
  const chapter = getStorybookChapter(state.chapterIndex);
  if (state.spreadIndex === 0) return true;
  if (state.spreadIndex === 1) return state.discoveries[chapter.id].length === chapter.clues.length;
  return Boolean(state.decisions[chapter.id]);
}

export function advanceSpread(state) {
  if (!canAdvanceSpread(state)) return state;
  if (state.spreadIndex < 2) return copyState(state, { spreadIndex: state.spreadIndex + 1 });
  if (state.chapterIndex === STORYBOOK_CHAPTERS.length - 1) {
    return copyState(state, { completed: true, phase: 'complete' });
  }
  const chapterIndex = state.chapterIndex + 1;
  return copyState(state, { chapterIndex, spreadIndex: 0, unlockedChapter: Math.max(state.unlockedChapter, chapterIndex) });
}

export function previousSpread(state) {
  if (state.phase !== 'reading') return state;
  if (state.spreadIndex > 0) return copyState(state, { spreadIndex: state.spreadIndex - 1 });
  if (state.chapterIndex === 0) return state;
  return copyState(state, { chapterIndex: state.chapterIndex - 1, spreadIndex: 2 });
}

export function selectStorybookChapter(state, index) {
  const chapterIndex = clampInteger(index, 0, STORYBOOK_CHAPTERS.length - 1);
  if (chapterIndex > state.unlockedChapter) return state;
  return copyState(state, { chapterIndex, spreadIndex: 0, phase: 'reading' });
}

export function serializeStorybookState(state) {
  return JSON.stringify(createStorybookState(state));
}

