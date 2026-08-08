const INITIALIZATION_FAILURE = '그래픽을 시작하지 못했습니다. 기기가 WebGL을 지원하는지 확인한 뒤 새로고침해 주세요.';
const CONTEXT_LOSS_FAILURE = '그래픽 연결이 중단되었습니다. 진행 상황을 보존한 뒤 새로고침해 주세요.';

export function createWebglBootController({ canvas, failure, reload = () => window.location.reload(), root, status }) {
  let contextLost = null;
  let rendererCreated = false;

  function showFailure(message) {
    root.dataset.webglUnavailable = 'true';
    canvas.setAttribute?.('aria-hidden', 'true');
    failure.hidden = false;
    failure.querySelector('[data-webgl-message]').textContent = message;
    status.textContent = message;
  }

  function handleContextLost(event) {
    event.preventDefault();
    contextLost?.();
    showFailure(CONTEXT_LOSS_FAILURE);
  }

  const retry = failure.querySelector('[data-webgl-retry]');
  retry?.addEventListener('click', reload);

  return Object.freeze({
    createRenderer(factory) {
      try {
        const renderer = factory();
        rendererCreated = true;
        canvas.addEventListener('webglcontextlost', handleContextLost);
        return renderer;
      } catch {
        showFailure(INITIALIZATION_FAILURE);
        return null;
      }
    },
    dispose() {
      if (rendererCreated) canvas.removeEventListener('webglcontextlost', handleContextLost);
      retry?.removeEventListener('click', reload);
    },
    onContextLost(callback) {
      contextLost = callback;
    }
  });
}
