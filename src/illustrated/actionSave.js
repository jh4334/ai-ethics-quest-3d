export function serializeActionGame(state) {
  return {
    version: 2,
    checkpointX: Math.round(state.checkpointX),
    evidenceIds: [...state.collectedEvidence],
    completed: state.phase === 'complete'
  };
}
