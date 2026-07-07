import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioEngine } from '../src/audio.js';

// Node 환경에는 AudioContext가 없으므로, 엔진이 소리 없이도 안전하게 동작(무크래시)하는지와
// 음소거 상태 토글이 올바른지를 검증한다(브라우저 없이 회귀 방지).

test('audio engine is safe to use without an AudioContext (headless/SSR)', () => {
  const audio = createAudioEngine();
  assert.equal(audio.isMuted(), false);
  // 아래 호출들은 소리를 못 내더라도 예외를 던지지 않아야 한다.
  assert.doesNotThrow(() => {
    audio.resume();
    audio.playClick();
    audio.playCorrect();
    audio.playWrong();
    audio.playCollect();
    audio.playCoreAwaken();
    audio.playNoiseGroan();
    audio.playNovaChime();
  });
});

test('toggleMute flips and reports the mute state', () => {
  const audio = createAudioEngine();
  assert.equal(audio.isMuted(), false);
  assert.equal(audio.toggleMute(), true);
  assert.equal(audio.isMuted(), true);
  assert.equal(audio.toggleMute(), false);
  assert.equal(audio.isMuted(), false);
});
