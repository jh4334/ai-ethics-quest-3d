import * as THREE from 'three';

import { createEncounterGameRuntime } from '../app/encounterGameRuntime.js';
import {
  createCameraController, getFramingReport, updateCameraController
} from '../camera/controller.js';
import { createCharacterCast } from '../characters/cast.js';
import { chapterOneLevel } from '../content/levels/chapter1.js';
import { createCombatPresentationAdapter } from './combatPresentation.js';
import { createDisposableRegistry } from './dispose.js';
import { createEnemyCast } from './enemyCast.js';
import { createSchoolRoute } from './schoolRoute.js';

const OBJECTIVES = Object.freeze({
  'classroom-cold-open': '교실 기록 단말로 이동',
  'collapsing-corridor': '무너지는 복도를 통과',
  'first-arena': '지우개 요원의 빈틈을 추적',
  'memory-backup-decision': '하루의 기억 백업을 확보',
  'scanner-pursuit': '스캐너 추격을 따돌리기',
  'gym-boss-arena': '출석 감독관과 대면'
});

function closestSegment(z) {
  return chapterOneLevel.segments.reduce((closest, segment) => (
    Math.abs(segment.anchor.z - z) < Math.abs(closest.anchor.z - z) ? segment : closest
  ));
}

function viewportFor(canvas) {
  const width = Math.max(canvas.clientWidth, 1);
  const height = Math.max(canvas.clientHeight, 1);
  return { height, mode: width <= 820 ? 'touch' : 'desktop', width };
}

function cameraTargets(frame, routeCue, encounter) {
  const committed = encounter.enemies.find((enemy) => ['windup', 'active'].includes(enemy.phase));
  const nearest = encounter.enemies
    .filter((enemy) => enemy.phase !== 'defeat')
    .toSorted((first, second) => (
      Math.hypot(first.position.x - frame.player.position.x, first.position.z - frame.player.position.z)
      - Math.hypot(second.position.x - frame.player.position.x, second.position.z - frame.player.position.z)
    ))[0];
  const threatId = committed?.id ?? nearest?.id;
  const threat = frame.targets.find((target) => target.id === threatId) ?? frame.player;
  const traceTarget = frame.targets.find((target) => target.id === 'memory-backup') ?? threat;
  const cue = committed ? { id: routeCue.id, ...threat.position } : routeCue.position;
  return {
    player: { id: 'player', ...frame.player.position },
    threat: { id: threat.id, ...threat.position },
    traceTarget: { id: traceTarget.id, ...traceTarget.position },
    routeCue: { id: routeCue.id, ...cue }
  };
}

export function createSchoolNightScene({
  canvas, encounterOptions = {}, input, renderer,
  startPosition = { x: 0, y: 0 }, ui = {}, windowRef = window
}) {
  const resources = createDisposableRegistry();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050918);
  scene.fog = new THREE.Fog(0x050918, 24, 55);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 90);
  const route = resources.register(createSchoolRoute({ level: chapterOneLevel, scene }), 'school-route');
  const cast = resources.register(createCharacterCast({ scene }), 'character-cast');
  const enemyCast = resources.register(createEnemyCast({ scene }), 'enemy-cast');
  const {
    blockAfterTick = null,
    delayedBlockers = [],
    offscreenAfterTick = null,
    ...runtimeEncounterOptions
  } = encounterOptions;
  const game = createEncounterGameRuntime({
    deviceClass: viewportFor(canvas).mode,
    startPosition,
    ...runtimeEncounterOptions
  });
  const combatView = createCombatPresentationAdapter();
  scene.add(new THREE.HemisphereLight(0xb5c6ff, 0x271626, 2.35));

  let entered = false;
  let unsubscribeInput = null;
  let currentSegment = closestSegment(startPosition.y);
  let lastEvents = [];
  let lastEnemyEvents = [];
  let armorBreaks = 0;
  let reflections = 0;
  let playerHits = 0;
  let cancelledAttacks = 0;
  let lastFrame = combatView.present(game.getState().combat, []);
  const initialCueIndex = chapterOneLevel.segments.findIndex((segment) => segment.id === currentSegment.id);
  let activeTargets = cameraTargets(lastFrame, route.routeCues[initialCueIndex], game.getState().encounter);
  let cameraState = createCameraController(activeTargets, viewportFor(canvas));

  function resize() {
    const viewport = viewportFor(canvas);
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.width, viewport.height, false);
  }

  function syncHud() {
    if (ui.health) ui.health.textContent = `HP ${lastFrame.hud.hp}`;
    if (ui.action) ui.action.textContent = lastFrame.hud.action.toUpperCase();
    if (ui.chain) ui.chain.textContent = `SYNC ${lastFrame.hud.chainLevel}`;
    if (ui.enemy) {
      const eraser = game.getState().encounter.enemies.find((enemy) => enemy.definition.id === 'eraser');
      ui.enemy.textContent = `ARMOR ${eraser?.armor ?? 0}`;
    }
    if (ui.objective) ui.objective.textContent = OBJECTIVES[currentSegment.id];
    canvas.dataset.combatTick = String(lastFrame.tick);
    canvas.dataset.cameraMode = viewportFor(canvas).mode;
    canvas.dataset.routeSegment = currentSegment.id;
    const encounter = game.getState().encounter;
    canvas.dataset.enemyCount = String(encounter.enemies.length);
    canvas.dataset.enemyPhases = encounter.enemies.map((enemy) => `${enemy.id}:${enemy.phase}`).join(',');
    canvas.dataset.enemyPhaseTicks = encounter.enemies
      .map((enemy) => `${enemy.id}:${enemy.phaseTick}`)
      .join(',');
    const stamper = encounter.enemies.find((enemy) => enemy.definition.id === 'stamper');
    canvas.dataset.stamperTelegraph = stamper ? `${stamper.phase}:${stamper.phaseTick}` : 'missing';
    canvas.dataset.eraserArmor = String(
      encounter.enemies.find((enemy) => enemy.definition.id === 'eraser')?.armor ?? 0
    );
    canvas.dataset.armorBreaks = String(armorBreaks);
    canvas.dataset.reflections = String(reflections);
    canvas.dataset.playerHits = String(playerHits);
    canvas.dataset.cancelledAttacks = String(cancelledAttacks);
    canvas.dataset.blockerActive = String(
      Number.isInteger(blockAfterTick) && encounter.tick >= blockAfterTick
    );
    canvas.dataset.offscreenActive = String(
      Number.isInteger(offscreenAfterTick) && encounter.tick >= offscreenAfterTick
    );
    const started = lastEvents.find((event) => event.type === 'action-started');
    if (started) canvas.dataset.lastAction = started.action;
    const enemyEvent = lastEnemyEvents.at(-1);
    if (enemyEvent) canvas.dataset.lastEnemyEvent = enemyEvent.type;
  }

  function queueAction({ action, active }) {
    if (!active || !['attack', 'dash', 'reflect', 'trace', 'secure'].includes(action)) return;
    const targetId = ['trace', 'secure'].includes(action) ? 'memory-backup' : null;
    game.queueAction(action, targetId);
  }

  return Object.freeze({
    dispose() {
      unsubscribeInput?.();
      resources.disposeAll();
    },
    enter() {
      if (entered) return;
      entered = true;
      resize();
      unsubscribeInput = input.subscribe(queueAction);
      canvas.dataset.characters = 'loading';
      canvas.dataset.enemies = 'loading';
      canvas.dataset.lastAction = 'none';
      canvas.dataset.lastEnemyEvent = 'none';
      Promise.all([cast.load(), enemyCast.load(game.getState().encounter)]).then(() => {
        if (!entered) return;
        const castDebug = cast.getDebugState();
        const enemyDebug = enemyCast.getDebugState();
        canvas.dataset.characterCount = String(castDebug.loaded + enemyDebug.loaded);
        canvas.dataset.characters = castDebug.errors.length === 0 ? 'ready' : 'error';
        canvas.dataset.enemies = enemyDebug.errors.length === 0 ? 'ready' : 'error';
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
        camera: getFramingReport(cameraState, activeTargets, viewportFor(canvas)),
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
        routeSegmentId: currentSegment.id
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

      currentSegment = closestSegment(lastFrame.player.position.z);
      const cueIndex = chapterOneLevel.segments.findIndex((segment) => segment.id === currentSegment.id);
      activeTargets = cameraTargets(lastFrame, route.routeCues[cueIndex], result.state.encounter);
      cameraState = updateCameraController(cameraState, activeTargets, delta, viewportFor(canvas));
      const combatFocus = currentSegment.id === 'first-arena'
        && result.state.encounter.enemies.some((enemy) => ['windup', 'active'].includes(enemy.phase));
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
