export function createAppLifecycle({ registry, scheduler }) {
  let frameId = null;
  let lastTime = null;
  let scene = null;
  let sceneId = null;
  let status = 'idle';

  function cancelFrame() {
    if (frameId === null) return;
    scheduler.cancel(frameId);
    frameId = null;
  }

  function scheduleFrame() {
    if (status !== 'running' || frameId !== null) return;
    frameId = scheduler.request(runFrame);
  }

  function runFrame(time) {
    frameId = null;
    if (status !== 'running' || !scene) return;
    const delta = lastTime === null ? 0 : Math.min(Math.max((time - lastTime) / 1000, 0), 0.1);
    lastTime = time;
    scene.update(delta);
    scheduleFrame();
  }

  function releaseScene() {
    if (!scene) return;
    const outgoing = scene;
    scene = null;
    try {
      outgoing.exit();
    } finally {
      outgoing.dispose();
    }
  }

  return Object.freeze({
    destroy() {
      if (status === 'destroyed') return;
      cancelFrame();
      releaseScene();
      status = 'destroyed';
      sceneId = null;
      lastTime = null;
    },
    getState() {
      return Object.freeze({ framePending: frameId !== null, sceneId, status });
    },
    pause() {
      if (status !== 'running') return;
      status = 'paused';
      cancelFrame();
    },
    restart() {
      if (!sceneId || status === 'destroyed') return;
      const restartId = sceneId;
      const shouldRun = status === 'running';
      cancelFrame();
      releaseScene();
      scene = registry.create(restartId);
      lastTime = null;
      scene.enter();
      status = shouldRun ? 'running' : 'paused';
      scheduleFrame();
    },
    resume() {
      if (status !== 'paused') return;
      status = 'running';
      lastTime = null;
      scheduleFrame();
    },
    start(nextSceneId) {
      if (status !== 'idle') throw new Error('App lifecycle can only start once');
      sceneId = nextSceneId;
      scene = registry.create(nextSceneId);
      scene.enter();
      status = 'running';
      scheduleFrame();
    }
  });
}
