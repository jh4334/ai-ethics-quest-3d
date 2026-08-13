import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const illustrated = readFileSync(new URL('../illustrated.html', import.meta.url), 'utf8');
const reboot = readFileSync(new URL('../reboot.html', import.meta.url), 'utf8');
const legacy = readFileSync(new URL('../legacy.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const rebootEntry = readFileSync(new URL('../src/reboot/entry.js', import.meta.url), 'utf8');

assert.match(html, /사라진 학생 H-17/);
assert.match(html, /src="\/src\/illustrated\/entry\.js"/);
assert.match(html, /<canvas[^>]+data-action-canvas/);
assert.doesNotMatch(html, /location\.replace|src="\/src\/(?:main|reboot\/entry)\.js"/);
assert.match(illustrated, /src\/illustrated\/entry\.js/);
assert.match(illustrated, /<canvas[^>]+data-action-canvas/);
assert.match(illustrated, /data-game-hud/);
assert.match(illustrated, /data-control="left"/);
assert.match(illustrated, /data-control="right"/);
assert.match(illustrated, /data-control="jump"/);
assert.match(illustrated, /data-control="attack"/);
assert.match(illustrated, /data-control="trace"/);
assert.match(illustrated, /aria-live="polite"/);
assert.match(reboot, /<script type="module" src="\/src\/reboot\/entry\.js"><\/script>/);
assert.match(legacy, /<script type="module" src="\/src\/main\.js"><\/script>/);
assert.match(main, /THREE/);
assert.match(main, /initEthicsQuest3D/);
assert.match(rebootEntry, /resolveCampaignSceneId/);
console.log('DOM smoke passed: illustrated 2D action shell is canonical and both 3D rollback routes remain wired');
