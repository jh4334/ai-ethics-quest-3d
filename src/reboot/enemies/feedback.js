export function createEnemyFeedback(events, definition) {
  const move = definition.moves[0];
  const feedback = [];
  for (const event of events) {
    if (event.type === 'attack-committed') feedback.push({ cueId: move.feedback.windup, enemyId: event.enemyId });
    if (event.type === 'attack-contact') feedback.push({ cueId: move.feedback.contact, enemyId: event.enemyId });
    if (event.type === 'attack-recovered') feedback.push({ cueId: move.feedback.recover, enemyId: event.enemyId });
    if (event.type === 'armor-broken') feedback.push({ cueId: 'armor-broken', enemyId: event.enemyId });
    if (event.type === 'enemy-staggered') feedback.push({ cueId: 'enemy-staggered', enemyId: event.enemyId });
    if (event.type === 'enemy-defeated') feedback.push({ cueId: 'enemy-defeated', enemyId: event.enemyId });
  }
  return Object.freeze(feedback.map((entry) => Object.freeze(entry)));
}
