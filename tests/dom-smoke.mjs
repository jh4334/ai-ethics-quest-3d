import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

assert.match(html, /AI Ethics Quest 3D/);
assert.match(html, /<script type="module" src="\/src\/main\.js"><\/script>/);
assert.match(main, /THREE/);
assert.match(main, /initEthicsQuest3D/);
assert.match(main, /data-app-marker="AI Ethics Quest 3D"|AI Ethics Quest 3D/);
console.log('DOM smoke passed: AI Ethics Quest 3D marker and module wiring present');
