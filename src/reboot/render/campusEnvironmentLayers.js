import * as THREE from 'three';

const LAYERS = Object.freeze([
  Object.freeze({ distance: 19, height: 3.4, name: 'foreground', opacity: 0.82, scale: 0.84 }),
  Object.freeze({ distance: 30, height: 5.2, name: 'midground', opacity: 0.56, scale: 1.08 }),
  Object.freeze({ distance: 45, height: 7.2, name: 'background', opacity: 0.32, scale: 1.42 })
]);

function disableShadows(object) {
  object.castShadow = false;
  object.receiveShadow = false;
  return object;
}

export function createCinematicNightSky({
  accent = 0xf3b36c, centerZ, group, prefix, resources
}) {
  const skyGeometry = resources.register(
    new THREE.SphereGeometry(94, 32, 18), `${prefix}-night-sky-geometry`
  );
  const skyMaterial = resources.register(new THREE.ShaderMaterial({
    depthWrite: false,
    fog: false,
    side: THREE.BackSide,
    uniforms: {
      bottomColor: { value: new THREE.Color(0x182846) },
      horizonColor: { value: new THREE.Color(0x3c3558) },
      topColor: { value: new THREE.Color(0x050918) }
    },
    vertexShader: `
      varying float vSkyHeight;
      void main() {
        vSkyHeight = normalize(position).y * 0.5 + 0.5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 bottomColor;
      uniform vec3 horizonColor;
      uniform vec3 topColor;
      varying float vSkyHeight;
      void main() {
        vec3 lower = mix(bottomColor, horizonColor, smoothstep(0.05, 0.38, vSkyHeight));
        vec3 color = mix(lower, topColor, smoothstep(0.38, 0.95, vSkyHeight));
        gl_FragColor = vec4(color, 1.0);
      }
    `
  }), `${prefix}-night-sky-material`);
  const sky = disableShadows(new THREE.Mesh(skyGeometry, skyMaterial));
  sky.name = `${prefix}-cinematic-night-sky`;
  sky.position.set(0, 3, centerZ);
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

export function createLayeredCampusSilhouettes({
  centerZ, colors, group, prefix, resources, spanZ
}) {
  const islandGeometry = resources.register(new THREE.ConeGeometry(2.8, 4.8, 7, 1, true), `${prefix}-island-geometry`);
  const towerGeometry = resources.register(new THREE.CylinderGeometry(0.5, 0.72, 3.6, 7), `${prefix}-tower-geometry`);
  const roofGeometry = resources.register(new THREE.ConeGeometry(0.82, 1.35, 4), `${prefix}-roof-geometry`);
  let instanceCount = 0;

  for (const [layerIndex, layer] of LAYERS.entries()) {
    const layerRoot = new THREE.Group();
    layerRoot.name = `${prefix}-${layer.name}-silhouettes`;
    const material = registerMaterial(
      resources, `${prefix}-${layer.name}-material`, colors[layerIndex], colors[layerIndex]
    );
    material.opacity = layer.opacity;
    const islandCount = 4;
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
      const z = centerZ + (index - 1.5) * spanZ * 0.3;
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

  return Object.freeze({ instanceCount, layerCount: LAYERS.length });
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
