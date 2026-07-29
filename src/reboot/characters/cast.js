import * as THREE from 'three';

import { createCharacterFactory } from './factory.js';

const SCHOOL_CAST = Object.freeze([
  Object.freeze({ id: 'player', position: [0, 0, 2], rotation: 0 }),
  Object.freeze({ id: 'dot', position: [-2.25, 0, -0.4], rotation: 0 }),
  Object.freeze({ id: 'haru', position: [2.2, 0, -1.9], rotation: 0 }),
  Object.freeze({ id: 'yoonseo', position: [-2.05, 0, -4.1], rotation: 0 })
]);

export function createCharacterCast({ characterFactory = null, scene }) {
  // 팩토리를 주입받으면 GLTF 파싱·GPU 업로드를 적·보스 캐스트와 공유한다(소유자만 폐기).
  const factory = characterFactory ?? createCharacterFactory();
  const ownsFactory = characterFactory === null;
  const root = new THREE.Group();
  root.name = 'reboot-character-cast';
  scene.add(root);

  const anchors = new Map();
  const characters = new Map();
  const errors = [];
  let disposed = false;
  let loading = null;
  let playerPresentation = null;

  for (const entry of SCHOOL_CAST) {
    const anchor = new THREE.Group();
    anchor.name = `anchor-${entry.id}`;
    anchor.position.set(...entry.position);
    anchor.rotation.y = entry.rotation;
    root.add(anchor);
    anchors.set(entry.id, anchor);
  }

  function load() {
    if (loading) return loading;
    loading = Promise.all(SCHOOL_CAST.map(async ({ id }) => {
      try {
        const character = await factory.create(id);
        if (disposed) {
          character.dispose();
          return;
        }
        anchors.get(id).add(character.root);
        characters.set(id, character);
      } catch (error) {
        if (!disposed) errors.push(`${id}: ${error.message}`);
      }
    }));
    return loading;
  }

  return Object.freeze({
    dispose() {
      if (disposed) return;
      disposed = true;
      if (ownsFactory) factory.dispose();
      root.removeFromParent();
      anchors.clear();
      characters.clear();
    },
    getDebugState() {
      return Object.freeze({
        errors: Object.freeze([...errors]),
        identities: Object.freeze(SCHOOL_CAST.flatMap(({ id }) => {
          const character = characters.get(id);
          return character ? [Object.freeze({
            id,
            ...character.profile.identity,
            presentation: character.profile.presentation,
            visualScale: character.profile.scale
          })] : [];
        })),
        loaded: characters.size,
        total: SCHOOL_CAST.length
      });
    },
    getPlayerPosition() {
      return anchors.get('player').position;
    },
    load,
    setPlayerState(state) {
      const player = anchors.get('player');
      player.position.set(state.position.x, 0, state.position.y);
      player.rotation.y = Math.atan2(state.facing.x, state.facing.y);
      playerPresentation = {
        acting: !['idle', 'stagger', 'defeat'].includes(state.action),
        defeated: state.status === 'defeated',
        hit: state.action === 'stagger',
        moving: state.moving === true
      };
    },
    update(delta, { horizontal = 0, vertical = 0 } = {}) {
      const player = anchors.get('player');
      const moving = playerPresentation?.moving ?? (horizontal !== 0 || vertical !== 0);
      if (!playerPresentation) {
        player.position.x = THREE.MathUtils.clamp(player.position.x + horizontal * delta * 4, -4.3, 4.3);
        player.position.z = THREE.MathUtils.clamp(player.position.z + vertical * delta * 4, -15, 4);
        if (moving) player.rotation.y = Math.atan2(horizontal, vertical);
      }

      for (const [id, character] of characters) {
        character.update(delta, id === 'player' ? (playerPresentation ?? { moving }) : {});
      }
    }
  });
}
