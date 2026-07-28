import * as THREE from 'three';
import { resolveQualityProfile } from '../settings/quality.js';

export function createRenderer(canvas, { quality = 'auto', windowRef = window } = {}) {
  const profile = resolveQualityProfile(quality, windowRef.devicePixelRatio || 1);
  const renderer = new THREE.WebGLRenderer({
    antialias: quality !== 'low',
    canvas,
    powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x050918, 1);
  renderer.setPixelRatio(profile.dpr);
  renderer.userData = {};
  renderer.userData.rebootQuality = profile;
  return renderer;
}
