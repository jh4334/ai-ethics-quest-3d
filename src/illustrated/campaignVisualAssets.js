import backgroundUrl from '../../public/assets/illustrated/h17-side-scroll-background-v1.png?url';
import spriteAtlasUrl from '../../public/assets/illustrated/h17-action-sprites-v1.png?url';
import evidenceAtlasUrl from '../../public/assets/illustrated/h17-evidence-relics-v1.png?url';
import groundTextureUrl from '../../public/assets/reboot/environment/materials/h17-stone/H17Stone_1K-JPG_Color.jpg?url';
import chapter1Enemies from '../../public/assets/illustrated/h17-chapter-1-enemies-v1.png?url';
import chapter2Enemies from '../../public/assets/illustrated/h17-chapter-2-enemies-v1.png?url';
import chapter3Enemies from '../../public/assets/illustrated/h17-chapter-3-enemies-v1.png?url';
import chapter4Enemies from '../../public/assets/illustrated/h17-chapter-4-enemies-v1.png?url';
import chapter5Enemies from '../../public/assets/illustrated/h17-chapter-5-enemies-v1.png?url';
import chapter6Enemies from '../../public/assets/illustrated/h17-chapter-6-enemies-v1.png?url';

export const enemyAtlasUrls = Object.freeze([
  chapter1Enemies,
  chapter2Enemies,
  chapter3Enemies,
  chapter4Enemies,
  chapter5Enemies,
  chapter6Enemies
]);

function loadImage(url) {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  return image;
}

export function createCampaignVisualAssets(designColor) {
  const palette = Object.freeze({
    surfaceNight: designColor('--surface-night'),
    textPrimary: designColor('--text-primary'),
    textSecondary: designColor('--text-secondary'),
    amberBright: designColor('--amber-bright'),
    cyan: designColor('--cyan'),
    danger: designColor('--danger'),
    veilSoft: designColor('--canvas-veil-soft'),
    veilMedium: designColor('--canvas-veil-medium'),
    veilDeep: designColor('--canvas-veil-deep'),
    glowFade: designColor('--canvas-glow-fade'),
    evidenceGlow: designColor('--canvas-evidence-glow'),
    lockedGlow: designColor('--canvas-locked-glow'),
    labelStroke: designColor('--canvas-label-stroke'),
    healthSurface: designColor('--canvas-health-surface'),
    enemyGlow: designColor('--canvas-enemy-glow'),
    bossGlow: designColor('--canvas-boss-glow'),
    bossSurface: designColor('--canvas-boss-surface'),
    projectileGlow: designColor('--canvas-projectile-glow'),
    playerGlow: designColor('--canvas-player-glow')
  });
  return {
    palette,
    images: {
      background: loadImage(backgroundUrl),
      sprites: loadImage(spriteAtlasUrl),
      evidence: loadImage(evidenceAtlasUrl),
      enemies: enemyAtlasUrls.map(loadImage),
      ground: loadImage(groundTextureUrl)
    }
  };
}
