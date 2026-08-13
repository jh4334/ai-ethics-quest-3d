import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CAMPAIGN_CHAPTERS,
  createActionGameState,
  getCampaignReport,
  serializeActionGame
} from '../src/illustrated/story.js';

test('기본 문서는 리디렉션 없이 2D 캔버스 게임을 직접 연다', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /data-action-canvas/);
  assert.match(html, /src="\/src\/illustrated\/entry\.js"/);
  assert.doesNotMatch(html, /location\.replace|reboot\.html/);
});

test('최초 정본의 여섯 장이 주제와 책임 경로를 순서대로 보존한다', () => {
  assert.deepEqual(
    CAMPAIGN_CHAPTERS.map(({ id, title, topic }) => [id, title, topic]),
    [
      ['chapter-1', '명단에서 사라진 아이', '개인정보·편향'],
      ['chapter-2', '거짓 영상의 주인', '저작권·딥페이크'],
      ['chapter-3', '웃음이 만든 폭풍', '디지털 발자국'],
      ['chapter-4', '두 개의 진실', '출처·필터버블'],
      ['chapter-5', '아무도 결정하지 않는 밤', '자동 결정·인간 검토'],
      ['chapter-6', '마지막 증언', '설명·이의제기']
    ]
  );
});

test('새 저장은 여섯 장 진행·선택·증거를 남기고 옛 v2 저장을 안전하게 이어받는다', () => {
  const migrated = createActionGameState({
    version: 2,
    checkpointX: 3190,
    evidenceIds: ['privacy', 'bias', 'copyright'],
    completed: false
  });
  assert.equal(migrated.chapterIndex, 3);
  assert.equal(migrated.unlockedChapter, 3);
  assert.equal(migrated.checkpointX, 2920 - 100);
  assert.equal(migrated.collectedEvidence.length, 3);

  migrated.decisions['chapter-1'] = 'protect-context';
  migrated.collectedEvidence.push('chapter-4:source');
  const saved = serializeActionGame(migrated);
  assert.equal(saved.version, 3);
  assert.equal(saved.chapterIndex, 3);
  assert.equal(saved.decisions['chapter-1'], 'protect-context');
  assert.equal(Object.keys(saved.decisions).length, 3);
  assert.ok(saved.evidenceIds.includes('chapter-4:source'));

  const completed = createActionGameState({
    version: 2,
    checkpointX: 5570,
    evidenceIds: ['privacy', 'bias', 'copyright', 'deepfake'],
    completed: true
  });
  assert.equal(completed.phase, 'campaign-complete');
  assert.equal(completed.completed, true);
  assert.equal(Object.keys(completed.decisions).length, 6);
});

test('1~5장 선택 누적이 같은 6장 선택 안에서도 서로 다른 결과를 만든다', () => {
  const restorative = createActionGameState({
    version: 3,
    chapterIndex: 5,
    unlockedChapter: 5,
    decisions: {
      'chapter-1': 'protect-context',
      'chapter-2': 'remove-and-notify',
      'chapter-3': 'notify-and-repair',
      'chapter-4': 'paired-sources',
      'chapter-5': 'human-review',
      'chapter-6': 'public-hearing'
    },
    completed: true
  });
  const preservation = createActionGameState({
    version: 3,
    chapterIndex: 5,
    unlockedChapter: 5,
    decisions: {
      'chapter-1': 'open-raw',
      'chapter-2': 'label-and-freeze',
      'chapter-3': 'quiet-freeze',
      'chapter-4': 'open-recommendation-path',
      'chapter-5': 'appeal-first',
      'chapter-6': 'public-hearing'
    },
    completed: true
  });
  assert.notEqual(getCampaignReport(restorative).ending.summary, getCampaignReport(preservation).ending.summary);
});

test('조사 보고서는 선악 점수 없이 장별 근거·선택·비용을 설명한다', () => {
  const state = createActionGameState({
    version: 3,
    chapterIndex: 5,
    unlockedChapter: 5,
    decisions: {
      'chapter-1': 'protect-context',
      'chapter-6': 'public-hearing'
    },
    evidenceIds: ['chapter-1:request', 'chapter-6:approval'],
    completed: true
  });
  const report = getCampaignReport(state);
  assert.equal(report.chapters.length, 6);
  assert.equal('score' in report, false);
  assert.match(report.summary, /하루|H-17/);
  assert.ok(report.chapters.every(({ consequence }) => typeof consequence === 'string'));
});
