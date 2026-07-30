import * as THREE from 'three';

import { createEncounterGameRuntime } from '../app/encounterGameRuntime.js';
import { completeCampaignChapter } from '../campaign/chapterProgression.js';
import {
  ROOM_ENCOUNTER_ORIGIN, ROOM_START_POSITION, advanceRoomWave, createRoomWaveProgress,
  getRoomWaveEncounter, isRoomWaveCleared
} from '../campaign/roomWaves.js';
import { createCharacterFactory } from '../characters/factory.js';
import { walkableRectsFromLevel } from '../level/walkableBounds.js';
import { PLAYER_RULES } from '../content/actions.js';
import { CHAPTERS_2_5 } from '../content/chapters/catalog.js';
import { chapterTwoLevel } from '../content/levels/chapter2.js';
import { chapterThreeLevel } from '../content/levels/chapter3.js';
import { chapterFourLevel } from '../content/levels/chapter4.js';
import { createBladeTrail } from './bladeTrail.js';
import { createDisposableRegistry } from './dispose.js';
import { createCampaignLandmarks } from './campaignLandmarks.js';
import { createEnemyCast } from './enemyCast.js';
import { createEnemyHpBars } from './enemyHpBars.js';
import { createSceneRadio } from './sceneRadio.js';
import { createSchoolRoute } from './schoolRoute.js';
import { getSceneViewport } from './schoolSceneCamera.js';

// 장별 동사 순서(HUD 기대 동사)와 동행 캐스트 — 적은 이제 연출용 캐스트가 아니라
// roomWaves의 실전투 웨이브로 스폰된다(동사 단계 = 웨이브).
const CONFIGS = Object.freeze({
  2: Object.freeze({ actions: ['reflect', 'trace', 'attack'], cast: ['player'], level: chapterTwoLevel }),
  3: Object.freeze({ actions: ['trace', 'trace', 'attack'], cast: ['player', 'dot'], level: chapterThreeLevel }),
  4: Object.freeze({ actions: ['reflect', 'trace', 'attack'], cast: ['player', 'yoonseo'], level: chapterFourLevel })
});
// 캐스트 앵커 — [0]은 플레이어(전투 시뮬이 위치를 지배), [1]은 동행 NPC(전장 밖 관측 위치).
const POSITIONS = Object.freeze([[0, 0, -17], [-3.1, 0, -15.2]]);
const COLORS = Object.freeze([0x5de0c1, 0x6aa9ff, 0xd74732]);
const LANDMARK_TYPES = Object.freeze({ 2: 'share-chain', 3: 'dual-school', 4: 'approval-room' });
// 쓰러짐 복귀 — 1장과 동일한 결정적 리스폰(150틱 = 2.5초). 현재 웨이브만 리셋되고
// 이미 전멸시킨 웨이브는 유지된다(무처벌 — 진행은 잃지 않는다).
const RESPAWN_DELAY_TICKS = 150;

// 게이지 채움 너비(%) — 0~100으로 자른 정수 문자열. 값이 없으면 null.
function fillPercent(value, max) {
  if (!Number.isFinite(value) || !(max > 0)) return null;
  return `${Math.max(0, Math.min(100, Math.round((value / max) * 100)))}%`;
}

// 텍스트 칩(구형) ↔ 채움 바(신형) 겸용 — schoolSceneHud와 같은 계약으로 HP·SIGNAL을 갱신한다.
function syncGauge(ui, { container, fill, label }, text, width, blocked = null) {
  if (ui[label]) ui[label].textContent = text;
  else if (ui[container]) ui[container].textContent = text;
  if (ui[fill]?.style && width !== null) ui[fill].style.width = width;
  if (blocked !== null && ui[container]?.classList) ui[container].classList.toggle('gauge-blocked', blocked);
}

export function createCampaignChapterScene({
  campaign, canvas, chapter, input, persist, renderer, ui = {}, windowRef = window
}) {
  const config = CONFIGS[chapter];
  const content = CHAPTERS_2_5.find((entry) => entry.order === chapter);
  if (!config || !content) throw new RangeError('운영 캠페인 장면은 2장부터 4장까지 지원합니다.');
  const resources = createDisposableRegistry();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050918);
  scene.fog = new THREE.Fog(0x050918, 28, 68);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const route = resources.register(createSchoolRoute({ level: config.level, lightLimit: 0, scene }), 'campaign-route');
  const landmarks = resources.register(createCampaignLandmarks({ scene, type: LANDMARK_TYPES[chapter] }), 'campaign-landmarks');
  const factory = resources.register(createCharacterFactory(), 'campaign-cast');
  // 적 머리 위 HP 링 — 웨이브가 바뀌어도 인스턴스 하나로 스폰 ID별 바를 관리한다.
  const enemyHpBars = resources.register(createEnemyHpBars({ scene }), 'campaign-enemy-hp-bars');
  const bladeTrail = resources.register(createBladeTrail({ scene }), 'campaign-blade-trail');
  const ringGeometry = resources.register(new THREE.RingGeometry(1.45, 1.72, 32), 'campaign-ring-geometry');
  const ringMaterial = resources.register(new THREE.MeshBasicMaterial({
    color: COLORS[0], opacity: 0.82, side: THREE.DoubleSide, transparent: true
  }), 'campaign-ring-material');
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.set(ROOM_ENCOUNTER_ORIGIN.x, 0.05, ROOM_ENCOUNTER_ORIGIN.z);
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);
  // 방 조명 예산 2개 유지 — 신규 라이트·그림자·렌더타깃 0.
  scene.add(new THREE.HemisphereLight(0xbfd3ff, 0x29162b, 3));
  const fill = new THREE.PointLight(0xffd39a, 3.2, 32, 1.8);
  fill.position.set(0, 6, -17);
  fill.castShadow = false;
  scene.add(fill);

  const castRoot = new THREE.Group();
  scene.add(castRoot);
  // 시나리오 v2 — 도입·동사 단계·반전 컷을 무전 자막으로 흘린다(정본: docs/reboot/시나리오-v2.md).
  const radio = createSceneRadio(ui);
  const script = content.sceneScript ?? { briefing: [], reversalScript: [], stepCues: [] };
  const characters = new Map();
  const errors = [];
  let waveProgress = createRoomWaveProgress(chapter);
  let awaitingDecision = false;
  let completed = null;
  let entered = false;
  let unsubscribeInput = null;
  let respawnAtTick = null;
  // 타격감(GF1) — 1장과 동일: 명중 순간 시뮬을 벽시계 기준으로만 잠깐 멈춘다(틱 순서 불변).
  let hitStop = 0;
  let lastCombatEvents = [];
  let firstWaveCastLoaded = false;
  const waveCasts = [];
  const anchors = config.cast.map((id, index) => {
    const anchor = new THREE.Group();
    anchor.position.set(...POSITIONS[index]);
    anchor.rotation.y = index === 0 ? Math.PI : 0;
    castRoot.add(anchor);
    return { anchor, id, key: `${id}-${index}` };
  });
  const playerAnchor = anchors[0].anchor;

  // 방 전투 런타임 — 1장과 같은 60Hz 고정틱. 웨이브·리스폰마다 현재 웨이브 정의로 다시 심는다.
  const deviceClass = getSceneViewport(canvas).mode;
  // 통행 경계 — 장 레벨의 collision 레이어에서 유도(방 원점 주변 세그먼트 포함 전 구간).
  const walkable = walkableRectsFromLevel(config.level);
  function createWaveRuntime(startPosition) {
    return createEncounterGameRuntime({
      deviceClass,
      encounterDefinition: getRoomWaveEncounter(chapter, waveProgress.waveIndex),
      encounterOrigin: ROOM_ENCOUNTER_ORIGIN,
      extraTargets: [],
      startPosition,
      walkable
    });
  }
  let game = createWaveRuntime(ROOM_START_POSITION);

  // 현재 웨이브의 적 표현 캐스트를 만들고 로드한다. 전멸한 웨이브의 캐스트는 쓰러진
  // 기록(defeat 포즈)으로 남겨 두고 씬 dispose에서 함께 정리한다(팩토리·GLTF 캐시 공유).
  function spawnWaveCast() {
    const waveCast = resources.register(
      createEnemyCast({ characterFactory: factory, scene }),
      `campaign-enemy-cast-${chapter}-w${waveProgress.waveIndex}`
    );
    waveCasts.push(waveCast);
    const isFirst = waveCasts.length === 1;
    waveCast.load(game.getState().encounter).then(() => {
      if (!entered) return;
      errors.push(...waveCast.getDebugState().errors);
      if (isFirst) firstWaveCastLoaded = true;
      syncPresentation();
    }).catch((error) => {
      // 로드 실패는 dataset으로만 알린다 — unhandled rejection(콘솔 에러) 금지.
      if (entered) errors.push(error.message);
      syncPresentation();
    });
  }

  function currentWaveCast() {
    return waveCasts.at(-1) ?? null;
  }

  // TRACE는 가장 가까운 살아 있는 적을 겨눈다(방에는 별도 조사 대상이 없다).
  function nearestLivingEnemyId() {
    const { combat, encounter } = game.getState();
    let bestId = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const enemy of encounter.enemies) {
      if (enemy.phase === 'defeat') continue;
      const distance = Math.hypot(
        enemy.position.x - combat.player.position.x,
        enemy.position.z - combat.player.position.y
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = enemy.id;
      }
    }
    return bestId;
  }

  function resize() {
    const viewport = getSceneViewport(canvas);
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.width, viewport.height, false);
  }

  function syncPresentation() {
    const { combat, encounter } = game.getState();
    const alive = encounter.enemies.filter((enemy) => enemy.phase !== 'defeat').length;
    const expected = config.actions[waveProgress.waveIndex] ?? null;
    ring.visible = !awaitingDecision && completed === null;
    ringMaterial.color.setHex(COLORS[Math.min(waveProgress.waveIndex, COLORS.length - 1)]);
    canvas.dataset.campaignChapter = String(chapter);
    // step = 클리어한 웨이브 수(동사 단계 = 웨이브이므로 waveIndex와 같다).
    canvas.dataset.campaignStep = String(waveProgress.waveIndex);
    canvas.dataset.campaignExpectedAction = expected ?? 'decision';
    canvas.dataset.campaignCompleted = String(completed !== null);
    canvas.dataset.campaignWave = String(waveProgress.waveIndex);
    canvas.dataset.campaignEnemiesAlive = String(awaitingDecision || completed ? 0 : alive);
    canvas.dataset.playerSignal = String(combat.player.signal);
    canvas.dataset.characters = errors.length > 0
      ? 'error'
      : characters.size === anchors.length && firstWaveCastLoaded ? 'ready' : 'loading';
    syncGauge(
      ui, { container: 'health', fill: 'healthFill', label: 'healthLabel' },
      `HP ${combat.player.hp}`, fillPercent(combat.player.hp, PLAYER_RULES.maxHp)
    );
    syncGauge(
      ui, { container: 'signal', fill: 'signalFill', label: 'signalLabel' },
      `SIGNAL ${combat.player.signal}`, fillPercent(combat.player.signal, PLAYER_RULES.maxSignal),
      // 게이지 부족 깜빡임 — signal-blocked 이벤트가 있는 프레임에만 클래스가 붙는다(타이머 없음).
      lastCombatEvents.some((event) => event.type === 'signal-blocked')
    );
    if (ui.action) ui.action.textContent = expected?.toUpperCase() ?? 'F / Q';
    if (ui.chain) ui.chain.textContent = `${Math.min(waveProgress.waveIndex + 1, waveProgress.total)}/${waveProgress.total} LOOP`;
    if (ui.enemy) {
      // 적 상태 칩 — 방패(armor)가 남은 적이 있으면 반사 각을 알리고, 아니면 남은 수를 센다.
      const armored = encounter.enemies.find((enemy) => enemy.armor > 0 && enemy.phase !== 'defeat');
      ui.enemy.textContent = armored
        ? `ARMOR ${armored.armor}`
        : `${content.boss.id.toUpperCase()} ×${alive}`;
    }
    if (ui.objective) ui.objective.textContent = completed
      ? '계속 버튼으로 다음 장을 여세요'
      : awaitingDecision ? 'F 기록 보존 · Q 빠른 중단' : `${content.titleKo} — ${expected?.toUpperCase()}`;
  }

  function finish(action) {
    completed = completeCampaignChapter(campaign, chapter, action);
    persist?.(completed.state);
    if (ui.result) {
      ui.result.hidden = false;
      const heading = ui.result.querySelector('h2');
      if (heading) heading.textContent = `${content.titleKo} 기록`;
    }
    if (ui.resultAction) ui.resultAction.textContent = completed.summaryKo;
    if (ui.resultConsequence) ui.resultConsequence.textContent = content.reversal.textKo;
    if (ui.resultReversal) ui.resultReversal.textContent = '다음 장에서도 이 결과가 전투와 증거 접근을 바꿉니다.';
    if (ui.continueButton) ui.continueButton.hidden = false;
    radio.play(script.reversalScript, { interrupt: true }); // 반전 컷 — 결정 직후 즉시
  }

  function queueAction({ action, active }) {
    if (!active || completed) return;
    if (awaitingDecision) {
      if (action === 'secure') finish('secure');
      if (action === 'purge') finish('purge');
      syncPresentation();
      return;
    }
    // 실전투 — 동사 키는 단계를 넘기지 않고 전투 런타임으로 흘러간다.
    // 웨이브 전멸이 단계를 넘긴다(승인관 armor는 반사로 깨지는 식의 적 메커니즘이 동사를 요구한다).
    if (!['attack', 'dash', 'reflect', 'trace'].includes(action)) return;
    game.queueAction(action, action === 'trace' ? nearestLivingEnemyId() : null);
  }

  // 전멸 웨이브 정리 — 동사 큐 무전을 끊어 재생하고 다음 웨이브를 심거나 결정 단계로 넘어간다.
  function advanceClearedWave(playerPosition) {
    radio.play([script.stepCues?.[waveProgress.waveIndex]].filter(Boolean), { interrupt: true });
    waveProgress = advanceRoomWave(waveProgress);
    respawnAtTick = null;
    if (waveProgress.finished) {
      awaitingDecision = true;
      return;
    }
    // 다음 웨이브 — 플레이어는 지금 자리 그대로, 새 적만 저작 상수 위치에 스폰된다.
    game = createWaveRuntime({ x: playerPosition.x, y: playerPosition.y });
    spawnWaveCast();
  }

  async function loadCast() {
    await Promise.all(anchors.map(async ({ anchor, id, key }) => {
      try {
        // DOT는 3장 이후 균열 표식을 단다(시나리오 v2 — 동기화 사고의 흔적).
        const character = await factory.create(id, { fractured: id === 'dot' && chapter >= 3 });
        if (!entered) return character.dispose();
        anchor.add(character.root);
        characters.set(key, character);
      } catch (error) {
        if (entered) errors.push(`${key}: ${error.message}`);
      }
    }));
    if (entered) syncPresentation();
  }

  // 카메라 — 플레이어 위치의 순수 함수로만 따라간다(상태·난수 없음 = 결정적).
  function updateCamera(playerPosition) {
    camera.position.set(playerPosition.x * 0.45, 6.2, playerPosition.y + 8.4);
    camera.lookAt(playerPosition.x * 0.7, 0.7, playerPosition.y - 5.6);
  }

  return Object.freeze({
    dispose() {
      unsubscribeInput?.();
      radio.clear();
      ring.removeFromParent();
      castRoot.removeFromParent();
      resources.disposeAll();
    },
    enter() {
      if (entered) return;
      entered = true;
      resize();
      unsubscribeInput = input.subscribe(queueAction);
      windowRef.addEventListener('resize', resize);
      syncPresentation();
      radio.play(script.briefing);
      loadCast();
      spawnWaveCast();
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
        actionIndex: waveProgress.waveIndex,
        awaitingDecision,
        completed,
        enemies: Object.freeze(encounter.enemies.map((enemy) => Object.freeze({
          armor: enemy.armor,
          hp: enemy.hp,
          id: enemy.id,
          phase: enemy.phase,
          position: Object.freeze({ x: enemy.position.x, z: enemy.position.z })
        }))),
        errors: Object.freeze([...errors]),
        landmarks: landmarks.getDebugState(),
        player: Object.freeze({
          hp: combat.player.hp,
          position: Object.freeze({ ...combat.player.position }),
          signal: combat.player.signal,
          status: combat.player.status
        }),
        route: route.getDebugState(),
        wave: Object.freeze({
          finished: waveProgress.finished,
          index: waveProgress.waveIndex,
          total: waveProgress.total
        })
      });
    },
    update(delta) {
      radio.update(delta);
      landmarks.update?.(delta); // 4장 컨베이어 서류 등 랜드마크 순환(elapsed 순수 함수)
      const horizontal = Number(input.isActive('move-right')) - Number(input.isActive('move-left'));
      const vertical = Number(input.isActive('move-down')) - Number(input.isActive('move-up'));
      const fighting = !awaitingDecision && completed === null;
      let playerState = game.getState().combat.player;
      if (fighting) {
        // 히트스톱 동안 시뮬만 벽시계 기준으로 멈춘다(렌더·무전·카메라는 계속).
        const stopped = hitStop > 0;
        if (stopped) hitStop = Math.max(0, hitStop - delta);
        let result = game.update(stopped ? 0 : delta, { horizontal, vertical }, {});
        lastCombatEvents = result.combatEvents;
        // 타격감(GF1): 검격 궤적 + 명중·격파·피격 히트스톱 — 1장과 동일 규칙.
        for (const event of result.combatEvents) {
          if (event.type === 'action-started' && String(event.action).startsWith('attack')) {
            const player = result.state.combat.player;
            bladeTrail.trigger(
              { x: player.position.x, y: 0, z: player.position.y },
              { x: player.facing.x, y: 0, z: player.facing.y },
              result.state.combat.chain.level
            );
          } else if (event.type === 'target-defeated') {
            hitStop = Math.min(0.12, hitStop + 0.11);
          } else if (event.type === 'target-hit') {
            hitStop = Math.min(0.12, hitStop + 0.055);
          } else if (event.type === 'player-hit') {
            hitStop = Math.min(0.12, hitStop + 0.07);
          }
        }
        currentWaveCast()?.present(result.state.encounter, result.enemyEvents);
        enemyHpBars.sync(result.state.encounter);
        if (isRoomWaveCleared(result.state.encounter.enemies)) {
          advanceClearedWave(result.state.combat.player.position);
        } else if (result.state.combat.player.status === 'defeated') {
          // 쓰러짐 복귀 — 시뮬 고정 틱으로 재며, 체크포인트(방 시작 위치)에서 현재 웨이브만 다시 연다.
          if (respawnAtTick === null) respawnAtTick = result.state.combat.tick + RESPAWN_DELAY_TICKS;
          if (result.state.combat.tick >= respawnAtTick) {
            game = createWaveRuntime(ROOM_START_POSITION);
            respawnAtTick = null;
            result = game.update(0, { horizontal: 0, vertical: 0 }, {});
            currentWaveCast()?.present(result.state.encounter, result.enemyEvents);
            enemyHpBars.sync(result.state.encounter);
          }
        } else {
          respawnAtTick = null;
        }
        playerState = game.getState().combat.player;
      }
      // 플레이어 캐릭터는 전투 시뮬의 위치·행동을 그대로 따른다(1장 cast.setPlayerState와 동일 계약).
      playerAnchor.position.set(playerState.position.x, 0, playerState.position.y);
      playerAnchor.rotation.y = Math.atan2(playerState.facing.x, playerState.facing.y);
      const playerAnimation = {
        acting: fighting && !['idle', 'stagger', 'defeat'].includes(playerState.action.name),
        defeated: playerState.status === 'defeated',
        hit: playerState.action.name === 'stagger',
        moving: fighting && playerState.status === 'active' && (horizontal !== 0 || vertical !== 0)
      };
      for (const { key } of anchors) {
        characters.get(key)?.update(delta, key === anchors[0].key ? playerAnimation : {});
      }
      for (const waveCast of waveCasts) waveCast.update(delta);
      bladeTrail.update(delta);
      updateCamera(playerState.position);
      enemyHpBars.face(camera);
      syncPresentation();
      renderer.render(scene, camera);
    }
  });
}
