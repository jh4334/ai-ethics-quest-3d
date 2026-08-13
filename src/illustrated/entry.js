import referenceArtUrl from '../../docs/design/concepts/gameplay-screen-v3.webp?url';
import './style.css';

import { STORY_BEATS, advanceStory, resolveChoice } from './story.js';

const SAVE_KEY = 'ethics-quest-illustrated-v1';
const game = document.querySelector('[data-illustrated-game]');
const art = game.querySelector('[data-scene-art]');
const action = game.querySelector('[data-scene-action]');
const mobileAction = game.querySelector('[data-mobile-action]');
const storyCard = game.querySelector('[data-story-card]');
const speaker = game.querySelector('[data-story-speaker]');
const line = game.querySelector('[data-story-line]');
const choiceCard = game.querySelector('[data-choice-card]');
const helpButton = game.querySelector('[data-game-help]');
const helpDialog = game.querySelector('[data-help-dialog]');
const helpClose = game.querySelector('[data-help-close]');

let phase = 'idle';
let step = -1;
let lastOutcome = null;

function readSave() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    if (!parsed || !Number.isInteger(parsed.step)) return;
    step = Math.max(-1, Math.min(STORY_BEATS.length - 1, parsed.step));
    phase = ['idle', 'story', 'choice', 'complete', 'recovery'].includes(parsed.phase) ? parsed.phase : 'idle';
    lastOutcome = typeof parsed.outcome === 'string' ? parsed.outcome : null;
  } catch {
    localStorage.removeItem(SAVE_KEY);
  }
}

function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ outcome: lastOutcome, phase, step }));
}

function showLine(nextSpeaker, nextLine) {
  speaker.textContent = nextSpeaker;
  line.textContent = nextLine;
  storyCard.hidden = false;
}

function sync() {
  choiceCard.hidden = phase !== 'choice';
  action.disabled = phase === 'choice' || phase === 'complete';
  mobileAction.disabled = action.disabled;
  game.dataset.phase = phase;
  game.dataset.storyStep = String(step);
  storyCard.hidden = phase === 'idle';
  if (phase === 'story') showLine(STORY_BEATS[step].speaker, STORY_BEATS[step].line);
  if (phase === 'choice') showLine(STORY_BEATS.at(-1).speaker, STORY_BEATS.at(-1).line);
  if (phase === 'complete') {
    const result = resolveChoice('protect');
    showLine(result.speaker, result.line);
  }
  if (phase === 'recovery') {
    const result = resolveChoice('share');
    showLine(result.speaker, result.line);
  }
  save();
}

function handleAction() {
  if (phase === 'idle') {
    phase = 'story';
    step = 0;
    sync();
    return;
  }
  if (phase === 'recovery') {
    phase = 'choice';
    sync();
    return;
  }
  if (phase !== 'story') return;
  const next = advanceStory(step);
  phase = next.phase;
  step = next.step;
  sync();
}

function choose(choice) {
  const result = resolveChoice(choice);
  phase = result.phase;
  lastOutcome = result.outcome;
  choiceCard.hidden = true;
  showLine(result.speaker, result.line);
  action.disabled = phase === 'complete';
  mobileAction.disabled = action.disabled;
  game.dataset.phase = phase;
  save();
}

art.src = referenceArtUrl;
readSave();
sync();

action.addEventListener('click', handleAction);
mobileAction.addEventListener('click', handleAction);
choiceCard.addEventListener('click', (event) => {
  const button = event.target.closest('[data-choice]');
  if (button) choose(button.dataset.choice);
});
window.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyE' || event.repeat || helpDialog.open) return;
  event.preventDefault();
  handleAction();
});
helpButton.addEventListener('click', () => {
  helpDialog.showModal();
  helpButton.setAttribute('aria-expanded', 'true');
});
helpClose.addEventListener('click', () => helpDialog.close());
helpDialog.addEventListener('close', () => helpButton.setAttribute('aria-expanded', 'false'));
