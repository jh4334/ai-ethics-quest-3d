export function presentSchoolFeedback({
  bossGame, currentSegment, feedback, frame, lastBossEvents, result
}) {
  const inBoss = bossGame !== null && currentSegment.id === 'gym-boss-arena';
  return feedback.present({
    bossEvents: lastBossEvents,
    combatEvents: result.combatEvents,
    encounter: result.state.encounter,
    enemyEvents: result.enemyEvents,
    frame,
    inBoss,
    inPursuit: currentSegment.id === 'scanner-pursuit'
  });
}
