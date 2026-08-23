import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('루트는 횡스크롤이 아니라 라이브 3D 동화책을 연다', () => {
  assert.match(html, /하루와 사라진 이름/);
  assert.match(html, /data-storybook-canvas/);
  assert.match(html, /src="\/src\/storybook3d\/entry\.js"/);
  assert.doesNotMatch(html, /data-action-canvas|SIGNAL|TRACE|횡스크롤/);
});

test('WebGL 실패 안내와 2D 롤백 경로가 문서에 존재한다', () => {
  assert.match(html, /data-webgl-fallback/);
  assert.match(html, /illustrated\.html/);
});

