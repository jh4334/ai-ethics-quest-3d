export function createFeedbackCounters() {
  const counts = { armorBreaks: 0, cancelledAttacks: 0, playerHits: 0, reflections: 0 };
  return Object.freeze({
    getState: () => Object.freeze({ ...counts }),
    record(combatEvents, enemyEvents) {
      counts.armorBreaks += enemyEvents.filter((event) => event.type === 'armor-broken').length;
      counts.cancelledAttacks += enemyEvents.filter((event) => event.type === 'attack-cancelled').length;
      counts.playerHits += combatEvents.filter((event) => event.type === 'player-hit').length;
      counts.reflections += combatEvents.filter((event) => ['reflected', 'perfect-reflect'].includes(event.type)).length;
    }
  });
}
