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
