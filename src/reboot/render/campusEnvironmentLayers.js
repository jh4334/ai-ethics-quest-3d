import * as THREE from 'three';

const LAYERS = Object.freeze([
  Object.freeze({ distance: 18, height: 4.6, name: 'foreground', opacity: 0.84, scale: 0.94 }),
  Object.freeze({ distance: 29, height: 6.4, name: 'midground', opacity: 0.58, scale: 1.18 }),
  Object.freeze({ distance: 43, height: 8.8, name: 'background', opacity: 0.34, scale: 1.56 })
]);

function disableShadows(object) {
  object.castShadow = false;
  object.receiveShadow = false;
  return object;
}

export function createCinematicNightSky({
  accent = 0xf3b36c, centerZ, group, palette = null, prefix, resources
}) {
  const skyGeometry = resources.register(
    new THREE.SphereGeometry(94, 32, 18), `${prefix}-night-sky-geometry`
  );
  const skyMaterial = resources.register(new THREE.ShaderMaterial({
    depthWrite: false,
    fog: false,
    side: THREE.BackSide,
    uniforms: {
      bottomColor: { value: new THREE.Color(palette?.bottom ?? 0x182846) },
      horizonColor: { value: new THREE.Color(palette?.horizon ?? 0x3c3558) },
      resolution: { value: new THREE.Vector2(1, 1) },
      topColor: { value: new THREE.Color(palette?.top ?? 0x050918) }
    },
    vertexShader: `
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 bottomColor;
      uniform vec3 horizonColor;
      uniform vec2 resolution;
      uniform vec3 topColor;
      void main() {
        float screenX = clamp(gl_FragCoord.x / max(resolution.x, 1.0), 0.0, 1.0);
        float screenY = clamp(gl_FragCoord.y / max(resolution.y, 1.0), 0.0, 1.0);
        vec3 lower = mix(bottomColor, horizonColor, smoothstep(0.54, 0.8, screenY));
        vec3 color = mix(lower, topColor, smoothstep(0.8, 1.0, screenY));
        float twilightBand = 1.0 - smoothstep(0.0, 0.12, abs(screenY - 0.79));
        color += horizonColor * twilightBand * 0.12;
        float cloudBand = 1.0 - smoothstep(0.0, 0.24, abs(screenY - 0.72));
        float broadWave = sin(screenX * 18.0 + sin(screenX * 5.0) * 2.2 + screenY * 12.0) * 0.5 + 0.5;
        float cloudDetail = sin(screenX * 43.0 - screenY * 9.0) * 0.5 + 0.5;
        float twilightCloud = smoothstep(0.48, 0.74, broadWave * 0.7 + cloudDetail * 0.3) * cloudBand;
        vec3 cloudColor = mix(horizonColor, vec3(0.48, 0.56, 0.7), 0.34) * 1.22;
        color = mix(color, cloudColor, twilightCloud * 0.42);
        float horizonGlow = 1.0 - smoothstep(0.0, 0.08, abs(screenY - 0.67));
        color += vec3(0.13, 0.18, 0.28) * horizonGlow * 0.12;
        gl_FragColor = vec4(color, 1.0);
      }
    `
  }), `${prefix}-night-sky-material`);
  const sky = disableShadows(new THREE.Mesh(skyGeometry, skyMaterial));
  sky.name = `${prefix}-cinematic-night-sky`;
  sky.position.set(0, 3, centerZ);
  sky.frustumCulled = false;
  sky.onBeforeRender = (renderer) => {
    renderer.getDrawingBufferSize(skyMaterial.uniforms.resolution.value);
  };
  sky.renderOrder = -20;
  group.add(sky);

  const starCount = 220;
  const starPositions = new Float32Array(starCount * 3);
  for (let index = 0; index < starCount; index += 1) {
    const angle = index * 2.3999632297;
    const radius = 62 + (index % 17) * 1.5;
    starPositions[index * 3] = Math.sin(angle) * radius;
    starPositions[index * 3 + 1] = 10 + ((index * 13) % 39);
    starPositions[index * 3 + 2] = centerZ + Math.cos(angle) * radius;
  }
  const starGeometry = resources.register(new THREE.BufferGeometry(), `${prefix}-star-geometry`);
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = resources.register(new THREE.PointsMaterial({
    color: 0xdbe7ff, depthWrite: false, fog: false, opacity: 0.78,
    size: 0.18, sizeAttenuation: true, transparent: true
  }), `${prefix}-star-material`);
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.name = `${prefix}-night-stars`;
  group.add(stars);

  const moonMaterial = resources.register(new THREE.MeshBasicMaterial({
    color: accent, fog: false, opacity: 0.92, transparent: true
  }), `${prefix}-moon-material`);
  const moon = disableShadows(new THREE.Mesh(
    resources.register(new THREE.CircleGeometry(3.1, 40), `${prefix}-moon-geometry`), moonMaterial
  ));
  moon.name = `${prefix}-moon-disc`;
  moon.position.set(-31, 25, centerZ - 53);
  group.add(moon);
  const haloMaterial = resources.register(new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending, color: accent, depthWrite: false, fog: false,
    opacity: 0.18, side: THREE.DoubleSide, transparent: true
  }), `${prefix}-moon-halo-material`);
  const halo = disableShadows(new THREE.Mesh(
    resources.register(new THREE.RingGeometry(3.5, 5.8, 48), `${prefix}-moon-halo-geometry`), haloMaterial
  ));
  halo.name = `${prefix}-moon-halo`;
  halo.position.set(-31, 25, centerZ - 52.8);
  group.add(halo);
  return Object.freeze({ skyObjects: 4, starCount });
}

export function createMemoryFootprintPath({ color, group, points, prefix, resources }) {
  const footprintShape = new THREE.Shape();
  footprintShape.moveTo(-0.1, -0.44);
  footprintShape.quadraticCurveTo(-0.2, -0.32, -0.17, -0.12);
  footprintShape.quadraticCurveTo(-0.2, 0.16, -0.07, 0.42);
  footprintShape.quadraticCurveTo(0.08, 0.53, 0.21, 0.36);
  footprintShape.quadraticCurveTo(0.25, 0.12, 0.16, -0.17);
  footprintShape.quadraticCurveTo(0.11, -0.43, -0.1, -0.44);
  footprintShape.closePath();
  const geometry = resources.register(
    new THREE.ShapeGeometry(footprintShape, 10), `${prefix}-memory-footprint-geometry`
  );
  const material = resources.register(new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.38),
    emissive: color,
    emissiveIntensity: 1.35,
    metalness: 0.18,
    roughness: 0.28,
    side: THREE.DoubleSide
  }), `${prefix}-memory-footprint-material`);
  const footprints = disableShadows(new THREE.InstancedMesh(geometry, material, points.length));
  footprints.name = `${prefix}-memory-footprints`;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const rotation = new THREE.Euler();
  for (const [index, point] of points.entries()) {
    rotation.set(-Math.PI / 2, point.rotationY, 0);
    quaternion.setFromEuler(rotation);
    matrix.compose(
      new THREE.Vector3(point.x, point.y, point.z),
      quaternion,
      new THREE.Vector3(index % 2 === 0 ? -0.86 : 1, 1, 1)
    );
    footprints.setMatrixAt(index, matrix);
  }
  footprints.instanceMatrix.needsUpdate = true;
  footprints.computeBoundingBox();
  footprints.computeBoundingSphere();
  group.add(footprints);
  return Object.freeze({ footprintCount: points.length, footprints });
}

export function createCampusEdgeDressing({
  accent = 0xf3b36c, centerZ, group, halfWidth = 10, prefix, resources, spanZ
}) {
  const segmentCount = Math.max(10, Math.ceil(spanZ / 6));
  const postCount = segmentCount * 2;
  const postGeometry = resources.register(
    new THREE.CylinderGeometry(0.09, 0.14, 1.55, 7), `${prefix}-edge-post-geometry`
  );
  const postMaterial = resources.register(new THREE.MeshStandardMaterial({
    color: 0x493a35, emissive: 0x120d0d, emissiveIntensity: 0.28,
    metalness: 0.08, roughness: 0.86
  }), `${prefix}-edge-post-material`);
  const posts = disableShadows(new THREE.InstancedMesh(postGeometry, postMaterial, postCount));
  posts.name = `${prefix}-edge-posts`;
  const lanternGeometry = resources.register(
    new THREE.OctahedronGeometry(0.19, 0), `${prefix}-lantern-geometry`
  );
  const lanternMaterial = resources.register(new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: 1.7, metalness: 0.16, roughness: 0.26
  }), `${prefix}-lantern-material`);
  const lanternCount = Math.ceil(segmentCount / 2) * 2;
  const lanterns = disableShadows(new THREE.InstancedMesh(lanternGeometry, lanternMaterial, lanternCount));
  lanterns.name = `${prefix}-path-lanterns`;
  const matrix = new THREE.Matrix4();
  let lanternIndex = 0;
  for (let index = 0; index < segmentCount; index += 1) {
    const t = segmentCount === 1 ? 0 : index / (segmentCount - 1);
    const z = centerZ - spanZ / 2 + t * spanZ;
    const widthJitter = (index % 3) * 0.32;
    for (const [sideIndex, side] of [-1, 1].entries()) {
      const x = side * (halfWidth + widthJitter);
      matrix.makeTranslation(x, 0.78, z);
      posts.setMatrixAt(index * 2 + sideIndex, matrix);
      if (index % 2 === 0) {
        matrix.compose(
          new THREE.Vector3(x, 1.72, z), new THREE.Quaternion(),
          new THREE.Vector3(1 + (index % 4) * 0.08, 1.15, 1)
        );
        lanterns.setMatrixAt(lanternIndex, matrix);
        lanternIndex += 1;
      }
    }
  }
  posts.instanceMatrix.needsUpdate = true;
  lanterns.instanceMatrix.needsUpdate = true;
  group.add(posts, lanterns);

  const shrubCount = Math.max(12, Math.ceil(spanZ / 4));
  const shrubGeometry = resources.register(
    new THREE.DodecahedronGeometry(0.75, 0), `${prefix}-shrub-geometry`
  );
  const shrubMaterial = resources.register(new THREE.MeshStandardMaterial({
    color: 0x3e5360, emissive: 0x0d2028, emissiveIntensity: 0.5,
    metalness: 0.02, roughness: 0.92
  }), `${prefix}-shrub-material`);
  const shrubs = disableShadows(new THREE.InstancedMesh(shrubGeometry, shrubMaterial, shrubCount));
  shrubs.name = `${prefix}-edge-vegetation`;
  for (let index = 0; index < shrubCount; index += 1) {
    const t = shrubCount === 1 ? 0 : index / (shrubCount - 1);
    const side = index % 2 === 0 ? -1 : 1;
    matrix.compose(
      new THREE.Vector3(
        side * (halfWidth + 1.2 + (index % 4) * 0.48),
        0.55 + (index % 3) * 0.12,
        centerZ - spanZ / 2 + t * spanZ
      ),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), index * 0.73),
      new THREE.Vector3(0.8 + (index % 3) * 0.25, 0.9 + (index % 4) * 0.18, 0.8)
    );
    shrubs.setMatrixAt(index, matrix);
  }
  shrubs.instanceMatrix.needsUpdate = true;
  group.add(shrubs);

  const shardCount = 18;
  const shardGeometry = resources.register(
    new THREE.DodecahedronGeometry(0.65, 0), `${prefix}-floating-shard-geometry`
  );
  const shardMaterial = resources.register(new THREE.MeshStandardMaterial({
    color: 0x293650, emissive: 0x080f20, emissiveIntensity: 0.4,
    metalness: 0.08, roughness: 0.94
  }), `${prefix}-floating-shard-material`);
  const shards = disableShadows(new THREE.InstancedMesh(shardGeometry, shardMaterial, shardCount));
  shards.name = `${prefix}-floating-edge-shards`;
  for (let index = 0; index < shardCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const t = index / (shardCount - 1);
    matrix.compose(
      new THREE.Vector3(
        side * (halfWidth + 4 + (index % 5) * 1.1),
        -1.6 - (index % 4) * 0.65,
        centerZ - spanZ / 2 + t * spanZ
      ),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(index * 0.31, index * 0.47, index * 0.19)),
      new THREE.Vector3(0.65 + (index % 3) * 0.32, 0.7 + (index % 4) * 0.24, 0.8)
    );
    shards.setMatrixAt(index, matrix);
  }
  shards.instanceMatrix.needsUpdate = true;
  group.add(shards);
  return Object.freeze({ lanternCount, postCount, shardCount, shrubCount });
}

function registerMaterial(resources, name, color, emissive) {
  return resources.register(new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.38,
    opacity: 0.96,
    roughness: 0.9,
    transparent: true
  }), name);
}

function createMountainRidges({ centerZ, colors, group, prefix, resources, spanZ }) {
  const profiles = [
    Object.freeze({
      color: colors[2],
      heights: [3, 7, 4, 12, 6, 9, 5, 14, 7, 10, 4, 8, 3],
      opacity: 0.46,
      scaleX: 1.08,
      z: centerZ - spanZ * 0.9
    }),
    Object.freeze({
      color: colors[1],
      heights: [2, 5, 9, 4, 7, 13, 5, 8, 4, 11, 6, 4, 2],
      opacity: 0.34,
      scaleX: 1.22,
      z: centerZ - spanZ * 1.05
    })
  ];
  const halfWidth = 66;
  for (const [index, profile] of profiles.entries()) {
    const shape = new THREE.Shape();
    shape.moveTo(-halfWidth, -8);
    for (const [peakIndex, height] of profile.heights.entries()) {
      const x = -halfWidth + peakIndex * (halfWidth * 2 / (profile.heights.length - 1));
      shape.lineTo(x, height);
    }
    shape.lineTo(halfWidth, -8);
    shape.closePath();
    const geometry = resources.register(
      new THREE.ShapeGeometry(shape, 1), `${prefix}-mountain-ridge-geometry-${index}`
    );
    const material = resources.register(new THREE.MeshBasicMaterial({
      color: profile.color,
      depthWrite: false,
      fog: true,
      opacity: profile.opacity,
      transparent: true
    }), `${prefix}-mountain-ridge-material-${index}`);
    const ridge = disableShadows(new THREE.Mesh(geometry, material));
    ridge.name = `${prefix}-mountain-ridge-${index}`;
    ridge.position.set(0, -3.4 - index * 1.2, profile.z);
    ridge.scale.x = profile.scaleX;
    ridge.renderOrder = -12 + index;
    group.add(ridge);
  }
  return profiles.length;
}

export function createLayeredCampusSilhouettes({
  centerZ, colors, group, prefix, resources, spanZ
}) {
  const ridgeCount = createMountainRidges({ centerZ, colors, group, prefix, resources, spanZ });
  const islandGeometry = resources.register(new THREE.ConeGeometry(4.2, 7.6, 9, 1, true), `${prefix}-island-geometry`);
  islandGeometry.rotateZ(Math.PI);
  const towerGeometry = resources.register(new THREE.CylinderGeometry(0.62, 0.88, 4.6, 8), `${prefix}-tower-geometry`);
  const roofGeometry = resources.register(new THREE.ConeGeometry(1.05, 1.7, 5), `${prefix}-roof-geometry`);
  const windowMatrices = [];
  let instanceCount = 0;

  for (const [layerIndex, layer] of LAYERS.entries()) {
    const layerRoot = new THREE.Group();
    layerRoot.name = `${prefix}-${layer.name}-silhouettes`;
    const material = registerMaterial(
      resources, `${prefix}-${layer.name}-material`, colors[layerIndex], colors[layerIndex]
    );
    material.opacity = layer.opacity;
    const islandCount = 6;
    const islands = new THREE.InstancedMesh(islandGeometry, material, islandCount);
    islands.name = `${prefix}-${layer.name}-floating-campus`;
    islands.castShadow = false;
    islands.receiveShadow = false;
    const towers = new THREE.InstancedMesh(towerGeometry, material, islandCount * 2);
    towers.name = `${prefix}-${layer.name}-campus-towers`;
    towers.castShadow = false;
    towers.receiveShadow = false;
    const roofs = new THREE.InstancedMesh(roofGeometry, material, islandCount * 2);
    roofs.name = `${prefix}-${layer.name}-campus-roofs`;
    roofs.castShadow = false;
    roofs.receiveShadow = false;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    for (let index = 0; index < islandCount; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const band = Math.floor(index / 2);
      const x = side * (layer.distance + band * 6.5);
      const z = centerZ + (index - 2.5) * spanZ * 0.18;
      matrix.compose(
        new THREE.Vector3(x, -layer.height * 0.72, z), quaternion,
        new THREE.Vector3(layer.scale * (1 + band * 0.12), layer.scale, layer.scale * 1.35)
      );
      islands.setMatrixAt(index, matrix);
      for (let towerIndex = 0; towerIndex < 2; towerIndex += 1) {
        const towerY = 1.15 + layerIndex * 0.72 + towerIndex * 0.78;
        const towerScaleY = layer.scale * (0.82 + towerIndex * 0.26);
        matrix.compose(
          new THREE.Vector3(x + side * (towerIndex ? 1.1 : -0.7), towerY, z),
          quaternion,
          new THREE.Vector3(layer.scale * 0.75, towerScaleY, layer.scale * 0.75)
        );
        towers.setMatrixAt(index * 2 + towerIndex, matrix);
        windowMatrices.push(new THREE.Matrix4().compose(
          new THREE.Vector3(
            x + side * (towerIndex ? 1.1 : -0.7),
            towerY + 0.12,
            z + layer.scale * 0.7
          ),
          quaternion,
          new THREE.Vector3(layer.scale * 0.72, layer.scale * 0.94, 1)
        ));
        matrix.compose(
          new THREE.Vector3(
            x + side * (towerIndex ? 1.1 : -0.7),
            towerY + towerScaleY * 1.9,
            z
          ),
          quaternion,
          new THREE.Vector3(layer.scale, layer.scale, layer.scale)
        );
        roofs.setMatrixAt(index * 2 + towerIndex, matrix);
      }
    }
    islands.instanceMatrix.needsUpdate = true;
    towers.instanceMatrix.needsUpdate = true;
    roofs.instanceMatrix.needsUpdate = true;
    layerRoot.add(islands, towers, roofs);
    group.add(layerRoot);
    instanceCount += islandCount * 5;
  }

  const windowGeometry = resources.register(
    new THREE.PlaneGeometry(0.25, 0.34), `${prefix}-distant-window-geometry`
  );
  const windowMaterial = resources.register(new THREE.MeshBasicMaterial({
    color: 0xf3b36c,
    depthWrite: false,
    fog: true,
    opacity: 0.72,
    transparent: true
  }), `${prefix}-distant-window-material`);
  const windowLights = disableShadows(new THREE.InstancedMesh(
    windowGeometry, windowMaterial, windowMatrices.length
  ));
  windowLights.name = `${prefix}-distant-window-lights`;
  windowMatrices.forEach((windowMatrix, index) => windowLights.setMatrixAt(index, windowMatrix));
  windowLights.instanceMatrix.needsUpdate = true;
  group.add(windowLights);

  return Object.freeze({
    instanceCount,
    layerCount: LAYERS.length,
    ridgeCount,
    windowLightCount: windowMatrices.length
  });
}

export function createEmissivePathAccents({ colors, group, points, prefix, resources }) {
  const materials = colors.map((color, index) => resources.register(new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.15,
    metalness: 0.25,
    roughness: 0.3
  }), `${prefix}-path-material-${index}`));
  const ringGeometry = resources.register(new THREE.TorusGeometry(0.48, 0.055, 6, 20), `${prefix}-path-ring-geometry`);
  const rings = points.map((point, index) => {
    const ring = new THREE.Mesh(ringGeometry, materials[index % materials.length]);
    ring.name = `${prefix}-path-accent-${index}`;
    ring.position.set(point.x, point.y + 0.08, point.z);
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(1, 1 + (index % 3) * 0.28, 1);
    ring.castShadow = false;
    ring.receiveShadow = false;
    group.add(ring);
    return ring;
  });
  return Object.freeze({ accentCount: rings.length, rings: Object.freeze(rings) });
}
