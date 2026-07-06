import * as THREE from 'three';

// 상호작용 대상(NPC·사당) 위에 둥둥 떠서 "여기로 오라"고 알려주는 아이콘 스프라이트.
// 이모지를 캔버스에 그려 텍스처로 쓰므로 외부 이미지가 필요 없다.

const iconTextureCache = new Map();

function makeIconTexture(emoji, ringColor) {
  const key = `${emoji}|${ringColor}`;
  if (iconTextureCache.has(key)) {
    return iconTextureCache.get(key);
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  // 둥근 배경 + 테두리
  ctx.beginPath();
  ctx.arc(64, 64, 52, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = ringColor;
  ctx.stroke();
  ctx.font = '64px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  iconTextureCache.set(key, texture);
  return texture;
}

export function createFloatingIcon(emoji, ringColor) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: makeIconTexture(emoji, ringColor), transparent: true, depthTest: true })
  );
  sprite.scale.set(0.9, 0.9, 1);
  sprite.userData.baseY = 0;
  return sprite;
}

export function setIconEmoji(sprite, emoji, ringColor) {
  sprite.material.map = makeIconTexture(emoji, ringColor);
  sprite.material.needsUpdate = true;
}

// 조각 획득 등 성공 순간의 파티클 폭발 + 위로 솟는 빛기둥.
export function createBurstSystem(scene) {
  const bursts = [];

  function spawn(position, colorHex) {
    const color = new THREE.Color(colorHex);
    const count = 26;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      const angle = Math.random() * Math.PI * 2;
      const up = 1.6 + Math.random() * 2.4;
      const out = 1.4 + Math.random() * 2.2;
      velocities.push(new THREE.Vector3(Math.cos(angle) * out, up, Math.sin(angle) * out));
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size: 0.34,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // 위로 솟았다 사라지는 빛기둥.
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, 4.5, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      })
    );
    pillar.position.copy(position);
    pillar.position.y += 2;
    scene.add(pillar);

    bursts.push({ points, material, geometry, velocities, pillar, age: 0, life: 1.1 });
  }

  function update(delta) {
    for (let i = bursts.length - 1; i >= 0; i -= 1) {
      const burst = bursts[i];
      burst.age += delta;
      const t = burst.age / burst.life;
      const attr = burst.geometry.getAttribute('position');
      for (let p = 0; p < burst.velocities.length; p += 1) {
        const v = burst.velocities[p];
        attr.array[p * 3] += v.x * delta;
        attr.array[p * 3 + 1] += (v.y - 3.4 * burst.age) * delta;
        attr.array[p * 3 + 2] += v.z * delta;
      }
      attr.needsUpdate = true;
      burst.material.opacity = Math.max(0, 1 - t);
      burst.pillar.material.opacity = Math.max(0, 0.55 * (1 - t));
      burst.pillar.scale.y = 1 + t * 0.6;
      burst.pillar.position.y += delta * 1.2;
      if (burst.age >= burst.life) {
        scene.remove(burst.points);
        scene.remove(burst.pillar);
        burst.geometry.dispose();
        burst.material.dispose();
        burst.pillar.geometry.dispose();
        burst.pillar.material.dispose();
        bursts.splice(i, 1);
      }
    }
  }

  return { spawn, update };
}
