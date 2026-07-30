import * as THREE from 'three';

import { createBroadcastProtocolState, stepBroadcastProtocol } from '../bosses/broadcastProtocol.js';
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
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    camera.lookAt(touch ? -1 : 0, touch ? 1.2 : 0.7, touch ? -68.5 : -68);
    renderer.setSize(viewport.width, viewport.height, false);
  }

  function showOutcome(decision = fixture.decision) {
    const finalized = finalizeCampaign(fixture.campaign, { decision });
    outcome = finalized.outcome;
    persist?.(finalized.state);
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
    ring.visible = !restoredOutcome && protocol.status === 'active';
    ringMaterial.color.setHex(PHASE_COLORS[phase.id]);
    canvas.dataset.protocolPhase = phase.id;
    canvas.dataset.protocolPhaseTick = String(protocol.phaseTick);
    canvas.dataset.protocolStatus = restoredOutcome ? 'resolved' : protocol.status;
    canvas.dataset.protocolHp = String(protocol.hp);
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
        const character = await factory.create(entry.id);
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
        accumulator += Math.min(Math.max(delta, 0), 0.1) * 60;
        while (accumulator >= 1 && protocol.status === 'active') {
          protocol = stepBroadcastProtocol(protocol).state;
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
      syncPresentation();
      renderer.render(scene, camera);
    }
  });
}
