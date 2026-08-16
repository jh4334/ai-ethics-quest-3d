import { createActorRenderer, drawImageCell } from './sideScrollActors.js';
import { createSideScrollSceneLayout } from './sideScrollLayout.js';

const GROUND_TILE_WIDTH = 256;
const GROUND_Y = 560;

function pingPong(value, range) {
  if (range <= 0) return 0;
  const cycle = value % (range * 2);
  return cycle <= range ? cycle : range * 2 - cycle;
}

export function createSideScrollRenderer({ context, images, palette, width = 1280, height = 720 }) {
  function drawGlow(x, y, radius, color, strength = 0.62) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.3, color);
    gradient.addColorStop(1, palette.glowFade);
    context.save();
    context.globalAlpha = strength;
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  const actors = createActorRenderer({ context, images, palette, width, drawGlow });

  function drawBackground(state, layout) {
    context.fillStyle = palette.surfaceNight;
    context.fillRect(0, 0, width, height);
    const image = images.background;
    if (image.complete && image.naturalWidth > 0) {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      const farSourceWidth = image.naturalWidth * 0.82;
      const farSourceX = pingPong(Math.abs(layout.farBackgroundX) + state.chapterIndex * 61, image.naturalWidth - farSourceWidth);
      context.drawImage(image, farSourceX, 0, farSourceWidth, image.naturalHeight, 0, 0, width, height);
      context.save();
      context.globalAlpha = 0.22;
      const midSourceWidth = image.naturalWidth * 0.7;
      const midSourceX = pingPong(Math.abs(layout.midBackgroundX) + state.chapterIndex * 113, image.naturalWidth - midSourceWidth);
      context.drawImage(image, midSourceX, image.naturalHeight * 0.42, midSourceWidth, image.naturalHeight * 0.58, 0, 270, width, 300);
      context.restore();
    }
    const veil = context.createLinearGradient(0, 0, width, height);
    veil.addColorStop(0, palette.veilSoft);
    veil.addColorStop(0.62, palette.veilMedium);
    veil.addColorStop(1, palette.veilDeep);
    context.fillStyle = veil;
    context.fillRect(0, 0, width, height);
  }

  function drawGround(layout) {
    const texture = images.ground;
    context.fillStyle = palette.surfaceNight;
    context.fillRect(0, GROUND_Y, width, height - GROUND_Y);
    if (texture.complete && texture.naturalWidth > 0) {
      for (const tile of layout.groundTiles) {
        context.drawImage(texture, 0, 0, texture.naturalWidth, texture.naturalHeight, tile.screenX, GROUND_Y, GROUND_TILE_WIDTH, 190);
      }
    }
    context.save();
    context.strokeStyle = palette.amberBright;
    context.globalAlpha = 0.46;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, GROUND_Y + 1);
    context.lineTo(width, GROUND_Y + 1);
    context.stroke();
    context.restore();
  }

  function drawLandmarks(state, layout) {
    for (let index = 0; index < layout.landmarks.length; index += 1) {
      const landmark = layout.landmarks[index];
      if (landmark.screenX < -180 || landmark.screenX > width + 180) continue;
      drawGlow(landmark.screenX, 458, 92, index % 2 === 0 ? palette.amberBright : palette.cyan, 0.2);
      drawImageCell(context, images.evidence, { columns: 3, rows: 2, column: index % 3, row: index % 2 }, {
        x: landmark.screenX - 52,
        y: 402,
        width: 104,
        height: 104,
        alpha: 0.62
      });
      context.save();
      context.font = '800 15px Pretendard, system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillStyle = palette.textSecondary;
      context.strokeStyle = palette.labelStroke;
      context.lineWidth = 5;
      context.strokeText(`${state.currentZone} · ${landmark.label}`, landmark.screenX, 390);
      context.fillText(`${state.currentZone} · ${landmark.label}`, landmark.screenX, 390);
      context.restore();
    }
  }

  function drawEvidence(state) {
    for (let index = 0; index < state.evidence.length; index += 1) {
      const evidence = state.evidence[index];
      if (evidence.collected) continue;
      const x = evidence.x - state.cameraX;
      if (x < -140 || x > width + 140) continue;
      const guardian = state.enemies.find(({ id }) => id === evidence.enemyId);
      const available = guardian?.defeated;
      const bob = Math.sin(state.time * 2.4 + evidence.x * 0.01) * 7;
      drawGlow(x, 474 + bob, available ? 92 : 58, available ? palette.evidenceGlow : palette.lockedGlow);
      drawImageCell(context, images.evidence, { columns: 3, rows: 2, column: index % 3, row: state.chapterIndex % 2 }, {
        x: x - 62,
        y: 402 + bob,
        width: 124,
        height: 124,
        alpha: available ? 1 : 0.62
      });
      context.save();
      context.font = '800 18px Pretendard, system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillStyle = available ? palette.amberBright : palette.textSecondary;
      context.strokeStyle = palette.labelStroke;
      context.lineWidth = 5;
      context.strokeText(evidence.label, x, 408 + bob);
      context.fillText(evidence.label, x, 408 + bob);
      context.restore();
    }
  }

  return (state) => {
    const layout = createSideScrollSceneLayout(state, width);
    drawBackground(state, layout);
    drawLandmarks(state, layout);
    drawGround(layout);
    drawEvidence(state);
    actors.drawEnemies(state);
    actors.drawBoss(state);
    actors.drawProjectiles(state);
    actors.drawPlayer(state, layout);
  };
}
