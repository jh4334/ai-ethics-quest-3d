export function createFrameMetrics({ maxSamples = 600 } = {}) {
  const limit = Number.isInteger(maxSamples) ? Math.max(30, Math.min(3600, maxSamples)) : 600;
  const samples = [];
  let render = { calls: 0, heapBytes: 0, lights: 0, particles: 0, triangles: 0 };
  return Object.freeze({
    record(deltaSeconds, snapshot = {}) {
      const milliseconds = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds * 1000 : 0);
      samples.push(milliseconds);
      if (samples.length > limit) samples.shift();
      render = {
        calls: snapshot.calls ?? render.calls,
        heapBytes: snapshot.heapBytes ?? render.heapBytes,
        lights: snapshot.lights ?? render.lights,
        particles: snapshot.particles ?? render.particles,
        triangles: snapshot.triangles ?? render.triangles
      };
    },
    report() {
      const sorted = [...samples].sort((first, second) => first - second);
      const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
      return Object.freeze({
        p95FrameMs: sorted.length > 0 ? Math.round(sorted[p95Index] * 10) / 10 : 0,
        render: Object.freeze({ ...render }),
        samples: samples.length,
        simulationHz: 60
      });
    },
    reset() {
      samples.length = 0;
    }
  });
}
