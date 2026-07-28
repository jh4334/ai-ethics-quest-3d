import { freezeEvents, patchEnemyState } from './state.js';

function contactId(contact) {
  return typeof contact.id === 'string' ? contact.id : null;
}
export function resolveEnemyContacts(initial, contacts) {
  let state = initial;
  const events = [];
  for (const contact of Array.isArray(contacts) ? contacts : []) {
    const id = contactId(contact);
    if (id !== null && state.processedContacts.includes(id)) continue;
    if (id !== null) {
      state = patchEnemyState(state, {
        processedContacts: [...state.processedContacts.slice(-127), id]
      });
    }
    if (contact.type === 'interrupt') {
      const committed = state.phase === 'windup' || state.phase === 'active';
      state = patchEnemyState(state, {
        faceTicks: 0,
        phase: 'interrupt',
        phaseDuration: Math.max(1, contact.ticks ?? 1),
        phaseTick: 0
      });
      events.push({ enemyId: state.id, type: committed ? 'attack-interrupted' : 'enemy-interrupted' });
      continue;
    }
    if (contact.type === 'stagger') {
      state = patchEnemyState(state, {
        faceTicks: 0,
        phase: 'stagger',
        phaseDuration: Math.max(1, contact.ticks ?? 1),
        phaseTick: 0
      });
      events.push({ enemyId: state.id, type: 'enemy-staggered' });
      continue;
    }
    const armorBreak = state.armor > 0 && state.definition.armor.breaksOnKinds.includes(contact.kind);
    if (armorBreak) {
      state = patchEnemyState(state, { armor: Math.max(0, state.armor - 1) });
      events.push({ contactId: id, enemyId: state.id, type: 'armor-broken' });
      if (state.armor === 0 && !state.rewardGranted) {
        state = patchEnemyState(state, { rewardGranted: true });
        events.push({ enemyId: state.id, rewardId: state.definition.reward.id, type: 'reward-granted' });
      }
    }
    const damage = armorBreak ? 0 : Math.max(0, Number.isFinite(contact.damage) ? contact.damage : 0);
    if (damage > 0) {
      const hp = Math.max(0, state.hp - damage);
      state = patchEnemyState(state, { hp, phase: hp === 0 ? 'defeat' : state.phase });
      events.push({ contactId: id, damage, enemyId: state.id, type: 'enemy-damaged' });
      if (hp === 0) events.push({ enemyId: state.id, type: 'enemy-defeated' });
    }
  }
  return Object.freeze({ events: freezeEvents(events), state });
}
