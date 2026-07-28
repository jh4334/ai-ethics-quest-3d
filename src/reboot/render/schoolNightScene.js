import * as THREE from 'three';

import { createEncounterGameRuntime } from '../app/encounterGameRuntime.js';
import { createBossGameRuntime } from '../app/bossGameRuntime.js';
import { resolveBossVictory } from '../bosses/rewards.js';
import { createCameraController, getFramingReport, updateCameraController } from '../camera/controller.js';
import { createCharacterCast } from '../characters/cast.js';
import { chapterOneLevel } from '../content/levels/chapter1.js';
import { createChapterOneDirector } from '../story/chapterOneDirector.js';
import { createCombatPresentationAdapter } from './combatPresentation.js';
import { createBossCast } from './bossCast.js';
import { createDisposableRegistry } from './dispose.js';
import { createEnemyCast } from './enemyCast.js';
import { createSchoolRoute } from './schoolRoute.js';
import {
  closestRouteSegment, getBossCameraTargets, getEncounterCameraTargets, getSceneViewport
} from './schoolSceneCamera.js';
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
  const route = resources.register(createSchoolRoute({ level: chapterOneLevel, scene }), 'school-route');
  const cast = resources.register(createCharacterCast({ scene }), 'character-cast');
  const enemyCast = resources.register(createEnemyCast({ scene }), 'enemy-cast');
  const bossCast = bossOptions.enabled
    ? resources.register(createBossCast({ scene }), 'boss-cast')
    : null;
  const {
    blockAfterTick = null,
    delayedBlockers = [],
    offscreenAfterTick = null,
    ...runtimeEncounterOptions
  } = encounterOptions;
  const game = createEncounterGameRuntime({
    deviceClass: getSceneViewport(canvas).mode,
    startPosition,
    ...runtimeEncounterOptions
  });
  const combatView = createCombatPresentationAdapter();
  const story = createChapterOneDirector(storyOptions);
  const bossGame = bossOptions.enabled ? createBossGameRuntime({
    consequencePath: story.getState().memoryOutcome ?? 'secure'
  }) : null;
  scene.add(new THREE.HemisphereLight(0xb5c6ff, 0x271626, 2.35));

  let entered = false;
  let unsubscribeInput = null;
  let currentSegment = closestRouteSegment(chapterOneLevel.segments, startPosition.y);
  let lastEvents = [];
  let lastEnemyEvents = [];
  let armorBreaks = 0;
  let reflections = 0;
  let playerHits = 0;
  let cancelledAttacks = 0;
  let lastBossEvents = [];
  let bossResolved = false;
  let resultVisible = storyOptions.showOutcome === true;
  let lastFrame = combatView.present(game.getState().combat, []);
  const initialCueIndex = chapterOneLevel.segments.findIndex((segment) => segment.id === currentSegment.id);
  let activeTargets = bossGame && currentSegment.id === 'gym-boss-arena'
    ? getBossCameraTargets(lastFrame, route.routeCues[initialCueIndex])
    : getEncounterCameraTargets(lastFrame, route.routeCues[initialCueIndex], game.getState().encounter);
  let cameraState = createCameraController(activeTargets, getSceneViewport(canvas));
  const hud = createSchoolSceneHud({ canvas, ui });

  function resize() {
    const viewport = getSceneViewport(canvas);
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.width, viewport.height, false);
  }

  function syncHud() {
    const encounter = game.getState().encounter;
    const storyState = story.getState();
    hud.sync({
      blockerActive: Number.isInteger(blockAfterTick) && encounter.tick >= blockAfterTick,
      bossEvents: lastBossEvents,
      bossState: bossGame && currentSegment.id === 'gym-boss-arena' ? bossGame.getState() : null,
      counters: { armorBreaks, cancelledAttacks, playerHits, reflections },
      encounter,
      frame: lastFrame,
      lastEnemyEvents,
      lastEvents,
      offscreenActive: Number.isInteger(offscreenAfterTick) && encounter.tick >= offscreenAfterTick,
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
    if (action === 'purge') {
      story.memoryAction('purge');
      return;
    }
    if (!['attack', 'dash', 'reflect', 'trace', 'secure'].includes(action)) return;
    const targetId = ['trace', 'secure'].includes(action) ? 'memory-backup' : null;
    game.queueAction(action, targetId);
    bossGame?.queueAction(action);
  }

  function selectPatch(patchId) {
    if (!bossGame || bossGame.getState().status !== 'victory') return false;
    const reward = resolveBossVictory(story.getState().campaign, bossGame.getState(), patchId);
    storyOptions.persist?.(reward.state);
    resultVisible = true;
    bossOptions.onPatchResolved?.();
    canvas.dataset.patchChoice = patchId;
    canvas.dataset.savedChapter = String(reward.state.chapterProgress.current);
    canvas.dataset.savedEvidenceCount = String(reward.state.evidence.length);
    return true;
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
      story.start();
      canvas.dataset.characters = 'loading';
      canvas.dataset.enemies = 'loading';
      canvas.dataset.lastAction = 'none';
      canvas.dataset.lastEnemyEvent = 'none';
      Promise.all([
        cast.load(), enemyCast.load(game.getState().encounter), bossCast?.load()
      ]).then(() => {
        if (!entered) return;
        const castDebug = cast.getDebugState();
        const enemyDebug = enemyCast.getDebugState();
        canvas.dataset.characterCount = String(
          castDebug.loaded + enemyDebug.loaded + (bossCast?.getDebugState().loaded ? 1 : 0)
        );
        canvas.dataset.characters = castDebug.errors.length === 0 ? 'ready' : 'error';
        canvas.dataset.enemies = enemyDebug.errors.length === 0 ? 'ready' : 'error';
        canvas.dataset.boss = bossCast && bossCast.getDebugState().errors.length === 0 ? 'ready' : 'disabled';
      });
      windowRef.addEventListener('resize', resize);
      syncHud();
    },
    exit() {
      if (!entered) return;
      entered = false;
      unsubscribeInput?.();
      unsubscribeInput = null;
      windowRef.removeEventListener('resize', resize);
    },
    getDebugState() {
      return Object.freeze({
        boss: bossGame?.getState() ?? null,
        camera: getFramingReport(cameraState, activeTargets, getSceneViewport(canvas)),
        characters: cast.getDebugState(),
        combat: Object.freeze({
          action: lastFrame.hud.action,
          chainLevel: lastFrame.hud.chainLevel,
          hp: lastFrame.hud.hp,
          tick: lastFrame.tick
        }),
        enemies: enemyCast.getDebugState(),
        enemyEventTypes: Object.freeze(lastEnemyEvents.map((event) => event.type)),
        encounter: game.getState().encounter,
        eventTypes: Object.freeze(lastEvents.map((event) => event.type)),
        route: route.getDebugState(),
        routeSegmentId: currentSegment.id,
        story: story.getState()
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
      const result = game.update(
        delta,
        { horizontal, vertical },
        {
          blockers: blockerActive ? delayedBlockers : undefined,
          onScreen: offscreenActive ? false : undefined
        }
      );
      lastEvents = result.combatEvents;
      lastEnemyEvents = result.enemyEvents;
      armorBreaks += result.enemyEvents.filter((event) => event.type === 'armor-broken').length;
      reflections += result.combatEvents.filter((event) => ['reflected', 'perfect-reflect'].includes(event.type)).length;
      playerHits += result.combatEvents.filter((event) => event.type === 'player-hit').length;
      cancelledAttacks += result.enemyEvents.filter((event) => event.type === 'attack-cancelled').length;
      lastFrame = combatView.present(result.state.combat, result.combatEvents);
      enemyCast.present(result.state.encounter, result.enemyEvents);
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
          if (bossResolved) bossOptions.onPatchReady?.(selectPatch);
        }
      }
      const cueIndex = chapterOneLevel.segments.findIndex((segment) => segment.id === currentSegment.id);
      activeTargets = bossGame && currentSegment.id === 'gym-boss-arena'
        ? getBossCameraTargets(lastFrame, route.routeCues[cueIndex])
        : getEncounterCameraTargets(lastFrame, route.routeCues[cueIndex], result.state.encounter);
      cameraState = updateCameraController(cameraState, activeTargets, delta, getSceneViewport(canvas));
      const combatFocus = (currentSegment.id === 'first-arena'
        && result.state.encounter.enemies.some((enemy) => ['windup', 'active'].includes(enemy.phase)))
        || (bossGame && currentSegment.id === 'gym-boss-arena');
      camera.position.set(
        cameraState.position.x,
        cameraState.position.y - (combatFocus ? 2 : 0),
        cameraState.position.z - (combatFocus ? 5 : 0)
      );
      camera.fov = combatFocus ? 36 : cameraState.fov;
      camera.updateProjectionMatrix();
      camera.lookAt(cameraState.lookAt.x, cameraState.lookAt.y, cameraState.lookAt.z);
      syncHud();
      renderer.render(scene, camera);
    }
  });
}
