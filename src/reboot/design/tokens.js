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
    bottom: 0x557a9c,
    fog: 0x3d5572,
    horizon: 0xb98aa8,
    top: 0x324a75
  }),
  camera: Object.freeze({
    desktop: Object.freeze({
      distance: 7.2,
      fov: 42,
      firstVista: Object.freeze({
        distanceShift: 0.35,
        fov: 40,
        heightShift: 0.7,
        lateralShift: -0.75,
        lookLateral: 0.85,
        lookLift: 0.82
      }),
      height: 2.55,
      lateral: 2.35,
      routeDistanceShift: 1.8,
      routeFov: 46,
      routeLateralShift: 0.05,
      routeLookLift: 1.5
    }),
    touch: Object.freeze({
      distance: 9.8,
      fov: 52,
      firstVista: Object.freeze({
        distanceShift: -0.55,
        fov: 50,
        heightShift: 1.35,
        lateralShift: -0.15,
        lookLateral: 0,
        lookLift: -0.55
      }),
      tabletFirstVista: Object.freeze({
        distanceShift: -1.2,
        fov: 46,
        heightShift: -0.1,
        lateralShift: -0.15,
        lookLateral: 0,
        lookLift: -0.3
      }),
      height: 5.7,
      lateral: 2.35
    })
  }),
  lighting: Object.freeze({
    deletionIntensity: 5.2,
    memoryIntensity: 5.6,
    moonIntensity: 2.75
  }),
  materialTint: Object.freeze({
    brick: 0xb98470,
    concrete: 0x7b8799,
    path: 0xaa94a1,
    terrain: 0x596276,
    track: 0xe39a94,
    wood: 0xd6b68d
  }),
  referenceVista: Object.freeze({
    islandTop: 0x40546c,
    islandUnderside: 0x18263b,
    leftLeaves: Object.freeze([0x724255, 0x8f536a, 0x5d486f, 0xa45e5a]),
    memoryCore: 0xff9a38,
    memoryHalo: 0xffbd64,
    mist: 0x62758d,
    rightLeaves: Object.freeze([0x8d6341, 0xb37b4e, 0x9c744a, 0xc28e59]),
    treeCanopy: Object.freeze([0x2e4458, 0x23384d, 0x1a2d42]),
    treeTrunk: 0x342937
  }),
  silhouette: Object.freeze([0x3a5275, 0x2b4162, 0x1c2d49])
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
