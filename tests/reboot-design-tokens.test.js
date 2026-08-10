import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAMPUS_VISUAL_PROFILE, DESIGN_TOKENS, WORLD_COLORS, applyDesignTokens
} from '../src/reboot/design/tokens.js';

test('디자인 계약의 핵심 색은 CSS와 Three.js가 공유하는 한 토큰 집합이다', () => {
  assert.deepEqual(DESIGN_TOKENS.color, {
    danger: '#d74732', memory: '#f4c06d', moon: '#6aa9ff', muted: '#a9bce9',
    night: '#050918', panel: '#081126', signal: '#5de0c1', text: '#e9f0ff'
  });
  assert.equal(WORLD_COLORS.night, 0x050918);
  assert.equal(WORLD_COLORS.memory, 0xf4c06d);
  assert.equal(WORLD_COLORS.signal, 0x5de0c1);
});

test('제품 루트에 같은 토큰을 CSS 사용자 속성으로 적용한다', () => {
  const applied = new Map();
  applyDesignTokens({ style: { setProperty: (name, value) => applied.set(name, value) } });

  assert.equal(applied.get('--h17-night'), '#050918');
  assert.equal(applied.get('--h17-panel'), '#081126');
  assert.equal(applied.get('--h17-memory'), '#f4c06d');
  assert.equal(applied.get('--h17-signal'), '#5de0c1');
  assert.equal(applied.size, 8);
});

test('P0 캠퍼스 시각 프로필은 어깨너머 카메라와 황혼 대기 램프를 한 계약으로 고정한다', () => {
  assert.deepEqual(CAMPUS_VISUAL_PROFILE.camera.desktop, {
    distance: 7.2, fov: 42, height: 2.55, lateral: 2.35,
    firstVista: {
      distanceShift: 0.45, fov: 42, heightShift: 0.72,
      lateralShift: 1.05, lookLateral: 0.52, lookLift: 1.34
    },
    routeDistanceShift: 1.8, routeFov: 46, routeLateralShift: 0.05, routeLookLift: 1.5
  });
  assert.deepEqual(CAMPUS_VISUAL_PROFILE.atmosphere, {
    bottom: 0x315f82,
    fog: 0x172842,
    horizon: 0x8d5f77,
    top: 0x18345c
  });
  assert.deepEqual(CAMPUS_VISUAL_PROFILE.lighting, {
    deletionIntensity: 5.2,
    memoryIntensity: 8.8,
    moonIntensity: 2.35
  });
  assert.deepEqual(CAMPUS_VISUAL_PROFILE.materialTint, {
    brick: 0xb98470,
    concrete: 0x8d96a6,
    track: 0xe39a94,
    wood: 0xd6b68d
  });
});
