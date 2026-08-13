import * as THREE from 'three';

export function createTwilightSea({ centerZ, group, resources }) {
  const geometry = resources.register(
    new THREE.PlaneGeometry(190, 190, 1, 1), 'floating-campus-twilight-sea-geometry'
  );
  geometry.rotateX(-Math.PI / 2);
  const material = resources.register(new THREE.ShaderMaterial({
    depthWrite: true,
    fog: false,
    uniforms: {
      deepColor: { value: new THREE.Color(0x1a5c86) },
      fogColor: { value: new THREE.Color(0x7b9ab2) },
      glintColor: { value: new THREE.Color(0xd8e5ef) },
      horizonColor: { value: new THREE.Color(0x6794b3) }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 deepColor;
      uniform vec3 fogColor;
      uniform vec3 glintColor;
      uniform vec3 horizonColor;
      varying vec3 vWorldPosition;
      void main() {
        float distanceToCamera = distance(cameraPosition.xz, vWorldPosition.xz);
        float depthMix = smoothstep(8.0, 112.0, distanceToCamera);
        vec3 color = mix(deepColor, horizonColor, depthMix);
        float broadWave = sin(vWorldPosition.x * 0.19 + vWorldPosition.z * 0.11) * 0.5 + 0.5;
        float fineWave = sin(vWorldPosition.x * 0.74 - vWorldPosition.z * 0.31) * 0.5 + 0.5;
        float waveGlint = smoothstep(0.86, 0.98, broadWave * 0.64 + fineWave * 0.36);
        float glintFade = 1.0 - smoothstep(12.0, 82.0, distanceToCamera);
        color += glintColor * waveGlint * glintFade * 0.42;
        color = mix(color, fogColor, smoothstep(72.0, 138.0, distanceToCamera) * 0.74);
        gl_FragColor = vec4(color, 1.0);
      }
    `
  }), 'floating-campus-twilight-sea-material');
  const sea = new THREE.Mesh(geometry, material);
  sea.name = 'floating-campus-twilight-sea';
  sea.position.set(0, -1.2, centerZ);
  sea.castShadow = false;
  sea.receiveShadow = false;
  sea.renderOrder = -15;
  group.add(sea);
  return Object.freeze({ sea });
}
