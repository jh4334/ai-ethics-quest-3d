import * as THREE from 'three';

import { createCharacterFactory } from '../characters/factory.js';

const PHASE_COLORS = Object.freeze({
  'approval-core': 0xf4b85f,
  'reflect-scan': 0x5de0c1,
  'trace-roster': 0xa787ff
});

export function createBossCast({
  characterFactory = null,
  position = { x: 0, z: -104 },
  scene
}) {
  // 팩토리를 주입받으면 GLTF 캐시를 다른 캐스트와 공유한다 — 소유자만 폐기.
  const ownsFactory = characterFactory === null;
  characterFactory = characterFactory ?? createCharacterFactory();
  if (!scene?.isScene) throw new TypeError('보스 캐스트에는 Three.js Scene이 필요합니다.');
  const root = new THREE.Group();
  root.name = 'attendance-proctor-cast';
  root.position.set(position.x, 0, position.z);
  const anchor = new THREE.Group();
  root.add(anchor);

  const ringGeometry = new THREE.RingGeometry(1.35, 1.62, 32);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: PHASE_COLORS['reflect-scan'],
    depthWrite: false,
    opacity: 0.78,
    side: THREE.DoubleSide,
    transparent: true
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.name = 'boss-telegraph-ring';
  ring.position.y = 0.04;
  ring.rotation.x = -Math.PI / 2;
  root.add(ring);
  scene.add(root);

  let character = null;
  let disposed = false;
  let errors = [];
  let phaseId = 'reflect-scan';
  let status = 'active';
  let cue = 'none';

  function present(state, events = []) {
    const phase = state.definition.phases[state.phaseIndex];
    phaseId = phase.id;
    status = state.status;
    cue = events.at(-1)?.type ?? cue;
    ring.visible = state.status === 'active';
    ringMaterial.color.setHex(PHASE_COLORS[phase.id]);
    const progress = state.phaseTick / Math.max(1, phase.timing.windupTicks);
    ring.scale.setScalar(0.86 + Math.min(1, progress) * 0.22);
    root.userData = { cue, phaseId, status };
  }

  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      if (ownsFactory) characterFactory.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      root.removeFromParent();
      errors = [];
    },
    getDebugState() {
      return Object.freeze({ cue, disposed, errors: Object.freeze([...errors]), loaded: character !== null, phaseId, status });
    },
    async load() {
      if (disposed) throw new Error('폐기된 보스 캐스트는 로드할 수 없습니다.');
      if (character) return character;
      try {
        character = await characterFactory.create('attendance-proctor');
        if (disposed) character.dispose();
        else anchor.add(character.root);
      } catch (error) {
        if (!disposed) errors.push(error.message);
      }
      return character;
    },
    present,
    update(delta, state) {
      if (!character || disposed) return;
      const phase = state.definition.phases[state.phaseIndex];
      const acting = state.status === 'active' && state.phaseTick >= phase.timing.windupTicks;
      character.update(delta, {
        acting,
        defeated: state.status === 'victory',
        hit: state.staggerTicks > 0,
        moving: false
      });
    }
  });
}
