import { recordEvidenceOutcome, setChapterCheckpoint, updateCharacterTrust } from '../state/consequences.js';
import { createInitialRebootState, deepFreeze } from '../state/model.js';

const HISTORIES = deepFreeze({
  redacted: {
    decision: 'broadcast',
    records: [
      ['haru-memory-backup', 'secure', 1],
      ['player-approval-record', 'secure', 1],
      ['original-upload-trace', 'secure', 2],
      ['dot-deletion-log', 'secure', 3],
      ['support-record', 'secure', 4]
    ],
    trust: { dot: 8, haru: 18, lumen: 2, yoonseo: 4 }
  },
  raw: {
    decision: 'broadcast',
    records: [
      ['haru-memory-backup', 'secure', 1],
      ['player-approval-record', 'expose', 1],
      ['original-upload-trace', 'expose', 2],
      ['dot-deletion-log', 'secure', 3],
      ['support-record', 'purge', 4]
    ],
    trust: { dot: -4, haru: 5, lumen: -6, yoonseo: -2 }
  },
  sealed: {
    decision: 'contain',
    records: [
      ['haru-memory-backup', 'purge', 1],
      ['player-approval-record', 'secure', 1],
      ['original-upload-trace', 'purge', 2],
      ['dot-deletion-log', 'purge', 3],
      ['support-record', 'secure', 4]
    ],
    trust: { dot: 2, haru: -8, lumen: 5, yoonseo: 3 }
  }
});

export function createFinaleFixture(id) {
  const fixture = HISTORIES[id];
  if (!fixture) throw new RangeError(`등록되지 않은 결말 fixture: ${id}`);
  let campaign = createInitialRebootState({ motion: 'reduced', quality: 'low', sound: false });
  for (const [evidenceId, action, chapter] of fixture.records) {
    campaign = recordEvidenceOutcome(campaign, { action, chapter, evidenceId });
  }
  for (const [characterId, delta] of Object.entries(fixture.trust)) {
    campaign = updateCharacterTrust(campaign, characterId, delta);
  }
  campaign = setChapterCheckpoint(campaign, 6, 'chapter-6:broadcast-room');
  return deepFreeze({ campaign, decision: fixture.decision, id });
}
