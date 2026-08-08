const SOURCE_DEFINITIONS = {
  building: {
    name: 'Kenney Building Kit',
    pageUrl: 'https://kenney.nl/assets/building-kit',
    downloadUrl: 'https://kenney.nl/media/pages/assets/building-kit/0de7aaa492-1743244741/kenney_building-kit.zip',
    archiveSha256: '2740EF5772FB5FB3D7AAB881DB22D129F6B68AFE711B1A79E6D5E9E19CF3EEC6',
    license: 'CC0 1.0'
  },
  furniture: {
    name: 'Kenney Furniture Kit',
    pageUrl: 'https://kenney.nl/assets/furniture-kit',
    downloadUrl: 'https://kenney.nl/media/pages/assets/furniture-kit/440e0608a4-1677580847/kenney_furniture-kit.zip',
    archiveSha256: 'E67652D0932CEE41683F74711C03D3E192A2AF9979EF8E6B237711F5482D46B0',
    license: 'CC0 1.0'
  },
  nature: {
    name: 'Kenney Nature Kit',
    pageUrl: 'https://kenney.nl/assets/nature-kit',
    downloadUrl: 'https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip',
    archiveSha256: 'FA7974A0D342BFE63C38664BA9F8EC1A4AAB8EA25F099BDC56870E33588C4D9D',
    license: 'CC0 1.0'
  },
  bricks: {
    name: 'ambientCG Bricks 001',
    pageUrl: 'https://ambientcg.com/view?id=Bricks001',
    downloadUrl: 'https://ambientcg.com/get?file=Bricks001_1K-JPG.zip',
    archiveSha256: 'D4E4109F305B7D1094E1C18B2F7F6A3468C62477DE915FF66975FD0155B6873C',
    license: 'CC0 1.0'
  },
  concrete: {
    name: 'ambientCG Concrete 004',
    pageUrl: 'https://ambientcg.com/view?id=Concrete004',
    downloadUrl: 'https://ambientcg.com/get?file=Concrete004_1K-JPG.zip',
    archiveSha256: '371D2350CD619853C5A6B6B358B67A2AA633E770BDC1180E8E821BD9BAF8E566',
    license: 'CC0 1.0'
  },
  wood: {
    name: 'ambientCG Wood Floor 041',
    pageUrl: 'https://ambientcg.com/view?id=WoodFloor041',
    downloadUrl: 'https://ambientcg.com/get?file=WoodFloor041_1K-JPG.zip',
    archiveSha256: 'E7364EF32A8DB269B2475E76A7E1832ECA82BDF6574191CD96B1CDB2B362CDC6',
    license: 'CC0 1.0'
  },
  asphalt: {
    name: 'ambientCG Asphalt 009',
    pageUrl: 'https://ambientcg.com/view?id=Asphalt009',
    downloadUrl: 'https://ambientcg.com/get?file=Asphalt009_1K-JPG.zip',
    archiveSha256: '3282415AFAD2C74A4665FF191481545138C33C963B4EE0D7E7D292B66B1B4C7E',
    license: 'CC0 1.0'
  }
};

export const ENVIRONMENT_SOURCES = Object.freeze(Object.fromEntries(
  Object.entries(SOURCE_DEFINITIONS).map(([id, source]) => [id, Object.freeze({ ...source })])
));

export const ENVIRONMENT_DEPENDENCIES = Object.freeze([
  './assets/reboot/environment/building/Textures/colormap.png'
]);

function defineAsset(id, source, fileName, placeholder) {
  return Object.freeze({
    id,
    source,
    path: `./assets/reboot/environment/${source}/${fileName}`,
    placeholder: Object.freeze({ ...placeholder })
  });
}

export const ENVIRONMENT_ASSETS = Object.freeze([
  defineAsset('campus-floor', 'building', 'floor.glb', { width: 4, height: 0.15, depth: 4, color: 0x51616f }),
  defineAsset('campus-wall', 'building', 'wall.glb', { width: 4, height: 3, depth: 0.25, color: 0x6b7785 }),
  defineAsset('campus-doorway', 'building', 'wall-doorway-square.glb', { width: 4, height: 3, depth: 0.25, color: 0x8c6b47 }),
  defineAsset('campus-window', 'building', 'wall-window-wide-square-detailed.glb', { width: 4, height: 3, depth: 0.25, color: 0x587d91 }),
  defineAsset('campus-column', 'building', 'column-wide.glb', { width: 0.6, height: 3, depth: 0.6, color: 0x77818a }),
  defineAsset('campus-stairs', 'building', 'stairs-open-short.glb', { width: 2, height: 1, depth: 3, color: 0x6f7880 }),
  defineAsset('campus-roof', 'building', 'roof-flat-square.glb', { width: 4, height: 0.4, depth: 4, color: 0x536376 }),
  defineAsset('campus-roof-edge', 'building', 'roof-flat-side.glb', { width: 4, height: 0.4, depth: 4, color: 0x536376 }),
  defineAsset('classroom-desk', 'furniture', 'desk.glb', { width: 1.4, height: 0.8, depth: 0.7, color: 0x8a6545 }),
  defineAsset('classroom-chair', 'furniture', 'chairDesk.glb', { width: 0.6, height: 1, depth: 0.6, color: 0xa1744d }),
  defineAsset('classroom-screen', 'furniture', 'computerScreen.glb', { width: 0.8, height: 0.55, depth: 0.12, color: 0x3f708a }),
  defineAsset('library-bookcase', 'furniture', 'bookcaseOpen.glb', { width: 1.3, height: 2, depth: 0.45, color: 0x7a5437 }),
  defineAsset('library-books', 'furniture', 'books.glb', { width: 0.7, height: 0.25, depth: 0.25, color: 0xc48b45 }),
  defineAsset('campus-bench', 'furniture', 'bench.glb', { width: 2, height: 0.9, depth: 0.7, color: 0x89664c }),
  defineAsset('campus-sofa', 'furniture', 'loungeSofa.glb', { width: 2.4, height: 1, depth: 0.9, color: 0x6d536e }),
  defineAsset('campus-lamp', 'furniture', 'lampRoundFloor.glb', { width: 0.55, height: 2, depth: 0.55, color: 0xf0c878 }),
  defineAsset('record-laptop', 'furniture', 'laptop.glb', { width: 0.7, height: 0.4, depth: 0.5, color: 0x5b7187 }),
  defineAsset('archive-box', 'furniture', 'cardboardBoxOpen.glb', { width: 0.8, height: 0.6, depth: 0.8, color: 0x8d6849 }),
  defineAsset('campus-planter', 'furniture', 'plantSmall1.glb', { width: 0.6, height: 0.8, depth: 0.6, color: 0x477a52 }),
  defineAsset('broadcast-antenna', 'furniture', 'televisionAntenna.glb', { width: 1.3, height: 1.4, depth: 0.8, color: 0x7b899c }),
  defineAsset('media-speaker', 'furniture', 'speaker.glb', { width: 0.6, height: 1.4, depth: 0.55, color: 0x273448 }),
  defineAsset('campus-tree', 'nature', 'tree_default_dark.glb', { width: 2.5, height: 5, depth: 2.5, color: 0x3c714c }),
  defineAsset('campus-bush', 'nature', 'plant_bushLarge.glb', { width: 1.8, height: 1.2, depth: 1.8, color: 0x477a52 }),
  defineAsset('campus-rock', 'nature', 'rock_largeA.glb', { width: 1.6, height: 1.2, depth: 1.4, color: 0x68727a }),
  defineAsset('campus-fence', 'nature', 'fence_simple.glb', { width: 2, height: 1.2, depth: 0.2, color: 0x6f5842 }),
  defineAsset('campus-grass', 'nature', 'grass_large.glb', { width: 1.4, height: 0.9, depth: 1.4, color: 0x3d6f54 }),
  defineAsset('memory-flower', 'nature', 'flower_yellowA.glb', { width: 0.5, height: 0.7, depth: 0.5, color: 0xf0c878 }),
  defineAsset('campus-bridge', 'nature', 'bridge_woodNarrow.glb', { width: 2.5, height: 0.6, depth: 5, color: 0x76593e })
]);

function defineMaterial(id, source, folder, filePrefix, placeholderColor) {
  const basePath = `./assets/reboot/environment/materials/${folder}/${filePrefix}_1K-JPG`;
  return Object.freeze({
    id,
    source,
    maps: Object.freeze({
      color: `${basePath}_Color.jpg`,
      normal: `${basePath}_NormalGL.jpg`,
      roughness: `${basePath}_Roughness.jpg`
    }),
    placeholderColor
  });
}

export const ENVIRONMENT_MATERIALS = Object.freeze([
  defineMaterial('masonry-brick', 'bricks', 'bricks', 'Bricks001', 0x7b4938),
  defineMaterial('structural-concrete', 'concrete', 'concrete', 'Concrete004', 0x777875),
  defineMaterial('interior-wood', 'wood', 'wood', 'WoodFloor041', 0x9a7049),
  defineMaterial('road-asphalt', 'asphalt', 'asphalt', 'Asphalt009', 0x42484c)
]);

const ASSET_BY_ID = new Map(ENVIRONMENT_ASSETS.map((asset) => [asset.id, asset]));
const MATERIAL_BY_ID = new Map(ENVIRONMENT_MATERIALS.map((material) => [material.id, material]));

export function getEnvironmentAsset(id) {
  const asset = ASSET_BY_ID.get(id);
  if (!asset) throw new RangeError(`알 수 없는 환경 에셋: ${id}`);
  return asset;
}

export function getEnvironmentMaterial(id) {
  const material = MATERIAL_BY_ID.get(id);
  if (!material) throw new RangeError(`알 수 없는 환경 재질: ${id}`);
  return material;
}

export function resolveEnvironmentAssetUrl(asset, baseUrl) {
  if (!asset?.path) throw new TypeError('환경 에셋 경로가 필요합니다.');
  if (!baseUrl) throw new TypeError('환경 에셋 기준 URL이 필요합니다.');
  return new URL(asset.path, baseUrl).href;
}
