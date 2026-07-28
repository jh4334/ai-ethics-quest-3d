const PROFILES = Object.freeze({
  low: Object.freeze({ dprCap: 1, feedbackCapacity: 10, maxDecorations: 8 }),
  medium: Object.freeze({ dprCap: 1.5, feedbackCapacity: 12, maxDecorations: 16 }),
  high: Object.freeze({ dprCap: 1.75, feedbackCapacity: 16, maxDecorations: 24 })
});

export function resolveQualityProfile(quality = 'auto', devicePixelRatio = 1) {
  const resolved = quality === 'auto' ? (devicePixelRatio > 1.5 ? 'medium' : 'high') : quality;
  const profile = PROFILES[resolved] ?? PROFILES.medium;
  return Object.freeze({
    dpr: Math.min(Math.max(1, devicePixelRatio), profile.dprCap),
    feedbackCapacity: profile.feedbackCapacity,
    maxDecorations: profile.maxDecorations,
    simulationHz: 60
  });
}
