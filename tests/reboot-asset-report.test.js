import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const reportScript = fileURLToPath(new URL('../scripts/report-reboot-assets.mjs', import.meta.url));

function writeFixtureFile(root, path, contents) {
  const filePath = join(root, 'dist', path);
  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(filePath, contents);
}

function createBuildFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'h17-asset-report-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const documents = {
    'index.html': '<script src="./assets/shell.js"></script>',
    'reboot.html': '<script src="./assets/shell.js"></script><script src="./assets/reboot.js"></script>',
    'legacy.html': '<script src="./assets/legacy.js"></script>'
  };
  for (const [path, contents] of Object.entries(documents)) writeFixtureFile(root, path, contents);
  writeFixtureFile(root, 'manifest.webmanifest', Buffer.alloc(5));
  writeFixtureFile(root, 'icon.svg', Buffer.alloc(6));
  writeFixtureFile(root, 'trilogy.html', Buffer.alloc(7));
  writeFixtureFile(root, 'assets/shell.js', Buffer.alloc(10));
  writeFixtureFile(root, 'assets/reboot.js', Buffer.alloc(20));
  writeFixtureFile(root, 'assets/legacy.js', Buffer.alloc(30));
  writeFixtureFile(root, 'assets/reboot/characters/base/player.gltf', Buffer.alloc(100));
  writeFixtureFile(root, 'assets/reboot/characters/animations/walk.glb', Buffer.alloc(200));
  writeFixtureFile(root, 'assets/reboot/environment/building/wall.glb', Buffer.alloc(300));
  const manifest = JSON.stringify([
    './assets/reboot/characters/base/player.gltf',
    './assets/reboot/characters/animations/walk.glb',
    './assets/reboot/environment/building/wall.glb'
  ]);
  writeFixtureFile(root, 'reboot-assets.json', manifest);
  return { documents, manifest, root };
}

function runReport(root) {
  return spawnSync(process.execPath, [reportScript, root], { encoding: 'utf8' });
}

test('Given a built release, When the transfer report runs, Then actual files are classified without double counting', (t) => {
  // Given: one shell graph and one file in each runtime asset tier.
  const fixture = createBuildFixture(t);
  const expectedShellBytes = Object.values(fixture.documents).reduce((sum, contents) => sum + Buffer.byteLength(contents), 0)
    + 5 + 6 + 7 + 10 + 20 + 30 + Buffer.byteLength(fixture.manifest);

  // When: the report CLI measures the fixture's dist directory.
  const result = runReport(fixture.root);

  // Then: categories use disk bytes and total counts each path once.
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.categories.initialShell, { bytes: expectedShellBytes, files: 10 });
  assert.deepEqual(report.categories.installPrecache, { bytes: expectedShellBytes + 300, files: 12 });
  assert.deepEqual(report.categories.chapterEnvironment, { bytes: 300, files: 1 });
  assert.deepEqual(report.categories.character, { bytes: 100, files: 1 });
  assert.deepEqual(report.categories.animation, { bytes: 200, files: 1 });
  assert.deepEqual(report.total, { bytes: expectedShellBytes + 600, files: 13 });
});

test('Given a manifest path with no built file, When the transfer report runs, Then it fails instead of undercounting', (t) => {
  // Given: a valid fixture whose environment payload is missing from dist.
  const fixture = createBuildFixture(t);
  rmSync(join(fixture.root, 'dist/assets/reboot/environment/building/wall.glb'));

  // When: the report CLI audits the incomplete build.
  const result = runReport(fixture.root);

  // Then: measurement fails closed.
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
});
