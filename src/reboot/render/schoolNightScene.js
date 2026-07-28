import * as THREE from 'three';

import { createCharacterCast } from '../characters/cast.js';
import { createDisposableRegistry } from './dispose.js';

export function createSchoolNightScene({ canvas, input, renderer, windowRef = window }) {
  const resources = createDisposableRegistry();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050918);
  scene.fog = new THREE.Fog(0x050918, 24, 55);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
  camera.position.set(0, 3.35, 7.7);
  camera.lookAt(0, 1.15, 0.2);

  const floorGeometry = resources.register(new THREE.PlaneGeometry(18, 42), 'floor-geometry');
  const floorMaterial = resources.register(new THREE.MeshStandardMaterial({ color: 0x162345, roughness: 0.86 }), 'floor-material');
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

  const cast = resources.register(createCharacterCast({ scene }), 'character-cast');

  scene.add(new THREE.HemisphereLight(0xb5c6ff, 0x271626, 3.2));
  const memoryLight = new THREE.PointLight(0xffa445, 7.4, 15, 2);
  memoryLight.position.set(0, 2.8, 0);
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
      canvas.dataset.characters = 'loading';
      cast.load().then(() => {
        if (!entered) return;
        const debug = cast.getDebugState();
        canvas.dataset.characterCount = String(debug.loaded);
        canvas.dataset.characters = debug.errors.length === 0 ? 'ready' : 'error';
      });
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
      cast.update(delta, { horizontal, vertical });
      const playerPosition = cast.getPlayerPosition();
      camera.position.x += (playerPosition.x - camera.position.x) * Math.min(delta * 5, 1);
      camera.position.z += (playerPosition.z + 5.7 - camera.position.z) * Math.min(delta * 4, 1);
      camera.lookAt(playerPosition.x, 1.15, playerPosition.z - 1.45);
      renderer.render(scene, camera);
    }
  });
}
