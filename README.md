# AI Ethics Quest 3D

Six-chapter Three.js story adventure about AI ethics for upper elementary and middle-school classes.

Originally created as the second part of 「AI 윤리 수호자의 여정」, the game is being rebuilt as a
standalone six-chapter campaign:

1. [codex-aiethics](https://github.com/jh4334/codex-aiethics) — 2D 탐험 퍼즐 (배움)
2. **ai-ethics-quest-3d** (this repo) — 3D 판단 시뮬레이션 (적용)
3. [ethics-path-finder](https://github.com/jh4334/ethics-path-finder) — 역량 진단 웹앱 (진단·성찰)

Trilogy hub page: `public/trilogy.html` (served at `/trilogy.html`). Curriculum mapping (2022 개정 성취기준) and the 6-차시 lesson plans live in [`docs/trilogy/`](docs/trilogy/README.md).

## Run

```bash
npm install --cache ./.npm-cache
npm test
npm run dev
```

Build for static hosting:

```bash
npm run build
npm run smoke
```

## Six-Chapter Campaign

- 1장 「안개가 삼킨 이름」 — 개인정보·편향
- 2장 「가짜 얼굴의 신전」 — 저작권·딥페이크
- 3장 「말이 남긴 상처」 — 악플·혐오표현·디지털 발자국
- 4장 「같은 목소리의 바다」 — 가짜뉴스·출처·필터버블
- 5장 「멈추지 않는 밤」 — 디지털 웰빙·AI 의존·생성물 표시
- 6장 「기억의 심장」 — 책임·인간과 AI의 협업
- 2장에서는 네 가지 기초 약속 인증을, 6장에서는 최종 완주증을 발급한다.
- 3–5장은 각각 핵심 도전 뒤에 발자국 복구, 필터 버블 교차 확인, AI 생성물 라벨링 3D 퍼즐을
  마쳐야 다음 장의 항로가 열린다.
- 공간 컨셉 「정보의 바다 / 기억의 군도」: the world itself is the metaphor — 진실의 등대 (trusted
  sources; one beam per healed stage), 안개 (unverified information), 데이터 해류
  (particle currents that flow only along opened routes), and 12 hidden 지식의 유리병
  (digital-literacy tips collected into an in-game logbook)
- PWA: installable to the home screen and fully playable offline after first load
  (service worker precaches the hashed bundle; navigation stays network-first)
- No accounts, backend, secrets, payments, analytics, or student data storage
- Class documents in `docs/` — trilogy program (기획서·성취기준 매핑·지도안) in `docs/trilogy/`

The game uses procedural Three.js geometry, generated title art, and DOM UI, so it can be deployed as a static Vite site,
including GitHub Pages. Runtime art provenance is documented in [`ASSET_LICENSES.md`](ASSET_LICENSES.md).

`.github/workflows/pages.yml` deploys `dist/` (game + `/trilogy.html` hub) to GitHub Pages on every push to `main` — set repository Settings → Pages → Source to "GitHub Actions" once to enable it.

Student progress (shrine choices, learning report) is kept in the browser's localStorage only; the journal (J) has a reset button for shared devices.
