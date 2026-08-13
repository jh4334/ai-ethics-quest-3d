import * as THREE from 'three';
import { resolveQualityProfile } from '../settings/quality.js';

export function createRenderer(canvas, {
  quality = 'auto', rendererFactory = (options) => new THREE.WebGLRenderer(options), windowRef = window
} = {}) {
  if (!canvas) throw new Error('A reboot canvas is required to create the renderer');
  const supported = ['webgl2', 'webgl', 'experimental-webgl'].some((contextId) => canvas.getContext?.(contextId));
  if (!supported) throw new Error('WebGL is not supported by this device');
  const profile = resolveQualityProfile(quality, windowRef.devicePixelRatio || 1);
  const renderer = rendererFactory({
    antialias: quality !== 'low',
    canvas,
    powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.setClearColor(0x050918, 1);
  renderer.setPixelRatio(profile.dpr);
  renderer.userData = {};
  renderer.userData.rebootQuality = profile;
  return renderer;
}
