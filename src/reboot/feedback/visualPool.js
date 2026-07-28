import * as THREE from 'three';

const COLORS = Object.freeze({
  telegraph: 0xf4b85f, contact: 0xffffff, miss: 0x9aa8c7, reflect: 0x5de0c1,
  'weak-point': 0xa787ff, secure: 0x67e8f9, 'chain-up': 0xf4c06d,
  damage: 0xff6b7a, defeat: 0xd7deed
});

function createSlot(index, ringGeometry, markGeometry) {
  const group = new THREE.Group();
  group.name = `feedback-slot-${index}`;
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff, depthTest: false, depthWrite: false, opacity: 0, transparent: true
  });
  const ring = new THREE.Mesh(ringGeometry, material);
  ring.rotation.x = -Math.PI / 2;
  const mark = new THREE.Mesh(markGeometry, material);
  mark.position.y = 0.75;
  group.add(ring, mark);
  group.visible = false;
  return { age: 0, cue: null, group, life: 0.72, mark, material, ring };
}

export function createCombatFeedbackPool({ capacity = 12, scene }) {
  if (!scene?.isScene) throw new TypeError('피드백 풀에는 Three.js Scene이 필요합니다.');
  const safeCapacity = Number.isInteger(capacity) ? Math.max(1, Math.min(32, capacity)) : 12;
  const ringGeometry = new THREE.RingGeometry(0.58, 0.72, 16);
  const markGeometry = new THREE.PlaneGeometry(0.42, 0.12);
  const slots = Array.from({ length: safeCapacity }, (_, index) => (
    createSlot(index, ringGeometry, markGeometry)
  ));
  for (const slot of slots) scene.add(slot.group);
  let disposed = false;

  function resetSlot(slot) {
    slot.age = 0;
    slot.cue = null;
    slot.group.visible = false;
    slot.material.opacity = 0;
  }

  function selectSlot() {
    return slots.find((slot) => slot.cue === null)
      ?? [...slots].sort((first, second) => first.cue.priority - second.cue.priority || second.age - first.age)[0];
  }

  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const slot of slots) {
        slot.material.dispose();
        slot.group.removeFromParent();
        resetSlot(slot);
      }
      ringGeometry.dispose();
      markGeometry.dispose();
    },
    getDebugState() {
      return Object.freeze({
        active: slots.filter((slot) => slot.cue !== null).length,
        allocated: slots.length,
        capacity: safeCapacity,
        disposed,
        kinds: Object.freeze(slots.flatMap((slot) => slot.cue ? [slot.cue.kind] : []))
      });
    },
    present(cues, positions = new Map(), { reducedMotion = false } = {}) {
      if (disposed) return;
      for (const feedback of Array.isArray(cues) ? cues : []) {
        const slot = selectSlot();
        const point = positions.get(feedback.targetId) ?? positions.get('player') ?? { x: 0, y: 0, z: 0 };
        slot.age = 0;
        slot.cue = feedback;
        slot.life = feedback.kind === 'telegraph' ? 1.05 : 0.72;
        slot.group.position.set(point.x, point.y + 0.08, point.z);
        slot.group.scale.setScalar(reducedMotion ? 0.9 : 0.62);
        slot.group.visible = true;
        slot.group.userData = { kind: feedback.kind, label: feedback.label, shape: feedback.shape };
        slot.mark.rotation.z = (FEEDBACK_KINDS_INDEX[feedback.kind] ?? 0) * Math.PI / 8;
        slot.material.color.setHex(COLORS[feedback.kind] ?? 0xffffff);
        slot.material.opacity = 0.92;
      }
    },
    reset() {
      for (const slot of slots) resetSlot(slot);
    },
    update(delta, { reducedMotion = false } = {}) {
      if (disposed) return;
      const elapsed = Math.max(0, Math.min(0.1, delta));
      for (const slot of slots) {
        if (!slot.cue) continue;
        slot.age += elapsed;
        const progress = Math.min(1, slot.age / slot.life);
        slot.material.opacity = 0.92 * (1 - progress);
        if (!reducedMotion) slot.group.scale.setScalar(0.62 + progress * 0.72);
        if (progress >= 1) resetSlot(slot);
      }
    }
  });
}

const FEEDBACK_KINDS_INDEX = Object.freeze({
  telegraph: 0, contact: 1, miss: 2, reflect: 3, 'weak-point': 4,
  secure: 5, 'chain-up': 6, damage: 7, defeat: 8
});
