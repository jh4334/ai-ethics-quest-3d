const FAR_PARALLAX = 0.18;
const MID_PARALLAX = 0.38;
const GROUND_TILE_WIDTH = 256;

function getLandmarks(worldWidth) {
  return [
    { id: 'entry', worldX: 320, label: '기록 진입점' },
    { id: 'audit', worldX: 1540, label: '감사 관문' },
    { id: 'archive', worldX: 3060, label: '검증 회랑' },
    { id: 'core', worldX: worldWidth - 420, label: '결정 코어' }
  ];
}

export function createSideScrollSceneLayout(state, viewportWidth = 1280) {
  const cameraX = state.cameraX;
  const firstGroundTile = Math.floor(cameraX / GROUND_TILE_WIDTH) - 1;
  const groundTileCount = Math.ceil(viewportWidth / GROUND_TILE_WIDTH) + 3;
  return {
    playerScreenX: state.player.x - cameraX,
    farBackgroundX: -(cameraX * FAR_PARALLAX % viewportWidth),
    midBackgroundX: -(cameraX * MID_PARALLAX % viewportWidth),
    groundTiles: Array.from({ length: groundTileCount }, (_, index) => {
      const tileIndex = firstGroundTile + index;
      const worldX = tileIndex * GROUND_TILE_WIDTH;
      return { worldX, screenX: worldX - cameraX };
    }),
    landmarks: getLandmarks(state.world.width).map((landmark) => ({
      ...landmark,
      screenX: landmark.worldX - cameraX
    }))
  };
}
