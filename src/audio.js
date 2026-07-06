// 무설치·오프라인 유지를 위해 외부 음원 파일 없이 Web Audio로 소리를 절차적으로 만든다.
// 브라우저 자동재생 정책 때문에 첫 사용자 입력에서 resume()해야 소리가 난다.

const AudioContextClass =
  typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;

export function createAudioEngine() {
  let ctx = null;
  let master = null;
  let ambientGain = null;
  let muted = false;
  let started = false;

  function ensureContext() {
    if (!AudioContextClass) {
      return null;
    }
    if (!ctx) {
      ctx = new AudioContextClass();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);
    }
    return ctx;
  }

  // 첫 상호작용에서 호출 — 오디오 컨텍스트를 깨우고 잔잔한 배경 패드를 시작한다.
  function resume() {
    const context = ensureContext();
    if (!context) {
      return;
    }
    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }
    if (!started) {
      started = true;
      startAmbient();
    }
  }

  function startAmbient() {
    if (!ctx || ambientGain) {
      return;
    }
    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.0;
    ambientGain.connect(master);
    // 낮은 두 음을 겹쳐 은은한 섬 분위기 패드를 만든다.
    for (const freq of [110, 164.81]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.08;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 3;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(ambientGain);
      osc.start();
      lfo.start();
    }
    ambientGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 2.5);
  }

  // 짧은 톤 하나를 재생하는 공통 헬퍼.
  function blip(freq, { type = 'sine', duration = 0.16, gain = 0.28, slideTo = null } = {}) {
    const context = ensureContext();
    if (!context || muted) {
      return;
    }
    const now = context.currentTime;
    const osc = context.createOscillator();
    const env = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(env);
    env.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // 여러 음을 순서대로 연주하는 아르페지오 헬퍼.
  function arpeggio(freqs, { step = 0.08, type = 'triangle', gain = 0.26 } = {}) {
    const context = ensureContext();
    if (!context || muted) {
      return;
    }
    freqs.forEach((freq, index) => {
      window.setTimeout(() => blip(freq, { type, duration: 0.2, gain }), index * step * 1000);
    });
  }

  return {
    resume,
    isMuted: () => muted,
    toggleMute() {
      muted = !muted;
      if (master && ctx) {
        master.gain.linearRampToValueAtTime(muted ? 0 : 0.9, ctx.currentTime + 0.15);
      }
      return muted;
    },
    playClick() {
      blip(320, { type: 'triangle', duration: 0.09, gain: 0.16 });
    },
    playCorrect() {
      // 밝게 올라가는 3음 — 정답의 쾌감.
      arpeggio([523.25, 659.25, 783.99], { step: 0.09, type: 'triangle', gain: 0.24 });
    },
    playWrong() {
      // 부드럽게 내려가는 음 — 처벌이 아니라 "다시 해보자" 느낌.
      blip(300, { type: 'sine', duration: 0.26, gain: 0.2, slideTo: 190 });
    },
    playCollect() {
      // 반짝이며 상승하는 조각 획득음.
      arpeggio([659.25, 880, 1174.66], { step: 0.07, type: 'sine', gain: 0.28 });
    },
    playCoreAwaken() {
      // 낮게 울리는 각성음 + 상승 아르페지오.
      blip(80, { type: 'sawtooth', duration: 0.9, gain: 0.22, slideTo: 160 });
      arpeggio([392, 523.25, 659.25, 783.99, 1046.5], { step: 0.12, type: 'triangle', gain: 0.24 });
    }
  };
}
