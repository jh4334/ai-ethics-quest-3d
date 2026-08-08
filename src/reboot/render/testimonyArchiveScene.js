import * as THREE from 'three';

import { createEncounterGameRuntime } from '../app/encounterGameRuntime.js';
import { completeCampaignChapter } from '../campaign/chapterProgression.js';
import {
  TESTIMONY_ZONES,
  advanceTestimonyArchive,
  getTestimonyEncounter,
  restoreTestimonyArchiveProgress,
  testimonyArchiveCheckpoint
} from '../campaign/testimonyArchive.js';
import { createCharacterFactory } from '../characters/factory.js';
import { PLAYER_RULES } from '../content/actions.js';
import { CHAPTER_FIVE } from '../content/chapters/catalog.js';
import { chapterFiveLevel } from '../content/levels/chapter5.js';
import { walkableRectsFromLevel } from '../level/walkableBounds.js';
import { createScenePerformanceProbe } from '../perf/sceneProbe.js';
import { setChapterCheckpoint } from '../state/consequences.js';
import { createBladeTrail } from './bladeTrail.js';
import { createDisposableRegistry } from './dispose.js';
import { createEnemyCast } from './enemyCast.js';
import { createEnemyHpBars } from './enemyHpBars.js';
import { createSceneRadio } from './sceneRadio.js';
import { createSchoolRoute } from './schoolRoute.js';
import { getSceneViewport } from './schoolSceneCamera.js';
import { createTestimonyArchiveEnvironment } from './testimonyArchiveEnvironment.js';

const CAST = Object.freeze([
  Object.freeze({ id: 'player', position: [0, 0, 3], rotation: Math.PI }),
  Object.freeze({ id: 'haru', position: [-3.2, 0, -70], rotation: 0 }),
  Object.freeze({ id: 'dot', position: [3.1, 0, -69], rotation: 0 })
]);

const ACTION_LABELS = Object.freeze({
  attack: 'SIGNAL BLADE',
  decision: 'F 확보 · Q 소거',
  reflect: 'K 반사',
  trace: 'E 추적'
});

function fillPercent(value, max) {
  if (!Number.isFinite(value) || !(max > 0)) return null;
  return `${Math.max(0, Math.min(100, Math.round((value / max) * 100)))}%`;
}

function syncGauge(ui, { container, fill, label }, text, width) {
  if (ui[label]) ui[label].textContent = text;
  else if (ui[container]) ui[container].textContent = text;
  if (ui[fill]?.style && width !== null) ui[fill].style.width = width;
}

function nearestLivingEnemyId(game) {
  const { combat, encounter } = game.getState();
  return encounter.enemies
    .filter((enemy) => enemy.phase !== 'defeat')
    .toSorted((left, right) => (
      Math.hypot(left.position.x - combat.player.position.x, left.position.z - combat.player.position.y)
      - Math.hypot(right.position.x - combat.player.position.x, right.position.z - combat.player.position.y)
    ))[0]?.id ?? null;
}

export function createTestimonyArchiveScene({
  campaign, canvas, input, persist, renderer, ui = {}, windowRef = window
}) {
  if (!campaign || campaign.chapterProgress.current !== 5) {
    throw new RangeError('증언 보관소는 5장 저장 상태에서만 시작할 수 있습니다.');
  }
  const resources = createDisposableRegistry();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050918);
  scene.fog = new THREE.Fog(0x050918, 34, 104);
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 120);
  const route = resources.register(createSchoolRoute({ level: chapterFiveLevel, lightLimit: 0, scene }), 'testimony-route');
  route.group.visible = false;
  const environment = resources.register(createTestimonyArchiveEnvironment({ scene }), 'testimony-environment');
  const factory = resources.register(createCharacterFactory(), 'testimony-character-factory');
  const enemyHpBars = resources.register(createEnemyHpBars({ scene }), 'testimony-enemy-bars');
  const bladeTrail = resources.register(createBladeTrail({ scene }), 'testimony-blade-trail');
  scene.add(new THREE.HemisphereLight(0xa9c4f2, 0x2c1924, 2.25));
  const archiveLight = new THREE.PointLight(0xffb55f, 5.6, 44, 1.75);
  archiveLight.position.set(0, 7, -70);
  archiveLight.castShadow = false;
  scene.add(archiveLight);
  const performanceProbe = createScenePerformanceProbe({ renderer, scene, windowRef });

  const castRoot = new THREE.Group();
  castRoot.name = 'testimony-character-cast';
  scene.add(castRoot);
  const anchors = new Map();
  for (const entry of CAST) {
    const anchor = new THREE.Group();
    anchor.position.set(...entry.position);
    anchor.rotation.y = entry.rotation;
    castRoot.add(anchor);
    anchors.set(entry.id, anchor);
  }

  const characters = new Map();
  const errors = [];
  const enemyCasts = [];
  const allWalkable = walkableRectsFromLevel(chapterFiveLevel);
  const radio = createSceneRadio(ui);
  let activeCampaign = campaign;
  let progress = restoreTestimonyArchiveProgress(campaign.chapterProgress.checkpoint);
  let entered = false;
  let unsubscribeInput = null;
  let portrait = false;
  let completed = null;
  let enemyReady = false;
  let environmentReady = false;
  let hitStop = 0;
  let respawnAtTick = null;

  function checkpointSpawn() {
    if (campaign.chapterProgress.checkpoint === 'chapter-5:start') return { x: 0, y: 3 };
    return { x: 0, y: TESTIMONY_ZONES[progress.zoneIndex].anchorZ + 5 };
  }

  function createGame(startPosition) {
    const zone = TESTIMONY_ZONES[progress.zoneIndex];
    const runtime = createEncounterGameRuntime({
      deviceClass: getSceneViewport(canvas).mode,
      encounterDefinition: getTestimonyEncounter(progress.zoneIndex),
      encounterOrigin: { x: 0, z: zone.anchorZ },
      extraTargets: [],
      startFacing: { x: 0, y: -1 },
      startPosition,
      walkable: allWalkable.slice(0, progress.zoneIndex + 1)
    });
    if (progress.phase !== 'combat') runtime.clearEnemiesForCheckpoint();
    return runtime;
  }

  let game = createGame(checkpointSpawn());

  function saveProgress() {
    activeCampaign = setChapterCheckpoint(activeCampaign, 5, testimonyArchiveCheckpoint(progress));
    persist?.(activeCampaign);
  }

  function spawnEnemyCast() {
    enemyReady = false;
    const cast = resources.register(
      createEnemyCast({ characterFactory: factory, scene }),
      `testimony-enemies-${progress.zoneIndex}-${enemyCasts.length}`
    );
    enemyCasts.push(cast);
    cast.load(game.getState().encounter).then(() => {
      if (!entered) return;
      errors.push(...cast.getDebugState().errors);
      enemyReady = true;
      cast.present(game.getState().encounter, []);
      syncPresentation();
    }).catch((error) => {
      if (entered) errors.push(error.message);
      syncPresentation();
    });
  }

  function currentEnemyCast() {
    return enemyCasts.at(-1) ?? null;
  }

  async function loadCharacters() {
    const loaded = await Promise.all(CAST.map(async (entry) => {
      try {
        const character = await factory.create(entry.id, { fractured: entry.id === 'dot' });
        return { character, entry };
      } catch (error) {
        if (entered) errors.push(`${entry.id}: ${error.message}`);
        return null;
      }
    }));
    if (!entered) {
      for (const item of loaded) item?.character.dispose();
      return;
    }
    for (const item of loaded) {
      if (!item) continue;
      anchors.get(item.entry.id).add(item.character.root);
      characters.set(item.entry.id, item.character);
    }
    syncPresentation();
  }

  function finish(action) {
    completed = completeCampaignChapter(activeCampaign, 5, action);
    activeCampaign = completed.state;
    persist?.(activeCampaign);
    if (ui.result) {
      ui.result.hidden = false;
      const heading = ui.result.querySelector('h2');
      if (heading) heading.textContent = `${CHAPTER_FIVE.titleKo} 기록`;
    }
    if (ui.resultAction) ui.resultAction.textContent = completed.summaryKo;
    if (ui.resultConsequence) ui.resultConsequence.textContent = CHAPTER_FIVE.reversal.textKo;
    if (ui.resultReversal) ui.resultReversal.textContent = '방송에는 출처·동의·가림 표식이 함께 전달됩니다.';
    if (ui.continueButton) ui.continueButton.hidden = false;
    radio.play(CHAPTER_FIVE.sceneScript.reversalScript, { interrupt: true });
  }

  function advanceClue(action) {
    const previous = progress;
    const next = advanceTestimonyArchive(progress, action);
    if (next === previous) return false;
    const player = game.getState().combat.player.position;
    progress = next;
    saveProgress();
    environment.setActiveZone(progress.zoneIndex);
    game = createGame({ x: player.x, y: player.y });
    spawnEnemyCast();
    radio.play([CHAPTER_FIVE.sceneScript.stepCues[previous.zoneIndex]].filter(Boolean), { interrupt: true });
    return true;
  }

  function queueAction({ action, active }) {
    if (!active || completed) return;
    if (progress.phase === 'decision') {
      if (action === 'secure') finish('secure');
      if (action === 'purge') finish('purge');
      syncPresentation();
      return;
    }
    if (progress.phase === 'clue') {
      advanceClue(action);
      syncPresentation();
      return;
    }
    if (!['attack', 'dash', 'reflect', 'trace'].includes(action)) return;
    game.queueAction(action, action === 'trace' ? nearestLivingEnemyId(game) : null);
  }

  function resize() {
    const viewport = getSceneViewport(canvas);
    portrait = viewport.mode === 'touch' && viewport.height > viewport.width;
    camera.fov = portrait ? 56 : 44;
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.width, viewport.height, false);
    performanceProbe.reset();
  }

  function syncPerformance() {
    const performance = performanceProbe.report();
    canvas.dataset.p95FrameMs = String(performance.p95FrameMs);
    canvas.dataset.drawCalls = String(performance.render.calls);
    canvas.dataset.triangles = String(performance.render.triangles);
    canvas.dataset.lightCount = String(performance.render.lights);
  }

  function updateCamera(position) {
    camera.position.set(position.x + (portrait ? 1.4 : 3), portrait ? 6.4 : 5.2, position.y + (portrait ? 10.8 : 9));
    camera.lookAt(position.x, 1, position.y - (portrait ? 2.5 : 5));
  }

  function syncPresentation() {
    const { combat, encounter } = game.getState();
    const zone = TESTIMONY_ZONES[progress.zoneIndex];
    const alive = encounter.enemies.filter((enemy) => enemy.phase !== 'defeat').length;
    canvas.dataset.campaignChapter = '5';
    canvas.dataset.campaignStep = String(progress.zoneIndex);
    canvas.dataset.campaignExpectedAction = progress.expectedAction;
    canvas.dataset.campaignCompleted = String(completed !== null);
    canvas.dataset.campaignEnemiesAlive = String(progress.phase === 'combat' ? alive : 0);
    canvas.dataset.testimonyZone = zone.id;
    canvas.dataset.testimonyPhase = progress.phase;
    canvas.dataset.environmentStatus = environmentReady ? 'ready' : 'loading';
    canvas.dataset.characters = errors.length > 0
      ? 'error'
      : characters.size === CAST.length && enemyReady && environmentReady ? 'ready' : 'loading';
    canvas.dataset.playerSignal = String(combat.player.signal);
    syncGauge(
      ui, { container: 'health', fill: 'healthFill', label: 'healthLabel' },
      `HP ${combat.player.hp}`, fillPercent(combat.player.hp, PLAYER_RULES.maxHp)
    );
    syncGauge(
      ui, { container: 'signal', fill: 'signalFill', label: 'signalLabel' },
      `SIGNAL ${combat.player.signal}`, fillPercent(combat.player.signal, PLAYER_RULES.maxSignal)
    );
    if (ui.action) ui.action.textContent = ACTION_LABELS[progress.expectedAction] ?? progress.expectedAction.toUpperCase();
    if (ui.chain) ui.chain.textContent = `${progress.zoneIndex + 1}/4 ARCHIVE`;
    if (ui.enemy) ui.enemy.textContent = progress.phase === 'combat' ? `보관소 위협 ×${alive}` : '검증 대기';
    if (ui.objective) ui.objective.textContent = completed
      ? '검증 패키지가 6장 방송 대기열에 연결됐습니다.'
      : progress.phase === 'decision'
        ? zone.clueKo
        : progress.phase === 'clue'
          ? zone.clueKo
          : `${zone.titleKo} — ${zone.encounter.objective}`;
  }

  return Object.freeze({
    dispose() {
      unsubscribeInput?.();
      radio.clear();
      castRoot.removeFromParent();
      resources.disposeAll();
    },
    enter() {
      if (entered) return;
      entered = true;
      resize();
      environment.setActiveZone(progress.zoneIndex);
      unsubscribeInput = input.subscribe(queueAction);
      windowRef.addEventListener('resize', resize);
      environment.ready.then((report) => {
        if (!entered) return;
        environmentReady = report.failedAssetIds.length === 0;
        if (!environmentReady) errors.push(...report.failedAssetIds.map((id) => `환경 에셋: ${id}`));
        syncPresentation();
      });
      loadCharacters();
      spawnEnemyCast();
      radio.play(CHAPTER_FIVE.sceneScript.briefing);
      syncPresentation();
    },
    exit() {
      if (!entered) return;
      entered = false;
      unsubscribeInput?.();
      unsubscribeInput = null;
      windowRef.removeEventListener('resize', resize);
    },
    getDebugState() {
      const { combat, encounter } = game.getState();
      return Object.freeze({
        characters: Object.freeze([...characters.keys()]),
        completed,
        enemies: Object.freeze(encounter.enemies.map(({ hp, id, phase, position }) => Object.freeze({ hp, id, phase, position }))),
        environment: environment.getDebugState(),
        errors: Object.freeze([...errors]),
        performance: performanceProbe.report(),
        player: Object.freeze({ hp: combat.player.hp, position: Object.freeze({ ...combat.player.position }), signal: combat.player.signal }),
        progress,
        route: route.getDebugState()
      });
    },
    update(delta) {
      radio.update(delta);
      const horizontal = Number(input.isActive('move-right')) - Number(input.isActive('move-left'));
      const vertical = Number(input.isActive('move-down')) - Number(input.isActive('move-up'));
      const stopped = hitStop > 0;
      if (stopped) hitStop = Math.max(0, hitStop - delta);
      let result = game.update(stopped ? 0 : delta, { horizontal, vertical }, {});
      for (const event of result.combatEvents) {
        if (event.type === 'action-started' && String(event.action).startsWith('attack')) {
          const player = result.state.combat.player;
          bladeTrail.trigger(
            { x: player.position.x, y: 0, z: player.position.y },
            { x: player.facing.x, y: 0, z: player.facing.y },
            result.state.combat.chain.level
          );
        }
        if (event.type === 'target-defeated') hitStop = Math.min(0.12, hitStop + 0.1);
        if (event.type === 'target-hit') hitStop = Math.min(0.12, hitStop + 0.05);
      }
      currentEnemyCast()?.present(result.state.encounter, result.enemyEvents);
      enemyHpBars.sync(result.state.encounter);
      if (progress.phase === 'combat'
        && result.state.encounter.enemies.length > 0
        && result.state.encounter.enemies.every((enemy) => enemy.phase === 'defeat')) {
        progress = advanceTestimonyArchive(progress, 'combat-cleared');
        saveProgress();
        radio.play([CHAPTER_FIVE.sceneScript.stepCues[progress.zoneIndex]].filter(Boolean), { interrupt: true });
      } else if (result.state.combat.player.status === 'defeated') {
        if (respawnAtTick === null) respawnAtTick = result.state.combat.tick + 150;
        if (result.state.combat.tick >= respawnAtTick) {
          game = createGame({ x: 0, y: TESTIMONY_ZONES[progress.zoneIndex].anchorZ + 5 });
          respawnAtTick = null;
          result = game.update(0, { horizontal: 0, vertical: 0 }, {});
        }
      } else {
        respawnAtTick = null;
      }
      const playerState = game.getState().combat.player;
      archiveLight.position.set(playerState.position.x, 6.5, playerState.position.y + 2.5);
      const playerAnchor = anchors.get('player');
      playerAnchor.position.set(playerState.position.x, 0, playerState.position.y);
      playerAnchor.rotation.y = Math.atan2(playerState.facing.x, playerState.facing.y);
      for (const [id, character] of characters) {
        character.update(delta, id === 'player' ? {
          acting: !['idle', 'stagger', 'defeat'].includes(playerState.action.name),
          defeated: playerState.status === 'defeated',
          hit: playerState.action.name === 'stagger',
          moving: playerState.status === 'active' && (horizontal !== 0 || vertical !== 0)
        } : {});
      }
      for (const cast of enemyCasts) cast.update(delta);
      bladeTrail.update(delta);
      updateCamera(playerState.position);
      enemyHpBars.face(camera);
      syncPresentation();
      renderer.render(scene, camera);
      performanceProbe.record(delta);
      syncPerformance();
    }
  });
}
