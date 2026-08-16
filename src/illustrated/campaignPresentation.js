import {
  CAMPAIGN_CHAPTERS,
  getCampaignEnding,
  getCampaignReport,
  resolveChapterChoice
} from './story.js';
import { getCampaignPrompt, getEthicsCostText } from './campaignPrompt.js';

export function createCampaignPresentation({ ui, getState, writeSave, resetInput, touchPrompts }) {
  let phase = 'title';
  let storyStep = 0;
  let lastEvent = getState().lastEvent;

  const currentChapter = () => CAMPAIGN_CHAPTERS[getState().chapterIndex];

  function updateChapterRail() {
    const state = getState();
    for (const button of ui.chapterButtons) {
      const index = Number(button.dataset.chapterButton);
      const complete = Boolean(state.decisions[CAMPAIGN_CHAPTERS[index].id]);
      button.disabled = index > state.unlockedChapter;
      button.classList.toggle('is-complete', complete);
      button.classList.toggle('is-current', index === state.chapterIndex);
      button.setAttribute('aria-current', index === state.chapterIndex ? 'step' : 'false');
      button.dataset.status = complete ? '완료' : button.disabled ? '잠김' : '진행 가능';
    }
  }

  function syncUi(forceAnnouncement = false) {
    const state = getState();
    const chapter = currentChapter();
    ui.game.dataset.gamePhase = phase;
    ui.game.dataset.chapter = String(chapter.number);
    ui.game.dataset.evidenceCount = String(state.evidence.filter(({ collected }) => collected).length);
    ui.game.dataset.playerX = String(Math.round(state.player.x));
    ui.game.dataset.cameraX = String(Math.round(state.cameraX));
    ui.game.dataset.playerScreenX = String(Math.round(state.player.x - state.cameraX));
    ui.game.dataset.bossHp = String(state.boss.hp);
    ui.game.dataset.bossPhase = String(state.boss.phaseIndex + 1);
    ui.game.dataset.ethicsStatus = state.ethics.status;
    ui.game.dataset.lastEvent = state.lastEvent;
    ui.chapterNumber.textContent = `${chapter.number}장`;
    ui.chapterTime.textContent = chapter.timecode;
    ui.chapterTopic.textContent = chapter.topic;
    ui.zone.textContent = state.currentZone;
    ui.health.setAttribute('aria-label', `기록 안정도 ${state.player.hp}`);
    ui.health.querySelector('span').textContent = `${state.player.hp} / ${state.player.maxHp}`;
    ui.mission.textContent = state.boss.active
      ? `${state.boss.label} 3단계의 근거와 책임을 복구하라`
      : chapter.mission;
    updateChapterRail();

    const nextPrompt = getCampaignPrompt(state, touchPrompts);
    ui.prompt.querySelector('kbd').textContent = nextPrompt.key;
    ui.prompt.querySelector('span').textContent = nextPrompt.line;
    ui.prompt.hidden = phase !== 'playing';
    ui.ethicsRule.hidden = phase !== 'playing';
    ui.ethicsState.textContent = `◇ ${state.ethics.status}`;
    ui.ethicsLesson.textContent = state.mechanics.lesson;
    ui.ethicsCost.textContent = getEthicsCostText(state.ethics);
    ui.ethicsRule.classList.toggle('is-warning', state.ethics.blindActions > 0);

    if (phase === 'playing' && state.phase === 'choice') showChoice();
    if (forceAnnouncement || state.lastEvent !== lastEvent) {
      ui.liveStatus.textContent = state.message;
      lastEvent = state.lastEvent;
      if (state.lastEvent.startsWith('evidence:') || state.lastEvent === 'respawn') writeSave();
    }
  }

  function hidePanels() {
    resetInput();
    ui.titleScreen.hidden = true;
    ui.storyPanel.hidden = true;
    ui.choicePanel.hidden = true;
    ui.resultPanel.hidden = true;
    ui.endingPanel.hidden = true;
  }

  function showTitle() {
    hidePanels();
    phase = 'title';
    ui.titleScreen.hidden = false;
    syncUi(true);
  }

  function showChapterIntro() {
    hidePanels();
    phase = 'intro';
    storyStep = 0;
    const beat = currentChapter().intro[storyStep];
    ui.storySpeaker.textContent = beat.speaker;
    ui.storyLine.textContent = beat.line;
    ui.storyPanel.hidden = false;
    syncUi(true);
  }

  function advanceStory() {
    if (phase !== 'intro') return false;
    storyStep += 1;
    const beat = currentChapter().intro[storyStep];
    if (!beat) {
      phase = 'playing';
      ui.storyPanel.hidden = true;
      getState().phase = 'playing';
      syncUi(true);
      return true;
    }
    ui.storySpeaker.textContent = beat.speaker;
    ui.storyLine.textContent = beat.line;
    return true;
  }

  function showChoice() {
    hidePanels();
    phase = 'choice';
    const chapter = currentChapter();
    ui.choicePrompt.textContent = chapter.choice.prompt;
    ui.choiceOptions.replaceChildren();
    for (const option of chapter.choice.options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.choice = option.id;
      const label = document.createElement('strong');
      label.textContent = option.label;
      const cost = document.createElement('span');
      cost.textContent = option.cost;
      button.append(label, cost);
      button.addEventListener('click', () => chooseOption(option.id));
      ui.choiceOptions.append(button);
    }
    ui.choicePanel.hidden = false;
    ui.choiceOptions.querySelector('button')?.focus();
    syncUi(true);
  }

  function chooseOption(choiceId) {
    resolveChapterChoice(getState(), choiceId);
    writeSave();
    showResult();
  }

  function showResult() {
    hidePanels();
    phase = 'result';
    const state = getState();
    const chapter = currentChapter();
    const choice = chapter.choice.options.find(({ id }) => id === state.decisions[chapter.id]);
    ui.resultKicker.textContent = `${chapter.number}장 기록 완료`;
    ui.resultTitle.textContent = choice?.label ?? chapter.title;
    ui.resultLine.textContent = choice?.consequence ?? state.message;
    ui.resultCost.textContent = `남은 비용: ${choice?.cost ?? '다음 조사에서 확인'}`;
    ui.nextChapterButton.textContent = chapter.number === CAMPAIGN_CHAPTERS.length ? '최종 기록 보기' : `${chapter.number + 1}장으로`;
    ui.resultPanel.hidden = false;
    syncUi(true);
  }

  function showEnding() {
    hidePanels();
    phase = 'complete';
    const state = getState();
    const ending = getCampaignEnding(state);
    const report = getCampaignReport(state);
    ui.endingTitle.textContent = ending.title;
    ui.endingLine.textContent = ending.summary;
    ui.endingCost.textContent = `남은 비용: ${ending.cost}`;
    ui.reportList.replaceChildren();
    for (const chapter of report.chapters) {
      const item = document.createElement('li');
      const heading = document.createElement('strong');
      heading.textContent = `${chapter.id.replace('chapter-', '')}장 · ${chapter.decision}`;
      const consequence = document.createElement('span');
      consequence.textContent = chapter.consequence;
      item.append(heading, consequence);
      ui.reportList.append(item);
    }
    ui.endingPanel.hidden = false;
    writeSave();
    syncUi(true);
  }

  return {
    advanceStory,
    chooseOption,
    getPhase: () => phase,
    resetEventCursor: () => { lastEvent = getState().lastEvent; },
    showChapterIntro,
    showEnding,
    showResult,
    showTitle,
    syncUi
  };
}
