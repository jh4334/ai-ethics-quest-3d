const ACTION_LABELS = Object.freeze({
  attack1: '신호 칼날 1',
  attack2: '신호 칼날 2',
  attack3: '신호 칼날 3',
  dash: '회피',
  reflect: 'REFLECT',
  trace: 'TRACE',
  secure: 'SECURE',
  stagger: '피격',
  defeat: '쓰러짐'
});

function worldPoint(point) {
  return { x: point.x, y: 0, z: point.y };
}

function finiteNumber(value) {
  return Number.isFinite(value);
}

function eventPresentation(event) {
  if (!event || typeof event.type !== 'string' || !finiteNumber(event.tick)) return null;
  switch (event.type) {
    case 'action-started': {
      if (typeof event.action !== 'string' || !finiteNumber(event.instanceId)) return null;
      const label = ACTION_LABELS[event.action] ?? event.action;
      return {
        key: `${event.type}:${event.instanceId}`,
        cue: label,
        effect: {
          kind: 'action', actorId: 'player', action: event.action,
          instanceId: event.instanceId, tick: event.tick
        }
      };
    }
    case 'target-hit':
      if (typeof event.targetId !== 'string' || typeof event.hitId !== 'string' || !finiteNumber(event.damage)) return null;
      return {
        key: `${event.type}:${event.hitId}`,
        cue: `대상 피해 ${event.damage}`,
        effect: {
          kind: 'target-hit', targetId: event.targetId, hitId: event.hitId,
          amount: event.damage, tick: event.tick
        }
      };
    case 'player-hit':
      if (typeof event.contactId !== 'string' || !finiteNumber(event.damage)) return null;
      return {
        key: `${event.type}:${event.contactId}`,
        cue: `피해 ${event.damage}`,
        effect: {
          kind: 'player-hit', actorId: 'player', contactId: event.contactId,
          amount: event.damage, tick: event.tick
        }
      };
    case 'reflected':
    case 'perfect-reflect': {
      if (typeof event.contactId !== 'string' || typeof event.hitId !== 'string') return null;
      const perfect = event.type === 'perfect-reflect';
      return {
        key: `${event.type}:${event.hitId}`,
        cue: perfect ? '완벽 반사' : '반사 성공',
        effect: {
          kind: event.type, actorId: 'player', contactId: event.contactId,
          hitId: event.hitId, tick: event.tick
        }
      };
    }
    case 'traced':
    case 'secured': {
      if (typeof event.targetId !== 'string') return null;
      const traced = event.type === 'traced';
      return {
        key: `${event.type}:${event.targetId}:${event.tick}`,
        cue: traced ? 'TRACE 완료' : 'SECURE 완료',
        effect: {
          kind: traced ? 'trace' : 'secure', targetId: event.targetId, tick: event.tick
        }
      };
    }
    case 'chain-raised':
      if (!finiteNumber(event.level)) return null;
      return {
        key: `${event.type}:${event.level}:${event.tick}`,
        cue: `SYNC CHAIN ${event.level}`,
        effect: { kind: 'chain', level: event.level, reason: event.reason ?? '', tick: event.tick }
      };
    default:
      return null;
  }
}

export function buildCombatFrame(state, events = []) {
  const presentations = (Array.isArray(events) ? events : [])
    .map(eventPresentation)
    .filter((entry) => entry !== null);
  const player = state.player;
  return {
    tick: state.tick,
    paused: state.paused,
    player: {
      position: worldPoint(player.position),
      facing: worldPoint(player.facing),
      hp: player.hp,
      status: player.status,
      action: {
        name: player.action.name,
        instanceId: player.action.instanceId,
        elapsed: player.action.elapsed,
        targetId: player.action.targetId
      },
      animation: player.status === 'defeated' || player.action.name === 'defeat'
        ? 'defeat'
        : player.action.name === 'stagger'
          ? 'hit'
          : player.action.name !== 'idle' ? 'action' : 'idle'
    },
    targets: state.targets.map((target) => ({
      id: target.id,
      position: worldPoint(target.position),
      hp: target.hp,
      defeated: target.defeated,
      traced: target.traced,
      secured: target.secured,
      animation: target.defeated ? 'defeat' : target.staggerTicks > 0 ? 'hit' : 'idle'
    })),
    effects: presentations.map((entry) => ({ id: entry.key, ...entry.effect })),
    hud: {
      hp: player.hp,
      status: player.status,
      action: player.action.name,
      chainPoints: state.chain.points,
      chainLevel: state.chain.level,
      paused: state.paused,
      cues: presentations.map((entry) => entry.cue)
    }
  };
}

export function createCombatPresentationAdapter({ maxRememberedEvents = 256 } = {}) {
  const memoryLimit = Number.isInteger(maxRememberedEvents) && maxRememberedEvents > 0
    ? maxRememberedEvents
    : 256;
  const remembered = new Set();
  const order = [];
  let lastTick = null;

  function reset() {
    remembered.clear();
    order.length = 0;
    lastTick = null;
  }

  return Object.freeze({
    present(state, events = []) {
      if (lastTick !== null && state.tick < lastTick) reset();
      lastTick = state.tick;
      if (state.paused) return buildCombatFrame(state, []);

      const fresh = [];
      for (const event of Array.isArray(events) ? events : []) {
        const presentation = eventPresentation(event);
        if (presentation === null || remembered.has(presentation.key)) continue;
        remembered.add(presentation.key);
        order.push(presentation.key);
        fresh.push(event);
        if (order.length > memoryLimit) remembered.delete(order.shift());
      }
      return buildCombatFrame(state, fresh);
    },
    reset,
    retainedEventCount() {
      return remembered.size;
    }
  });
}
