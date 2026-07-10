// 무설치·오프라인 유지를 위해 외부 음원 파일 없이 Web Audio로 소리를 절차적으로 만든다.
// 브라우저 자동재생 정책 때문에 첫 사용자 입력에서 resume()해야 소리가 난다.

const AudioContextClass =
  typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;

export function createAudioEngine() {
  let ctx = null;
  let master = null;
  let muted = false;
  let started = false;
  // 장면별 BGM 레이어 — 셋 다 상시 재생하고 게인 크로스페이드로 전환한다.
  // (오실레이터 소수 + LFO 게이팅이라 저사양에도 부담 없고, 타이머가 없어 결정적이다.)
  let musicLayers = null;
  let musicMode = 'overworld';
  const MUSIC_LEVEL = { overworld: 0.06, dungeon: 0.055, boss: 0.075 };

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

  // 첫 상호작용에서 호출 — 오디오 컨텍스트를 깨우고 장면 BGM을 시작한다.
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
      startMusic();
    }
  }

  // 지속음 오실레이터 한 줄: freq를 lfo로 살짝 흔들거나(비브라토), gateHz로 뚝뚝 끊는다(맥동).
  function voice(target, { freq, type = 'sine', level = 1, vibratoHz = 0, vibratoDepth = 0, gateHz = 0 }) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    let out = target;
    if (level !== 1 || gateHz) {
      const g = ctx.createGain();
      g.gain.value = gateHz ? 0.5 * level : level;
      if (gateHz) {
        // 사각파 LFO(-0.5~0.5)를 더해 0↔level로 게이팅 — 타이머 없는 리듬.
        const gate = ctx.createOscillator();
        gate.type = 'square';
        gate.frequency.value = gateHz;
        const gateGain = ctx.createGain();
        gateGain.gain.value = 0.5 * level;
        gate.connect(gateGain);
        gateGain.connect(g.gain);
        gate.start();
      }
      osc.connect(g);
      g.connect(target);
      out = g;
    } else {
      osc.connect(target);
    }
    if (vibratoHz) {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = vibratoHz;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = vibratoDepth;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();
    }
    osc.start();
    return out;
  }

  function startMusic() {
    if (!ctx || musicLayers) {
      return;
    }
    musicLayers = {};
    for (const name of ['overworld', 'dungeon', 'boss']) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(master);
      musicLayers[name] = gain;
    }
    // 오버월드 — 낮은 두 음의 은은한 섬 패드(기존 분위기 유지).
    voice(musicLayers.overworld, { freq: 110, vibratoHz: 0.08, vibratoDepth: 3 });
    voice(musicLayers.overworld, { freq: 164.81, vibratoHz: 0.08, vibratoDepth: 3 });
    // 던전 — 단3도 저음 드론 + 아주 느리게 반짝이는 높은 물방울(신비·수수께끼).
    voice(musicLayers.dungeon, { freq: 87.31, vibratoHz: 0.05, vibratoDepth: 2 });
    voice(musicLayers.dungeon, { freq: 103.83, vibratoHz: 0.07, vibratoDepth: 2 });
    voice(musicLayers.dungeon, { freq: 523.25, type: 'triangle', level: 0.12, gateHz: 0.14 });
    // 보스 — 낮은 톱니 드론 + 2.2Hz로 맥동하는 단3도(긴장, 위협적이지 않게 작게).
    voice(musicLayers.boss, { freq: 55, type: 'sawtooth', level: 0.5, vibratoHz: 0.3, vibratoDepth: 1.5 });
    voice(musicLayers.boss, { freq: 110, type: 'triangle', level: 0.8, gateHz: 2.2 });
    voice(musicLayers.boss, { freq: 130.81, type: 'triangle', level: 0.6, gateHz: 1.1 });
    applyMusicMode(2.5);
  }

  // 현재 모드의 레이어만 들리게 크로스페이드.
  function applyMusicMode(seconds = 1.2) {
    if (!ctx || !musicLayers) {
      return;
    }
    const now = ctx.currentTime;
    for (const [name, gain] of Object.entries(musicLayers)) {
      const target = name === musicMode ? MUSIC_LEVEL[name] : 0;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(target, now + seconds);
    }
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
    // 장면 전환 BGM: 'overworld' | 'dungeon' | 'boss'. 컨텍스트가 아직 없으면 모드만 기억해 둔다.
    setMusicMode(mode) {
      if (!MUSIC_LEVEL[mode] || mode === musicMode) {
        return;
      }
      musicMode = mode;
      applyMusicMode();
    },
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
    },
    playNoiseGroan() {
      // 노이즈의 '지지직' 신음 — 낮게 흔들리며 내려가는 고장난 소리(무섭기보다 아픈 느낌).
      blip(140, { type: 'sawtooth', duration: 0.5, gain: 0.16, slideTo: 68 });
      blip(150, { type: 'square', duration: 0.34, gain: 0.07, slideTo: 96 });
    },
    playNovaChime() {
      // 노바 재탄생 — 맑고 따뜻하게 피어오르는 종소리.
      arpeggio([523.25, 783.99, 1046.5, 1567.98], { step: 0.1, type: 'sine', gain: 0.24 });
    }
  };
}
