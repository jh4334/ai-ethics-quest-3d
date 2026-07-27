import * as THREE from 'three';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    canvas,
    powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x050918, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  return renderer;
}
