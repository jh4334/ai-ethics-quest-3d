import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('keyboard interaction does not swallow native button activation keys', () => {
  assert.match(mainSource, /isFormControl/);
  assert.match(mainSource, /!isFormControl && \(event\.code === 'KeyE'/);
});

test('final core runs the Noise->Nova finale and is terminal once completed', () => {
  // 최종장: 지운다/가르친다 선택을 거쳐 노바로 재탄생 → 증명서.
  assert.match(mainSource, /data-finale-choice/);
  assert.match(mainSource, /renderTeach|renderErase/);
  // 가르치면 검증된 완료 전이를 재사용해 코어를 완료하고 증명서를 띄운다.
  assert.match(mainSource, /completeFinalCore\(game\.progress, 'balanced-promise'\)/);
  assert.match(mainSource, /showCertificate\(game, ui\)/);
  // 이미 완료했다면 선택을 다시 묻지 않고 후일담을 보여준다.
  assert.match(mainSource, /if \(game\.progress\.aiCoreCompleted\)/);
});

test('touch controls expose all movement directions including down', () => {
  const downRule = cssSource.match(/\.touch-dpad \[data-touch="down"\] \{[\s\S]*?\}/)?.[0] ?? '';
  assert.match(downRule, /grid-row:\s*3/);
  assert.doesNotMatch(downRule, /display:\s*none/);
  assert.match(cssSource, /grid-template-rows:\s*repeat\(3, 48px\)/);
});

test('controls are split: movement d-pad on the left, action/attack button on the right', () => {
  // 이동은 왼쪽 d-pad, 확인·공격은 오른쪽 A 버튼(젤다식 액션 배치).
  const controls = cssSource.match(/\.touch-controls \{[\s\S]*?\}/)?.[0] ?? '';
  assert.match(controls, /justify-content:\s*space-between/);
  assert.match(cssSource, /\.touch-a \{/);
  // 전투 중 공격을 '확인'과 분리해 처리한다.
  assert.match(mainSource, /function primaryAction/);
  assert.match(mainSource, /game\.combat\?\.active/);
  assert.match(mainSource, /function playerAttack/);
});

test('package engine range matches the locked Vite runtime floor', () => {
  assert.equal(packageJson.engines.node, '^20.19.0 || >=22.12.0');
});

test('visibility restore keeps the game paused while a dialog is open', () => {
  assert.match(mainSource, /game\.paused = document\.hidden \|\| !ui\.dialog\.hidden/);
});

test('mobile progress panel is a slim top bar (not overlapping the touch d-pad)', () => {
  const mobileStatusRule = cssSource.match(/@media \(pointer: coarse\), \(max-width: 760px\) \{[\s\S]*?\.status-strip \{[\s\S]*?\}/)?.[0] ?? '';
  // 하단 d-pad와 겹치지 않도록 상단에 배치하고 가로 슬림 바로 만든다.
  assert.match(mobileStatusRule, /top:\s*64px/);
  assert.match(mobileStatusRule, /flex-direction:\s*row/);
});

test('mobile interaction prompt is positioned beside rather than under touch controls', () => {
  const mobilePromptRule = cssSource.match(/@media \(pointer: coarse\), \(max-width: 760px\) \{[\s\S]*?\.interaction-prompt \{[\s\S]*?\}/)?.[0] ?? '';
  assert.match(mobilePromptRule, /right:\s*172px/);
  assert.match(mobilePromptRule, /transform:\s*none/);
});
