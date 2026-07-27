export function resolveBootScene({ defaultId, fixtureIds, search, testHook }) {
  if (!testHook) return defaultId;
  const fixtureId = new URLSearchParams(search).get('fixture');
  return fixtureId && fixtureIds.includes(fixtureId) ? fixtureId : defaultId;
}
