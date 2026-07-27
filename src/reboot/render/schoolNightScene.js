import * as THREE from 'three';

import { createDisposableRegistry } from './dispose.js';

export function createSchoolNightScene({ canvas, input, renderer, windowRef = window }) {
  const resources = createDisposableRegistry();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050918);
  scene.fog = new THREE.Fog(0x050918, 24, 55);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
  camera.position.set(0, 8, 12);
  camera.lookAt(0, 0, -2);

  const floorGeometry = resources.register(new THREE.PlaneGeometry(18, 42), 'floor-geometry');
  const floorMaterial = resources.register(new THREE.MeshStandardMaterial({ color: 0x101a36, roughness: 0.86 }), 'floor-material');
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -8;
  scene.add(floor);

  const wallGeometry = resources.register(new THREE.BoxGeometry(0.35, 4.2, 42), 'wall-geometry');
  const wallMaterial = resources.register(new THREE.MeshStandardMaterial({ color: 0x17213d, roughness: 0.9 }), 'wall-material');
  for (const x of [-5.2, 5.2]) {
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(x, 2.1, -8);
    scene.add(wall);
  }

  const playerGeometry = resources.register(new THREE.CapsuleGeometry(0.42, 0.8, 4, 8), 'player-geometry');
  const playerMaterial = resources.register(new THREE.MeshStandardMaterial({ color: 0xf6a84b, emissive: 0x5b2108 }), 'player-material');
  const player = new THREE.Mesh(playerGeometry, playerMaterial);
  player.position.set(0, 0.82, 2);
  scene.add(player);

  scene.add(new THREE.HemisphereLight(0x799cff, 0x160d18, 1.25));
  const memoryLight = new THREE.PointLight(0xffa445, 3.2, 13, 2);
  memoryLight.position.set(0, 2.4, -5);
  scene.add(memoryLight);

  let entered = false;
  function resize() {
    const width = Math.max(canvas.clientWidth, 1);
    const height = Math.max(canvas.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  return Object.freeze({
    dispose() {
      resources.disposeAll();
    },
    enter() {
      if (entered) return;
      entered = true;
      resize();
      windowRef.addEventListener('resize', resize);
    },
    exit() {
      if (!entered) return;
      entered = false;
      windowRef.removeEventListener('resize', resize);
    },
    resourceCount() {
      return resources.size();
    },
    update(delta) {
      const horizontal = Number(input.isActive('move-right')) - Number(input.isActive('move-left'));
      const vertical = Number(input.isActive('move-down')) - Number(input.isActive('move-up'));
      player.position.x = THREE.MathUtils.clamp(player.position.x + horizontal * delta * 4, -4.3, 4.3);
      player.position.z = THREE.MathUtils.clamp(player.position.z + vertical * delta * 4, -15, 4);
      camera.position.x += (player.position.x - camera.position.x) * Math.min(delta * 5, 1);
      camera.position.z += (player.position.z + 10 - camera.position.z) * Math.min(delta * 4, 1);
      camera.lookAt(player.position.x, 0.5, player.position.z - 3);
      renderer.render(scene, camera);
    }
  });
}
