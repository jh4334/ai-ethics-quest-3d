import * as THREE from 'three';

const LAYERS = Object.freeze([
  Object.freeze({ distance: 13, height: 2.8, name: 'foreground', opacity: 0.92, scale: 1 }),
  Object.freeze({ distance: 22, height: 4.4, name: 'midground', opacity: 0.68, scale: 1.45 }),
  Object.freeze({ distance: 34, height: 6.2, name: 'background', opacity: 0.44, scale: 2 })
]);

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
