import * as THREE from 'three';

function forEachMaterial(object, callback) {
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of materials) if (material) callback(material);
}

function classifyMaterial(object, material) {
  const name = `${object.name} ${material.name}`.toLowerCase();
  if (name.includes('hair')) return 'hairEmissive';
  if (/regular|eyes|skin/.test(name)) return 'skinEmissive';
  return 'outfitEmissive';
}

function applyMappedLift(object, material, presentation) {
  if (!material.map?.isTexture || !material.emissive?.setHex) return;
  material.emissiveMap = material.map;
  material.emissive.setHex(0xffffff);
  material.emissiveIntensity = presentation[classifyMaterial(object, material)];
  material.needsUpdate = true;
}

export function prepareCharacterModel({ hiddenParts, model, ownedMaterials, presentation }) {
  model.traverse((object) => {
    if (hiddenParts.some((part) => object.name.includes(part))) object.visible = false;
    if (!object.isMesh) return;
    object.castShadow = false;
    object.receiveShadow = false;
    const materials = [];
    forEachMaterial(object, (source) => {
      const material = source.clone();
      applyMappedLift(object, material, presentation);
      ownedMaterials.add(material);
      materials.push(material);
    });
    object.material = Array.isArray(object.material) ? materials : materials[0];
  });
}

export function registerCharacterSourceResources(gltf, resources) {
  gltf.scene.traverse((object) => {
    if (object.geometry) resources.geometries.add(object.geometry);
    forEachMaterial(object, (material) => {
      resources.materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) resources.textures.add(value);
      }
    });
  });
}

export function disposeCharacterSourceResources(resources) {
  for (const texture of resources.textures) texture.dispose();
  for (const material of resources.materials) material.dispose();
  for (const geometry of resources.geometries) geometry.dispose();
  resources.textures.clear();
  resources.materials.clear();
  resources.geometries.clear();
}
