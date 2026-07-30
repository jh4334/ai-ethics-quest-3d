import * as THREE from 'three';

// 적 머리 위 HP 링(얇은 빌보드 바) — 적당 평면 2장(배경+채움)만 쓴다.
// 렌더 예산: 신규 라이트 0, 그림자 캐스터 0, 렌더타깃 0. MeshBasicMaterial(발광·라이트 무의존).
const BAR_WIDTH = 1.15;
const BAR_HEIGHT = 0.11;
const BAR_Y_OFFSET = 2.05;

export function createEnemyHpBars({ scene, yOffset = BAR_Y_OFFSET } = {}) {
  if (!scene?.isScene) throw new TypeError('적 HP 바에는 Three.js Scene이 필요합니다.');
  const root = new THREE.Group();
  root.name = 'reboot-enemy-hp-bars';
  scene.add(root);

  // 지오메트리·머티리얼은 전 적이 공유한다 — 채움량은 메시 스케일로만 표현.
  const geometry = new THREE.PlaneGeometry(1, 1);
  const backMaterial = new THREE.MeshBasicMaterial({
    color: 0x101a36, depthWrite: false, fog: false, opacity: 0.78, transparent: true
  });
  const fillMaterial = new THREE.MeshBasicMaterial({
    color: 0xff5d4d, depthWrite: false, fog: false, opacity: 0.95, transparent: true
  });
  const entries = new Map();
  let disposed = false;

  function ensureEntry(enemy) {
    const known = entries.get(enemy.id);
    if (known) return known;
    const group = new THREE.Group();
    group.name = `enemy-hp-bar-${enemy.id}`;
    const back = new THREE.Mesh(geometry, backMaterial);
    back.scale.set(BAR_WIDTH, BAR_HEIGHT, 1);
    back.renderOrder = 10;
    const fill = new THREE.Mesh(geometry, fillMaterial);
    fill.scale.set(BAR_WIDTH, BAR_HEIGHT * 0.6, 1);
    fill.position.z = 0.01; // 배경과의 z-fighting 방지.
    fill.renderOrder = 11;
    group.add(back);
    group.add(fill);
    root.add(group);
    const entry = { fill, group, id: enemy.id, ratio: 1 };
    entries.set(enemy.id, entry);
    return entry;
  }

  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
      backMaterial.dispose();
      fillMaterial.dispose();
      root.removeFromParent();
    },
    // 매 프레임 카메라 쿼터니언 복사 — 바가 항상 카메라를 향한다(빌보드).
    face(camera) {
      if (disposed || !camera?.quaternion) return;
      for (const entry of entries.values()) entry.group.quaternion.copy(camera.quaternion);
    },
    getDebugState() {
      return Object.freeze({
        bars: Object.freeze([...entries.values()].map((entry) => Object.freeze({
          id: entry.id,
          planeCount: entry.group.children.length,
          ratio: entry.ratio,
          visible: entry.group.visible
        }))),
        disposed
      });
    },
    // 권위 상태(encounter.enemies)의 hp/최대hp 비율만 반영한다 — 판정은 절대 하지 않는다.
    sync(encounter) {
      if (disposed) return;
      const seen = new Set();
      for (const enemy of Array.isArray(encounter?.enemies) ? encounter.enemies : []) {
        seen.add(enemy.id);
        const entry = ensureEntry(enemy);
        const maxHp = enemy.definition?.stats?.maxHp ?? 0;
        const ratio = maxHp > 0 ? Math.max(0, Math.min(1, enemy.hp / maxHp)) : 0;
        entry.ratio = ratio;
        // defeat(격파)면 숨긴다 — 쓰러진 기록에는 게이지를 남기지 않는다.
        entry.group.visible = enemy.phase !== 'defeat' && ratio > 0;
        entry.group.position.set(enemy.position.x, yOffset, enemy.position.z);
        entry.fill.scale.x = Math.max(BAR_WIDTH * ratio, 1e-4);
        entry.fill.position.x = -BAR_WIDTH * (1 - ratio) / 2;
      }
      for (const [id, entry] of entries) {
        if (!seen.has(id)) entry.group.visible = false;
      }
    }
  });
}
