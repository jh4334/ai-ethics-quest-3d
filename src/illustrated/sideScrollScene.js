import { createSideScrollSceneLayout } from './sideScrollLayout.js';

const GROUND_TILE_WIDTH = 256;
const GROUND_Y = 560;

function drawImageCell(context, image, cell, frame) {
  if (!image.complete || image.naturalWidth === 0) return;
  const sourceWidth = image.naturalWidth / cell.columns;
  const sourceHeight = image.naturalHeight / cell.rows;
  context.save();
  context.globalAlpha = frame.alpha ?? 1;
  let drawX = frame.x;
  if ((frame.facing ?? 1) < 0) {
    context.translate(frame.x + frame.width, 0);
    context.scale(-1, 1);
    drawX = 0;
  }
  context.drawImage(
    image,
    cell.column * sourceWidth,
    cell.row * sourceHeight,
    sourceWidth,
    sourceHeight,
    drawX,
    frame.y,
    frame.width,
    frame.height
  );
  context.restore();
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

  function drawBackground(state, layout) {
    context.fillStyle = palette.surfaceNight;
    context.fillRect(0, 0, width, height);
    const image = images.background;
    if (image.complete && image.naturalWidth > 0) {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      for (let panel = -1; panel <= 1; panel += 1) {
        const panelX = layout.farBackgroundX + panel * width;
        const sourceWidth = image.naturalWidth / 2;
        const sourceX = ((state.chapterIndex + panel + 6) % 2) * sourceWidth;
        context.drawImage(image, sourceX, 0, sourceWidth, image.naturalHeight, panelX, 0, width, height);
      }
      context.save();
      context.globalAlpha = 0.22;
      for (let panel = -1; panel <= 1; panel += 1) {
        const panelX = layout.midBackgroundX + panel * width;
        context.drawImage(image, 0, image.naturalHeight * 0.42, image.naturalWidth, image.naturalHeight * 0.58, panelX, 270, width, 300);
      }
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
    for (const evidence of state.evidence) {
      if (evidence.collected) continue;
      const x = evidence.x - state.cameraX;
      if (x < -140 || x > width + 140) continue;
      const guardian = state.enemies.find(({ id }) => id === evidence.enemyId);
      const available = guardian?.defeated;
      const bob = Math.sin(state.time * 2.4 + evidence.x * 0.01) * 7;
      drawGlow(x, 474 + bob, available ? 92 : 58, available ? palette.evidenceGlow : palette.lockedGlow);
      drawImageCell(context, images.evidence, { columns: 3, rows: 2, column: state.chapterIndex % 3, row: Math.floor(state.chapterIndex / 3) }, {
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

  function drawEnemyHealth(enemy, x) {
    context.fillStyle = palette.healthSurface;
    context.fillRect(x - 43, 430, 86, 9);
    context.fillStyle = palette.danger;
    context.fillRect(x - 40, 433, 80 * (enemy.hp / enemy.maxHp), 3);
  }

  function drawEnemies(state) {
    for (const enemy of state.enemies) {
      if (enemy.defeated) continue;
      const x = enemy.x - state.cameraX;
      if (x < -150 || x > width + 150) continue;
      drawGlow(x, 513, 58, palette.enemyGlow, 0.28);
      drawImageCell(context, images.sprites, { columns: 4, rows: 2, column: 1, row: 1 }, {
        x: x - 64, y: 438, width: 128, height: 128, facing: state.player.x < enemy.x ? -1 : 1, alpha: enemy.hitFlash > 0 ? 0.55 : 1
      });
      drawEnemyHealth(enemy, x);
    }
  }

  function drawBoss(state) {
    if (!state.boss.active) return;
    const x = state.boss.x - state.cameraX;
    if (x < -280 || x > width + 280) return;
    drawGlow(x, 438, state.boss.staggered ? 170 : 120, palette.bossGlow, state.boss.staggered ? 0.7 : 0.28);
    drawImageCell(context, images.sprites, { columns: 4, rows: 2, column: state.boss.staggered ? 3 : 2, row: 1 }, {
      x: x - 125, y: 296, width: 250, height: 250, facing: -1, alpha: state.boss.hitFlash > 0 ? 0.55 : 1
    });
    context.fillStyle = palette.bossSurface;
    context.fillRect(x - 104, 272, 208, 16);
    context.fillStyle = state.boss.staggered ? palette.cyan : palette.danger;
    context.fillRect(x - 100, 277, 200 * (state.boss.hp / state.boss.maxHp), 6);
    context.font = '800 16px Pretendard, system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillStyle = palette.textPrimary;
    context.fillText(state.boss.label, x, 260);
  }

  function drawProjectiles(state) {
    for (const projectile of state.projectiles) {
      const x = projectile.x - state.cameraX;
      drawGlow(x, projectile.y, 48, palette.projectileGlow, 0.36);
      drawImageCell(context, images.sprites, { columns: 4, rows: 2, column: 1, row: 1 }, {
        x: x - 34, y: projectile.y - 34, width: 68, height: 68, facing: -1, alpha: 0.8
      });
    }
  }

  function drawPlayer(state, layout) {
    const player = state.player;
    const moving = Math.abs(player.vx) > 1;
    let column = moving ? 1 : 0;
    if (!player.onGround) column = 2;
    if (player.attackTimer > 0) column = 3;
    const runBob = moving && player.onGround ? Math.sin(state.time * 15) * 3 : 0;
    drawGlow(layout.playerScreenX, player.y - 15, 92, palette.playerGlow, 0.2);
    const flicker = player.invulnerable > 0 && Math.floor(state.time * 16) % 2 === 0;
    drawImageCell(context, images.sprites, { columns: 4, rows: 2, column, row: 0 }, {
      x: layout.playerScreenX - 82,
      y: player.y - 166 + runBob,
      width: 164,
      height: 164,
      facing: player.facing,
      alpha: flicker ? 0.42 : 1
    });
    const dotBob = Math.sin(state.time * 3.2) * 5;
    drawImageCell(context, images.sprites, { columns: 4, rows: 2, column: 0, row: 1 }, {
      x: layout.playerScreenX - player.facing * 74 - 30,
      y: player.y - 138 + dotBob,
      width: 60,
      height: 60
    });
  }

  return (state) => {
    const layout = createSideScrollSceneLayout(state, width);
    drawBackground(state, layout);
    drawLandmarks(state, layout);
    drawGround(layout);
    drawEvidence(state);
    drawEnemies(state);
    drawBoss(state);
    drawProjectiles(state);
    drawPlayer(state, layout);
  };
}
