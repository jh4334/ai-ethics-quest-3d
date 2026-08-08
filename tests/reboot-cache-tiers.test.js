import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const serviceWorkerSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const characterAsset = './assets/reboot/characters/base/player.gltf';
const environmentAsset = './assets/reboot/environment/building/wall.glb';

function createServiceWorkerHarness({ cacheKeys = [], cachedAssetUrls = [] } = {}) {
  const listeners = new Map();
  const addedAssets = [];
  const deletedCaches = [];
  const deletedEntries = [];
  const openedCaches = [];
  const cachedRequests = [];
  const networkRequests = [];
  const cache = {
    async add(path) { addedAssets.push(path); },
    async addAll() {},
    async delete(request) { deletedEntries.push(request.url); return true; },
    async keys() { return cachedAssetUrls.map((url) => ({ url })); },
    async put(request) { cachedRequests.push(request.url); }
  };
  const context = {
    URL,
    caches: {
      async delete(key) { deletedCaches.push(key); return true; },
      async keys() { return cacheKeys; },
      async match() { return null; },
      async open(key) { openedCaches.push(key); return cache; }
    },
    fetch: async (request) => {
      const path = typeof request === 'string' ? request : request.url;
      networkRequests.push(path);
      if (path === './reboot-assets.json') {
        return { async json() { return [characterAsset, environmentAsset]; } };
      }
      return {
        ok: true,
        clone() { return this; },
        async text() { return '<script src="./assets/reboot-shell.js"></script>'; }
      };
    },
    self: {
      addEventListener(type, listener) { listeners.set(type, listener); },
      clients: { async claim() {} },
      registration: { scope: 'https://school.example/ai-ethics/' },
      async skipWaiting() {}
    }
  };
  vm.runInNewContext(serviceWorkerSource, context);

  async function dispatch(type, extra = {}) {
    let pending;
    listeners.get(type)({ ...extra, waitUntil(value) { pending = value; } });
    await pending;
  }

  async function dispatchFetch(request) {
    let response;
    listeners.get('fetch')({ request, respondWith(value) { response = value; } });
    const resolved = await response;
    await Promise.resolve();
    return resolved;
  }

  return {
    addedAssets,
    cachedRequests,
    deletedCaches,
    deletedEntries,
    dispatch,
    dispatchFetch,
    networkRequests,
    openedCaches
  };
}

test('Given core, character, and environment assets, When the worker installs, Then environment files stay out of blocking precache', async () => {
  // Given: one install with a mixed release manifest.
  const harness = createServiceWorkerHarness();

  // When: the real install listener completes.
  await harness.dispatch('install');

  // Then: shell and character files are installed, while chapter environment remains lazy.
  assert.ok(harness.addedAssets.includes('./assets/reboot-shell.js'));
  assert.ok(harness.addedAssets.includes(characterAsset));
  assert.equal(harness.addedAssets.includes(environmentAsset), false);
  assert.ok(harness.openedCaches.every((key) => key === 'ethics-quest-h17-v12'));
});

test('Given app and unrelated cache generations, When v12 activates, Then only older H-17 caches are removed', async () => {
  // Given: two old app caches, the current cache, and another product cache.
  const harness = createServiceWorkerHarness({
    cacheKeys: ['ethics-quest-h17-v10', 'ethics-quest-h17-v11', 'ethics-quest-h17-v12', 'school-portal-v4']
  });

  // When: the real activate listener migrates cache generations.
  await harness.dispatch('activate');

  // Then: migration is scoped to this app's older generations.
  assert.deepEqual(harness.deletedCaches.sort(), ['ethics-quest-h17-v10', 'ethics-quest-h17-v11']);
});

test('Given a lazily cached environment file, When v12 prunes stale assets, Then the manifest-owned file survives', async () => {
  // Given: one lazy environment response and one removed bundle entry in the current cache.
  const environmentUrl = 'https://school.example/ai-ethics/assets/reboot/environment/building/wall.glb';
  const staleUrl = 'https://school.example/ai-ethics/assets/removed.js';
  const harness = createServiceWorkerHarness({ cachedAssetUrls: [environmentUrl, staleUrl] });

  // When: activate reconciles current-cache entries against the complete manifest.
  await harness.dispatch('activate');

  // Then: only the stale entry is removed.
  assert.deepEqual(harness.deletedEntries, [staleUrl]);
});

test('Given a chapter environment cache miss, When the scene requests it, Then the response is fetched and stored in v12', async () => {
  // Given: an uncached same-origin environment request.
  const url = 'https://school.example/ai-ethics/assets/reboot/environment/building/wall.glb';
  const request = { method: 'GET', mode: 'cors', url };
  const harness = createServiceWorkerHarness();

  // When: the real fetch listener handles the first scene request.
  const response = await harness.dispatchFetch(request);

  // Then: the lazy response succeeds and becomes available to the current cache.
  assert.equal(response.ok, true);
  assert.ok(harness.networkRequests.includes(url));
  assert.deepEqual(harness.cachedRequests, [url]);
  assert.ok(harness.openedCaches.every((key) => key === 'ethics-quest-h17-v12'));
});
