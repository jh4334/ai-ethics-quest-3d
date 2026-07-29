import * as THREE from 'three';

import { completeCampaignChapter } from '../campaign/chapterProgression.js';
import { createCharacterFactory } from '../characters/factory.js';
import { CHAPTERS_2_5 } from '../content/chapters/catalog.js';
import { chapterTwoLevel } from '../content/levels/chapter2.js';
import { chapterThreeLevel } from '../content/levels/chapter3.js';
import { chapterFourLevel } from '../content/levels/chapter4.js';
import { createDisposableRegistry } from './dispose.js';
import { createCampaignLandmarks } from './campaignLandmarks.js';
import { createSchoolRoute } from './schoolRoute.js';
import { getSceneViewport } from './schoolSceneCamera.js';

const CONFIGS = Object.freeze({
  2: Object.freeze({ actions: ['reflect', 'trace', 'attack'], cast: ['player', 'copycat', 'copycat'], level: chapterTwoLevel }),
  3: Object.freeze({ actions: ['trace', 'trace', 'attack'], cast: ['player', 'dot', 'recommender'], level: chapterThreeLevel }),
  4: Object.freeze({ actions: ['reflect', 'trace', 'attack'], cast: ['player', 'yoonseo', 'approval'], level: chapterFourLevel })
});
const POSITIONS = Object.freeze([[0, 0, -17], [-3, 0, -23], [3, 0, -23]]);
const COLORS = Object.freeze([0x5de0c1, 0x6aa9ff, 0xd74732]);
const LANDMARK_TYPES = Object.freeze({ 2: 'share-chain', 3: 'dual-school', 4: 'approval-room' });

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
  camera.position.set(0, 6.2, -9.5);
  camera.lookAt(0, 0.7, -23);
  const route = resources.register(createSchoolRoute({ level: config.level, lightLimit: 0, scene }), 'campaign-route');
  const landmarks = resources.register(createCampaignLandmarks({ scene, type: LANDMARK_TYPES[chapter] }), 'campaign-landmarks');
  const factory = resources.register(createCharacterFactory(), 'campaign-cast');
  const ringGeometry = resources.register(new THREE.RingGeometry(1.45, 1.72, 32), 'campaign-ring-geometry');
  const ringMaterial = resources.register(new THREE.MeshBasicMaterial({
    color: COLORS[0], opacity: 0.82, side: THREE.DoubleSide, transparent: true
  }), 'campaign-ring-material');
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.set(0, 0.05, -23);
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);
  scene.add(new THREE.HemisphereLight(0xbfd3ff, 0x29162b, 3));
  const fill = new THREE.PointLight(0xffd39a, 3.2, 32, 1.8);
  fill.position.set(0, 6, -17);
  fill.castShadow = false;
  scene.add(fill);

  const castRoot = new THREE.Group();
  scene.add(castRoot);
  const characters = new Map();
  const errors = [];
  let actionIndex = 0;
  let awaitingDecision = false;
  let completed = null;
  let entered = false;
  let unsubscribeInput = null;
  const anchors = config.cast.map((id, index) => {
    const anchor = new THREE.Group();
    anchor.position.set(...POSITIONS[index]);
    anchor.rotation.y = index === 0 ? Math.PI : 0;
    castRoot.add(anchor);
    return { anchor, id, key: `${id}-${index}` };
  });

  function resize() {
    const viewport = getSceneViewport(canvas);
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.width, viewport.height, false);
  }

  function syncPresentation() {
    const expected = config.actions[actionIndex] ?? null;
    ring.visible = !awaitingDecision && completed === null;
    ringMaterial.color.setHex(COLORS[Math.min(actionIndex, COLORS.length - 1)]);
    canvas.dataset.campaignChapter = String(chapter);
    canvas.dataset.campaignStep = String(actionIndex);
    canvas.dataset.campaignExpectedAction = expected ?? 'decision';
    canvas.dataset.campaignCompleted = String(completed !== null);
    canvas.dataset.characters = errors.length > 0 ? 'error' : characters.size === anchors.length ? 'ready' : 'loading';
    if (ui.action) ui.action.textContent = expected?.toUpperCase() ?? 'F / Q';
    if (ui.chain) ui.chain.textContent = `${Math.min(actionIndex + 1, config.actions.length)}/${config.actions.length} LOOP`;
    if (ui.enemy) ui.enemy.textContent = content.boss.id.toUpperCase();
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
  }

  function queueAction({ action, active }) {
    if (!active || completed) return;
    if (awaitingDecision) {
      if (action === 'secure') finish('secure');
      if (action === 'purge') finish('purge');
      syncPresentation();
      return;
    }
    if (action !== config.actions[actionIndex]) return;
    actionIndex += 1;
    awaitingDecision = actionIndex === config.actions.length;
    syncPresentation();
  }

  async function loadCast() {
    await Promise.all(anchors.map(async ({ anchor, id, key }) => {
      try {
        const character = await factory.create(id);
        if (!entered) return character.dispose();
        anchor.add(character.root);
        characters.set(key, character);
      } catch (error) {
        if (entered) errors.push(`${key}: ${error.message}`);
      }
    }));
    if (entered) syncPresentation();
  }

  return Object.freeze({
    dispose() {
      unsubscribeInput?.();
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
        actionIndex, awaitingDecision, completed, errors: Object.freeze([...errors]),
        landmarks: landmarks.getDebugState(), route: route.getDebugState()
      });
    },
    update(delta) {
      for (const character of characters.values()) character.update(delta, { acting: !awaitingDecision && !completed });
      renderer.render(scene, camera);
    }
  });
}
