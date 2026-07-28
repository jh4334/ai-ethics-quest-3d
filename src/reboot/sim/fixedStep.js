import { FIXED_HZ } from '../content/actions.js';
import { stepCombat } from './combatSimulation.js';

const STEP_EPSILON = 0.000000001;
const MAX_FRAME_SECONDS = 0.25;
const MAX_PENDING_EDGES = 16;

function appendPendingEdges(pending, commands) {
  const next = [...pending];
  for (const command of commands) {
    if (command?.type === 'move') continue;
    const signature = `${command?.type ?? 'malformed'}:${command?.targetId ?? ''}:${command?.contactId ?? ''}`;
    const duplicate = next.some((entry) => entry.signature === signature);
    if (!duplicate && next.length < MAX_PENDING_EDGES) next.push({ signature, command });
  }
  return next;
}

export function advanceElapsed(runtime, elapsedSeconds, commands = []) {
  const boundedElapsed = Number.isFinite(elapsedSeconds)
    ? Math.max(0, Math.min(MAX_FRAME_SECONDS, elapsedSeconds))
    : 0;
  let accumulator = runtime.accumulator + boundedElapsed * FIXED_HZ;
  let state = runtime.state;
  const events = [];
  const safeCommands = Array.isArray(commands) ? commands : [];
  const heldCommands = safeCommands.filter((command) => command?.type === 'move');
  let pendingEdges = appendPendingEdges(runtime.pendingEdges ?? [], safeCommands);
  while (accumulator + STEP_EPSILON >= 1) {
    const edgeCommands = pendingEdges.map((entry) => entry.command);
    pendingEdges = [];
    const result = stepCombat(state, [...heldCommands, ...edgeCommands]);
    state = result.state;
    events.push(...result.events);
    accumulator -= 1;
  }
  if (Math.abs(accumulator) < STEP_EPSILON) accumulator = 0;
  return { state, accumulator, pendingEdges, events };
}
