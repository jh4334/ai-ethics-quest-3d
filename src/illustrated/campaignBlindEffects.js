import { spawnMirroredSignal, spawnSpreadBurst } from './campaignHazards.js';

const BLIND_STATUS = Object.freeze({
  'privacy-exposed': '민감정보 노출',
  'signal-copied': '복제 반격 예정',
  'spread-amplified': '확산 증폭',
  'source-pair-incomplete': '출처 쌍 미완성',
  'automatic-approval': '자동 승인 누적',
  'responsibility-chain-reset': '책임 연결 초기화'
});

function setBlindMessage(state, message, kind, event) {
  state.message = message;
  state.messageKind = kind;
  state.lastEvent = event;
  state.ethics.transitionTimer = 0.24;
}

function applySafeguard(state, source, event) {
  if (event === 'signal-copied' && state.safeguards.privacyMask > 0) {
    state.safeguards.privacyMask -= 1;
    state.ethics.status = '개인정보 가림막 작동';
    setBlindMessage(state, '1장에서 가린 개인정보가 카피캣의 첫 복제를 막았다. 다음 SIGNAL부터는 제작 이력을 직접 확인해야 해.', 'evidence', 'privacy-mask-blocked');
    return true;
  }
  if (event === 'spread-amplified' && state.safeguards.spreadWarning > 0) {
    state.safeguards.spreadWarning -= 1;
    state.ethics.status = '확산 경고 작동';
    setBlindMessage(state, '2장에서 남긴 피해 통지가 첫 재공유를 멈췄다. 다음 반응부터는 전달 경로를 TRACE해야 해.', 'evidence', 'spread-warning-blocked');
    return true;
  }
  if (event === 'source-pair-incomplete' && state.safeguards.consentWindow > 0) {
    state.safeguards.consentWindow -= 1;
    source.traced = true;
    if (!state.ethics.pairedSources.includes(source.id)) state.ethics.pairedSources.push(source.id);
    state.ethics.status = '당사자 확인 대기';
    setBlindMessage(state, '3장에서 남긴 동의 대기 창이 성급한 결론을 멈추고 첫 출처를 표시했다. 반대 출처까지 TRACE해.', 'evidence', 'consent-window-opened');
    return true;
  }
  if (event === 'responsibility-chain-reset' && source === state.boss && state.safeguards.appealOpen > 0) {
    state.safeguards.appealOpen -= 1;
    state.boss.traced = true;
    state.ethics.status = '이의제기 접수';
    setBlindMessage(state, '5장에서 연 이의제기 창구가 잘못된 연결을 멈췄다. 현재 단계는 초기화되지 않고 다시 검토된다.', 'evidence', 'appeal-prevented-reset');
    return true;
  }
  return false;
}

function resetResponsibilityChain(state, source, event) {
  state.ethics.chainProgress = 0;
  if (source === state.boss) {
    const keepReviewedPhases = state.safeguards.reviewerPresent;
    state.boss.phaseIndex = keepReviewedPhases ? state.boss.phaseIndex : 0;
    state.boss.phaseHp = state.boss.maxPhaseHp;
    state.boss.hp = keepReviewedPhases
      ? state.boss.maxHp - state.boss.phaseIndex * state.boss.maxPhaseHp
      : state.boss.maxHp;
    state.boss.traced = false;
  }
  setBlindMessage(state, state.safeguards.reviewerPresent
    ? '사람 검토자가 확인된 앞 단계를 보존했다. 현재 책임 단계만 다시 TRACE해.'
    : '책임 순서를 확인하지 않아 연결이 초기화됐다. 계산 → 승인 → 실행 기록을 TRACE해.',
  'warning', event);
}

export function applyBlindEffect(state, source) {
  const event = state.mechanics.blindEvent;
  if (applySafeguard(state, source, event)) return;
  state.ethics.blindActions += 1;
  state.ethics.status = BLIND_STATUS[event];
  if (event === 'privacy-exposed') {
    state.ethics.exposure += 1;
    setBlindMessage(state, '열람 권한을 확인하지 않아 민감정보가 전장에 노출됐다. TRACE로 동의 범위를 먼저 가려야 해.', 'warning', event);
    return;
  }
  if (event === 'signal-copied') {
    state.ethics.reflections += 1;
    spawnMirroredSignal(state, source.x);
    setBlindMessage(state, '카피캣이 네 SIGNAL을 복제했다. 같은 공격이 되돌아온다. 제작 이력을 TRACE해.', 'warning', event);
    return;
  }
  if (event === 'spread-amplified') {
    state.ethics.spread += 1;
    spawnSpreadBurst(state, source.x);
    setBlindMessage(state, `확산 단계 ${state.ethics.spread}: 무작정 반응해 에코 파동이 늘었다. 전달 경로를 TRACE해 얼려.`, 'warning', event);
    return;
  }
  if (event === 'source-pair-incomplete') {
    setBlindMessage(state, '한쪽 출처만 보고 결론 내리자 추천 장벽이 다시 닫혔다. 연결된 반대쪽도 TRACE해.', 'warning', event);
    return;
  }
  if (event === 'automatic-approval') {
    state.ethics.automaticApprovals += 1;
    setBlindMessage(state, '검토하지 않은 SIGNAL이 자동 승인으로 기록됐다. 결재탄을 TRACE한 뒤 반송해야 해.', 'warning', event);
    return;
  }
  resetResponsibilityChain(state, source, event);
}
