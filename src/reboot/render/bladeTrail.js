import * as THREE from 'three';

// 검격 궤적 — SIGNAL BLADE 입력을 '보이게' 하는 전방 부채꼴 트레일.
// 풀 2개 재사용(연타 대응), 가산 블렌딩 평면 메시만 — 라이트·렌더타깃 0(저사양 예산 준수).
const ARC = Math.PI * 0.72; // 부채꼴 폭(약 130도)
const LIFE = 0.18; // 수명(초) — 선딜~유효 창 리듬에 맞춘 짧은 섬광

export function createBladeTrail({ scene }) {
  if (!scene?.isScene) throw new TypeError('검격 트레일에는 Three.js Scene이 필요합니다.');
  const geometry = new THREE.RingGeometry(0.5, 1.4, 20, 1, -ARC / 2, ARC);
  const slots = Array.from({ length: 2 }, (_, index) => {
    const material = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending, color: 0x6fe0ff, depthWrite: false,
      opacity: 0, side: THREE.DoubleSide, transparent: true
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `blade-trail-${index}`;
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    scene.add(mesh);
    return { age: 0, active: false, material, mesh };
  });
  let disposed = false;

  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const slot of slots) {
        slot.material.dispose();
        slot.mesh.removeFromParent();
      }
      geometry.dispose();
    },
    getDebugState() {
      return Object.freeze({ active: slots.filter((slot) => slot.active).length, disposed });
    },
    // 공격 시작 순간 플레이어 위치·바라보는 방향으로 궤적을 튕긴다. 체인 단계별로 색이 달아오른다.
    trigger(position, facing, chainLevel = 0) {
      if (disposed) return;
      const slot = slots.find((entry) => !entry.active) ?? slots[0];
      slot.active = true;
      slot.age = 0;
      slot.mesh.position.set(position.x, (position.y ?? 0) + 0.95, position.z);
      // RingGeometry의 0도는 +X — 바라보는 방향(atan2 기준)으로 부채꼴 중심을 돌린다.
      slot.mesh.rotation.z = Math.atan2(facing.z ?? 0, facing.x ?? 1) * -1;
      slot.material.color.setHex(chainLevel >= 2 ? 0xffd76a : chainLevel === 1 ? 0x9fe8ff : 0x6fe0ff);
      slot.material.opacity = 0.85;
      slot.mesh.scale.setScalar(0.8);
      slot.mesh.visible = true;
    },
    update(delta) {
      if (disposed) return;
      const elapsed = Math.max(0, Math.min(0.1, delta));
      for (const slot of slots) {
        if (!slot.active) continue;
        slot.age += elapsed;
        const progress = Math.min(1, slot.age / LIFE);
        slot.material.opacity = 0.85 * (1 - progress);
        slot.mesh.scale.setScalar(0.8 + progress * 0.55);
        if (progress >= 1) {
          slot.active = false;
          slot.mesh.visible = false;
        }
      }
    }
  });
}
