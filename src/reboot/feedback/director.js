import { createReactiveAudioEngine } from '../audio/reactiveAudio.js';
import { mapFeedbackCues, selectPrimaryPrompts } from './cueMap.js';
import { createCombatFeedbackPool } from './visualPool.js';

function collectPositions(frame, encounter, inBoss) {
  const positions = new Map([['player', frame.player.position]]);
  for (const target of frame.targets) positions.set(target.id, target.position);
  for (const enemy of encounter.enemies) {
    positions.set(enemy.id, { x: enemy.position.x, y: 0, z: enemy.position.z });
  }
  if (inBoss) positions.set('attendance-proctor', { x: 0, y: 0, z: -104 });
  return positions;
}

export function createFeedbackDirector({
  audio = createReactiveAudioEngine(), capacity = 12, motion = 'full', scene,
  sound = true, windowRef = globalThis.window
}) {
  const pool = createCombatFeedbackPool({ capacity, scene });
  const reducedMotion = motion === 'reduced';
  let attached = false;
  let disposed = false;
  let lastCues = [];
  let promptEntries = [];
  let prompts = [];

  function visibilityChanged() {
    audio.setHidden(windowRef?.document?.hidden === true);
  }

  audio.setMuted(sound !== true);
  return Object.freeze({
    attach() {
      if (attached || disposed) return;
      windowRef?.document?.addEventListener?.('visibilitychange', visibilityChanged);
      attached = true;
      visibilityChanged();
    },
    detach() {
      if (!attached) return;
      windowRef?.document?.removeEventListener?.('visibilitychange', visibilityChanged);
      attached = false;
    },
    dispose() {
      if (disposed) return;
      this.detach();
      disposed = true;
      pool.dispose();
      audio.dispose();
      lastCues = [];
      promptEntries = [];
      prompts = [];
    },
    getDebugState() {
      return Object.freeze({
        attached, audio: audio.getDebugState(), cueCount: lastCues.length, disposed,
        pool: pool.getDebugState(), promptCount: prompts.length,
        promptKinds: Object.freeze(prompts.map((prompt) => prompt.kind)), reducedMotion
      });
    },
    getPrompts() {
      return prompts;
    },
    present({ bossEvents = [], combatEvents = [], encounter, enemyEvents = [], frame, inBoss, inPursuit }) {
      if (disposed) return Object.freeze({ cues: [], prompts: [], shake: 0 });
      lastCues = mapFeedbackCues({ bossEvents, combatEvents, enemyEvents });
      const nextPrompts = selectPrimaryPrompts(lastCues);
      for (const prompt of nextPrompts) {
        promptEntries = promptEntries.filter((entry) => entry.prompt.kind !== prompt.kind);
        promptEntries.push({ prompt, remaining: 0.9 });
      }
      prompts = selectPrimaryPrompts(promptEntries.map((entry) => entry.prompt));
      pool.present(lastCues, collectPositions(frame, encounter, inBoss), { reducedMotion });
      audio.setMusicState({ chainLevel: frame.hud.chainLevel, inBoss, inPursuit });
      audio.consume(lastCues);
      const shake = reducedMotion ? 0 : lastCues.reduce((amount, cue) => (
        Math.max(amount, cue.kind === 'damage' ? 0.24 : cue.kind === 'reflect' ? 0.14 : 0)
      ), 0);
      return Object.freeze({ cues: lastCues, prompts, shake });
    },
    reset() {
      pool.reset();
      lastCues = [];
      promptEntries = [];
      prompts = [];
    },
    resumeAudio() {
      audio.resume();
    },
    update(delta) {
      pool.update(delta, { reducedMotion });
      audio.update(delta);
      promptEntries = promptEntries
        .map((entry) => ({ ...entry, remaining: Math.max(0, entry.remaining - delta) }))
        .filter((entry) => entry.remaining > 0);
      prompts = selectPrimaryPrompts(promptEntries.map((entry) => entry.prompt));
    }
  });
}
