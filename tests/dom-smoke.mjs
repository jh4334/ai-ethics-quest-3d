import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const reboot = readFileSync(new URL('../reboot.html', import.meta.url), 'utf8');
const legacy = readFileSync(new URL('../legacy.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const rebootEntry = readFileSync(new URL('../src/reboot/entry.js', import.meta.url), 'utf8');

assert.match(html, /H-17: NULL/);
assert.match(html, /location\.replace\(rebootUrl\.href\)/);
assert.match(reboot, /<script type="module" src="\/src\/reboot\/entry\.js"><\/script>/);
assert.match(legacy, /<script type="module" src="\/src\/main\.js"><\/script>/);
assert.match(main, /THREE/);
assert.match(main, /initEthicsQuest3D/);
assert.match(rebootEntry, /resolveCampaignSceneId/);
console.log('DOM smoke passed: H-17 reboot is canonical and legacy rollback remains wired');
