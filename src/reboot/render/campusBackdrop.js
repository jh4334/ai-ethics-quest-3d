import * as THREE from 'three';

import { CAMPUS_DISTRICTS } from '../content/campus/chapterOneCampus.js';

function createStars(group) {
  const count = 180;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.399963;
    const radius = 52 + (index % 19) * 2.8;
    positions[index * 3] = Math.sin(angle) * radius;
    positions[index * 3 + 1] = 10 + ((index * 11) % 33);
    positions[index * 3 + 2] = -58 + Math.cos(angle) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xc9dcff,
    opacity: 0.72,
    size: 0.22,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    fog: false
  });
  const stars = new THREE.Points(geometry, material);
  stars.name = 'campus-night-stars';
  group.add(stars);
  return { geometry, material };
}

function createDistantIslands(group) {
  const geometry = new THREE.ConeGeometry(9, 11, 8, 1, true);
  const material = new THREE.MeshStandardMaterial({ color: 0x18253d, roughness: 0.96 });
  const islands = [
    { x: -34, y: -5, z: -24, scale: 1.2 },
    { x: 38, y: -7, z: -58, scale: 1.55 },
    { x: -42, y: -9, z: -105, scale: 1.8 },
    { x: 35, y: -8, z: -132, scale: 1.35 }
  ];
  for (const [index, entry] of islands.entries()) {
    const island = new THREE.Mesh(geometry, material);
    island.name = `campus-distant-island-${index}`;
    island.position.set(entry.x, entry.y, entry.z);
    island.rotation.x = Math.PI;
    island.scale.setScalar(entry.scale);
    group.add(island);
  }
  return { geometry, material };
}

function createSignTexture(documentRef, text) {
  const canvas = documentRef.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(5, 9, 24, 0.86)';
  context.strokeStyle = 'rgba(244, 192, 109, 0.82)';
  context.lineWidth = 5;
  context.beginPath();
  context.roundRect(8, 8, 496, 112, 24);
  context.fill();
  context.stroke();
  context.fillStyle = '#fff3d6';
  context.font = '700 38px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 256, 66, 460);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createDistrictSigns(group, documentRef) {
  if (!documentRef?.createElement) return [];
  return CAMPUS_DISTRICTS.map((district, index) => {
    const texture = createSignTexture(documentRef, district.labelKo);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true });
    const sign = new THREE.Sprite(material);
    sign.name = `campus-sign-${district.id}`;
    sign.position.set(district.center.x + (index % 2 ? 2.2 : -2.2), 3.75, district.center.z - 1.6);
    sign.scale.set(2.7, 0.68, 1);
    sign.userData.campusDistrictId = district.id;
    group.add(sign);
    return { material, texture };
  });
}

export function createCampusBackdrop({ documentRef = globalThis.document, group }) {
  const stars = createStars(group);
  const islands = createDistantIslands(group);
  const signs = createDistrictSigns(group, documentRef);
  return Object.freeze({
    dispose() {
      stars.geometry.dispose();
      stars.material.dispose();
      islands.geometry.dispose();
      islands.material.dispose();
      for (const { material, texture } of signs) {
        texture.dispose();
        material.dispose();
      }
    },
    signCount: signs.length
  });
}
