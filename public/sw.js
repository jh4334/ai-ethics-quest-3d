// 오프라인 서비스워커 — 학교 와이파이가 불안정해도 한 번 연 태블릿에선 계속 동작한다.
// 전략: 페이지 이동(navigate)은 네트워크 우선(새 배포 즉시 반영) + 실패 시 캐시 폴백,
// 해시 파일명 에셋(/assets/)은 캐시 우선(불변 파일이라 재다운로드 불필요).
const CACHE = 'ethics-isle-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg', './trilogy.html'];

self.addEventListener('install', (event) => {
  // 첫 방문에서 곧바로 오프라인이 가능해야 한다(교실: 와이파이가 언제 끊길지 모른다).
  // SW가 페이지를 제어하기 전에 받아진 해시 에셋은 fetch 핸들러를 안 거치므로,
  // 설치 시점에 index.html을 파싱해 에셋까지 미리 캐시에 싣는다.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE);
      try {
        const response = await fetch('./index.html', { cache: 'no-cache' });
        const html = await response.text();
        const assets = [...html.matchAll(/(?:src|href)="(\.?\/?assets\/[^"]+)"/g)]
          .map((match) => (match[1].startsWith('.') ? match[1] : `./${match[1].replace(/^\//, '')}`));
        if (assets.length > 0) {
          await cache.addAll(assets);
        }
      } catch (error) {
        // 프리캐시 실패는 치명적이지 않다 — 런타임 캐시가 이후 요청을 채운다.
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
    return;
  }
  if (request.mode === 'navigate') {
    // 네트워크 우선: 온라인이면 항상 최신 index를 받고 캐시를 갱신한다.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit ?? caches.match('./index.html')))
    );
    return;
  }
  // 에셋: 캐시 우선 + 최초 응답을 캐시에 적재.
  event.respondWith(
    caches.match(request).then((hit) => {
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
