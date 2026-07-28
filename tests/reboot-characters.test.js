import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CHARACTER_ASSET_PATHS,
  CHARACTER_ROSTER,
  getCharacterProfile
} from '../src/reboot/characters/catalog.js';
import { chooseCharacterAnimation } from '../src/reboot/characters/animationState.js';

const REQUIRED_CHARACTER_IDS = [
  'player',
  'dot',
  'haru',
  'yoonseo',
  'student-a',
  'student-b',
  'eraser',
  'stamper',
  'copycat',
  'recommender',
  'approval',
  'attendance-proctor',
  'lumen'
];

test('reboot roster replaces every story role with a licensed imported model profile', () => {
  // Given: the complete reboot story roster.
  const rosterIds = Object.keys(CHARACTER_ROSTER).sort();

  // When: each authored role is inspected.
  // Then: every role points to imported body, outfit, palette, and animation data.
  assert.deepEqual(rosterIds, [...REQUIRED_CHARACTER_IDS].sort());
  for (const id of REQUIRED_CHARACTER_IDS) {
    const profile = getCharacterProfile(id);
    assert.equal(profile.id, id);
    assert.match(profile.body, /^(female|male)$/);
    assert.match(profile.outfit, /^(peasant|ranger)$/);
    assert.match(profile.tint, /^#[0-9a-f]{6}$/i);
    assert.ok(profile.scale >= 0.8 && profile.scale <= 1.25);
    assert.deepEqual(Object.keys(profile.animations).sort(), ['action', 'defeat', 'hit', 'idle', 'move']);
  }
  assert.throws(() => getCharacterProfile('missing-role'), /missing-role/);
});

test('character animation priority is deterministic across combat and movement', () => {
  // Given: a profile with five named clips.
  const profile = getCharacterProfile('player');

  // When: overlapping state flags are resolved.
  // Then: terminal and one-shot states outrank locomotion without randomness.
  assert.equal(chooseCharacterAnimation(profile, {}), profile.animations.idle);
  assert.equal(chooseCharacterAnimation(profile, { moving: true }), profile.animations.move);
  assert.equal(chooseCharacterAnimation(profile, { acting: true, moving: true }), profile.animations.action);
  assert.equal(chooseCharacterAnimation(profile, { hit: true, acting: true }), profile.animations.hit);
  assert.equal(chooseCharacterAnimation(profile, { defeated: true, hit: true }), profile.animations.defeat);
});

test('runtime character assets exist locally and are documented as CC0', () => {
  // Given: every runtime file declared by the character catalog.
  const projectRoot = new URL('../', import.meta.url);

  // When: paths and provenance are checked from disk.
  // Then: the build is self-contained and every external pack is attributed.
  for (const path of Object.values(CHARACTER_ASSET_PATHS)) {
    assert.equal(existsSync(new URL(`../public${path}`, import.meta.url)), true, path);
  }
  const licenses = readFileSync(new URL('../ASSET_LICENSES.md', import.meta.url), 'utf8');
  assert.match(licenses, /Universal Base Characters/i);
  assert.match(licenses, /Modular Character Outfits - Fantasy/i);
  assert.match(licenses, /Universal Animation Library(?: 2)?/i);
  assert.match(licenses, /CC0 1\.0/i);
  assert.ok(projectRoot);
});

test('school scene uses the imported character pipeline instead of primitive avatars', () => {
  // Given: the authored school scene source.
  const source = readFileSync(new URL('../src/reboot/render/schoolNightScene.js', import.meta.url), 'utf8');

  // When: its player construction is inspected.
  // Then: no capsule or other primitive avatar remains in the reboot runtime.
  assert.match(source, /createCharacterCast/);
  assert.doesNotMatch(source, /CapsuleGeometry|playerGeometry|playerMaterial/);
});
