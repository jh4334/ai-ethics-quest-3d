import * as THREE from 'three';

import { createEncounterGameRuntime } from '../app/encounterGameRuntime.js';
import { createBossGameRuntime } from '../app/bossGameRuntime.js';
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
import { createBladeTrail } from './bladeTrail.js';
import { createCombatPresentationAdapter } from './combatPresentation.js';
import { createBossCast } from './bossCast.js';
import { createDisposableRegistry } from './dispose.js';
import { createEnemyCast } from './enemyCast.js';
import { createEnemyHpBars } from './enemyHpBars.js';
import { createSchoolAtmosphere } from './schoolAtmosphere.js';
import { createSchoolRoute } from './schoolRoute.js';
import { createSchoolSceneDebugSnapshot } from './schoolSceneDebug.js';
import { closestRouteSegment, getBossCameraTargets, getEncounterCameraTargets, getSceneViewport, updateSchoolCamera } from './schoolSceneCamera.js';
import { loadSchoolSceneCast } from './schoolSceneCastLoader.js';
import { createSchoolSceneHud } from './schoolSceneHud.js';

export function createSchoolNightScene({
  bossOptions = {}, canvas, encounterOptions = {}, input, renderer,
  startPosition = { x: 0, y: 0 }, storyOptions = {}, ui = {}, windowRef = window
}) {
  const resources = createDisposableRegistry();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050918);
  scene.fog = new THREE.Fog(0x050918, 24, 55);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 90);
  const route = resources.register(createSchoolRoute({ level: chapterOneLevel, lightLimit: 3, scene }), 'school-route');
  resources.register(createSchoolAtmosphere({ level: chapterOneLevel, scene }), 'school-atmosphere');
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
  const game = createEncounterGameRuntime({
    deviceClass: getSceneViewport(canvas).mode,
    startPosition,
    // 통행 경계 — 레벨 collision 레이어에서 유도. 복도·아레나·체육관 전 구간 밖으로 못 나간다.
    walkable: walkableRectsFromLevel(chapterOneLevel),
    ...runtimeEncounterOptions
  });
  const combatView = createCombatPresentationAdapter();
  const story = createChapterOneDirector(storyOptions);
  const bossGame = bossOptions.enabled ? createBossGameRuntime({
    consequencePath: story.getState().memoryOutcome ?? 'secure',
    initialState: bossOptions.initialState
  }) : null;
  const feedback = resources.register(createFeedbackDirector({
    capacity: renderer.userData.rebootQuality.feedbackCapacity,
    motion: story.getState().campaign.settings.motion,
    scene,
    sound: story.getState().campaign.settings.sound,
    windowRef
  }), 'combat-feedback');
  const feedbackCounters = createFeedbackCounters();
  scene.add(new THREE.HemisphereLight(0xb5c6ff, 0x271626, 2.35));
  const performanceProbe = createScenePerformanceProbe({ feedback, renderer, scene, windowRef });

  let entered = false, unsubscribeInput = null;
  let currentSegment = closestRouteSegment(chapterOneLevel.segments, startPosition.y);
  // 쓰러짐 복귀 — defeat는 영구 상태가 아니라 대기 후 체크포인트(장면 시작) 재기동.
  // 시뮬 고정 틱으로 재며(150틱 = 2.5초), 이야기(story)·보스 재도전 카운트는 유지된다(무처벌).
  const RESPAWN_DELAY_TICKS = 150;
  let respawnAtTick = null;
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
      radioLine: story.getRadioLine(),
      resultVisible,
      routeSegmentId: currentSegment.id,
      storyOutcome: resultVisible ? story.getOutcome() : null,
      storyState,
      viewportMode: getSceneViewport(canvas).mode
    });
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
      resize();
      unsubscribeInput = input.subscribe(queueAction);
      feedback.attach();
      story.start();
      canvas.dataset.characters = 'loading';
      canvas.dataset.enemies = 'loading';
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
        route, story
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
      let result = game.update(stopped ? 0 : delta, { horizontal, vertical }, {
        blockers: blockerActive ? delayedBlockers : undefined,
        onScreen: offscreenActive ? false : undefined
      });
      if (result.state.combat.player.status === 'defeated') {
        if (respawnAtTick === null) respawnAtTick = result.state.combat.tick + RESPAWN_DELAY_TICKS;
        if (result.state.combat.tick >= respawnAtTick) {
          game.reset();
          respawnAtTick = null;
          result = game.update(0, { horizontal: 0, vertical: 0 }, {});
        }
      } else {
        respawnAtTick = null;
      }
      lastEvents = result.combatEvents;
      lastEnemyEvents = result.enemyEvents;
      feedbackCounters.record(result.combatEvents, result.enemyEvents);
      lastFrame = combatView.present(result.state.combat, result.combatEvents);
      lastFrame.hud.signal = result.state.combat.player.signal;
      // 타격감(GF1): 검격 궤적 + 명중·격파 히트스톱.
      sinceAttackSeconds += delta;
      for (const event of result.combatEvents) {
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
