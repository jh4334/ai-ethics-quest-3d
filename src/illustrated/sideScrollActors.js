export function drawImageCell(context, image, cell, frame) {
  if (!image?.complete || image.naturalWidth === 0) return;
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

export function createActorRenderer({ context, images, palette, width, drawGlow }) {
  function drawStatus(x, y, traced, label) {
    context.save();
    context.font = '800 14px Pretendard, system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillStyle = traced ? palette.cyan : palette.amberBright;
    context.strokeStyle = palette.labelStroke;
    context.lineWidth = 5;
    const text = `${traced ? '◇ TRACE 완료' : '◆ 미확인'} · ${label}`;
    context.strokeText(text, x, y);
    context.fillText(text, x, y);
    context.restore();
  }

  function drawEnemyHealth(enemy, x) {
    context.fillStyle = palette.healthSurface;
    context.fillRect(x - 48, 382, 96, 10);
    context.fillStyle = enemy.traced ? palette.cyan : palette.danger;
    context.fillRect(x - 44, 385, 88 * (enemy.hp / enemy.maxHp), 4);
  }

  function drawEnemies(state) {
    const atlas = images.enemies[state.chapterIndex];
    for (const enemy of state.enemies) {
      if (enemy.defeated) continue;
      const x = enemy.x - state.cameraX;
      if (x < -170 || x > width + 170) continue;
      const kindIndex = Math.max(0, state.mechanics.enemyKinds.indexOf(enemy.kind));
      drawGlow(x, 500, enemy.traced ? 78 : 58, enemy.traced ? palette.cyan : palette.enemyGlow, enemy.traced ? 0.42 : 0.26);
      drawImageCell(context, atlas, { columns: 3, rows: 1, column: kindIndex, row: 0 }, {
        x: x - 92,
        y: 386,
        width: 184,
        height: 184,
        facing: state.player.x < enemy.x ? -1 : 1,
        alpha: enemy.hitFlash > 0 ? 0.55 : 1
      });
      drawEnemyHealth(enemy, x);
      drawStatus(x, 368, enemy.traced, ENEMY_LABELS[enemy.kind] ?? enemy.kind);
    }
  }

  function drawBossPhases(state, x) {
    const boss = state.boss;
    const startX = x - 60;
    for (let index = 0; index < boss.phases.length; index += 1) {
      context.beginPath();
      context.arc(startX + index * 60, 252, 9, 0, Math.PI * 2);
      context.fillStyle = index < boss.phaseIndex || boss.staggered
        ? palette.cyan
        : index === boss.phaseIndex
          ? palette.amberBright
          : palette.healthSurface;
      context.fill();
    }
  }

  function drawBoss(state) {
    if (!state.boss.active) return;
    const boss = state.boss;
    const x = boss.x - state.cameraX;
    if (x < -310 || x > width + 310) return;
    drawGlow(x, 430, boss.staggered ? 190 : 135, boss.staggered ? palette.cyan : palette.bossGlow, boss.staggered ? 0.72 : 0.32);
    drawImageCell(context, images.enemies[state.chapterIndex], { columns: 3, rows: 1, column: 2, row: 0 }, {
      x: x - 150,
      y: 270,
      width: 300,
      height: 300,
      facing: -1,
      alpha: boss.hitFlash > 0 ? 0.55 : 1
    });
    context.fillStyle = palette.bossSurface;
    context.fillRect(x - 114, 226, 228, 16);
    context.fillStyle = boss.staggered ? palette.cyan : palette.danger;
    context.fillRect(x - 110, 231, 220 * (boss.hp / boss.maxHp), 6);
    const phase = boss.phases[boss.phaseIndex];
    context.font = '800 16px Pretendard, system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillStyle = palette.textPrimary;
    context.fillText(`${boss.label} · ${phase.label}`, x, 214);
    drawBossPhases(state, x);
    drawStatus(x, 274, boss.traced || boss.staggered, `${boss.phaseIndex + 1}/3 단계`);
  }

  function drawProjectileShape(projectile, x) {
    context.save();
    context.translate(x, projectile.y);
    context.strokeStyle = projectile.reviewed ? palette.cyan : palette.danger;
    context.fillStyle = projectile.reviewed ? palette.cyan : palette.amberBright;
    context.lineWidth = 5;
    if (projectile.kind === 'approval-stamp') {
      context.strokeRect(-24, -20, 48, 40);
      context.beginPath();
      context.moveTo(-18, 0);
      context.lineTo(18, 0);
      context.stroke();
    } else if (projectile.kind.includes('echo') || projectile.kind.includes('reaction')) {
      for (const radius of [10, 22, 34]) {
        context.beginPath();
        context.arc(0, 0, radius, -1.1, 1.1);
        context.stroke();
      }
    } else if (projectile.kind.includes('feed')) {
      context.beginPath();
      context.arc(0, 0, 25, 0, Math.PI * 2);
      context.stroke();
      context.fillRect(-5, -5, 10, 10);
    } else {
      context.rotate(Math.PI / 4);
      context.fillRect(-18, -18, 36, 36);
      context.strokeRect(-25, -25, 50, 50);
    }
    context.restore();
  }

  function drawProjectiles(state) {
    for (const projectile of state.projectiles) {
      const x = projectile.x - state.cameraX;
      if (x < -80 || x > width + 80) continue;
      drawGlow(x, projectile.y, projectile.reviewed ? 64 : 48, projectile.reviewed ? palette.cyan : palette.projectileGlow, 0.38);
      drawProjectileShape(projectile, x);
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

  return { drawBoss, drawEnemies, drawPlayer, drawProjectiles };
}
const ENEMY_LABELS = Object.freeze({
  'consent-claw': '동의 탈취자',
  'bias-scanner': '편향 스캐너',
  'copycat-lens': '카피캣 렌즈',
  'forgery-mimic': '위조 미믹',
  'echo-relay': '에코 중계기',
  'reaction-swarm': '반응 군집',
  'warm-bubble': '확신 버블',
  'cold-bubble': '반증 버블',
  'approval-stamp': '자동 결재관',
  'score-clerk': '점수 서기',
  'whiteout-shard': '말소 파편',
  'chain-scrambler': '책임 교란자'
});
