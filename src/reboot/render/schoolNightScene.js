import * as THREE from 'three';

import { createEncounterGameRuntime } from '../app/encounterGameRuntime.js';
import { createBossGameRuntime } from '../app/bossGameRuntime.js';
import { bossGuidancePrompts, createBossGuidance } from '../bosses/guidance.js';
import { createPatchSelector } from '../app/patchSelection.js';
import { addCameraShake, createCameraController } from '../camera/controller.js';
import { createCharacterCast } from '../characters/cast.js';
import { createCharacterFactory } from '../characters/factory.js';
import { chapterOneLevel } from '../content/levels/chapter1.js';
import { createFeedbackDirector } from '../feedback/director.js';
import { walkableRectsFromLevel } from '../level/walkableBounds.js';
import { createFeedbackCounters } from '../feedback/counters.js';
import { presentSchoolFeedback } from '../feedback/schoolFeedback.js';
import { createScenePerformanceProbe } from '../perf/sceneProbe.js';
import { createChapterOneDirector } from '../story/chapterOneDirector.js';
import {
  chapterOneGateForPhase, chapterOneSpawnForCheckpoint, chapterOneWalkableFor, isChapterOneArenaResolved
} from '../story/chapterOneGates.js';
import { createBladeTrail } from './bladeTrail.js';
import { createCombatPresentationAdapter } from './combatPresentation.js';
import { createBossCast } from './bossCast.js';
import { createDisposableRegistry } from './dispose.js';
import { createEnemyCast } from './enemyCast.js';
import { createEnemyHpBars } from './enemyHpBars.js';
import { createFloatingCampusEnvironment } from './floatingCampusEnvironment.js';
import { createSchoolRoute } from './schoolRoute.js';
import { createSchoolSceneDebugSnapshot } from './schoolSceneDebug.js';
import { closestRouteSegment, getBossCameraTargets, getEncounterCameraTargets, getSceneViewport, updateSchoolCamera } from './schoolSceneCamera.js';
import { loadSchoolSceneCast } from './schoolSceneCastLoader.js';
import { createSchoolSceneHud } from './schoolSceneHud.js';
import { createSceneRadio } from './sceneRadio.js';

export function createSchoolNightScene({
  bossOptions = {}, canvas, encounterOptions = {}, input, renderer,
  startPosition = { x: 0, y: 0 }, storyOptions = {}, ui = {}, windowRef = window
}) {
  const resources = createDisposableRegistry();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050918);
  scene.fog = new THREE.Fog(0x050918, 48, 150);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 180);
  const route = resources.register(createSchoolRoute({ level: chapterOneLevel, lightLimit: 0, scene }), 'school-route');
  route.group.visible = false;
  const campus = resources.register(createFloatingCampusEnvironment({ scene }), 'floating-campus');
  // 캐릭터·적·보스가 GLTF 캐시를 공유한다 — 같은 애니메이션 GLB·텍스처를 세 번 파싱하지 않게.
  // 캐스트들보다 먼저 등록해 역순 해제에서 마지막에 폐기된다.
  const characterFactory = resources.register(createCharacterFactory(), 'shared-character-factory');
  const cast = resources.register(createCharacterCast({ characterFactory, scene }), 'character-cast');
  const enemyCast = resources.register(createEnemyCast({ characterFactory, scene }), 'enemy-cast');
  // 적 머리 위 HP 링 — 빌보드 평면 2장/적, 라이트·그림자·렌더타깃 0.
  const enemyHpBars = resources.register(createEnemyHpBars({ scene }), 'enemy-hp-bars');
  const bossCast = bossOptions.enabled
    ? resources.register(createBossCast({ characterFactory, scene }), 'boss-cast')
    : null;
  const bladeTrail = resources.register(createBladeTrail({ scene }), 'blade-trail');
  const {
    blockAfterTick = null,
    delayedBlockers = [],
    offscreenAfterTick = null,
    ...runtimeEncounterOptions
  } = encounterOptions;
  // 통행 경계 — 레벨 collision 레이어에서 유도. 복도·아레나·체육관 전 구간 밖으로 못 나간다.
  // 스토리 게이트(S6a)가 phase에 따라 이 기본 목록을 잘라 시퀀스 브레이크를 막는다.
  const baseWalkable = walkableRectsFromLevel(chapterOneLevel);
  const game = createEncounterGameRuntime({
    deviceClass: getSceneViewport(canvas).mode,
    startPosition,
    walkable: baseWalkable,
    ...runtimeEncounterOptions
  });
  const combatView = createCombatPresentationAdapter();
  const story = createChapterOneDirector(storyOptions);
  const bossGame = bossOptions.enabled ? createBossGameRuntime({
    consequencePath: story.getState().memoryOutcome ?? 'secure',
    initialState: bossOptions.initialState
  }) : null;
  // 보스 안내 무전(S5) — DOM 없이 순수 큐로 굴리고, HUD가 현재 줄을 그린다.
  // 우선순위: 스토리 radioLine이 비어 있을 때만 표시·소진(스토리 무전 계약 불변).
  const bossGuidance = createBossGuidance();
  const bossRadio = createSceneRadio();
  const feedback = resources.register(createFeedbackDirector({
    capacity: renderer.userData.rebootQuality.feedbackCapacity,
    motion: story.getState().campaign.settings.motion,
    scene,
    sound: story.getState().campaign.settings.sound,
    windowRef
  }), 'combat-feedback');
  const feedbackCounters = createFeedbackCounters();
  scene.add(new THREE.HemisphereLight(0x819ed4, 0x2d1920, 1.3));
  const performanceProbe = createScenePerformanceProbe({ feedback, renderer, scene, windowRef });

  let entered = false, unsubscribeInput = null;
  let currentSegment = closestRouteSegment(chapterOneLevel.segments, startPosition.y);
  // 쓰러짐 복귀 — defeat는 영구 상태가 아니라 대기 후 저장 체크포인트 스폰에서 재기동(S6a).
  // 시뮬 고정 틱으로 재되(150틱 = 2.5초), 저fps에서 벽시계로 늘어지지 않게 상한(4초)을 둔다.
  // 이야기(story)·보스 재도전 카운트는 유지된다(무처벌).
  const RESPAWN_DELAY_TICKS = 150;
  const RESPAWN_MAX_WAIT_SECONDS = 4;
  let respawnAtTick = null;
  let respawnWaitSeconds = 0;
  // 스토리 게이트(S6a) — 현재 적용된 통행 경계 키('open' 또는 게이트 id)와 1회 무전 기록.
  let appliedGateKey = 'open';
  const gateRadioPlayed = new Set();
  // 안내 칩 타이머(표현 전용) — 단말 무반응·HP 회복 알림을 잠깐 띄운다.
  let terminalNoticeSeconds = 0;
  let healNoticeSeconds = 0;
  // DASH 온보딩(S6a) — 추격 구간 첫 진입 무전 1회 + 첫 대시 전 칩.
  let dashUsed = false;
  let dashHintPlayed = false;
  const deviceMode = () => (getSceneViewport(canvas).mode === 'touch' ? 'touch' : 'desktop');
  // 타격감(GF1) — 명중 순간 시뮬을 벽시계 기준으로만 잠깐 멈춘다(틱 순서 불변 = 결정성 유지).
  let hitStop = 0;
  // 조작 온보딩 — 적이 코앞인데 한동안 공격이 없으면 공격 키를 짚어 준다.
  let sinceAttackSeconds = 0;
  let lastEvents = [];
  let lastEnemyEvents = [];
  let lastBossEvents = [];
  let bossResolved = false;
  let resultVisible = storyOptions.showOutcome === true;
  let feedbackPrompts = [];
  let lastFrame = combatView.present(game.getState().combat, []);
  // 시그널 게이지는 표현 계약(frame.hud)에 직접 꽂는다 — 순수 심의 player.signal이 유일한 출처.
  lastFrame.hud.signal = game.getState().combat.player.signal;
  const initialCueIndex = chapterOneLevel.segments.findIndex((segment) => segment.id === currentSegment.id);
  let activeTargets = bossGame && currentSegment.id === 'gym-boss-arena'
    ? getBossCameraTargets(lastFrame, route.routeCues[initialCueIndex])
    : getEncounterCameraTargets(lastFrame, route.routeCues[initialCueIndex], game.getState().encounter);
  let cameraState = createCameraController(activeTargets, getSceneViewport(canvas));
  let combatSafeArea = null;
  const hud = createSchoolSceneHud({ canvas, ui });
  const selectPatch = createPatchSelector({ bossGame, bossOptions, canvas, story, storyOptions });

  function resize() {
    const viewport = getSceneViewport(canvas);
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.width, viewport.height, false);
    performanceProbe.reset();
  }

  function syncHud() {
    const encounter = game.getState().encounter;
    const storyState = story.getState();
    hud.sync({
      blockerActive: Number.isInteger(blockAfterTick) && encounter.tick >= blockAfterTick,
      bossEvents: lastBossEvents,
      bossState: bossGame && currentSegment.id === 'gym-boss-arena' ? bossGame.getState() : null,
      counters: feedbackCounters.getState(),
      encounter,
      feedbackPrompts,
      feedbackState: feedback.getDebugState(),
      frame: lastFrame,
      lastEnemyEvents,
      lastEvents,
      offscreenActive: Number.isInteger(offscreenAfterTick) && encounter.tick >= offscreenAfterTick,
      performanceState: performanceProbe.report(),
      qualityProfile: renderer.userData.rebootQuality,
      radioLine: story.getRadioLine() ?? bossRadio.getCurrentLine(),
      resultVisible,
      routeSegmentId: currentSegment.id,
      storyOutcome: resultVisible ? story.getOutcome() : null,
      storyState,
      viewportMode: getSceneViewport(canvas).mode
    });
  }

  // 스토리 게이트 개폐(S6a) — phase·플레이어 위치로 통행 경계를 정하고, 바뀔 때만 시뮬에 반영.
  // 이미 문 너머에 있는 스폰(QA fixture)은 chapterOneWalkableFor가 그대로 통과시킨다.
  function syncStoryGate() {
    const phase = story.getState().phase;
    const playerZ = game.getState().combat.player.position.y;
    const rects = chapterOneWalkableFor(baseWalkable, phase, playerZ);
    const gate = rects === baseWalkable ? null : chapterOneGateForPhase(phase);
    const key = gate ? gate.id : 'open';
    if (key !== appliedGateKey) {
      appliedGateKey = key;
      game.setWalkable(rects);
    }
    return gate;
  }

  function queueAction({ action, active }) {
    if (!active) return;
    feedback.resumeAudio();
    if (action === 'camera-reset') {
      cameraState = createCameraController(activeTargets, getSceneViewport(canvas));
      return;
    }
    if (action === 'purge') {
      story.memoryAction('purge');
      return;
    }
    if (!['attack', 'dash', 'reflect', 'trace', 'secure'].includes(action)) return;
    const targetId = ['trace', 'secure'].includes(action) ? 'memory-backup' : null;
    game.queueAction(action, targetId);
    bossGame?.queueAction(action);
    // 오입력 재안내(S5) — 보스 아레나에서 단계 동사와 다른 입력이 오면 한 줄(3초 스팸 방지).
    // 진입 대본이 아직 안 나갔으면 끊지 않고 뒤에 잇는다(해법 설명이 먼저).
    if (bossGame && currentSegment.id === 'gym-boss-arena') {
      const retryLine = bossGuidance.noteMismatch(action, bossGame.getState(), deviceMode());
      if (retryLine) {
        const current = bossRadio.getCurrentLine();
        const entryPending = (current && String(current.id).startsWith('boss-entry-'))
          || bossRadio.getDebugState().queued > 0;
        bossRadio.play([retryLine], { interrupt: !entryPending });
      }
    }
  }

  return Object.freeze({
    dispose() {
      unsubscribeInput?.();
      bossOptions.onPatchResolved?.();
      resources.disposeAll();
    },
    enter() {
      if (entered) return;
      entered = true;
      canvas.dataset.campaignChapter = '1';
      resize();
      unsubscribeInput = input.subscribe(queueAction);
      feedback.attach();
      story.start();
      // 체크포인트 복원(S6a) — 이미 첫 아레나를 정리한 저장이면 그 적들을 되살리지 않는다.
      if (isChapterOneArenaResolved(story.getState().phase)) game.clearEnemiesForCheckpoint();
      syncStoryGate();
      canvas.dataset.characters = 'loading';
      canvas.dataset.enemies = 'loading';
      canvas.dataset.environmentStatus = 'loading';
      campus.ready.then((report) => {
        if (entered) canvas.dataset.environmentStatus = report.status;
      });
      canvas.dataset.lastAction = 'none';
      canvas.dataset.lastEnemyEvent = 'none';
      loadSchoolSceneCast({
        bossCast, canvas, cast, encounter: game.getState().encounter, enemyCast,
        isEntered: () => entered
      }).catch(() => {
        // 로드 실패는 dataset으로만 알린다 — unhandled rejection(콘솔 에러) 금지.
        if (entered) canvas.dataset.characters = 'error';
      });
      windowRef.addEventListener('resize', resize);
      syncHud();
    },
    exit() {
      if (!entered) return;
      entered = false;
      unsubscribeInput?.();
      unsubscribeInput = null;
      feedback.detach();
      windowRef.removeEventListener('resize', resize);
    },
    getDebugState() {
      return createSchoolSceneDebugSnapshot({
        activeTargets, bossGame, cameraState, canvas, cast, combatSafeArea, currentSegment,
        enemyCast, feedback, game, lastEnemyEvents, lastEvents, lastFrame, performanceProbe,
        campus, route, story
      });
    },
    resourceCount() {
      return resources.size();
    },
    update(delta) {
      const horizontal = Number(input.isActive('move-right')) - Number(input.isActive('move-left'));
      const vertical = Number(input.isActive('move-down')) - Number(input.isActive('move-up'));
      const blockerActive = Number.isInteger(blockAfterTick)
        && game.getState().combat.tick >= blockAfterTick;
      const offscreenActive = Number.isInteger(offscreenAfterTick)
        && game.getState().combat.tick >= offscreenAfterTick;
      // 히트스톱 동안 시뮬만 벽시계 기준으로 멈춘다(렌더·카메라·피드백은 계속).
      const stopped = hitStop > 0;
      if (stopped) hitStop = Math.max(0, hitStop - delta);
      // 스토리 게이트(S6a) — 이번 프레임 시뮬이 돌기 전에 phase 기준 통행 경계를 반영한다.
      const activeGate = syncStoryGate();
      let result = game.update(stopped ? 0 : delta, { horizontal, vertical }, {
        blockers: blockerActive ? delayedBlockers : undefined,
        onScreen: offscreenActive ? false : undefined
      });
      if (result.state.combat.player.status === 'defeated') {
        if (respawnAtTick === null) {
          respawnAtTick = result.state.combat.tick + RESPAWN_DELAY_TICKS;
          respawnWaitSeconds = 0;
        }
        respawnWaitSeconds += delta;
        // 저fps에서는 틱이 벽시계보다 느리게 흐른다 — 대기 표현이 4초를 넘지 않게 상한을 둔다.
        if (result.state.combat.tick >= respawnAtTick || respawnWaitSeconds >= RESPAWN_MAX_WAIT_SECONDS) {
          // 리스폰 = 저장 체크포인트 스폰(S6a). 이미 정리된 첫 아레나의 적은 되살리지 않는다.
          game.reset({
            keepEncounter: isChapterOneArenaResolved(story.getState().phase),
            position: chapterOneSpawnForCheckpoint(story.getState().campaign.chapterProgress.checkpoint)
          });
          respawnAtTick = null;
          result = game.update(0, { horizontal: 0, vertical: 0 }, {});
        }
      } else {
        respawnAtTick = null;
      }
      // 전투 사이 소폭 회복(S6a) — 적 하나를 정리할 때마다 HP +15(결정적 이벤트 기반).
      for (const event of result.enemyEvents) {
        if (event.type === 'enemy-defeated' && game.heal(15) > 0) healNoticeSeconds = 2.5;
      }
      lastEvents = result.combatEvents;
      lastEnemyEvents = result.enemyEvents;
      feedbackCounters.record(result.combatEvents, result.enemyEvents);
      lastFrame = combatView.present(result.state.combat, result.combatEvents);
      lastFrame.hud.signal = result.state.combat.player.signal;
      // 타격감(GF1): 검격 궤적 + 명중·격파 히트스톱.
      sinceAttackSeconds += delta;
      for (const event of result.combatEvents) {
        if (event.type === 'action-started' && event.action === 'dash') {
          dashUsed = true;
        }
        if (event.type === 'action-started' && String(event.action).startsWith('attack')) {
          bladeTrail.trigger(lastFrame.player.position, lastFrame.player.facing, result.state.combat.chain.level);
          sinceAttackSeconds = 0;
        } else if (event.type === 'target-defeated') {
          hitStop = Math.min(0.12, hitStop + 0.11);
        } else if (event.type === 'target-hit') {
          hitStop = Math.min(0.12, hitStop + 0.055);
        } else if (event.type === 'player-hit') {
          hitStop = Math.min(0.12, hitStop + 0.07);
        }
      }
      bladeTrail.update(delta);
      enemyCast.present(result.state.encounter, result.enemyEvents);
      enemyHpBars.sync(result.state.encounter);
      cast.setPlayerState({
        action: result.state.combat.player.action.name,
        facing: result.state.combat.player.facing,
        moving: horizontal !== 0 || vertical !== 0,
        position: result.state.combat.player.position,
        status: result.state.combat.player.status
      });
      cast.update(delta);
      enemyCast.update(delta);

      currentSegment = closestRouteSegment(chapterOneLevel.segments, lastFrame.player.position.z);
      story.observe({
        combatEvents: result.combatEvents,
        encounter: result.state.encounter,
        segmentId: currentSegment.id
      });
      story.update(delta);
      if (bossGame && currentSegment.id === 'gym-boss-arena') {
        const bossResult = bossGame.update(delta, { playerHp: result.state.combat.player.hp });
        lastBossEvents = bossResult.events;
        bossCast.present(bossResult.state, bossResult.events);
        bossCast.update(delta, bossResult.state);
        // 진입·단계 전환·격려 무전(S5) — 최신 단계 안내가 묵은 재안내를 끊고 나온다(장면당 1회씩).
        const guidanceLines = bossGuidance.observe({
          device: deviceMode(), events: bossResult.events, state: bossResult.state
        });
        if (guidanceLines.length > 0) bossRadio.play(guidanceLines, { interrupt: true });
        if (!bossResolved && bossResult.state.status === 'victory') {
          bossResolved = story.completeBoss();
          if (bossResolved) bossOptions.onPatchReady?.((patchId) => {
            if (selectPatch(patchId)) resultVisible = true;
          });
        }
      }
      const feedbackFrame = presentSchoolFeedback({
        bossGame, currentSegment, feedback, frame: lastFrame, lastBossEvents, result
      });
      feedbackPrompts = respawnAtTick !== null
        ? [...feedbackFrame.prompts, { id: 'respawn-wait', label: '신호가 끊겼다… 체크포인트에서 다시 일어난다' }]
        : feedbackFrame.prompts;
      // 보스 동사 프롬프트(S5) — 빔 윈드업·명단 등장·코어 개방 동안 눌러야 할 키를 짚는다.
      if (bossGame && currentSegment.id === 'gym-boss-arena') {
        feedbackPrompts = [...feedbackPrompts, ...bossGuidancePrompts(bossGame.getState(), deviceMode())];
      }
      // 게이트 안내(S6a) — 잠긴 문 앞에서는 이유를 칩으로 보여 주고, 게이트당 무전 1회.
      if (activeGate && respawnAtTick === null
        && result.state.combat.player.position.y <= activeGate.minZ + 1.6) {
        feedbackPrompts = [...feedbackPrompts, {
          id: `gate-${activeGate.id}`, label: activeGate.prompt[deviceMode()]
        }];
        if (!gateRadioPlayed.has(activeGate.id)) {
          gateRadioPlayed.add(activeGate.id);
          bossRadio.play([activeGate.radio[deviceMode()]]);
        }
      }
      // 기억 단말 무반응 안내(S6a) — 결정 단계가 아닐 때 E/F를 눌러도 조용히 넘기지 않는다.
      const storyPhaseNow = story.getState().phase;
      if (currentSegment.id === 'memory-backup-decision'
        && !['memory-decision', 'memory-traced', 'memory-secure-ready'].includes(storyPhaseNow)
        && result.combatEvents.some((event) => (
          event.type === 'action-missed' && ['trace', 'secure'].includes(event.action)
        ))) {
        terminalNoticeSeconds = 2.6;
      }
      if (terminalNoticeSeconds > 0) {
        terminalNoticeSeconds = Math.max(0, terminalNoticeSeconds - delta);
        feedbackPrompts = [...feedbackPrompts, {
          id: 'terminal-idle', label: '단말이 조용하다 — 지금은 결정 단계가 아니야'
        }];
      }
      if (healNoticeSeconds > 0) {
        healNoticeSeconds = Math.max(0, healNoticeSeconds - delta);
        feedbackPrompts = [...feedbackPrompts, { id: 'hp-recovered', label: '기록 정리 — HP 회복 +15' }];
      }
      // DASH 온보딩(S6a) — 추격 구간 첫 진입에 무전 1회, 첫 대시 전까지 키/버튼 칩.
      if (!dashHintPlayed && currentSegment.id === 'scanner-pursuit' && storyPhaseNow === 'pursuit') {
        dashHintPlayed = true;
        bossRadio.play([{
          durationMs: 3600, id: 'dash-hint', speaker: 'DOT',
          textKo: deviceMode() === 'touch'
            ? '스캐너 구간이야 — 회피 버튼으로 단숨에 빠져나가!'
            : '스캐너 구간이야 — Space 대시로 단숨에 빠져나가!'
        }]);
      }
      if (!dashUsed && currentSegment.id === 'scanner-pursuit' && respawnAtTick === null) {
        feedbackPrompts = [...feedbackPrompts, {
          id: 'hint-dash',
          label: deviceMode() === 'touch' ? '회피 버튼 — 빠르게 이동' : 'SPACE 대시 — 빠르게 이동'
        }];
      }
      // 보스 안내 무전 시간 흐름 — 스토리 무전이 말하는 동안은 멈춰 두었다가 이어서 나온다.
      bossGuidance.update(delta);
      if (story.getRadioLine() === null) bossRadio.update(delta);
      // 조작 온보딩 — 교전권(원거리 포함, 리시 반경 12) 안에 살아 있는 적이 있는데
      // 4초 넘게 공격이 없으면 공격 키를 짚어 준다.
      const foeNearby = result.state.encounter.enemies.some((enemy) => (
        enemy.phase !== 'defeat'
        && Math.hypot(enemy.position.x - lastFrame.player.position.x, enemy.position.z - lastFrame.player.position.z) < 12
      ));
      if (foeNearby && sinceAttackSeconds > 4 && respawnAtTick === null) {
        feedbackPrompts = [...feedbackPrompts, { id: 'hint-attack', label: 'SIGNAL BLADE — J 키 (터치: ⚔)' }];
      }
      if (feedbackFrame.shake > 0) cameraState = addCameraShake(cameraState, feedbackFrame.shake);
      feedback.update(delta);
      const cueIndex = chapterOneLevel.segments.findIndex((segment) => segment.id === currentSegment.id);
      const cameraFrame = updateSchoolCamera({
        bossEnabled: bossGame !== null, camera, cameraState, currentSegment, delta,
        encounter: result.state.encounter, frame: lastFrame, routeCue: route.routeCues[cueIndex],
        viewport: getSceneViewport(canvas)
      });
      activeTargets = cameraFrame.targets;
      cameraState = cameraFrame.cameraState;
      combatSafeArea = cameraFrame.combatSafeArea;
      // 카메라 확정 후 빌보드 회전 — HP 링이 항상 화면을 향한다.
      enemyHpBars.face(camera);
      syncHud();
      renderer.render(scene, camera);
      performanceProbe.record(delta);
    }
  });
}
