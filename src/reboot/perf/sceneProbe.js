import { createFrameMetrics } from './frameMetrics.js';

export function createScenePerformanceProbe({ feedback, renderer, scene, windowRef }) {
  const metrics = createFrameMetrics();
  let lights = 0;
  scene.traverse((object) => { if (object.isLight) lights += 1; });
  return Object.freeze({
    record(delta) {
      const feedbackState = feedback?.getDebugState?.();
      metrics.record(delta, {
        calls: renderer.info.render.calls,
        heapBytes: windowRef.performance?.memory?.usedJSHeapSize ?? 0,
        lights,
        particles: (feedbackState?.pool?.active ?? 0) * 2,
        triangles: renderer.info.render.triangles
      });
    },
    report: metrics.report,
    reset: metrics.reset
  });
}
