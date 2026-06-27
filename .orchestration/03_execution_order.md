# 03 Execution Order

## Loop mode
- Mode: serious
- Max iterations: 15
- Stop when tests/build/smoke pass and two consecutive review passes find no high-impact issue.

## Phase 1 — setup
1. Hermes creates project skeleton and orchestration docs.
2. Claude PM read-only review produces refined concept/risks.
3. Hermes writes/updates docs from Claude output.

## Phase 2 — RED tests
1. Write tests for ethics world data, puzzle correctness, progress unlocks, and DOM script marker.
2. Run tests and confirm expected RED failure before implementation.

## Phase 3 — Codex Builder implementation
1. Build Three.js scene with small island, zones, shrines, NPC panels, final AI Core.
2. Add age-appropriate content for 개인정보/편향/저작권/딥페이크.
3. Add docs: teacher guide, student activity sheet, rubric, presentation draft.
4. Keep app deployable to GitHub Pages.

## Phase 4 — deterministic QA
- npm install using project-local cache if needed.
- npm test
- npm run build
- node smoke tests
- optional browser snapshot/screenshot if available

## Phase 5 — review/deploy
- Codex Reviewer Code Autopsy review.
- Fix blocking findings.
- Commit/push.
- Enable GitHub Pages if conditions pass.
- Verify deployed URL marker.
