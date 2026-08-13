const CAMERA_PROFILES = Object.freeze({
  2: Object.freeze({
    desktop: Object.freeze({ fov: 44, identity: 'media-plaza-shoulder', look: [0.8, 1.05, -2.8], offset: [2.5, 4.25, 6.8] }),
    portrait: Object.freeze({ fov: 58, identity: 'media-plaza-shoulder', look: [0.5, 0.85, -2.4], offset: [1.8, 7.2, 11.2] })
  }),
  3: Object.freeze({
    desktop: Object.freeze({ fov: 49, identity: 'dual-school-split', look: [1.2, 1.1, -3.4], offset: [-2.7, 4.65, 7.5] }),
    portrait: Object.freeze({ fov: 60, identity: 'dual-school-split', look: [0.8, 0.9, -2.8], offset: [-1.8, 7.8, 12] })
  }),
  4: Object.freeze({
    desktop: Object.freeze({ fov: 43, identity: 'approval-axis', look: [-0.4, 0.95, -3.2], offset: [0.8, 4.1, 6.2] }),
    portrait: Object.freeze({ fov: 57, identity: 'approval-axis', look: [-0.2, 0.8, -3.6], offset: [0.6, 7.1, 10.2] })
  })
});

export function campaignCameraFrame(chapter, playerPosition, portrait = false) {
  const profile = CAMERA_PROFILES[chapter]?.[portrait ? 'portrait' : 'desktop'];
  if (!profile || !Number.isFinite(playerPosition?.x) || !Number.isFinite(playerPosition?.y)) {
    throw new RangeError('2~4장 카메라에는 장 번호와 플레이어 위치가 필요합니다.');
  }
  const [offsetX, positionY, offsetZ] = profile.offset;
  const [lookX, lookY, lookZ] = profile.look;
  return Object.freeze({
    fov: profile.fov,
    identity: profile.identity,
    lookAt: Object.freeze({ x: playerPosition.x * 0.7 + lookX, y: lookY, z: playerPosition.y + lookZ }),
    position: Object.freeze({ x: playerPosition.x * 0.45 + offsetX, y: positionY, z: playerPosition.y + offsetZ })
  });
}
