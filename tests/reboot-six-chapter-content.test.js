import assert from 'node:assert/strict';
import test from 'node:test';

import { chapterTwoLevel } from '../src/reboot/content/levels/chapter2.js';
import { chapterThreeLevel } from '../src/reboot/content/levels/chapter3.js';
import { chapterFourLevel } from '../src/reboot/content/levels/chapter4.js';
import { chapterFiveLevel } from '../src/reboot/content/levels/chapter5.js';

const catalog = await import('../src/reboot/content/chapters/catalog.js').catch(() => ({}));
const chapterSix = await import('../src/reboot/content/levels/chapter6.js').catch(() => ({}));
const { CHAPTERS_2_6 = [], CHAPTER_FIVE = {}, CHAPTER_SIX = {} } = catalog;
const { chapterSixLevel = { layers: { visual: [] }, segments: [] } } = chapterSix;

test('Given the reboot canon, When chapter definitions load, Then chapters two through six own distinct evidence and the finale belongs to six', () => {
  // Given: 새 5장을 삽입하고 기존 마지막 방송을 6장으로 옮긴 정본.
  const definitions = CHAPTERS_2_6;

  // When: 장 순서와 핵심 소유권을 읽는다.
  const orders = definitions.map((chapter) => chapter.order);
  const evidenceIds = definitions.map((chapter) => chapter.evidenceId);

  // Then: 이름만 바꾼 중복 장 없이 증언 패키지와 방송 대기열이 분리된다.
  assert.deepEqual(orders, [2, 3, 4, 5, 6]);
  assert.equal(new Set(definitions.map((chapter) => chapter.id)).size, 5);
  assert.equal(new Set(evidenceIds).size, 5);
  assert.equal(CHAPTER_FIVE.id, 'chapter-5-testimony-archive');
  assert.equal(CHAPTER_FIVE.evidenceId, 'verified-testimony-package');
  assert.equal(CHAPTER_SIX.id, 'chapter-6-final-broadcast');
  assert.equal(CHAPTER_SIX.evidenceId, 'broadcast-queue');
  assert.deepEqual(CHAPTER_SIX.boss.phases.map((phase) => phase.response), [
    'reflect', 'trace', 'dash', 'attack'
  ]);
});

test('Given chapters two through six, When level spaces are inspected, Then every chapter has four authored spaces and a unique spatial signature', () => {
  // Given: 장마다 탐색·단서·중간 도전·보스/탈출을 담는 저작 레벨.
  const levels = [chapterTwoLevel, chapterThreeLevel, chapterFourLevel, chapterFiveLevel, chapterSixLevel];

  // When: 공간 수와 시각/상호작용 종류를 읽는다.
  const signatures = levels.map((level) => level.layers.visual.map((entry) => entry.kind).join('|'));

  // Then: 단일 원룸이나 색만 다른 복제 경로가 아니다.
  assert.equal(levels.every((level) => level.segments.length === 4), true);
  assert.equal(levels.every((level) => new Set(level.layers.visual.map((entry) => entry.kind)).size >= 3), true);
  assert.equal(new Set(signatures).size, levels.length);
  assert.deepEqual(chapterFiveLevel.segments.map((segment) => segment.id), [
    'testimony-intake', 'consent-redaction-lab', 'privacy-crosscheck', 'verification-vault'
  ]);
  assert.deepEqual(chapterSixLevel.segments.map((segment) => segment.id), [
    'broadcast-entry', 'protection-relay', 'transmission-bridge', 'final-core'
  ]);
});

test('Given unmeasured campaign content, When timelines are inspected, Then no authored playtime masquerades as measured evidence', () => {
  // Given/When: 아직 수동 풀런으로 시간을 재지 않은 다섯 장.
  const timelines = CHAPTERS_2_6.map((chapter) => chapter.timeline);

  // Then: 상태만 기록하고 데스크톱·터치 분량 숫자는 QA 뒤에만 추가한다.
  assert.equal(timelines.every((timeline) => timeline.status === 'unmeasured'), true);
  assert.equal(timelines.some((timeline) => 'desktopMinutes' in timeline || 'touchMinutes' in timeline), false);
});
