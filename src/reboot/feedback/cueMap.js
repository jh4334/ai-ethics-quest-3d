export const FEEDBACK_KINDS = Object.freeze([
  'telegraph', 'contact', 'miss', 'reflect', 'weak-point',
  'secure', 'chain-up', 'damage', 'defeat'
]);

const CUE_STYLE = Object.freeze({
  telegraph: { label: '공격 예고', priority: 40, shape: 'ring', tone: 'warning' },
  contact: { label: '접촉', priority: 55, shape: 'cross', tone: 'impact' },
  miss: { label: '빗나감', priority: 45, shape: 'broken-ring', tone: 'miss' },
  reflect: { label: '완벽 반사', priority: 75, shape: 'diamond', tone: 'reflect' },
  'weak-point': { label: '약점 확인', priority: 70, shape: 'reticle', tone: 'trace' },
  secure: { label: '기록 확보', priority: 80, shape: 'lock', tone: 'secure' },
  'chain-up': { label: 'SYNC 상승', priority: 65, shape: 'chevron', tone: 'chain' },
  damage: { label: '피격', priority: 90, shape: 'slash', tone: 'damage' },
  defeat: { label: '기록 종료', priority: 100, shape: 'shatter', tone: 'defeat' }
});

function cue(kind, event, source, index) {
  const style = CUE_STYLE[kind];
  const targetId = event.targetId ?? event.enemyId ?? (kind === 'damage' ? 'player' : null);
  return Object.freeze({
    id: `${source}:${event.type}:${event.tick ?? index}:${event.contactId ?? event.actionId ?? targetId ?? index}`,
    kind,
    label: kind === 'chain-up' ? `${style.label} ${event.level ?? ''}`.trim() : style.label,
    priority: style.priority,
    shape: style.shape,
    targetId,
    tone: style.tone
  });
}

function combatKind(event) {
  if (event.type === 'action-started') return 'telegraph';
  if (event.type === 'target-hit') return 'contact';
  if (event.type === 'action-missed' || event.type === 'evaded') return 'miss';
  if (event.type === 'reflected' || event.type === 'perfect-reflect') return 'reflect';
  if (event.type === 'traced') return 'weak-point';
  if (event.type === 'secured') return 'secure';
  if (event.type === 'chain-raised') return 'chain-up';
  if (event.type === 'player-hit') return 'damage';
  if (event.type === 'target-defeated' || event.type === 'player-defeated') return 'defeat';
  return null;
}

function enemyKind(event) {
  if (event.type === 'attack-committed') return 'telegraph';
  if (event.type === 'attack-contact' || event.type === 'enemy-damaged') return 'contact';
  if (event.type === 'attack-cancelled') return 'miss';
  if (event.type === 'armor-broken' || event.type === 'enemy-staggered') return 'weak-point';
  if (event.type === 'enemy-defeated') return 'defeat';
  return null;
}

function bossKind(event) {
  if (event.type === 'boss-telegraph' || event.type === 'boss-phase-changed') return 'telegraph';
  if (event.type === 'boss-attack-window') return 'contact';
  if (event.type === 'clone-decoy') return 'miss';
  if (event.type === 'mastery-success' || event.type === 'boss-staggered') return 'weak-point';
  if (event.type === 'boss-defeated') return 'defeat';
  return null;
}

function collect(events, source, classifier) {
  return (Array.isArray(events) ? events : []).flatMap((event, index) => {
    const kind = classifier(event);
    return kind ? [cue(kind, event, source, index)] : [];
  });
}

export function mapFeedbackCues({ bossEvents = [], combatEvents = [], enemyEvents = [] } = {}) {
  return Object.freeze([
    ...collect(combatEvents, 'combat', combatKind),
    ...collect(enemyEvents, 'enemy', enemyKind),
    ...collect(bossEvents, 'boss', bossKind)
  ]);
}

export function selectPrimaryPrompts(cues, limit = 3) {
  const safeLimit = Number.isInteger(limit) ? Math.max(0, Math.min(3, limit)) : 3;
  return Object.freeze([...(Array.isArray(cues) ? cues : [])]
    .sort((first, second) => second.priority - first.priority || first.id.localeCompare(second.id))
    .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.kind === entry.kind) === index)
    .slice(0, safeLimit));
}
