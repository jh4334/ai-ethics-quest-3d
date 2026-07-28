// 오프라인 서비스워커 — 학교 와이파이가 불안정해도 한 번 연 태블릿에선 계속 동작한다.
// 전략: 페이지 이동(navigate)은 네트워크 우선(새 배포 즉시 반영) + 실패 시 캐시 폴백,
// 해시 파일명 에셋(/assets/)은 캐시 우선(불변 파일이라 재다운로드 불필요).
const CACHE = 'ethics-quest-h17-v9';
const ENTRY_DOCUMENTS = ['./index.html', './reboot.html'];
const ASSET_MANIFEST = './reboot-assets.json';
const CORE = ['./', ...ENTRY_DOCUMENTS, ASSET_MANIFEST, './manifest.webmanifest', './icon.svg', './trilogy.html'];

async function readEntryAssets() {
  const assets = new Set();
  for (const entry of ENTRY_DOCUMENTS) {
    const response = await fetch(entry, { cache: 'no-cache' });
    const html = await response.text();
    for (const match of html.matchAll(/(?:src|href)="(\.?\/?assets\/[^"]+)"/g)) {
      assets.add(match[1].startsWith('.') ? match[1] : `./${match[1].replace(/^\//, '')}`);
    }
  }
  const manifest = await fetch(ASSET_MANIFEST, { cache: 'no-cache' }).then((response) => response.json());
  for (const asset of manifest) assets.add(asset);
  return [...assets];
}

self.addEventListener('install', (event) => {
  // 첫 방문에서 곧바로 오프라인이 가능해야 한다(교실: 와이파이가 언제 끊길지 모른다).
  // SW가 페이지를 제어하기 전에 받아진 해시 에셋은 fetch 핸들러를 안 거치므로,
  // 설치 시점에 index.html을 파싱해 에셋까지 미리 캐시에 싣는다.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE);
      try {
        const assets = await readEntryAssets();
        for (const asset of assets) await cache.add(asset);
      } catch (error) {
        // 프리캐시 실패는 치명적이지 않다 — 런타임 캐시가 이후 요청을 채운다.
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 구버전 캐시 통째 정리.
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      // 같은 캐시 안에 남은 스테일 해시 에셋 정리: 현재 index.html이 참조하지 않는
      // /assets/ 항목을 지운다(배포가 거듭돼도 캐시가 무한히 불지 않게 — 루프5 리뷰 반영).
      try {
        const cache = await caches.open(CACHE);
        const live = new Set((await readEntryAssets()).map((asset) => asset.replace(/^\.?\//, '')));
        const entries = await cache.keys();
        await Promise.all(
          entries
            .filter((request) => {
              const path = new URL(request.url).pathname;
              const assetIdx = path.indexOf('assets/');
              return assetIdx >= 0 && !live.has(path.slice(assetIdx));
            })
            .map((request) => cache.delete(request))
        );
      } catch (error) {
        // 오프라인 중 activate면 정리를 건너뛴다 — 다음 온라인 activate에서 처리된다.
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);
  const scopeUrl = new URL(self.registration.scope);
  if (request.method !== 'GET' || requestUrl.origin !== scopeUrl.origin) {
    return;
  }
  if (request.mode === 'navigate') {
    // 네트워크 우선: 온라인이면 항상 최신 index를 받고 캐시를 갱신한다.
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (!response.ok) throw new Error(`navigation failed: ${response.status}`);
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
        return response;
      } catch {
        const exact = await caches.match(request, { ignoreSearch: true });
        if (exact) return exact;
        const fallback = requestUrl.pathname.endsWith('/reboot.html')
          ? './reboot.html'
          : './index.html';
        return caches.match(fallback);
      }
    })());
    return;
  }
  // 에셋: 캐시 우선 + 최초 응답을 캐시에 적재.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((hit) => {
      if (hit) {
        return hit;
      }
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
