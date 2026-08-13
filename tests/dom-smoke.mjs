import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const illustrated = readFileSync(new URL('../illustrated.html', import.meta.url), 'utf8');
const reboot = readFileSync(new URL('../reboot.html', import.meta.url), 'utf8');
const legacy = readFileSync(new URL('../legacy.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const rebootEntry = readFileSync(new URL('../src/reboot/entry.js', import.meta.url), 'utf8');

assert.match(html, /사라진 학생 H-17/);
assert.match(html, /location\.replace\(illustratedUrl\.href\)/);
assert.match(illustrated, /src\/illustrated\/entry\.js/);
assert.match(illustrated, /data-scene-action/);
assert.match(reboot, /<script type="module" src="\/src\/reboot\/entry\.js"><\/script>/);
assert.match(legacy, /<script type="module" src="\/src\/main\.js"><\/script>/);
assert.match(main, /THREE/);
assert.match(main, /initEthicsQuest3D/);
assert.match(rebootEntry, /resolveCampaignSceneId/);
console.log('DOM smoke passed: illustrated 2D is canonical and both 3D rollback routes remain wired');
