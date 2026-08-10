const placement = (assetId, position, scale, rotationY, vistaRole) => Object.freeze({
  assetId,
  districtId: 'open-classroom',
  position: Object.freeze(position),
  rotationY,
  scale,
  vistaRole
});

const VISTA_SCALE = Object.freeze({
  'campus-hero-rock': 0.65,
  'vista-bush': 0.38,
  'vista-fern': 1,
  'vista-grass': 0.45,
  'vista-rock': 0.58
});

const wing = (assetId, side, x, y, z, scale, rotationY) => placement(
  assetId, { x, y, z }, scale * VISTA_SCALE[assetId], rotationY, `foreground-${side}`
);

export const CAMPUS_FIRST_VISTA_ASSET_PLACEMENTS = Object.freeze([
  wing('vista-bush', 'left', -5.95, 0.04, 8.2, 3.7, 0.5),
  wing('vista-grass', 'left', -5.2, 0.08, 7.1, 3.1, -0.3),
  wing('vista-fern', 'left', -5.7, 0.05, 5.9, 0.72, 0.7),
  wing('vista-rock', 'left', -4.7, 0.04, 5.2, 1.25, 0.2),
  wing('vista-bush', 'left', -5.35, 0.12, 3.9, 2.8, -0.45),
  wing('vista-grass', 'left', -4.5, 0.08, 3.15, 2.55, 0.35),
  wing('vista-fern', 'left', -4.3, 0.14, 1.65, 0.58, -0.6),
  wing('vista-rock', 'left', -3.35, 0.04, 1.5, 1.08, 0.55),
  wing('vista-bush', 'left', -3.75, 0.08, 0.9, 2.55, 0.25),
  wing('vista-grass', 'left', -3.05, 0.06, 0.3, 2.45, -0.4),
  wing('vista-fern', 'left', -4.35, 0.18, -0.8, 0.52, 0.8),
  wing('vista-rock', 'left', -4.8, 0.28, -1.5, 1.42, -0.25),
  wing('vista-bush', 'left', -3.7, 0.24, -2.6, 2.35, 0.65),
  wing('vista-grass', 'left', -3.2, 0.16, -3.7, 2.15, -0.75),
  wing('vista-fern', 'left', -4.25, 0.32, -4.9, 0.48, 0.15),
  wing('vista-rock', 'left', -4.7, 0.34, -6.2, 1.22, 0.7),
  wing('vista-bush', 'left', -3.55, 0.3, -7.2, 2.1, -0.35),
  wing('vista-grass', 'left', -3.05, 0.22, -8.4, 1.95, 0.55),
  wing('vista-fern', 'left', -4.15, 0.38, -9.6, 0.42, -0.7),
  wing('vista-bush', 'left', -3.2, 0.42, -10.8, 1.75, 0.35),
  wing('vista-fern', 'right', 5.95, 0.05, 8.2, 0.82, -0.55),
  wing('vista-grass', 'right', 5.2, 0.08, 7.05, 3.3, 0.4),
  wing('vista-bush', 'right', 5.75, 0.06, 5.85, 3.25, -0.7),
  wing('vista-rock', 'right', 4.7, 0.04, 5.1, 1.2, -0.2),
  wing('vista-fern', 'right', 5.3, 0.12, 3.9, 0.7, 0.48),
  wing('vista-grass', 'right', 4.45, 0.08, 3.1, 2.65, -0.4),
  wing('vista-bush', 'right', 4.9, 0.12, 2.25, 2.45, 0.62),
  wing('vista-rock', 'right', 3.4, 0.04, 1.55, 1.04, -0.6),
  wing('vista-fern', 'right', 3.8, 0.08, 0.9, 0.56, -0.3),
  wing('vista-grass', 'right', 3.25, 0.06, 0.35, 2.4, 0.45),
  wing('vista-bush', 'right', 4.35, 0.18, -0.85, 2.3, -0.8),
  wing('vista-rock', 'right', 4.85, 0.28, -1.55, 1.38, 0.3),
  wing('vista-fern', 'right', 3.7, 0.24, -2.65, 0.54, -0.65),
  wing('vista-grass', 'right', 3.2, 0.16, -3.75, 2.2, 0.78),
  wing('vista-bush', 'right', 4.25, 0.32, -4.9, 2.15, -0.2),
  wing('vista-rock', 'right', 4.7, 0.34, -6.2, 1.18, -0.75),
  wing('vista-fern', 'right', 3.55, 0.3, -7.2, 0.48, 0.4),
  wing('vista-grass', 'right', 3.05, 0.22, -8.4, 2, -0.58),
  wing('vista-bush', 'right', 4.15, 0.38, -9.6, 1.9, 0.72),
  wing('campus-hero-rock', 'right', 4.9, 0.12, 1.2, 1.5, -0.45)
]);

export const CAMPUS_VISTA_PATH_ASSET_PLACEMENTS = Object.freeze(Array.from(
  { length: 14 },
  (_, index) => placement(
    'vista-path-stone',
    {
      x: (index % 2 === 0 ? -0.72 : 0.72) + Math.sin(index * 1.7) * 0.18,
      y: 0.34 + (index % 3) * 0.006,
      z: 4.2 - index * 1.65
    },
    1.14 + (index % 4) * 0.08,
    index * 0.71,
    'path-surface'
  )
));

export const CAMPUS_VISTA_HORIZON_ASSET_PLACEMENTS = Object.freeze([
  placement('vista-rock', { x: -22, y: -2.4, z: -31 }, 5.8, 0.2, 'horizon-cliff'),
  placement('vista-rock', { x: 24, y: -2.7, z: -30 }, 6.2, -0.25, 'horizon-cliff')
]);
