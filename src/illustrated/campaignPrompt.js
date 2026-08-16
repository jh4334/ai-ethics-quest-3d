export function getCampaignPrompt(state, touchPrompts) {
  const key = (keyboard, touch) => touchPrompts ? touch : keyboard;
  const nearbyStamp = state.projectiles.find(({ active, reviewable, x }) => (
    active && reviewable && Math.abs(x - state.player.x) <= 150
  ));
  if (nearbyStamp) {
    return nearbyStamp.reviewed
      ? { key: key('J', 'SIGNAL'), line: '검토 완료 · 결재탄을 승인자에게 반송' }
      : { key: key('E', 'TRACE'), line: '자동 결재 일시 정지 · 사람 검토 시작' };
  }

  const nearbyEnemy = state.enemies.find(({ defeated, x }) => !defeated && Math.abs(x - state.player.x) <= 174);
  if (nearbyEnemy) {
    if (state.chapterIndex === 3 && nearbyEnemy.traced) {
      const pair = state.enemies.filter(({ pairId }) => pairId === nearbyEnemy.pairId);
      if (!pair.every(({ traced }) => traced)) return { key: key('E', 'TRACE'), line: '같은 문양의 반대 출처도 확인' };
    }
    return nearbyEnemy.traced
      ? { key: key('J', 'SIGNAL'), line: '확인된 근거로 방해 신호 차단' }
      : { key: key('E', 'TRACE'), line: state.mechanics.tracePrompt };
  }

  const nearbyEvidence = state.evidence.find(({ collected, x }) => !collected && Math.abs(x - state.player.x) <= 140);
  if (nearbyEvidence) {
    const enemy = state.enemies.find(({ id }) => id === nearbyEvidence.enemyId);
    return enemy?.defeated
      ? { key: key('E', 'TRACE'), line: `${nearbyEvidence.label}의 윤리 근거 복구` }
      : { key: key('E', 'TRACE'), line: '수호자의 판단 근거를 먼저 확인' };
  }

  if (state.boss.active && Math.abs(state.boss.x - state.player.x) <= 260) {
    if (state.boss.staggered) return { key: key('E', 'TRACE'), line: '책임 기록을 열고 장의 결정을 남기기' };
    if (state.chapterIndex === 4) return { key: key('E', 'TRACE'), line: '결재탄 TRACE → SIGNAL 반송으로 자동 결정 중지' };
    const phase = state.boss.phases[state.boss.phaseIndex];
    return state.boss.traced
      ? { key: key('J', 'SIGNAL'), line: `${phase.label} 단계의 책임 연결` }
      : { key: key('E', 'TRACE'), line: `${phase.label}의 근거와 책임 확인` };
  }

  return { key: key('D', '이동'), line: `${state.mechanics.lesson} · 오른쪽으로 이동` };
}

export function getEthicsCostText(ethics) {
  const costs = [];
  if (ethics.exposure > 0) costs.push(`노출 ${ethics.exposure}`);
  if (ethics.reflections > 0) costs.push(`복제 반격 ${ethics.reflections}`);
  if (ethics.spread > 0) costs.push(`확산 ${ethics.spread}`);
  if (ethics.automaticApprovals > 0) costs.push(`자동 승인 ${ethics.automaticApprovals}`);
  return costs.length > 0 ? costs.join(' · ') : '실패 비용 없음';
}
