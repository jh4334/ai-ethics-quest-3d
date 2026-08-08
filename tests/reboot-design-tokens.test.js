import assert from 'node:assert/strict';
import test from 'node:test';

import { DESIGN_TOKENS, WORLD_COLORS, applyDesignTokens } from '../src/reboot/design/tokens.js';

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
