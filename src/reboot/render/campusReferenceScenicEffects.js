import * as THREE from 'three';

import { CAMPUS_MEMORY_PATH } from '../content/campus/chapterOneCampus.js';
import { CAMPUS_VISUAL_PROFILE } from '../design/tokens.js';

function disableShadows(object) {
  object.castShadow = false;
  object.receiveShadow = false;
  return object;
}

export function createForegroundLeaves({ group, prefix, resources }) {
  const palette = CAMPUS_VISUAL_PROFILE.referenceVista;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-0.34, 0.48, -0.46, 1.34, 0.02, 2.08);
  shape.bezierCurveTo(0.5, 1.34, 0.38, 0.42, 0, 0);
  const geometry = resources.register(
    new THREE.ShapeGeometry(shape, 8), `${prefix}-reference-leaf-geometry`
  );
  const material = resources.register(new THREE.MeshBasicMaterial({
    color: 0xffffff,
    fog: true,
    side: THREE.DoubleSide,
    toneMapped: true
  }), `${prefix}-reference-leaf-material`);
  const leaves = disableShadows(new THREE.InstancedMesh(geometry, material, 32));
  leaves.name = `${prefix}-reference-foreground-leaves`;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  for (let index = 0; index < 32; index += 1) {
    const left = index < 16;
    const local = index % 16;
    const cluster = Math.floor(local / 4);
    const blade = local % 4;
    const side = left ? -1 : 1;
    quaternion.setFromEuler(new THREE.Euler(
      -0.08 + blade * 0.035,
      side * (0.08 + cluster * 0.035),
      side * (-0.28 + blade * 0.19)
    ));
    matrix.compose(
      new THREE.Vector3(
        side * (5.3 + blade * 0.56 + cluster * 0.2),
        -0.52 + blade * 0.012,
        9 - cluster * 4.2 + blade * 0.82
      ),
      quaternion,
      new THREE.Vector3(0.48 + blade * 0.05, 0.46 + cluster * 0.04 + blade * 0.035, 1)
    );
    leaves.setMatrixAt(index, matrix);
    const colors = left ? palette.leftLeaves : palette.rightLeaves;
    leaves.setColorAt(index, new THREE.Color(colors[(blade + cluster) % colors.length]));
  }
  leaves.instanceMatrix.needsUpdate = true;
  leaves.instanceColor.needsUpdate = true;
  leaves.computeBoundingBox();
  leaves.computeBoundingSphere();
  group.add(leaves);
  return leaves.count;
}

export function createMistBands({ group, prefix, resources }) {
  const material = resources.register(new THREE.ShaderMaterial({
    depthWrite: false,
    transparent: true,
    uniforms: { fogColor: { value: new THREE.Color(CAMPUS_VISUAL_PROFILE.referenceVista.mist) } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 fogColor;
      varying vec2 vUv;
      void main() {
        float edgeX = smoothstep(0.0, 0.14, vUv.x) * (1.0 - smoothstep(0.86, 1.0, vUv.x));
        float edgeY = pow(sin(vUv.y * 3.14159265), 1.35);
        float ripple = sin(vUv.x * 34.0 + vUv.y * 7.0) * 0.08 + 0.92;
        gl_FragColor = vec4(fogColor, edgeX * edgeY * ripple * 0.2);
      }
    `
  }), `${prefix}-reference-mist-material`);
  const bands = disableShadows(new THREE.InstancedMesh(
    resources.register(new THREE.PlaneGeometry(1, 1), `${prefix}-reference-mist-geometry`),
    material,
    3
  ));
  bands.name = `${prefix}-reference-mist-bands`;
  const matrix = new THREE.Matrix4();
  [
    [-33, 1.7, 70, 8],
    [-56, 4.2, 92, 11],
    [-84, 7.6, 118, 15]
  ].forEach(([z, y, width, height], index) => {
    matrix.compose(
      new THREE.Vector3(0, y, z),
      new THREE.Quaternion(),
      new THREE.Vector3(width, height, 1)
    );
    bands.setMatrixAt(index, matrix);
  });
  bands.instanceMatrix.needsUpdate = true;
  bands.renderOrder = -4;
  group.add(bands);
  return bands.count;
}

export function createMemoryHalos({ group, prefix, resources }) {
  const material = resources.register(new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: CAMPUS_VISUAL_PROFILE.referenceVista.memoryHalo,
    depthWrite: false,
    opacity: 0.18,
    side: THREE.DoubleSide,
    transparent: true
  }), `${prefix}-reference-memory-halo-material`);
  const halos = disableShadows(new THREE.InstancedMesh(
    resources.register(new THREE.CircleGeometry(0.42, 14), `${prefix}-reference-memory-halo-geometry`),
    material,
    CAMPUS_MEMORY_PATH.length
  ));
  halos.name = `${prefix}-reference-memory-halos`;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  CAMPUS_MEMORY_PATH.forEach((point, index) => {
    quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, point.rotationY, 0));
    const scale = 1.05 + (index % 3) * 0.12;
    matrix.compose(
      new THREE.Vector3(point.x, point.y + 0.015, point.z),
      quaternion,
      new THREE.Vector3(scale, scale * 1.28, 1)
    );
    halos.setMatrixAt(index, matrix);
  });
  halos.instanceMatrix.needsUpdate = true;
  halos.renderOrder = 1;
  group.add(halos);
  return halos.count;
}
