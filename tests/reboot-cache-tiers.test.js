import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const serviceWorkerSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const illustratedAsset = './assets/h17-side-scroll-background.js';
const environmentAsset = './assets/reboot/environment/building/wall.glb';

function createServiceWorkerHarness({ cacheKeys = [], cachedAssetUrls = [], deferCachePut = false } = {}) {
  const listeners = new Map();
  const addedAssets = [];
  const deletedCaches = [];
  const deletedEntries = [];
  const openedCaches = [];
  const cachedRequests = [];
  const networkRequests = [];
  let releaseCachePut = () => {};
  const cachePutGate = deferCachePut
    ? new Promise((resolve) => { releaseCachePut = resolve; })
    : Promise.resolve();
  const cache = {
    async add(path) { addedAssets.push(path); },
    async addAll() {},
    async delete(request) { deletedEntries.push(request.url); return true; },
    async keys() { return cachedAssetUrls.map((url) => ({ url })); },
    async match(request) {
      const url = typeof request === 'string' ? request : request.url;
      return cachedAssetUrls.includes(url) ? { ok: true } : null;
    },
    async put(request) {
      cachedRequests.push(typeof request === 'string' ? request : request.url);
      await cachePutGate;
    }
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
        async text() { return '<script src="./assets/h17-side-scroll-background.js"></script>'; }
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
    openedCaches,
    releaseCachePut
  };
}

test('Given the canonical 3D storybook and 2D archive, When the worker installs, Then only entry shells block first use', async () => {
  // Given: one install of the direct storybook release.
  const harness = createServiceWorkerHarness();

  // When: the real install listener completes.
  await harness.dispatch('install');

  // Then: entry shells are installed without pulling the archived 3D manifest.
  assert.ok(harness.addedAssets.includes(illustratedAsset));
  assert.equal(harness.networkRequests.includes('./reboot-assets.json'), false);
  assert.equal(harness.addedAssets.includes(environmentAsset), false);
  assert.ok(harness.openedCaches.every((key) => key === 'ethics-quest-h17-v15-storybook3d'));
});

test('Given app and unrelated cache generations, When the storybook cache activates, Then old H-17 shells are removed', async () => {
  // Given: two old app caches, the current cache, and another product cache.
  const harness = createServiceWorkerHarness({
    cacheKeys: [
      'ethics-quest-h17-v11', 'ethics-quest-h17-v12', 'ethics-quest-h17-v13',
      'ethics-quest-h17-environment', 'school-portal-v4'
    ]
  });

  // When: the real activate listener migrates cache generations.
  await harness.dispatch('activate');

  // Then: migration is scoped to this app's older generations.
  assert.deepEqual(harness.deletedCaches.sort(), ['ethics-quest-h17-v11', 'ethics-quest-h17-v12', 'ethics-quest-h17-v13']);
});

test('Given archived 3D cache entries, When the storybook cache activates, Then obsolete archive files are pruned', async () => {
  // Given: one lazy environment response and one removed bundle entry in the current cache.
  const environmentUrl = 'https://school.example/ai-ethics/assets/reboot/environment/building/wall.glb';
  const staleUrl = 'https://school.example/ai-ethics/assets/removed.js';
  const harness = createServiceWorkerHarness({ cachedAssetUrls: [environmentUrl, staleUrl] });

  // When: activate reconciles current-cache entries against the complete manifest.
  await harness.dispatch('activate');

  // Then: neither file belongs to the canonical entry set.
  assert.deepEqual(new Set(harness.deletedEntries), new Set([environmentUrl, staleUrl]));
});

test('Given a chapter environment cache miss, When the scene requests it, Then the response is fetched and stored in the environment tier', async () => {
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
  assert.ok(harness.openedCaches.includes('ethics-quest-h17-environment'));
});

test('Given a slow lazy cache write, When an environment response resolves, Then the worker keeps the response lifecycle open until caching finishes', async () => {
  const url = 'https://school.example/ai-ethics/assets/reboot/environment/building/wall.glb';
  const request = { method: 'GET', mode: 'cors', url };
  const harness = createServiceWorkerHarness({ deferCachePut: true });
  let responseSettled = false;

  const responsePromise = harness.dispatchFetch(request).then((response) => {
    responseSettled = true;
    return response;
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(harness.cachedRequests, [url]);
  assert.equal(responseSettled, false);
  harness.releaseCachePut();
  assert.equal((await responsePromise).ok, true);
});

test('Given a non-environment app asset misses, When the worker fetches it, Then the install cache stores the response', async () => {
  const url = 'https://school.example/ai-ethics/assets/reboot-shell.js';
  const harness = createServiceWorkerHarness();

  const response = await harness.dispatchFetch({ method: 'GET', mode: 'cors', url });

  assert.equal(response.ok, true);
  assert.deepEqual(harness.cachedRequests, [url]);
  assert.ok(harness.openedCaches.includes('ethics-quest-h17-v15-storybook3d'));
});
