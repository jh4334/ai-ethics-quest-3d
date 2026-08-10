import * as THREE from 'three';

import { CAMPUS_VISUAL_PROFILE } from '../design/tokens.js';

function disableShadows(object) {
  object.castShadow = false;
  object.receiveShadow = false;
  return object;
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
