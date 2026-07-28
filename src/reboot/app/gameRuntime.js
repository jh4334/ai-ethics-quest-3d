import { createCombatState } from '../sim/combatSimulation.js';
import { advanceElapsed } from '../sim/fixedStep.js';

const EDGE_ACTIONS = new Set(['attack', 'dash', 'reflect', 'trace', 'secure']);
function targetsNear(startPosition) {
  return [
    { id: 'eraser-training', position: { x: startPosition.x + 1.35, y: startPosition.y - 0.55 }, hp: 100 },
    { id: 'memory-backup', position: { x: startPosition.x, y: startPosition.y - 3.2 }, hp: 100 }
  ];
}

export function createGameRuntime({ startPosition = { x: 0, y: 0 }, targets } = {}) {
  const initialTargets = targets ?? targetsNear(startPosition);
  const createInitialState = () => {
    const state = createCombatState({ targets: initialTargets });
    state.player.position = {
      x: Number.isFinite(startPosition.x) ? startPosition.x : 0,
      y: Number.isFinite(startPosition.y) ? startPosition.y : 0
    };
    return state;
  };
  let queuedActions = [];
  let runtime = {
    accumulator: 0,
    pendingEdges: [],
    state: createInitialState()
  };

  function reset() {
    queuedActions = [];
    runtime = {
      accumulator: 0,
      pendingEdges: [],
      state: createInitialState()
    };
    return runtime.state;
  }

  return Object.freeze({
    getState: () => runtime.state,
    queueAction(type, targetId = null) {
      if (!EDGE_ACTIONS.has(type) || queuedActions.length >= 16) return false;
      queuedActions.push(targetId ? { type, targetId } : { type });
      return true;
    },
    reset,
    update(elapsedSeconds, movement = {}) {
      const horizontal = Number.isFinite(movement.horizontal) ? movement.horizontal : 0;
      const vertical = Number.isFinite(movement.vertical) ? movement.vertical : 0;
      const commands = [...queuedActions];
      queuedActions = [];
      if (horizontal !== 0 || vertical !== 0) {
        commands.unshift({ type: 'move', x: horizontal, y: vertical });
      }
      const result = advanceElapsed(runtime, elapsedSeconds, commands);
      runtime = {
        accumulator: result.accumulator,
        pendingEdges: result.pendingEdges,
        state: result.state
      };
      return { events: result.events, state: result.state };
    }
  });
}
