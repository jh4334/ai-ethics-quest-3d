// 감독관 보스전 안내(S5) — 순수 로직(THREE·DOM 무의존, node 테스트 대상).
// 초등 5–6학년이 처음 와도 단계 해법(K 반사 → E 추적 → J 베기)을 화면에서 읽을 수 있게
// 무전 대본·목표 문구·동사 프롬프트를 보스 상태에서 결정적으로 계산한다.
// 시간은 update(elapsedSeconds)로만 흐른다(타이머 0 — 교실 재현성).

// 단계별 행동 문구 — HUD 목표(data-route-objective)에 들어간다.
const PHASE_ACTION_TEXT = Object.freeze({
  'reflect-scan': '빔을 K 반사',
  'trace-roster': '진짜 기록 E 추적',
  'approval-core': '코어 J 베기'
});

// 단계별 동사 칩 라벨 — 윈드업·공격 윈도우 동안 피드백 칩(data-feedback-prompts)에 뜬다.
const PHASE_VERB_LABEL = Object.freeze({
  'reflect-scan': '빔이 온다 — K 반사!',
  'trace-roster': '진짜 기록에 E 추적!',
  'approval-core': '코어 개방 — J 베기!'
});

// 단계 진입 무전 — DOT는 짧고 행동 지향(시나리오 v2 목소리 가이드, 74자 예산).
const PHASE_ENTRY_LINES = Object.freeze({
  'reflect-scan': {
    id: 'boss-entry-reflect',
    speaker: 'DOT',
    textKo: '감독관은 베기가 안 통해. 붉은 스캔 빔이 켜지면 — K로 되돌려.',
    durationMs: 4600
  },
  'trace-roster': {
    id: 'boss-entry-trace',
    speaker: 'DOT',
    textKo: '복제 명단 셋. 진짜 승인 기록만 E로 짚어.',
    durationMs: 3800
  },
  'approval-core': {
    id: 'boss-entry-core',
    speaker: 'DOT',
    textKo: '코어가 열렸다 — 지금이야, J로 베어!',
    durationMs: 3600
  }
});

// 오입력 재안내 — 현재 단계의 동사를 다시 짚는 한 줄.
const PHASE_MISMATCH_LINES = Object.freeze({
  'reflect-scan': {
    id: 'boss-retry-reflect',
    speaker: 'DOT',
    textKo: '베기 말고! 빔이 켜지는 순간 K야.',
    durationMs: 2800
  },
  'trace-roster': {
    id: 'boss-retry-trace',
    speaker: 'DOT',
    textKo: '지금은 칼 넣어. 진짜 기록만 E로 짚어.',
    durationMs: 2800
  },
  'approval-core': {
    id: 'boss-retry-core',
    speaker: 'DOT',
    textKo: '지금은 J! 열린 코어를 베어.',
    durationMs: 2800
  }
});

const REFLECT_CHEER_LINE = Object.freeze({
  id: 'boss-cheer-reflect',
  speaker: 'DOT',
  textKo: '좋아, 한 번 더!',
  durationMs: 1800
});

// 첫 진입 1회 안내 칩 — 첫 성공(knowledge 기록) 전까지 공략 순서를 붙잡아 준다.
const ORDER_HINT_PROMPT = Object.freeze({
  id: 'boss-order-hint',
  label: '감독관 순서: K 반사 → E 추적 → J 베기'
});

// 동일 안내 반복 금지 간격(초) — 오입력 무전 스팸 방지 규칙.
export const MISMATCH_COOLDOWN_SECONDS = 3;

function activePhase(bossState) {
  if (!bossState || bossState.status !== 'active') return null;
  return bossState.definition?.phases?.[bossState.phaseIndex] ?? null;
}

// HUD 목표 문구 — "감독관 1/3 — 빔을 K 반사 (0/2)". 미지 단계·비활성 상태면 null(기존 목표 유지).
export function bossObjectiveText(bossState) {
  const phase = activePhase(bossState);
  const actionText = phase ? PHASE_ACTION_TEXT[phase.id] : null;
  if (!actionText) return null;
  const total = bossState.definition.phases.length;
  return `감독관 ${bossState.phaseIndex + 1}/${total} — ${actionText} (${bossState.phaseSuccesses}/${phase.requiredSuccesses})`;
}

// 지금 눌러야 하는 동사 — 윈드업+공격 윈도우 동안만(회복 구간에는 null). 터치 버튼 강조에도 쓴다.
export function bossVerbFor(bossState) {
  const phase = activePhase(bossState);
  if (!phase || !PHASE_ACTION_TEXT[phase.id]) return null;
  const windowEnd = phase.timing.windupTicks + phase.timing.activeTicks;
  return bossState.phaseTick < windowEnd ? phase.response : null;
}

// 피드백 칩 목록 — 동사 프롬프트 + 첫 성공 전 순서 안내.
export function bossGuidancePrompts(bossState) {
  const phase = activePhase(bossState);
  if (!phase) return [];
  const prompts = [];
  const verb = bossVerbFor(bossState);
  if (verb) prompts.push({ id: `boss-verb-${phase.id}`, label: PHASE_VERB_LABEL[phase.id] });
  if ((bossState.knowledge?.length ?? 0) === 0) prompts.push(ORDER_HINT_PROMPT);
  return prompts;
}

// 보스 이벤트·상태 → 무전 줄 목록. 진입·단계 전환·격려는 장면당 1회, 오입력은 3초 간격.
export function createBossGuidance() {
  const playedOnce = new Set();
  let mismatchCooldown = 0;

  function once(line) {
    if (!line || playedOnce.has(line.id)) return null;
    playedOnce.add(line.id);
    return line;
  }

  return Object.freeze({
    getDebugState() {
      return Object.freeze({ mismatchCooldown, playedOnce: Object.freeze([...playedOnce]) });
    },
    // 프레임 관찰 — 보스 아레나 안에서만 호출한다.
    observe({ events = [], state = null } = {}) {
      const lines = [];
      const phase = activePhase(state);
      for (const event of events) {
        // 재도전 — 단계가 처음으로 되감기므로 진입 안내도 다시 열어 준다.
        if (event.type === 'boss-retry-ready') playedOnce.clear();
        if (event.type === 'mastery-success' && event.phaseId === 'reflect-scan'
          && phase?.id === 'reflect-scan') {
          const cheer = once(REFLECT_CHEER_LINE);
          if (cheer) lines.push(cheer);
        }
      }
      // 진입·단계 전환: 현재 단계의 해법을 1회 말한다(체크포인트로 2·3단계 시작도 맞는 안내).
      if (phase && PHASE_ENTRY_LINES[phase.id]) {
        const entry = once(PHASE_ENTRY_LINES[phase.id]);
        if (entry) lines.push(entry);
      }
      return lines;
    },
    // 오입력 — 현재 단계 동사와 다른 전투 입력이 오면 재안내 한 줄(3초 이내 반복 금지).
    noteMismatch(actionType, state) {
      const phase = activePhase(state);
      if (!phase || !PHASE_MISMATCH_LINES[phase.id]) return null;
      if (!['attack', 'reflect', 'trace'].includes(actionType)) return null;
      if (actionType === phase.response) return null;
      if (mismatchCooldown > 0) return null;
      mismatchCooldown = MISMATCH_COOLDOWN_SECONDS;
      return PHASE_MISMATCH_LINES[phase.id];
    },
    update(elapsedSeconds) {
      mismatchCooldown = Math.max(0, mismatchCooldown - Math.max(0, elapsedSeconds));
    }
  });
}
