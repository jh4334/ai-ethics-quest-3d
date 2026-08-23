import { getAdventureObjective } from './adventureGame.js';
import { STORYBOOK_CHAPTERS, STORYBOOK_ENDING } from './content.js';

function one(root, selector) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`3D 모험 UI가 없습니다: ${selector}`);
  return element;
}

function promptFor(adventure) {
  if (adventure.phase === 'choice') return '두 길은 서로 다른 것을 지킵니다. 얻는 것과 치르는 것을 함께 읽어 보세요.';
  if (adventure.lastEvent === 'gate-locked') return '두 흔적과 두 문양을 찾은 뒤 섬 중앙에서 기억 열쇠를 주우세요.';
  if (adventure.gateOpen) return 'J로 금빛 실을 휘두르고, 공격이 올 때 K로 거울잎을 드세요.';
  if (adventure.hasKey) return '북쪽 기록문 가까이에서 E를 누르세요.';
  if (adventure.puzzleSolved && adventure.clues.length === 2) return '섬 중앙의 금빛 열쇠 가까이에서 E를 누르세요.';
  return 'WASD로 움직이고 빛나는 대상 가까이에서 E를 누르세요.';
}

export function createStorybookUi(root, handlers, { hasSave = false } = {}) {
  const titleScreen = one(root, '[data-title-screen]');
  const readingUi = one(root, '[data-reading-ui]');
  const endingScreen = one(root, '[data-ending-screen]');
  const fallback = one(root, '[data-webgl-fallback]');
  const rail = one(root, '[data-chapter-rail]');
  const choicePanel = one(root, '[data-choice-panel]');
  const choiceList = one(root, '[data-choice-list]');
  const choiceResult = one(root, '[data-choice-result]');
  const continueChapter = one(root, '[data-continue-chapter]');
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
  continueChapter.addEventListener('click', handlers.continueChapter);
  one(root, '[data-help-open]').addEventListener('click', () => helpDialog.showModal());
  one(root, '[data-help-close]').addEventListener('click', () => helpDialog.close());
  one(root, '[data-print-report]').addEventListener('click', () => window.print());
  one(root, '[data-restart-book]').addEventListener('click', handlers.restartBook);

  function renderChoices(state, chapter) {
    const visible = state.adventure.phase === 'choice';
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
    continueChapter.hidden = !decision;
    continueChapter.textContent = state.chapterIndex === STORYBOOK_CHAPTERS.length - 1 ? '마지막 기록 남기기' : '다음 섬으로';
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
      detail.textContent = decision ? `${decision.value} / 치른 것: ${decision.cost}` : '아직 고르지 않은 길';
      item.append(title, detail);
      report.append(item);
    }
  }

  function render(state) {
    const chapter = STORYBOOK_CHAPTERS[state.chapterIndex];
    const adventure = state.adventure;
    root.dataset.phase = state.phase;
    root.dataset.chapter = String(state.chapterIndex + 1);
    root.dataset.adventurePhase = adventure.phase;
    titleScreen.hidden = state.phase !== 'title';
    readingUi.hidden = state.phase !== 'reading';
    endingScreen.hidden = state.phase !== 'complete';
    one(root, '[data-hud-title]').textContent = chapter.title;
    [...rail.querySelectorAll('button')].forEach((button, index) => {
      button.disabled = index > state.unlockedChapter;
      button.dataset.state = index === state.chapterIndex ? 'current' : (state.decisions[STORYBOOK_CHAPTERS[index].id] ? 'complete' : 'locked');
      if (index === state.chapterIndex) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    if (state.phase === 'complete') renderEnding(state);
    if (state.phase !== 'reading') return;
    one(root, '[data-chapter-label]').textContent = `${state.chapterIndex + 1}장`;
    one(root, '[data-objective]').textContent = getAdventureObjective(adventure);
    one(root, '[data-health]').textContent = `${'◆ '.repeat(adventure.player.health)}${'◇ '.repeat(adventure.player.maxHealth - adventure.player.health)}`.trim();
    one(root, '[data-health]').setAttribute('aria-label', `생명 불씨 ${adventure.player.health}개`);
    one(root, '[data-key-state]').textContent = adventure.hasKey ? '◆ 기억 열쇠 보유' : '◇ 기억 열쇠 없음';
    one(root, '[data-speaker]').textContent = adventure.phase === 'choice' ? chapter.spreads[2].speaker : '도트';
    one(root, '[data-story-text]').textContent = adventure.message;
    one(root, '[data-action-prompt]').textContent = promptFor(adventure);
    renderChoices(state, chapter);
  }

  return Object.freeze({
    announce(message) {
      liveStatus.textContent = '';
      requestAnimationFrame(() => { liveStatus.textContent = message; });
    },
    render,
    showFallback(message) {
      fallback.hidden = false;
      fallback.querySelector('p:not(.eyebrow)').textContent = message;
      titleScreen.hidden = true;
      readingUi.hidden = true;
    }
  });
}
