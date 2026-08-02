import { bossObjectiveText, bossVerbFor } from '../bosses/guidance.js';
import { PLAYER_RULES } from '../content/actions.js';

const OBJECTIVES = Object.freeze({
  'classroom-cold-open': '하루가 숨긴 백업 단서 찾기',
  'collapsing-corridor': '빈 출석 기록의 발신지 추적',
  'first-arena': '지우개·도장기 명령 번호 추적',
  'memory-backup-decision': '하루 백업의 원본 시간 확인',
  'scanner-pursuit': '남긴 기록을 따라 체육관으로 이동',
  'gym-boss-arena': '승인 기록을 잠근 감독관과 대면'
});

// 단계 목표 — 기기별 문구(S6a): 데스크톱은 키(E/F/Q) 병기, 터치는 버튼 이름으로 말한다.
const PHASE_OBJECTIVES = Object.freeze({
  'chapter-ending': Object.freeze({
    desktop: '내 선택과 승인 기록 확인',
    touch: '내 선택과 승인 기록 확인'
  }),
  'memory-decision': Object.freeze({
    desktop: '선택은 기록됨 · E 추적으로 검증 / Q 소거로 단축',
    touch: '선택은 기록됨 · 추적 버튼 검증 / 소거 버튼 단축'
  }),
  'memory-secure-ready': Object.freeze({
    desktop: '검증 완료 · F 확보로 원본 고정',
    touch: '검증 완료 · 확보 버튼으로 원본 고정'
  }),
  'memory-traced': Object.freeze({
    desktop: '추적 유지 · 원본 연결 확인 중',
    touch: '추적 유지 · 원본 연결 확인 중'
  })
});

// 전투 상태 칩 — 영어 약어 대신 초등 눈높이 한국어(S6a).
const ACTION_LABELS = Object.freeze({
  attack1: '베기 1', attack2: '베기 2', attack3: '베기 3', dash: '회피', defeat: '다운',
  idle: '대기', ready: '대기', reflect: '반사', secure: '확보', stagger: '경직', trace: '추적'
});

// 게이지 채움 너비(%) — 0~100으로 자른 정수 문자열. 값이 없으면 null.
function fillPercent(value, max) {
  if (!Number.isFinite(value) || !(max > 0)) return null;
  return `${Math.max(0, Math.min(100, Math.round((value / max) * 100)))}%`;
}

// 텍스트 칩(구형) ↔ 채움 바(신형) 겸용 — 라벨 span이 있으면 라벨만 갱신해 바 구조를 보존한다.
function syncGauge(ui, { container, fill, label }, text, width, blocked = null) {
  if (ui[label]) ui[label].textContent = text;
  else if (ui[container]) ui[container].textContent = text;
  if (ui[fill]?.style && width !== null) ui[fill].style.width = width;
  if (blocked !== null && ui[container]?.classList) ui[container].classList.toggle('gauge-blocked', blocked);
}

function syncBoss(ui, bossState) {
  const phase = bossState.definition.phases[bossState.phaseIndex];
  if (ui.enemy) ui.enemy.textContent = `감독관 ${bossState.hp}`;
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
      bossEvents = [], bossState = null, counters, encounter, feedbackPrompts = [], feedbackState, frame, lastEnemyEvents = [],
      lastEvents = [], routeSegmentId, storyOutcome = null, storyState, radioLine = null,
      resultVisible = false, viewportMode, blockerActive = false, offscreenActive = false,
      performanceState, qualityProfile
    }) {
      syncGauge(
        ui, { container: 'health', fill: 'healthFill', label: 'healthLabel' },
        `HP ${frame.hud.hp}`, fillPercent(frame.hud.hp, PLAYER_RULES.maxHp)
      );
      if (Number.isFinite(frame.hud.signal)) {
        syncGauge(
          ui, { container: 'signal', fill: 'signalFill', label: 'signalLabel' },
          `SIGNAL ${frame.hud.signal}`, fillPercent(frame.hud.signal, PLAYER_RULES.maxSignal),
          // 게이지 부족 깜빡임 — signal-blocked 이벤트가 있는 프레임에만 클래스가 붙는다(타이머 없음).
          lastEvents.some((event) => event.type === 'signal-blocked')
        );
        canvas.dataset.playerSignal = String(frame.hud.signal);
      }
      const device = viewportMode === 'touch' ? 'touch' : 'desktop';
      if (ui.action) {
        ui.action.textContent = ACTION_LABELS[frame.hud.action] ?? frame.hud.action.toUpperCase();
      }
      if (ui.chain) ui.chain.textContent = `연계 ${frame.hud.chainLevel}`;

      let bossPhase = null;
      if (bossState) bossPhase = syncBoss(ui, bossState);
      else if (ui.enemy) {
        const eraser = encounter.enemies.find((enemy) => enemy.definition.id === 'eraser');
        ui.enemy.textContent = `방어막 ${eraser?.armor ?? 0}`;
      }

      // 보스전 목표(S5) — 스토리 단계 문구가 없을 때 보스 상태가 구간 목표를 덮어쓴다.
      if (ui.objective) {
        ui.objective.textContent = PHASE_OBJECTIVES[storyState.phase]?.[device]
          ?? bossObjectiveText(bossState, device)
          ?? OBJECTIVES[routeSegmentId];
      }
      if (ui.radio) ui.radio.hidden = radioLine === null;
      if (ui.radioSpeaker) ui.radioSpeaker.textContent = radioLine?.speaker ?? '';
      if (ui.radioText) ui.radioText.textContent = radioLine?.textKo ?? '';
      if (ui.feedback) {
        ui.feedback.hidden = feedbackPrompts.length === 0;
        ui.feedback.textContent = feedbackPrompts.map((prompt) => prompt.label).join(' · ');
      }
      if (ui.result && resultVisible) syncOutcome(ui, storyOutcome);

      canvas.dataset.combatTick = String(frame.tick);
      canvas.dataset.cameraMode = viewportMode;
      canvas.dataset.routeSegment = routeSegmentId;
      canvas.dataset.storyPhase = storyState.phase;
      canvas.dataset.memoryOutcome = storyState.memoryOutcome ?? 'none';
      canvas.dataset.extraWave = String(storyState.effects.extraWave);
      canvas.dataset.backupVisible = String(storyState.effects.backupVisible);
      canvas.dataset.feedbackPromptCount = String(feedbackState.promptCount);
      canvas.dataset.feedbackKinds = feedbackState.promptKinds.join(',');
      canvas.dataset.feedbackPoolActive = String(feedbackState.pool.active);
      canvas.dataset.audioVoices = String(feedbackState.audio.activeVoices);
      canvas.dataset.musicLayer = feedbackState.audio.musicLayer;
      canvas.dataset.p95FrameMs = String(performanceState.p95FrameMs);
      canvas.dataset.drawCalls = String(performanceState.render.calls);
      canvas.dataset.triangles = String(performanceState.render.triangles);
      canvas.dataset.lightCount = String(performanceState.render.lights);
      canvas.dataset.particleCount = String(performanceState.render.particles);
      canvas.dataset.heapBytes = String(performanceState.render.heapBytes);
      canvas.dataset.quality = storyState.campaign.settings.quality;
      canvas.dataset.dpr = String(qualityProfile.dpr);
      // 지금 눌러야 하는 동사(S5) — 터치 버튼 강조 CSS([data-boss-verb])가 이 값을 읽는다.
      canvas.dataset.bossVerb = (bossState && bossVerbFor(bossState)) ?? 'none';
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
