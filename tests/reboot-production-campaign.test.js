import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { resolveCampaignSceneId } from '../src/reboot/app/campaignSceneRouting.js';
import { completeCampaignChapter } from '../src/reboot/campaign/chapterProgression.js';
import { createInitialRebootState } from '../src/reboot/state/model.js';
import { setChapterCheckpoint } from '../src/reboot/state/consequences.js';

test('production scene routing follows the persisted chapter instead of reopening chapter one', () => {
  let state = createInitialRebootState();
  const sceneIds = [resolveCampaignSceneId(state)];
  for (let chapter = 2; chapter <= 6; chapter += 1) {
    state = setChapterCheckpoint(state, chapter, `chapter-${chapter}:start`);
    sceneIds.push(resolveCampaignSceneId(state));
  }
  assert.deepEqual(sceneIds, [
    'school-night', 'campaign-chapter-2', 'campaign-chapter-3',
    'campaign-chapter-4', 'campaign-chapter-5', 'final-broadcast'
  ]);
});

test('chapters 2–5 persist distinct evidence and advance to the final broadcast', () => {
  let state = setChapterCheckpoint(createInitialRebootState(), 2, 'chapter-2:start');
  const second = completeCampaignChapter(state, 2, 'secure');
  const third = completeCampaignChapter(second.state, 3, 'purge');
  const fourth = completeCampaignChapter(third.state, 4, 'secure');
  const fifth = completeCampaignChapter(fourth.state, 5, 'secure');

  assert.equal(resolveCampaignSceneId(second.state), 'campaign-chapter-3');
  assert.equal(resolveCampaignSceneId(third.state), 'campaign-chapter-4');
  assert.equal(resolveCampaignSceneId(fourth.state), 'campaign-chapter-5');
  assert.equal(resolveCampaignSceneId(fifth.state), 'final-broadcast');
  assert.deepEqual(fifth.state.evidence.map(({ action, evidenceId }) => [evidenceId, action]), [
    ['original-upload-trace', 'secure'],
    ['dot-deletion-log', 'purge'],
    ['support-record', 'secure'],
    ['verified-package', 'secure']
  ]);
  assert.throws(() => completeCampaignChapter(fifth.state, 5, 'secure'), /현재 장/);
});

test('production campaign adapters stay deterministic and are wired into the default entry', () => {
  const sources = [
    '../src/reboot/app/campaignSceneRouting.js',
    '../src/reboot/campaign/chapterProgression.js',
    '../src/reboot/render/campaignChapterScene.js'
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
  const entry = readFileSync(new URL('../src/reboot/entry.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../reboot.html', import.meta.url), 'utf8');

  assert.equal(/Math\.random/.test(sources), false);
  assert.match(entry, /resolveCampaignSceneId\(session\.getState\(\)\)/);
  assert.match(entry, /campaign-chapter-2[\s\S]*campaign-chapter-3[\s\S]*campaign-chapter-4|\[2, 3, 4\]/);
  assert.match(entry, /final-broadcast/);
  assert.match(html, /data-campaign-continue/);
});
