// 장면 무전 재생기 — 시나리오 v2의 대본 줄을 순차 자막으로 흘린다.
// schoolNightScene의 스토리 라디오와 같은 DOM(ui.radio)을 쓰되, 장면 전용 큐로 동작한다.
// 시간은 update(delta)로만 흐른다(결정적 — 타이머 0).

export function createSceneRadio(ui = {}) {
  let queue = [];
  let remainingMs = 0;

  function hide() {
    if (ui.radio) ui.radio.hidden = true;
  }

  function show(line) {
    if (!ui.radio) return;
    ui.radio.hidden = false;
    if (ui.radioSpeaker) ui.radioSpeaker.textContent = line.speaker;
    if (ui.radioText) ui.radioText.textContent = ` ${line.textKo}`;
  }

  function advance() {
    const next = queue.shift();
    if (!next) {
      hide();
      return;
    }
    remainingMs = Math.max(1200, Math.min(6200, next.durationMs ?? 3600));
    show(next);
  }

  return Object.freeze({
    clear() {
      queue = [];
      remainingMs = 0;
      hide();
    },
    getDebugState() {
      return Object.freeze({ playing: remainingMs > 0, queued: queue.length });
    },
    // interrupt: 행동에 대한 즉각 반응(동사 큐·반전 컷)은 재생 중인 줄을 끊고 바로 나온다.
    play(lines, { interrupt = false } = {}) {
      const safe = (Array.isArray(lines) ? lines : []).filter((line) => line?.textKo);
      if (safe.length === 0) return;
      if (interrupt) {
        queue = [...safe];
        remainingMs = 0;
        advance();
        return;
      }
      queue.push(...safe);
      if (remainingMs <= 0) advance();
    },
    update(elapsedSeconds) {
      if (remainingMs <= 0) return;
      remainingMs -= Math.max(0, elapsedSeconds) * 1000;
      if (remainingMs <= 0) advance();
    }
  });
}
