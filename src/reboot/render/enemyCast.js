import * as THREE from 'three';

import { createCharacterFactory } from '../characters/factory.js';

const ANIMATION_STATES = Object.freeze({
  acting: Object.freeze({ acting: true, defeated: false, hit: false, moving: false }),
  defeated: Object.freeze({ acting: false, defeated: true, hit: false, moving: false }),
  hit: Object.freeze({ acting: false, defeated: false, hit: true, moving: false }),
  idle: Object.freeze({ acting: false, defeated: false, hit: false, moving: false }),
  moving: Object.freeze({ acting: false, defeated: false, hit: false, moving: true })
});

export function enemyAnimationState(phase) {
  switch (phase) {
    case 'acquire':
    case 'reposition':
      return ANIMATION_STATES.moving;
    case 'windup':
    case 'active':
    case 'recover':
      return ANIMATION_STATES.acting;
    case 'interrupt':
    case 'stagger':
      return ANIMATION_STATES.hit;
    case 'defeat':
      return ANIMATION_STATES.defeated;
    case 'idle':
      return ANIMATION_STATES.idle;
    default:
      throw new Error(`표현할 수 없는 적 페이즈: ${phase}`);
  }
}

function copyPosition(position) {
  return Object.freeze([position.x, 0, position.z]);
}

export function createEnemyCast({
  characterFactory = createCharacterFactory(),
  maxEnemies = 8,
  scene
}) {
  if (!scene?.isScene) throw new TypeError('적 캐스트에는 Three.js Scene이 필요합니다.');
  if (!Number.isInteger(maxEnemies) || maxEnemies < 1) throw new RangeError('maxEnemies는 1 이상의 정수여야 합니다.');

  const root = new THREE.Group();
  root.name = 'reboot-enemy-cast';
  scene.add(root);

  const entries = new Map();
  const errors = [];
  let disposed = false;
  let loading = null;

  function applyEnemyState(entry, enemy) {
    entry.anchor.position.set(enemy.position.x, 0, enemy.position.z);
    entry.anchor.rotation.y = Math.PI / 2 - enemy.facing;
    entry.facing = enemy.facing;
    entry.phase = enemy.phase;
    entry.animation = enemyAnimationState(enemy.phase);
    entry.anchor.userData.enemyId = enemy.id;
    entry.anchor.userData.phase = enemy.phase;
  }

  function present(encounter, feedback = []) {
    for (const entry of entries.values()) entry.cueId = null;
    for (const cue of Array.isArray(feedback) ? feedback : []) {
      const entry = entries.get(cue.enemyId);
      if (entry) {
        entry.cueId = typeof cue.cueId === 'string'
          ? cue.cueId
          : typeof cue.type === 'string' ? cue.type : null;
      }
    }
    for (const enemy of encounter.enemies) {
      const entry = entries.get(enemy.id);
      if (entry) applyEnemyState(entry, enemy);
    }
  }

  function load(encounter) {
    if (disposed) return Promise.reject(new Error('폐기된 적 캐스트는 로드할 수 없습니다.'));
    if (loading) return loading;
    if (!Array.isArray(encounter?.enemies)) return Promise.reject(new TypeError('적 상태 배열이 필요합니다.'));
    if (encounter.enemies.length > maxEnemies) {
      return Promise.reject(new RangeError(`적 캐스트 상한 ${maxEnemies}명을 초과했습니다.`));
    }

    const ids = new Set(encounter.enemies.map((enemy) => enemy.id));
    if (ids.size !== encounter.enemies.length) return Promise.reject(new Error('중복된 적 인스턴스 ID가 있습니다.'));

    for (const enemy of encounter.enemies) {
      const anchor = new THREE.Group();
      anchor.name = `enemy-anchor-${enemy.id}`;
      root.add(anchor);
      const entry = {
        anchor,
        animation: enemyAnimationState(enemy.phase),
        character: null,
        cueId: null,
        facing: enemy.facing,
        id: enemy.id,
        phase: enemy.phase,
        profileId: enemy.definition.id
      };
      entries.set(enemy.id, entry);
      applyEnemyState(entry, enemy);
    }

    loading = Promise.all([...entries.values()].map(async (entry) => {
      try {
        const character = await characterFactory.create(entry.profileId);
        if (disposed) {
          character.dispose();
          return;
        }
        entry.anchor.add(character.root);
        entry.character = character;
        character.update(0, entry.animation);
      } catch (error) {
        if (!disposed) errors.push(`${entry.id}: ${error.message}`);
      }
    }));
    return loading;
  }

  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      characterFactory.dispose();
      root.removeFromParent();
    },
    getDebugState() {
      return Object.freeze({
        disposed,
        enemies: Object.freeze([...entries.values()].map((entry) => Object.freeze({
          cueId: entry.cueId,
          facing: entry.facing,
          id: entry.id,
          phase: entry.phase,
          position: copyPosition(entry.anchor.position),
          profileId: entry.profileId
        }))),
        errors: Object.freeze([...errors]),
        ids: Object.freeze([...entries.keys()]),
        loaded: [...entries.values()].filter((entry) => entry.character !== null).length,
        total: entries.size
      });
    },
    load,
    present,
    reset(encounter) {
      present(encounter, []);
    },
    update(delta) {
      if (disposed) return;
      for (const entry of entries.values()) entry.character?.update(delta, entry.animation);
    }
  });
}
