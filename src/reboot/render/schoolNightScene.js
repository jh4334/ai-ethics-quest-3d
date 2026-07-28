import * as THREE from 'three';

import { createGameRuntime } from '../app/gameRuntime.js';
import {
  createCameraController, getFramingReport, updateCameraController
} from '../camera/controller.js';
import { createCharacterCast } from '../characters/cast.js';
import { chapterOneLevel } from '../content/levels/chapter1.js';
import { createCombatPresentationAdapter } from './combatPresentation.js';
import { createDisposableRegistry } from './dispose.js';
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

function cameraTargets(frame, routeCue) {
  const threat = frame.targets.find((target) => !target.defeated) ?? frame.player;
  const traceTarget = frame.targets.find((target) => target.id === 'memory-backup') ?? threat;
  return {
    player: { id: 'player', ...frame.player.position },
    threat: { id: threat.id, ...threat.position },
    traceTarget: { id: traceTarget.id, ...traceTarget.position },
    routeCue: { id: routeCue.id, ...routeCue.position }
  };
}

export function createSchoolNightScene({
  canvas, input, renderer, startPosition = { x: 0, y: 0 }, ui = {}, windowRef = window
}) {
  const resources = createDisposableRegistry();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050918);
  scene.fog = new THREE.Fog(0x050918, 24, 55);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 90);
  const route = resources.register(createSchoolRoute({ level: chapterOneLevel, scene }), 'school-route');
  const cast = resources.register(createCharacterCast({ scene }), 'character-cast');
  const game = createGameRuntime({ startPosition });
  const combatView = createCombatPresentationAdapter();
  scene.add(new THREE.HemisphereLight(0xb5c6ff, 0x271626, 2.35));

  let entered = false;
  let unsubscribeInput = null;
  let currentSegment = closestSegment(startPosition.y);
  let lastEvents = [];
  let lastFrame = combatView.present(game.getState(), []);
  const initialCueIndex = chapterOneLevel.segments.findIndex((segment) => segment.id === currentSegment.id);
  let activeTargets = cameraTargets(lastFrame, route.routeCues[initialCueIndex]);
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
    if (ui.objective) ui.objective.textContent = OBJECTIVES[currentSegment.id];
    canvas.dataset.combatTick = String(lastFrame.tick);
    canvas.dataset.cameraMode = viewportFor(canvas).mode;
    canvas.dataset.routeSegment = currentSegment.id;
    const started = lastEvents.find((event) => event.type === 'action-started');
    if (started) canvas.dataset.lastAction = started.action;
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
      canvas.dataset.lastAction = 'none';
      cast.load().then(() => {
        if (!entered) return;
        const debug = cast.getDebugState();
        canvas.dataset.characterCount = String(debug.loaded);
        canvas.dataset.characters = debug.errors.length === 0 ? 'ready' : 'error';
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
      const result = game.update(delta, { horizontal, vertical });
      lastEvents = result.events;
      lastFrame = combatView.present(result.state, result.events);
      cast.setPlayerState({
        action: result.state.player.action.name,
        facing: result.state.player.facing,
        moving: horizontal !== 0 || vertical !== 0,
        position: result.state.player.position,
        status: result.state.player.status
      });
      cast.update(delta);

      currentSegment = closestSegment(lastFrame.player.position.z);
      const cueIndex = chapterOneLevel.segments.findIndex((segment) => segment.id === currentSegment.id);
      activeTargets = cameraTargets(lastFrame, route.routeCues[cueIndex]);
      cameraState = updateCameraController(cameraState, activeTargets, delta, viewportFor(canvas));
      camera.position.set(cameraState.position.x, cameraState.position.y, cameraState.position.z);
      camera.fov = cameraState.fov;
      camera.updateProjectionMatrix();
      camera.lookAt(cameraState.lookAt.x, cameraState.lookAt.y, cameraState.lookAt.z);
      syncHud();
      renderer.render(scene, camera);
    }
  });
}
