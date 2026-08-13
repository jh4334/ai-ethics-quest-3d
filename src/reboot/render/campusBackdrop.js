import * as THREE from 'three';

import { CAMPUS_DISTRICTS } from '../content/campus/chapterOneCampus.js';

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
    sign.position.set(district.center.x + (index % 2 ? 2.4 : -2.4), 3.45, district.center.z - 1.8);
    sign.scale.set(1.52, 0.38, 1);
    sign.userData.campusDistrictId = district.id;
    group.add(sign);
    return { material, texture };
  });
}

export function createCampusBackdrop({ documentRef = globalThis.document, group }) {
  const signs = createDistrictSigns(group, documentRef);
  return Object.freeze({
    dispose() {
      for (const { material, texture } of signs) {
        texture.dispose();
        material.dispose();
      }
    },
    signCount: signs.length
  });
}
