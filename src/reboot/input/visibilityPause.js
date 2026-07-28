export function createVisibilityPause({ documentRef, pause, sync }) {
  let attached = false;
  function visibilityChanged() {
    if (!documentRef.hidden) return;
    pause();
    sync();
  }
  return Object.freeze({
    attach() {
      if (attached) return;
      documentRef.addEventListener('visibilitychange', visibilityChanged);
      attached = true;
    },
    detach() {
      if (!attached) return;
      documentRef.removeEventListener('visibilitychange', visibilityChanged);
      attached = false;
    },
    getDebugState: () => Object.freeze({ attached })
  });
}
