const OBJECTIVES = Object.freeze({
  'classroom-cold-open': '교실 기록 단말로 이동',
  'collapsing-corridor': '무너지는 복도를 통과',
  'first-arena': '지우개 요원의 빈틈을 추적',
  'memory-backup-decision': '하루의 기억 백업을 확보',
  'scanner-pursuit': '스캐너 추격을 따돌리기',
  'gym-boss-arena': '출석 감독관과 대면'
});

function syncBoss(ui, bossState) {
  const phase = bossState.definition.phases[bossState.phaseIndex];
  if (ui.enemy) ui.enemy.textContent = `${phase.id.toUpperCase()} ${bossState.hp}`;
  return phase.id;
}

function syncOutcome(ui, outcome) {
  if (!outcome) return;
  ui.result.hidden = false;
  if (ui.resultAction) ui.resultAction.textContent = outcome.actionKo;
  if (ui.resultConsequence) ui.resultConsequence.textContent = outcome.routeConsequenceKo;
  if (ui.resultReversal) ui.resultReversal.textContent = outcome.reversalKo;
}

export function createSchoolSceneHud({ canvas, ui = {} }) {
  return Object.freeze({
    sync({
      bossEvents = [], bossState = null, counters, encounter, frame, lastEnemyEvents = [],
      lastEvents = [], routeSegmentId, storyOutcome = null, storyState, radioLine = null,
      resultVisible = false, viewportMode, blockerActive = false, offscreenActive = false
    }) {
      if (ui.health) ui.health.textContent = `HP ${frame.hud.hp}`;
      if (ui.action) ui.action.textContent = frame.hud.action.toUpperCase();
      if (ui.chain) ui.chain.textContent = `SYNC ${frame.hud.chainLevel}`;

      let bossPhase = null;
      if (bossState) bossPhase = syncBoss(ui, bossState);
      else if (ui.enemy) {
        const eraser = encounter.enemies.find((enemy) => enemy.definition.id === 'eraser');
        ui.enemy.textContent = `ARMOR ${eraser?.armor ?? 0}`;
      }

      if (ui.objective) ui.objective.textContent = OBJECTIVES[routeSegmentId];
      if (storyState.phase === 'memory-decision' && ui.objective) {
        ui.objective.textContent = 'Q PURGE · E TRACE → F SECURE';
      }
      if (ui.radio) ui.radio.hidden = radioLine === null;
      if (ui.radioSpeaker) ui.radioSpeaker.textContent = radioLine?.speaker ?? '';
      if (ui.radioText) ui.radioText.textContent = radioLine?.textKo ?? '';
      if (ui.result && resultVisible) syncOutcome(ui, storyOutcome);

      canvas.dataset.combatTick = String(frame.tick);
      canvas.dataset.cameraMode = viewportMode;
      canvas.dataset.routeSegment = routeSegmentId;
      canvas.dataset.storyPhase = storyState.phase;
      canvas.dataset.memoryOutcome = storyState.memoryOutcome ?? 'none';
      canvas.dataset.extraWave = String(storyState.effects.extraWave);
      canvas.dataset.backupVisible = String(storyState.effects.backupVisible);
      if (bossState) {
        canvas.dataset.bossPhase = bossPhase;
        canvas.dataset.bossSuccesses = String(bossState.phaseSuccesses);
        canvas.dataset.bossStatus = bossState.status;
        canvas.dataset.bossHp = String(bossState.hp);
        canvas.dataset.bossEvent = bossEvents.at(-1)?.type ?? 'none';
      }
      canvas.dataset.enemyCount = String(encounter.enemies.length);
      canvas.dataset.enemyPhases = encounter.enemies.map((enemy) => `${enemy.id}:${enemy.phase}`).join(',');
      canvas.dataset.enemyPhaseTicks = encounter.enemies
        .map((enemy) => `${enemy.id}:${enemy.phaseTick}`)
        .join(',');
      const stamper = encounter.enemies.find((enemy) => enemy.definition.id === 'stamper');
      const eraser = encounter.enemies.find((enemy) => enemy.definition.id === 'eraser');
      canvas.dataset.stamperTelegraph = stamper ? `${stamper.phase}:${stamper.phaseTick}` : 'missing';
      canvas.dataset.eraserArmor = String(eraser?.armor ?? 0);
      canvas.dataset.armorBreaks = String(counters.armorBreaks);
      canvas.dataset.reflections = String(counters.reflections);
      canvas.dataset.playerHits = String(counters.playerHits);
      canvas.dataset.cancelledAttacks = String(counters.cancelledAttacks);
      canvas.dataset.blockerActive = String(blockerActive);
      canvas.dataset.offscreenActive = String(offscreenActive);
      const started = lastEvents.find((event) => event.type === 'action-started');
      if (started) canvas.dataset.lastAction = started.action;
      const enemyEvent = lastEnemyEvents.at(-1);
      if (enemyEvent) canvas.dataset.lastEnemyEvent = enemyEvent.type;
    }
  });
}
