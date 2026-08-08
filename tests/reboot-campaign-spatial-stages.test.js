import assert from 'node:assert/strict';
import test from 'node:test';

import { getRoomWaveEncounter } from '../src/reboot/campaign/roomWaves.js';
import { chapterTwoLevel } from '../src/reboot/content/levels/chapter2.js';
import { chapterThreeLevel } from '../src/reboot/content/levels/chapter3.js';
import { chapterFourLevel } from '../src/reboot/content/levels/chapter4.js';

const LEVELS = Object.freeze({
  2: chapterTwoLevel,
  3: chapterThreeLevel,
  4: chapterFourLevel
});

const EXPECTED_GEOMETRY = Object.freeze({
  2: ['edit-bays', 'upload-trace', 'broadcast-stage'],
  3: ['warm-incomplete', 'cold-verified', 'deletion-archive'],
  4: ['conveyor-scoring', 'approval-trace', 'emergency-archive']
});

test('Given chapters 2-4, When spatial contracts are read, Then every chapter has three distinct playable zones', () => {
  // Given: 도착 구간 뒤에 실제 플레이 공간이 이어지는 2~4장 레벨.
  for (const [chapter, level] of Object.entries(LEVELS)) {
    const zones = level.segments.slice(1);

    // When: 장별 공간의 기하·상호작용·서사 단계를 비교한다.
    const geometryIds = zones.map((zone) => zone.geometryId);
    const interactionIds = zones.map((zone) => zone.interactionId);
    const beats = zones.flatMap((zone) => zone.phaseBeats);

    // Then: 색상 교체가 아닌 고유 공간 세 곳이 전체 플레이 흐름을 담당한다.
    assert.equal(zones.length, 3, `${chapter}장 공간 수`);
    assert.deepEqual(geometryIds, EXPECTED_GEOMETRY[chapter]);
    assert.equal(new Set(geometryIds).size, 3);
    assert.equal(new Set(interactionIds).size, 3);
    assert.deepEqual(beats, [
      'exploration', 'encounter', 'clue', 'mid-challenge', 'consequence', 'boss-escape'
    ]);
  }
});

test('Given spatial level zones, When room waves are inspected, Then each wave owns the next zone origin and prior checkpoint', () => {
  // Given: 각 장의 세 전투와 네 개 연속 구간.
  for (const [chapterText, level] of Object.entries(LEVELS)) {
    const chapter = Number(chapterText);

    // When: 웨이브별 공간 원점과 재시작 체크포인트를 읽는다.
    const waves = [0, 1, 2].map((waveIndex) => getRoomWaveEncounter(chapter, waveIndex));
    const origins = waves.map((wave) => wave.spatial.encounterOrigin);
    const starts = waves.map((wave) => wave.spatial.startPosition);

    // Then: 세 웨이브는 한 방을 재사용하지 않고 다음 구간으로 남진한다.
    assert.deepEqual(origins, level.segments.slice(1).map(({ anchor }) => ({ x: anchor.x, z: anchor.z })));
    assert.deepEqual(starts, level.segments.slice(0, 3).map(({ anchor }) => ({ x: anchor.x, y: anchor.z })));
    assert.equal(new Set(origins.map(({ x, z }) => `${x}:${z}`)).size, 3);
    for (const [index, wave] of waves.entries()) {
      assert.equal(wave.spatial.segmentId, level.segments[index + 1].id);
      assert.equal(wave.spatial.interactionId, level.segments[index + 1].interactionId);
      assert.ok(
        Math.hypot(origins[index].x - starts[index].x, origins[index].z - starts[index].y) >= 18,
        `${chapter}장 ${index + 1}구역 이동 거리`
      );
    }
  }
});

test('Given chapter-specific ethics spaces, When their authored paths are compared, Then the requested evidence conflicts remain structural', () => {
  // Given: 공유 추적, 이중 학교, 3초 승인 장면의 공간 메타데이터.
  const chapterTwoZones = chapterTwoLevel.segments.slice(1);
  const chapterThreeZones = chapterThreeLevel.segments.slice(1);
  const chapterFourZones = chapterFourLevel.segments.slice(1);

  // When: 핵심 단서와 경로의 물리 배치를 읽는다.
  const chapterTwoTrace = chapterTwoZones.find(({ interactionId }) => interactionId === 'trace-original-upload');
  const warmPath = chapterThreeZones.find(({ pathId }) => pathId === 'warm-incomplete-path');
  const coldPath = chapterThreeZones.find(({ pathId }) => pathId === 'cold-verifiable-path');
  const deletionReveal = chapterThreeZones.find(({ interactionId }) => interactionId === 'reveal-dot-deletion');
  const emergencyArchive = chapterFourZones.find(({ interactionId }) => interactionId === 'open-emergency-archive');

  // Then: 단서는 명시적이고, 3장의 두 경로는 좌우·형태가 실제로 다르며, 4장은 부작용을 기록한다.
  assert.ok(chapterTwoTrace);
  assert.ok(warmPath.anchor.x < 0);
  assert.ok(coldPath.anchor.x > 0);
  assert.notEqual(warmPath.geometryId, coldPath.geometryId);
  assert.ok(deletionReveal);
  assert.equal(emergencyArchive.sideEffectId, 'approval-delay-exposes-support-record');
});
