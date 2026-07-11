# AI Ethics Quest 3D

Three.js 3D AI ethics island prototype for upper elementary classes.

**2부 of the AI ethics game trilogy** 「AI 윤리 수호자의 여정」:

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

## Classroom Scope

- Four ethics zones: 개인정보, 편향, 저작권, 딥페이크
- NPC learning prompts, shrine puzzles, progress tracking, and final AI Core mission
- 심화 확장 2막 「잡음의 군도」: after the certificate, a raft voyage opens four themed
  islands — 악플·혐오표현 (🛡️ shield deflection), 가짜뉴스·출처 (🔔 bell reveal),
  스크린타임·디지털 웰빙 (🧭 compass timing), and a final rematch combining all four
  "promise verbs" (bonus journey — does not affect the certificate or learning report)
- No accounts, backend, secrets, payments, analytics, or student data storage
- Class documents in `docs/` — trilogy program (기획서·성취기준 매핑·지도안) in `docs/trilogy/`

The prototype uses procedural Three.js geometry and DOM UI, so it can be deployed as a static Vite site, including GitHub Pages.

`.github/workflows/pages.yml` deploys `dist/` (game + `/trilogy.html` hub) to GitHub Pages on every push to `main` — set repository Settings → Pages → Source to "GitHub Actions" once to enable it.

Student progress (shrine choices, learning report) is kept in the browser's localStorage only; the journal (J) has a reset button for shared devices.
