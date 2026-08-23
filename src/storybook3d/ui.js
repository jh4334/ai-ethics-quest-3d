import { canAdvanceSpread } from './state.js';
import { STORYBOOK_CHAPTERS, STORYBOOK_ENDING } from './content.js';

const SPREAD_NAMES = ['첫 번째 펼침면', '두 번째 펼침면', '세 번째 펼침면'];

function one(root, selector) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`3D 동화 UI가 없습니다: ${selector}`);
  return element;
}

export function createStorybookUi(root, handlers, { hasSave = false } = {}) {
  const titleScreen = one(root, '[data-title-screen]');
  const readingUi = one(root, '[data-reading-ui]');
  const endingScreen = one(root, '[data-ending-screen]');
  const fallback = one(root, '[data-webgl-fallback]');
  const rail = one(root, '[data-chapter-rail]');
  const clueLayer = one(root, '[data-clue-layer]');
  const choicePanel = one(root, '[data-choice-panel]');
  const choiceList = one(root, '[data-choice-list]');
  const choiceResult = one(root, '[data-choice-result]');
  const previousButton = one(root, '[data-previous-page]');
  const nextButton = one(root, '[data-next-page]');
  const helpDialog = one(root, '[data-help-dialog]');
  const liveStatus = one(root, '[data-live-status]');

  STORYBOOK_CHAPTERS.forEach((chapter, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(index + 1);
    button.setAttribute('aria-label', `${index + 1}장 ${chapter.title}`);
    button.addEventListener('click', () => handlers.selectChapter(index));
    item.append(button);
    rail.append(item);
  });

  one(root, '[data-new-book]').addEventListener('click', handlers.newBook);
  const continueButton = one(root, '[data-continue-book]');
  continueButton.disabled = !hasSave;
  continueButton.addEventListener('click', handlers.continueBook);
  previousButton.addEventListener('click', handlers.previousPage);
  nextButton.addEventListener('click', handlers.nextPage);
  one(root, '[data-help-open]').addEventListener('click', () => helpDialog.showModal());
  one(root, '[data-help-close]').addEventListener('click', () => helpDialog.close());
  one(root, '[data-print-report]').addEventListener('click', () => window.print());
  one(root, '[data-restart-book]').addEventListener('click', handlers.restartBook);

  function renderClues(state, chapter) {
    clueLayer.replaceChildren();
    if (state.spreadIndex !== 1) return;
    const found = state.discoveries[chapter.id];
    for (const [index, clue] of chapter.clues.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'clue-button';
      button.dataset.clueId = clue.id;
      button.dataset.discovered = String(found.includes(clue.id));
      button.setAttribute('aria-label', clue.label);
      const number = document.createElement('span');
      number.textContent = String(index + 1);
      button.append(number);
      button.addEventListener('click', () => handlers.inspectClue(clue.id));
      clueLayer.append(button);
    }
  }

  function renderChoices(state, chapter) {
    const visible = state.spreadIndex === 2;
    choicePanel.hidden = !visible;
    choiceList.replaceChildren();
    if (!visible) return;
    const decision = state.decisions[chapter.id];
    for (const choice of chapter.choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = choice.label;
      button.dataset.selected = String(decision?.choiceId === choice.id);
      button.addEventListener('click', () => handlers.choose(choice.id));
      choiceList.append(button);
    }
    choiceResult.hidden = !decision;
    if (decision) {
      one(root, '[data-choice-value]').textContent = decision.value;
      one(root, '[data-choice-cost]').textContent = decision.cost;
    }
  }

  function renderEnding(state) {
    one(root, '[data-ending-title]').textContent = STORYBOOK_ENDING.title;
    one(root, '[data-ending-text]').textContent = STORYBOOK_ENDING.text;
    const report = one(root, '[data-reading-report]');
    report.replaceChildren();
    for (const [index, chapter] of STORYBOOK_CHAPTERS.entries()) {
      const decision = state.decisions[chapter.id];
      const item = document.createElement('li');
      const title = document.createElement('strong');
      const detail = document.createElement('span');
      title.textContent = `${index + 1}장 · ${chapter.title}`;
      detail.textContent = decision ? `${decision.value} / 비용: ${decision.cost}` : '아직 고르지 않은 길';
      item.append(title, detail);
      report.append(item);
    }
  }

  function render(state) {
    const chapter = STORYBOOK_CHAPTERS[state.chapterIndex];
    const spread = chapter.spreads[state.spreadIndex];
    root.dataset.phase = state.phase;
    root.dataset.chapter = String(state.chapterIndex + 1);
    titleScreen.hidden = state.phase !== 'title';
    readingUi.hidden = state.phase !== 'reading';
    endingScreen.hidden = state.phase !== 'complete';
    one(root, '[data-hud-title]').textContent = chapter.title;

    [...rail.querySelectorAll('button')].forEach((button, index) => {
      button.disabled = index > state.unlockedChapter;
      button.dataset.state = index === state.chapterIndex ? 'current' : (state.decisions[STORYBOOK_CHAPTERS[index].id] ? 'complete' : 'locked');
    });
    if (state.phase === 'complete') renderEnding(state);
    if (state.phase !== 'reading') return;

    one(root, '[data-chapter-label]').textContent = `${state.chapterIndex + 1}장`;
    one(root, '[data-spread-label]').textContent = SPREAD_NAMES[state.spreadIndex];
    one(root, '[data-spread-title]').textContent = spread.title;
    one(root, '[data-spread-text]').textContent = spread.text;
    one(root, '[data-speaker]').textContent = spread.speaker;
    one(root, '[data-quote]').textContent = spread.quote;
    one(root, '[data-page-count]').textContent = `${state.chapterIndex * 3 + state.spreadIndex + 1} / 18`;
    const clueProgress = one(root, '[data-clue-progress]');
    clueProgress.hidden = state.spreadIndex !== 1;
    clueProgress.querySelector('b').textContent = `${state.discoveries[chapter.id].length} / ${chapter.clues.length}`;
    previousButton.disabled = state.chapterIndex === 0 && state.spreadIndex === 0;
    nextButton.disabled = !canAdvanceSpread(state);
    nextButton.firstChild.textContent = state.spreadIndex === 2 ? (state.chapterIndex === 5 ? '마지막 장 덮기 ' : '다음 장 ') : '다음 ';
    renderClues(state, chapter);
    renderChoices(state, chapter);
  }

  return Object.freeze({
    announce(message) {
      liveStatus.textContent = '';
      requestAnimationFrame(() => { liveStatus.textContent = message; });
    },
    render,
    setHint(level) { root.dataset.hintLevel = String(level); },
    showFallback(message) {
      fallback.hidden = false;
      fallback.querySelector('p:not(.eyebrow)').textContent = message;
      titleScreen.hidden = true;
      readingUi.hidden = true;
    },
    syncHotspots(positions) {
      const compact = clueLayer.clientWidth <= 760;
      const insetX = compact ? 108 : 48;
      const minY = compact ? 150 : 72;
      const maxY = compact
        ? Math.max(minY, clueLayer.clientHeight - 330)
        : Math.max(minY, clueLayer.clientHeight - 86);
      for (const position of positions) {
        const button = clueLayer.querySelector(`[data-clue-id="${position.id}"]`);
        if (!button) continue;
        button.style.left = `${Math.min(clueLayer.clientWidth - insetX, Math.max(insetX, position.x))}px`;
        button.style.top = `${Math.min(maxY, Math.max(minY, position.y))}px`;
        button.dataset.discovered = String(position.discovered);
      }
    }
  });
}
