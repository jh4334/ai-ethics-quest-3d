import { setChapterCheckpoint } from '../state/consequences.js';
import { buildProductShellModel } from './shellModel.js';

function settingValue(control) {
  return control.type === 'checkbox' ? control.checked : control.value;
}

export function createProductShell({ onStart, root, session, windowRef = window }) {
  const shell = root.querySelector('[data-product-shell]');
  const heading = shell?.querySelector('[data-shell-heading]');
  const panel = shell?.querySelector('[data-shell-panel]');
  if (!shell || !heading || !panel) throw new Error('제품 셸 UI가 필요합니다.');

  const chapterButtons = [...shell.querySelectorAll('[data-shell-chapter]')];
  const continueButton = shell.querySelector('[data-shell-continue]');
  const closePanelButton = shell.querySelector('[data-shell-panel-close]');
  const settingsControls = [...shell.querySelectorAll('[data-shell-setting]')];
  let previousFocus = null;

  function setPanel(nextPanel = null) {
    panel.hidden = nextPanel === null;
    for (const item of panel.querySelectorAll('[data-shell-panel-page]')) {
      item.hidden = item.dataset.shellPanelPage !== nextPanel;
    }
    if (nextPanel) panel.querySelector(`[data-shell-panel-page="${nextPanel}"] h2`)?.focus();
  }

  function render() {
    const state = session.getState();
    const model = buildProductShellModel(state);
    continueButton.hidden = !model.canContinue;
    for (const button of chapterButtons) {
      const chapter = model.chapters.find(({ chapter: value }) => value === Number(button.dataset.shellChapter));
      button.disabled = !chapter.selectable;
      button.dataset.state = chapter.state;
      button.setAttribute('aria-current', chapter.state === 'current' ? 'step' : 'false');
    }
    for (const control of settingsControls) {
      const value = state.settings[control.dataset.shellSetting];
      if (control.type === 'checkbox') control.checked = value;
      else control.value = value;
    }
  }

  function open() {
    previousFocus = windowRef.document.activeElement;
    root.dataset.shellOpen = 'true';
    shell.hidden = false;
    render();
    setPanel(null);
    heading.focus();
  }

  function start(sceneId) {
    root.dataset.shellOpen = 'false';
    shell.hidden = true;
    setPanel(null);
    onStart(sceneId);
  }

  shell.querySelector('[data-shell-new]')?.addEventListener('click', () => {
    const fresh = session.reset();
    start(buildProductShellModel(fresh).chapters[0].sceneId);
  });
  continueButton?.addEventListener('click', () => {
    const model = buildProductShellModel(session.getState());
    start(model.chapters.find(({ state }) => state === 'current').sceneId);
  });
  shell.querySelector('[data-shell-map-open]')?.addEventListener('click', () => setPanel('map'));
  shell.querySelector('[data-shell-settings-open]')?.addEventListener('click', () => setPanel('settings'));
  shell.querySelector('[data-shell-help-open]')?.addEventListener('click', () => setPanel('help'));
  closePanelButton?.addEventListener('click', () => setPanel(null));
  for (const button of chapterButtons) {
    button.addEventListener('click', () => {
      const model = buildProductShellModel(session.getState());
      const selection = model.chapters.find(({ chapter }) => chapter === Number(button.dataset.shellChapter));
      if (!selection?.selectable) return;
      session.update((state) => setChapterCheckpoint(state, selection.chapter, selection.checkpoint));
      start(selection.sceneId);
    });
  }
  for (const control of settingsControls) {
    control.addEventListener('change', () => {
      const key = control.dataset.shellSetting;
      session.update((state) => ({ ...state, settings: { ...state.settings, [key]: settingValue(control) } }));
      render();
    });
  }
  shell.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || panel.hidden) return;
    event.preventDefault();
    setPanel(null);
    previousFocus?.focus?.();
  });

  return Object.freeze({ open, render, start });
}
