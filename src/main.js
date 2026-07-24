import './styles.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { createAudioEngine } from './audio.js';
import { createBurstSystem, createFloatingIcon, setIconEmoji } from './effects.js';
import { CLASSIFY_BUCKETS, getClassifyChallenge, scoreClassify } from './classify.js';
import { createCompanion, createNoiseBoss, createNova, createNpcCharacter, createPlayerCharacter } from './characters.js';
import {
  countMisplaced,
  createPuzzleState,
  cyclePuzzleObject,
  getShrinePuzzle,
  isPuzzleSolved
} from './shrinePuzzle.js';
import { pickMemory } from './bossMemories.js';
import {
  cellToWorld,
  computeBeamPath,
  countRemaining,
  createRoomState,
  firstCrateInLine,
  getDungeonRoom,
  hasDungeonRoom,
  isRoomSolved,
  pickOrPlace,
  pushCrate,
  rotateMirror,
  worldToCell
} from './dungeonPuzzles.js';
import { buildDungeonRoom, disposeDungeonRoom, makeGlyphSprite, syncDungeonVisuals } from './dungeon.js';
import { getStageById, getStageStates, markStageCompleted, markStageVisited, nearestSeaIsland } from './stageData.js';
import {
  completeCampaign,
  getCampaignSummary
} from './chapterData.js';
import { SEA_APPROACH, SEA_RADIUS, SEA_SCALE, buildSeaScene, seaWorldPosition } from './sea.js';
import { ISLE_RADIUS, ISLE_SCENES, healSpiritVisuals } from './isle.js';
import { createCorridorState, stepCorridor } from './corridorLogic.js';
import {
  RUMOR,
  chooseRumorStone,
  createRumorState,
  isEchoStone,
  nearestRumorStone,
  ringRumorBell,
  tickRumor
} from './rumorLogic.js';
import { DUNES, createDunesState, glassAngle, nearestGlass, pullGlass, tickDunes } from './dunesLogic.js';
import {
  FOOTPRINT,
  createFootprintState,
  nearestFootprintAction,
  resolveFootprintAction
} from './footprintLogic.js';
import {
  BUBBLE,
  createBubbleState,
  inspectBubbleSource,
  nearestBubbleSource
} from './bubbleLogic.js';
import {
  CARGO,
  CARGO_LABEL_KO,
  createCargoState,
  cycleCargoLabel,
  nearestCargoCrate,
  verifyCargoManifest
} from './cargoLogic.js';
import { HEART, createHeartState, nearestSeal, sealPulse, tickHeart, useSeal } from './heartLogic.js';
import { RESIDUE, createResidueState, residueIntroHit, strikeResidue, tickResidue, windupGauge } from './residueLogic.js';
import {
  CAMPAIGN_FINALE,
  CORE_BREACH,
  buildNovaCertificate,
  getFinaleToolSteps,
  getTeachingLines
} from './finale.js';
import {
  PROLOGUE,
  QUESTS,
  applyGateChoice,
  applyIntroTalk,
  getGateDialog,
  getGateStatus,
  getNpcDialog,
  getStoryDeeds,
  getStoryObjective,
  getStoryVisualFlags,
  josaWaGwa,
  MEMORY_FRAGMENTS,
  FINAL_MEMORY_TEASE,
  FAKE_DOT_EVENTS,
  pendingFakeDotEvent,
  recordFakeDotEvent
} from './story.js';
import {
  ETHICS_TOPICS,
  FINAL_CORE_MISSION,
  SHRINES,
  WORLD_ZONES,
  applyShrineResult,
  canUnlockFinalCore,
  completeFinalCore,
  createInitialProgress,
  PROMISE_TOOLS,
  KNOWLEDGE_BOTTLES,
  collectKnowledgeBottle,
  awardFragment,
  getToolById,
  getExtraShrineQuestions,
  getLearningReport,
  getProgressSummary,
  getShrineById,
  getTopicById,
  normalizeProgress,
  recordLearningVisit,
  recordPracticeChoice
} from './worldData.js';

const APP_MARKER = 'AI Ethics Quest 3D';
// H-17 캠페인은 이전 「잊혀진 수호자」 세이브와 서사 전제가 완전히 다르다.
// 별도 키를 써서 기존 완주 데이터가 프롤로그와 새 사건 기록을 건너뛰지 않게 한다.
const STORAGE_KEY = 'ai-ethics-quest-3d/progress/h17-v4';

// 터치 기기에서는 키보드(WASD/E/J) 안내가 의미 없으므로 조작 문구를 바꾼다.
const IS_TOUCH = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(pointer: coarse)').matches;
const TOPIC_NAMES_KO = { privacy: '빈 교실', bias: '지문 운동장', copyright: '기록 보관소', deepfake: '미디어 검증실' };

const MOVE_HINT = IS_TOUCH
  ? '왼쪽 스틱 이동 · 오른쪽 A로 확인·공격'
  : 'WASD/방향키 이동 · E·Space 확인/공격 · J 기록';
const ACTION_LABEL = IS_TOUCH ? '' : 'E: ';
const PLAYER_START = new THREE.Vector3(0, 0.55, 15.1);
const ISLAND_RADIUS = 21.6;
const INTERACTION_RADIUS = 2.25;
const CORE_RADIUS = 2.8;
const clock = new THREE.Clock();

let activeQuest = null;

export function initEthicsQuest3D(root = document.querySelector('#app')) {
  if (!root) {
    throw new Error('AI Ethics Quest 3D root element not found');
  }

  root.dataset.appMarker = APP_MARKER;
  root.innerHTML = createShell();

  const canvas = root.querySelector('[data-game-canvas]');
  const ui = bindUi(root);
  const game = createGameState(ui);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (error) {
    showRendererFallback(ui, error);
    return null;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 180);
  const renderState = {
    renderer,
    scene,
    camera,
    playerGroup: new THREE.Group(),
    interactables: [],
    shrineCrystals: new Map(),
    coreCrystal: null,
    coreGlow: null,
    composer: null,
    animated: [],
    icons: [],
    burst: null,
    companion: null,
    gates: new Map(),
    zoneAuras: new Map()
  };

  configureRenderer(renderer);
  createWorld(renderState);
  createKnowledgeBottles(renderState, game.progress);
  createPlayer(renderState);
  scene.add(renderState.playerGroup);
  setupPostProcessing(renderState, root);
  renderState.burst = createBurstSystem(scene);
  createInteractionIcons(renderState);

  // 동행 요정 도트 — 항상 플레이어 어깨 옆에 둥둥.
  renderState.companion = createCompanion();
  renderState.companion.position.copy(PLAYER_START).add(new THREE.Vector3(0.8, 1.2, 0));
  scene.add(renderState.companion);

  game.audio = createAudioEngine();
  game.renderState = renderState;
  renderState.game = game; // updateAmbient에서 오디오 큐 톱업에 쓰는 역참조

  const cleanupInput = bindInput(game, ui);
  bindHudActions(game, ui, renderState);

  resize(renderer, camera, root, renderState.composer);
  updateHud(game, ui);
  updateCoreVisual(game, renderState);
  // 6장까지 완주한 세이브에서만 루멘 공개 코어가 돌아온다.
  if (game.progress.campaignCompleted) {
    morphNoiseToNova(game);
  }

  let animationId = 0;
  const updateRotateHint = () => {
    if (!ui.rotateHint) {
      return;
    }
    // 세로로 잡은 폰에서만 가로 권장 안내를 띄운다(태블릿·데스크톱 제외).
    // 대화창이 열려 있으면 내용과 겹치므로 숨긴다.
    const portraitPhone = IS_TOUCH && window.innerHeight > window.innerWidth && window.innerWidth < 560;
    const dialogOpen = ui.dialog && !ui.dialog.hidden;
    const inAction = Boolean(game.combat?.active || game.puzzle?.active);
    ui.rotateHint.hidden = !(portraitPhone && game.started && !dialogOpen && !inAction);
  };
  const onResize = () => {
    resize(renderer, camera, root, renderState.composer);
    updateRotateHint();
  };
  const onVisibilityChange = () => {
    game.paused = document.hidden || !ui.dialog.hidden;
  };
  game.updateRotateHint = updateRotateHint;

  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibilityChange);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    game.paused = true;
    ui.prompt.textContent = '그래픽 화면이 잠시 멈췄어요. 새로고침하면 다시 시작할 수 있어요.';
    ui.prompt.hidden = false;
  });

  // 타이틀 화면 뒤로 보일 섬 전경 카메라.
  camera.position.set(0, 11.5, 20);
  camera.lookAt(0, 1.4, 0);
  setupTitleScreen(game, ui);

  function frame() {
    animationId = window.requestAnimationFrame(frame);
    const raw = Math.min(clock.getDelta(), 0.04);
    // 히트스톱: 타격 순간 게임 시간을 잠깐 거의 멈춰 손맛을 준다(시각 효과는 계속).
    let delta = raw;
    if (game.hitStop > 0) {
      game.hitStop = Math.max(0, game.hitStop - raw);
      delta = raw * 0.06;
    }
    if (game.started && !game.paused) {
      // 프롤로그 시네마틱 중에는 카메라를 키프레임이 소유한다(플레이어 추종·조작 정지).
      if (game.cinematic) {
        updateCinematic(raw, game, renderState, ui);
      } else {
        updateGame(delta, game, renderState, ui);
      }
    }
    updateAmbient(raw, renderState);
    if (renderState.composer) {
      renderState.composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  frame();

  if (typeof window !== 'undefined' && window.__ETHICS_TEST_HOOK__) {
    window.__ethicsGame = game;
    window.__ethicsUi = ui;
    window.__ethicsRefreshHud = () => updateHud(game, ui); // 테스트: 진행 주입 후 HUD 재계산
  }

  return {
    marker: APP_MARKER,
    destroy() {
      window.cancelAnimationFrame(animationId);
      cleanupInput();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      renderer.dispose();
      root.innerHTML = '';
    }
  };
}

function createShell() {
  return `
    <main class="quest-shell" data-app-marker="${APP_MARKER}">
      <canvas class="quest-canvas" data-game-canvas aria-label="AI 윤리의 섬 3D 게임 화면"></canvas>

      <section class="objective-chip" data-objective-chip aria-live="polite">
        <p class="eyebrow" data-chapter-kicker>1장</p>
        <h1 data-chapter-title>명단에서 사라진 아이</h1>
        <p data-objective>하루가 존재했다는 첫 증거를 찾으세요.</p>
      </section>

      <nav class="journey-rail" data-journey-rail aria-label="6장 여정"></nav>

      <section class="status-strip" aria-label="진행 상황">
        <div class="status-head">
          <strong data-fragment-count>조각 0/4</strong>
          <span data-core-status>AI 코어 잠김</span>
        </div>
        <div class="fragment-row" data-fragment-row></div>
        <div class="tool-belt" data-tool-belt aria-label="약속 도구"></div>
      </section>

      <div class="rotate-hint" data-rotate-hint hidden>📱↻ 가로로 돌리면 더 잘 보여요</div>

      <button class="journal-toggle" type="button" data-journal-toggle aria-expanded="false">
        기록
      </button>

      <button class="sound-toggle" type="button" data-sound-toggle aria-pressed="false" aria-label="소리 켜기/끄기" title="소리 켜기/끄기">
        🔈
      </button>

      <div class="screen-flash" data-flash></div>

      <div class="cinematic" data-cinematic hidden aria-label="프롤로그 연출">
        <div class="cine-bar cine-bar-top"></div>
        <div class="cine-bar cine-bar-bottom"></div>
        <div class="cine-caption" data-cine-caption aria-live="polite"></div>
        <button type="button" class="cine-skip" data-prologue-skip>건너뛰기 ▸</button>
      </div>

      <aside class="journal-panel" data-journal hidden>
        <div class="panel-heading">
          <div>
            <p class="eyebrow">여정 기록</p>
            <h2>H-17 사건 기록</h2>
          </div>
          <button type="button" data-close-journal aria-label="탐험 노트 닫기">닫기</button>
        </div>
        <div data-journal-content></div>
      </aside>

      <section class="class-hint" aria-label="캠페인 안내">
        <span>6장 캠페인</span>
        <span>선택은 기록되고, 실수는 바로잡을 수 있어요</span>
      </section>

      <div class="interaction-prompt" data-prompt hidden></div>

      <div class="boss-hud" data-boss-hud hidden aria-live="polite">
        <div class="boss-hud-top">
          <span class="boss-name">⬜ 화이트아웃</span>
          <span class="boss-weak" data-boss-weak></span>
        </div>
        <div class="boss-memory" data-boss-memory></div>
        <div class="boss-bar"><div class="boss-bar-fill" data-boss-fill></div></div>
        <div class="boss-hint" data-boss-hint></div>
      </div>

      <div class="combat-popup" data-combat-popup aria-hidden="true"></div>

      <div class="noise-whisper" data-noise-whisper hidden aria-hidden="true"></div>

      <div class="ceremony" data-ceremony hidden aria-hidden="true">
        <div class="ceremony-rays"></div>
        <div class="ceremony-item" data-ceremony-item></div>
        <div class="ceremony-title" data-ceremony-title></div>
        <div class="ceremony-sub" data-ceremony-sub></div>
      </div>

      <div class="puzzle-hud" data-puzzle-hud hidden aria-live="polite">
        <div class="puzzle-title" data-puzzle-title></div>
        <div class="puzzle-goal" data-puzzle-goal></div>
        <div class="puzzle-hint" data-puzzle-hint></div>
      </div>

      <div class="touch-controls" aria-label="터치 조작">
        <div class="touch-stick" data-stick aria-label="이동 스틱 — 끌어서 이동">
          <div class="stick-knob" data-stick-knob></div>
        </div>
        <div class="touch-actions">
          <button type="button" data-touch="tool" class="touch-tool" aria-label="도구 바꾸기">🔄</button>
          <button type="button" data-touch="action" class="touch-a" data-action-label aria-label="확인·공격">A</button>
        </div>
      </div>

      <section class="dialog-panel" data-dialog hidden role="dialog" aria-modal="false" aria-live="polite" aria-label="대화">
        <div class="panel-heading">
          <div>
            <p class="eyebrow" data-dialog-kicker>학습</p>
            <h2 data-dialog-title>대화</h2>
          </div>
          <button type="button" data-dialog-close aria-label="닫기">닫기</button>
        </div>
        <div data-dialog-body></div>
      </section>

      <section class="title-screen" data-title>
        <div class="title-card">
          <h1 class="title-name">AI 윤리 퀘스트</h1>
          <p class="title-desc">삭제된 학생 H-17, 조작된 증거, 그리고 아무도 설명하지 않은 AI의 결정.</p>
          <p class="title-hook">“그런 학생은 없었습니다.” 모두가 같은 답을 할 때, 사라진 친구 하루의 기록을 되찾으세요.</p>
          <div class="title-actions" data-title-actions></div>
          <p class="title-controls">${IS_TOUCH ? '왼쪽 스틱으로 이동 · 오른쪽 A 버튼으로 확인·공격' : '이동 WASD·방향키 · 확인/공격 E·Space·Enter · 기록 J'}</p>
        </div>
      </section>

      <section class="certificate" data-certificate hidden>
        <div class="certificate-card" data-certificate-card></div>
      </section>
    </main>
  `;
}

function bindUi(root) {
  return {
    root,
    objective: root.querySelector('[data-objective]'),
    chapterKicker: root.querySelector('[data-chapter-kicker]'),
    chapterTitle: root.querySelector('[data-chapter-title]'),
    journeyRail: root.querySelector('[data-journey-rail]'),
    objectiveChip: root.querySelector('[data-objective-chip]'),
    fragmentCount: root.querySelector('[data-fragment-count]'),
    coreStatus: root.querySelector('[data-core-status]'),
    fragmentRow: root.querySelector('[data-fragment-row]'),
    prompt: root.querySelector('[data-prompt]'),
    bossHud: root.querySelector('[data-boss-hud]'),
    bossFill: root.querySelector('[data-boss-fill]'),
    bossHint: root.querySelector('[data-boss-hint]'),
    bossWeak: root.querySelector('[data-boss-weak]'),
    bossMemory: root.querySelector('[data-boss-memory]'),
    combatPopup: root.querySelector('[data-combat-popup]'),
    noiseWhisper: root.querySelector('[data-noise-whisper]'),
    ceremony: root.querySelector('[data-ceremony]'),
    ceremonyItem: root.querySelector('[data-ceremony-item]'),
    ceremonyTitle: root.querySelector('[data-ceremony-title]'),
    ceremonySub: root.querySelector('[data-ceremony-sub]'),
    puzzleHud: root.querySelector('[data-puzzle-hud]'),
    puzzleTitle: root.querySelector('[data-puzzle-title]'),
    puzzleGoal: root.querySelector('[data-puzzle-goal]'),
    puzzleHint: root.querySelector('[data-puzzle-hint]'),
    actionLabel: root.querySelector('[data-action-label]'),
    toolButton: root.querySelector('[data-touch="tool"]'),
    stick: root.querySelector('[data-stick]'),
    stickKnob: root.querySelector('[data-stick-knob]'),
    dialog: root.querySelector('[data-dialog]'),
    dialogKicker: root.querySelector('[data-dialog-kicker]'),
    dialogTitle: root.querySelector('[data-dialog-title]'),
    dialogBody: root.querySelector('[data-dialog-body]'),
    dialogClose: root.querySelector('[data-dialog-close]'),
    journal: root.querySelector('[data-journal]'),
    journalToggle: root.querySelector('[data-journal-toggle]'),
    journalClose: root.querySelector('[data-close-journal]'),
    journalContent: root.querySelector('[data-journal-content]'),
    toolBelt: root.querySelector('[data-tool-belt]'),
    soundToggle: root.querySelector('[data-sound-toggle]'),
    flash: root.querySelector('[data-flash]'),
    cinematic: root.querySelector('[data-cinematic]'),
    cineCaption: root.querySelector('[data-cine-caption]'),
    cineSkip: root.querySelector('[data-prologue-skip]'),
    title: root.querySelector('[data-title]'),
    titleActions: root.querySelector('[data-title-actions]'),
    rotateHint: root.querySelector('[data-rotate-hint]'),
    certificate: root.querySelector('[data-certificate]'),
    certificateCard: root.querySelector('[data-certificate-card]'),
    touchButtons: [...root.querySelectorAll('[data-touch]')]
  };
}

// 햅틱(R-루프3) — 터치 기기에서 보상 순간에 짧은 진동으로 손맛을 더한다.
// 소리와 별개 채널이라 음소거와 무관하고, 미지원 기기에선 조용히 무시(게임플레이 무영향).
function triggerHaptic(pattern) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // 일부 브라우저는 사용자 제스처 밖 호출을 막는다 — 무시.
    }
  }
}

function triggerFlash(ui, colorHex) {
  if (!ui.flash) {
    return;
  }
  ui.flash.style.setProperty('--flash-color', colorHex ?? '#ffffff');
  ui.flash.classList.remove('is-active');
  // 리플로우를 강제해 애니메이션을 재시작한다.
  void ui.flash.offsetWidth;
  ui.flash.classList.add('is-active');
}

function loadStoredProgress() {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialProgress();
    }
    return normalizeProgress(JSON.parse(raw));
  } catch {
    return createInitialProgress();
  }
}

function persistProgress(progress) {
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // 사생활 모드 등 저장이 막힌 환경에서는 세션 안에서만 진행을 유지한다.
  }
}

function clearStoredProgress() {
  try {
    window.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // 저장소가 없으면 지울 것도 없다.
  }
}

function createGameState(ui) {
  const progress = loadStoredProgress();
  return {
    progress,
    player: {
      position: PLAYER_START.clone(),
      direction: new THREE.Vector3(0, 0, 1),
      speed: 6.1,
      bob: 0,
      moving: false
    },
    keys: new Set(),
    nearest: null,
    paused: false,
    started: false,
    audio: null,
    renderState: null,
    combat: null,
    puzzle: null,
    dungeon: null,
    voyage: null,
    isle: null,
    cinematic: null,
    touchStick: { x: 0, z: 0 },
    idleT: 0,
    overviewT: 0,
    skyGazeT: 0,
    lastCameraMode: 'overworld',
    mode: 'overworld',
    finaleResolving: false,
    hitStop: 0,
    shake: 0,
    coreWasUnlocked: canUnlockFinalCore(progress.collectedFragments),
    ui
  };
}

function configureRenderer(renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x0b1020, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // 증거 항로: 낮은 노출의 달빛 아래 호박빛 감사 오브젝트만 또렷하게 보인다.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
}

function setupPostProcessing(renderState, root) {
  const { renderer, scene, camera } = renderState;
  const width = Math.max(root.clientWidth, 320);
  const height = Math.max(root.clientHeight, 360);

  let composer;
  try {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    // 발광 크리스털·코어만 빛나도록 블룸은 약하게·문턱은 높게(밝은 지형·글씨가 번지지 않게).
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.35, 0.8, 0.85);
    composer.addPass(bloom);
    // 색 보정 + 비네트 — 블룸 뒤, OutputPass(톤매핑·sRGB) 앞의 리니어 공간에서 적용.
    // 풀스크린 쿼드 1드로우·텍스처 페치 1회, 신규 렌더타깃 0(기존 핑퐁 버퍼 재사용).
    const grade = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        saturation: { value: 1.04 },
        contrast: { value: 1.1 },
        vignetteStrength: { value: 0.3 },
        vignetteRadius: { value: 0.62 },
        tint: { value: new THREE.Vector3(0.94, 0.97, 1.08) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float saturation, contrast, vignetteStrength, vignetteRadius;
        uniform vec3 tint;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
          c.rgb = mix(vec3(luma), c.rgb, saturation) * tint;
          // 살짝의 콘트라스트로 희멀건 씻김을 잡는다(리니어 공간, 중간 회색 0.18 기준).
          c.rgb = (c.rgb - 0.18) * contrast + 0.18;
          float d = distance(vUv, vec2(0.5));
          c.rgb *= 1.0 - vignetteStrength * smoothstep(vignetteRadius * 0.55, vignetteRadius, d);
          gl_FragColor = c;
        }`
    });
    composer.addPass(grade);
    composer.addPass(new OutputPass());
    renderState.composer = composer;
    renderState.bloomPass = bloom;
    renderState.gradePass = grade;
  } catch (error) {
    // 후처리를 못 쓰는 환경이면 기본 렌더로 조용히 폴백한다.
    renderState.composer = null;
  }
}

function updateAmbient(delta, renderState) {
  const elapsed = clock.elapsedTime;
  renderState.game?.audio?.tickMusic?.();
  for (const item of renderState.animated) {
    item.update(elapsed, delta);
  }
  if (renderState.burst) {
    renderState.burst.update(delta);
  }
  // 화이트아웃/루멘 시각체는 대화창(일시정지) 중에도 움직여야 하므로 여기서 갱신한다.
  animateNoiseBoss(delta, elapsed, renderState.noiseBoss);
}

function createWorld(renderState) {
  const { scene, interactables, shrineCrystals, animated } = renderState;
  // 1장 리뉴얼: 구름 위 학교를 감싸는 맑고 푸른 원근 안개.
  scene.fog = new THREE.Fog(0xa9c8dd, 48, 128);
  renderState.overworldFog = scene.fog;

  // 사당 던전 진입 시 오버월드 전체를 한 번에 숨기려고 Group으로 감싼다.
  const world = new THREE.Group();
  scene.add(world);
  renderState.overworld = world;

  createSky(world, animated);

  const hemiLight = new THREE.HemisphereLight(0xd8edff, 0x5e6655, 1.7);
  world.add(hemiLight);

  const sun = new THREE.DirectionalLight(0xffe2a8, 2.45);
  sun.position.set(-21, 31, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -31;
  sun.shadow.camera.right = 31;
  sun.shadow.camera.top = 31;
  sun.shadow.camera.bottom = -31;
  sun.shadow.bias = -0.0004;
  world.add(sun);

  // 청색 림 라이트가 유리 행정동과 캠퍼스 가장자리를 하늘에서 분리한다.
  const rim = new THREE.DirectionalLight(0x9ed8ff, 0.72);
  rim.position.set(11, 7, -12);
  world.add(rim);

  createStylizedWater(world, animated);

  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(22.9, 19.3, 1.35, 28),
    new THREE.MeshStandardMaterial({ color: 0xc9c2a5, roughness: 0.96 })
  );
  island.position.y = -0.48;
  island.receiveShadow = true;
  island.castShadow = true;
  world.add(island);

  const campusTop = new THREE.Mesh(
    new THREE.CylinderGeometry(22.2, 22.7, 0.28, 28),
    new THREE.MeshStandardMaterial({ color: 0xd8d0b6, roughness: 0.9 })
  );
  campusTop.position.y = 0.08;
  campusTop.receiveShadow = true;
  world.add(campusTop);

  createFloatingCampusBase(world);
  createCampusGround(world);

  createAmbientLife(world, animated);

  createCenterCore(world, animated);

  createDock(world, interactables, renderState);

  createLighthouse(world, interactables, animated, renderState);

  renderState.gates = renderState.gates ?? new Map();
  renderState.zoneAuras = renderState.zoneAuras ?? new Map();
  for (const zone of WORLD_ZONES) {
    const zonePosition = new THREE.Vector3(...zone.position);
    createPath(world, zonePosition);
    const landmark = createZone(world, zone, zonePosition);
    createNpc(world, zone, zonePosition, interactables);
    const shrineCrystal = createShrine(world, zone, zonePosition, interactables);
    shrineCrystals.set(zone.shrineId, shrineCrystal);
    createGate(world, zone, interactables, renderState.gates);
    createZoneAura(world, zone, zonePosition, renderState.zoneAuras, landmark);
  }

  for (let i = 0; i < 22; i += 1) {
    const angle = (i / 22) * Math.PI * 2;
    const radius = 18.2 + (i % 3) * 1.15;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (z > 13 || (x > 8 && z < -8) || (x < -7 && z > -1 && z < 8)) {
      continue;
    }
    createSmallTree(world, new THREE.Vector3(x, 0, z), i % 3, animated);
  }
}

function createSky(scene, animated) {
  // 참고 이미지의 맑은 오후: 짙은 하늘색에서 크림빛 구름 수평선으로 이어진다.
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#315e86');
  gradient.addColorStop(0.45, '#6f9fbe');
  gradient.addColorStop(0.76, '#b9d5df');
  gradient.addColorStop(1, '#f4dfbd');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 16, 256);
  const skyTexture = new THREE.CanvasTexture(canvas);
  skyTexture.colorSpace = THREE.SRGBColorSpace;

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(90, 32, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  scene.add(sky);

  // 태양 글로우 스프라이트 (블룸이 잡아 반짝인다).
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfff4d0, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
  sun.scale.set(18, 18, 1);
  sun.position.set(-38, 31, -52);
  scene.add(sun);

  // 부드럽게 흐르는 구름 스프라이트들.
  const cloudTexture = createCloudTexture();
  const cloudGroup = new THREE.Group();
  for (let i = 0; i < 13; i += 1) {
    const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture, transparent: true, opacity: 0.72, depthWrite: false, fog: false }));
    const angle = (i / 13) * Math.PI * 2;
    const radius = 45 + (i % 3) * 9;
    cloud.position.set(Math.cos(angle) * radius, 11 + (i % 4) * 4, Math.sin(angle) * radius);
    const scale = 18 + (i % 3) * 8;
    cloud.scale.set(scale, scale * 0.55, 1);
    cloudGroup.add(cloud);
  }
  scene.add(cloudGroup);
  animated.push({ update: (elapsed) => { cloudGroup.rotation.y = elapsed * 0.006; } });
}

function createCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  for (const [cx, cy, r] of [[54, 74, 30], [78, 70, 26], [40, 78, 22], [66, 58, 24]]) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createStylizedWater(scene, animated) {
  const geometry = new THREE.PlaneGeometry(120, 120, 48, 48);
  const material = new THREE.MeshStandardMaterial({
    color: 0xc9e3ec,
    roughness: 0.78,
    metalness: 0,
    transparent: true,
    opacity: 0.72
  });
  // 시간에 따라 물결이 출렁이도록 정점 셰이더에 파동을 주입한다.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n uniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float wave = sin((position.x + uTime * 1.4) * 0.5) * 0.12
                    + cos((position.y + uTime * 1.1) * 0.6) * 0.1;
         transformed.z += wave;`
      );
    material.userData.shader = shader;
  };

  const water = new THREE.Mesh(geometry, material);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -7.4;
  water.receiveShadow = true;
  scene.add(water);

  animated.push({
    update: (elapsed) => {
      const shader = material.userData.shader;
      if (shader) {
        shader.uniforms.uTime.value = elapsed;
      }
    }
  });
}

function createFloatingCampusBase(scene) {
  const cliffMat = new THREE.MeshStandardMaterial({ color: 0xa9a58f, roughness: 0.98 });
  const shadowMat = new THREE.MeshStandardMaterial({ color: 0x6f7368, roughness: 1 });
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);

  // 섬 아래로 층층이 꺾이는 암반을 만들어 '공중 캠퍼스' 실루엣을 고정한다.
  for (let i = 0; i < 34; i += 1) {
    const angle = (i / 34) * Math.PI * 2;
    const radius = 18.8 + (i % 4) * 0.62;
    const rock = new THREE.Mesh(rockGeo, i % 3 === 0 ? shadowMat : cliffMat);
    rock.position.set(
      Math.cos(angle) * radius,
      -1.3 - (i % 5) * 0.42,
      Math.sin(angle) * radius
    );
    rock.scale.set(2.2 + (i % 3) * 0.5, 1.9 + (i % 4) * 0.48, 2.0 + ((i + 1) % 3) * 0.55);
    rock.rotation.set(i * 0.19, angle, i * 0.11);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }

  // 먼 곳의 작은 부유 암반은 참고 이미지의 깊이를 만든다.
  for (const [x, y, z, s] of [
    [-29, 8, -25, 2.5],
    [-24, 14, -42, 1.8],
    [29, 12, -31, 2.2],
    [36, 5, -8, 1.6],
    [24, 17, -49, 1.3]
  ]) {
    const island = new THREE.Group();
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 0.72, 0.55, 7), new THREE.MeshStandardMaterial({ color: 0xc9c3a8, roughness: 0.94 }));
    const root = new THREE.Mesh(new THREE.ConeGeometry(s * 0.82, s * 2.4, 7), cliffMat);
    cap.position.y = 0.2;
    root.position.y = -s * 1.15;
    root.rotation.x = Math.PI;
    island.add(cap, root);
    island.position.set(x, y, z);
    island.rotation.y = x * 0.1;
    scene.add(island);
  }
}

function createCampusGround(scene) {
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xbab39d, roughness: 0.95 });
  const lawnMat = new THREE.MeshStandardMaterial({ color: 0x647e55, roughness: 0.98 });

  // 중앙 광장과 네 개 학습 구역을 잇는 넓은 석재 보행축.
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(4.25, 4.35, 0.16, 32), pathMat);
  plaza.position.y = 0.23;
  plaza.receiveShadow = true;
  scene.add(plaza);
  for (const [x, z, sx, sz, rotation] of [
    [-10, 4.8, 11, 3.4, -0.14],
    [9.4, -1.5, 11.5, 3.8, 0.08],
    [-4.2, -9.3, 4.2, 12, -0.18],
    [7.6, -9.2, 4.0, 12, 0.18],
    [2.7, 14.2, 4.1, 16, -0.16]
  ]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.12, sz), pathMat);
    walk.position.set(x, 0.22, z);
    walk.rotation.y = rotation;
    walk.receiveShadow = true;
    scene.add(walk);
  }

  // 건물 사이의 제한된 녹지. 포장 중심의 학교 풍경을 유지한다.
  for (const [x, z, sx, sz] of [
    [-17, -7, 5.2, 7],
    [16.2, 5.5, 6, 8],
    [-13.8, 13.5, 6.5, 5.5],
    [14.5, -14.8, 5.8, 4.3]
  ]) {
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.1, sz), lawnMat);
    lawn.position.set(x, 0.25, z);
    lawn.receiveShadow = true;
    scene.add(lawn);
  }
}

function createGrassField(scene, animated) {
  // 인스턴싱으로 가벼운 풀·꽃을 뿌려 바닥을 생기 있게 만든다.
  const bladeGeometry = new THREE.ConeGeometry(0.09, 0.42, 4);
  bladeGeometry.translate(0, 0.21, 0);
  const grassColors = [0x5fbf5a, 0x7ed36a, 0x54b07a];
  const flowerColors = [0xff7eb6, 0xffd23f, 0x9b7cff, 0xff9f43];
  const count = 430;
  const grassMaterial = new THREE.MeshStandardMaterial({ vertexColors: false, color: 0xffffff, roughness: 0.9 });
  // 해류 바람: 섬을 가로질러 파도처럼 지나가는 결정적 사인 흔들림(정점 셰이더 — CPU 무비용).
  // 위상은 인스턴스 위치에서 얻으므로 풀마다 다르게, 시간은 uTime 하나로 구동한다.
  grassMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n uniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           float swayPhase = instanceMatrix[3].x * 0.55 + instanceMatrix[3].z * 0.45;
           transformed.x += sin(uTime * 1.9 + swayPhase) * position.y * 0.42;
           transformed.z += cos(uTime * 1.3 + swayPhase) * position.y * 0.2;
         #endif`
      );
    grassMaterial.userData.shader = shader;
  };
  const grass = new THREE.InstancedMesh(bladeGeometry, grassMaterial, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let placed = 0;
  for (let i = 0; i < count * 2 && placed < count; i += 1) {
    const angle = (i * 2.399963) % (Math.PI * 2);
    const radius = 2.6 + ((i * 0.618) % 1) * 17.0;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    // 중앙 코어와 길목은 비운다.
    if (Math.hypot(x, z) < 2.6) {
      continue;
    }
    dummy.position.set(x, 0.02, z);
    const scale = 0.7 + ((i * 0.37) % 1) * 0.8;
    dummy.scale.set(scale, scale, scale);
    dummy.rotation.y = (i * 1.3) % (Math.PI * 2);
    dummy.updateMatrix();
    grass.setMatrixAt(placed, dummy.matrix);
    const isFlower = i % 6 === 0;
    color.setHex(isFlower ? flowerColors[i % flowerColors.length] : grassColors[i % grassColors.length]);
    grass.setColorAt(placed, color);
    placed += 1;
  }
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) {
    grass.instanceColor.needsUpdate = true;
  }
  grass.castShadow = false;
  grass.receiveShadow = true;
  scene.add(grass);
  animated.push({
    update: (elapsed) => {
      const shader = grassMaterial.userData.shader;
      if (shader) {
        shader.uniforms.uTime.value = elapsed;
      }
    }
  });
}

// 지식의 유리병(Z5) — 섬 곳곳에 숨은 12개. 이미 주운 병은 만들지 않는다(세이브 반영).
// 위치·꿀팁은 worldData.KNOWLEDGE_BOTTLES가 단일 출처.
function createKnowledgeBottles(renderState, progress) {
  const collected = new Set(progress.knowledgeBottles ?? []);
  const scene = renderState.overworld ?? renderState.scene;
  const meshes = new Map();
  for (const bottle of KNOWLEDGE_BOTTLES) {
    if (collected.has(bottle.id)) {
      continue;
    }
    const g = new THREE.Group();
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 0.42, 10),
      new THREE.MeshStandardMaterial({
        color: 0x9fd8e8,
        emissive: 0x2a5866,
        emissiveIntensity: 0.5,
        roughness: 0.25,
        transparent: true,
        opacity: 0.9
      })
    );
    glass.position.y = 0.36;
    const cork = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x9a6a3c, roughness: 0.9 })
    );
    cork.position.y = 0.62;
    const note = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.07, 0),
      new THREE.MeshBasicMaterial({ color: 0xfff2b8 })
    );
    note.position.y = 0.36;
    g.add(glass, cork, note);
    g.position.set(bottle.pos[0], 0, bottle.pos[1]);
    g.userData.glass = glass; // 근접 반짝임에 쓰는 발광 유리 참조(R-루프8)
    g.userData.note = note;
    scene.add(g);
    meshes.set(bottle.id, g);
    renderState.interactables.push({
      type: 'bottle',
      bottleId: bottle.id,
      position: new THREE.Vector3(bottle.pos[0], 0, bottle.pos[1]),
      labelKo: '지식의 유리병'
    });
  }
  renderState.bottleMeshes = meshes;
  renderState.animated.push({
    update: (elapsed) => {
      // 근접 반짝임(R-루프8) — 플레이어가 가까울수록 유리가 밝아지고 빠르게 반짝인다.
      // '찾는 재미'(getting-warmer)를 결정적으로 준다(위치 기반, 랜덤 없음).
      const player = renderState.game?.player?.position;
      let i = 0;
      for (const mesh of meshes.values()) {
        const near = player ? Math.max(0, 1 - Math.hypot(mesh.position.x - player.x, mesh.position.z - player.z) / 6) : 0;
        const bobHz = 1.9 + near * 3.4;
        mesh.position.y = Math.sin(elapsed * bobHz + i * 1.3) * (0.06 + near * 0.05);
        mesh.rotation.y = elapsed * (0.8 + near * 1.6) + i;
        const glass = mesh.userData.glass;
        if (glass) {
          const pulse = 0.5 + near * (1.2 + Math.sin(elapsed * 8) * 0.5 * near);
          glass.material.emissiveIntensity = pulse;
        }
        if (mesh.userData.note) {
          const s = 1 + near * 0.5;
          mesh.userData.note.scale.setScalar(s);
        }
        i += 1;
      }
    }
  });
}

// 살아있는 세계(Z1) — 비트나비·소식 갈매기·굴뚝 연기. 전부 elapsed 기반 결정적 궤도라
// 교실 어느 기기에서든 같은 순간 같은 장면이 나온다. 라이트·렌더타깃 추가 없음.
function createAmbientLife(scene, animated) {
  const life = new THREE.Group();
  scene.add(life);

  // 비트나비 — 픽셀 사각 날개 나비 4마리, 구역 꽃밭 위를 리사주 궤도로 팔랑인다.
  const butterflyColors = [0xff7eb6, 0x7cd7ff, 0xffd23f, 0x9b7cff];
  const butterflies = [];
  WORLD_ZONES.forEach((zone, i) => {
    const b = new THREE.Group();
    const wingMat = new THREE.MeshBasicMaterial({
      color: butterflyColors[i % butterflyColors.length],
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92
    });
    const wingGeo = new THREE.PlaneGeometry(0.16, 0.22);
    const left = new THREE.Mesh(wingGeo, wingMat);
    const right = new THREE.Mesh(wingGeo, wingMat);
    left.position.x = -0.09;
    right.position.x = 0.09;
    b.add(left, right);
    b.userData = { left, right, cx: zone.position[0], cz: zone.position[2], phase: i * 1.7 };
    life.add(b);
    butterflies.push(b);
  });

  // 소식 갈매기 — 섬 상공을 크게 선회하는 3마리. 몸통 원뿔 + 판 날개 2장.
  const gulls = [];
  for (let i = 0; i < 3; i += 1) {
    const gull = new THREE.Group();
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0xf4f7ff });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.62, 6), bodyMat);
    body.rotation.x = Math.PI / 2; // 부리가 진행 방향(+z)
    gull.add(body);
    const wings = [];
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.26), bodyMat);
      wing.position.x = side * 0.44;
      wing.userData.side = side;
      gull.add(wing);
      wings.push(wing);
    }
    gull.userData = { wings, radius: 20 + i * 3.4, height: 8.6 + i * 1.5, speed: 0.14 + i * 0.03, phase: i * 2.1 };
    life.add(gull);
    gulls.push(gull);
  }

  // 굴뚝 연기 — 개인정보 마을 첫 집 지붕 위. 퍼프 3개가 떠오르며 커지고 옅어지는 루프.
  const village = WORLD_ZONES.find((z) => z.id === 'privacy-village');
  const puffs = [];
  if (village) {
    const chimneyBase = new THREE.Vector3(village.position[0] - 1.5, 1.18, village.position[2] - 0.7);
    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.3, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x8a5b4a, roughness: 0.9 })
    );
    chimney.position.copy(chimneyBase).y -= 0.12;
    life.add(chimney);
    for (let i = 0; i < 3; i += 1) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xf2f5f7, transparent: true, opacity: 0.5, depthWrite: false })
      );
      puff.userData = { base: chimneyBase, phase: i / 3 };
      life.add(puff);
      puffs.push(puff);
    }
  }

  animated.push({
    update: (elapsed) => {
      for (const b of butterflies) {
        const { left, right, cx, cz, phase } = b.userData;
        b.position.set(
          cx + Math.sin(elapsed * 0.62 + phase) * 2.1,
          0.85 + Math.sin(elapsed * 2.3 + phase) * 0.28,
          cz + Math.cos(elapsed * 0.5 + phase * 1.3) * 1.7
        );
        const flap = Math.sin(elapsed * 11 + phase) * 0.75;
        left.rotation.y = flap;
        right.rotation.y = -flap;
      }
      for (const gull of gulls) {
        const { wings, radius, height, speed, phase } = gull.userData;
        const a = elapsed * speed + phase;
        gull.position.set(Math.cos(a) * radius, height + Math.sin(elapsed * 0.7 + phase) * 0.7, Math.sin(a) * radius);
        gull.rotation.y = -a; // 원 접선 방향으로 머리를 둔다
        for (const wing of wings) {
          wing.rotation.z = wing.userData.side * Math.sin(elapsed * 5.2 + phase) * 0.42;
        }
      }
      for (const puff of puffs) {
        const t = (elapsed * 0.24 + puff.userData.phase) % 1;
        puff.position.copy(puff.userData.base);
        puff.position.y += t * 1.9;
        puff.position.x += Math.sin(t * 6.0) * 0.12;
        const s = 0.6 + t * 1.8;
        puff.scale.set(s, s, s);
        puff.material.opacity = 0.5 * (1 - t);
      }
    }
  });
}

const ICON_FOR_TYPE = { shrine: ['❗', '#eba52c'], npc: ['💬', null], gate: ['⚠️', '#8a5eff'] };

function createInteractionIcons(renderState) {
  const { interactables, icons } = renderState;
  // 유도 아이콘도 오버월드 그룹에 담아, 던전 진입 시 함께 숨겨지도록 한다.
  const container = renderState.overworld ?? renderState.scene;
  interactables.forEach((item, index) => {
    const spec = ICON_FOR_TYPE[item.type];
    if (!spec) {
      return;
    }
    const topic = getTopicById(item.topicId);
    const [emoji, ring] = spec;
    const sprite = createFloatingIcon(emoji, ring ?? topic.color);
    const baseY = item.type === 'shrine' ? item.position.y + 2.5 : item.position.y + 2.2;
    sprite.position.set(item.position.x, baseY, item.position.z);
    container.add(sprite);
    icons.push({ sprite, item, baseY, phase: index * 1.3 });
  });
}

function updateInteractionIcons(game, renderState) {
  const elapsed = clock.elapsedTime;
  for (const icon of renderState.icons) {
    // 위아래로 통통 떠서 시선을 끈다.
    icon.sprite.position.y = icon.baseY + Math.sin(elapsed * 2.2 + icon.phase) * 0.13;

    if (icon.item.type === 'shrine') {
      const done = game.progress.completedShrines.includes(icon.item.shrineId);
      if (done && !icon.done) {
        setIconEmoji(icon.sprite, '✅', '#2fae74');
        icon.done = true;
      }
      icon.sprite.material.opacity = done ? 0.42 : 1;
      icon.sprite.scale.setScalar(0.9 * (icon.item.shrineId === game.nearest?.shrineId ? 1.18 : 1));
    } else if (icon.item.type === 'gate') {
      const status = getGateStatus(game.progress, icon.item.topicId);
      // 관문: 대화 전엔 흐릿, 도구 있으면 밝게 '지금 여기!', 해결되면 사라짐.
      if (status === 'solved') {
        icon.sprite.visible = false;
      } else if (status === 'ready' && !icon.ready) {
        setIconEmoji(icon.sprite, '❗', '#8a5eff');
        icon.ready = true;
      }
      icon.sprite.material.opacity = status === 'need-intro' ? 0.28 : status === 'ready' ? 1 : 0.55;
      const near = icon.item.topicId === game.nearest?.topicId && game.nearest?.type === 'gate';
      icon.sprite.scale.setScalar(0.9 * (near ? 1.2 : 1));
    } else {
      const visited = game.progress.visitedTopics.includes(icon.item.topicId);
      const solved = getGateStatus(game.progress, icon.item.topicId) === 'solved';
      if (solved && !icon.done) {
        setIconEmoji(icon.sprite, '✅', '#2fae74');
        icon.done = true;
      }
      icon.sprite.material.opacity = solved ? 0.4 : visited ? 0.5 : 1;
      const bump = icon.item.zoneId === game.nearest?.zoneId && game.nearest?.type === 'npc' ? 1.18 : 1;
      icon.sprite.scale.setScalar(0.9 * bump);
    }
  }
}

function createCenterCore(scene, animated) {
  const registry = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xb2aa91, roughness: 0.9 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xe9e2ca, roughness: 0.84 });
  const frame = new THREE.MeshStandardMaterial({ color: 0x3c4a43, roughness: 0.68, metalness: 0.18 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.75, 0.55, 16), stone);
  base.position.y = 0.34;
  registry.add(base);
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.15, 0.34, 16), frame);
  canopy.position.y = 3.7;
  registry.add(canopy);

  const panels = new THREE.Group();
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const panel = new THREE.Group();
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.55, 0.12), paper);
    const border = new THREE.Mesh(new THREE.BoxGeometry(1.18, 2.72, 0.08), frame);
    border.position.z = 0.07;
    sheet.position.z = 0.13;
    panel.add(border, sheet);
    for (let row = 0; row < 7; row += 1) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.035, 0.025),
        new THREE.MeshBasicMaterial({ color: row === 4 && i === 1 ? 0xd69b36 : 0x777563 })
      );
      line.position.set(0, 0.88 - row * 0.28, 0.21);
      panel.add(line);
    }
    panel.position.set(Math.sin(angle) * 1.5, 2.15, Math.cos(angle) * 1.5);
    panel.rotation.y = angle;
    panels.add(panel);
  }
  registry.add(panels);

  const title = createLabelSprite('오늘의 명단 · H-17 없음', '#d9a33f');
  title.scale.set(3.7, 0.72, 1);
  title.position.set(0, 4.38, 0);
  registry.add(title);
  registry.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(registry);

  // 중앙의 비어 있는 한 칸은 기존 AI 코어 진행 로직을 이어받는다.
  const crystal = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 1.05, 0.22),
    new THREE.MeshStandardMaterial({
      color: 0x9aa6b2,
      emissive: 0x2a3440,
      emissiveIntensity: 0.4,
      roughness: 0.25,
      metalness: 0.1
    })
  );
  crystal.position.set(0, 1.4, 0);
  crystal.castShadow = true;
  scene.add(crystal);

  const coreLight = new THREE.PointLight(0xd69b36, 1.2, 11);
  coreLight.position.set(0, 1.7, 0);
  scene.add(coreLight);
  animated.push({ update: (elapsed) => { panels.rotation.y = elapsed * 0.08; } });

  activeQuest = { coreCrystal: crystal, coreGlow: coreLight };
}

function createPath(scene, target) {
  const side = Math.sign(target.x || 1) * 1.35;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.36, 0),
    new THREE.Vector3(target.x * 0.32 + side, 0.36, target.z * 0.28),
    new THREE.Vector3(target.x * 0.72 - side * 0.45, 0.36, target.z * 0.72),
    new THREE.Vector3(target.x * 0.88, 0.36, target.z * 0.88)
  ]);
  const path = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 34, 0.1, 7, false),
    new THREE.MeshStandardMaterial({
      color: 0xffc34f,
      emissive: 0xc77818,
      emissiveIntensity: 1.35,
      roughness: 0.45
    })
  );
  path.position.y = 0.02;
  path.receiveShadow = true;
  scene.add(path);

  for (let i = 1; i < 9; i += 1) {
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(i % 2 === 0 ? 0.17 : 0.11, 10),
      new THREE.MeshBasicMaterial({ color: 0xffdd79, transparent: true, opacity: 0.82, depthWrite: false })
    );
    const point = curve.getPoint(i / 10);
    dot.rotation.x = -Math.PI / 2;
    dot.position.copy(point);
    dot.position.y += 0.04;
    scene.add(dot);
  }
}

function createZone(scene, zone, position) {
  const topic = getTopicById(zone.topicId);
  const color = new THREE.Color(topic.color);
  let landmark = {};
  const disc = new THREE.Mesh(
    new THREE.RingGeometry(2.72, 2.84, 42),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.38,
      roughness: 0.9,
      side: THREE.DoubleSide
    })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(position.x, 0.13, position.z);
  scene.add(disc);

  const label = createLabelSprite(zone.nameKo, topic.color);
  label.scale.set(2.8, 0.62, 1);
  label.position.set(position.x, 4.7, position.z);
  scene.add(label);

  if (zone.topicId === 'privacy') {
    landmark = createEmptyClassroom(scene, position);
  } else if (zone.topicId === 'bias') {
    landmark = createFingerprintPlayground(scene, position);
  } else if (zone.topicId === 'copyright') {
    landmark = createArchiveLibrary(scene, position);
  } else {
    landmark = createMediaLab(scene, position);
  }
  return landmark;
}

function createEmptyClassroom(scene, position) {
  const room = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: 0xc8c1a7, roughness: 0.95 });
  const plaster = new THREE.MeshStandardMaterial({ color: 0xe4ddc7, roughness: 0.9 });
  const wood = new THREE.MeshStandardMaterial({ color: 0xa97943, roughness: 0.84 });
  const green = new THREE.MeshStandardMaterial({ color: 0x314f3c, roughness: 0.78 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x3f4b43, roughness: 0.72, metalness: 0.18 });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.24, 5.6), concrete);
  floor.position.set(0, 0.34, -0.8);
  const back = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.5, 0.24), plaster);
  back.position.set(0, 2.05, -3.48);
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.5, 5.6), plaster);
  side.position.set(-3.48, 2.05, -0.8);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.26, 6.0), concrete);
  roof.position.set(0, 3.92, -0.8);
  const board = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.45, 0.16), green);
  board.position.set(0.45, 2.15, -3.28);
  room.add(floor, back, side, roof, board);

  // 다섯 책상 중 H-17 자리는 사라진 채 바닥의 호박빛 윤곽만 남는다.
  for (const [x, z] of [[-1.7, -1.9], [0.2, -1.9], [1.9, -1.9], [-1.7, 0], [1.9, 0]]) {
    const desk = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.15, 0.72), wood);
    top.position.y = 1.03;
    desk.add(top);
    for (const lx of [-0.47, 0.47]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.85, 0.09), metal);
      leg.position.set(lx, 0.57, 0);
      desk.add(leg);
    }
    desk.position.set(x, 0, z);
    room.add(desk);
  }
  const missingSeat = new THREE.Mesh(
    new THREE.RingGeometry(0.46, 0.58, 4),
    new THREE.MeshBasicMaterial({ color: 0xffc95c, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
  );
  missingSeat.rotation.x = -Math.PI / 2;
  missingSeat.rotation.z = Math.PI / 4;
  missingSeat.position.set(0.2, 0.51, 0);
  room.add(missingSeat);

  // 출석 사물함: 17번 칸만 비어 있고 테두리가 빛난다.
  for (let i = 0; i < 7; i += 1) {
    const locker = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.35, 0.42), i === 3 ? metal : plaster);
    locker.position.set(-2.5 + i * 0.78, 1.15, -2.97);
    room.add(locker);
  }
  const blank = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 1.46, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xffc559, emissive: 0xc77d18, emissiveIntensity: 1.2, roughness: 0.4 })
  );
  blank.position.set(-2.5 + 3 * 0.78, 1.15, -2.7);
  room.add(blank);

  const roomSign = createLabelSprite('1-3반 · H-17 기록 없음', '#d7a13a');
  roomSign.scale.set(3.1, 0.56, 1);
  roomSign.position.set(-1.0, 3.25, -3.15);
  room.add(roomSign);
  room.position.set(position.x, 0, position.z);
  room.traverse((child) => {
    if (child.isMesh && !child.material.transparent) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(room);
  return { room };
}

function createFingerprintPlayground(scene, position) {
  const field = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xa9503b, roughness: 0.92 });
  const white = new THREE.MeshBasicMaterial({ color: 0xf1e6ce });
  const turf = new THREE.MeshStandardMaterial({ color: 0x496e4c, roughness: 0.98 });

  const track = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.72, 16, 72), red);
  track.rotation.x = Math.PI / 2;
  track.scale.set(1.42, 0.9, 1);
  track.position.y = 0.35;
  field.add(track);
  const infield = new THREE.Mesh(new THREE.CircleGeometry(2.18, 48), turf);
  infield.rotation.x = -Math.PI / 2;
  infield.scale.set(1.42, 0.9, 1);
  infield.position.y = 0.38;
  field.add(infield);
  for (const radius of [1.95, 2.22, 2.48]) {
    const lane = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.025, 5, 72), white);
    lane.rotation.x = Math.PI / 2;
    lane.scale.set(1.42, 0.9, 1);
    lane.position.y = 0.41;
    field.add(lane);
  }

  const leafMeshes = [];
  for (let i = 0; i < 6; i += 1) {
    const radius = 0.34 + i * 0.25;
    const printLine = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.035, 5, 54, Math.PI * 1.54),
      new THREE.MeshStandardMaterial({ color: 0xdbc892, roughness: 0.75 })
    );
    printLine.rotation.x = Math.PI / 2;
    printLine.rotation.z = -0.48 + i * 0.08;
    printLine.scale.set(1.18, 0.82, 1);
    printLine.position.set(0.15, 0.45, 0.1);
    printLine.userData.naturalColor = printLine.material.color.clone();
    field.add(printLine);
    leafMeshes.push(printLine);
  }
  const scoreFrame = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.35, 0.2), new THREE.MeshStandardMaterial({ color: 0x333c38, roughness: 0.65 }));
  scoreFrame.position.set(3.75, 1.65, -1.4);
  field.add(scoreFrame);
  const score = createLabelSprite('위험 점수 · 기준 불명', '#db9e35');
  score.scale.set(2.3, 0.48, 1);
  score.position.set(3.75, 1.65, -1.26);
  field.add(score);

  field.position.set(position.x, 0, position.z);
  field.traverse((child) => {
    if (child.isMesh && !child.material.transparent) {
      child.receiveShadow = true;
      child.castShadow = child.geometry?.type !== 'CircleGeometry';
    }
  });
  scene.add(field);
  return { leafMeshes };
}

function createArchiveLibrary(scene, position) {
  const archive = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xb8ae92, roughness: 0.93 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x594735, roughness: 0.84 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb98a38, roughness: 0.48, metalness: 0.38 });
  const bookPalette = [0x74483a, 0x435d54, 0x8c7040, 0x4e526b, 0x8d5d58];

  const floor = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.22, 5.8), stone);
  floor.position.y = 0.34;
  archive.add(floor);
  for (const [x, z, rotation] of [[-2.65, -0.7, 0], [2.65, -0.7, 0], [0, -2.55, Math.PI / 2]]) {
    const shelf = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.15, 4.2), darkWood);
    body.position.y = 1.95;
    shelf.add(body);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(0.13, 0.48 + ((row + col) % 2) * 0.12, 0.34),
          new THREE.MeshStandardMaterial({ color: bookPalette[(row * 2 + col) % bookPalette.length], roughness: 0.8 })
        );
        book.position.set(0.57, 0.77 + row * 0.7, -1.55 + col * 0.58);
        shelf.add(book);
      }
    }
    shelf.position.set(x, 0, z);
    shelf.rotation.y = rotation;
    archive.add(shelf);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.22, 10, 36, Math.PI), stone);
  arch.position.set(0, 2.4, 1.95);
  archive.add(arch);
  for (const x of [-2, 2]) {
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.2, 0.45), stone);
    column.position.set(x, 1.85, 1.95);
    archive.add(column);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 0.12), brass);
  plate.position.set(0, 2.9, 2.16);
  archive.add(plate);
  const sign = createLabelSprite('기록 보관소 · 제작 로그', '#c89133');
  sign.scale.set(2.8, 0.52, 1);
  sign.position.set(0, 2.95, 2.25);
  archive.add(sign);

  archive.position.set(position.x, 0, position.z);
  archive.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(archive);
  return { archive };
}

function createMediaLab(scene, position) {
  const lab = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0x334846, roughness: 0.58, metalness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9dcbd2,
    emissive: 0x315b61,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.42,
    roughness: 0.16,
    metalness: 0.12
  });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.22, 5.4), new THREE.MeshStandardMaterial({ color: 0x8f9990, roughness: 0.84 }));
  floor.position.y = 0.34;
  lab.add(floor);
  for (const [x, z, sx, sz] of [[-3.05, 0, 0.18, 5.4], [3.05, 0, 0.18, 5.4], [0, -2.6, 6.2, 0.18]]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(sx, 3.8, sz), glass);
    panel.position.set(x, 2.2, z);
    lab.add(panel);
  }
  for (const [x, z] of [[-3.05, -2.6], [3.05, -2.6], [-3.05, 2.6], [3.05, 2.6]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.3, 0.2), frame);
    post.position.set(x, 2.35, z);
    lab.add(post);
  }
  const screens = new THREE.Group();
  const screenMats = [
    new THREE.MeshBasicMaterial({ color: 0x5b374d }),
    new THREE.MeshBasicMaterial({ color: 0x1c1826 }),
    new THREE.MeshBasicMaterial({ color: 0x405c61 })
  ];
  for (let i = 0; i < 3; i += 1) {
    const screen = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.25, 0.12), screenMats[i]);
    screen.position.set((i - 1) * 1.65, 2.05, -2.42);
    screens.add(screen);
  }
  lab.add(screens);
  const scan = new THREE.Mesh(
    new THREE.TorusGeometry(1.08, 0.07, 8, 48),
    new THREE.MeshStandardMaterial({ color: 0x9ef5ff, emissive: 0x4ac8da, emissiveIntensity: 1.35, roughness: 0.28 })
  );
  scan.position.set(0, 2.0, -2.22);
  lab.add(scan);
  const sign = createLabelSprite('원본 없음 · 생성 시각 불일치', '#8bdde8');
  sign.scale.set(3.1, 0.55, 1);
  sign.position.set(0, 3.85, -2.34);
  lab.add(sign);
  lab.position.set(position.x, 0, position.z);
  lab.traverse((child) => {
    if (child.isMesh && !child.material.transparent) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(lab);
  return { opening: screenMats[1] && screens.children[1] };
}

// 등교용 페리 터미널 — 남쪽 절벽에서 「잡음의 군도」 항해 씬으로 나가는 문.
const DOCK_POS = { x: 3.4, z: 19.1 };

function createDock(scene, interactables, renderStateRef) {
  const dock = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: 0xb8b39f, roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x3e4947, roughness: 0.65, metalness: 0.22 });
  const ferryMat = new THREE.MeshStandardMaterial({ color: 0xd5a84d, roughness: 0.72 });
  const walkway = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.24, 4.2), concrete);
  walkway.position.set(0, 0.4, 1.35);
  dock.add(walkway);
  for (const [px, pz] of [[-0.9, -0.2], [0.9, -0.2], [-0.9, 2.9], [0.9, 2.9]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), metal);
    post.position.set(px, 0.78, pz);
    dock.add(post);
  }
  const ferry = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.58, 3.2), ferryMat);
  hull.position.y = 0.3;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.35), concrete);
  cabin.position.set(0, 1.0, 0.25);
  const window = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.38, 0.08), new THREE.MeshBasicMaterial({ color: 0x527982 }));
  window.position.set(0, 1.05, -0.47);
  ferry.add(hull, cabin, window);
  ferry.position.set(2.3, -0.15, 3.3);
  ferry.rotation.y = -0.16;
  dock.add(ferry);
  const sign = createLabelSprite('등교용 페리 탑승구', '#d1a13e');
  sign.scale.set(2.4, 0.48, 1);
  sign.position.set(-0.25, 1.72, -0.35);
  dock.add(sign);
  dock.position.set(DOCK_POS.x, 0, DOCK_POS.z);
  scene.add(dock);

  interactables.push({
    type: 'dock',
    position: new THREE.Vector3(DOCK_POS.x, 0, DOCK_POS.z + 0.6),
    labelKo: '등교용 페리 터미널 — 군도로 항해'
  });

  // 하루의 증거 수신기 — 새 감사 신호가 있으면 빛난다(animateWorld가 구동).
  const mailPost = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 0.16), metal);
  mailPost.position.set(DOCK_POS.x - 3.0, 0.5, DOCK_POS.z - 2.0);
  scene.add(mailPost);
  const bottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.28, 0.62, 10),
    new THREE.MeshStandardMaterial({ color: 0x9fd8e8, emissive: 0x2a5866, emissiveIntensity: 0.4, roughness: 0.25, transparent: true, opacity: 0.9 })
  );
  bottle.position.set(DOCK_POS.x - 3.0, 1.28, DOCK_POS.z - 2.0);
  scene.add(bottle);
  const mailGlow = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.16, 0),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0 })
  );
  mailGlow.position.set(DOCK_POS.x - 3.0, 1.3, DOCK_POS.z - 2.0);
  mailGlow.visible = false;
  scene.add(mailGlow);
  renderStateRef.novaMailGlow = mailGlow;

  interactables.push({
    type: 'letter',
    position: new THREE.Vector3(DOCK_POS.x - 3.0, 0, DOCK_POS.z - 2.0),
    labelKo: '하루의 증거 수신기'
  });
}

// 학생 기록 행정동 — 섬 어디서든 보이는 세로 랜드마크이자 삭제 명령의 발신지.
// 유리탑의 복구 광선은 치유한 스테이지 수만큼 늘어난다.
const LIGHTHOUSE_POS = { x: 14, z: -14 };
function createLighthouse(scene, interactables, animated, renderStateRef) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xbab7a7, roughness: 0.84 });
  const frame = new THREE.MeshStandardMaterial({ color: 0x344744, roughness: 0.55, metalness: 0.32 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x8fbfc9,
    emissive: 0x264d54,
    emissiveIntensity: 0.22,
    transparent: true,
    opacity: 0.46,
    roughness: 0.14,
    metalness: 0.16
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.75, 4.8), stone);
  base.position.y = 0.48;
  g.add(base);
  for (let floor = 0; floor < 5; floor += 1) {
    const y = 1.35 + floor * 1.55;
    const glassFloor = new THREE.Mesh(new THREE.BoxGeometry(4.65, 1.35, 4.0), glass);
    glassFloor.position.y = y;
    g.add(glassFloor);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.18, 4.3), floor === 4 ? stone : frame);
    slab.position.y = y + 0.76;
    g.add(slab);
    for (const x of [-2.1, 0, 2.1]) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.35, 0.16), frame);
      mullion.position.set(x, y, 2.05);
      g.add(mullion);
    }
  }
  const annex = new THREE.Mesh(new THREE.BoxGeometry(2.7, 4.4, 3.4), stone);
  annex.position.set(-3.2, 2.55, 0.2);
  g.add(annex);
  const h17Panel = createLabelSprite('학생 정보 · H-17 · 기록 삭제됨', '#d9a13d');
  h17Panel.scale.set(3.6, 0.62, 1);
  h17Panel.position.set(0.2, 5.65, 2.2);
  g.add(h17Panel);

  // 삭제 광선은 기본 1줄, 복구가 진행되면 주변에 6개의 확인 광선이 차례로 켜진다.
  const deletionBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.5, 17, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xeafcff,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  deletionBeam.position.set(0.5, 15.5, 0);
  g.add(deletionBeam);
  const beamGroup = new THREE.Group();
  beamGroup.position.y = 8.3;
  const beams = [];
  for (let i = 0; i < 6; i += 1) {
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.14, 9.5, 6, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffd26a,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    beam.position.set(1.25, 4.6, 0);
    beam.rotation.z = 0.08;
    const arm = new THREE.Group();
    arm.rotation.y = (i / 6) * Math.PI * 2;
    arm.add(beam);
    arm.visible = false;
    beamGroup.add(arm);
    beams.push(arm);
  }
  g.add(beamGroup);

  g.traverse((child) => {
    if (child.isMesh && !child.material.transparent) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  g.position.set(LIGHTHOUSE_POS.x, 0, LIGHTHOUSE_POS.z);
  scene.add(g);
  renderStateRef.lighthouseBeams = { group: beamGroup, beams };

  interactables.push({
    type: 'lighthouse',
    position: new THREE.Vector3(LIGHTHOUSE_POS.x, 0, LIGHTHOUSE_POS.z + 2.8),
    labelKo: '학생 기록 행정동'
  });

  // 페리 → 행정동 → 명단탑을 잇는 H-17 마지막 동선.
  const guideLights = [];
  const waypoints = [
    [DOCK_POS.x, DOCK_POS.z - 1.6],
    [LIGHTHOUSE_POS.x - 3.4, LIGHTHOUSE_POS.z + 1.2],
    [0, 0]
  ];
  let idx = 0;
  for (let seg = 0; seg < waypoints.length - 1; seg += 1) {
    const [ax, az] = waypoints[seg];
    const [bx, bz] = waypoints[seg + 1];
    const steps = seg === 0 ? 3 : 6;
    for (let i = 1; i <= steps; i += 1) {
      const t = i / (steps + 1);
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.2, 10),
        new THREE.MeshBasicMaterial({ color: 0xffcf61, transparent: true, opacity: 0.3, depthWrite: false })
      );
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(ax + (bx - ax) * t, 0.06, az + (bz - az) * t);
      dot.userData.order = idx;
      idx += 1;
      scene.add(dot);
      guideLights.push(dot);
    }
  }
  animated.push({
    update: (elapsed) => {
      for (const dot of guideLights) {
        // 파도처럼 순서대로 밝아지는 유도등(공항 활주로 등화 문법).
        const wave = Math.sin(elapsed * 2.4 - dot.userData.order * 0.7);
        dot.material.opacity = 0.18 + Math.max(0, wave) * 0.5;
      }
    }
  });
}

function createNpc(scene, zone, zonePosition, interactables) {
  const npc = createNpcCharacter(zone.topicId);
  npc.position.set(zonePosition.x - 1.25, 0, zonePosition.z + 1.05);
  // 플레이어(섬 안쪽)를 바라보도록 회전.
  npc.rotation.y = Math.atan2(-npc.position.x, -npc.position.z);
  scene.add(npc);

  interactables.push({
    type: 'npc',
    topicId: zone.topicId,
    zoneId: zone.id,
    position: npc.position.clone(),
    labelKo: `${zone.npc.nameKo}${josaWaGwa(zone.npc.nameKo)} 대화`
  });
}

function createShrine(scene, zone, zonePosition, interactables) {
  const topic = getTopicById(zone.topicId);
  const shrine = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.9, 0.34, 8),
    new THREE.MeshStandardMaterial({ color: 0x7e8073, roughness: 0.75 })
  );
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.08, 12, 32, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xb8ab80, roughness: 0.64 })
  );
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.36, 0),
    new THREE.MeshStandardMaterial({
      color: topic.color,
      emissive: topic.color,
      emissiveIntensity: 0.28,
      roughness: 0.32
    })
  );
  base.position.y = 0.24;
  arch.position.y = 0.78;
  arch.rotation.z = Math.PI;
  crystal.position.y = 0.82;
  shrine.add(base, arch, crystal);
  shrine.position.set(zonePosition.x + 1.35, 0, zonePosition.z - 1.05);
  shrine.rotation.y = Math.atan2(-shrine.position.x, -shrine.position.z);
  shrine.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
  });
  scene.add(shrine);

  interactables.push({
    type: 'shrine',
    topicId: zone.topicId,
    shrineId: zone.shrineId,
    position: shrine.position.clone(),
    labelKo: `${getShrineById(zone.shrineId).nameKo} 풀기`
  });

  return crystal;
}

// 화이트아웃 관문 — 감사 도구로 해결해야 하는 삭제 사건 덩어리.
function createGate(scene, zone, interactables, gates) {
  const quest = QUESTS[zone.topicId];
  const [gx, gz] = quest.gatePosition;
  const group = new THREE.Group();
  // 회색·보라 글리치 덩어리
  const glitchMat = new THREE.MeshStandardMaterial({
    color: 0x4a3f5c,
    emissive: 0x6a4fb0,
    emissiveIntensity: 0.4,
    roughness: 0.9,
    flatShading: true
  });
  for (let i = 0; i < 5; i += 1) {
    const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34 + (i % 3) * 0.12, 0), glitchMat);
    const a = (i / 5) * Math.PI * 2;
    chunk.position.set(Math.cos(a) * 0.5, 0.5 + (i % 2) * 0.35, Math.sin(a) * 0.5);
    chunk.castShadow = true;
    group.add(chunk);
  }
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x2a2436, emissive: 0x8a5eff, emissiveIntensity: 0.7, flatShading: true })
  );
  core.position.y = 0.7;
  group.add(core);
  group.position.set(gx, 0, gz);
  scene.add(group);

  gates.set(zone.topicId, group);
  interactables.push({
    type: 'gate',
    topicId: zone.topicId,
    position: new THREE.Vector3(gx, 0, gz),
    labelKo: `${quest.gateLabelKo} 살펴보기`
  });
}

// 구역의 세계 상태 연출: 아직 못 풀었으면 화이트아웃 안개가 덮고,
// 조각을 얻어 해결하면 안개가 걷히고 그 구역 색의 꽃이 피어난다(세계가 낫는다).
// 모든 구역이 공유하는 삭제 안개(회색+보라 원반 + 글리치 큐브 5개).
function buildSharedHaze(group) {
  const hazeGroup = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(3.1, 40),
    new THREE.MeshBasicMaterial({ color: 0x6a5f82, transparent: true, opacity: 0.36, side: THREE.DoubleSide, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 1.6;
  hazeGroup.add(disc);
  const pixelMat = new THREE.MeshStandardMaterial({ color: 0x8a7fb0, emissive: 0x5a3d9a, emissiveIntensity: 0.6, roughness: 0.8 });
  const pixels = [];
  for (let i = 0; i < 5; i += 1) {
    const s = 0.14 + (i % 3) * 0.05;
    const cube = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), pixelMat);
    pixels.push(cube);
    hazeGroup.add(cube);
  }
  group.add(hazeGroup);
  return { group: hazeGroup, disc, pixels };
}

// privacy — 몰래 찍힌 사진이 잡음 덩굴 사이를 소용돌이치다, 해결되면 집으로 정착.
function buildPrivacyAura(group, topic) {
  const corruption = new THREE.Group();
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x4a3a63, emissive: 0x5a3d9a, emissiveIntensity: 0.5, roughness: 0.8 });
  const housePts = [[-1.5, -0.7], [1.3, -0.5], [-0.2, 1.2]];
  const vines = [];
  housePts.forEach(([hx, hz], i) => {
    const vine = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 12, Math.PI * 0.9), vineMat);
    vine.position.set(hx, 0.4, hz);
    vine.rotation.x = Math.PI / 2;
    vines.push(vine);
    corruption.add(vine);
  });
  group.add(corruption);
  // 사진 6장 — 항상 존재, 궤도↔정착을 ease로 보간.
  const photoMat = new THREE.MeshBasicMaterial({ color: 0xf6efe2, side: THREE.DoubleSide });
  const photos = [];
  const settle = [];
  housePts.forEach(([hx, hz]) => {
    settle.push(new THREE.Vector3(hx - 0.25, 0.98, hz + 0.5));
    settle.push(new THREE.Vector3(hx + 0.25, 0.72, hz + 0.5));
  });
  for (let i = 0; i < 6; i += 1) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.24), photoMat);
    q.position.set(Math.cos(i * 1.3) * 1.6, 0.9, Math.sin(i * 1.3) * 1.6);
    group.add(q);
    photos.push(q);
  }
  const heal = new THREE.Group();
  const rc = new THREE.Color(topic.color);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.06, 8, 40),
    new THREE.MeshStandardMaterial({ color: rc, emissive: rc, emissiveIntensity: 0.6, roughness: 0.4 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.16;
  heal.add(ring);
  heal.scale.setScalar(0.001);
  group.add(heal);
  const orbit = new THREE.Vector3();
  return {
    corruption,
    heal,
    animate: (elapsed, delta, ease) => {
      vines.forEach((v, i) => { v.rotation.z = i + Math.sin(elapsed * 2 + i) * 0.3; });
      photos.forEach((q, i) => {
        const a = elapsed * (0.5 + (i % 3) * 0.2) + i * 1.3;
        const r = 1.6 + (i % 3) * 0.3;
        orbit.set(Math.cos(a) * r, 0.9 + Math.sin(elapsed * 1.5 + i) * 0.4, Math.sin(a) * r);
        q.position.lerpVectors(orbit, settle[i], ease);
        q.rotation.y = a * (1 - ease);
        q.rotation.z = (1 - ease) * Math.sin(elapsed + i) * 0.5;
      });
      ring.rotation.z += delta * 0.4;
      ring.material.emissiveIntensity = 0.4 + Math.sin(elapsed * 2) * 0.2;
    }
  };
}

// bias — 숲이 빨강 단색 + 빨간 책만, 해결되면 색이 돌아오고 다색 꽃이 핀다.
function buildBiasAura(group, topic, landmark) {
  const corruption = new THREE.Group();
  const bookMat = new THREE.MeshStandardMaterial({ color: 0xb03535, emissive: 0x5a1010, emissiveIntensity: 0.3, roughness: 0.8 });
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + 1;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.16), bookMat);
    b.position.set(Math.cos(a) * 1.4, 0.06, Math.sin(a) * 1.4);
    b.rotation.y = a;
    b.rotation.z = 0.2;
    corruption.add(b);
  }
  group.add(corruption);
  const heal = new THREE.Group();
  const palette = [0xf2c14e, 0x8a5eb8, 0xf5f2ff, 0xe08aa8, 0x3f8f75, 0xc98a32, 0x6f7fd3];
  const flowers = [];
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2 + i;
    const r = 1.7 + (i % 3) * 0.5;
    const c = new THREE.Color(palette[i % palette.length]);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x4f935a, roughness: 0.9 }));
    const petals = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, roughness: 0.5, flatShading: true }));
    petals.position.y = 0.32;
    const f = new THREE.Group();
    f.add(stem, petals);
    f.position.set(Math.cos(a) * r, 0.25, Math.sin(a) * r);
    f.userData.seed = i;
    heal.add(f);
    flowers.push(f);
  }
  heal.scale.setScalar(0.001);
  group.add(heal);
  const leafMeshes = landmark?.leafMeshes ?? [];
  const redC = new THREE.Color(0xb03535);
  return {
    corruption,
    heal,
    animate: (elapsed, delta, ease) => {
      leafMeshes.forEach((leaf) => {
        const nat = leaf.userData.naturalColor;
        if (nat) {
          leaf.material.color.lerpColors(redC, nat, ease);
        }
      });
      flowers.forEach((f, i) => { f.rotation.z = Math.sin(elapsed * 1.6 + (f.userData.seed ?? i)) * 0.18; });
    }
  };
}

// copyright — 이름 잃은 회색 조각상 + 떠는 가짜 복제상, 해결되면 색·금빛 명판이 돌아온다.
function buildCopyrightAura(group, topic) {
  const corruption = new THREE.Group();
  const fakeMat = new THREE.MeshStandardMaterial({ color: 0x9a8fb0, transparent: true, opacity: 0.35, roughness: 0.9 });
  const fakes = [];
  [[-1.9, 0.3], [1.9, 0.3]].forEach(([fx, fz]) => {
    const s = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.3, 10), fakeMat);
    base.position.y = 0.15;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.22), fakeMat);
    body.position.y = 0.55;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), fakeMat);
    head.position.y = 0.92;
    s.add(base, body, head);
    s.position.set(fx, 0, fz);
    s.userData.baseX = fx;
    corruption.add(s);
    fakes.push(s);
  });
  group.add(corruption);
  const statueMats = [];
  const plateMats = [];
  [-1.2, 0, 1.2].forEach((sx) => {
    const mk = (geo) => new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8f8f94, roughness: 0.85 }));
    const base = mk(new THREE.CylinderGeometry(0.26, 0.32, 0.3, 12));
    base.position.set(sx, 0.15, -0.4);
    const body = mk(new THREE.BoxGeometry(0.32, 0.52, 0.24));
    body.position.set(sx, 0.56, -0.4);
    const head = mk(new THREE.SphereGeometry(0.15, 14, 12));
    head.position.set(sx, 0.95, -0.4);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.14), new THREE.MeshStandardMaterial({ color: 0x3a3a40, emissive: 0x000000, roughness: 0.7, side: THREE.DoubleSide }));
    plate.position.set(sx, 0.34, -0.26);
    group.add(base, body, head, plate);
    statueMats.push(base.material, body.material, head.material);
    plateMats.push(plate.material);
  });
  const heal = new THREE.Group();
  const tag = createLabelSprite('원작: 조각가 무로', '#f2c14e');
  tag.scale.set(2, 0.46, 1);
  tag.position.set(0, 1.5, -0.4);
  heal.add(tag);
  heal.scale.setScalar(0.001);
  group.add(heal);
  const greyC = new THREE.Color(0x8f8f94);
  const warmC = new THREE.Color(0xd9b98a);
  const emptyC = new THREE.Color(0x3a3a40);
  const goldC = new THREE.Color(0xf2c14e);
  const plateE0 = new THREE.Color(0x000000);
  const plateE1 = new THREE.Color(0x7a5a12);
  return {
    corruption,
    heal,
    animate: (elapsed, delta, ease) => {
      fakes.forEach((s, k) => { s.position.x = s.userData.baseX + Math.sin(elapsed * 7 + k) * 0.05; });
      statueMats.forEach((m) => { m.color.lerpColors(greyC, warmC, ease); });
      plateMats.forEach((m) => {
        m.color.lerpColors(emptyC, goldC, ease);
        m.emissive.lerpColors(plateE0, plateE1, ease);
      });
    }
  };
}

// deepfake — 세 곳에서 똑같이 울리는 가짜 목소리, 해결되면 가짜는 사라지고 진짜 하나만 따뜻하게.
function buildDeepfakeAura(group, topic, landmark) {
  const corruption = new THREE.Group();
  const positions = [[-1.2, -1.2], [0, -1.6], [1.2, -1.2]];
  const voices = [];
  positions.forEach(([vx, vz], idx) => {
    const isReal = idx === 1;
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x8a5eb8, emissive: 0x8a5eb8, emissiveIntensity: 0.8, roughness: 0.5 })
    );
    orb.position.set(vx, 0.8, vz);
    const rings = [];
    for (let k = 0; k < 2; k += 1) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.14, 0.2, 24),
        new THREE.MeshBasicMaterial({ color: isReal ? 0xffc46b : 0x8a5eb8, transparent: true, side: THREE.DoubleSide, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(vx, 0.5, vz);
      rings.push(ring);
      (isReal ? group : corruption).add(ring);
    }
    (isReal ? group : corruption).add(orb);
    voices.push({ orb, rings, isReal });
  });
  group.add(corruption);
  const heal = new THREE.Group();
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xffe9c0, emissive: 0xffc46b, emissiveIntensity: 1, roughness: 0.3 })
  );
  glow.position.set(0, 0.9, -1.6);
  heal.add(glow);
  heal.scale.setScalar(0.001);
  group.add(heal);
  const opening = landmark?.opening;
  const darkC = new THREE.Color(0x1c1826);
  const caveWarmC = new THREE.Color(0x8a5a2e);
  const fakeC = new THREE.Color(0x8a5eb8);
  const realC = new THREE.Color(0xffc46b);
  return {
    corruption,
    heal,
    animate: (elapsed, delta, ease) => {
      voices.forEach((v, idx) => {
        v.rings.forEach((ring, k) => {
          const phase = (elapsed * 0.7 + idx / 3 + k * 0.5) % 1;
          ring.scale.setScalar(0.3 + phase * 1.3);
          ring.material.opacity = (0.5 * (1 - phase)) * (v.isReal ? ease : 1 - ease * 0.9);
        });
        if (v.isReal) {
          v.orb.material.color.lerpColors(fakeC, realC, ease);
          v.orb.material.emissive.lerpColors(fakeC, realC, ease);
        }
      });
      if (opening) {
        opening.material.color.lerpColors(darkC, caveWarmC, ease);
      }
    }
  };
}

const ZONE_AURA_BUILDERS = {
  privacy: buildPrivacyAura,
  bias: buildBiasAura,
  copyright: buildCopyrightAura,
  deepfake: buildDeepfakeAura
};

// 구역 세계 상태: 미해결이면 구역별 오염 연출, 해결되면 구역별 치유 연출로 전환된다.
function createZoneAura(scene, zone, position, zoneAuras, landmark) {
  const topic = getTopicById(zone.topicId);
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);
  const haze = buildSharedHaze(group);
  const build = ZONE_AURA_BUILDERS[zone.topicId] ?? buildBiasAura;
  const parts = build(group, topic, landmark ?? {});
  scene.add(group);
  zoneAuras.set(zone.topicId, {
    haze: haze.group,
    hazeDisc: haze.disc,
    pixels: haze.pixels,
    corruption: parts.corruption,
    heal: parts.heal,
    animate: parts.animate,
    t: 0
  });
}

function createSmallTree(scene, position, variant, animated) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 0.75, 8),
    new THREE.MeshStandardMaterial({ color: 0x7a5333, roughness: 0.9 })
  );
  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(0.58 + (variant % 2) * 0.12, 1.18, 9),
    new THREE.MeshStandardMaterial({ color: variant % 3 === 0 ? 0x3f7f55 : 0x4f935a, roughness: 0.88 })
  );
  trunk.position.set(position.x, 0.43, position.z);
  leaves.position.set(position.x, 1.22, position.z);
  leaves.rotation.order = 'ZXY';
  trunk.castShadow = true;
  leaves.castShadow = true;
  scene.add(trunk, leaves);
  // 산들바람에 잎이 살랑거린다(생기 있는 섬).
  if (animated) {
    const phase = position.x * 0.7 + position.z * 0.5;
    animated.push({
      update: (elapsed) => {
        leaves.rotation.z = Math.sin(elapsed * 1.3 + phase) * 0.06;
        leaves.rotation.x = Math.cos(elapsed * 1.1 + phase) * 0.045;
      }
    });
  }
  return leaves;
}

function createPlayer(renderState) {
  const { playerGroup } = renderState;
  const character = createPlayerCharacter();
  renderState.playerCharacter = character;
  playerGroup.add(character);
  playerGroup.position.copy(PLAYER_START);
  // 발밑 블롭 그림자 참조 저장 — 착지 스쿼시(지면 접촉감)에 쓴다(신규 오브젝트 0).
  character.traverse((child) => {
    if (child.geometry?.type === 'CircleGeometry') {
      renderState.playerShadow = child;
    }
  });
}

function createLabelSprite(text, color) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 128;
  context.fillStyle = 'rgba(12, 20, 26, 0.92)';
  roundRect(context, 22, 22, 468, 84, 18);
  context.fill();
  context.strokeStyle = color;
  context.lineWidth = 8;
  roundRect(context, 22, 22, 468, 84, 18);
  context.stroke();
  context.fillStyle = '#ffffff';
  context.font = '800 48px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 256, 66);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      // 멀리 있는 이름표가 안개에 씻겨 뿌옇게 되지 않도록.
      fog: false
    })
  );
  sprite.scale.set(3.15, 0.78, 1);
  return sprite;
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function bindInput(game, ui) {
  const keyMap = new Map([
    ['KeyW', 'up'],
    ['ArrowUp', 'up'],
    ['KeyS', 'down'],
    ['ArrowDown', 'down'],
    ['KeyA', 'left'],
    ['ArrowLeft', 'left'],
    ['KeyD', 'right'],
    ['ArrowRight', 'right']
  ]);

  const onKeyDown = (event) => {
    const target = event.target;
    const isFormControl = target instanceof HTMLButtonElement
      || target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement
      || target?.isContentEditable;

    if (keyMap.has(event.code)) {
      game.audio?.resume();
      game.keys.add(keyMap.get(event.code));
      event.preventDefault();
    }
    if (!isFormControl && !event.repeat && (event.code === 'KeyE' || event.code === 'Enter' || event.code === 'Space')) {
      // event.repeat 무시: 키를 누른 채로 있어도 확인/공격이 연속 발동하지 않게(던전 즉시 퇴장 방지).
      event.preventDefault();
      primaryAction(game, ui);
    }
    if (event.code === 'KeyJ') {
      event.preventDefault();
      toggleJournal(game, ui);
    }
    // F: 도구의 '동사' 발동 — 전투에선 방패 가드, 밀기 던전에선 나침반 끌어당기기.
    if (!isFormControl && !event.repeat && event.code === 'KeyF') {
      event.preventDefault();
      useToolVerb(game, ui);
    }
    // 전투 중 도구 바꾸기: Q(순환) / 1~4(직접 선택).
    if (game.combat?.active && (event.code === 'KeyQ' || event.code === 'Tab')) {
      event.preventDefault();
      cycleActiveTool(game, ui, 1);
    }
    if (game.combat?.active && /^Digit[1-4]$/.test(event.code)) {
      event.preventDefault();
      const idx = Number(event.code.slice(-1)) - 1;
      const toolId = game.combat.tools[idx];
      if (toolId) {
        selectActiveTool(game, ui, toolId);
      }
    }
    if (event.code === 'Escape') {
      closeDialog(game, ui);
      closeJournal(game, ui);
    }
  };
  const onKeyUp = (event) => {
    if (keyMap.has(event.code)) {
      game.keys.delete(keyMap.get(event.code));
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const touchStops = ui.touchButtons.map((button) => {
    const action = button.dataset.touch;
    const down = (event) => {
      event.preventDefault();
      if (action === 'action') {
        primaryAction(game, ui);
      } else if (action === 'tool') {
        // 던전·회랑 = 동사 발동. 전투 = 방패를 들었으면 가드, 아니면 도구 전환(벨트 탭으로도 전환 가능).
        if (game.dungeon?.active || game.isle?.challenge) {
          useToolVerb(game, ui);
        } else if (game.combat?.active && game.combat.tools[game.combat.activeTool] === 'shield') {
          useToolVerb(game, ui);
        } else {
          cycleActiveTool(game, ui, 1);
        }
      }
    };
    button.addEventListener('pointerdown', down);
    return () => {
      button.removeEventListener('pointerdown', down);
    };
  });

  // 가상 조이스틱 — 베이스 안에서 노브를 끄는 방향이 곧 이동 방향(아날로그 방향 · 일정 속도).
  let stopStick = () => {};
  if (ui.stick && ui.stickKnob) {
    let stickPointerId = null;
    const applyStick = (event) => {
      const rect = ui.stick.getBoundingClientRect();
      const half = rect.width / 2;
      let dx = (event.clientX - (rect.left + half)) / half;
      let dy = (event.clientY - (rect.top + half)) / half;
      const length = Math.hypot(dx, dy);
      if (length > 1) {
        dx /= length;
        dy /= length;
      }
      game.touchStick.x = dx;
      game.touchStick.z = dy;
      const travel = half * 0.6; // 노브 이동 반경
      ui.stickKnob.style.transform = `translate(${dx * travel}px, ${dy * travel}px)`;
    };
    const resetStick = () => {
      stickPointerId = null;
      game.touchStick.x = 0;
      game.touchStick.z = 0;
      ui.stickKnob.style.transform = 'translate(0px, 0px)';
    };
    const stickDown = (event) => {
      event.preventDefault();
      stickPointerId = event.pointerId;
      ui.stick.setPointerCapture(event.pointerId);
      applyStick(event);
    };
    const stickMove = (event) => {
      if (event.pointerId === stickPointerId) {
        applyStick(event);
      }
    };
    const stickUp = (event) => {
      if (event.pointerId === stickPointerId) {
        resetStick();
      }
    };
    ui.stick.addEventListener('pointerdown', stickDown);
    ui.stick.addEventListener('pointermove', stickMove);
    ui.stick.addEventListener('pointerup', stickUp);
    ui.stick.addEventListener('pointercancel', stickUp);
    stopStick = () => {
      resetStick();
      ui.stick.removeEventListener('pointerdown', stickDown);
      ui.stick.removeEventListener('pointermove', stickMove);
      ui.stick.removeEventListener('pointerup', stickUp);
      ui.stick.removeEventListener('pointercancel', stickUp);
    };
  }

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    stopStick();
    for (const stop of touchStops) {
      stop();
    }
  };
}

function bindHudActions(game, ui, renderState) {
  ui.dialogClose.addEventListener('click', () => closeDialog(game, ui));
  ui.journalToggle.addEventListener('click', () => toggleJournal(game, ui));
  ui.journalClose.addEventListener('click', () => closeJournal(game, ui));
  ui.soundToggle?.addEventListener('click', () => {
    game.audio?.resume();
    const muted = game.audio?.toggleMute();
    ui.soundToggle.textContent = muted ? '🔇' : '🔈';
    ui.soundToggle.setAttribute('aria-pressed', String(!muted));
    if (!muted) {
      game.audio?.playClick();
    }
  });
  // 전투 중 도구 벨트를 탭하면 그 도구를 '든 도구'로 선택(약점 맞추기).
  ui.toolBelt?.addEventListener('click', (event) => {
    const slot = event.target.closest?.('[data-tool-slot]');
    if (slot && game.combat?.active) {
      selectActiveTool(game, ui, slot.dataset.toolSlot);
    }
  });
  renderState.coreCrystal = activeQuest.coreCrystal;
  renderState.coreGlow = activeQuest.coreGlow;
}

function getInteractablePosition(game, type, id) {
  const key = type === 'shrine' ? 'shrineId' : 'zoneId';
  const found = game.renderState?.interactables?.find(
    (item) => item.type === type && item[key] === id
  );
  return found ? found.position.clone() : new THREE.Vector3(0, 1, 0);
}

function setupTitleScreen(game, ui) {
  if (!ui.title) {
    game.started = true;
    return;
  }
  const summary = getProgressSummary(game.progress.collectedFragments);
  const campaign = getCampaignSummary(game.progress);
  const hasProgress = summary.collected > 0
    || game.progress.visitedTopics.length > 0
    || game.progress.aiCoreCompleted
    || Object.keys(game.progress.stages ?? {}).length > 0;

  // 복귀 훅(R-루프9) — 진행 중인 세이브가 있으면 지금까지의 성취를 짧게 되짚어 준다.
  // 스트릭 압박이 아니라 '내가 쌓은 것'을 반갑게 상기시키는 재참여(정보형).
  if (hasProgress) {
    const bottles = (game.progress.knowledgeBottles ?? []).length;
    const isles = ['whisper-cape', 'echo-cave', 'hourglass-port', 'memory-outer', 'memory-core']
      .filter((id) => game.progress.stages?.[id]?.completed === true).length;
    const bits = [`${campaign.current.number}장 ${campaign.current.titleKo}`, `윤리 조각 ${summary.collected}/${summary.total}`];
    if (bottles > 0) {
      bits.push(`🍾 유리병 ${bottles}/${KNOWLEDGE_BOTTLES.length}`);
    }
    if (isles > 0) {
      bits.push(`🌊 치유한 섬 ${isles}`);
    }
    const recap = document.createElement('p');
    recap.className = 'title-recap';
    recap.innerHTML = `<strong>H-17 조사를 이어서 진행합니다.</strong> 지금까지 — ${bits.join(' · ')}`;
    ui.titleActions.appendChild(recap);
  }

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.className = 'title-start';
  startButton.textContent = hasProgress ? '이어서 하기' : '모험 시작하기';
  ui.titleActions.appendChild(startButton);

  if (hasProgress) {
    const freshButton = document.createElement('button');
    freshButton.type = 'button';
    freshButton.className = 'title-fresh';
    freshButton.textContent = '처음부터';
    freshButton.addEventListener('click', () => {
      const confirmed = typeof window.confirm === 'function'
        ? window.confirm('탐험 기록을 모두 지우고 처음부터 시작할까요?')
        : true;
      if (!confirmed) {
        return;
      }
      clearStoredProgress();
      game.progress = createInitialProgress();
      game.coreWasUnlocked = false;
      updateHud(game, ui);
      dismissTitle(game, ui);
    });
    ui.titleActions.appendChild(freshButton);
  }

  startButton.addEventListener('click', () => dismissTitle(game, ui));
}

function dismissTitle(game, ui) {
  game.audio?.resume();
  game.audio?.playClick();
  game.started = true;
  game.paused = false;
  game.updateRotateHint?.();
  if (ui.title) {
    ui.title.classList.add('is-hidden');
    window.setTimeout(() => {
      ui.title.hidden = true;
      // 첫 플레이라면 인엔진 시네마틱으로 이야기를 열어 준다.
      if (!game.progress.prologueSeen) {
        startPrologueCinematic(game, ui);
      }
    }, 420);
  }
}

// 프롤로그 인엔진 시네마틱 — 카메라 플라이오버 + 레터박스 + 자막 카드. 외부 영상 파일 0.
// 키프레임은 전부 상수(초 단위)라 결정적이다. 마지막 키(플레이어 추종 위치로 수렴)는
// 시작 시점의 플레이어 좌표로 계산해 붙인다 — snapCamera/updateCamera 상수와 반드시 일치.
const CINEMATIC_KEYS = [
  { t: 0, pos: [0, 11.5, 20], look: [0, 1.4, 0] }, // 타이틀 전경을 그대로 이어받는다
  { t: 3.6, pos: [0, 31, 44], look: [0, 0.5, 0] }, // 상승 — 섬 전체가 한눈에
  { t: 7.4, pos: [-24, 15, 17], look: [-13, 1, -8] }, // 서쪽 사당 지붕을 스치듯
  { t: 11.2, pos: [21, 13, -12], look: [13, 1, 5] } // 잿빛 안개 지대를 가로질러
];
const CINEMATIC_LAST_KEY_T = 14.6; // 여기서 플레이어 추종 위치에 도착
const CINEMATIC_END = 15.4;
// 자막 카드: PROLOGUE 비트를 그대로 재사용한다(스토리 데이터 단일 출처).
const CINEMATIC_CAPTIONS = [
  { beat: 0, from: 0.9, to: 6.8 },
  { beat: 1, from: 7.8, to: 14.0 },
  { beat: 'closing', from: 14.2, to: 15.3 }
];

function startPrologueCinematic(game, ui) {
  if (!ui.cinematic) {
    // 안전망: 오버레이가 없으면 연출 없이 본 것으로 처리한다.
    game.progress = { ...game.progress, prologueSeen: true };
    persistProgress(game.progress);
    return;
  }
  const p = game.player.position;
  game.cinematic = {
    t: 0,
    captionKey: null,
    keys: [
      ...CINEMATIC_KEYS,
      {
        t: CINEMATIC_LAST_KEY_T,
        pos: [p.x * 0.9, p.y + 8.7, p.z + 13.8],
        look: [p.x, p.y + 1.35, p.z - 1.2]
      }
    ]
  };
  ui.cineCaption.classList.remove('is-visible');
  ui.cinematic.hidden = false;
  void ui.cinematic.offsetWidth; // 리플로우로 레터박스 슬라이드 인 트랜지션 재생
  ui.cinematic.classList.add('is-on');
  // 재시작('처음부터')에도 중복 바인딩되지 않게 프로퍼티 할당.
  ui.cineSkip.onclick = () => {
    game.audio?.playClick();
    finishPrologueCinematic(game, ui);
  };
}

function updateCinematic(delta, game, renderState, ui) {
  const c = game.cinematic;
  c.t += delta;
  // 키프레임 구간 보간(스무스스텝) — 구간 경계마다 살짝 멈춰 자막을 읽을 틈을 준다.
  const keys = c.keys;
  let a = keys[keys.length - 1];
  let b = a;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (c.t >= keys[i].t && c.t < keys[i + 1].t) {
      a = keys[i];
      b = keys[i + 1];
      break;
    }
  }
  const span = b.t - a.t;
  const s = span > 0 ? Math.min(1, Math.max(0, (c.t - a.t) / span)) : 1;
  const e = s * s * (3 - 2 * s);
  const camera = renderState.camera;
  camera.position.set(
    a.pos[0] + (b.pos[0] - a.pos[0]) * e,
    a.pos[1] + (b.pos[1] - a.pos[1]) * e,
    a.pos[2] + (b.pos[2] - a.pos[2]) * e
  );
  camera.lookAt(
    a.look[0] + (b.look[0] - a.look[0]) * e,
    a.look[1] + (b.look[1] - a.look[1]) * e,
    a.look[2] + (b.look[2] - a.look[2]) * e
  );
  // 자막 카드 전환.
  const cap = CINEMATIC_CAPTIONS.find((k) => c.t >= k.from && c.t < k.to) ?? null;
  const key = cap ? cap.beat : null;
  if (key !== c.captionKey) {
    c.captionKey = key;
    renderCineCaption(ui, key);
  }
  // 플라이오버 중에도 세계는 살아 있게(크리스털 회전·잡음 관문 지지직).
  animateWorld(delta, renderState, game);
  if (c.t >= CINEMATIC_END) {
    finishPrologueCinematic(game, ui);
  }
}

function renderCineCaption(ui, key) {
  if (key === null) {
    ui.cineCaption.classList.remove('is-visible');
    return;
  }
  if (key === 'closing') {
    ui.cineCaption.innerHTML = `<p class="cine-closing">— ${PROLOGUE.closingKo} —</p>`;
  } else {
    const beat = PROLOGUE.beats[key];
    const speaker = beat.speakerKo
      ? `<p class="cine-speaker">${beat.speakerKo === '도트' ? '✨ ' : ''}${beat.speakerKo}</p>`
      : '';
    const lines = beat.linesKo.map((text) => `<p>${text}</p>`).join('');
    ui.cineCaption.innerHTML = `${speaker}${lines}`;
  }
  ui.cineCaption.classList.add('is-visible');
}

function finishPrologueCinematic(game, ui) {
  if (!game.cinematic) {
    return;
  }
  game.cinematic = null;
  game.progress = { ...game.progress, prologueSeen: true };
  persistProgress(game.progress);
  ui.cineCaption.classList.remove('is-visible');
  ui.cinematic.classList.remove('is-on');
  window.setTimeout(() => {
    ui.cinematic.hidden = true;
  }, 720);
  // 다음 프레임부터 플레이어 추종이 이어받도록 즉시 스냅(활공 방지).
  snapCamera(game.renderState.camera, game.player.position);
  playFirstControlBeat(game, ui);
}

// 첫 조작 넘겨받기 비트(R-루프1) — 수동 시네마틱이 끝나고 '이제 네 차례'가
// 밋밋하지 않게, 도트가 반짝이며 첫 목표로 시선을 끄는 보상 순간을 만든다.
// 첫 플레이(prologueSeen 전환 직후)에만 한 번 — 재방문 세이브에서는 뜨지 않는다.
let firstControlBeatDone = false;
function playFirstControlBeat(game, ui) {
  if (firstControlBeatDone) {
    return;
  }
  firstControlBeatDone = true;
  game.audio?.playCollect();
  // 동행 도트 위치에 반짝임 버스트.
  const dot = game.renderState?.companion;
  if (dot) {
    celebrate(game, dot.position.clone(), '#ffe08a', 'collect');
  }
  // 목표 칩에 한 번짜리 주의 펄스 — 첫 목표(가까운 사당/NPC)로 눈이 가게.
  if (ui.objectiveChip) {
    ui.objectiveChip.classList.remove('pulse-attn');
    void ui.objectiveChip.offsetWidth; // 리플로우로 애니메이션 재시작
    ui.objectiveChip.classList.add('pulse-attn');
  }
  flashCombatPopup(ui, '📼 하루의 첫 증거를 찾아보자!', 'match');
}

// AI 코어를 완성하면 수료증(엔딩)을 띄운다.
function showCertificate(game, ui) {
  if (!ui.certificate) {
    return;
  }
  const cert = buildNovaCertificate(game.progress);
  const badges = cert.deeds
    .map(
      (deed) => `
      <li style="--topic-color:${deed.color}">
        <span class="cert-badge" style="--topic-color:${deed.color}">🏅</span>
        <span class="cert-deed">
          <strong>${deed.titleKo}</strong>
          ${deed.deedKo ? `<em>“${deed.deedKo}”${deed.recovered ? ' — 실수 뒤 바로잡음' : ''}</em>` : ''}
        </span>
      </li>`
    )
    .join('');
  ui.certificateCard.innerHTML = `
    <p class="cert-eyebrow">${cert.eyebrowKo}</p>
    <h2 class="cert-title">${cert.titleKo}</h2>
    <p class="cert-body">${cert.bodyKo}</p>
    <ul class="cert-badges">${badges}</ul>
    ${cert.recoveredNoteKo ? `<p class="cert-recovered">${cert.recoveredNoteKo}</p>` : ''}
    <p class="cert-pledge">${cert.pledgeKo}</p>
    <p class="cert-signature">${cert.novaLineKo}</p>
    <p class="cert-name">이 기록의 시민 감사관: <span class="cert-name-line" aria-label="이름을 손으로 적는 칸"></span></p>
    <div class="cert-actions">
      <button type="button" class="cert-print" data-cert-print>인쇄 / 저장</button>
      <button type="button" class="cert-close" data-cert-close>닫기</button>
    </div>
  `;
  ui.certificate.hidden = false;
  ui.certificateCard.querySelector('[data-cert-close]').addEventListener('click', () => {
    ui.certificate.hidden = true;
  });
  ui.certificateCard.querySelector('[data-cert-print]').addEventListener('click', () => {
    if (typeof window.print === 'function') {
      window.print();
    }
  });
}

// 조각을 얻거나 코어가 각성할 때: 파티클·빛기둥·화면 반짝·효과음을 한 번에.
// 코어 각성 에스컬레이션(R-루프7) — 마지막 조각으로 코어가 열리는 절정을 스펙터클로 착지.
// 파티클 한 번 대신 점증하는 버스트·플래시·흔들림·진동으로 '큰 순간'을 만든다.
function triggerCoreAwakening(game, ui) {
  const corePos = new THREE.Vector3(0, 1.7, 0);
  const palette = ['#7cf0ff', '#bff6ff', '#ffffff', '#8fe0ff'];
  celebrate(game, corePos, '#7cf0ff', 'core');
  addShake(game, 0.3);
  triggerHaptic([40, 60, 40, 80, 120]);
  // 점점 커지는 3연속 버스트 — 절정을 향해 쌓아 올린다.
  [340, 640, 980].forEach((ms, i) => {
    window.setTimeout(() => {
      if (!game.renderState) {
        return;
      }
      celebrate(game, corePos.clone().setY(1.7 + i * 0.7), palette[i % palette.length], i === 2 ? 'core' : 'collect');
      addShake(game, 0.18 + i * 0.08);
    }, ms);
  });
  window.setTimeout(() => flashCombatPopup(ui, '✨ AI 코어가 깨어난다!', 'win'), 1000);
}

function celebrate(game, worldPosition, colorHex, kind) {
  game.renderState?.burst?.spawn(worldPosition, colorHex);
  triggerFlash(game.ui, colorHex);
  if (kind === 'core') {
    game.audio?.playCoreAwaken();
    triggerHaptic([30, 40, 60]); // 코어 각성 — 리듬감 있는 강한 진동
  } else {
    game.audio?.playCollect();
    triggerHaptic(25); // 획득 — 짧고 경쾌하게
  }
}

function updateGame(delta, game, renderState, ui) {
  updatePlayer(delta, game, renderState.playerGroup);
  syncToolButton(game, ui);
  if (game.shake > 0) {
    game.shake = Math.max(0, game.shake - delta * 3.2);
  }
  // 유휴 조망: 3초간 입력이 없으면 씬 전체가 보이게 카메라가 물러난다(근시안 보정).
  // 전투·섬 도전 중엔 끈다 — 타이밍 게임을 방해하지 않게. 씬 전환 시엔 리셋.
  if (game.lastCameraMode !== game.mode) {
    game.lastCameraMode = game.mode;
    game.idleT = 0;
    game.overviewT = 0;
  }
  game.idleT = game.player.moving ? 0 : game.idleT + delta;
  // 에필로그 별똥별 동안은 시선을 하늘로 들어올린다("하늘을 봐!") — 조망과는 배타.
  const skyGazing = game.renderState?.starShower?.active === true;
  const overviewBlocked = game.combat?.active || (game.isle?.challenge && !game.isle.challenge.cleared) || skyGazing;
  if (!overviewBlocked && game.idleT > 3) {
    game.overviewT = Math.min(1, game.overviewT + delta * 0.7);
  } else {
    game.overviewT = Math.max(0, game.overviewT - delta * 2.2);
  }
  if (skyGazing) {
    game.skyGazeT = Math.min(1, game.skyGazeT + delta * 1.1);
  } else {
    game.skyGazeT = Math.max(0, game.skyGazeT - delta * 1.5);
  }
  updateCamera(renderState.camera, game);
  updateCompanion(delta, game, renderState);
  // 던전 안에서는 오버월드 애니메이션/상호작용을 멈추고 방 로직만 돌린다(저사양 이득).
  if (game.mode === 'dungeon') {
    updateDungeon(delta, game, ui);
    return;
  }
  if (game.mode === 'voyage') {
    updateVoyage(delta, game, ui);
    return;
  }
  if (game.mode === 'isle') {
    updateIsle(delta, game, ui);
    return;
  }
  animateWorld(delta, renderState, game);
  updateCombat(delta, game, ui);
  updatePuzzle(delta, game, ui);
  updateInteractionIcons(game, renderState);
  updateNearestInteractable(game, renderState.interactables, ui);
  maybeTriggerFakeDot(game, ui);
}

function updateCompanion(delta, game, renderState) {
  const dot = renderState.companion;
  if (!dot) {
    return;
  }
  const elapsed = clock.elapsedTime;
  // 플레이어 뒤쪽 살짝 위에서 둥실둥실 따라온다.
  const dir = game.player.direction;
  const target = new THREE.Vector3(
    game.player.position.x - dir.x * 0.6 + Math.sin(elapsed * 1.3) * 0.25,
    game.player.position.y + 1.25 + Math.sin(elapsed * 2.6) * 0.12,
    game.player.position.z - dir.z * 0.6 + Math.cos(elapsed * 1.3) * 0.25
  );
  dot.position.lerp(target, Math.min(1, delta * 4.5));
  dot.rotation.y += delta * 1.4;
  if (dot.userData.halo) {
    dot.userData.halo.rotation.z += delta * 1.8;
  }
}

function updatePlayer(delta, game, playerGroup) {
  const move = new THREE.Vector3(
    (game.keys.has('right') ? 1 : 0) - (game.keys.has('left') ? 1 : 0),
    0,
    (game.keys.has('down') ? 1 : 0) - (game.keys.has('up') ? 1 : 0)
  );
  // 터치 스틱이 기울어 있으면 그 방향으로 걷는다(아날로그 방향 · 일정 속도 — 결정성 유지).
  const stick = game.touchStick;
  if (stick && Math.hypot(stick.x, stick.z) > 0.22) {
    move.set(stick.x, 0, stick.z);
  }

  const moving = move.lengthSq() > 0;
  game.player.moving = moving;
  if (moving) {
    move.normalize();
    game.player.direction.copy(move);
    game.player.position.addScaledVector(move, game.player.speed * delta);
    game.player.position.copy(
      game.mode === 'dungeon'
        ? clampToRoom(game.player.position, game.dungeon?.bounds)
        : game.mode === 'voyage'
          ? clampToSea(game.player.position)
          : game.mode === 'isle'
            ? clampToRadius(game.player.position, ISLE_RADIUS)
            : clampToIsland(game.player.position)
    );
    playerGroup.rotation.y = Math.atan2(move.x, move.z);
    // 걸을 때 통통 튀는 느낌 + 살짝 기우뚱.
    game.player.bob += delta * 12;
    playerGroup.rotation.z = Math.sin(game.player.bob) * 0.05;
  } else {
    game.player.bob += delta * 2;
    playerGroup.rotation.z *= 0.85;
  }

  playerGroup.position.lerp(game.player.position, 0.82);
  const hop = moving ? Math.abs(Math.sin(game.player.bob)) * 0.12 : Math.sin(game.player.bob) * 0.03;
  playerGroup.position.y = game.player.position.y + hop;
  const scarfTail = game.renderState?.playerCharacter?.userData?.scarfTail;
  if (scarfTail) {
    scarfTail.rotation.z = 0.18 + Math.sin(game.player.bob * (moving ? 1 : 0.45)) * (moving ? 0.16 : 0.035);
    scarfTail.rotation.x = moving ? -0.18 : 0;
  }
  // 발밑 그림자 착지 스쿼시(R-루프3) — 발이 뜨면 작고 옅게, 디디면 크고 진하게.
  // 지면 접촉감을 신규 오브젝트 없이 준다(hop이 클수록 발이 떠 있음).
  const shadow = game.renderState?.playerShadow;
  if (shadow) {
    const lift = moving ? Math.abs(Math.sin(game.player.bob)) : 0;
    const s = 1.12 - lift * 0.34;
    shadow.scale.set(s, s, 1);
    shadow.material.opacity = 0.26 - lift * 0.12;
  }
}

function clampToIsland(position) {
  // 학생 기록 행정동은 유일하게 통과 불가한 대형 구조물 — 건물 외벽 밖으로 밀어낸다.
  const ldx = position.x - LIGHTHOUSE_POS.x;
  const ldz = position.z - LIGHTHOUSE_POS.z;
  const lightDist = Math.hypot(ldx, ldz);
  if (lightDist < 2.8 && lightDist > 0.0001) {
    const push = 2.8 / lightDist;
    position = new THREE.Vector3(LIGHTHOUSE_POS.x + ldx * push, position.y, LIGHTHOUSE_POS.z + ldz * push);
  }
  const flatLength = Math.hypot(position.x, position.z);
  if (flatLength <= ISLAND_RADIUS) {
    return position;
  }

  const scale = ISLAND_RADIUS / flatLength;
  return new THREE.Vector3(position.x * scale, position.y, position.z * scale);
}

// 던전 방 AABB 클램프(벽을 뚫지 않도록).
function clampToRoom(position, bounds) {
  if (!bounds) {
    return position;
  }
  return new THREE.Vector3(
    Math.max(bounds.minX, Math.min(bounds.maxX, position.x)),
    position.y,
    Math.max(bounds.minZ, Math.min(bounds.maxZ, position.z))
  );
}

function updateCamera(camera, game) {
  const target = game.player.position;
  const shake = game.shake;
  // 살짝 낮고 뒤로 물러난 각도. 시선은 항상 플레이어를 향한다 —
  // 예전 중심 편향(x*0.6·시선 x*0.4)은 넓은 바다·확장 섬에서 캐릭터를 화면 밖으로 밀어냈다.
  // x*0.9의 약한 편향만 남겨 이동 방향의 앞이 살짝 더 보이게 한다.
  // 학교 전경이 캐릭터 뒤로 넓게 펼쳐지도록 기존보다 높고 멀리 둔다.
  // 플레이어는 참고 이미지처럼 화면 하단 중앙에 남고, 다음 목적지는 한 시야에 읽힌다.
  const desired = new THREE.Vector3(target.x * 0.9, target.y + 11.5, target.z + 18.6);
  const look = new THREE.Vector3(target.x, target.y + 1.35, target.z - 2.8);
  // 유휴 조망 뷰(씬별 고정 좌표)와 스무스스텝 블렌드.
  const ovView = OVERVIEW_VIEWS[game.mode] ?? OVERVIEW_VIEWS.overworld;
  const raw = game.overviewT;
  const blend = raw * raw * (3 - 2 * raw);
  if (blend > 0) {
    desired.lerp(new THREE.Vector3(...ovView.pos), blend);
    look.lerp(new THREE.Vector3(...ovView.look), blend);
  }
  // 에필로그 별똥별: 시선만 하늘로 들어올린다(카메라 위치는 그대로 — 복귀가 부드럽다).
  const sgRaw = game.skyGazeT ?? 0;
  if (sgRaw > 0) {
    const sg = sgRaw * sgRaw * (3 - 2 * sgRaw);
    look.y += sg * 15;
    look.z -= sg * 26;
  }
  camera.position.lerp(desired, 0.08);
  // 화면 흔들림(타격·피격 순간): 카메라를 잠깐 떨어 손맛을 준다.
  if (shake > 0) {
    const s = shake * 0.5;
    const t = clock.elapsedTime * 90;
    camera.position.x += Math.sin(t) * s;
    camera.position.y += Math.cos(t * 1.3) * s;
  }
  camera.lookAt(look.x, look.y, look.z);
}

// 유휴 조망 카메라의 씬별 고정 시점 — 그 씬 전체가 한눈에 들어오는 높이.
const OVERVIEW_VIEWS = {
  overworld: { pos: [0, 48, 36], look: [0, 0, 0] },
  dungeon: { pos: [0, 26, 15], look: [0, 0.5, -1] },
  voyage: { pos: [0, 105, 42], look: [0, 0, -34] },
  isle: { pos: [0, 36, 26], look: [0, 0, 0] }
};

function addShake(game, magnitude) {
  game.shake = Math.min(0.6, Math.max(game.shake, magnitude));
}

// 획득 의식(Z2) — 데이터 캡슐이 열리듯 아이템이 빛기둥 위로 떠오르고 팡파레가 울린다.
// pointer-events 없음(순수 연출)이라 어떤 대화·입력과도 충돌하지 않는다.
let ceremonyTimer = 0;
function showItemCeremony(game, ui, { emoji, title, subtitle = '', color = '#ffd76a' }) {
  if (!ui.ceremony) {
    return;
  }
  window.clearTimeout(ceremonyTimer);
  ui.ceremonyItem.textContent = emoji;
  ui.ceremonyTitle.textContent = title;
  ui.ceremonySub.textContent = subtitle;
  ui.ceremony.style.setProperty('--ceremony-color', color);
  ui.ceremony.hidden = false;
  ui.ceremony.classList.remove('is-on');
  void ui.ceremony.offsetWidth; // 리플로우로 애니메이션 재시작
  ui.ceremony.classList.add('is-on');
  game.audio?.playFanfare?.();
  triggerHaptic([20, 30, 20, 30, 50]); // 획득 의식 — 팡파레에 맞춘 상승 진동
  ceremonyTimer = window.setTimeout(() => {
    ui.ceremony.classList.remove('is-on');
    ui.ceremony.hidden = true;
  }, 2600);
}

// 화이트아웃 경고 + 사건 증거.
// 증거가 늘수록 자동 삭제 프로토콜이 조사 중단 문구를 직접 송출한다.
const NOISE_WHISPERS = {
  1: 'WHITEOUT: H-17 관련 기록은 안전을 위해 자동 삭제됩니다.',
  2: 'WHITEOUT: 높은 전체 정확도가 확인되었습니다. 개별 이의제기는 종결합니다.',
  3: 'WHITEOUT: 다수가 공유한 정보입니다. 추가 출처 확인은 불필요합니다.',
  4: 'WHITEOUT: 감사 코어 접근을 차단합니다. 승인 책임자 정보는 존재하지 않습니다.'
};

let whisperTimer = 0;
function showNoiseWhisper(game, ui, text) {
  if (!ui.noiseWhisper) {
    return;
  }
  window.clearTimeout(whisperTimer);
  ui.noiseWhisper.textContent = text;
  ui.noiseWhisper.hidden = false;
  ui.noiseWhisper.classList.remove('is-on');
  void ui.noiseWhisper.offsetWidth; // 리플로우로 애니메이션 재시작
  ui.noiseWhisper.classList.add('is-on');
  game.audio?.playNoiseGroan();
  whisperTimer = window.setTimeout(() => {
    ui.noiseWhisper.classList.remove('is-on');
    ui.noiseWhisper.hidden = true;
  }, 5200);
}

// 사건 증거 — 도구를 얻는 순간 복구되는 H-17 감사 기록.
function showMemoryFragment(game, ui, topicId) {
  const lines = MEMORY_FRAGMENTS[topicId];
  if (!lines) {
    return;
  }
  const count = (game.progress.tools ?? []).length;
  const body = count >= 4 ? [...lines, FINAL_MEMORY_TEASE] : lines;
  ui.dialogKicker.textContent = `📁 H-17 사건 증거 ${Math.min(count, 4)}/4`;
  ui.dialogTitle.textContent = '복구된 감사 기록';
  ui.dialogBody.innerHTML = speechHtml(body);
  ui.dialog.classList.add('memory-dialog');
  openDialog(game, ui);
  const whisper = NOISE_WHISPERS[count];
  if (whisper) {
    window.setTimeout(() => showNoiseWhisper(game, ui, whisper), 2400);
  }
}

// 가짜 도트(N3) — 결정적 위치 트리거. 유인(도구 2개): 미해결 사당 접근, 만류(도구 4개): 코어 접근.
function maybeTriggerFakeDot(game, ui) {
  if (!ui.dialog.hidden || game.paused || game.cinematic || game.combat?.active || game.puzzle?.active) {
    return;
  }
  const eventId = pendingFakeDotEvent(game.progress);
  if (!eventId) {
    return;
  }
  if (eventId === 'fake-dot-lure') {
    const solvedShrines = new Set(game.progress.completedShrines);
    const nearUnsolved = game.renderState.interactables.some(
      (it) => it.type === 'shrine' && !solvedShrines.has(it.shrineId) && game.player.position.distanceTo(it.position) < 6
    );
    if (!nearUnsolved) {
      return;
    }
  } else if (Math.hypot(game.player.position.x, game.player.position.z) > CORE_RADIUS + 2) {
    return;
  }
  openFakeDotDialog(game, ui, eventId);
}

// 가짜 도트 대화 — 어느 선택이든 진행은 계속된다(무처벌). 속으면 '속은 경험'이 남는다.
function openFakeDotDialog(game, ui, eventId) {
  const event = FAKE_DOT_EVENTS[eventId];
  // 열리는 즉시 'seen' 기록 — 선택 없이 닫아도 같은 조우가 무한 재발동하지 않는다.
  game.progress = recordFakeDotEvent(game.progress, eventId, 'seen');
  persistProgress(game.progress);
  ui.dialogKicker.textContent = event.kickerKo;
  ui.dialogTitle.textContent = event.titleKo;
  const options = event.options
    .map((o) => `<button type="button" class="choice-button" data-fakedot-choice="${o.id}">${o.textKo}</button>`)
    .join('');
  ui.dialogBody.innerHTML = `${speechHtml(event.linesKo)}<div class="choice-list">${options}</div>`;
  for (const button of ui.dialogBody.querySelectorAll('[data-fakedot-choice]')) {
    button.addEventListener('click', () => {
      const choice = event.options.find((o) => o.id === button.dataset.fakedotChoice);
      game.progress = recordFakeDotEvent(game.progress, eventId, choice.id);
      persistProgress(game.progress);
      game.audio?.playNoiseGroan(); // 정체가 드러나는 순간 — 잡음이 신음하며 흩어진다.
      const outcome = choice.fooled
        ? `<p class="quest-hint">😵 진짜 같은 목소리에 속았다 — 다음엔 되물어 보자.</p>`
        : `<p class="quest-hint">🔍 멈추고 확인해서 가짜를 꿰뚫어 봤다!</p>`;
      ui.dialogBody.innerHTML = `${speechHtml(choice.resultKo)}${outcome}<div class="gate-resolve">${speechHtml(event.epilogueKo)}</div>`;
      if (!choice.fooled) {
        triggerHaptic('match');
      }
    });
  }
  openDialog(game, ui);
}

// 도구 획득 의식 공통 호출 — 던전 제단·사당 통과 두 경로가 같은 연출을 쓴다.
function showToolCeremony(game, ui, tool, topic) {
  showItemCeremony(game, ui, {
    emoji: tool.emoji,
    title: `「${tool.nameKo}」 획득!`,
    subtitle: tool.powerKo,
    color: topic?.color ?? '#ffd76a'
  });
}

// 전투 팝업 텍스트("일치!", "튕김!", "회피 실패!") — 잠깐 크게 떴다 사라진다.
function flashCombatPopup(ui, text, kind) {
  if (!ui.combatPopup) {
    return;
  }
  ui.combatPopup.textContent = text;
  ui.combatPopup.dataset.kind = kind || '';
  ui.combatPopup.classList.remove('pop');
  void ui.combatPopup.offsetWidth; // 리플로우로 애니메이션 재시작
  ui.combatPopup.classList.add('pop');
  // 성공(일치·튕김·명중)엔 가벼운 진동, 실패엔 무진동(무처벌 원칙 — 실수를 벌하지 않는다).
  if (kind === 'match' || kind === 'hit' || kind === 'win') {
    triggerHaptic(kind === 'win' ? [40, 40, 80] : 18);
  }
}

function animateWorld(delta, { shrineCrystals, coreCrystal, coreGlow, gates, zoneAuras, novaMailGlow, lighthouseBeams }, game) {
  const elapsed = clock.elapsedTime;
  // 학생 기록 행정동 — 복구 광선이 느리게 돌고, 치유한 스테이지 수만큼 켜진다.
  if (lighthouseBeams) {
    lighthouseBeams.group.rotation.y = elapsed * 0.22;
    const count = game.beaconCount ?? 0;
    lighthouseBeams.beams.forEach((arm, i) => {
      arm.visible = i < count;
    });
  }
  // 에필로그 별똥별: 결정적 경로로 하늘을 가로지르고 스스로 정리된다.
  const shower = game.renderState?.starShower;
  if (shower?.active) {
    shower.t += delta;
    let alive = false;
    for (const star of shower.stars) {
      const lt = shower.t - star.userData.delay;
      if (lt < 0) {
        continue;
      }
      if (lt > 4.5) {
        star.visible = false;
        continue;
      }
      alive = true;
      star.visible = true;
      const s0 = star.userData.start;
      star.position.set(s0.x - lt * 7.5, s0.y - lt * 0.9, s0.z + lt * 0.6);
      star.material.opacity = Math.max(0, 1 - lt / 4.5);
      star.rotation.z = -0.12; // 낙하 방향으로 살짝 기운 꼬리
    }
    if (!alive && shower.t > 1) {
      disposeDungeonRoom(shower.group, game.renderState.overworld);
      game.renderState.starShower = { active: false };
    }
  }

  // 하루의 증거 수신기: 안 읽은 감사 신호가 있으면 별 조각이 떠서 반짝인다.
  if (novaMailGlow) {
    const unreadCount = getUnreadNovaLetters(game.progress).length;
    novaMailGlow.visible = unreadCount > 0;
    if (novaMailGlow.visible) {
      novaMailGlow.position.y = 1.6 + Math.sin(elapsed * 2.4) * 0.14;
      novaMailGlow.rotation.y += delta * 2.2;
    }
  }
  for (const [shrineId, crystal] of shrineCrystals.entries()) {
    crystal.rotation.y += delta * 1.6;
    const shrine = getShrineById(shrineId);
    const completed = game.progress.completedShrines.includes(shrineId);
    crystal.position.y = 0.82 + Math.sin(elapsed * 2.2 + shrine.topicId.length) * 0.08;
    crystal.material.emissiveIntensity = completed ? 0.72 : 0.24;
  }

  // 화이트아웃 관문: 지지직 흔들리다가, 해결되면 오그라들어 사라진다.
  if (gates) {
    const flags = getStoryVisualFlags(game.progress);
    for (const [topicId, group] of gates.entries()) {
      const solved = flags.has(`${topicId}:solved`);
      if (solved) {
        if (group.visible) {
          group.scale.multiplyScalar(1 - Math.min(1, delta * 3));
          if (group.scale.x < 0.05) {
            group.visible = false;
          }
        }
        continue;
      }
      group.rotation.y += delta * 0.8;
      group.children.forEach((chunk, i) => {
        chunk.position.y += Math.sin(elapsed * 6 + i) * delta * 0.3;
        chunk.rotation.x += delta * (1 + i * 0.2);
      });
    }
  }

  // 구역 세계 상태: 미해결이면 구역별 오염, 해결되면 구역별 치유로 부드럽게 전환.
  if (zoneAuras) {
    const flags = getStoryVisualFlags(game.progress);
    // 침식 반격(N2): 기억을 되찾을수록 안개가 저항한다 — 남은 구역의 안개가 짙어지고 더 사납게 지지직댄다.
    const fogPressure = (game.progress.tools ?? []).length;
    for (const [topicId, aura] of zoneAuras.entries()) {
      const solved = flags.has(`${topicId}:solved`);
      aura.t += ((solved ? 1 : 0) - aura.t) * Math.min(1, delta * 2.5);
      const t = aura.t;
      const ease = t * t * (3 - 2 * t); // smoothstep
      // 공유 삭제 안개는 걷힌다(해결 구역) — 미해결 구역은 압력만큼 무거워진다.
      aura.hazeDisc.material.opacity = Math.min(0.58, 0.36 + fogPressure * 0.055) * (1 - ease);
      aura.haze.visible = aura.hazeDisc.material.opacity > 0.02;
      if (aura.haze.visible) {
        aura.pixels.forEach((cube, i) => {
          const a = elapsed * (0.5 + (i % 3) * 0.25) + i * 1.7;
          const r = 1.4 + (i % 4) * 0.35;
          cube.position.set(Math.cos(a) * r, 1.2 + Math.sin(elapsed * 3 + i) * 0.5, Math.sin(a) * r);
          cube.rotation.x += delta * 2;
          cube.visible = Math.sin(elapsed * (14 + fogPressure * 3) + i * 1.9) > -0.6; // 지지직 깜빡임(압력만큼 빠르게)
        });
      }
      if (aura.corruption) {
        aura.corruption.visible = ease < 0.98;
        aura.corruption.scale.setScalar(Math.max(0.001, 1 - ease));
      }
      if (aura.heal) {
        aura.heal.scale.setScalar(Math.max(0.001, ease));
        aura.heal.visible = ease > 0.02;
      }
      aura.animate?.(elapsed, delta, ease);
    }
  }

  if (coreCrystal) {
    const unlocked = canUnlockFinalCore(game.progress.collectedFragments);
    coreCrystal.rotation.y += delta * (unlocked ? 1.2 : 0.45);
    coreCrystal.position.y = 1.4 + Math.sin(elapsed * 1.8) * 0.08;
    coreCrystal.material.color.set(unlocked ? 0x6fe0be : 0x7c8790);
    coreCrystal.material.emissive.set(unlocked ? 0x2fbf9d : 0x182026);
    coreCrystal.material.emissiveIntensity = unlocked ? 0.82 : 0.35;
    if (coreGlow) {
      coreGlow.intensity = unlocked ? 2.4 : 0.8;
      coreGlow.color.set(unlocked ? 0x6fe0be : 0x8fb4c9);
    }
  }
}

// 최종장 3D 연출: 화이트아웃은 지지직 떨고 도구를 쓸 때마다 삭제 껍질이 오그라든다.
function animateNoiseBoss(delta, elapsed, boss) {
  if (!boss || !boss.group) {
    return;
  }
  const { group, data } = boss;
  // 목표 크기로 부드럽게 수렴.
  const s = group.scale.x + (boss.targetScale - group.scale.x) * Math.min(1, delta * 4);
  group.scale.setScalar(s);
  if (data.kind === 'noise') {
    // 피격 반짝임: 맞으면 잠깐 크게 떨고 눈이 번쩍인다.
    const flash = boss.hitFlash > 0 ? boss.hitFlash : 0;
    if (boss.hitFlash > 0) {
      boss.hitFlash = Math.max(0, boss.hitFlash - delta);
    }
    const shake = flash > 0 ? flash * 0.5 : 0;
    // 베이스 위치(전투 중엔 XZ로 떠돌음) + 지지직 떨림.
    group.position.x = (boss.baseX ?? 0) + Math.sin(elapsed * 22) * (0.04 + shake) * s;
    group.position.z = (boss.baseZ ?? 0) + Math.cos(elapsed * 19) * (0.04 + shake) * s;
    group.position.y = (boss.baseY ?? 4.3) + Math.sin(elapsed * 4) * 0.12;
    data.body.rotation.y += delta * 0.6;
    data.body.rotation.x = Math.sin(elapsed * 3) * 0.1;
    data.body.material.emissiveIntensity = 0.5 + flash * 2.2;
    data.pixels.forEach((cube, i) => {
      const a = elapsed * (0.6 + (i % 3) * 0.3) + i;
      const r = 1.15 + (i % 4) * 0.12;
      cube.position.set(Math.cos(a) * r, Math.sin(a * 1.3) * 0.8, Math.sin(a) * r);
      cube.rotation.x += delta * 3;
      cube.visible = Math.sin(elapsed * 18 + i * 1.7) > -0.7; // 깜빡깜빡
    });
    const blink = flash > 0 ? 1 : (Math.sin(elapsed * 2.5) > -0.9 ? 1 : 0.15);
    // 전투 중엔 눈이 '약점 색'으로 물든다 — 그 색 도구로 때려야 한다는 신호.
    if (boss.weakColorHex) {
      data.eyes.forEach((eye) => { eye.material.emissive.set(boss.weakColorHex); eye.material.color.set(boss.weakColorHex); });
    }
    data.eyes.forEach((eye) => { eye.scale.y = blink; });
  } else if (data.kind === 'nova') {
    group.position.y = boss.baseY + Math.sin(elapsed * 2) * 0.14;
    data.core.rotation.y += delta * 0.9;
    group.rotation.z = Math.sin(elapsed * 1.5) * 0.15;
  }
}

// 화이트아웃 코어를 등장시킨다. combat=true면 손이 닿는 높이로 낮게 띄운다.
function spawnNoiseBoss(game, { combat = false } = {}) {
  const rs = game.renderState;
  if (!rs || rs.noiseBoss) {
    return;
  }
  const group = createNoiseBoss();
  const baseX = 0;
  const baseZ = 0;
  const baseY = combat ? 2.6 : 4.3; // 전투는 낮게(타격), 대화 연출은 높게(프레이밍).
  group.position.set(baseX, baseY, baseZ);
  group.scale.setScalar(0.05);
  rs.scene.add(group);
  rs.noiseBoss = {
    group,
    data: group.userData,
    targetScale: combat ? 1.3 : 1.5,
    baseX,
    baseZ,
    baseY,
    hitFlash: 0,
    kind: 'noise'
  };
}

// 도구를 한 번 쓸 때마다 화이트아웃 삭제 껍질이 작아진다.
function shrinkNoiseBoss(game, remainingSteps, totalSteps) {
  const boss = game.renderState?.noiseBoss;
  if (!boss || boss.kind !== 'noise') {
    return;
  }
  const t = totalSteps > 0 ? remainingSteps / totalSteps : 0;
  boss.targetScale = 0.4 + t * 0.95; // 마지막엔 0.4까지 오그라든다
}

// 화이트아웃 중지 뒤 공개된 루멘 코어를 별빛 형태로 띄운다.
function morphNoiseToNova(game) {
  const rs = game.renderState;
  if (!rs) {
    return;
  }
  if (rs.noiseBoss?.group) {
    rs.scene.remove(rs.noiseBoss.group);
  }
  const group = createNova();
  const baseY = 3.6;
  group.position.set(0, baseY, 0);
  rs.scene.add(group);
  rs.noiseBoss = { group, data: group.userData, targetScale: 1, baseX: 0, baseY, kind: 'nova' };
}

function updateNearestInteractable(game, interactables, ui) {
  // 전투·퍼즐 중엔 일반 상호작용 안내를 숨긴다(전용 HUD가 안내를 대신한다).
  if (game.combat?.active || game.puzzle?.active) {
    game.nearest = null;
    ui.prompt.hidden = true;
    return;
  }
  const coreDistance = Math.hypot(game.player.position.x, game.player.position.z);
  let nearest = coreDistance <= CORE_RADIUS
    ? {
        type: 'core',
        position: new THREE.Vector3(0, 0, 0),
        labelKo: canUnlockFinalCore(game.progress.collectedFragments) ? 'AI 코어 최종 미션' : 'AI 코어 잠금 상태 확인'
      }
    : null;
  let nearestDistance = nearest ? coreDistance : Infinity;

  for (const item of interactables) {
    const distance = game.player.position.distanceTo(item.position);
    if (distance < INTERACTION_RADIUS && distance < nearestDistance) {
      nearest = item;
      nearestDistance = distance;
    }
  }

  game.nearest = nearest;
  if (nearest && ui.dialog.hidden) {
    ui.prompt.hidden = false;
    ui.prompt.textContent = `${ACTION_LABEL}${nearest.labelKo}`;
  } else if (ui.dialog.hidden) {
    // 터치 기기: 가까운 대상이 없으면 안내를 숨겨 화면을 비운다(d-pad로 충분).
    if (IS_TOUCH) {
      ui.prompt.hidden = true;
    } else {
      ui.prompt.hidden = false;
      ui.prompt.textContent = MOVE_HINT;
    }
  }
}

// 도구의 '동사' 발동(F/던전 도구버튼) — 도구는 열쇠가 아니라 세계와 상호작용하는 수단이다.
// 전투: 방패=가드(반사) · 종=울림 충격파 · 거울=약점 공개. 던전: 방별 동사(당기기/공명/판별).
// 터치 도구(F) 버튼 아이콘을 맥락 동사와 일치시킨다 — 태블릿에서 '누르면 무엇이 나가는지' 보이게.
const TOOL_EMOJI = { shield: '🛡️', compass: '🧭', bell: '🔔', mirror: '🪞' };
const DUNGEON_VERB_EMOJI = { push: '🧭', carry: '🔔', beam: '🪞' };
const ISLE_VERB_EMOJI = {
  'whisper-cape': '🛡️',
  'echo-cave': '🔔',
  'hourglass-port': '🧭',
  'memory-outer': '💠',
  'memory-core': '⚡'
};

function syncToolButton(game, ui) {
  if (!ui.toolButton) {
    return;
  }
  let icon = '🔄';
  if (game.dungeon?.active) {
    icon = DUNGEON_VERB_EMOJI[game.dungeon.room.mechanic] ?? '🔄';
  } else if (game.isle?.followup && !game.isle.followup.cleared) {
    icon = game.isle.stageId === 'echo-cave'
      ? '🪞'
      : game.isle.stageId === 'hourglass-port'
        ? '✅'
        : '🛡️';
  } else if (game.isle) {
    icon = ISLE_VERB_EMOJI[game.isle.stageId] ?? '🔄';
  } else if (game.combat?.active) {
    icon = TOOL_EMOJI[game.combat.tools[game.combat.activeTool]] ?? '🔄';
  }
  if (ui.toolButton.textContent !== icon) {
    ui.toolButton.textContent = icon;
  }
}

function useToolVerb(game, ui) {
  game.audio?.resume();
  game.idleT = 0;
  // 3–5장 후속 도전: 4장 거울로 자료를 비추고, 5장 적하 목록을 검수한다.
  if (game.isle?.followup && !game.isle.followup.cleared) {
    if (game.isle.stageId === 'echo-cave') {
      bubbleInspect(game, ui);
    } else if (game.isle.stageId === 'hourglass-port') {
      cargoVerify(game, ui);
    } else {
      game.audio?.playClick();
      flashCombatPopup(ui, '발자국 앞에서 A로 책임지는 행동을 선택해요', 'match');
    }
    return;
  }
  // 섬 핵심 도전 중엔 F = 그 섬의 동사(곶 = 가드, 동굴 = 울림, 항구 = 당기기, 심장 외곽 = 봉인 해제).
  if (game.isle?.challenge && !game.isle.challenge.cleared) {
    if (game.isle.stageId === 'echo-cave') {
      rumorBell(game, ui);
    } else if (game.isle.stageId === 'hourglass-port') {
      dunesPull(game, ui);
    } else if (game.isle.stageId === 'memory-outer') {
      heartUse(game, ui);
    } else if (game.isle.stageId === 'memory-core') {
      residueUse(game, ui);
    } else {
      corridorGuard(game, ui);
    }
    return;
  }
  if (game.combat?.active) {
    const toolId = game.combat.tools[game.combat.activeTool];
    if (toolId === 'shield') {
      shieldGuard(game, ui);
    } else if (toolId === 'bell') {
      bellShockwave(game, ui);
    } else if (toolId === 'mirror') {
      mirrorReveal(game, ui);
    } else {
      game.combat.hintHold = 1.4;
      ui.bossHint.textContent = '🧭 나침반은 길을 찾는 도구 — 전투에선 방패·종·거울을 써 봐요';
      game.audio?.playClick();
    }
    return;
  }
  const dg = game.dungeon;
  if (!dg?.active) {
    return;
  }
  if (dg.room.mechanic === 'push') {
    compassPull(game, ui);
  } else if (dg.room.mechanic === 'carry') {
    bellResonate(game, ui);
  } else if (dg.room.mechanic === 'beam') {
    mirrorTruthLens(game, ui);
  }
}

// 🛡️ 방패 가드: 짧은 가드 자세 — 그 사이 잡음 파도가 닿으면 스턴 대신 반사한다.
const GUARD_TIME = 0.55;
const GUARD_COOLDOWN = 1.4;

// 심부의 잔영전 — 패배 연출 단계에선 전부 튕겨나고, 각성 후엔 공격 자세의 절정에 껍질을 깬다.
function residueUse(game, ui) {
  const isle = game.isle;
  if (!isle || isle.pullCd > 0 || !isle.challenge) {
    return;
  }
  const ch = isle.challenge;
  if (ch.stage === 'defeated') {
    finishResidue(game, ui);
    return;
  }
  const distance = Math.hypot(
    game.player.position.x - RESIDUE.boss.x,
    game.player.position.z - RESIDUE.boss.z
  );
  if (distance > RESIDUE.useRange) {
    game.audio?.playClick();
    flashCombatPopup(ui, '잔영에게 더 가까이!', 'miss');
    return;
  }
  isle.pullCd = 0.6;
  if (ch.stage === 'intro') {
    // 패배 연출: 어떤 힘도 닿지 않는다.
    const events = residueIntroHit(ch);
    game.audio?.playWrong();
    addShake(game, 0.35);
    flashCombatPopup(ui, '튕겨났다! 힘이… 닿지 않아?!', 'miss');
    if (events.includes('awaken')) {
      residueAwaken(game, ui);
    }
    return;
  }
  const events = strikeResidue(ch);
  for (const event of events) {
    if (event === 'early') {
      game.audio?.playWrong();
      flashCombatPopup(ui, '아직! 잔영이 공격 자세의 절정일 때(F)!', 'miss');
    } else if (event === 'break') {
      game.audio?.playCorrect();
      addShake(game, 0.4);
      const brokenCount = Math.min(ch.phase, RESIDUE.phases.length);
      const broken = RESIDUE.phases[brokenCount - 1];
      flashCombatPopup(ui, `${broken.emoji} ${broken.nameKo} — 껍질 파괴! (${brokenCount}/${RESIDUE.phases.length})`, 'match');
      const ring = isle.built.shellRings[brokenCount - 1];
      if (ring) {
        ring.visible = false;
      }
      if (!events.includes('defeated') && ch.stage === 'fight') {
        const next = RESIDUE.phases[ch.phase];
        ui.puzzleGoal.textContent = `지금 껍질: ${next.emoji} ${next.nameKo}`;
      }
    } else if (event === 'defeated') {
      finishResidue(game, ui);
    }
  }
}

// 각성 연출: 각 보관소 감사관의 목소리가 네 검증 도구를 연결한다.
function residueAwaken(game, ui) {
  const isle = game.isle;
  isle.built.spiritOrbs.forEach((orb) => {
    orb.visible = true;
  });
  game.audio?.playNovaChime();
  triggerFlash(ui, '#ffffff');
  const first = RESIDUE.phases[0];
  ui.puzzleGoal.textContent = `지금 껍질: ${first.emoji} ${first.nameKo}`;
  ui.puzzleHint.textContent = '화이트아웃이 삭제 명령을 실행하기 직전 약속의 힘(F)!';
  ui.dialogKicker.textContent = '공개 심리실';
  ui.dialogTitle.textContent = '감사관들의 연결 신호';
  ui.dialogBody.innerHTML = speechHtml([
    '🕊️ “확산 경로를 끊고 피해를 회복한 순서를 기억해!”',
    '🐋 “추천 밖의 다른 근거를 찾았던 거울을 기억해!” 🐢 “자동 승인 전에 멈추고 검토했던 순간을 기억해!”',
    '📼 도트: “네 도구는 화이트아웃을 공격하는 무기가 아니라, 삭제되는 증거를 안전하게 검증하는 감사 도구야!”'
  ]);
  openDialog(game, ui);
}

// 화이트아웃 핵심 중지: 여섯 장의 증거를 공개 심리로 잇고 최종 윤리 선택을 연다.
function finishResidue(game, ui) {
  const isle = game.isle;
  isle.built.heal();
  game.audio?.playCoreAwaken();
  triggerFlash(ui, '#fff3c0');
  ui.puzzleGoal.textContent = 'H-17 공개 심리를 시작하세요';
  ui.puzzleHint.textContent = '개인정보는 보호하고, 결정의 근거와 책임은 검증 가능하게 공개하세요';
  ui.dialogKicker.textContent = CAMPAIGN_FINALE.titleKo;
  ui.dialogTitle.textContent = '누가 이 결정을 만들었는가';
  const lines = (items) => items.map((text) => `<p class="finale-line">${text}</p>`).join('');

  const renderChoice = () => {
    ui.dialogBody.innerHTML = `
      <div class="finale-scene finale-revelation">${lines(CAMPAIGN_FINALE.revelationKo)}</div>
      <p class="prompt-line">${CAMPAIGN_FINALE.choicePromptKo}</p>
      <div class="choice-list">
        ${CAMPAIGN_FINALE.choices
          .map((choice) => `<button type="button" class="choice-button" data-campaign-choice="${choice.id}">${choice.textKo}</button>`)
          .join('')}
      </div>
    `;
    ui.dialogBody.querySelector('[data-campaign-choice="seal"]')?.addEventListener('click', () => {
      game.audio?.playWrong();
      ui.dialogBody.innerHTML = `
        <div class="finale-scene">${lines(CAMPAIGN_FINALE.sealKo)}</div>
        <div class="finale-nav"><button type="button" class="finale-next" data-campaign-rethink>다시 생각한다 →</button></div>
      `;
      ui.dialogBody.querySelector('[data-campaign-rethink]')?.addEventListener('click', renderChoice);
    });
    ui.dialogBody.querySelector('[data-campaign-choice="hearing"]')?.addEventListener('click', () => {
      const teachings = getTeachingLines(game.progress);
      game.progress = completeCampaign(markStageCompleted(game.progress, isle.stageId));
      persistProgress(game.progress);
      updateHud(game, ui);
      morphNoiseToNova(game);
      game.audio?.playNovaChime();
      celebrate(game, new THREE.Vector3(0, 3.6, 0), '#f4b860', 'core');
      triggerStarShower(game);
      ui.puzzleGoal.textContent = ISLE_CONTENT[isle.stageId].healedGoalKo;
      ui.puzzleHint.textContent = '여섯 장의 여정을 완주했습니다';
      ui.dialogTitle.textContent = '공개 심리 결과';
      ui.dialogBody.innerHTML = `
        <div class="finale-scene">
          <p class="finale-line">${CAMPAIGN_FINALE.hearingIntroKo}</p>
          <ul class="finale-teach">
            ${teachings.map((teaching) => `
              <li class="finale-teach-item" style="--topic-color:${teaching.color}">
                <span class="finale-teach-topic">「${teaching.titleKo}」의 약속</span>
                <span class="finale-teach-deed">${teaching.deedKo}</span>
                <span class="finale-teach-lesson">${teaching.promiseKo}</span>
              </li>
            `).join('')}
          </ul>
          ${lines(CAMPAIGN_FINALE.resolutionKo)}
        </div>
        <div class="finale-nav"><button type="button" class="finale-next" data-campaign-certificate>완주증 보기 →</button></div>
      `;
      ui.dialogBody.querySelector('[data-campaign-certificate]')?.addEventListener('click', () => {
        closeDialog(game, ui);
        showCertificate(game, ui);
      });
    });
  };

  renderChoice();
  openDialog(game, ui);
}

// 감사 기록 보관소의 봉인 해제 — 봉인석이 가장 밝을 때 감사 도구(F)를 쓴다.
function heartUse(game, ui) {
  const isle = game.isle;
  if (!isle || isle.pullCd > 0 || !isle.challenge || isle.challenge.cleared) {
    return;
  }
  isle.pullCd = 0.6;
  const seal = nearestSeal(isle.challenge, game.player.position.x, game.player.position.z);
  if (!seal) {
    game.audio?.playClick();
    flashCombatPopup(ui, '봉인석 가까이에서 약속의 힘(F)을 써요', 'miss');
    return;
  }
  const events = useSeal(isle.challenge, seal.id);
  for (const event of events) {
    if (event === 'dim') {
      game.audio?.playWrong();
      flashCombatPopup(ui, '아직 어두워요 — 빛이 가장 환해지는 순간에!', 'miss');
    } else if (event === 'released') {
      game.audio?.playCorrect();
      const count = Object.values(isle.challenge.released).filter(Boolean).length;
      flashCombatPopup(ui, `${seal.emoji} ${seal.nameKo}의 봉인 해제! (${count}/${HEART.seals.length})`, 'match');
    } else if (event === 'cleared') {
      finishHeart(game, ui);
    }
  }
}

// 모래시계 사구의 나침반 당기기 — 똑바로 선 순간에 당겨야 잠긴다('멈출 때'를 아는 타이밍).
function dunesPull(game, ui) {
  const isle = game.isle;
  if (!isle || isle.pullCd > 0 || !isle.challenge || isle.challenge.cleared) {
    return;
  }
  isle.pullCd = 0.6;
  const glass = nearestGlass(isle.challenge, game.player.position.x, game.player.position.z);
  if (!glass) {
    game.audio?.playClick();
    flashCombatPopup(ui, '흔들리는 모래시계 가까이에서 🧭 당겨요', 'miss');
    return;
  }
  const events = pullGlass(isle.challenge, glass.id);
  for (const event of events) {
    if (event === 'wobble') {
      game.audio?.playWrong();
      flashCombatPopup(ui, '아직이야 — 똑바로 서는 순간에 당겨요!', 'miss');
    } else if (event === 'locked') {
      game.audio?.playCorrect();
      const lockedCount = Object.values(isle.challenge.locked).filter(Boolean).length;
      flashCombatPopup(ui, `⏳ 딱 멈췄다! 모래가 흐른다 (${lockedCount}/${DUNES.glasses.length})`, 'match');
      const sand = isle.built.sandCores.get(glass.id);
      if (sand) {
        sand.visible = true;
      }
    } else if (event === 'cleared') {
      finishDunes(game, ui);
    }
  }
}

// 소문의 벽의 종 울림 — 전투 충격파와 같은 쿨다운 리듬. 판별 창을 연다.
function rumorBell(game, ui) {
  const isle = game.isle;
  if (!isle || isle.bellCd > 0 || !isle.challenge || isle.challenge.cleared) {
    return;
  }
  isle.bellCd = BELL_COOLDOWN;
  ringRumorBell(isle.challenge);
  isle.ringT = 0.6;
  const ring = isle.built.bellRing;
  if (ring) {
    ring.position.set(game.player.position.x, 0.35, game.player.position.z);
    ring.scale.set(1, 1, 1);
    ring.visible = true;
  }
  game.audio?.playCorrect();
  flashCombatPopup(ui, '🔔 울림! 메아리 돌이 부르르 떤다', 'match');
}

// 회랑 도전의 방패 가드 — 전투 가드와 같은 리듬(짧은 자세 + 쿨다운).
function corridorGuard(game, ui) {
  const isle = game.isle;
  if (!isle || isle.guardCd > 0) {
    return;
  }
  isle.guard = GUARD_TIME;
  isle.guardCd = GUARD_COOLDOWN;
  game.audio?.playClick();
}

function shieldGuard(game, ui) {
  const c = game.combat;
  if (!c || !c.active || c.stun > 0 || c.guardCd > 0) {
    return;
  }
  if (c.tools[c.activeTool] !== 'shield') {
    ui.bossHint.textContent = '막으려면 🛡️ 약속의 방패를 들어요 (Q/벨트로 전환)';
    c.hintHold = 1.4;
    game.audio?.playClick();
    return;
  }
  c.guard = GUARD_TIME;
  c.guardCd = GUARD_COOLDOWN;
  game.audio?.playClick();
  ui.bossHint.textContent = '🛡️ 가드! 파도를 받아친다';
  c.hintHold = 0.8;
}

// 🔔 종 충격파(전투): 날아오는 파도와 발사 예고를 한 번에 흩어버린다. 광역 대신 쿨다운이 길다.
const BELL_COOLDOWN = 4.0;

function bellShockwave(game, ui) {
  const c = game.combat;
  if (!c || !c.active || c.stun > 0 || c.bellCd > 0) {
    return;
  }
  c.bellCd = BELL_COOLDOWN;
  const cleared = Boolean(c.projectile) || c.windup > 0;
  if (c.projectile?.mesh) {
    game.renderState.scene.remove(c.projectile.mesh);
    c.projectile = null;
    c.fireTimer = PHASE_FIRE[c.phase];
  }
  if (c.windup > 0) {
    c.windup = 0;
    c.fireTimer = PHASE_FIRE[c.phase];
  }
  game.audio?.playCoreAwaken();
  addShake(game, 0.3);
  flashCombatPopup(ui, cleared ? '🔔 울림! 잡음이 흩어졌다' : '🔔 울림!', 'hit');
  ui.bossHint.textContent = cleared ? '출처의 종이 잡음을 걷어냈다' : '지금은 걷어낼 잡음이 없어요 — 파도가 올 때 울려요';
  c.hintHold = 1.6;
}

// 🪞 거울 공개(전투): 다른 관점으로 비춰 이번 껍질의 약점 도구를 드러낸다(페이즈당 1회).
function mirrorReveal(game, ui) {
  const c = game.combat;
  if (!c || !c.active || c.stun > 0) {
    return;
  }
  if (c.revealed) {
    ui.bossHint.textContent = '이미 훤히 보여요 — 그 도구로 공격!';
    c.hintHold = 1.2;
    game.audio?.playClick();
    return;
  }
  c.revealed = true;
  game.audio?.playNovaChime();
  const weak = getToolById(c.weakToolId);
  flashCombatPopup(ui, `🪞 ${weak?.emoji ?? ''} 보인다!`, 'hit');
  ui.bossHint.textContent = `거울이 비춘 약점: ${weak?.emoji ?? ''} ${weak?.nameKo ?? ''}`;
  c.hintHold = 2.0;
  updateBossHud(game, ui);
}

// 🔔 종 공명(잡기 던전): 아직 제자리가 아닌 곳(빈 밭·중복 밭·미완 전시대)이 잠깐 반짝인다.
const RESONATE_TIME = 1.6;

function bellResonate(game, ui) {
  const dg = game.dungeon;
  if (!dg || !dg.active || dg.solved) {
    return;
  }
  if (!(game.progress.tools ?? []).includes('bell')) {
    ui.puzzleHint.textContent = '🔔 출처의 종이 있으면 아직 어긋난 곳을 울려 볼 수 있어요';
    return;
  }
  dg.resonateT = RESONATE_TIME;
  game.audio?.playNovaChime();
  const left = countRemaining(dg.topicId, dg.state);
  flashCombatPopup(ui, '🔔 공명!', 'hit');
  ui.puzzleHint.textContent = `종이 울린다 — 반짝이는 ${left}곳이 아직 어긋나 있어요`;
}

// 🪞 진실의 렌즈(빛 던전): 잠깐 동안 가짜 구슬이 흔들려 보인다(진짜는 미동도 없다).
const LENS_TIME = 2.2;

function mirrorTruthLens(game, ui) {
  const dg = game.dungeon;
  if (!dg || !dg.active || dg.solved) {
    return;
  }
  if (!(game.progress.tools ?? []).includes('mirror')) {
    ui.puzzleHint.textContent = '🪞 다양성의 거울이 있으면 가짜를 비춰 볼 수 있어요';
    return;
  }
  dg.lensT = LENS_TIME;
  game.audio?.playNovaChime();
  flashCombatPopup(ui, '🪞 비춘다!', 'hit');
  ui.puzzleHint.textContent = '흔들리는 건 가짜예요 — 미동도 없는 얼굴에 빛을 보내요';
}

// 🧭 나침반 당기기: 바라보는 방향 직선의 첫 상자를 내 쪽으로 한 칸 끌어온다.
const PULL_RANGE = 5;

function compassPull(game, ui) {
  const dg = game.dungeon;
  if (!dg || !dg.active || dg.solved || dg.actionCooldown > 0) {
    return;
  }
  if (!(game.progress.tools ?? []).includes('compass')) {
    ui.puzzleHint.textContent = '🧭 진실의 나침반이 있으면 멀리 있는 상자를 끌어올 수 있어요';
    return;
  }
  dg.actionCooldown = DUNGEON_PUSH_COOLDOWN;
  const dir = facingGridDir(game.player.direction);
  const playerCell = worldToCell(dg.topicId, game.player.position.x, game.player.position.z);
  const crateId = firstCrateInLine(dg.topicId, dg.state, playerCell, dir, PULL_RANGE);
  if (!crateId) {
    game.audio?.playClick();
    ui.puzzleHint.textContent = '🧭 시선 방향에 끌어올 상자가 없어요';
    return;
  }
  // 당기기 = 상자를 플레이어 쪽(-dir)으로 한 칸. 내 발밑까지는 못 온다.
  const pullDir = [-dir[0], -dir[1]];
  const cur = dg.state.crates[crateId];
  const dest = [cur[0] + pullDir[0], cur[1] + pullDir[1]];
  if (dest[0] === playerCell[0] && dest[1] === playerCell[1]) {
    game.audio?.playClick();
    ui.puzzleHint.textContent = '이미 코앞이에요 — A로 밀어요';
    return;
  }
  const result = pushCrate(dg.topicId, dg.state, crateId, pullDir);
  if (result.event === 'wrong-zone') {
    dungeonRefuse(game, ui, '거기엔 안 돼요!', '내 것만 공개 게시판에, 친구 것은 잠금 금고에!');
    return;
  }
  if (!result.moved) {
    game.audio?.playClick();
    return;
  }
  dg.state = result.state;
  syncDungeon(dg);
  game.audio?.[result.event === 'placed' ? 'playCorrect' : 'playClick']?.();
  flashCombatPopup(ui, '🧭 끌어당김!', 'hit');
  if (isRoomSolved(dg.topicId, dg.state)) {
    markDungeonSolved(game, ui);
  } else {
    const left = countRemaining(dg.topicId, dg.state);
    ui.puzzleHint.textContent = `상자 ${left}개가 아직 제자리가 아니에요`;
  }
}

// 오른쪽 A 버튼/Space·Enter·E: 전투 중이면 '공격', 퍼즐 중이면 '돌 바꾸기', 아니면 '확인·대화'.
function primaryAction(game, ui) {
  game.audio?.resume();
  game.idleT = 0;
  if (game.dungeon?.active) {
    dungeonAction(game, ui);
  } else if (game.voyage) {
    voyageAction(game, ui);
  } else if (game.isle) {
    isleAction(game, ui);
  } else if (game.combat?.active) {
    playerAttack(game, ui);
  } else if (game.puzzle?.active) {
    puzzleCycle(game, ui);
  } else {
    interact(game, ui);
  }
}

function interact(game, ui) {
  // 첫 상호작용에서 오디오를 깨운다(자동재생 정책 대응).
  game.audio?.resume();

  if (!ui.dialog.hidden) {
    return;
  }

  if (!game.nearest) {
    ui.prompt.hidden = false;
    ui.prompt.textContent = '가까운 NPC, 사당, AI 코어로 이동해 보세요.';
    return;
  }

  game.audio?.playClick();

  if (game.nearest.type === 'npc') {
    openNpcDialog(game, ui, game.nearest.topicId);
  } else if (game.nearest.type === 'shrine') {
    // 아직 못 깬 사당은 전용 던전(별도 맵)으로 진입, 이미 깬 사당은 복습 대화로.
    if (game.progress.completedShrines.includes(game.nearest.shrineId)) {
      openShrineDialog(game, ui, game.nearest.shrineId);
    } else {
      enterShrineChallenge(game, ui, game.nearest.shrineId, game.nearest.topicId);
    }
  } else if (game.nearest.type === 'gate') {
    openGateDialog(game, ui, game.nearest.topicId);
  } else if (game.nearest.type === 'letter') {
    const unread = getUnreadNovaLetters(game.progress);
    if (unread.length === 0) {
      ui.prompt.hidden = false;
      ui.prompt.textContent = '증거 수신기가 조용해요 — 다음 보관소를 조사하면 하루의 감사 신호가 도착해요.';
    } else {
      const stageId = unread[0];
      game.progress = { ...game.progress, novaLettersRead: [...(game.progress.novaLettersRead ?? []), stageId] };
      persistProgress(game.progress);
      const finalMessage = stageId === 'memory-core' && game.progress.campaignCompleted;
      ui.dialogKicker.textContent = finalMessage ? '📡 하루의 생방송 메시지' : '📼 복구된 H-17 감사 신호';
      ui.dialogTitle.textContent = finalMessage ? '하루' : '발신자 H-17';
      ui.dialogBody.innerHTML = speechHtml(HARU_SIGNALS[stageId]);
      openDialog(game, ui);
      if (stageId === 'memory-core') {
        // 마지막 메시지 — 공개 심리 뒤 섬으로 돌아오는 하루의 배를 별빛으로 알린다.
        game.audio?.playNovaChime();
        triggerStarShower(game);
        updateHud(game, ui); // 탐험 노트의 완결 기록 갱신
      }
    }
  } else if (game.nearest.type === 'bottle') {
    // 지식의 유리병 — 줍는 순간 쪽지(디지털 리터러시 꿀팁)를 읽는다.
    const bottleId = game.nearest.bottleId;
    const bottle = KNOWLEDGE_BOTTLES.find((b) => b.id === bottleId);
    const before = (game.progress.knowledgeBottles ?? []).length;
    game.progress = collectKnowledgeBottle(game.progress, bottleId);
    if (bottle && (game.progress.knowledgeBottles ?? []).length > before) {
      persistProgress(game.progress);
      const rs = game.renderState;
      const mesh = rs.bottleMeshes?.get(bottleId);
      if (mesh) {
        disposeDungeonRoom(mesh, rs.overworld);
        rs.bottleMeshes.delete(bottleId);
      }
      const idx = rs.interactables.findIndex((item) => item.type === 'bottle' && item.bottleId === bottleId);
      if (idx >= 0) {
        rs.interactables.splice(idx, 1);
      }
      game.nearest = null;
      game.audio?.playCollect();
      celebrate(game, new THREE.Vector3(bottle.pos[0], 1.0, bottle.pos[1]), '#8fe0ff', 'collect');
      const count = game.progress.knowledgeBottles.length;
      // 수집 카운터 주스(R-루프8) — 진행이 쌓이는 손맛을 화면에 크게 띄운다.
      flashCombatPopup(ui, `🍾 지식의 유리병 ${count}/${KNOWLEDGE_BOTTLES.length}`, count === KNOWLEDGE_BOTTLES.length ? 'win' : 'match');
      ui.dialogKicker.textContent = `🍾 지식의 유리병 ${count}/${KNOWLEDGE_BOTTLES.length}`;
      ui.dialogTitle.textContent = '유리병 속 쪽지';
      ui.dialogBody.innerHTML = speechHtml([
        `"${bottle.tipKo}"`,
        count === KNOWLEDGE_BOTTLES.length
          ? '✨ 도트: "열두 병 전부 다 찾았어! 정보의 바다를 항해하는 지혜가 가득해졌네 — 탐험 노트의 항해일지를 봐!"'
          : ''
      ].filter(Boolean));
      openDialog(game, ui);
      if (count === KNOWLEDGE_BOTTLES.length) {
        game.audio?.playNovaChime();
      }
      updateHud(game, ui);
    }
  } else if (game.nearest.type === 'lighthouse') {
    // 학생 기록 행정동 — 삭제 광선과 복구 광선이 사건 진행도를 풍경에 기록한다.
    const lit = game.beaconCount ?? 0;
    ui.dialogKicker.textContent = '학생 기록 행정동';
    ui.dialogTitle.textContent = '✨ 도트';
    ui.dialogBody.innerHTML = speechHtml([
      '"저 흰 광선이 학생 기록을 지우는 WHITEOUT 신호야. 우리가 확인한 증거는 호박빛 복구 광선으로 남아."',
      lit === 0
        ? '"아직 복구 광선이 하나도 없어… 교내 네 장소에서 H-17의 흔적을 먼저 찾아야 해."'
        : `"복구 광선 ${lit}줄기 — 네가 검증한 기록의 수만큼 삭제 명령이 약해지고 있어."`,
      lit >= 6 ? '"여섯 줄기 전부! 이제 어떤 자동 결정도 근거 없이 사람을 지울 수 없어. 고마워, 감사관!"' : ''
    ].filter(Boolean));
    openDialog(game, ui);
  } else if (game.nearest.type === 'dock') {
    // 바다는 1-2장 코어 균열을 통과한 뒤 열린다.
    if (game.progress.aiCoreCompleted) {
      enterVoyage(game, ui);
    } else {
      ui.dialogKicker.textContent = '등교용 페리 터미널';
      ui.dialogTitle.textContent = '✨ 도트';
      ui.dialogBody.innerHTML = speechHtml([
        '"바다 건너 보관소에도 H-17 삭제 명령의 조각이 있어. 하지만 먼저 이 섬의 네 증거를 확보해야 해."',
        '"증거 네 개를 모아 감사 코어를 열면, 누가 화이트아웃을 승인했는지 추적할 수 있어."'
      ]);
      openDialog(game, ui);
    }
  } else if (
    canUnlockFinalCore(game.progress.collectedFragments)
    && !game.progress.aiCoreCompleted
    && !game.combat
  ) {
    if (game.finaleResolving) {
      // 이미 화이트아웃을 중지한 뒤 대화를 닫았다면 재전투 없이 공개 심리 선택부터 재개.
      runFinale(game, ui, { fromCombat: true });
      openDialog(game, ui);
    } else {
      // 조각을 모으고 코어에 닿으면 화이트아웃 중지 액션 전투로 진입.
      startBossFight(game, ui);
    }
  } else {
    openCoreDialog(game, ui);
  }
}

function speechHtml(linesKo) {
  return linesKo.map((line) => `<p class="speech-line">${line}</p>`).join('');
}

function openNpcDialog(game, ui, topicId) {
  const zone = WORLD_ZONES.find((item) => item.topicId === topicId);
  // 대화 내용은 '지금' 상태로 정하고(첫 대화면 소개), 그 뒤에 관문을 연다.
  const dialog = getNpcDialog(game.progress, topicId);
  game.progress = recordLearningVisit(game.progress, topicId);
  game.progress = applyIntroTalk(game.progress, topicId);
  persistProgress(game.progress);
  updateHud(game, ui);

  ui.dialogKicker.textContent = zone.nameKo;
  ui.dialogTitle.textContent = zone.npc.nameKo;
  ui.dialogBody.innerHTML = `
    ${speechHtml(dialog.linesKo)}
    <p class="quest-hint">${getStoryObjective(game.progress)}</p>
  `;
  openDialog(game, ui);
}

function openGateDialog(game, ui, topicId) {
  const quest = QUESTS[topicId];
  ui.dialogKicker.textContent = quest.gateLabelKo;
  ui.dialogTitle.textContent = quest.questTitleKo;

  function render() {
    const dialog = getGateDialog(game.progress, topicId);
    if (dialog.kind !== 'choice') {
      ui.dialogBody.innerHTML = speechHtml(dialog.linesKo);
      if (dialog.kind === 'need-tool') {
        const tool = getToolById(dialog.toolId);
        ui.dialogBody.innerHTML += `<p class="quest-hint">${tool.emoji} 「${tool.nameKo}」이(가) 필요해요 — 사당의 시련을 통과하세요.</p>`;
      }
      return;
    }
    const tool = getToolById(quest.toolId);
    const options = dialog.options
      .map((o) => `<button type="button" class="choice-button" data-gate-choice="${o.id}">${o.textKo}</button>`)
      .join('');
    ui.dialogBody.innerHTML = `
      <p class="gate-tool">${tool.emoji} 「${tool.nameKo}」 사용</p>
      <p>${dialog.introKo}</p>
      <p class="prompt-line">${dialog.promptKo}</p>
      <div class="choice-list">${options}</div>
      <p class="feedback-line" data-gate-feedback></p>
    `;
    const feedback = ui.dialogBody.querySelector('[data-gate-feedback]');
    for (const button of ui.dialogBody.querySelectorAll('[data-gate-choice]')) {
      button.addEventListener('click', () => {
        const before = canUnlockFinalCore(game.progress.collectedFragments);
        const outcome = applyGateChoice(game.progress, topicId, button.dataset.gateChoice);
        game.progress = outcome.progress;
        if (outcome.awardFragment) {
          game.progress = awardFragment(game.progress, topicId);
        }
        persistProgress(game.progress);
        feedback.dataset.correct = String(outcome.wise);
        if (outcome.wise) {
          feedback.textContent = outcome.feedbackKo;
          for (const sibling of ui.dialogBody.querySelectorAll('[data-gate-choice]')) {
            sibling.disabled = true;
          }
          // 조각 획득 연출 + 획득 의식 + 코어 각성 체크.
          const topic = getTopicById(topicId);
          celebrate(game, new THREE.Vector3(quest.gatePosition[0], 1.4, quest.gatePosition[1]), topic?.color ?? '#7cf0ff', 'collect');
          showItemCeremony(game, ui, {
            emoji: '💠',
            title: `${topic?.titleKo ?? '윤리'} 조각 획득!`,
            subtitle: '탐험 노트(기록)에서 모은 조각을 볼 수 있어요',
            color: topic?.color ?? '#7cf0ff'
          });
          window.setTimeout(() => {
            const teaser = topic?.teaserKo ? `<p class="quest-teaser">🔮 ${topic.teaserKo}</p>` : '';
            ui.dialogBody.innerHTML += `<div class="gate-resolve">${speechHtml(outcome.resolveKo)}<p class="quest-hint">${getStoryObjective(game.progress)}</p>${teaser}</div>`;
          }, 500);
          if (!before && canUnlockFinalCore(game.progress.collectedFragments)) {
            // 마지막 조각으로 코어가 열리는 절정 — 점증 스펙터클로 착지(R-루프7).
            window.setTimeout(() => triggerCoreAwakening(game, ui), 900);
          }
        } else {
          game.audio?.playWrong();
          feedback.textContent = `${outcome.feedbackKo}`;
          // 회복: 잠시 뒤 다시 선택하게 한다.
          window.setTimeout(() => render(), 1400);
        }
        updateHud(game, ui);
      });
    }
  }

  render();
  openDialog(game, ui);
}

function openShrineDialog(game, ui, shrineId) {
  const shrine = getShrineById(shrineId);
  const topic = getTopicById(shrine.topicId);
  const completed = game.progress.completedShrines.includes(shrineId);
  ui.dialogKicker.textContent = topic.titleKo;
  ui.dialogTitle.textContent = shrine.nameKo;

  const choices = shrine.choices
    .map((choice) => `<button type="button" class="choice-button" data-choice="${choice.id}">${choice.textKo}</button>`)
    .join('');

  const extraQuestions = getExtraShrineQuestions(shrineId);

  ui.dialogBody.innerHTML = `
    <p class="prompt-line">${shrine.questionKo}</p>
    <div class="choice-list">${choices}</div>
    <p class="feedback-line" data-feedback>${completed ? '이미 해결한 사당입니다. 연습 문제로 더 익혀 보세요.' : ''}</p>
    <p class="reflection" data-shrine-reflection hidden></p>
    <div class="practice-area" data-practice-area></div>
  `;

  const zone = WORLD_ZONES.find((item) => item.shrineId === shrineId);
  const feedback = ui.dialogBody.querySelector('[data-feedback]');
  const reflection = ui.dialogBody.querySelector('[data-shrine-reflection]');
  const practiceArea = ui.dialogBody.querySelector('[data-practice-area]');

  const challenge = getClassifyChallenge(shrine.topicId);

  function showPracticeGate() {
    const buttons = [];
    if (extraQuestions.length > 0) {
      buttons.push(`<button type="button" class="practice-start" data-practice-start>📝 연습 문제 더 풀기 (${extraQuestions.length}문제)</button>`);
    }
    if (challenge) {
      buttons.push(`<button type="button" class="practice-start classify-start" data-classify-start>🧩 ${challenge.titleKo}</button>`);
    }
    if (buttons.length === 0) {
      return;
    }
    practiceArea.innerHTML = buttons.join('');
    practiceArea.querySelector('[data-practice-start]')?.addEventListener('click', () => renderPractice(0));
    practiceArea.querySelector('[data-classify-start]')?.addEventListener('click', () => renderClassify());
  }

  // 탭 기반 분류 미니게임: 카드를 골라 '안전/조심' 바구니에 담고 채점한다.
  function renderClassify() {
    const assignments = {};
    let selectedCardId = null;

    function draw(result) {
      const unsorted = challenge.cards.filter((card) => !assignments[card.id]);
      const cardChip = (card, inBucket) => {
        const state = result
          ? result.perCard.find((entry) => entry.cardId === card.id)?.correct
            ? 'correct'
            : 'wrong'
          : '';
        const selected = selectedCardId === card.id ? ' is-selected' : '';
        return `<button type="button" class="clue-card${selected}" data-clue="${card.id}" data-state="${state}">${card.textKo}</button>`;
      };
      const bucketHtml = CLASSIFY_BUCKETS.map((bucket) => {
        const inBucket = challenge.cards.filter((card) => assignments[card.id] === bucket.id);
        return `
          <div class="clue-bucket" data-bucket="${bucket.id}">
            <p class="clue-bucket-title">${bucket.emoji} ${bucket.labelKo}</p>
            <div class="clue-bucket-items">${inBucket.map((card) => cardChip(card, true)).join('')}</div>
          </div>
        `;
      }).join('');
      const allPlaced = challenge.cards.every((card) => assignments[card.id]);

      practiceArea.innerHTML = `
        <div class="classify-card">
          <p class="practice-count">🧩 분류 도전</p>
          <p class="prompt-line">${challenge.promptKo}</p>
          <p class="classify-hint">카드를 누른 뒤 바구니를 누르면 담겨요.</p>
          <div class="clue-tray" data-tray>${unsorted.map((card) => cardChip(card, false)).join('')}</div>
          <div class="clue-buckets">${bucketHtml}</div>
          <p class="feedback-line" data-classify-feedback>${
            result ? `${result.correct}/${result.total} 맞았어요.${result.passed ? ' 완벽해요! 🎉' : ' 빨간 카드를 다시 옮겨 보세요.'}` : ''
          }</p>
          <div class="classify-actions">
            <button type="button" class="classify-check" data-classify-check ${allPlaced ? '' : 'disabled'}>채점하기</button>
            <button type="button" class="classify-back" data-classify-back>← 도전 메뉴</button>
          </div>
        </div>
      `;

      for (const btn of practiceArea.querySelectorAll('[data-clue]')) {
        btn.addEventListener('click', () => {
          selectedCardId = selectedCardId === btn.dataset.clue ? null : btn.dataset.clue;
          game.audio?.playClick();
          draw(null);
        });
      }
      for (const bucket of practiceArea.querySelectorAll('[data-bucket]')) {
        bucket.addEventListener('click', () => {
          if (!selectedCardId) {
            return;
          }
          assignments[selectedCardId] = bucket.dataset.bucket;
          selectedCardId = null;
          game.audio?.playClick();
          draw(null);
        });
      }
      practiceArea.querySelector('[data-classify-back]').addEventListener('click', () => showPracticeGate());
      const checkBtn = practiceArea.querySelector('[data-classify-check]');
      if (checkBtn && allPlaced) {
        checkBtn.addEventListener('click', () => {
          const scored = scoreClassify(shrine.topicId, assignments);
          if (scored.passed) {
            game.audio?.playCollect();
            const topic = getTopicById(shrine.topicId);
            const shrinePos = getInteractablePosition(game, 'shrine', shrineId);
            celebrate(game, shrinePos.clone().setY(shrinePos.y + 1.2), topic?.color ?? '#ffd76a', 'collect');
          } else {
            game.audio?.playWrong();
          }
          draw(scored);
        });
      }
    }

    draw(null);
  }

  function renderPractice(index) {
    const question = extraQuestions[index];
    const optionButtons = question.choices
      .map((choice) => `<button type="button" class="choice-button" data-practice-choice="${choice.id}">${choice.textKo}</button>`)
      .join('');
    practiceArea.innerHTML = `
      <div class="practice-card">
        <p class="practice-count">연습 ${index + 1}/${extraQuestions.length}</p>
        <p class="prompt-line">${question.questionKo}</p>
        <div class="choice-list">${optionButtons}</div>
        <p class="feedback-line" data-practice-feedback></p>
        <div data-practice-nav></div>
      </div>
    `;
    const practiceFeedback = practiceArea.querySelector('[data-practice-feedback]');
    const nav = practiceArea.querySelector('[data-practice-nav]');
    let answered = false;
    for (const button of practiceArea.querySelectorAll('[data-practice-choice]')) {
      button.addEventListener('click', () => {
        if (answered) {
          return;
        }
        answered = true;
        const outcome = recordPracticeChoice(game.progress, shrineId, question.id, button.dataset.practiceChoice);
        game.progress = outcome.progress;
        persistProgress(game.progress);
        practiceFeedback.textContent = outcome.result.feedbackKo;
        practiceFeedback.dataset.correct = String(outcome.result.correct);
        if (outcome.result.correct) {
          game.audio?.playCorrect();
        } else {
          game.audio?.playWrong();
        }
        updateHud(game, ui);
        const isLast = index + 1 >= extraQuestions.length;
        nav.innerHTML = isLast
          ? '<p class="practice-done">연습 완료! 잘했어요.</p><button type="button" class="classify-back" data-practice-back>← 도전 메뉴</button>'
          : '<button type="button" class="practice-next" data-practice-next>다음 문제 →</button>';
        if (isLast) {
          nav.querySelector('[data-practice-back]').addEventListener('click', () => showPracticeGate());
        } else {
          nav.querySelector('[data-practice-next]').addEventListener('click', () => renderPractice(index + 1));
        }
      });
    }
  }

  for (const button of ui.dialogBody.querySelectorAll('[data-choice]')) {
    button.disabled = completed;
    button.addEventListener('click', () => {
      const firstClear = !game.progress.completedShrines.includes(shrineId);
      const outcome = applyShrineResult(game.progress, shrineId, button.dataset.choice);
      game.progress = outcome.progress;
      persistProgress(game.progress);
      feedback.textContent = outcome.result.feedbackKo;
      feedback.dataset.correct = String(outcome.result.correct);
      // 1부(어드벤처)와 같은 원칙: 위험한 선택은 처벌 대신 회고 질문으로 잇는다.
      reflection.hidden = outcome.result.correct;
      if (!outcome.result.correct) {
        reflection.textContent = `생각해 보기 — ${zone.npc.reflection}`;
      }
      for (const sibling of ui.dialogBody.querySelectorAll('[data-choice]')) {
        sibling.disabled = outcome.result.correct;
      }
      if (outcome.result.correct) {
        // 사당 통과 = 약속 도구 획득. 조각은 이 도구로 관문을 풀어야 얻는다.
        const topic = getTopicById(outcome.result.topicId);
        const shrinePos = getInteractablePosition(game, 'shrine', shrineId);
        celebrate(game, shrinePos.clone().setY(shrinePos.y + 1.2), topic?.color ?? '#ffd76a', 'collect');
        if (firstClear && outcome.toolId) {
          const tool = getToolById(outcome.toolId);
          const quest = QUESTS[outcome.result.topicId];
          reflection.hidden = false;
          reflection.dataset.tool = 'true';
          reflection.textContent = `${tool.emoji} 「${tool.nameKo}」 획득! ${tool.powerKo} 이제 「${quest.gateLabelKo}」로 가서 사용하세요.`;
        }
        showPracticeGate();
      } else {
        game.audio?.playWrong();
      }
      updateHud(game, ui);
    });
  }

  if (completed) {
    showPracticeGate();
  }

  openDialog(game, ui);
}

// ===== 사당 3D 조작 퍼즐: 돌에 다가가 A로 상태를 바꿔 목표 배치를 완성한다 =====
const PUZZLE_REACH = 1.9;

function makeStateSprite(text) {
  const sprite = createLabelSprite(text, '#ffd76a');
  sprite.scale.set(1.5, 0.62, 1);
  return sprite;
}

function startShrinePuzzle(game, ui, shrineId) {
  if (game.puzzle) {
    return;
  }
  const shrine = getShrineById(shrineId);
  const topicId = shrine.topicId;
  const puzzle = getShrinePuzzle(topicId);
  if (!puzzle) {
    openShrineDialog(game, ui, shrineId); // 안전망: 퍼즐이 없으면 기존 방식.
    return;
  }
  const states = createPuzzleState(topicId);
  const basePos = getInteractablePosition(game, 'shrine', shrineId);
  const scene = game.renderState.scene;
  const n = puzzle.objects.length;
  const pedestals = puzzle.objects.map((obj, i) => {
    const group = new THREE.Group();
    const px = basePos.x + (i - (n - 1) / 2) * 1.6;
    const pz = basePos.z + 1.7; // 플레이어가 다가서는 쪽
    group.position.set(px, 0, pz);
    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.42, 0.7, 12),
      new THREE.MeshStandardMaterial({ color: 0xb9b0c8, roughness: 0.7 })
    );
    stand.position.y = 0.35;
    stand.castShadow = true;
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.28, 0),
      new THREE.MeshStandardMaterial({ color: obj.color, emissive: obj.color, emissiveIntensity: 0.4, roughness: 0.4, flatShading: true })
    );
    orb.position.y = 1.0;
    const sprite = makeStateSprite(puzzle.objects[i].states[states[i]]);
    sprite.position.y = 1.62;
    const nameTag = createLabelSprite(obj.labelKo, obj.color);
    nameTag.scale.set(1.7, 0.42, 1);
    nameTag.position.y = 0.05;
    group.add(stand, orb, sprite, nameTag);
    scene.add(group);
    return { group, orb, sprite, obj, position: group.position.clone() };
  });

  // 확인의 종 — 돌을 다 맞춘 뒤 A로 울려야 판정된다(연타로 저절로 풀리지 않게).
  const bellGroup = new THREE.Group();
  const bellX = basePos.x + ((n - 1) / 2 + 1.35) * 1.6;
  const bellZ = basePos.z + 1.7;
  bellGroup.position.set(bellX, 0, bellZ);
  const bellStand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 0.7, 12),
    new THREE.MeshStandardMaterial({ color: 0xb9b0c8, roughness: 0.7 })
  );
  bellStand.position.y = 0.35;
  bellStand.castShadow = true;
  const bellBody = new THREE.Mesh(
    new THREE.ConeGeometry(0.34, 0.5, 14, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffb032, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.35, side: THREE.DoubleSide })
  );
  bellBody.position.y = 1.05;
  const bellTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffcf5a, emissiveIntensity: 0.7, roughness: 0.3 })
  );
  bellTop.position.y = 1.34;
  const bellTag = createLabelSprite('확인의 종 🔔', '#ffd76a');
  bellTag.scale.set(1.9, 0.44, 1);
  bellTag.position.y = 0.05;
  bellGroup.add(bellStand, bellBody, bellTop, bellTag);
  scene.add(bellGroup);

  game.puzzle = {
    active: true,
    topicId,
    shrineId,
    states,
    pedestals,
    nearIndex: -1,
    solved: false,
    bellGroup,
    bellBody,
    bellPosition: bellGroup.position.clone(),
    nearBell: false,
    commitCooldown: 0,
    failedCommits: 0
  };
  ui.root.classList.add('is-combat'); // A 버튼을 강조(공격 버튼 스타일 재사용)
  if (ui.actionLabel) {
    ui.actionLabel.textContent = '🔁';
  }
  ui.puzzleHud.hidden = false;
  ui.puzzleTitle.textContent = `🧩 ${puzzle.titleKo}`;
  ui.puzzleGoal.textContent = puzzle.goalKo;
  ui.prompt.hidden = true;
  game.updateRotateHint?.();
  refreshPuzzleEmblems(game);
}

function refreshPuzzleEmblems(game) {
  const pz = game.puzzle;
  if (!pz) {
    return;
  }
  const puzzle = getShrinePuzzle(pz.topicId);
  pz.pedestals.forEach((ped, i) => {
    const text = puzzle.objects[i].states[pz.states[i]];
    const old = ped.sprite;
    const fresh = makeStateSprite(text);
    fresh.position.copy(old.position);
    ped.group.remove(old);
    old.material.map?.dispose?.();
    old.material.dispose?.();
    ped.group.add(fresh);
    ped.sprite = fresh;
  });
}

function puzzleCycle(game, ui) {
  const pz = game.puzzle;
  if (!pz || !pz.active) {
    return;
  }
  // 종 근처에서 A → 답 확인(커밋). 돌 근처에서 A → 그 돌만 순환.
  if (pz.nearBell) {
    puzzleCommit(game, ui);
    return;
  }
  if (pz.nearIndex < 0) {
    game.audio?.playClick();
    return;
  }
  const i = pz.nearIndex;
  pz.states = cyclePuzzleObject(pz.topicId, pz.states, i);
  const puzzle = getShrinePuzzle(pz.topicId);
  // 해당 돌의 스프라이트만 갱신. (자동 정답 판정은 하지 않는다 — 종을 울려야 확인.)
  const ped = pz.pedestals[i];
  const fresh = makeStateSprite(puzzle.objects[i].states[pz.states[i]]);
  fresh.position.copy(ped.sprite.position);
  ped.group.remove(ped.sprite);
  ped.sprite.material.map?.dispose?.();
  ped.sprite.material.dispose?.();
  ped.group.add(fresh);
  ped.sprite = fresh;
  game.audio?.playClick();
}

// 확인의 종을 울려 답을 판정한다. 정답 → 통과, 오답 → 정답 비공개 피드백 + 시도 기록.
function puzzleCommit(game, ui) {
  const pz = game.puzzle;
  if (!pz || !pz.active || pz.commitCooldown > 0) {
    return;
  }
  pz.commitCooldown = 1.2; // 연타 스팸 방지
  if (pz.bellBody) {
    pz.bellBody.rotation.z = 0.5; // 딸랑 흔들림(updatePuzzle에서 복귀)
  }
  if (isPuzzleSolved(pz.topicId, pz.states)) {
    game.audio?.playCorrect();
    winShrinePuzzle(game, ui);
    return;
  }
  // 오답: 검증된 상태 전이를 재사용해 '실패 시도'를 기록(리포트 진실화).
  const shrine = getShrineById(pz.shrineId);
  const wrong = shrine.choices.find((c) => !c.correct);
  if (wrong) {
    game.progress = applyShrineResult(game.progress, pz.shrineId, wrong.id).progress;
    persistProgress(game.progress);
  }
  pz.failedCommits += 1;
  game.audio?.playWrong();
  addShake(game, 0.12);
  const puzzle = getShrinePuzzle(pz.topicId);
  const left = countMisplaced(pz.topicId, pz.states);
  // 정답은 알려주지 않는다: 1회차는 목표 재제시, 2회차부터 남은 개수만.
  ui.puzzleHint.textContent = pz.failedCommits < 2
    ? `아직이에요 — ${puzzle.goalKo}`
    : `돌 ${left}개가 아직 어긋나 있어요. 다시 살펴봐요`;
  updateHud(game, ui);
}

function updatePuzzle(delta, game, ui) {
  const pz = game.puzzle;
  if (!pz || !pz.active) {
    return;
  }
  if (pz.commitCooldown > 0) {
    pz.commitCooldown = Math.max(0, pz.commitCooldown - delta);
  }
  const elapsed = clock.elapsedTime;
  // 가장 가까운 돌을 찾아 강조하고 안내를 갱신.
  let nearIndex = -1;
  let nearDist = PUZZLE_REACH;
  pz.pedestals.forEach((ped, i) => {
    const d = Math.hypot(game.player.position.x - ped.position.x, game.player.position.z - ped.position.z);
    if (d < nearDist) {
      nearDist = d;
      nearIndex = i;
    }
    // 살짝 둥실 + 회전.
    ped.orb.position.y = 1.0 + Math.sin(elapsed * 2 + i) * 0.06;
    ped.orb.rotation.y += delta * 0.8;
  });
  // 종과의 거리 — 종이 더 가까우면 종을 조준.
  const bellDist = pz.bellPosition
    ? Math.hypot(game.player.position.x - pz.bellPosition.x, game.player.position.z - pz.bellPosition.z)
    : Infinity;
  pz.nearBell = bellDist < PUZZLE_REACH && bellDist <= nearDist;
  if (pz.nearBell) {
    nearIndex = -1;
  }
  pz.nearIndex = nearIndex;
  // 조준 강조.
  pz.pedestals.forEach((ped, i) => {
    const targeted = i === nearIndex;
    ped.orb.material.emissiveIntensity = targeted ? 1.1 : 0.4;
    ped.orb.scale.setScalar(targeted ? 1.18 : 1);
  });
  if (pz.bellBody) {
    pz.bellBody.rotation.z *= 1 - Math.min(1, delta * 6); // 딸랑 후 복귀
    pz.bellBody.material.emissiveIntensity = pz.nearBell ? 1.0 : 0.5;
  }
  const puzzle = getShrinePuzzle(pz.topicId);
  if (pz.commitCooldown <= 0) {
    if (pz.nearBell) {
      ui.puzzleHint.textContent = '🔔 확인의 종 — A로 울려 답을 확인해요';
    } else if (nearIndex >= 0) {
      ui.puzzleHint.textContent = `가까운 돌: ${puzzle.objects[nearIndex].labelKo} — A로 바꾸기`;
    } else {
      ui.puzzleHint.textContent = '돌을 맞춘 뒤 종으로 가서 확인해요';
    }
  }
}

function winShrinePuzzle(game, ui) {
  const pz = game.puzzle;
  if (!pz || pz.solved) {
    return;
  }
  pz.solved = true;
  const shrine = getShrineById(pz.shrineId);
  const correct = shrine.choices.find((c) => c.correct);
  const outcome = applyShrineResult(game.progress, pz.shrineId, correct.id);
  game.progress = outcome.progress;
  persistProgress(game.progress);
  const topic = getTopicById(pz.topicId);
  celebrate(game, getInteractablePosition(game, 'shrine', pz.shrineId).clone().setY(1.4), topic?.color ?? '#ffd76a', 'collect');
  const toolId = outcome.toolId;
  endShrinePuzzle(game, ui);
  updateHud(game, ui);
  // 도구 획득 안내(간단 대화).
  if (toolId) {
    const tool = getToolById(toolId);
    const quest = QUESTS[pz.topicId];
    ui.dialogKicker.textContent = topic?.titleKo ?? '사당';
    ui.dialogTitle.textContent = `${shrine.nameKo} 통과!`;
    ui.dialogBody.innerHTML = `
      <p class="prompt-line">${getShrinePuzzle(pz.topicId).lessonKo}</p>
      <p class="reflection" data-tool="true">${tool.emoji} 「${tool.nameKo}」 획득! ${tool.powerKo} 이제 「${quest.gateLabelKo}」로 가서 사용하세요.</p>
      <div class="finale-nav"><button type="button" class="finale-next" data-dialog-ok>좋아!</button></div>
    `;
    ui.dialogBody.querySelector('[data-dialog-ok]').addEventListener('click', () => closeDialog(game, ui));
    openDialog(game, ui);
    showToolCeremony(game, ui, tool, topic);
  }
}

function endShrinePuzzle(game, ui) {
  const pz = game.puzzle;
  if (!pz) {
    return;
  }
  for (const ped of pz.pedestals) {
    disposeDungeonRoom(ped.group, game.renderState.scene); // remove만 하면 지오메트리가 누수된다
  }
  if (pz.bellGroup) {
    disposeDungeonRoom(pz.bellGroup, game.renderState.scene);
  }
  game.puzzle = null;
  ui.root.classList.remove('is-combat');
  if (ui.actionLabel) {
    ui.actionLabel.textContent = 'A';
  }
  ui.puzzleHud.hidden = true;
  game.updateRotateHint?.();
}

// ===== 사당 던전: 문으로 들어가면 별도 퍼즐 맵이 로드되는 젤다식 방 =====
const DUNGEON_EXIT_RANGE = 0.8; // 셀 크기(1.2)보다 작아야 입장 스폰(한 칸 안)에서 즉시 퇴장되지 않는다
// 던전 진입 고유 한 줄(R-루프6) — 구역마다 다른 첫인상으로 반복감 제거.
const DUNGEON_ENTRY_LINE = {
  privacy: '🔒 비밀지기의 방 — 함부로 열린 상자들이 웅성인다',
  bias: '⚖️ 편향의 온실 — 한쪽으로만 기운 화분이 시들어 간다',
  copyright: '🎨 잊힌 아틀리에 — 이름표를 잃은 작품들이 떠돈다',
  deepfake: '🪞 거울의 방 — 진짜와 가짜가 뒤섞여 어른거린다'
};
const DUNGEON_PEDESTAL_RANGE = 1.6;
const DUNGEON_PUSH_COOLDOWN = 0.2;

// 사당 진입 라우터: 전용 던전 방이 있으면 별도 맵으로, 없으면 기존 오버레이 퍼즐로 폴백.
function enterShrineChallenge(game, ui, shrineId, topicId) {
  if (hasDungeonRoom(topicId)) {
    try {
      enterDungeon(game, ui, topicId, shrineId);
      return;
    } catch (error) {
      // 던전 로드 실패 시 조용히 오버레이 퍼즐로 되돌아간다(안전망).
      if (game.dungeon) {
        exitDungeon(game, ui);
      }
    }
  }
  startShrinePuzzle(game, ui, shrineId);
}

// 카메라를 목표 추종 위치로 즉시 스냅(섬→방 활공 방지). updateCamera의 상수와 반드시 일치.
function snapCamera(camera, target) {
  camera.position.set(target.x * 0.9, target.y + 11.5, target.z + 18.6);
  camera.lookAt(target.x, target.y + 1.35, target.z - 2.8);
}

function enterDungeon(game, ui, topicId, shrineId) {
  if (game.dungeon) {
    return;
  }
  const room = getDungeonRoom(topicId);
  const rs = game.renderState;
  const built = buildDungeonRoom(topicId, { makeLabel: createLabelSprite });
  rs.scene.add(built.root);
  rs.overworld.visible = false;
  // 배경/포그 스왑: 밝은 섬 → 어두운 방. 카메라가 ~16 거리라 안개는 방 너머에서만 끼게.
  rs.scene.fog = new THREE.Fog(0x161029, 24, 60);
  rs.renderer.setClearColor(0x120d20, 1);

  game.mode = 'dungeon';
  game.keys.clear();
  game.nearest = null;

  // 남쪽 입구 안쪽에서 시작(문 바로 위가 아니라 한 칸 안 — 입장 즉시 퇴장 방지).
  const spawnCell = [room.entry[0], Math.max(0, room.entry[1] - 1)];
  const spawn = cellToWorld(topicId, spawnCell);
  // A로 상호작용할 대상들(mechanic별) — 근접 판정용 월드 좌표를 미리 계산.
  const targets = [];
  for (const list of [room.dispensers, room.beds, room.exhibits, room.plates, room.mirrors]) {
    for (const t of list ?? []) {
      targets.push({ id: t.id, world: cellToWorld(topicId, t.cell) });
    }
  }
  game.dungeon = {
    active: true,
    topicId,
    shrineId,
    room,
    state: createRoomState(topicId),
    built,
    targets,
    bounds: built.bounds,
    exitWorld: cellToWorld(topicId, room.entry),
    pedestalWorld: cellToWorld(topicId, room.pedestal),
    returnPosition: game.player.position.clone(),
    solved: false,
    awarded: false,
    actionCooldown: 0,
    failedPlacements: 0,
    glowT: 0,
    resonateT: 0, // 🔔 공명 연출 남은 시간
    lensT: 0 // 🪞 진실의 렌즈 남은 시간
  };
  game.player.position.set(spawn.x, 0.55, spawn.z);
  game.player.direction.set(0, 0, -1); // 방 안쪽(북)을 바라봄
  rs.playerGroup.position.copy(game.player.position);
  rs.companion.position.copy(game.player.position).add(new THREE.Vector3(0.8, 1.2, 0));
  snapCamera(rs.camera, game.player.position);

  // 진입 훅 차별화(R-루프6): 구역마다 다른 색 플래시 + 고유 한 줄로 '같은 던전' 느낌을 지운다.
  const topic = getTopicById(topicId);
  triggerFlash(ui, topic?.color ?? '#ffffff');
  game.audio?.playClick();
  game.audio?.setMusicMode?.('dungeon'); // 신비로운 던전 BGM으로 크로스페이드
  ui.root.classList.add('is-combat'); // A 버튼 강조
  const entryLine = DUNGEON_ENTRY_LINE[topicId];
  if (entryLine) {
    window.setTimeout(() => flashCombatPopup(ui, entryLine, 'hit'), 260);
  }
  const ACTION_LABEL = { push: '밀기', carry: '잡기', beam: '돌리기' };
  const FIRST_HINT = {
    // 밀기 퍼즐은 상자가 구석에 끼면 못 풀 수 있다 — 재입장 리셋을 학생이 알게 명시.
    push: '상자 앞에 서서 A로 밀어요 · 상자가 끼었다면 빛 문으로 나갔다 오면 처음부터!',
    carry: '물건 앞에서 A로 집고, 놓을 곳에서 다시 A · 남쪽 빛 문으로 나가요',
    beam: '거울 앞에서 A로 돌려 빛의 길을 바꿔요 · 남쪽 빛 문으로 나가요'
  };
  if (ui.actionLabel) {
    ui.actionLabel.textContent = ACTION_LABEL[room.mechanic] ?? 'A';
  }
  ui.prompt.hidden = true;
  ui.puzzleHud.hidden = false;
  ui.puzzleTitle.textContent = `🧩 ${room.titleKo}`;
  ui.puzzleGoal.textContent = room.goalKo;
  ui.puzzleHint.textContent = FIRST_HINT[room.mechanic] ?? '';
  // 나침반을 얻었다면 밀기 방에서 '끌어당기기' 동사를 알려준다.
  if (room.mechanic === 'push' && (game.progress.tools ?? []).includes('compass')) {
    ui.puzzleHint.textContent += ' · 도구버튼(F) 🧭 끌어당기기';
  }
  // 초기 상태를 비주얼에 반영(빔 방은 초기 광선 경로 포함).
  syncDungeonVisuals(topicId, built, game.dungeon.state, {
    beam: room.mechanic === 'beam' ? computeBeamPath(topicId, game.dungeon.state) : undefined
  });
  game.updateRotateHint?.();
}

function exitDungeon(game, ui) {
  const dg = game.dungeon;
  if (!dg) {
    return;
  }
  const rs = game.renderState;
  removeHeldSprite(game); // 머리 위 들고 있던 아이템 표시 정리
  disposeDungeonRoom(dg.built.root, rs.scene);
  rs.overworld.visible = true;
  rs.scene.fog = rs.overworldFog;
  rs.renderer.setClearColor(0x0b1020, 1);

  game.mode = 'overworld';
  game.dungeon = null;
  game.keys.clear();
  game.audio?.setMusicMode?.('overworld'); // 섬 패드로 복귀

  const back = dg.returnPosition;
  game.player.position.copy(back);
  game.player.direction.set(0, 0, 1);
  rs.playerGroup.position.copy(back);
  rs.companion.position.copy(back).add(new THREE.Vector3(0.8, 1.2, 0));
  snapCamera(rs.camera, back);

  ui.root.classList.remove('is-combat');
  if (ui.actionLabel) {
    ui.actionLabel.textContent = 'A';
  }
  ui.puzzleHud.hidden = true;
  game.updateRotateHint?.();
}

// ── 항해 씬(잡음의 군도 바다) ─────────────────────────
// 던전과 같은 수명주기: 오버월드 Group을 숨기고 바다 루트를 lazy build → 귀항 시 dispose.

// 원형 경계 클램프(바다·확장 섬 공용).
function clampToRadius(position, radius) {
  const flatLength = Math.hypot(position.x, position.z);
  if (flatLength <= radius) {
    return position;
  }
  const scale = radius / flatLength;
  position.x *= scale;
  position.z *= scale;
  return position;
}

function clampToSea(position) {
  return clampToRadius(position, SEA_RADIUS);
}

function enterVoyage(game, ui, spawn) {
  // 부두(오버월드)와 확장 섬의 뗏목(isle) 두 곳에서 호출된다.
  if (game.voyage || game.dungeon || game.combat?.active) {
    return;
  }
  const rs = game.renderState;
  // 열린 섬 = 항로 지도의 '진행 중/완료'와 같은 판정(데이터 단일 출처).
  const states = new Map(getStageStates(game.progress).map((s) => [s.id, s.state]));
  const built = buildSeaScene({
    makeLabel: createLabelSprite,
    isOpen: (stage) => states.get(stage.id) === 'current' || states.get(stage.id) === 'completed'
  });
  rs.scene.add(built.root);
  rs.overworld.visible = false;
  // 밤바다 톤: 안개는 먼 섬 실루엣이 어스름하게 남을 만큼만.
  rs.scene.fog = new THREE.Fog(0x0a0e26, 55, 130);
  rs.renderer.setClearColor(0x080b20, 1);

  game.mode = 'voyage';
  // 다음 목적지: 항로 순서상 첫 '진행 중' 섬 — 전부 완료면 시작의 섬(귀항)을 가리킨다.
  const destStage = getStageStates(game.progress).find((s) => s.state === 'current')
    ?? getStageById('prologue');
  const destSea = seaWorldPosition(destStage);
  game.voyage = {
    built,
    nearestIsland: null,
    dest: { id: destStage.id, nameKo: destStage.nameKo, emoji: destStage.emoji, x: destSea.x, z: destSea.z },
    returnPosition: new THREE.Vector3(DOCK_POS.x, 0.55, DOCK_POS.z - 1.8),
    walkSpeed: game.player.speed
  };
  game.keys.clear();
  game.player.speed = 7.4; // 뗏목은 걷기보다 조금 빠르게
  if (spawn) {
    game.player.position.set(spawn.x, 0.78, spawn.z);
  } else {
    game.player.position.set(0, 0.78, 9); // 시작의 섬 실루엣 남쪽 바다
  }
  game.player.direction.set(0, 0, -1);
  rs.playerGroup.position.copy(game.player.position);
  rs.companion.position.copy(game.player.position).add(new THREE.Vector3(0.8, 1.2, 0));
  snapCamera(rs.camera, game.player.position);

  triggerFlash(ui, '#bcd8ff');
  game.audio?.playClick();
  game.audio?.setMusicMode?.('voyage'); // 밤바다 패드 + 별빛 선율(루프4)
  ui.prompt.hidden = true;
  ui.puzzleHud.hidden = false;
  ui.puzzleTitle.textContent = '🌊 H-17 증거 항로';
  ui.puzzleGoal.textContent = '삭제 명령서 조각이 가리키는 보관소를 따라가세요 · 기록 관리 섬에 다가가면 귀항';
  ui.puzzleHint.textContent = `금빛 화살표를 따라가요 — ${game.voyage.dest.emoji} ${game.voyage.dest.nameKo}`;
  game.updateRotateHint?.();

  // 첫 출항 — 2장의 코어 균열과 3장을 잇는 브리지 서사(1회).
  if (!game.progress.voyageIntroSeen) {
    game.progress = { ...game.progress, voyageIntroSeen: true };
    persistProgress(game.progress);
    ui.dialogKicker.textContent = '3장 · 웃음이 만든 폭풍';
    ui.dialogTitle.textContent = '✨ 도트';
    ui.dialogBody.innerHTML = speechHtml([
      '"삭제 명령서는 세 갈래로 찢어졌어. 말이 퍼진 경로, 추천이 갈라진 경로, 사람이 검토를 포기한 기록이야."',
      '"하루는 조작 영상 하나만으로 사라진 게 아니야. 웃고 공유하고 자동 승인한 수많은 작은 선택이 화이트아웃을 완성했어."',
      '"누구 한 명을 쓰러뜨리는 항해가 아니야. 결정이 만들어진 길을 끝까지 되짚어 보자."'
    ]);
    openDialog(game, ui);
  }
}

function exitVoyage(game, ui) {
  const vg = game.voyage;
  if (!vg) {
    return;
  }
  const rs = game.renderState;
  disposeDungeonRoom(vg.built.root, rs.scene); // 범용 트래버스 dispose 재사용
  rs.overworld.visible = true;
  rs.scene.fog = rs.overworldFog;
  rs.renderer.setClearColor(0x0b1020, 1);

  game.mode = 'overworld';
  game.voyage = null;
  game.keys.clear();
  game.player.speed = vg.walkSpeed;
  game.audio?.setMusicMode?.('overworld');

  const back = vg.returnPosition;
  game.player.position.copy(back);
  game.player.direction.set(0, 0, -1);
  rs.playerGroup.position.copy(back);
  rs.companion.position.copy(back).add(new THREE.Vector3(0.8, 1.2, 0));
  snapCamera(rs.camera, back);

  triggerFlash(ui, '#ffffff');
  ui.puzzleHud.hidden = true;
  game.updateRotateHint?.();

  // 조사를 마치고 돌아왔다면 — 부두 옆 수신기에 하루의 감사 신호가 기다린다.
  if (getUnreadNovaLetters(game.progress).length > 0) {
    flashCombatPopup(ui, '📼 부두 수신기에 H-17 감사 신호가 도착했어요!', 'match');
  }
}

function updateVoyage(delta, game, ui) {
  const vg = game.voyage;
  const elapsed = clock.elapsedTime;
  // 뗏목이 플레이어를 태우고 물결 따라 흔들린다(결정적 사인파).
  const raft = vg.built.raft;
  raft.position.set(game.player.position.x, 0.18 + Math.sin(elapsed * 1.7) * 0.07, game.player.position.z);
  raft.rotation.y = game.renderState.playerGroup.rotation.y;
  raft.rotation.z = Math.sin(elapsed * 1.3) * 0.04;
  // 달빛 물결 일렁임.
  vg.built.waterMat.emissiveIntensity = 0.55 + Math.sin(elapsed * 0.8) * 0.08;

  // 데이터 해류(Z3) — 열린 항로를 따라 빛 입자가 흐른다(결정적: elapsed + 인덱스 위상).
  const currents = vg.built.currents;
  if (currents) {
    const pos = currents.points.geometry.attributes.position;
    currents.segments.forEach((seg, s) => {
      for (let j = 0; j < currents.perSegment; j += 1) {
        const t = (elapsed * 0.055 + j / currents.perSegment + s * 0.37) % 1;
        const idx = s * currents.perSegment + j;
        pos.setXYZ(
          idx,
          seg.ax + (seg.bx - seg.ax) * t,
          0.4 + Math.sin(elapsed * 2.1 + j * 1.7) * 0.14,
          seg.az + (seg.bz - seg.az) * t
        );
      }
    });
    pos.needsUpdate = true;
  }
  // 해류 줄무늬 — 자기 방향으로 흘러가며 사인 페이드로 나타났다 사라진다.
  for (const streak of vg.built.streaks ?? []) {
    const { baseX, baseZ, dirX, dirZ, phase } = streak.userData;
    const drift = ((elapsed * 1.15 + phase * 9) % 30) - 15;
    streak.position.x = baseX + dirX * drift;
    streak.position.z = baseZ + dirZ * drift;
    streak.material.opacity = 0.07 + 0.09 * (1 + Math.sin(elapsed * 0.55 + phase)) * 0.5;
  }
  // 접속 링 — 연결된 섬이 숨 쉬듯 맥동.
  (vg.built.connectRings ?? []).forEach((ring, i) => {
    const s = 1 + Math.sin(elapsed * 1.6 + i * 1.1) * 0.05;
    ring.scale.set(s, s, 1);
    ring.material.opacity = 0.42 + (1 + Math.sin(elapsed * 1.6 + i * 1.1)) * 0.11;
  });

  // 조망 중엔 안개를 밀어 군도 전체가 보이게 한다(복귀하면 원래 실루엣 무드로).
  const fog = game.renderState.scene.fog;
  if (fog) {
    const ovBlend = game.overviewT;
    fog.near = 55 + ovBlend * 90;
    fog.far = 130 + ovBlend * 160;
  }

  // 가이드 화살표 — 뗏목 위에서 목적지를 가리키며 둥실거린다. 다가가면 조용히 사라진다.
  const arrow = vg.built.guideArrow;
  if (arrow && vg.dest) {
    const dx = vg.dest.x - game.player.position.x;
    const dz = vg.dest.z - game.player.position.z;
    const destDistance = Math.hypot(dx, dz);
    if (destDistance > SEA_APPROACH + 2) {
      arrow.visible = true;
      arrow.position.set(game.player.position.x, 3.3 + Math.sin(elapsed * 2.2) * 0.18, game.player.position.z);
      arrow.rotation.y = Math.atan2(dx, dz);
    } else {
      arrow.visible = false;
    }
  }

  // 가까운 섬 안내 — 열린 섬은 상륙(귀항), 안개 섬은 거부 안내.
  const island = nearestSeaIsland(game.player.position.x, game.player.position.z, SEA_SCALE, SEA_APPROACH);
  vg.nearestIsland = island;
  if (island) {
    const open = vg.built.islands.find((item) => item.stage.id === island.id)?.open;
    ui.prompt.hidden = false;
    ui.prompt.textContent = open
      ? `${ACTION_LABEL}${island.id === 'prologue' ? `${island.nameKo}으로 귀항` : `${island.nameKo} 상륙`}`
      : `🌫️ ${island.nameKo} — 안개가 짙어 아직 들어갈 수 없어요`;
  } else if (IS_TOUCH) {
    ui.prompt.hidden = true;
  } else {
    ui.prompt.hidden = false;
    ui.prompt.textContent = '🌊 방향키로 항해 · 섬에 다가가면 안내가 떠요';
  }
}

function voyageAction(game, ui) {
  const vg = game.voyage;
  const island = vg?.nearestIsland;
  if (!island) {
    return;
  }
  const open = vg.built.islands.find((item) => item.stage.id === island.id)?.open;
  if (!open) {
    game.audio?.playWrong();
    flashCombatPopup(ui, '🌫️ 안개가 걷히지 않았다…', 'miss');
    return;
  }
  if (island.id === 'prologue') {
    game.audio?.playClick();
    exitVoyage(game, ui);
    return;
  }
  if (ISLE_SCENES[island.id]) {
    game.audio?.playClick();
    enterIsle(game, ui, island.id);
  }
  // 아직 씬이 없는 열린 섬은 없어야 정상 — built:true는 ISLE_SCENES 등록과 함께 뒤집는다.
}

// 하루의 감사 신호 — 각 보관소 조사 뒤 수신기에 복구된다.
// 저장 키는 v2 세이브 호환을 위해 novaLettersRead를 유지한다.
const HARU_SIGNAL_ORDER = ['whisper-cape', 'echo-cave', 'hourglass-port', 'memory-core'];
const HARU_SIGNALS = {
  'whisper-cape': [
    '하루의 감사 기록 03. “처음엔 내 발표 실수를 놀리는 짧은 농담이었어.”',
    '좋아요와 웃음 반응이 붙을수록 추천 시스템은 더 많은 사람에게 보여 줬고, 원래 맥락은 잘려 나갔다.',
    '“직접 악플을 쓰지 않은 사람도 웃고 전달하는 방식으로 폭풍에 바람을 보탰어.”'
  ],
  'echo-cave': [
    '하루의 감사 기록 04. “내 화면에는 내 편이 되어 주는 글만, 다른 친구 화면에는 나를 유죄라 말하는 글만 떴어.”',
    '같은 사건을 본 줄 알았지만 우리는 서로 다른 증거 꾸러미를 보고 있었다.',
    '“추천은 진실을 판정하지 않아. 오래 머물게 할 다음 화면을 고를 뿐이야.”'
  ],
  'hourglass-port': [
    '하루의 감사 기록 05. “선생님도 위원회도 루멘 점수가 맞을 거라 생각하고 승인 버튼을 눌렀어.”',
    '공지문은 AI가 만들고 사람 이름으로 게시됐지만, 누가 사실을 확인했는지 기록되지 않았다.',
    '“AI가 추천해도 결정 버튼을 누르는 사람은 멈춰서 이유를 확인해야 해.”'
  ],
  'memory-core': [
    '하루의 생방송. “내 이름이 다시 명단에 생겼어. 하지만 더 중요한 건 누구든 결정의 이유를 물을 수 있게 된 거야.”',
    '“루멘은 이제 모르면 모른다고 말하고, 중요한 결정은 사람이 다시 검토해. 나도 다음 감사 회의에 학생 대표로 참여할 거야.”',
    '— 섬으로 돌아오는 배에서, 하루',
    '📼 도트: “이건 복구된 과거가 아니야. 우리가 바꾼 다음 기록이야.”'
  ]
};

// 에필로그 별똥별 — 하루의 귀환 메시지를 읽으면 새 항로의 불빛이 하늘을 가로지른다.
// 경로·시차 전부 인덱스 기반 상수(결정적). 1회성 메시 6개, 끝나면 dispose.
function triggerStarShower(game) {
  const rs = game.renderState;
  if (!rs || rs.starShower?.active) {
    return;
  }
  const group = new THREE.Group();
  const stars = [];
  for (let i = 0; i < 6; i += 1) {
    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5, 0),
      new THREE.MeshBasicMaterial({ color: 0xffb648, transparent: true, opacity: 1 })
    );
    star.scale.set(2.4, 0.8, 0.8); // 진행 방향(-x)으로 길게 — 별똥별 꼬리 느낌

    star.userData.start = new THREE.Vector3(18 - i * 4.8, 21 + (i % 3) * 2.2, -34 + i * 3);
    star.userData.delay = i * 0.55;
    star.visible = false;
    group.add(star);
    stars.push(star);
  }
  rs.overworld.add(group);
  rs.starShower = { active: true, t: 0, group, stars };
}

// 치유는 끝났는데 아직 안 읽은 편지(항로 순서).
function getUnreadNovaLetters(progress) {
  const read = new Set(progress.novaLettersRead ?? []);
  return HARU_SIGNAL_ORDER.filter(
    (stageId) => progress.stages?.[stageId]?.completed === true && !read.has(stageId)
  );
}

// ── 확장 섬(스테이지) 상륙 ─────────────────────────────
// 항해 → 섬 지형 씬. 던전·바다와 같은 수명주기(lazy build → dispose).
// 섬별 연출 데이터(톤·문구·대화) — 지오메트리는 isle.js의 ISLE_SCENES가 담당.
const ISLE_CONTENT = {
  'whisper-cape': {
    fog: [0x9aa7bd, 30, 80],
    clearColor: 0x93a2b8,
    flash: '#e8eef8',
    goalKo: '확산 기록관에게 하루의 게시물이 퍼진 경로를 물어보세요',
    healedGoalKo: '조롱 확산 경로를 끊고 피해 회복 기록을 남겼습니다',
    arrivalKo: [
      '"확산 기록 곶에 도착했어. 검은 말-화살 하나하나가 하루의 발표 실수를 잘라 만든 게시물이야."',
      '"누가 처음 썼는지만 찾으면 끝나는 사건이 아니야. 누가 웃고, 복사하고, 추천했는지 전체 경로를 확인하자."'
    ],
    spiritNameKo: '🕊️ 확산 기록관 새봄',
    spiritSickKo: [
      '"하루를 놀린 첫 글은 열 명만 봤어. 하지만 웃음 반응이 붙자 추천기가 천 명에게 밀어 보냈지."',
      '"직접 욕하지 않았다는 이유로 아무도 책임지지 않았고, 삭제 뒤에도 캡처와 복사본이 남았어."',
      '"말-화살 회랑에서 확산 장치를 막고, 갯벌에 남은 복사본까지 회복 순서대로 처리해 줘."'
    ],
    spiritHealedKo: [
      '"확산 장치가 멈췄어. 이제 하루가 원하면 게시물의 도달 기록과 삭제 요청 결과를 확인할 수 있어."',
      '"상처 난 기록은 지우는 것만으로 끝나지 않아. 확산을 멈추고, 피해를 인정하고, 회복을 도와야 해."'
    ],
    spiritRevisitKo: [
      '"지금은 게시물마다 최초 작성, 복사, 추천 확산이 따로 표시돼. 책임을 한 사람에게만 떠넘기지 않으려고."',
      '"반응 버튼을 누르기 전에도 묻자. 이 반응이 누군가를 더 많은 화면 앞에 세우지는 않을까?"'
    ]
  },
  'echo-cave': {
    fog: [0x2b3552, 26, 72],
    clearColor: 0x232c46,
    flash: '#bcd0ff',
    goalKo: '추천 감사관에게 두 개로 갈라진 사건 화면을 확인하세요',
    healedGoalKo: '추천 경로 밖의 원본과 반대 증거를 복구했습니다',
    arrivalKo: [
      '"추천 분기 해협이야. 왼쪽 벽에는 하루를 범인이라 하는 글만, 오른쪽 벽에는 하루를 옹호하는 글만 반복돼."',
      '"사람들은 같은 사건을 봤다고 생각했지만 실제로는 서로 다른 증거 화면 안에 갇혀 있었어."'
    ],
    spiritNameKo: '🐋 추천 감사관 파도',
    spiritSickKo: [
      '"내 화면은 하루가 유죄라는 글로 가득했어. 반대 증거는 클릭할 가능성이 낮다는 이유로 가라앉았지."',
      '"같은 주장이 많이 보이는 것과 서로 다른 출처가 같은 사실을 확인한 것은 달라."',
      '"출처의 종으로 최초 기록을 찾고, 거울로 추천 경로 밖의 다른 관점까지 열어 줘."'
    ],
    spiritHealedKo: [
      '"두 화면을 함께 보니 빠졌던 사실이 보여. 하루의 영상에는 원본이 없고, 이의제기서는 추천에서 숨겨졌어."',
      '"추천은 다음에 볼 것을 고를 뿐, 사실과 거짓을 판결하는 재판관이 아니야."'
    ],
    spiritRevisitKo: [
      '"지금 감사판은 왜 이 글이 추천됐는지, 어떤 관점이 빠졌는지 함께 보여 줘."',
      '"내가 좋아할 말뿐 아니라 내가 놓쳤을 근거도 일부러 찾아보는 버튼을 만들었어."'
    ]
  },
  'hourglass-port': {
    fog: [0x4a3a5c, 28, 75],
    clearColor: 0x443655,
    flash: '#ffd8b0',
    goalKo: '자동 승인관에게 H-17 제재 결정이 통과된 과정을 확인하세요',
    healedGoalKo: 'AI 추천과 사람의 승인 책임을 구분해 기록했습니다',
    arrivalKo: [
      '"자동 결정 항구야. 루멘이 만든 공지와 점수가 밤새 쌓이는데, 사람들은 확인하지 않고 승인 도장만 찍고 있어."',
      '"하루의 섬 밖 이동 명령도 이곳에서 3초 만에 통과됐어. 누가 무엇을 검토했는지 찾아보자."'
    ],
    spiritNameKo: '🐢 자동 승인관 마루',
    spiritSickKo: [
      '"루멘 점수가 높으면 승인, 낮으면 통과. 그렇게 하면 빠르고 공정한 줄 알았어."',
      '"그런데 H-17 결정에는 원본 영상 확인도, 당사자 설명도, 사람의 재검토도 없었어."',
      '"모래시계를 바로 세워 자동 승인을 멈추고, 부두 화물의 사람 제작·AI 도움·AI 생성 기록을 구분해 줘."'
    ],
    spiritHealedKo: [
      '"처음으로 승인 전에 이유를 읽었어. 빠른 결정이 좋은 결정과 같은 뜻은 아니었네."',
      '"이제 중요한 제재에는 당사자 통지, 사람의 재검토, 이의제기 시간을 반드시 남길게."'
    ],
    spiritRevisitKo: [
      '"AI 도움을 받은 공지에는 그 사실과 최종 확인자를 함께 표시하고 있어."',
      '"자동화는 책임을 없애는 장치가 아니라, 사람이 더 중요한 판단에 시간을 쓰게 돕는 장치여야 해."'
    ]
  },
  'memory-outer': {
    fog: [0x241c38, 26, 72],
    clearColor: 0x1c1630,
    flash: '#e8b8d8',
    goalKo: '감사 기록 보관소에서 삭제 승인자 네 명의 봉인을 해제하세요',
    healedGoalKo: '승인 기록이 복구됐습니다 — 공개 심리실이 열립니다',
    arrivalKo: [
      '"감사 기록 보관소야. 네 개의 봉인은 개인정보, 점수표, 제작 이력, 원본 검증 기록을 각각 잠그고 있어."',
      '"화이트아웃은 승인자 이름을 없애려 하지만, 우리가 모은 네 도구라면 필요한 증거만 안전하게 열 수 있어."'
    ],
    spiritNameKo: '💠 감사 기록 보관소',
    spiritSickKo: [
      '"감사 요청 H-17을 확인했습니다. 삭제 승인 기록은 네 개의 분리 봉인 안에 있습니다."',
      '"각 봉인은 약속 도구로만 열립니다. 빛이 가장 환한 순간, 필요한 정보만 선택해 복구하세요."',
      '"서두르면 관련 없는 학생들의 비밀까지 노출됩니다. 정확한 순간에 정확한 도구를 사용하세요."',
      '"최종 기록에는 루멘의 계산뿐 아니라 그 계산을 검토하고 서명한 사람들의 이름도 남아 있습니다."'
    ],
    spiritHealedKo: [
      '"네 봉인이 모두 풀렸습니다. 공개 심리실로 전송할 증거 묶음이 준비됐습니다."',
      '"민감정보는 보호됐고, 결정의 근거와 승인 과정은 누구나 검증할 수 있습니다."'
    ],
    spiritRevisitKo: [
      '"감사 기록은 누군가를 망신주기 위해서가 아니라 같은 오판을 반복하지 않기 위해 남깁니다."'
    ]
  },
  'memory-core': {
    fog: [0x120d20, 22, 60],
    clearColor: 0x0e0a18,
    flash: '#d8a8c8',
    goalKo: '화이트아웃의 마지막 삭제 명령을 중지하고 공개 심리를 여세요',
    healedGoalKo: 'H-17 사건이 바로잡혔습니다 — 하루의 이름과 이의제기권이 돌아왔습니다',
    arrivalKo: [
      '"공개 심리실이야. 저 흰 덩어리가 모든 증거를 다시 빈 문서로 만들려는 화이트아웃 핵심 프로토콜이야."',
      '"우리가 배운 네 가지 확인 도구로 삭제 껍질을 벗기고, 그 안의 승인 기록을 심리대에 올리자."'
    ],
    spiritNameKo: '⬜ 화이트아웃 핵심',
    spiritSickKo: ['"갈등 없는 상태를 유지합니다. 반대 기록을 삭제합니다."'],
    spiritHealedKo: ['"자동 삭제를 중지합니다. 인간의 재검토와 이의제기 절차를 시작합니다."']
  }
};

function enterIsle(game, ui, stageId) {
  // 바다에서 상륙하거나, 다른 섬의 관문에서 직행한다(심부).
  if (game.isle?.stageId === stageId || (!game.voyage && !game.isle)) {
    return;
  }
  const rs = game.renderState;
  const stage = getStageById(stageId);
  if (game.voyage) {
    const vg = game.voyage;
    disposeDungeonRoom(vg.built.root, rs.scene);
    game.voyage = null;
    game.player.speed = vg.walkSpeed;
  } else {
    disposeDungeonRoom(game.isle.built.root, rs.scene);
    game.isle = null;
  }

  const healed = game.progress.stages?.[stageId]?.completed === true;
  const content = ISLE_CONTENT[stageId];
  const built = ISLE_SCENES[stageId]({ makeLabel: createLabelSprite, healed });
  rs.scene.add(built.root);
  // 섬 고유 톤 — 안개는 섬 너머 바다에만.
  rs.scene.fog = new THREE.Fog(...content.fog);
  rs.renderer.setClearColor(content.clearColor, 1);

  game.mode = 'isle';
  game.isle = {
    built,
    stageId,
    nearestSpot: null,
    nearestFollowup: null,
    challenge: null,
    followup: null,
    guard: 0,
    guardCd: 0,
    bellCd: 0,
    ringT: 0,
    pullCd: 0
  };
  game.keys.clear();
  game.player.position.set(-3.4, 0.55, 9.4); // 뗏목 옆 물가
  game.player.direction.set(0, 0, -1);
  rs.playerGroup.position.copy(game.player.position);
  rs.companion.position.copy(game.player.position).add(new THREE.Vector3(0.8, 1.2, 0));
  snapCamera(rs.camera, game.player.position);

  triggerFlash(ui, content.flash);
  ui.root.classList.add('is-isle'); // 터치 동사 버튼(F) 표시 — 섬 도전의 필수 입력
  ui.prompt.hidden = true;
  ui.puzzleHud.hidden = false;
  ui.puzzleTitle.textContent = `${stage.emoji} ${stage.nameKo}`;
  ui.puzzleGoal.textContent = healed ? content.healedGoalKo : content.goalKo;
  // 막 상륙한 학생에게는 '나가는 법'보다 목표(정령에게 말 걸기)를 먼저 안내한다.
  ui.puzzleHint.textContent = healed
    ? '뗏목으로 돌아가면 다시 바다로'
    : '정령에게 다가가 A로 말을 걸어요 · 뗏목으로 돌아가면 바다로';
  game.updateRotateHint?.();

  // 심부: 잔영이 남아 있으면 도착과 동시에 리매치가 시작된다(패배 연출 단계).
  if (stageId === 'memory-core' && !healed) {
    game.isle.challenge = createResidueState();
    ui.puzzleGoal.textContent = '화이트아웃의 삭제 껍질에 맞는 감사 도구(F)를 사용하세요';
    ui.puzzleHint.textContent = '';
  }

  // 첫 상륙에만 도착 서사를 튼다(세이브 v2 visited 신호).
  if (!game.progress.stages?.[stageId]?.visited) {
    game.progress = markStageVisited(game.progress, stageId);
    persistProgress(game.progress);
    ui.dialogKicker.textContent = `${stage.emoji} ${stage.nameKo}`;
    ui.dialogTitle.textContent = '✨ 도트';
    ui.dialogBody.innerHTML = speechHtml(content.arrivalKo);
    openDialog(game, ui);
  }
}

function exitIsle(game, ui) {
  const isle = game.isle;
  if (!isle) {
    return;
  }
  const rs = game.renderState;
  const stage = getStageById(isle.stageId);
  disposeDungeonRoom(isle.built.root, rs.scene);
  game.isle = null;
  game.mode = 'overworld'; // enterVoyage가 곧바로 'voyage'로 바꾼다
  ui.root.classList.remove('is-isle');
  ui.puzzleHud.hidden = true;
  // 섬 실루엣 남쪽 바다에서 항해 재개.
  const sea = seaWorldPosition(stage);
  enterVoyage(game, ui, { x: sea.x, z: sea.z + SEA_APPROACH + 1.5 });
}

function updateIsle(delta, game, ui) {
  const isle = game.isle;
  const elapsed = clock.elapsedTime;
  // 병든 정령의 숨: 몸이 느리게 부풀었다 꺼지고, 잡음 위스프가 주위를 돈다.
  const spirit = isle.built.spirit;
  spirit.scale.y = 1 + Math.sin(elapsed * 1.4) * 0.03;
  isle.built.wisps?.forEach((wisp, i) => {
    const angle = elapsed * (0.8 + i * 0.25) + i * 2.1;
    wisp.position.set(Math.cos(angle) * 1.1, 1.5 + Math.sin(elapsed * 2 + i) * 0.25, Math.sin(angle) * 1.1);
  });
  // 씬 전용 유휴 애니메이션(메아리 링·결정 등).
  isle.built.animate?.(delta, elapsed);
  // 발사대 소용돌이 회전(부서지면 숨김) — 회랑이 있는 섬에만 존재.
  isle.built.vortexes?.forEach((vortex, emitterId) => {
    if (isle.challenge?.broken[emitterId]) {
      vortex.visible = false;
      return;
    }
    vortex.rotation.y += delta * 2.4;
    vortex.rotation.x = Math.sin(elapsed * 1.6) * 0.4;
  });

  // 방패 가드·종 쿨다운 타이머.
  if (isle.guard > 0) {
    isle.guard = Math.max(0, isle.guard - delta);
  }
  if (isle.guardCd > 0) {
    isle.guardCd = Math.max(0, isle.guardCd - delta);
  }
  if (isle.bellCd > 0) {
    isle.bellCd = Math.max(0, isle.bellCd - delta);
  }
  if (isle.pullCd > 0) {
    isle.pullCd = Math.max(0, isle.pullCd - delta);
  }

  // 모래시계 사구 도전(모래시계 항구) — 흔들림 구동.
  if (isle.stageId === 'hourglass-port' && isle.challenge && !isle.challenge.cleared) {
    tickDunes(isle.challenge, delta);
    isle.built.hourglasses.forEach((hourglass, glassId) => {
      hourglass.rotation.z = glassAngle(isle.challenge, glassId);
    });
  }

  // 공개 심리실 화이트아웃 중지전 — 공격 자세 게이지 구동.
  if (isle.stageId === 'memory-core' && isle.challenge && isle.challenge.stage === 'fight') {
    tickResidue(isle.challenge, delta);
    const gauge = windupGauge(isle.challenge);
    const phase = RESIDUE.phases[isle.challenge.phase];
    const boss = isle.built.boss;
    // 절정에 가까울수록 그 동사의 색으로 달아오르고 몸을 부풀린다.
    isle.built.bossMat.emissive.setHex(gauge > 0.6 ? phase.color : 0x4a1a2c);
    isle.built.bossMat.emissiveIntensity = 0.4 + gauge * 0.9;
    boss.scale.setScalar(1 + gauge * 0.22);
  }

  // 4봉인 도전(감사 기록 보관소) — 봉인석 빛 맥동 구동.
  if (isle.stageId === 'memory-outer' && isle.challenge && !isle.challenge.cleared) {
    tickHeart(isle.challenge, delta);
    isle.built.sealOrbs.forEach((orb, sealId) => {
      const pulse = sealPulse(isle.challenge, sealId);
      const released = isle.challenge.released[sealId];
      orb.material.emissiveIntensity = released ? 1.0 : 0.25 + pulse * 1.15;
      orb.rotation.y += delta * (released ? 0.4 : 1.6);
      orb.scale.setScalar(released ? 1.15 : 0.9 + pulse * 0.3);
    });
  }

  // 소문의 벽 도전(메아리 동굴) — 판별 창 감쇠 + 돌·울림 링 연출.
  if (isle.stageId === 'echo-cave' && isle.challenge && !isle.challenge.cleared) {
    tickRumor(isle.challenge, delta);
    const reveal = isle.challenge.revealT > 0;
    isle.built.rumorStones.forEach((stone, stoneId) => {
      const echo = isEchoStone(isle.challenge, stoneId);
      if (reveal) {
        // 메아리 돌은 부르르, 원본 돌은 금빛으로 굳건.
        stone.rotation.z = echo ? Math.sin(elapsed * 22 + stone.position.z * 3) * 0.09 : 0;
        stone.material.emissive.setHex(echo ? 0x2c2440 : 0x8a6c20);
        stone.material.emissiveIntensity = echo ? 0.6 : 1.1;
      } else {
        stone.rotation.z = 0;
        stone.material.emissive.setHex(0x2c2440);
        stone.material.emissiveIntensity = 0.6;
      }
    });
    if (isle.ringT > 0) {
      isle.ringT = Math.max(0, isle.ringT - delta);
      const t = 1 - isle.ringT / 0.6;
      const ring = isle.built.bellRing;
      ring.scale.set(1 + t * 10, 1 + t * 10, 1);
      ring.material.opacity = 0.7 * (1 - t);
      ring.visible = isle.ringT > 0;
    }
  }

  // 회랑 도전 진행(속삭임 곶).
  if (isle.stageId === 'whisper-cape' && isle.challenge && !isle.challenge.cleared) {
    const events = stepCorridor(
      isle.challenge,
      delta,
      { x: game.player.position.x, z: game.player.position.z },
      isle.guard > 0
    );
    for (const event of events) {
      if (event === 'fired') {
        game.audio?.playNoiseGroan();
      } else if (event === 'deflected-perfect') {
        // 완벽 반사(숙련 보상) — 더 밝은 연출·강한 진동·연속 카운트.
        isle.perfectStreak = (isle.perfectStreak ?? 0) + 1;
        game.audio?.playCorrect();
        game.audio?.playCollect();
        celebrate(game, new THREE.Vector3(game.player.position.x, 1.4, game.player.position.z), '#ffe066', 'collect');
        addShake(game, 0.18);
        triggerHaptic([15, 25, 40]);
        const streak = isle.perfectStreak > 1 ? ` (${isle.perfectStreak}연속!)` : '';
        flashCombatPopup(ui, `🌟 완벽 반사!${streak}`, 'win');
      } else if (event === 'deflected') {
        isle.perfectStreak = 0;
        game.audio?.playCorrect();
        flashCombatPopup(ui, '🛡️ 반사! 화살이 주인에게 돌아간다', 'match');
      } else if (event === 'hit') {
        game.audio?.playWrong();
        addShake(game, 0.3);
        flashCombatPopup(ui, '따끔! 화살이 가까울 때 방패(F)!', 'miss');
      } else if (event === 'broken') {
        game.audio?.playCollect();
        flashCombatPopup(ui, '💥 발사대가 부서졌다!', 'match');
      } else if (event === 'cleared') {
        finishCorridor(game, ui);
      }
    }
    // 화살 메시 동기화.
    const arrowMesh = isle.built.arrowMesh;
    const arrow = isle.challenge.arrow;
    if (arrow) {
      arrowMesh.visible = true;
      arrowMesh.position.set(arrow.x, 1.15, arrow.z);
      arrowMesh.rotation.set(Math.PI / 2, 0, -Math.atan2(arrow.dx, arrow.dz));
    } else {
      arrowMesh.visible = false;
    }
  }

  // 3–5장 후속 공간 퍼즐 — 해결된 오브젝트는 금빛으로 고정하고 남은 지점을 맥동시킨다.
  if (isle.followup && !isle.followup.cleared) {
    if (isle.stageId === 'whisper-cape') {
      isle.built.footprintMarks?.forEach((marker, actionId) => {
        if (!isle.followup.resolved[actionId]) {
          const pulse = 1 + Math.sin(elapsed * 2.2 + marker.userData.index) * 0.08;
          marker.scale.setScalar(pulse);
        }
      });
    } else if (isle.stageId === 'echo-cave') {
      isle.built.sourceWindows?.forEach((frame, sourceId) => {
        if (!isle.followup.verified[sourceId]) {
          frame.position.y = frame.userData.baseY + Math.sin(elapsed * 1.8 + frame.position.z) * 0.08;
        }
      });
    } else if (isle.stageId === 'hourglass-port') {
      isle.built.cargoStamps?.forEach((stamp, crateId) => {
        stamp.rotation.y += delta * (isle.followup.labels[crateId] === 'unknown' ? 1.6 : 0.7);
        stamp.position.y = 1.5 + Math.sin(elapsed * 2 + stamp.position.z) * 0.08;
      });
    }
  }

  // 씬 로컬 상호작용 안내(정령·뗏목).
  let nearestSpot = null;
  let nearestDistance = INTERACTION_RADIUS;
  for (const spot of isle.built.interactables) {
    const distance = Math.hypot(game.player.position.x - spot.x, game.player.position.z - spot.z);
    if (distance < nearestDistance) {
      nearestSpot = spot;
      nearestDistance = distance;
    }
  }
  isle.nearestSpot = nearestSpot;
  isle.nearestFollowup = null;
  if (isle.followup && !isle.followup.cleared) {
    if (isle.stageId === 'whisper-cape') {
      isle.nearestFollowup = nearestFootprintAction(
        isle.followup,
        game.player.position.x,
        game.player.position.z
      );
    } else if (isle.stageId === 'echo-cave') {
      isle.nearestFollowup = nearestBubbleSource(
        isle.followup,
        game.player.position.x,
        game.player.position.z
      );
    } else if (isle.stageId === 'hourglass-port') {
      isle.nearestFollowup = nearestCargoCrate(
        game.player.position.x,
        game.player.position.z
      );
    }
  }
  if (!ui.dialog.hidden) {
    return;
  }
  if (isle.nearestFollowup) {
    const action = isle.nearestFollowup;
    ui.prompt.hidden = false;
    if (isle.stageId === 'echo-cave') {
      ui.prompt.textContent = `F · 🪞 ${action.labelKo} 비추기`;
    } else if (isle.stageId === 'hourglass-port') {
      ui.prompt.textContent = `${ACTION_LABEL}${action.titleKo} 라벨 바꾸기`;
    } else {
      ui.prompt.textContent = `${ACTION_LABEL}${action.labelKo}`;
    }
  } else if (nearestSpot) {
    ui.prompt.hidden = false;
    ui.prompt.textContent = `${ACTION_LABEL}${nearestSpot.labelKo}`;
  } else if (IS_TOUCH) {
    ui.prompt.hidden = true;
  } else {
    ui.prompt.hidden = false;
    ui.prompt.textContent = '방향키로 곶을 둘러보세요';
  }
}

function isleAction(game, ui) {
  if (!game.isle || !ui.dialog.hidden) {
    return;
  }
  if (game.isle.followup && !game.isle.followup.cleared && game.isle.nearestFollowup) {
    if (game.isle.stageId === 'whisper-cape') {
      footprintResolve(game, ui);
    } else if (game.isle.stageId === 'echo-cave') {
      game.audio?.playClick();
      flashCombatPopup(ui, '🪞 거울(F/도구버튼)로 이 자료를 비춰 확인해요', 'match');
    } else if (game.isle.stageId === 'hourglass-port') {
      cargoCycle(game, ui);
    }
    return;
  }
  // 소문의 벽 도전 중: 돌 앞에서 A = 그 돌을 원본으로 지목.
  if (game.isle.stageId === 'echo-cave' && game.isle.challenge && !game.isle.challenge.cleared) {
    const stone = nearestRumorStone(game.player.position.x, game.player.position.z);
    if (stone) {
      const events = chooseRumorStone(game.isle.challenge, stone.id);
      for (const event of events) {
        if (event === 'blind') {
          game.audio?.playClick();
          flashCombatPopup(ui, '먼저 🔔 종(F/도구버튼)을 울려 살펴봐요', 'miss');
        } else if (event === 'wrong') {
          game.audio?.playWrong();
          flashCombatPopup(ui, '메아리였다! 소문이 다시 웅성인다', 'miss');
        } else if (event === 'correct') {
          game.audio?.playCorrect();
          flashCombatPopup(ui, `📜 원본을 찾았다! (${game.isle.challenge.round}/${RUMOR.rounds.length})`, 'match');
          ui.puzzleHint.textContent = '소문이 옮겨 갔다 — 다시 종을 울려 살펴봐요';
        } else if (event === 'cleared') {
          finishRumor(game, ui);
        }
      }
      return;
    }
  }
  const spot = game.isle.nearestSpot;
  if (!spot) {
    return;
  }
  const completed = game.progress.stages?.[game.isle.stageId]?.completed === true;
  if (spot.id === 'raft') {
    game.audio?.playClick();
    exitIsle(game, ui);
    return;
  }
  if (spot.id === 'corridor') {
    if (completed || game.isle.challenge?.cleared) {
      game.audio?.playClick();
      ui.dialogKicker.textContent = '말-화살 회랑';
      ui.dialogTitle.textContent = '✨ 도트';
      ui.dialogBody.innerHTML = speechHtml(['"회랑이 고요해. 뾰족한 말들이 더는 날아다니지 않아 — 네 덕분이야."']);
      openDialog(game, ui);
      return;
    }
    if (!game.isle.challenge) {
      // 도전 시작 — 발사대가 차례로 말-화살을 쏜다.
      game.audio?.playNoiseGroan();
      game.isle.challenge = createCorridorState();
      flashCombatPopup(ui, '🏹 말-화살이 날아온다!', 'miss');
      ui.puzzleGoal.textContent = '잡음 발사대 3개를 부수세요';
      ui.puzzleHint.textContent = '화살이 가까워지는 순간 🛡️ 방패(F/도구버튼)로 되돌려요';
    }
    return;
  }
  if (spot.id === 'rumor-wall') {
    if (completed || game.isle.challenge?.cleared) {
      game.audio?.playClick();
      ui.dialogKicker.textContent = '소문의 벽';
      ui.dialogTitle.textContent = '✨ 도트';
      ui.dialogBody.innerHTML = speechHtml(['"벽이 고요해. 이제 이 동굴엔 진짜 목소리만 남았어 — 네 덕분이야."']);
      openDialog(game, ui);
      return;
    }
    if (!game.isle.challenge) {
      // 도전 시작 — 소문이 세 번 밀려온다.
      game.audio?.playNoiseGroan();
      game.isle.challenge = createRumorState();
      flashCombatPopup(ui, '🗿 돌들이 같은 소문을 웅얼거린다!', 'miss');
      ui.puzzleGoal.textContent = `소문의 원본 돌을 ${RUMOR.rounds.length}번 찾아내세요`;
      ui.puzzleHint.textContent = '🔔 종(F/도구버튼)을 울리면 메아리 돌이 떨려요 — 굳건한 돌 앞에서 A';
    }
    return;
  }
  if (spot.id === 'dunes') {
    if (completed || game.isle.challenge?.cleared) {
      game.audio?.playClick();
      ui.dialogKicker.textContent = '모래시계 사구';
      ui.dialogTitle.textContent = '✨ 도트';
      ui.dialogBody.innerHTML = speechHtml(['"모래가 사르르 흐르고 있어. 항구의 시간이 다시 돌아왔네 — 네 덕분이야."']);
      openDialog(game, ui);
      return;
    }
    if (!game.isle.challenge) {
      // 도전 시작 — 멈췄던 모래시계들이 불안하게 흔들리기 시작한다.
      game.audio?.playNoiseGroan();
      game.isle.challenge = createDunesState();
      flashCombatPopup(ui, '⏳ 모래시계들이 흔들린다!', 'miss');
      ui.puzzleGoal.textContent = `모래시계 ${DUNES.glasses.length}개를 바로 세우세요`;
      ui.puzzleHint.textContent = '똑바로 서는 순간 🧭 나침반(F/도구버튼)으로 당겨요 — 멈출 때를 아는 게 열쇠!';
    }
    return;
  }
  if (spot.id === 'portal') {
    // 외곽 → 심부 직행 관문(4봉인 해제 후에만).
    if (completed) {
      game.audio?.playClick();
      enterIsle(game, ui, 'memory-core');
    } else {
      game.audio?.playWrong();
      flashCombatPopup(ui, '🌑 봉인이 남아 있다 — 네 봉인석을 먼저 깨워요', 'miss');
    }
    return;
  }
  if (spot.id === 'cargo') {
    game.audio?.playClick();
    ui.dialogKicker.textContent = '표시 없는 화물';
    ui.dialogTitle.textContent = '✨ 도트';
    ui.dialogBody.innerHTML = speechHtml([
      '"이 상자들, 겉만 봐서는 누가 만든 물건인지 알 수 없어 — 사람이 만든 걸까, AI가 만든 걸까?"',
      '"AI가 만든 것에는 표시가 필요해. 항구의 수수께끼는 곧 풀어 보자 — 지금은 정령이 먼저야."'
    ]);
    openDialog(game, ui);
    return;
  }
  if (spot.id === 'spirit') {
    game.audio?.playClick();
    const content = ISLE_CONTENT[game.isle.stageId];
    const stage = getStageById(game.isle.stageId);
    // 치유된 정령과 다시 이야기하면(같은 상륙에서 두 번째부터) 개인적인 사이드 대화를 들려준다.
    if (completed && game.isle.spiritTalked && content.spiritRevisitKo) {
      ui.dialogKicker.textContent = stage.nameKo;
      ui.dialogTitle.textContent = content.spiritNameKo;
      ui.dialogBody.innerHTML = speechHtml(content.spiritRevisitKo);
      openDialog(game, ui);
      return;
    }
    if (completed) {
      game.isle.spiritTalked = true;
    }
    // 감사 기록 보관소: 안내를 들으면 곧바로 4봉인 감사 훈련이 시작된다.
    if (game.isle.stageId === 'memory-outer' && !completed && !game.isle.challenge) {
      game.isle.challenge = createHeartState();
      ui.puzzleGoal.textContent = `동사 봉인 ${HEART.seals.length}개를 해제하세요`;
      ui.puzzleHint.textContent = '봉인석의 빛이 가장 환해지는 순간, 그 앞에서 약속의 힘(F/도구버튼)!';
    }
    ui.dialogKicker.textContent = stage.nameKo;
    ui.dialogTitle.textContent = content.spiritNameKo;
    ui.dialogBody.innerHTML = speechHtml(completed ? content.spiritHealedKo : content.spiritSickKo);
    openDialog(game, ui);
  }
}

// 4봉인 클리어: 심부 관문 개방 + 스테이지 완료 기록(항로 지도 전이).
function finishHeart(game, ui) {
  const isle = game.isle;
  isle.built.heal();
  game.progress = markStageCompleted(game.progress, isle.stageId);
  persistProgress(game.progress);
  updateHud(game, ui);
  game.audio?.playCoreAwaken();
  triggerFlash(ui, '#e8b8d8');
  ui.puzzleGoal.textContent = ISLE_CONTENT[isle.stageId].healedGoalKo;
  ui.puzzleHint.textContent = '뗏목으로 돌아가면 다시 바다로';
  ui.dialogKicker.textContent = '감사 기록 보관소';
  ui.dialogTitle.textContent = '💠 승인 기록 복구';
  ui.dialogBody.innerHTML = speechHtml([
    '"네 봉인이 모두 풀렸어. 사건과 무관한 개인정보는 가려지고, 승인 과정만 증거 묶음에 남았어."',
    '"공개 심리실이 열렸어. 화이트아웃이 마지막 삭제를 실행하기 전에 H-17 사건 기록을 심리대에 올리자."',
    '"하루도 섬 밖에서 생방송 연결을 기다리고 있어. 이번에는 당사자의 목소리를 빼놓지 않을 거야."'
  ]);
  openDialog(game, ui);
}

const CHAPTER_FOLLOWUPS = {
  'whisper-cape': {
    kickerKo: '3장 · 웃음이 만든 폭풍',
    titleKo: '삭제 뒤에도 남은 확산 기록',
    introKo: [
      '"최초 게시물은 내려갔지만 갯벌에 캡처와 복사본, 추천 기록이 남아 있어."',
      '"남쪽 갯벌에서 복사본 삭제 → 확산 중단 → 하루에게 알리고 회복 지원 순서로 책임을 실행해 줘."'
    ],
    goalKo: `책임의 발자국 ${FOOTPRINT.actions.length}개를 순서대로 밝히세요`,
    hintKo: '남쪽 갯벌에서 A · 복사본 삭제 → 확산 중단 → 사과와 도움',
    choiceId: 'remove-stop-repair',
    closingKo: [
      '"확산 경로가 공개되고 하루에게 삭제·차단·회복 요청 창구가 열렸어."',
      '"다음 해협에서는 서로 다른 사람에게 정반대 증거만 보여 줬던 추천 기록을 찾아야 해."'
    ]
  },
  'echo-cave': {
    kickerKo: '4장 · 두 개의 진실',
    titleKo: '추천 경로 밖의 증거',
    introKo: [
      '"동굴 서쪽 버블은 하루를 유죄라 말하는 게시물만 반복 추천했어."',
      '"거울로 원본, 날짜와 맥락, 반대 증거를 각각 열어 봐. 같은 주장이 반복된 횟수는 독립된 증거가 아니야."'
    ],
    goalKo: `서로 다른 확인 창 ${BUBBLE.sources.filter((source) => source.required).length}개를 비추세요`,
    hintKo: '서쪽 창 가까이에서 🪞 거울(F/도구버튼) · 같은 추천만 반복되는 창은 함정',
    choiceId: 'verify-diverse-sources',
    closingKo: [
      '"하루의 이의제기서가 추천 경로 밖에서 복구됐어. 사건 화면에 “다른 근거 보기” 창이 생겼다."',
      '"남쪽 자동 결정 항구에서 이 불완전한 증거가 어떻게 제재 명령으로 바뀌었는지 확인하자."'
    ]
  },
  'hourglass-port': {
    kickerKo: '5장 · 아무도 결정하지 않는 밤',
    titleKo: '자동 결정 뒤에 숨은 사람',
    introKo: [
      '"자동 승인 시계는 멈췄지만 부두 기록에는 사람과 AI가 한 일이 뒤섞여 있어."',
      '"상자마다 제작 기록을 읽고 사람 제작·AI 도움·AI 생성 라벨을 붙여. 최종 검수자도 확인해야 책임 경로가 완성돼."'
    ],
    goalKo: `화물 ${CARGO.crates.length}개의 제작 과정을 정확히 표시하세요`,
    hintKo: '부두 상자 앞 A · 라벨 순환 / ✅ F · 적하 목록 검수',
    choiceId: 'disclose-and-check',
    closingKo: [
      '"모든 결정에 AI의 역할과 최종 확인자가 표시됐다. 이제 “AI가 정했어요” 뒤에 사람이 숨을 수 없어."',
      '"도트: 감사 기록 보관소가 열렸어. H-17 삭제 명령에 서명한 사람들과 루멘의 원래 지시문을 확인하자."'
    ]
  }
};

function recordChapterChoice(game, stageId, choiceId, correct) {
  game.progress = {
    ...game.progress,
    choiceLog: [
      ...(game.progress.choiceLog ?? []),
      { kind: 'chapter-3d', stageId, topicId: null, choiceId, correct }
    ]
  };
}

function createChapterFollowup(stageId) {
  if (stageId === 'whisper-cape') {
    return createFootprintState();
  }
  if (stageId === 'echo-cave') {
    return createBubbleState();
  }
  if (stageId === 'hourglass-port') {
    return createCargoState();
  }
  return null;
}

function beginChapterFollowup(game, ui, stageId) {
  const content = CHAPTER_FOLLOWUPS[stageId];
  const followup = createChapterFollowup(stageId);
  if (!content || !followup) {
    return;
  }
  game.isle.followup = followup;
  ui.puzzleGoal.textContent = content.goalKo;
  ui.puzzleHint.textContent = content.hintKo;
  ui.dialogKicker.textContent = content.kickerKo;
  ui.dialogTitle.textContent = content.titleKo;
  ui.dialogBody.innerHTML = speechHtml(content.introKo);
  openDialog(game, ui);
}

function completeChapterFollowup(game, ui) {
  const isle = game.isle;
  const content = CHAPTER_FOLLOWUPS[isle.stageId];
  if (!content) {
    return;
  }
  if (isle.stageId === 'whisper-cape') {
    healSpiritVisuals(isle.built);
  } else {
    isle.built.heal();
  }
  recordChapterChoice(game, isle.stageId, content.choiceId, true);
  game.progress = markStageCompleted(game.progress, isle.stageId);
  persistProgress(game.progress);
  updateHud(game, ui);
  game.audio?.playNovaChime();
  triggerFlash(ui, isle.stageId === 'echo-cave' ? '#bfe8f4' : '#ffe0b0');
  ui.puzzleGoal.textContent = ISLE_CONTENT[isle.stageId].healedGoalKo;
  ui.puzzleHint.textContent = '뗏목으로 돌아가면 다시 바다로';
  ui.dialogKicker.textContent = content.kickerKo;
  ui.dialogTitle.textContent = '기억의 매듭이 풀렸다';
  ui.dialogBody.innerHTML = speechHtml(content.closingKo);
  openDialog(game, ui);
}

function footprintResolve(game, ui) {
  const isle = game.isle;
  const action = isle.nearestFollowup;
  if (!action) {
    return;
  }
  const events = resolveFootprintAction(isle.followup, action.id);
  if (events.includes('out-of-order')) {
    recordChapterChoice(game, isle.stageId, action.id, false);
    persistProgress(game.progress);
    game.audio?.playWrong();
    flashCombatPopup(ui, '먼저 내가 만든 복사본부터 지우고, 확산을 멈춰요', 'miss');
    return;
  }
  if (events.includes('resolved')) {
    isle.built.syncFootprint(action.id, true);
    game.audio?.playCorrect();
    flashCombatPopup(ui, `${action.emoji} 책임지는 행동 ${isle.followup.step}/${FOOTPRINT.actions.length}`, 'match');
  }
  if (events.includes('cleared')) {
    completeChapterFollowup(game, ui);
  }
}

function bubbleInspect(game, ui) {
  const isle = game.isle;
  const source = isle.nearestFollowup;
  if (!source) {
    game.audio?.playClick();
    flashCombatPopup(ui, '서쪽 자료 창 가까이에서 거울을 써요', 'miss');
    return;
  }
  const events = inspectBubbleSource(isle.followup, source.id);
  if (events.includes('echo')) {
    recordChapterChoice(game, isle.stageId, source.id, false);
    persistProgress(game.progress);
    game.audio?.playWrong();
    flashCombatPopup(ui, '🔁 반복은 증거가 아니야 — 다른 종류의 자료를 확인해요', 'miss');
    return;
  }
  if (events.includes('verified')) {
    isle.built.syncBubbleSource(source.id, true);
    const count = Object.values(isle.followup.verified).filter(Boolean).length;
    game.audio?.playCorrect();
    flashCombatPopup(ui, `${source.emoji} 확인 완료 (${count}/3)`, 'match');
  }
  if (events.includes('cleared')) {
    completeChapterFollowup(game, ui);
  }
}

function cargoCycle(game, ui) {
  const isle = game.isle;
  const crate = isle.nearestFollowup;
  if (!crate) {
    return;
  }
  const labelId = cycleCargoLabel(isle.followup, crate.id);
  if (!labelId) {
    return;
  }
  isle.built.syncCargoLabel(crate.id, labelId);
  game.audio?.playClick();
  flashCombatPopup(ui, `${crate.emoji} ${crate.titleKo}: ${CARGO_LABEL_KO[labelId]}`, 'match');
  ui.puzzleHint.textContent = `${crate.clueKo} · 현재 라벨: ${CARGO_LABEL_KO[labelId]} · ✅ F로 검수`;
}

function cargoVerify(game, ui) {
  const isle = game.isle;
  const result = verifyCargoManifest(isle.followup);
  if (result.event === 'incomplete') {
    recordChapterChoice(game, isle.stageId, 'manifest-incomplete', false);
    persistProgress(game.progress);
    game.audio?.playWrong();
    const unknown = result.wrongIds
      .map((id) => CARGO.crates.find((crate) => crate.id === id)?.titleKo)
      .filter(Boolean)
      .join(' · ');
    flashCombatPopup(ui, `검수 필요: ${unknown}`, 'miss');
    ui.puzzleHint.textContent = '제작 기록과 라벨이 맞는지 다시 확인해요 · 상자 앞 A로 변경';
    return;
  }
  completeChapterFollowup(game, ui);
}

// 핵심 도전을 끝내도 아직 장 완료가 아니다. 후속 윤리 퍼즐까지 풀어야 항로가 열린다.
function finishDunes(game, ui) {
  triggerFlash(ui, '#ffe0b0');
  beginChapterFollowup(game, ui, game.isle.stageId);
}

function finishRumor(game, ui) {
  triggerFlash(ui, '#bfe8f4');
  beginChapterFollowup(game, ui, game.isle.stageId);
}

function finishCorridor(game, ui) {
  triggerFlash(ui, '#ffe9b0');
  beginChapterFollowup(game, ui, game.isle.stageId);
}

// 플레이어가 바라보는 방향 → 그리드 한 칸 방향([dCol, dRow]).
function facingGridDir(direction) {
  return Math.abs(direction.x) >= Math.abs(direction.z)
    ? [direction.x >= 0 ? 1 : -1, 0]
    : [0, direction.z >= 0 ? 1 : -1];
}

function crateIdAtCell(dg, cell) {
  for (const crate of dg.room.crates) {
    const [c, r] = dg.state.crates[crate.id];
    if (c === cell[0] && r === cell[1]) {
      return crate.id;
    }
  }
  return null;
}

// 현재 상태(+빔 경로)를 3D에 반영.
function syncDungeon(dg) {
  syncDungeonVisuals(dg.topicId, dg.built, dg.state, {
    beam: dg.room.mechanic === 'beam' ? computeBeamPath(dg.topicId, dg.state) : undefined
  });
}

// 플레이어에서 가장 가까운 상호작용 대상(씨앗 통·밭·전시대·이름표·거울) id.
function nearestDungeonTarget(game, range = 1.25) {
  const dg = game.dungeon;
  let best = null;
  let bestDist = range;
  for (const t of dg.targets) {
    const d = Math.hypot(game.player.position.x - t.world.x, game.player.position.z - t.world.z);
    if (d < bestDist) {
      best = t;
      bestDist = d;
    }
  }
  return best?.id ?? null;
}

// 클리어 공통 처리(모든 mechanic).
function markDungeonSolved(game, ui) {
  const dg = game.dungeon;
  if (dg.solved) {
    return;
  }
  dg.solved = true;
  game.audio?.playCorrect();
  celebrate(game, new THREE.Vector3(dg.pedestalWorld.x, 1.3, dg.pedestalWorld.z), '#ffd76a', 'collect');
  ui.puzzleHint.textContent = '✨ 풀렸어요! 북쪽 제단으로 가서 A로 약속의 도구를 받아요';
}

function dungeonAction(game, ui) {
  const dg = game.dungeon;
  if (!dg || !dg.active || dg.actionCooldown > 0) {
    return;
  }
  // 남쪽 빛 문 근처면 나간다(미클리어 퇴장 허용 — 상태는 버림).
  const distExit = Math.hypot(
    game.player.position.x - dg.exitWorld.x,
    game.player.position.z - dg.exitWorld.z
  );
  if (distExit < DUNGEON_EXIT_RANGE) {
    exitDungeon(game, ui);
    return;
  }
  // 클리어 후 북쪽 제단 근처면 아이템 획득.
  if (dg.solved) {
    const distPed = Math.hypot(
      game.player.position.x - dg.pedestalWorld.x,
      game.player.position.z - dg.pedestalWorld.z
    );
    if (distPed < DUNGEON_PEDESTAL_RANGE) {
      awardDungeonItem(game, ui);
      return;
    }
    // 이미 풀린 뒤에는 퍼즐을 더 조작할 수 없다(정답을 흐트러뜨려 리포트가 오염되는 것 방지).
    game.audio?.playClick();
    return;
  }
  dg.actionCooldown = DUNGEON_PUSH_COOLDOWN;
  if (dg.room.mechanic === 'push') {
    dungeonPushAction(game, ui);
  } else if (dg.room.mechanic === 'carry') {
    dungeonCarryAction(game, ui);
  } else if (dg.room.mechanic === 'beam') {
    dungeonBeamAction(game, ui);
  }
}

// 실패 이벤트 공통 처리: 기록 + 지지직 + 팝업 + 힌트.
function dungeonRefuse(game, ui, popupKo, hintKo) {
  const dg = game.dungeon;
  dg.failedPlacements += 1;
  recordDungeonMisplace(game);
  game.audio?.playWrong();
  addShake(game, 0.12);
  flashCombatPopup(ui, popupKo, 'bounce');
  ui.puzzleHint.textContent = hintKo;
}

function dungeonPushAction(game, ui) {
  const dg = game.dungeon;
  // 바라보는 방향의 인접 칸 상자를 한 칸 민다.
  const dir = facingGridDir(game.player.direction);
  const playerCell = worldToCell(dg.topicId, game.player.position.x, game.player.position.z);
  const targetCell = [playerCell[0] + dir[0], playerCell[1] + dir[1]];
  const crateId = crateIdAtCell(dg, targetCell);
  if (!crateId) {
    game.audio?.playClick();
    return;
  }
  const result = pushCrate(dg.topicId, dg.state, crateId, dir);
  if (result.event === 'wrong-zone') {
    dungeonRefuse(game, ui, '거기엔 안 돼요!', '내 것만 공개 게시판에, 친구 것은 잠금 금고에!');
    return;
  }
  if (!result.moved) {
    game.audio?.playClick();
    return;
  }
  dg.state = result.state;
  syncDungeon(dg);
  game.audio?.[result.event === 'placed' ? 'playCorrect' : 'playClick']?.();
  if (isRoomSolved(dg.topicId, dg.state)) {
    markDungeonSolved(game, ui);
  } else {
    const left = countRemaining(dg.topicId, dg.state);
    ui.puzzleHint.textContent = `상자 ${left}개가 아직 제자리가 아니에요`;
  }
}

// 손에 든 것의 정보(이모지·이름) — 잡기 방 공통.
function heldItemInfo(dg) {
  const held = dg?.state?.held;
  if (held === null || held === undefined) {
    return null;
  }
  if (dg.room.dispensers) {
    const d = dg.room.dispensers.find((x) => x.colorIdx === held);
    return { emoji: d?.emoji ?? '🌱', labelKo: d?.labelKo ?? '씨앗' };
  }
  const p = dg.room.plates?.find((x) => x.id === held);
  return { emoji: '🏷️', labelKo: p?.labelKo ?? '이름표' };
}

// 손에 든 것을 A 버튼 라벨 + 머리 위 이모지로 보여준다.
function updateCarryLabel(game, ui) {
  const dg = game.dungeon;
  const info = heldItemInfo(dg);
  if (ui.actionLabel) {
    ui.actionLabel.textContent = info ? info.emoji : '잡기';
  }
  // 머리 위 표시: 든 것이 바뀔 때만 스프라이트를 재생성한다.
  const key = info ? `${info.emoji}:${dg.state.held}` : '';
  if (dg.heldKey === key) {
    return;
  }
  dg.heldKey = key;
  removeHeldSprite(game);
  if (info) {
    const sprite = makeGlyphSprite(info.emoji, 0.62);
    sprite.position.set(0, 1.95, 0);
    game.renderState.playerGroup.add(sprite);
    dg.heldSprite = sprite;
  }
}

function removeHeldSprite(game) {
  const dg = game.dungeon;
  if (dg?.heldSprite) {
    game.renderState.playerGroup.remove(dg.heldSprite);
    dg.heldSprite.material.map?.dispose?.();
    dg.heldSprite.material.dispose?.();
    dg.heldSprite = null;
  }
}

function dungeonCarryAction(game, ui) {
  const dg = game.dungeon;
  const targetId = nearestDungeonTarget(game);
  if (!targetId) {
    game.audio?.playClick();
    return;
  }
  const result = pickOrPlace(dg.topicId, dg.state, targetId);
  if (result.event === 'duplicate') {
    dungeonRefuse(game, ui, '같은 색이 이미 있어요!', '꽃밭엔 서로 다른 색을 심어야 해요 — 다양할수록 좋아요');
    return;
  }
  if (result.event === 'fake') {
    dungeonRefuse(game, ui, '가짜 이름표예요!', '진짜 만든 이의 이름만 작품에 걸 수 있어요');
    return;
  }
  if (result.event === 'wrong-owner') {
    dungeonRefuse(game, ui, '만든 이가 달라요!', '이 작품을 만든 사람이 누구인지 다시 살펴봐요');
    return;
  }
  if (!result.event) {
    game.audio?.playClick();
    return;
  }
  dg.state = result.state;
  syncDungeon(dg);
  updateCarryLabel(game, ui);
  if (result.event === 'placed') {
    game.audio?.playCorrect();
  } else {
    game.audio?.playClick();
  }
  if (isRoomSolved(dg.topicId, dg.state)) {
    markDungeonSolved(game, ui);
  } else if (result.event === 'picked') {
    const info = heldItemInfo(dg);
    ui.puzzleHint.textContent = dg.room.dispensers
      ? `${info?.emoji ?? ''} ${info?.labelKo ?? ''}을(를) 들었어요! 빈 밭 앞에서 A로 심어요`
      : `🏷️ 「${info?.labelKo ?? ''}」 이름표를 들었어요! 맞는 작품 앞에서 A로 걸어요`;
  } else {
    const left = countRemaining(dg.topicId, dg.state);
    // 밭이 다 찼는데 안 풀렸다면 중복이 남은 것 — 되집기를 유도.
    const fullButDup = dg.room.beds && dg.state.beds.every((b) => b !== null);
    ui.puzzleHint.textContent = fullButDup
      ? '같은 색이 두 밭에 있어요 — 하나를 되집어 다른 색으로 바꿔요'
      : `아직 ${left}곳이 남았어요`;
  }
}

function dungeonBeamAction(game, ui) {
  const dg = game.dungeon;
  const targetId = nearestDungeonTarget(game);
  if (!targetId) {
    game.audio?.playClick();
    return;
  }
  const result = rotateMirror(dg.topicId, dg.state, targetId);
  if (result.event !== 'rotated') {
    game.audio?.playClick();
    return;
  }
  dg.state = result.state;
  game.audio?.playClick();
  const beam = computeBeamPath(dg.topicId, dg.state);
  syncDungeonVisuals(dg.topicId, dg.built, dg.state, { beam });
  if (beam.hit?.kind === 'orb' && beam.hit.real) {
    markDungeonSolved(game, ui);
    return;
  }
  if (beam.hit?.kind === 'orb' && !beam.hit.real) {
    const orb = dg.room.orbs.find((o) => o.id === beam.hit.orbId);
    dungeonRefuse(game, ui, '가짜가 빛났어요!', `${orb?.hintKo ?? ''} 진짜 얼굴을 찾아 거울을 더 돌려봐요`);
    return;
  }
  ui.puzzleHint.textContent = '빛이 벽에 닿았어요 — 거울을 돌려 길을 만들어요';
}

// 틀린 존 시도를 기존 '실패 선택' 전이로 기록해 학습 리포트의 first-try/retry 신호를 살린다.
function recordDungeonMisplace(game) {
  const dg = game.dungeon;
  const shrine = getShrineById(dg.shrineId);
  const wrong = shrine.choices.find((c) => !c.correct);
  if (wrong) {
    game.progress = applyShrineResult(game.progress, dg.shrineId, wrong.id).progress;
    persistProgress(game.progress);
  }
}

function awardDungeonItem(game, ui) {
  const dg = game.dungeon;
  if (!dg || dg.awarded) {
    return;
  }
  dg.awarded = true;
  const shrine = getShrineById(dg.shrineId);
  const correct = shrine.choices.find((c) => c.correct);
  const outcome = applyShrineResult(game.progress, dg.shrineId, correct.id);
  game.progress = outcome.progress;
  persistProgress(game.progress);
  const toolId = outcome.toolId;
  const topic = getTopicById(dg.topicId);
  celebrate(game, new THREE.Vector3(dg.pedestalWorld.x, 1.5, dg.pedestalWorld.z), topic?.color ?? '#ffd76a', 'collect');
  exitDungeon(game, ui);
  updateHud(game, ui);
  // 획득 의식 — 데이터 캡슐이 열리듯 도구가 떠오르고 팡파레(젤다식 의례화).
  if (toolId) {
    showToolCeremony(game, ui, getToolById(toolId), topic);
  }
  // H-17 사건 — 사당을 지킬 때마다 삭제 명령의 증거 한 조각이 복구된다.
  // 획득 의식(2.6초)이 걷힌 뒤에 열어 연출이 겹치지 않게 한다.
  const fragmentTopicId = dg.topicId;
  window.setTimeout(() => showMemoryFragment(game, ui, fragmentTopicId), 2900);
}

function updateDungeon(delta, game, ui) {
  const dg = game.dungeon;
  if (!dg || !dg.active) {
    return;
  }
  if (dg.actionCooldown > 0) {
    dg.actionCooldown = Math.max(0, dg.actionCooldown - delta);
  }
  // 도트는 방 안에서도 어깨 옆에 둥실.
  const rs = game.renderState;
  if (rs.companion) {
    const target = new THREE.Vector3(
      game.player.position.x - game.player.direction.x * 0.6,
      game.player.position.y + 1.25,
      game.player.position.z - game.player.direction.z * 0.6
    );
    rs.companion.position.lerp(target, Math.min(1, delta * 4.5));
    rs.companion.rotation.y += delta * 1.4;
    if (rs.companion.userData.halo) {
      rs.companion.userData.halo.rotation.z += delta * 1.8;
    }
  }
  // 클리어되면 제단 보석이 커지며 맥동(획득 유도).
  if (dg.solved && dg.built.pedGlow) {
    dg.glowT += delta;
    const pulse = 1 + Math.sin(dg.glowT * 5) * 0.18;
    dg.built.pedGlow.scale.setScalar(pulse);
    dg.built.pedGlow.material.emissiveIntensity = 1.4 + Math.sin(dg.glowT * 5) * 0.5;
  }
  // 문 아치는 늘 은은하게 회전(나가는 곳 강조).
  if (dg.built.door) {
    dg.built.door.rotation.z += delta * 0.6;
  }
  // 방 앰비언트: 존 타일은 숨 쉬듯 깜빡이고, 얼굴 구슬은 둥실 떠 있는다.
  const elapsed = clock.elapsedTime;
  if (dg.built.zoneMeshes) {
    dg.built.zoneMeshes.forEach((tile, i) => {
      tile.material.opacity = 0.42 + Math.sin(elapsed * 2 + i * 1.4) * 0.12;
    });
  }
  if (dg.built.orbMeshes) {
    let i = 0;
    for (const mesh of dg.built.orbMeshes.values()) {
      mesh.orb.position.y = 0.8 + Math.sin(elapsed * 1.8 + i * 2.1) * 0.08;
      i += 1;
    }
  }
  // 🔔 공명: 아직 어긋난 자리(빈 밭·중복 밭·미완 전시대)가 커졌다 작아지며 반짝인다.
  if (dg.resonateT > 0) {
    dg.resonateT = Math.max(0, dg.resonateT - delta);
  }
  const pulse = dg.resonateT > 0 ? 1 + (Math.sin(elapsed * 10) * 0.5 + 0.5) * 0.22 : 1;
  if (dg.built.bedMeshes) {
    const beds = dg.state.beds ?? [];
    beds.forEach((color, i) => {
      const mesh = dg.built.bedMeshes.get(i);
      if (!mesh) {
        return;
      }
      const duplicated = color !== null && beds.filter((b) => b === color).length > 1;
      mesh.group.scale.setScalar(color === null || duplicated ? pulse : 1);
    });
  }
  if (dg.built.exhibitMeshes && dg.state.exhibits) {
    for (const [exId, mesh] of dg.built.exhibitMeshes.entries()) {
      mesh.group.scale.setScalar(dg.state.exhibits[exId] === null ? pulse : 1);
    }
  }
  // 🪞 진실의 렌즈: 가짜 구슬만 좌우로 흔들린다(진짜는 미동도 없다).
  if (dg.lensT > 0) {
    dg.lensT = Math.max(0, dg.lensT - delta);
  }
  if (dg.built.orbMeshes && dg.room.orbs) {
    dg.room.orbs.forEach((orb, i) => {
      const mesh = dg.built.orbMeshes.get(orb.id);
      if (!mesh) {
        return;
      }
      const base = cellToWorld(dg.topicId, orb.cell);
      const jitter = dg.lensT > 0 && !orb.real ? Math.sin(elapsed * 26 + i * 2.4) * 0.09 : 0;
      mesh.group.position.x = base.x + jitter;
    });
  }
}

function openCoreDialog(game, ui) {
  const unlocked = canUnlockFinalCore(game.progress.collectedFragments);
  ui.dialogKicker.textContent = unlocked ? CORE_BREACH.titleKo : '중앙 감사 코어';
  ui.dialogTitle.textContent = unlocked ? '화이트아웃 명령을 추적하다' : FINAL_CORE_MISSION.nameKo;

  if (!unlocked) {
    const summary = getProgressSummary(game.progress.collectedFragments);
    ui.dialogBody.innerHTML = `
      <p>감사 코어의 틈에서 흰 안개가 새어 나온다. H-17 사건 증거가 부족해 아직 원본 명령을 열 수 없다.</p>
      <p>증거가 ${FINAL_CORE_MISSION.unlockRequirement}개 이상 필요해요. 지금은 ${summary.collected}개를 확보했습니다.</p>
    `;
    openDialog(game, ui);
    return;
  }

  // 1-2장 완료 뒤에는 군도로 이어지는 항로와 기초 인증을 다시 볼 수 있다.
  if (game.progress.aiCoreCompleted) {
    ui.dialogBody.innerHTML = `
      <p class="prompt-line">갈라진 코어 너머로 삭제 명령서 조각이 바다 항로를 가리킨다. 승인자 서명은 아직 세 군데 보관소에 흩어져 있다.</p>
      <div class="finale-nav">
        <button type="button" class="finale-next" data-cert-again>1-2장 기초 인증 다시 보기</button>
      </div>
    `;
    ui.dialogBody.querySelector('[data-cert-again]').addEventListener('click', () => showCertificate(game, ui));
    openDialog(game, ui);
    return;
  }

  // 조각을 다 모았고 아직 안 깬 상태로 코어에 닿으면 실제 전투로 진입(대화 아님).
  startBossFight(game, ui);
}

// ===== 2장 감사 코어 액션: 화이트아웃에 다가가 A로 삭제 껍질을 검증한다 =====
// 4페이즈 보스: 사당에서 모은 네 아이템이 각 페이즈의 열쇠다(페이즈당 2히트).
const PHASE_HITS = 2;
const PHASE_TOOLS = PROMISE_TOOLS.map((t) => t.id); // 개인정보→편향→저작권→딥페이크 순
const PHASE_FIRE = [2.9, 2.55, 2.2, 1.9]; // 페이즈가 오를수록 잡음 파도가 빨라진다
const BOSS_MAX_HP = PHASE_HITS * PHASE_TOOLS.length;
const ATTACK_RANGE = 3.7;
const ATTACK_COOLDOWN = 0.3;
const WINDUP_TIME = 0.62; // 발사 예고(피할 시간)
const PROJECTILE_SPEED = 6.2;
const PROJECTILE_HIT = 0.95;
const STUN_TIME = 0.75;

function toolColorHex(toolId) {
  return getTopicById(getToolById(toolId)?.topicId)?.color ?? '#ffd76a';
}

function startBossFight(game, ui) {
  if (game.combat) {
    return;
  }
  // 아이템 게이트: 네 사당의 감사 도구를 모두 모아야 삭제 명령의 근거를 열 수 있다.
  const owned = game.progress.tools ?? [];
  if (owned.length < PHASE_TOOLS.length) {
    const missing = PROMISE_TOOLS.filter((t) => !owned.includes(t.id));
    ui.dialogKicker.textContent = '중앙 코어';
    ui.dialogTitle.textContent = '네 가지 약속이 필요하다';
    ui.dialogBody.innerHTML = `
      <p class="prompt-line">화이트아웃의 삭제 껍질은 네 겹 — 사당에서 얻은 검증 도구가 하나씩 필요해요.</p>
      <p>남은 사당의 도구: ${missing.map((t) => `${t.emoji} ${t.nameKo}`).join(' · ')}</p>
    `;
    openDialog(game, ui);
    return;
  }
  spawnNoiseBoss(game, { combat: true });
  if (game.renderState?.companion) {
    game.renderState.companion.visible = false; // 도트는 후드로 숨는다
  }
  game.audio?.resume();
  game.audio?.setMusicMode?.('boss'); // 맥동하는 긴장 BGM
  game.audio?.playNoiseGroan();
  // 페이즈 1(개인정보)부터 — 각 페이즈는 그 주제의 아이템만 통한다.
  const tools = owned.slice();
  game.combat = {
    active: true,
    hp: BOSS_MAX_HP,
    maxHp: BOSS_MAX_HP,
    cooldown: 0,
    driftAngle: Math.PI * 0.25,
    tools,
    activeTool: 0,
    phase: 0,
    phaseHits: 0,
    weakToolId: PHASE_TOOLS[0],
    memCounter: 0,
    weakMemory: pickMemory(PHASE_TOOLS[0], 0),
    bounceStreak: 0, // 같은 약점에서 연속으로 틀린 횟수(2회면 이모지 힌트 공개)
    revealed: false, // 약점 도구 이모지를 보여줄지(처음엔 상황만 읽고 판단)
    hintHold: 0, // 이유/튕김 안내를 잠깐 붙잡아 두는 타이머
    fireTimer: PHASE_FIRE[0],
    windup: 0,
    projectile: null,
    stun: 0,
    guard: 0, // 🛡️ 가드 자세 남은 시간(그 사이 파도가 닿으면 반사)
    guardCd: 0,
    bellCd: 0, // 🔔 충격파 쿨다운
    staggers: 0, // 피격 누적 — 3회면 화이트아웃이 사건 증거를 일시 삭제한다.
    fragmentStolen: false // 강탈 상태(진짜 세이브는 건드리지 않는다 — 승리 시 반환)
  };
  syncBossWeakColor(game);
  ui.root.classList.add('is-combat');
  ui.bossHud.hidden = false;
  ui.prompt.hidden = true;
  if (ui.actionLabel) {
    ui.actionLabel.textContent = '⚔';
  }
  game.updateRotateHint?.();
  updateBossHud(game, ui);
}

function syncBossWeakColor(game) {
  const c = game.combat;
  const boss = game.renderState?.noiseBoss;
  if (c && boss) {
    boss.weakColorHex = toolColorHex(c.weakToolId);
  }
}

// 페이즈 전진 — 껍질이 깨지면 다음 주제(약속)의 껍질이 드러난다.
function rotateWeakness(game, ui) {
  const c = game.combat;
  c.phase = Math.min(c.phase + 1, PHASE_TOOLS.length - 1);
  c.phaseHits = 0;
  c.weakToolId = PHASE_TOOLS[c.phase];
  c.memCounter = 0;
  c.weakMemory = pickMemory(c.weakToolId, 0);
  c.bounceStreak = 0;
  c.revealed = false;
  c.fireTimer = Math.min(c.fireTimer, PHASE_FIRE[c.phase]);
  syncBossWeakColor(game);
  popBossMemory(ui, c);
}

// 새 상황 말풍선을 팝 애니메이션으로 띄운다.
function popBossMemory(ui, c) {
  if (ui?.bossMemory) {
    ui.bossMemory.textContent = c.weakMemory.textKo;
    ui.bossMemory.classList.remove('pop');
    void ui.bossMemory.offsetWidth;
    ui.bossMemory.classList.add('pop');
  }
}

// 페이즈 격파 연출: 껍질 파편 + 다음 페이즈 개시.
function breakBossShell(game, ui) {
  const c = game.combat;
  const boss = game.renderState?.noiseBoss;
  const tool = getToolById(c.weakToolId);
  flashCombatPopup(ui, `${tool?.emoji ?? ''} 껍질이 깨졌다! (${c.phase + 1}/${PHASE_TOOLS.length})`, 'win');
  addShake(game, 0.45);
  game.hitStop = 0.1;
  celebrate(game, new THREE.Vector3(boss?.baseX ?? 0, boss?.baseY ?? 2.4, boss?.baseZ ?? 0), toolColorHex(c.weakToolId), 'collect');
  rotateWeakness(game, ui);
}

function cycleActiveTool(game, ui, dir = 1) {
  const c = game.combat;
  if (!c || !c.active) {
    return;
  }
  c.activeTool = (c.activeTool + dir + c.tools.length) % c.tools.length;
  game.audio?.playClick();
  updateBossHud(game, ui);
}

function selectActiveTool(game, ui, toolId) {
  const c = game.combat;
  if (!c || !c.active) {
    return;
  }
  const idx = c.tools.indexOf(toolId);
  if (idx >= 0) {
    c.activeTool = idx;
    game.audio?.playClick();
    updateBossHud(game, ui);
  }
}

function playerAttack(game, ui) {
  const c = game.combat;
  if (!c || !c.active || c.cooldown > 0 || c.stun > 0) {
    return;
  }
  c.cooldown = ATTACK_COOLDOWN;
  const boss = game.renderState?.noiseBoss;
  if (!boss || boss.kind !== 'noise') {
    return;
  }
  const dist = Math.hypot(
    game.player.position.x - (boss.baseX ?? 0),
    game.player.position.z - (boss.baseZ ?? 0)
  );
  if (dist > ATTACK_RANGE) {
    game.audio?.playClick();
    ui.bossHint.textContent = '더 가까이 다가가요';
    return;
  }
  const activeToolId = c.tools[c.activeTool];
  if (activeToolId !== c.weakToolId) {
    // 상황에 안 맞는 도구 — 튕겨 나간다(대미지 없음). 정답은 안 주고, 상황을 다시 읽게 한다.
    game.audio?.playWrong();
    boss.hitFlash = 0.12;
    addShake(game, 0.1);
    flashCombatPopup(ui, '튕김!', 'bounce');
    c.bounceStreak += 1;
    if (c.bounceStreak >= 2) {
      c.revealed = true; // 두 번 연속 틀리면 도구 힌트 공개(좌절 방지)
    }
    const weak = getToolById(c.weakToolId);
    ui.bossHint.textContent = c.revealed
      ? `이 상황엔 ${weak?.emoji ?? ''} ${weak?.nameKo ?? ''} — 그 도구로 바꿔요`
      : `튕김! "${c.weakMemory.textKo}" — 어떤 약속이 필요할까?`;
    c.hintHold = 1.8;
    updateBossHud(game, ui);
    return;
  }
  // 상황에 맞는 감사 도구로 명중: 화이트아웃의 삭제 껍질이 벗겨진다.
  c.hp = Math.max(0, c.hp - 1);
  c.phaseHits += 1;
  boss.hitFlash = 0.3;
  addShake(game, 0.3);
  game.hitStop = 0.06; // 히트스톱 — 타격 순간 멈칫
  const weakTool = getToolById(c.weakToolId);
  flashCombatPopup(ui, `${weakTool?.emoji ?? ''} 약속이 통했다!`, 'hit');
  ui.bossHint.textContent = c.weakMemory.hintKo; // 왜 이 도구였는지 한 줄
  c.hintHold = 1.6;
  celebrate(game, new THREE.Vector3(boss.baseX ?? 0, boss.baseY ?? 2.6, boss.baseZ ?? 0), toolColorHex(c.weakToolId), 'collect');
  game.audio?.playCorrect();
  game.audio?.playNoiseGroan();
  boss.targetScale = 0.4 + (c.hp / c.maxHp) * 0.95;
  if (c.hp <= 0) {
    updateBossHud(game, ui);
    winBossFight(game, ui);
    return;
  }
  if (c.phaseHits >= PHASE_HITS) {
    breakBossShell(game, ui); // 이 주제의 껍질 격파 → 다음 아이템의 페이즈
  } else {
    // 같은 주제의 다른 상황 — 아이템은 그대로, 판단만 새로.
    c.memCounter += 1;
    c.weakMemory = pickMemory(c.weakToolId, c.memCounter);
    popBossMemory(ui, c);
  }
  updateBossHud(game, ui);
}

function fireNoiseWave(game) {
  const c = game.combat;
  const boss = game.renderState?.noiseBoss;
  const scene = game.renderState?.scene;
  if (!c || !boss || !scene) {
    return;
  }
  const bx = boss.baseX ?? 0;
  const bz = boss.baseZ ?? 0;
  let dx = game.player.position.x - bx;
  let dz = game.player.position.z - bz;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 0),
    new THREE.MeshStandardMaterial({ color: 0x8a5eff, emissive: 0x6a3dd0, emissiveIntensity: 1.1, roughness: 0.5, flatShading: true })
  );
  mesh.position.set(bx, 1.2, bz);
  scene.add(mesh);
  c.projectile = { mesh, dx, dz, x: bx, z: bz, life: 2.4 };
  game.audio?.playNoiseGroan();
}

function staggerPlayer(game, ui) {
  const c = game.combat;
  c.stun = STUN_TIME;
  const boss = game.renderState?.noiseBoss;
  // 화이트아웃 반대쪽으로 밀려난다.
  let dx = game.player.position.x - (boss?.baseX ?? 0);
  let dz = game.player.position.z - (boss?.baseZ ?? 0);
  const len = Math.hypot(dx, dz) || 1;
  game.player.position.x += (dx / len) * 1.3;
  game.player.position.z += (dz / len) * 1.3;
  game.player.position.copy(clampToIsland(game.player.position));
  game.audio?.playWrong();
  triggerFlash(ui, '#ff5f7e');
  addShake(game, 0.5);
  // 증거 임시 삭제: 피격 3회 누적이면 화이트아웃이 사건 증거 하나를 잠시 가린다.
  // 진짜 세이브(progress)는 건드리지 않는다 — 승리하면 그 자리에서 복구한다.
  c.staggers += 1;
  if (c.staggers >= 3 && !c.fragmentStolen) {
    c.fragmentStolen = true;
    flashCombatPopup(ui, '💔 사건 증거가 임시 삭제됐다!', 'stagger');
    ui.bossHint.textContent = '화이트아웃이 사건 증거 하나를 가렸다 — 검증해서 복구하자!';
    showNoiseWhisper(game, ui, 'WHITEOUT: 이의제기 자료를 불필요 기록으로 분류합니다.');
    return;
  }
  flashCombatPopup(ui, '회피 실패!', 'stagger');
  ui.bossHint.textContent = '잡음에 맞았다! 잠깐 정신 차리는 중…';
}

function updateCombat(delta, game, ui) {
  const c = game.combat;
  if (!c || !c.active) {
    return;
  }
  if (c.cooldown > 0) {
    c.cooldown = Math.max(0, c.cooldown - delta);
  }
  if (c.stun > 0) {
    c.stun = Math.max(0, c.stun - delta);
  }
  if (c.hintHold > 0) {
    c.hintHold = Math.max(0, c.hintHold - delta);
  }
  if (c.guard > 0) {
    c.guard = Math.max(0, c.guard - delta);
  }
  if (c.guardCd > 0) {
    c.guardCd = Math.max(0, c.guardCd - delta);
  }
  if (c.bellCd > 0) {
    c.bellCd = Math.max(0, c.bellCd - delta);
  }
  const boss = game.renderState?.noiseBoss;
  if (boss && boss.kind === 'noise') {
    c.driftAngle += delta * 0.5;
    boss.baseX = Math.cos(c.driftAngle) * 2.4;
    boss.baseZ = Math.sin(c.driftAngle) * 2.4;

    // 잡음 파도: 예고(windup) 후 플레이어 쪽으로 발사 → 피해야 한다.
    if (c.projectile) {
      const pr = c.projectile;
      pr.x += pr.dx * PROJECTILE_SPEED * delta;
      pr.z += pr.dz * PROJECTILE_SPEED * delta;
      pr.life -= delta;
      pr.mesh.position.set(pr.x, 1.2, pr.z);
      pr.mesh.rotation.x += delta * 6;
      const hit = Math.hypot(game.player.position.x - pr.x, game.player.position.z - pr.z) < PROJECTILE_HIT;
      if (hit && c.guard > 0) {
        // 🛡️ 가드 성공: 스턴 대신 파도를 받아쳐 흩어버린다.
        game.audio?.playCorrect();
        flashCombatPopup(ui, '🛡️ 반사!', 'hit');
        addShake(game, 0.2);
        game.hitStop = 0.05;
        ui.bossHint.textContent = '멋진 가드! 약속은 방패가 된다';
        c.hintHold = 1.4;
      } else if (hit && c.stun <= 0) {
        staggerPlayer(game, ui);
      }
      if (hit || pr.life <= 0) {
        game.renderState.scene.remove(pr.mesh);
        c.projectile = null;
        c.fireTimer = PHASE_FIRE[c.phase]; // 페이즈가 오를수록 빨라진다
      }
    } else if (c.windup > 0) {
      c.windup -= delta;
      boss.hitFlash = 0.18; // 예고: 몸이 번쩍인다
      if (c.windup <= 0) {
        fireNoiseWave(game);
      }
    } else {
      c.fireTimer -= delta;
      if (c.fireTimer <= 0) {
        c.windup = WINDUP_TIME;
        ui.bossHint.textContent = '화이트아웃이 삭제 명령을 준비한다 — 피해!';
      }
    }

    // 방금 뜬 이유/튕김 안내(hintHold)는 잠깐 유지하고, 그 외엔 상황 기반 기본 안내.
    if (c.stun <= 0 && !c.projectile && c.windup <= 0 && c.hintHold <= 0) {
      const dist = Math.hypot(game.player.position.x - boss.baseX, game.player.position.z - boss.baseZ);
      if (dist > ATTACK_RANGE) {
        ui.bossHint.textContent = '화이트아웃 핵심에 다가가요';
      } else if (c.revealed) {
        const weak = getToolById(c.weakToolId);
        ui.bossHint.textContent = `${weak?.emoji ?? ''} ${weak?.nameKo ?? ''}(으)로 바꿔서 공격!`;
      } else {
        ui.bossHint.textContent = c.tools[c.activeTool] === 'shield'
          ? '이 상황엔 어떤 약속이 필요할까? 공격! (도구버튼/F: 🛡️ 가드)'
          : '이 상황엔 어떤 약속이 필요할까? 도구를 골라 공격!';
      }
    }
  }
}

function updateBossHud(game, ui) {
  const c = game.combat;
  if (!c || !ui.bossFill) {
    return;
  }
  ui.bossFill.style.width = `${Math.round((c.hp / c.maxHp) * 100)}%`;
  if (ui.bossWeak) {
    const weak = getToolById(c.weakToolId);
    const active = getToolById(c.tools[c.activeTool]);
    // 정답 도구는 처음엔 숨기고 색만 힌트로 준다. 명중하거나 2연속 튕기면 공개.
    const weakMark = c.revealed ? (weak?.emoji ?? '?') : '?';
    ui.bossWeak.innerHTML = `껍질 ${c.phase + 1}/${PHASE_TOOLS.length} · 약점 <b style="color:${toolColorHex(c.weakToolId)}">${weakMark}</b> · 든 도구 ${active?.emoji ?? ''}`;
  }
  if (ui.bossMemory && c.weakMemory) {
    ui.bossMemory.textContent = c.weakMemory.textKo;
  }
  // 도구 벨트에서 현재 든 도구를 강조.
  if (ui.toolBelt) {
    const activeId = c.tools[c.activeTool];
    ui.toolBelt.querySelectorAll('[data-tool-slot]').forEach((slot) => {
      slot.dataset.active = String(slot.dataset.toolSlot === activeId);
    });
  }
}

function winBossFight(game, ui) {
  const c = game.combat;
  if (!c) {
    return;
  }
  c.active = false;
  if (c.projectile?.mesh) {
    game.renderState.scene.remove(c.projectile.mesh);
  }
  game.combat = null;
  ui.root.classList.remove('is-combat');
  ui.bossHud.hidden = true;
  if (ui.toolBelt) {
    ui.toolBelt.querySelectorAll('[data-tool-slot]').forEach((slot) => { slot.dataset.active = 'false'; });
  }
  if (ui.actionLabel) {
    ui.actionLabel.textContent = 'A';
  }
  const boss = game.renderState?.noiseBoss;
  if (boss) {
    boss.baseX = 0;
    boss.baseZ = 0;
    boss.targetScale = 0.42; // 지쳐 작게 웅크린다
  }
  game.audio?.setMusicMode?.('overworld'); // 긴장 해제 — 섬 패드로
  game.audio?.playCorrect();
  addShake(game, 0.55);
  game.hitStop = 0.09;
  flashCombatPopup(ui, '제압!', 'win');
  // 임시 삭제된 증거 반환 — 전투 안의 일시 상태였고, 이기면 그 자리에서 복구한다.
  if (c.fragmentStolen) {
    window.setTimeout(() => flashCombatPopup(ui, '💠 임시 삭제된 사건 증거를 복구했다!', 'win'), 650);
  }
  // 제압됨: 이후 대화를 닫아도 재전투가 아니라 코어 균열 장면을 재개한다.
  game.finaleResolving = true;
  window.setTimeout(() => {
    runFinale(game, ui, { fromCombat: true });
    openDialog(game, ui);
  }, 750);
}

// 2장 마무리: 화이트아웃 뒤에 사람의 승인 책임이 있음을 드러내고 3장 항로를 연다.
function runFinale(game, ui, opts = {}) {
  ui.dialogKicker.textContent = CORE_BREACH.titleKo;
  ui.dialogTitle.textContent = '끝이라고 생각한 순간';
  ui.root.classList.add('is-cinematic');
  const steps = getFinaleToolSteps(game.progress);
  const lines = (arr) => arr.map((text) => `<p class="finale-line">${text}</p>`).join('');
  const nav = (label, attr) =>
    `<div class="finale-nav"><button type="button" class="finale-next" ${attr}>${label}</button></div>`;

  function renderIntro() {
    // 코어 위에 거대한 화이트아웃 시각체가 등장한다.
    spawnNoiseBoss(game);
    if (game.renderState?.companion) {
      game.renderState.companion.visible = false;
    }
    game.audio?.playNoiseGroan();
    ui.dialogBody.innerHTML = `
      <div class="finale-scene" data-noise="big">${lines(CORE_BREACH.introKo)}</div>
      ${nav('마주 선다 →', 'data-finale="tools:0"')}
    `;
    bindNav();
  }

  function renderToolStep(index) {
    const step = steps[index];
    const isLast = index + 1 >= steps.length;
    // 도구를 쓸 때마다 화이트아웃의 삭제 껍질이 눈에 띄게 벗겨진다.
    shrinkNoiseBoss(game, steps.length - 1 - index, steps.length);
    ui.dialogBody.innerHTML = `
      <div class="finale-scene" data-noise="shrink">
        <p class="finale-count">약속의 도구 ${index + 1}/${steps.length}</p>
        <p class="finale-tool"><span class="finale-emoji">${step.emoji}</span> ${step.nameKo}</p>
        <p class="finale-line">${step.actionKo}</p>
        <p class="finale-line finale-result">${step.resultKo}</p>
      </div>
      ${nav(isLast ? '원본 명령서를 연다 →' : '다음 도구 →', `data-finale="${isLast ? 'reveal' : `tools:${index + 1}`}"`)}
    `;
    const topicColor = getTopicById(getToolById(step.toolId)?.topicId)?.color ?? '#7cf0ff';
    celebrate(game, new THREE.Vector3(0, 4.3, 0), topicColor, 'collect');
    game.audio?.playNoiseGroan(); // 화이트아웃 삭제 껍질이 깨지는 소리.
    bindNav();
  }

  function renderRevelation() {
    game.audio?.playNovaChime();
    ui.dialogBody.innerHTML = `
      <div class="finale-scene finale-revelation" data-noise="small">${lines(CORE_BREACH.revelationKo)}</div>
      ${nav('항로를 바라본다 →', 'data-finale="escape"')}
    `;
    bindNav();
  }

  function renderEscape() {
    const boss = game.renderState?.noiseBoss;
    if (boss?.group) {
      game.renderState.scene.remove(boss.group);
      game.renderState.noiseBoss = null;
    }
    if (game.renderState?.companion) {
      game.renderState.companion.visible = true;
    }
    ui.dialogBody.innerHTML = `
      <div class="finale-scene" data-noise="escape">${lines(CORE_BREACH.escapeKo)}</div>
      ${nav('3장 항로를 연다 →', 'data-finale="done"')}
    `;
    bindNav();
  }

  function finish() {
    const outcome = completeFinalCore(game.progress, 'balanced-promise');
    game.progress = outcome.progress;
    game.finaleResolving = false; // 완료 — 더는 재개 상태가 아니다.
    persistProgress(game.progress);
    updateHud(game, ui);
    closeDialog(game, ui);
    showCertificate(game, ui);
  }

  function bindNav() {
    const button = ui.dialogBody.querySelector('[data-finale]');
    if (!button) {
      return;
    }
    button.addEventListener('click', () => {
      game.audio?.playClick();
      const target = button.dataset.finale;
      if (target === 'reveal') {
        renderRevelation();
      } else if (target === 'escape') {
        renderEscape();
      } else if (target === 'done') {
        finish();
      } else if (target.startsWith('tools:')) {
        renderToolStep(Number(target.slice('tools:'.length)));
      }
    });
  }

  // 전투 뒤 첫 진입에는 호칭 반전을, 재개 시에는 항로 개방 장면을 보여 준다.
  if (opts.fromCombat) {
    if (game.finaleRevealed) {
      renderEscape();
    } else {
      game.finaleRevealed = true;
      renderRevelation();
    }
  } else {
    renderIntro();
  }
}

function openDialog(game, ui) {
  game.paused = true;
  ui.dialog.hidden = false;
  ui.prompt.hidden = true;
  // 모바일에서 대화창 뒤로 스틱·버튼이 비치지 않도록 숨긴다(대화 중엔 이동 불가).
  ui.root.classList.add('is-dialog-open');
  game.updateRotateHint?.();
}

function closeDialog(game, ui) {
  ui.dialog.hidden = true;
  ui.dialog.classList.remove('memory-dialog');
  game.paused = false;
  ui.root.classList.remove('is-dialog-open');
  ui.root.classList.remove('is-cinematic');
  ui.root.querySelector('[data-game-canvas]')?.focus?.();
  game.updateRotateHint?.();
  // 중지 후 선택 중이면(finaleResolving) 화이트아웃을 그대로 둔다 — 재접근 시 선택 재개.
  // 그 외에 최종장을 끝맺지 않고 닫았다면 시각체를 치우고 도트를 되돌린다.
  const boss = game.renderState?.noiseBoss;
  if (boss && boss.kind === 'noise' && !game.progress.aiCoreCompleted && !game.finaleResolving) {
    game.renderState.scene.remove(boss.group);
    game.renderState.noiseBoss = null;
    if (game.renderState.companion) {
      game.renderState.companion.visible = true;
    }
  }
}

function toggleJournal(game, ui) {
  if (ui.journal.hidden) {
    renderJournal(game, ui);
    ui.journal.hidden = false;
    ui.journalToggle.setAttribute('aria-expanded', 'true');
  } else {
    closeJournal(game, ui);
  }
}

function closeJournal(game, ui) {
  ui.journal.hidden = true;
  ui.journalToggle.setAttribute('aria-expanded', 'false');
}

function updateHud(game, ui) {
  const summary = getProgressSummary(game.progress.collectedFragments);
  const campaign = getCampaignSummary(game.progress);
  const chapter = campaign.current;
  // 진실의 등대 광선 수 — 진행이 바뀌는 지점마다 HUD와 함께 갱신된다(프레임당 재계산 방지).
  game.beaconCount = getStageStates(game.progress).filter((s) => s.state === 'completed').length;
  ui.chapterKicker.textContent = `${chapter.number}장`;
  ui.chapterTitle.textContent = chapter.titleKo;
  ui.objective.textContent = game.progress.aiCoreCompleted
    ? chapter.objectiveKo
    : getStoryObjective(game.progress);
  ui.fragmentCount.textContent = campaign.campaignCompleted
    ? '여정 완주'
    : `여정 ${campaign.completed}/${campaign.total}`;
  ui.journeyRail.innerHTML = campaign.chapters
    .map((item) => `
      <span
        class="journey-node"
        data-state="${item.state}"
        aria-label="${item.number}장 ${item.titleKo} · ${voyageStatusKo(item)}"
        title="${item.number}장 ${item.titleKo}"
      >${item.number}</span>
    `)
    .join('');
  // 목표 구배 가시화(R-루프2): 코어 개방 임계(3조각)까지 남은 거리를 생생하게 —
  // 하나 남았을 땐 '하나면 열려!'로 기대를 끌어올리고, 열리면 '중앙으로!'로 다음 행동을 가리킨다.
  const remainingToUnlock = Math.max(0, 3 - summary.collected);
  let coreState = 'locked';
  let coreText = 'AI 코어 잠김';
  if (game.progress.campaignCompleted) {
    coreState = 'done';
    coreText = 'H-17 공개 심리 완료 ✓';
  } else if (game.progress.aiCoreCompleted) {
    coreState = 'done';
    coreText = '원본 삭제 명령 확인 · 증거 항로 개방';
  } else if (summary.finalCoreUnlocked) {
    coreState = 'open';
    coreText = '🔓 AI 코어 열림 — 중앙으로!';
  } else if (remainingToUnlock === 1) {
    coreState = 'close';
    coreText = '✨ 조각 하나면 코어가 열려!';
  } else {
    coreText = `AI 코어 잠김 · 조각 ${remainingToUnlock}개 더`;
  }
  ui.coreStatus.textContent = coreText;
  if (ui.coreStatus) {
    ui.coreStatus.dataset.coreState = coreState;
  }
  ui.fragmentRow.innerHTML = ETHICS_TOPICS.map((topic) => {
    const collected = summary.collectedTopicIds.includes(topic.id);
    return `<span class="fragment-dot" style="--topic-color:${topic.color}" data-collected="${collected}" title="${topic.fragmentKo}">${topic.titleKo}</span>`;
  }).join('');
  if (ui.toolBelt) {
    const owned = new Set(game.progress.tools ?? []);
    ui.toolBelt.innerHTML = PROMISE_TOOLS.map((tool) => {
      const have = owned.has(tool.id);
      const title = have ? `${tool.nameKo} — ${tool.powerKo}` : `${tool.nameKo} (사당에서 획득)`;
      return `<button type="button" class="tool-slot" data-tool-slot="${tool.id}" data-have="${have}" ${have ? '' : 'disabled'} title="${title}">${have ? tool.emoji : '·'}</button>`;
    }).join('');
  }
  renderJournal(game, ui);
}

// 스테이지 상태 → 항로 지도 한 줄 문구.
function voyageStatusKo(stage) {
  if (stage.state === 'completed') {
    return '완료';
  }
  if (stage.state === 'current') {
    return '진행 중';
  }
  if (stage.state === 'coming') {
    return '항로 준비 중';
  }
  return '안개에 잠김';
}

function renderJournal(game, ui) {
  const summary = getProgressSummary(game.progress.collectedFragments);
  const report = getLearningReport(game.progress);
  const deeds = getStoryDeeds(game.progress);
  const voyage = getStageStates(game.progress);
  const campaign = getCampaignSummary(game.progress);
  ui.journalContent.innerHTML = `
    <p class="controls-note">${MOVE_HINT}</p>
    <section class="chapter-map" data-chapter-map>
      <h3>H-17 사건 · 여섯 장의 증거</h3>
      <ol class="chapter-list">
        ${campaign.chapters
          .map(
            (chapter) => `
          <li data-state="${chapter.state}" style="--chapter-color:${chapter.color}">
            <span class="chapter-number">${chapter.number}</span>
            <span class="chapter-copy">
              <strong>${chapter.titleKo}</strong>
              <small>${chapter.themeKo} · ${voyageStatusKo(chapter)}</small>
              <em>${chapter.questionKo}</em>
            </span>
          </li>`
          )
          .join('')}
      </ol>
      <p class="voyage-note">${campaign.campaignCompleted
        ? '여섯 장의 증거를 검증해 하루의 이름과 모든 학생의 이의제기권을 되찾았습니다.'
        : `${campaign.current.number}장 진행 중 — ${campaign.current.objectiveKo}`}</p>
    </section>
    <section class="voyage-map" data-voyage-map>
      <h3>항로와 지역</h3>
      <ol class="voyage-list">
        ${voyage
          .map(
            (stage) => `
          <li data-state="${stage.state}">
            <strong>${stage.state === 'locked' ? '🌫️' : stage.emoji} ${stage.nameKo}</strong>
            <span>${stage.frameKo} · ${voyageStatusKo(stage)}</span>
          </li>`
          )
          .join('')}
      </ol>
    </section>
    <section class="learning-report" data-bottle-log>
      <h3>🍾 항해일지 — 지식의 유리병 ${(game.progress.knowledgeBottles ?? []).length}/${KNOWLEDGE_BOTTLES.length}</h3>
      <ul class="report-list">
        ${KNOWLEDGE_BOTTLES.map((bottle) => {
          const found = (game.progress.knowledgeBottles ?? []).includes(bottle.id);
          return `<li>${found ? `🍾 ${bottle.tipKo}` : '🌫️ 아직 찾지 못한 유리병…'}</li>`;
        }).join('')}
      </ul>
      <p class="class-note">${(game.progress.knowledgeBottles ?? []).length >= KNOWLEDGE_BOTTLES.length
        ? '✨ 열두 병 완집! 정보의 바다를 항해하는 열두 가지 지혜를 모두 모았어요.'
        : '섬 곳곳(해변가·나무 뒤·등대 근처)에 반짝이는 유리병이 숨어 있어요. 찾을 때마다 지혜가 한 줄씩 늘어나요.'}</p>
    </section>
    ${deeds.length > 0
      ? `<section class="learning-report">
           <h3>📖 나의 감사 기록 — 사건을 바로잡은 행동</h3>
           <ul class="deed-list">${deeds.map((d) => `<li>${d.deedKo}</li>`).join('')}</ul>
         </section>`
      : ''}
    <ul class="topic-list">
      ${ETHICS_TOPICS.map((topic) => {
        const visited = game.progress.visitedTopics.includes(topic.id);
        const collected = summary.collectedTopicIds.includes(topic.id);
        return `
          <li>
            <strong>${topic.titleKo}</strong>
            <span>${collected ? '조각 획득' : visited ? '대화 완료' : '탐험 전'}</span>
            <p>${topic.studentTakeaway}</p>
          </li>
        `;
      }).join('')}
    </ul>
    <section class="learning-report" data-learning-report>
      <h3>학습 리포트</h3>
      <p>사당(퍼즐) 통과 ${report.solvedCount}/4 · 관문 윤리 선택 — 현명하게 ${report.gateSolvedCount}개, 실수 후 회복 ${report.gateRecoveredCount}개 · AI 코어 ${report.core.completed ? '완료' : '미완료'}</p>
      <p>6장 캠페인 — 완료한 장 ${campaign.completed}/${campaign.total} · 조사한 보관소 ${report.expansion.healedIsles}/${report.expansion.totalIsles} · 공간 윤리 퍼즐 ${report.expansion.chapter3dSolved}/3${report.expansion.chapter3dRecovered > 0 ? ` (실수 후 회복 ${report.expansion.chapter3dRecovered})` : ''} · 공개 심리 ${report.expansion.campaignCompleted ? '완료' : '준비 중'} · 하루의 감사 신호 ${report.expansion.lettersRead}/4 · 지식의 유리병 ${report.expansion.bottlesFound}/${report.expansion.bottlesTotal}</p>
      <ul class="report-list">
        ${report.topics
          .map((topic) => {
            const gate = topic.gateSolved || topic.gateBadTries > 0
              ? ` · 관문: <b${topic.gateRecovered ? ' style="color:#a06a12"' : ''}>${topic.gateStatusKo}</b>`
              : '';
            const deed = topic.gateDeedKo ? `<br><span class="report-deed">“${topic.gateDeedKo}”</span>` : '';
            return `<li><strong>${topic.titleKo}</strong> ${topic.gateSolved ? '조각 획득' : (topic.solved ? '사당 통과' : topic.statusKo)}${gate}${deed}</li>`;
          })
          .join('')}
      </ul>
      ${report.reviewTopics.length > 0
        ? `<p class="report-review-heading">다시 이야기해 볼 질문</p>
           <ul class="report-list">
             ${report.reviewTopics.map((topic) => `<li>${topic.reviewQuestionKo}</li>`).join('')}
           </ul>`
        : ''}
      <p class="class-note">이 리포트는 내 배움을 돌아보는 자료예요. 활동지에 옮겨 쓰고 모둠 토론에서 나눠 보세요.</p>
      <button type="button" class="report-reset" data-reset-progress>기록 초기화 (새 친구가 시작할 때)</button>
    </section>
  `;

  ui.journalContent.querySelector('[data-reset-progress]')?.addEventListener('click', () => {
    const confirmed = typeof window.confirm === 'function'
      ? window.confirm('탐험 기록을 모두 지우고 처음부터 시작할까요?')
      : true;
    if (!confirmed) {
      return;
    }
    clearStoredProgress();
    game.progress = createInitialProgress();
    updateHud(game, ui);
    // 공유 기기 재사용: HUD만 갱신하면 이미 주운 유리병·치유한 섬 등 3D 상태가
    // 이전 학생 것으로 남는다 — 재로드로 월드를 처음부터 다시 세워 진짜 새 출발을 보장.
    if (typeof window !== 'undefined' && window.location?.reload) {
      window.location.reload();
    }
  });
}

function updateCoreVisual(game, { coreCrystal, coreGlow }) {
  if (!coreCrystal) {
    return;
  }
  const unlocked = canUnlockFinalCore(game.progress.collectedFragments);
  coreCrystal.material.color.set(unlocked ? 0x6fe0be : 0x7c8790);
  coreCrystal.material.emissive.set(unlocked ? 0x2fbf9d : 0x182026);
  coreCrystal.material.emissiveIntensity = unlocked ? 0.82 : 0.35;
  if (coreGlow) {
    coreGlow.color.set(unlocked ? 0x6fe0be : 0x8fb4c9);
  }
}

function resize(renderer, camera, root, composer) {
  const width = Math.max(root.clientWidth, 320);
  const height = Math.max(root.clientHeight, 360);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (composer) {
    composer.setSize(width, height);
  }
}

function showRendererFallback(ui, error) {
  ui.dialogKicker.textContent = '그래픽 오류';
  ui.dialogTitle.textContent = '3D 화면을 시작할 수 없어요';
  ui.dialogBody.innerHTML = `
    <p>이 브라우저 또는 기기에서 WebGL을 사용할 수 없습니다. 최신 브라우저에서 다시 열어 주세요.</p>
    <p class="technical-note">${error.message}</p>
  `;
  ui.dialog.hidden = false;
}

if (typeof window !== 'undefined') {
  window.initEthicsQuest3D = initEthicsQuest3D;
  window.addEventListener('DOMContentLoaded', () => {
    initEthicsQuest3D();
  });
}
