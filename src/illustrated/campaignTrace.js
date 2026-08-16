import { CAMPAIGN_CHAPTERS } from './campaignContent.js';

function setTraceMessage(state, message, kind, event) {
  state.message = message;
  state.messageKind = kind;
  state.lastEvent = event;
  state.ethics.transitionTimer = 0.24;
}

function isSourcePairReady(state, target) {
  if (!target.pairId) return false;
  const pair = state.enemies.filter(({ pairId }) => pairId === target.pairId);
  return pair.length === 2 && pair.every(({ traced }) => traced);
}

function traceApproval(state) {
  const reviewRadius = state.safeguards.pairedView ? 190 : 126;
  const stamp = state.projectiles.find(({ active, reviewable, reviewed, x }) => (
    active && reviewable && !reviewed && Math.abs(x - state.player.x) <= reviewRadius
  ));
  if (!stamp) return false;
  stamp.reviewed = true;
  stamp.vx *= 0.08;
  state.ethics.status = '결재 검토 가능';
  setTraceMessage(state, '자동 결재를 일시 정지했다. 이제 SIGNAL로 승인자에게 반송해.', 'evidence', 'approval-reviewed');
  return true;
}

function traceEnemy(state) {
  const enemy = state.enemies.find(({ defeated, x }) => !defeated && Math.abs(x - state.player.x) <= 126);
  if (!enemy) return false;
  enemy.traced = true;
  state.ethics.status = enemy.pairId ? '출처 확인 중' : 'TRACE 완료';
  if (enemy.pairId && !state.ethics.pairedSources.includes(enemy.id)) state.ethics.pairedSources.push(enemy.id);
  if (enemy.pairId && state.safeguards.recoveryRoute) {
    const counterpart = state.enemies.find(({ id, pairId }) => id !== enemy.id && pairId === enemy.pairId);
    if (counterpart) {
      counterpart.traced = true;
      if (!state.ethics.pairedSources.includes(counterpart.id)) state.ethics.pairedSources.push(counterpart.id);
    }
  }
  const pairReady = enemy.pairId ? isSourcePairReady(state, enemy) : true;
  if (pairReady) state.ethics.status = enemy.pairId ? '출처 쌍 확인' : 'TRACE 완료';
  setTraceMessage(state, pairReady
    ? `${state.safeguards.recoveryRoute && enemy.pairId ? '피해 회복 경로가 반대 출처까지 연결했다. ' : ''}${state.mechanics.tracePrompt}. 확인 문양이 켜져 SIGNAL이 유효해졌다.`
    : '첫 출처를 확인했다. 같은 연결 문양의 반대 출처도 TRACE해야 방패가 열린다.',
  'evidence', pairReady ? `trace-target:${enemy.id}` : 'source-first-traced');
  return true;
}

function traceEvidence(state) {
  const nearby = state.evidence.find(({ collected, x }) => !collected && Math.abs(x - state.player.x) <= 126);
  if (!nearby) return false;
  const guardian = state.enemies.find(({ id }) => id === nearby.enemyId);
  if (!guardian?.defeated) {
    setTraceMessage(state, '기록을 지키는 적을 TRACE로 확인하고 SIGNAL로 멈춰야 원본을 읽을 수 있어.', 'warning', 'trace-blocked');
    return true;
  }
  nearby.collected = true;
  state.ethics.status = '윤리 근거 복구';
  if (!state.collectedEvidence.includes(nearby.key)) state.collectedEvidence.push(nearby.key);
  state.checkpointX = nearby.checkpointX;
  let message = `${nearby.label} 복구: ${nearby.message}`;
  if (state.evidence.every(({ collected }) => collected)) {
    state.boss.active = true;
    message += ` 세 근거가 연결됐다. 이제 ${state.boss.label}의 3단계 책임 기록을 열자.`;
  }
  setTraceMessage(state, message, state.boss.active ? 'objective' : 'evidence', `evidence:${nearby.key}`);
  return true;
}

function traceBoss(state) {
  const boss = state.boss;
  if (!boss.active || Math.abs(boss.x - state.player.x) > 184) return false;
  if (boss.staggered) {
    if (state.chapterIndex === 5) state.ethics.chainProgress = state.mechanics.chainSteps.length;
    state.phase = 'choice';
    setTraceMessage(state, CAMPAIGN_CHAPTERS[state.chapterIndex].choice.prompt, 'choice', 'choice-open');
    return true;
  }
  boss.traced = true;
  state.ethics.status = `${boss.phaseIndex + 1}/3 단계 TRACE 완료`;
  if (state.chapterIndex === 5) state.ethics.chainProgress = boss.phaseIndex + 1;
  const phase = boss.phases[boss.phaseIndex];
  setTraceMessage(state, state.chapterIndex === 4
    ? `${phase.label}을 확인했다. 직접 공격이 아니라 날아오는 결재탄을 TRACE해 검토·반송해야 한다.`
    : `${phase.label} 확인 완료: ${phase.instruction} 이제 SIGNAL이 이 단계에 닿는다.`,
  'evidence', `boss-traced:${phase.id}`);
  return true;
}

export function performCampaignTrace(state) {
  if (traceApproval(state) || traceEnemy(state) || traceEvidence(state) || traceBoss(state)) return;
  setTraceMessage(state, `도트: ${state.mechanics.tracePrompt}. 청록 조사 원 안에서 사용해 줘.`, 'guide', 'trace-empty');
}
