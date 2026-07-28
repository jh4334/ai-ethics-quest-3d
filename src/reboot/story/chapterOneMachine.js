import { chapterOneStory } from '../content/story/chapter1.js';
import {
  recordEvidenceOutcome,
  setChapterCheckpoint,
  updateCharacterTrust
} from '../state/consequences.js';
import { createInitialRebootState, deepFreeze, normalizeRebootState } from '../state/model.js';
import { validateStoryContent } from './validateStory.js';

validateStoryContent(chapterOneStory);

const beatById = new Map(chapterOneStory.beats.map((beat) => [beat.triggerId, beat]));
const phaseByCheckpoint = Object.freeze({
  'chapter-1:start': 'cold-open',
  'chapter-1:corridor': 'corridor',
  'chapter-1:first-arena': 'first-arena',
  'chapter-1:memory-decision': 'memory-decision',
  'chapter-1:memory-traced': 'memory-traced',
  'chapter-1:memory-pressure-cleared': 'memory-secure-ready',
  'chapter-1:pursuit': 'pursuit',
  'chapter-1:boss': 'boss',
  'chapter-1:boss-defeated': 'post-boss',
  'chapter-1:signature-revealed': 'chapter-ending'
});

const effectsByOutcome = Object.freeze({
  none: Object.freeze({
    arenaDressing: 'sealed-terminal',
    backupVisible: true,
    bossCallout: '오염 표적 판정이 대기 중이다.',
    extraWave: false
  }),
  purge: Object.freeze({
    arenaDressing: 'blanked-desks',
    backupVisible: false,
    bossCallout: '백업 신호가 사라졌다. 남은 명령만 집행한다.',
    extraWave: false
  }),
  secure: Object.freeze({
    arenaDressing: 'amber-backup',
    backupVisible: true,
    bossCallout: '원본 한 개가 아직 체육관에 남아 있다.',
    extraWave: true
  })
});

function memoryOutcome(campaign) {
  return campaign.evidence.find((record) => record.evidenceId === 'haru-memory-backup')?.action ?? null;
}

function phaseFor(campaign) {
  if (campaign.chapterProgress.current > 1) return 'complete';
  return phaseByCheckpoint[campaign.chapterProgress.checkpoint] ?? 'cold-open';
}

function makeState(campaign, transcript = [], lastTriggerId = null) {
  const outcome = memoryOutcome(campaign);
  return deepFreeze({
    campaign,
    phase: phaseFor(campaign),
    memoryOutcome: outcome,
    effects: effectsByOutcome[outcome ?? 'none'],
    transcript,
    lastTriggerId
  });
}

function appendBeat(state, triggerId, checkpoint, campaign = state.campaign) {
  const beat = beatById.get(triggerId);
  const checkpointed = checkpoint
    ? setChapterCheckpoint(campaign, checkpoint.chapter, checkpoint.id)
    : campaign;
  const lines = beat.radio.map((line) => ({ ...line, triggerId }));
  return makeState(checkpointed, [...state.transcript, ...lines], triggerId);
}

function requirePhase(state, expected, triggerId) {
  if (state.phase !== expected) {
    throw new RangeError(`${triggerId}은 현재 단계(${state.phase})에서 실행할 수 없습니다.`);
  }
}

function applyTrigger(state, triggerId) {
  switch (triggerId) {
    case 'cold-open':
      requirePhase(state, 'cold-open', triggerId);
      return appendBeat(state, triggerId, { chapter: 1, id: 'chapter-1:corridor' });
    case 'corridor-cleared':
      requirePhase(state, 'corridor', triggerId);
      return appendBeat(state, triggerId, { chapter: 1, id: 'chapter-1:first-arena' });
    case 'first-arena-cleared':
      requirePhase(state, 'first-arena', triggerId);
      return appendBeat(state, triggerId, { chapter: 1, id: 'chapter-1:memory-decision' });
    case 'backup-pressure-cleared':
      requirePhase(state, 'memory-traced', triggerId);
      return appendBeat(state, triggerId, { chapter: 1, id: 'chapter-1:memory-pressure-cleared' });
    case 'scanner-pursuit-cleared':
      requirePhase(state, 'pursuit', triggerId);
      return appendBeat(state, triggerId, { chapter: 1, id: 'chapter-1:boss' });
    case 'boss-defeated':
      requirePhase(state, 'boss', triggerId);
      return appendBeat(state, triggerId, { chapter: 1, id: 'chapter-1:boss-defeated' });
    case 'approval-record-opened': {
      requirePhase(state, 'post-boss', triggerId);
      const recorded = recordEvidenceOutcome(state.campaign, {
        action: 'secure', chapter: 1, evidenceId: 'player-approval-record'
      });
      return appendBeat(state, triggerId, { chapter: 1, id: 'chapter-1:signature-revealed' }, recorded);
    }
    case 'chapter-complete':
      requirePhase(state, 'chapter-ending', triggerId);
      return appendBeat(state, triggerId, { chapter: 2, id: 'chapter-2:start' });
    default:
      throw new RangeError(`등록되지 않은 스토리 트리거입니다: ${triggerId}`);
  }
}

function applyMemoryAction(state, action) {
  if (!['trace', 'secure', 'purge'].includes(action)) {
    throw new RangeError(`등록되지 않은 기억 백업 행동입니다: ${action}`);
  }
  if (action === 'trace') {
    requirePhase(state, 'memory-decision', 'memory-traced');
    return appendBeat(state, 'memory-traced', { chapter: 1, id: 'chapter-1:memory-traced' });
  }
  if (action === 'secure') {
    if (state.phase === 'memory-traced') throw new RangeError('압력 신호를 정리한 뒤 SECURE할 수 있습니다.');
    requirePhase(state, 'memory-secure-ready', 'memory-secured');
  } else {
    requirePhase(state, 'memory-decision', 'memory-purged');
  }

  const evidenceAction = action === 'secure' ? 'secure' : 'purge';
  let campaign = recordEvidenceOutcome(state.campaign, {
    action: evidenceAction, chapter: 1, evidenceId: 'haru-memory-backup'
  });
  campaign = updateCharacterTrust(campaign, 'haru', action === 'secure' ? 12 : -8);
  campaign = updateCharacterTrust(campaign, 'dot', action === 'secure' ? -8 : 6);
  return appendBeat(state, `memory-${evidenceAction}d`, { chapter: 1, id: 'chapter-1:pursuit' }, campaign);
}

export function createChapterOneStory(campaign = createInitialRebootState()) {
  return makeState(normalizeRebootState(campaign));
}

export function transitionChapterOne(state, event) {
  if (!state || typeof state !== 'object' || !event || typeof event !== 'object') {
    throw new TypeError('스토리 상태와 이벤트가 필요합니다.');
  }
  if (event.type === 'trigger') return applyTrigger(state, event.triggerId);
  if (event.type === 'memory-action') return applyMemoryAction(state, event.action);
  throw new RangeError(`등록되지 않은 스토리 이벤트입니다: ${event.type}`);
}
