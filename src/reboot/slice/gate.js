const REQUIRED_GATES = Object.freeze([
  'automated', 'mobile', 'offline', 'performance', 'reducedMotion', 'saveRetry', 'visual'
]);

function finiteAtMost(value, limit) {
  return Number.isFinite(value) && value <= limit;
}

function timelinePasses(timeline) {
  return timeline?.contractVersion === 1
    && Number.isFinite(timeline.completionMinutes)
    && timeline.completionMinutes >= 25
    && timeline.completionMinutes <= 35
    && finiteAtMost(timeline.firstControlSeconds, 20)
    && finiteAtMost(timeline.firstCombatMinutes, 3)
    && finiteAtMost(timeline.firstConsequenceMinutes, 10);
}

export function evaluateSliceManifest(manifest) {
  const failures = new Set();
  if (!manifest || typeof manifest !== 'object' || manifest.schemaVersion !== 1) {
    failures.add('schema-version');
  }
  const runs = Array.isArray(manifest?.runs) ? manifest.runs : [];
  const secure = runs.find((run) => run?.branch === 'secure');
  const purge = runs.find((run) => run?.branch === 'purge');
  if (!secure) failures.add('secure-route');
  if (!purge) failures.add('purge-route');
  if (!runs.some((run) => run?.device === 'desktop')) failures.add('desktop-completion');
  if (!runs.some((run) => run?.device === 'touch')) failures.add('touch-completion');

  for (const run of runs) {
    const device = run?.device === 'touch' ? 'touch' : 'desktop';
    const frameLimit = device === 'touch' ? 33.3 : 16.7;
    if (!finiteAtMost(run?.metrics?.p95FrameMs, frameLimit)) {
      failures.add(`${device}-frame-budget`);
    }
    if (!finiteAtMost(run?.metrics?.drawCalls, 250)) failures.add('draw-call-budget');
    if (!finiteAtMost(run?.metrics?.triangles, 150_000)) failures.add('triangle-budget');
    if (!finiteAtMost(run?.metrics?.lights, 4)) failures.add('light-budget');
    if (run?.consoleErrors !== 0) failures.add('console-errors');
    if (!timelinePasses(run?.timeline)) failures.add(`${run?.branch ?? 'unknown'}-timeline`);
    for (const gate of REQUIRED_GATES) {
      if (run?.gates?.[gate] !== true) failures.add(`${gate}-gate`);
    }
  }

  if (secure && purge) {
    if (!secure.signatureRevealed || !purge.signatureRevealed) failures.add('signature-reversal');
    if (!secure.reportId || secure.reportId === purge.reportId) failures.add('distinct-reports');
  }
  const blockers = Array.isArray(manifest?.blockers) ? manifest.blockers : [];
  if (blockers.some((blocker) => ['P0', 'P1'].includes(blocker?.severity))) {
    failures.add('release-blockers');
  }

  const ordered = [...failures].sort();
  return Object.freeze({ failures: Object.freeze(ordered), pass: ordered.length === 0 });
}
