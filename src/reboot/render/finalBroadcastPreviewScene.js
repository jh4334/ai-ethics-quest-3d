import * as THREE from 'three';

import { PULSE_RULES, createBroadcastProtocolState, stepBroadcastProtocol } from '../bosses/broadcastProtocol.js';
import { finalizeCampaign } from '../campaign/endingEvaluator.js';
import { createFinaleFixture } from '../campaign/finaleFixtures.js';
import { createCharacterFactory } from '../characters/factory.js';
import { CHAPTER_FIVE } from '../content/chapters/catalog.js';
import { chapterFiveLevel } from '../content/levels/chapter5.js';
import { createDisposableRegistry } from './dispose.js';
import { createCampaignLandmarks } from './campaignLandmarks.js';
import { createSceneRadio } from './sceneRadio.js';
import { createSchoolRoute } from './schoolRoute.js';
import { getSceneViewport } from './schoolSceneCamera.js';

const CAST = Object.freeze([
  Object.freeze({ id: 'player', position: [0, 0, -60], rotation: Math.PI }),
  Object.freeze({ id: 'haru', position: [-4.3, 0, -68], rotation: 0 }),
  Object.freeze({ id: 'dot', position: [-1.4, 0, -70], rotation: 0 }),
  Object.freeze({ id: 'lumen', position: [2.2, 0, -70], rotation: 0 })
]);
const PHASE_COLORS = Object.freeze({
  'dash-relay': 0xf3b36c,
  'reflect-shield': 0x5de0c1,
  'signal-core': 0xd74732,
  'trace-consent': 0x6aa9ff
});
const FINAL_FRAME_SUBJECTS = Object.freeze([
  Object.freeze({ halfX: 0.8, halfZ: 0.8, id: 'player', top: 2.8, x: 0, z: -60 }),
  Object.freeze({ halfX: 1.3, halfZ: 1.5, id: 'haru-platform', top: 2.8, x: -4.3, z: -68 }),
  Object.freeze({ halfX: 1.1, halfZ: 1.3, id: 'dot-platform', top: 2.5, x: -1.4, z: -70 }),
  Object.freeze({ halfX: 1.4, halfZ: 1.5, id: 'lumen-platform', top: 2.8, x: 2.2, z: -70 })
]);

// 게이지 채움 너비(%) — 0~100으로 자른 정수 문자열. 값이 없으면 null(S3a 계약과 동일).
function fillPercent(value, max) {
  if (!Number.isFinite(value) || !(max > 0)) return null;
  return `${Math.max(0, Math.min(100, Math.round((value / max) * 100)))}%`;
}

// 텍스트 칩(구형) ↔ 채움 바(신형) 겸용 — schoolSceneHud와 같은 계약으로 HP·SIGNAL을 갱신한다.
function syncGauge(ui, { container, fill, label }, text, width) {
  if (ui[label]) ui[label].textContent = text;
  else if (ui[container]) ui[container].textContent = text;
  if (ui[fill]?.style && width !== null) ui[fill].style.width = width;
}

function inspectFinaleFrame(camera, viewport) {
  camera.updateMatrixWorld(true);
  const safeRect = Object.freeze({
    bottom: viewport.height - (viewport.mode === 'touch' ? 154 : 24),
    left: viewport.mode === 'touch' ? 8 : 24,
    right: viewport.width - (viewport.mode === 'touch' ? 8 : 24),
    top: viewport.mode === 'touch' ? 120 : 70
  });
  const bounds = FINAL_FRAME_SUBJECTS.map((subject) => {
    const points = [];
    for (const x of [-subject.halfX, subject.halfX]) for (const y of [0, subject.top]) {
      for (const z of [-subject.halfZ, subject.halfZ]) {
        const point = camera.position.clone().set(subject.x + x, y, subject.z + z).project(camera);
        points.push({ depth: point.z, x: (point.x + 1) * viewport.width / 2, y: (1 - point.y) * viewport.height / 2 });
      }
    }
    return Object.freeze({
      bottom: Math.max(...points.map((point) => point.y)), id: subject.id,
      left: Math.min(...points.map((point) => point.x)), right: Math.max(...points.map((point) => point.x)),
      top: Math.min(...points.map((point) => point.y)), visibleDepth: points.every((point) => Math.abs(point.depth) <= 1)
    });
  });
  const inside = (box) => box.visibleDepth && box.left >= safeRect.left && box.right <= safeRect.right
    && box.top >= safeRect.top && box.bottom <= safeRect.bottom;
  const includedIds = Object.freeze(bounds.filter(inside).map(({ id }) => id));
  return Object.freeze({ allIncluded: includedIds.length === bounds.length, bounds: Object.freeze(bounds), includedIds, safeRect });
}

export function createFinalBroadcastPreviewScene({
  campaign = null, canvas, endingId = null, input, persist, renderer, ui = {}, windowRef = window
}) {
  const fixture = endingId ? createFinaleFixture(endingId) : { campaign, decision: null };
  if (!fixture.campaign) throw new TypeError('마지막 방송에는 캠페인 저장 상태가 필요합니다.');
  const resources = createDisposableRegistry();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07101d);
  scene.fog = new THREE.Fog(0x07101d, 28, 72);
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
  camera.position.set(0, 6.4, -51.5);
  camera.lookAt(0, 0.7, -68);
  const route = resources.register(createSchoolRoute({ level: chapterFiveLevel, lightLimit: 0, scene }), 'final-route');
  const landmarks = resources.register(createCampaignLandmarks({
    scene, type: 'finale', variant: endingId === 'sealed' ? 'purge' : 'secure'
  }), 'final-landmarks');
  const factory = resources.register(createCharacterFactory(), 'final-cast');
  const ringGeometry = resources.register(new THREE.RingGeometry(2.1, 2.45, 40), 'protocol-ring-geometry');
  const ringMaterial = resources.register(new THREE.MeshBasicMaterial({
    color: PHASE_COLORS['reflect-shield'],
    opacity: 0.82,
    side: THREE.DoubleSide,
    transparent: true
  }), 'protocol-ring-material');
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.set(0.4, 0.05, -69.5);
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);
  // LUMEN 압박 펄스 텔레그래프(S3c) — 기존 링 지오메트리를 재사용한 경고 링이 LUMEN 발밑에서
  // 윈드업 잔여 틱에 따라 줄어든다(새 라이트·렌더타깃 0, 재질 1개 추가).
  const pulseRingMaterial = resources.register(new THREE.MeshBasicMaterial({
    color: PHASE_COLORS['signal-core'],
    opacity: 0.85,
    side: THREE.DoubleSide,
    transparent: true
  }), 'pulse-ring-material');
  const pulseRing = new THREE.Mesh(ringGeometry, pulseRingMaterial);
  pulseRing.position.set(2.2, 0.07, -70);
  pulseRing.rotation.x = -Math.PI / 2;
  pulseRing.visible = false;
  scene.add(pulseRing);
  scene.add(new THREE.HemisphereLight(0xc9d8ff, 0x271626, 3));
  const fill = new THREE.PointLight(0xffd39a, 3.6, 34, 1.8);
  fill.position.set(0, 6, -61);
  fill.castShadow = false;
  scene.add(fill);

  const castRoot = new THREE.Group();
  castRoot.name = 'final-broadcast-character-cast';
  scene.add(castRoot);
  const anchors = new Map();
  const characters = new Map();
  const errors = [];
  let protocol = createBroadcastProtocolState(fixture.campaign);
  // 시나리오 v2 — 도입·프로토콜 단계·결말 대본을 무전 자막으로(정본: docs/reboot/시나리오-v2.md).
  const radio = createSceneRadio(ui);
  const script = CHAPTER_FIVE.sceneScript ?? {};
  let outcome = null;
  let accumulator = 0;
  let entered = false;
  let unsubscribeInput = null;
  const alreadyResolved = /^chapter-5:resolved-/.test(fixture.campaign.chapterProgress.checkpoint);
  // 타격감(GF1) — 펄스 명중 순간 시뮬만 벽시계 기준으로 잠깐 멈추고(캠페인 방과 동일 규칙),
  // 카메라는 기존 컨트롤러의 셰이크 공식(감쇠 1.4, 위상 ×19)을 그대로 빌려 흔든다.
  const reducedMotion = fixture.campaign.settings?.motion === 'reduced';
  const cameraBase = new THREE.Vector3();
  let hitStop = 0;
  let shakeAmount = 0;
  let shakePhase = 0;

  function absorbProtocolEvents(events) {
    for (const event of events) {
      if (event.type === 'lumen-pulse-hit') {
        hitStop = Math.min(0.12, hitStop + 0.07);
        if (!reducedMotion) shakeAmount = Math.min(0.35, Math.max(shakeAmount, 0.24));
      }
    }
  }

  for (const entry of CAST) {
    const anchor = new THREE.Group();
    anchor.position.set(...entry.position);
    anchor.rotation.y = entry.rotation;
    castRoot.add(anchor);
    anchors.set(entry.id, anchor);
  }

  function resize() {
    const viewport = getSceneViewport(canvas);
    const touch = viewport.mode === 'touch';
    camera.fov = touch ? 58 : 44;
    camera.position.set(touch ? -1 : 0, touch ? 8 : 6.4, touch ? -44.5 : -51.5);
    cameraBase.copy(camera.position); // 셰이크 기준점 — 흔들림은 이 기준에서의 오프셋으로만 계산한다.
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    camera.lookAt(touch ? -1 : 0, touch ? 1.2 : 0.7, touch ? -68.5 : -68);
    renderer.setSize(viewport.width, viewport.height, false);
  }

  function showOutcome(decision = fixture.decision) {
    const finalized = finalizeCampaign(fixture.campaign, { decision });
    outcome = finalized.outcome;
    persist?.(finalized.state);
    landmarks.setOnAir?.(true); // 결말 확정 — ON AIR 사인 점등(시나리오 v2: 5장 방)
    // 결말 대본 + 공통 에필로그(DOT의 권한 반납) — 도덕 낙인 없이 인물의 목소리로 닫는다.
    radio.play(
      [...(script.endings?.[outcome.id] ?? []), ...(script.epilogue ?? [])],
      { interrupt: true }
    );
    if (ui.result) {
      ui.result.hidden = false;
      const heading = ui.result.querySelector('h2');
      if (heading) heading.textContent = outcome.titleKo;
    }
    if (ui.resultAction) ui.resultAction.textContent = outcome.peopleChanges.join(' ');
    if (ui.resultConsequence) ui.resultConsequence.textContent = outcome.worldChanges.join(' ');
    if (ui.resultReversal) ui.resultReversal.textContent = outcome.costs.join(' ');
    if (ui.continueButton) {
      ui.continueButton.hidden = false;
      ui.continueButton.textContent = '결과 기록 유지';
    }
    canvas.dataset.campaignEnding = outcome.id;
  }

  function syncPresentation() {
    const phase = protocol.definition.phases[protocol.phaseIndex];
    const restoredOutcome = alreadyResolved && outcome !== null;
    const pulseActive = !restoredOutcome && protocol.status === 'active' && protocol.pulseWindupRemaining !== null;
    ring.visible = !restoredOutcome && protocol.status === 'active';
    ringMaterial.color.setHex(PHASE_COLORS[phase.id]);
    pulseRing.visible = pulseActive;
    canvas.dataset.protocolPhase = phase.id;
    canvas.dataset.protocolPhaseTick = String(protocol.phaseTick);
    canvas.dataset.protocolStatus = restoredOutcome ? 'resolved' : protocol.status;
    canvas.dataset.protocolHp = String(protocol.hp);
    canvas.dataset.protocolPlayerHp = String(protocol.playerHp);
    canvas.dataset.protocolPulse = pulseActive ? 'windup' : 'none';
    canvas.dataset.playerSignal = String(protocol.playerSignal);
    // S3a 게이지 계약 — 피날레에서도 HP·SIGNAL 바를 캠페인 방과 같은 방식으로 채운다.
    syncGauge(
      ui, { container: 'health', fill: 'healthFill', label: 'healthLabel' },
      `HP ${protocol.playerHp}`, fillPercent(protocol.playerHp, PULSE_RULES.maxPlayerHp)
    );
    syncGauge(
      ui, { container: 'signal', fill: 'signalFill', label: 'signalLabel' },
      `SIGNAL ${protocol.playerSignal}`, fillPercent(protocol.playerSignal, PULSE_RULES.maxPlayerSignal)
    );
    // 예고 칩 재사용 — 윈드업 동안에만 기존 피드백 칩으로 방어 키를 알린다.
    if (ui.feedback) {
      ui.feedback.hidden = !pulseActive;
      ui.feedback.textContent = pulseActive ? 'LUMEN 압박 펄스 — K 반사로 무효화!' : '';
    }
    canvas.dataset.characters = errors.length > 0 ? 'error' : characters.size === CAST.length ? 'ready' : 'loading';
    if (ui.objective) ui.objective.textContent = restoredOutcome
      ? '기록된 마지막 방송 결과입니다'
      : protocol.status === 'victory'
        ? outcome ? '방송 대기열의 결과를 확인하세요' : 'F 검증 가능한 방송 · Q 사건 봉인'
        : `${phase.response.toUpperCase()} — ${phase.id}`;
    if (ui.enemy) ui.enemy.textContent = `LUMEN + DOT ${protocol.hp}`;
    if (ui.action) ui.action.textContent = restoredOutcome ? 'RECORDED' : phase.response.toUpperCase();
    if (ui.chain) ui.chain.textContent = restoredOutcome ? '5/5 COMPLETE' : `${protocol.phaseIndex + 1}/4 PROTOCOL`;
  }

  function queueAction({ action, active }) {
    if (!active) return;
    if (protocol.status === 'victory' && !outcome) {
      if (action === 'secure') showOutcome('broadcast');
      if (action === 'purge') showOutcome('contain');
      syncPresentation();
      return;
    }
    if (protocol.status !== 'active') return;
    if (!['reflect', 'trace', 'dash', 'attack'].includes(action)) return;
    const phaseBefore = protocol.phaseIndex;
    const result = stepBroadcastProtocol(protocol, {
      actions: [{
        id: `${protocol.tick}:${action}`,
        targetId: action === 'trace' ? 'consent-ledger' : undefined,
        type: action
      }]
    });
    protocol = result.state;
    absorbProtocolEvents(result.events);
    // 프로토콜 한 단계를 넘었을 때 그 동사의 의미를 무전으로(시나리오 v2).
    if (protocol.phaseIndex > phaseBefore || protocol.status === 'victory') {
      radio.play([script.stepCues?.[phaseBefore]].filter(Boolean), { interrupt: true });
    }
    if (protocol.status === 'victory' && fixture.decision) showOutcome();
    syncPresentation();
  }

  async function loadCast() {
    // 완료 순서가 아니라 저작(CAST) 순서로 삽입한다 — characterIds 관측이 결정적이 되게.
    const loaded = await Promise.all(CAST.map(async (entry) => {
      try {
        // DOT는 3장 이후 균열 표식을 단다(시나리오 v2 — 동기화 사고의 흔적).
        const character = await factory.create(entry.id, { fractured: entry.id === 'dot' });
        if (!entered) {
          character.dispose();
          return null;
        }
        return { character, entry };
      } catch (error) {
        if (entered) errors.push(`${entry.id}: ${error.message}`);
        return null;
      }
    }));
    for (const item of loaded) {
      if (!item) continue;
      anchors.get(item.entry.id).add(item.character.root);
      characters.set(item.entry.id, item.character);
    }
    if (entered) syncPresentation();
  }

  return Object.freeze({
    dispose() {
      unsubscribeInput?.();
      radio.clear();
      ring.removeFromParent();
      pulseRing.removeFromParent();
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
      loadCast();
      if (alreadyResolved) {
        showOutcome();
        syncPresentation();
      } else {
        radio.play(script.briefing);
      }
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
        characterErrors: Object.freeze([...errors]),
        characterIds: Object.freeze([...characters.keys()]),
        finaleFrame: inspectFinaleFrame(camera, getSceneViewport(canvas)),
        landmarks: landmarks.getDebugState(),
        outcome,
        protocol,
        route: route.getDebugState()
      });
    },
    update(delta) {
      radio.update(delta);
      if (protocol.status === 'active') {
        // 히트스톱 동안 프로토콜 시뮬만 벽시계 기준으로 멈춘다(렌더·무전·카메라는 계속).
        const stopped = hitStop > 0;
        if (stopped) hitStop = Math.max(0, hitStop - delta);
        accumulator += (stopped ? 0 : Math.min(Math.max(delta, 0), 0.1)) * 60;
        while (accumulator >= 1 && protocol.status === 'active') {
          const result = stepBroadcastProtocol(protocol);
          protocol = result.state;
          absorbProtocolEvents(result.events);
          accumulator -= 1;
        }
      } else {
        accumulator = 0;
      }
      const phase = protocol.definition.phases[protocol.phaseIndex];
      for (const [id, character] of characters) {
        character.update(delta, { acting: ['dot', 'lumen'].includes(id) && protocol.status === 'active' });
      }
      ring.scale.setScalar(0.9 + Math.min(1, protocol.phaseTick / phase.timing.windupTicks) * 0.16);
      // 경고 링 — 윈드업 잔여 틱만큼 LUMEN 쪽으로 조여든다(잔여가 줄수록 작아진다).
      if (protocol.pulseWindupRemaining !== null) {
        pulseRing.scale.setScalar(0.55 + (protocol.pulseWindupRemaining / PULSE_RULES.windupTicks) * 0.75);
      }
      // 화면 흔들림 — 카메라 컨트롤러(GF1)와 같은 감쇠·위상 공식, 기준점 오프셋으로만 적용.
      if (shakeAmount > 0) {
        shakePhase += delta * 19;
        camera.position.set(
          cameraBase.x + Math.sin(shakePhase) * shakeAmount,
          cameraBase.y + Math.cos(shakePhase * 1.3) * shakeAmount * 0.7,
          cameraBase.z
        );
        shakeAmount = Math.max(0, shakeAmount - 1.4 * delta);
        if (shakeAmount === 0) camera.position.copy(cameraBase);
      }
      syncPresentation();
      renderer.render(scene, camera);
    }
  });
}
