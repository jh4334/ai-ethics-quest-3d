import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildProductShellModel } from '../src/reboot/shell/shellModel.js';
import { createTeacherInvestigationReport } from '../src/reboot/report/teacherInvestigationReport.js';
import { recordEvidenceOutcome, recordGateAttempt, setChapterCheckpoint } from '../src/reboot/state/consequences.js';
import { createInitialRebootState } from '../src/reboot/state/model.js';

test('Given a fresh v5 campaign, When the product shell is built, Then only chapter one is selectable and continue is absent', () => {
  // Given
  const fresh = createInitialRebootState();

  // When
  const shell = buildProductShellModel(fresh);

  // Then
  assert.equal(shell.canContinue, false);
  assert.deepEqual(shell.chapters.map(({ chapter, selectable, sceneId }) => ({ chapter, selectable, sceneId })), [
    { chapter: 1, selectable: true, sceneId: 'school-night' },
    { chapter: 2, selectable: false, sceneId: 'campaign-chapter-2' },
    { chapter: 3, selectable: false, sceneId: 'campaign-chapter-3' },
    { chapter: 4, selectable: false, sceneId: 'campaign-chapter-4' },
    { chapter: 5, selectable: false, sceneId: 'campaign-chapter-5' },
    { chapter: 6, selectable: false, sceneId: 'final-broadcast' }
  ]);
});

test('Given a resumed v5 campaign, When the product shell is built, Then completed and current chapters remain selectable', () => {
  // Given
  const resumed = setChapterCheckpoint(createInitialRebootState(), 3, 'chapter-3:start');

  // When
  const shell = buildProductShellModel(resumed);

  // Then
  assert.equal(shell.canContinue, true);
  assert.deepEqual(shell.chapters.filter(({ selectable }) => selectable).map(({ chapter }) => chapter), [1, 2, 3]);
  assert.equal(shell.chapters.at(-1).sceneId, 'final-broadcast');
});

test('Given campaign decisions and gate attempts, When a teacher investigation report is created, Then it exposes only privacy-free learning records', () => {
  // Given
  let state = createInitialRebootState();
  state = recordEvidenceOutcome(state, { action: 'secure', chapter: 2, evidenceId: 'original-upload-trace' });
  state = recordGateAttempt(state, { chapter: 2, gateId: 'source-chain', outcome: 'failed' });
  state = recordGateAttempt(state, { chapter: 2, gateId: 'source-chain', outcome: 'resolved' });

  // When
  const report = createTeacherInvestigationReport(state);

  // Then
  assert.deepEqual(report.decisions, [{ action: 'secure', chapter: 2, evidenceId: 'original-upload-trace' }]);
  assert.deepEqual(report.evidence, [{ chapter: 2, evidenceId: 'original-upload-trace' }]);
  assert.deepEqual(report.gateAttempts, [{ attempts: 2, chapter: 2, gateId: 'source-chain', status: 'retry' }]);
  assert.equal(report.outcomes.integrity.secured, 1);
  assert.doesNotMatch(JSON.stringify(report), /name|email|phone|nickname/i);
});

test('Given the reboot entry, When shell wiring is inspected, Then title, in-process continuation, v5 cleanup, and printable report contracts exist', () => {
  // Given
  const html = readFileSync(new URL('../reboot.html', import.meta.url), 'utf8');
  const entry = readFileSync(new URL('../src/reboot/entry.js', import.meta.url), 'utf8');

  // When
  const shellMarkers = [
    'data-product-shell', 'data-shell-new', 'data-shell-continue', 'data-shell-chapter="6"',
    'data-teacher-report', 'data-teacher-report-print', '@media print', 'prefers-reduced-motion'
  ];

  // Then
  assert.equal(shellMarkers.every((marker) => html.includes(marker)), true);
  assert.match(entry, /app\.transition\(resolveCampaignSceneId\(session\.getState\(\)\)\)/);
  assert.match(entry, /V5_SAVE_KEY, V5_TEMP_KEY/);
  assert.match(entry, /\[2, 3, 4\]\.map/);
  assert.match(entry, /\['campaign-chapter-5', \(\) => createTestimonyArchiveScene/);
  assert.match(entry, /\['final-broadcast', \(\) => createFinalBroadcastPreviewScene/);
});
