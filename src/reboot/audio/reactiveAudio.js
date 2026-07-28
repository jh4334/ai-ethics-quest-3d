const TONES = Object.freeze({
  warning: [220, 0.16], impact: [110, 0.08], miss: [180, 0.12], reflect: [660, 0.18],
  trace: [520, 0.2], secure: [780, 0.24], chain: [880, 0.18], damage: [90, 0.2], defeat: [65, 0.35]
});

function getAudioContext(windowRef, contextFactory) {
  if (typeof contextFactory === 'function') return contextFactory();
  const Constructor = windowRef?.AudioContext ?? windowRef?.webkitAudioContext;
  return Constructor ? new Constructor() : null;
}

export function createReactiveAudioEngine({ contextFactory, maxVoices = 4, windowRef = globalThis.window } = {}) {
  const voiceLimit = Number.isInteger(maxVoices) ? Math.max(1, Math.min(8, maxVoices)) : 4;
  let context = null;
  let master = null;
  let music = null;
  let started = false;
  let muted = false;
  let hidden = false;
  let disposed = false;
  let musicLayer = 'ambient';
  let voices = [];

  function createMusic() {
    if (!context || music) return;
    music = [82.41, 110, 164.81].map((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = 0;
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();
      return { gain, oscillator };
    });
  }

  function applyMusic() {
    if (!context || !music) return;
    const audible = !muted && !hidden;
    const levels = {
      ambient: [0.035, 0, 0], pursuit: [0.025, 0.03, 0], combat: [0.02, 0.045, 0],
      'combat-chain': [0.015, 0.04, 0.03], boss: [0.012, 0.055, 0.015],
      'boss-chain': [0.01, 0.05, 0.04]
    }[musicLayer];
    music.forEach((layer, index) => {
      layer.gain.gain.setTargetAtTime(audible ? levels[index] : 0, context.currentTime, 0.08);
    });
  }

  function stopVoices() {
    voices = [];
  }

  function play(cue) {
    if (voices.length >= voiceLimit) return;
    const [frequency, duration] = TONES[cue.tone] ?? TONES.impact;
    const voice = { remaining: duration, tone: cue.tone };
    if (context) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = cue.kind === 'damage' || cue.kind === 'defeat' ? 'sawtooth' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
      voice.oscillator = oscillator;
    }
    voices.push(voice);
  }

  return Object.freeze({
    consume(cues) {
      if (!started || muted || hidden || disposed) return;
      for (const cue of [...(Array.isArray(cues) ? cues : [])]
        .sort((first, second) => second.priority - first.priority)) play(cue);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopVoices();
      for (const layer of music ?? []) layer.oscillator.stop();
      music = null;
      context?.close?.();
    },
    getDebugState() {
      return Object.freeze({ activeVoices: voices.length, disposed, hidden, musicLayer, muted, started, voiceLimit });
    },
    resume() {
      if (disposed || started) return;
      started = true;
      context = getAudioContext(windowRef, contextFactory);
      if (context) {
        master = context.createGain();
        master.gain.value = 0.8;
        master.connect(context.destination);
        context.resume?.();
        createMusic();
        applyMusic();
      }
    },
    setHidden(value) {
      hidden = value === true;
      if (hidden) stopVoices();
      applyMusic();
    },
    setMusicState({ chainLevel = 0, inBoss = false, inPursuit = false } = {}) {
      musicLayer = inBoss
        ? (chainLevel >= 2 ? 'boss-chain' : 'boss')
        : chainLevel >= 2 ? 'combat-chain' : inPursuit ? 'pursuit' : 'ambient';
      applyMusic();
    },
    setMuted(value) {
      muted = value === true;
      if (muted) stopVoices();
      applyMusic();
    },
    update(delta) {
      const elapsed = Math.max(0, Math.min(0.1, delta));
      voices = voices.flatMap((voice) => {
        const remaining = voice.remaining - elapsed;
        return remaining > 0 ? [{ ...voice, remaining }] : [];
      });
    }
  });
}
