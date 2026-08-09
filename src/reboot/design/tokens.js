export const DESIGN_TOKENS = Object.freeze({
  color: Object.freeze({
    danger: '#d74732',
    memory: '#f4c06d',
    moon: '#6aa9ff',
    muted: '#a9bce9',
    night: '#050918',
    panel: '#081126',
    signal: '#5de0c1',
    text: '#e9f0ff'
  })
});

export const WORLD_COLORS = Object.freeze(Object.fromEntries(
  Object.entries(DESIGN_TOKENS.color).map(([name, value]) => [name, Number.parseInt(value.slice(1), 16)])
));

export const CAMPUS_VISUAL_PROFILE = Object.freeze({
  atmosphere: Object.freeze({
    bottom: 0x315f82,
    fog: 0x172842,
    horizon: 0x8d5f77,
    top: 0x18345c
  }),
  camera: Object.freeze({
    desktop: Object.freeze({
      distance: 7.2,
      fov: 42,
      firstVista: Object.freeze({
        distanceShift: 1.15,
        fov: 42,
        heightShift: 0.18,
        lateralShift: 2.45,
        lookLateral: 1.4,
        lookLift: 1.25
      }),
      height: 2.55,
      lateral: 2.35,
      routeDistanceShift: 1.8,
      routeFov: 46,
      routeLateralShift: 0.05,
      routeLookLift: 1.5
    }),
    touch: Object.freeze({ distance: 9.8, fov: 52, height: 5.7, lateral: 2.35 })
  }),
  lighting: Object.freeze({
    deletionIntensity: 5.2,
    memoryIntensity: 8.8,
    moonIntensity: 3.15
  }),
  materialTint: Object.freeze({
    brick: 0xe6b9a5,
    concrete: 0xb5bfd3,
    track: 0xe39a94,
    wood: 0xffffff
  }),
  silhouette: Object.freeze([0x314768, 0x233654, 0x17253f])
});

export const WORLD_MATERIALS = Object.freeze({
  brick: Object.freeze({ color: 0x8b4740, metalness: 0.02, roughness: 0.92 }),
  concrete: Object.freeze({ color: 0x66798f, metalness: 0.04, roughness: 0.88 }),
  foliage: Object.freeze({ color: 0x4f795b, metalness: 0, roughness: 0.94 }),
  glass: Object.freeze({
    color: 0x80bde0, depthWrite: false, metalness: 0.08, opacity: 0.34, roughness: 0.18, transparent: true
  }),
  metal: Object.freeze({ color: 0x748ca7, metalness: 0.82, roughness: 0.31 }),
  track: Object.freeze({ color: 0x8f3f3a, metalness: 0.01, roughness: 0.82 }),
  wood: Object.freeze({ color: 0xb07846, metalness: 0.01, roughness: 0.76 })
});

export function applyDesignTokens(target) {
  if (!target?.style || typeof target.style.setProperty !== 'function') {
    throw new TypeError('디자인 토큰을 적용할 스타일 대상이 필요합니다.');
  }
  for (const [name, value] of Object.entries(DESIGN_TOKENS.color)) {
    target.style.setProperty(`--h17-${name}`, value);
  }
}
