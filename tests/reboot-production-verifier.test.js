import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../scripts/verify-reboot-production.mjs', import.meta.url), 'utf8');

test('production verifier exercises the current v5 save and v12 offline cache contracts', () => {
  assert.match(source, /V5_SAVE_KEY/);
  assert.doesNotMatch(source, /localStorage\.setItem\('h17\.null\.save\.v4'/);
  assert.match(source, /ethics-quest-h17-v12/);
  assert.match(source, /locator\('\[data-shell-new\]'\)\.click\(\)/);
  assert.match(source, /const chapterThree = setChapterCheckpoint\(chapterTwo, 3, 'chapter-3:start'\)/);
  assert.doesNotMatch(source, /campaignCompleted/);
  assert.ok([...source.matchAll(/locator\('\[data-shell-continue\]'\)\.click\(\)/g)].length >= 3);
});
