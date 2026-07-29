# H-17 Five-Loop Character and Story Polish

## TL;DR
> Summary:      Execute exactly five development/review loops that turn the current H-17 reboot from a technically passing but visually bare slice into a readable, character-led, licensed, cross-device game surface. Loop 1 fixes the confirmed cast failure first; later loops clarify story delivery, enrich school environments, differentiate campaign/finale scenes, and lock regression gates.
> Deliverables:
> - Five committed loops, each with baseline evidence, failing-first test/repro, minimal implementation, browser evidence, cleanup receipt, and exit criteria.
> - Distinct player, DOT, Haru, Yoonseo, LUMEN, and enemy presentation without palette-only identity.
> - Procedural school/environment dressing and campaign scene readability within existing performance budgets.
> - Updated license/asset manifest entries for any imported Quaternius CC0 hair files.
> - Final slice manifest at `.omo/evidence/h17-five-loop-slice-manifest.json`.
> Effort:       Large
> Risk:         Medium - character identity depends on imported rigged hair compatibility and browser visual proof, not tests alone.

## Scope
### Must have
- Exactly five development/review loops, executed by one implementation worker in order.
- Loop 1 must directly fix the confirmed failure:
  - `src/reboot/characters/factory.js:28` lerps non-skin material color 78% toward a tint.
  - `src/reboot/characters/factory.js:29` through `src/reboot/characters/factory.js:32` apply uniform emissive values that flatten imported texture detail.
  - `src/reboot/characters/catalog.js:65` through `src/reboot/characters/catalog.js:68` assign `player`, `dot`, `haru`, and `yoonseo` to Ranger variants.
  - `src/reboot/camera/framing.js:42` and `src/reboot/render/schoolSceneCamera.js:56` keep gameplay characters small in the default quarter-view; character fixes must survive the live camera, not only close-up inspection.
- Preserve H-17 canon:
  - Five-chapter reboot is canonical at `docs/reboot/game-bible.md:3` and `docs/reboot/game-bible.md:47` through `docs/reboot/game-bible.md:50`.
  - Responsibility chain is player approval, DOT deletion execution, Yoonseo policy approval, and LUMEN scoring at `docs/reboot/story-bible.md:7`.
  - Character simplifications forbidden by `docs/reboot/story-bible.md:13` through `docs/reboot/story-bible.md:17`.
- Use existing Quaternius CC0 assets plus the local CC0 base-character ZIP hair subset only; no paid assets.
  - Already documented runtime packs are `ASSET_LICENSES.md:8` through `ASSET_LICENSES.md:11`.
  - Official Quaternius Universal Base Characters page documents glTF, CC0, rigged base characters, and 20 hairstyles: `https://quaternius.com/packs/universalbasecharacters.html`.
  - Official Quaternius Modular Character Outfits - Fantasy page documents 12 outfits, 62 modular parts, 3 texture variants, glTF, and CC0: `https://quaternius.com/packs/modularcharacteroutfitsfantasy.html`.
- Use only vanilla JS, Three.js 0.185, and Vite as fixed in `package.json:10` through `package.json:20`.
- Preserve deterministic gameplay: `docs/reboot/runtime-contracts.md:9` through `docs/reboot/runtime-contracts.md:12`.
- Preserve save/report contracts: `docs/reboot/runtime-contracts.md:18` through `docs/reboot/runtime-contracts.md:25`.
- Preserve console-error and missing-asset release blockers: `docs/reboot/runtime-contracts.md:27` through `docs/reboot/runtime-contracts.md:32`.
- Preserve content safety and accessibility rules at `docs/reboot/content-safety.md:21` through `docs/reboot/content-safety.md:38` and `docs/reboot/content-safety.md:60` through `docs/reboot/content-safety.md:62`.
- Keep performance inside `docs/reboot/performance-budgets.md:53` through `docs/reboot/performance-budgets.md:64`; mobile quality must keep cues, subtitles, and touch input per `docs/reboot/performance-budgets.md:66` through `docs/reboot/performance-budgets.md:72`.
- Respect dirty user-owned `.omo/evidence/*`; write only new evidence under `.omo/evidence/h17-loop-*` and `.omo/evidence/h17-five-loop-*`.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Do not add frameworks, TypeScript, build tooling, new render targets, shadows, or always-on extra lights.
- Do not use `Math.random` in gameplay/rendered variability.
- Do not rewrite canon, add a new chapter, rename H-17, or restore the old six-chapter campaign.
- Do not make DOT an evil AI, Haru a passive rescued target, Yoonseo a monster, or the player an innocent amnesiac.
- Do not solve character identity by only changing tint, emissive color, labels, or UI text.
- Do not obscure the scene with text cards; visual identity must be visible in the 3D play area.
- Do not add personal names, real school names, emails, phone numbers, or free text collection.
- Do not remove or reduce existing tests.
- Do not overwrite existing `.omo/evidence/task-*` files.
- Do not import additional outfit packs beyond already licensed Quaternius packs; if a hair import cannot be verified as CC0 from the local Universal Base Characters ZIP, skip that file and use procedural mesh hair/accessory instead.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD + Node `node:test` and Playwright real-browser scenarios.
- QA policy: every task has agent-executed scenarios.
- Evidence: `.omo/evidence/h17-loop-<N>-<slug>.<ext>`
- Required final commands:
  - `npm test`
  - `npm run build`
  - `npm run smoke`
  - `npm run slice:gate -- .omo/evidence/h17-five-loop-slice-manifest.json`
  - `npx playwright test --config=playwright.config.js tests/reboot-e2e/h17-polish.spec.js`
- Required browser matrix:
  - Desktop `1180x820`, reduced motion, sound off, `testHook=h17`, console errors `0`.
  - Mobile `390x844`, reduced motion, sound off, touch controls visible/playable, console errors `0`.
- Required visual review checks:
  - Characters identifiable in live gameplay camera by face/hair/outfit/silhouette.
  - HUD/radio/result text does not overlap controls at desktop or mobile.
  - Route/campaign/finale scenes no longer read as flat planes with identical silhouettes.
  - `data-p95-frame-ms`, `data-draw-calls`, `data-triangles`, `data-light-count`, `data-dpr` satisfy budgets exposed by `src/reboot/render/schoolSceneHud.js:68` through `src/reboot/render/schoolSceneHud.js:75`.

## Execution strategy
### Parallel execution waves
> Target 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks to maximize parallelism.

One-worker exception: the caller allowed only one implementation worker after this plan. Execute all five loops serially; do not spawn extra implementation agents.

Wave 1 (no dependencies):
- Task 1: Loop 1 - Character identity repair

Wave 2 (after Wave 1):
- Task 2: Loop 2 - Story/HUD readability and character arc delivery depends [1]

Wave 3 (after Wave 2):
- Task 3: Loop 3 - Chapter 1 school environment dressing depends [1, 2]

Wave 4 (after Wave 3):
- Task 4: Loop 4 - Campaign/finale scene differentiation depends [1, 3]

Wave 5 (after Wave 4):
- Task 5: Loop 5 - Mobile, accessibility, licenses, and regression gate hardening depends [1, 2, 3, 4]

Critical path: Task 1 -> Task 2 -> Task 3 -> Task 4 -> Task 5

### Dependency matrix
| Task | Depends on | Blocks | Can parallelize with |
|------|------------|--------|----------------------|
| 1    | none       | 2, 3, 4, 5 | none - one worker and all later visual review depends on cast identity |
| 2    | 1          | 3, 5   | none - story readability informs environment labels and QA text |
| 3    | 1, 2       | 4, 5   | none - shared route dressing pattern feeds campaign scenes |
| 4    | 1, 3       | 5      | none - campaign visuals use cast and route decoration patterns |
| 5    | 1, 2, 3, 4 | final verification | none - final gate aggregates all prior evidence |

### One-worker file ownership
- Single implementation worker owns all implementation and test edits for this plan.
- No other implementation agent edits files. The final reviewer is read-only.
- Expected touched files:
  - Character/cast: `src/reboot/characters/catalog.js`, `src/reboot/characters/factory.js`, `src/reboot/characters/cast.js`, `public/assets/reboot/characters/base/*`, `public/reboot-assets.json`, `ASSET_LICENSES.md`, `tests/reboot-characters.test.js`.
  - Story/HUD: `src/reboot/content/story/chapter1.js`, `src/reboot/content/chapters/catalog.js`, `src/reboot/render/schoolSceneHud.js`, `src/reboot/render/campaignChapterScene.js`, `src/reboot/render/finalBroadcastPreviewScene.js`, `reboot.html`, `tests/reboot-story.test.js`, `tests/reboot-story-director.test.js`, `tests/reboot-campaign-chapters.test.js`.
  - Environment: `src/reboot/render/schoolRoute.js`, `src/reboot/content/levels/chapter1.js`, `src/reboot/content/levels/chapter2.js`, `src/reboot/content/levels/chapter3.js`, `src/reboot/content/levels/chapter4.js`, `src/reboot/content/levels/chapter5.js`, `tests/reboot-route-render.test.js`.
  - Campaign/finale QA: `src/reboot/render/dualSchoolPreviewScene.js`, `src/reboot/render/campaignChapterScene.js`, `src/reboot/render/finalBroadcastPreviewScene.js`, `tests/reboot-production-campaign.test.js`, `tests/reboot-e2e/h17-polish.spec.js`.
  - Final gates: `tests/reboot-e2e/h17-polish.spec.js`, `src/reboot/slice/gate.js` only if current manifest schema is insufficient, `.omo/evidence/h17-five-loop-slice-manifest.json`.

## Todos
> Implementation + Test = ONE task. Never separate.
> Every task MUST have: References + Acceptance Criteria + QA Scenarios + Commit.

- [ ] 1. Loop 1 - Character Identity Repair

  What to do: Baseline the current cast at desktop and mobile, then add a failing-first character identity contract. Replace the main-cast Ranger-clone surface with real 3D identity: player, Haru, and Yoonseo must use visible face/hair and different outfit/accessory silhouettes; DOT must read as a small audit AI companion/drone rather than another hooded humanoid. Use the already licensed Quaternius base-character local ZIP hair subset for rigged hair (`Hair_Buns`, `Hair_Long`, `Hair_SimpleParted`, `Hair_Buzzed`/`Hair_BuzzedFemale`, `Hair_Beard`) only after confirming file names and CC0 origin; update `public/reboot-assets.json` and `ASSET_LICENSES.md` for every imported runtime file. Change material preparation so base color/normal/roughness texture detail is preserved; role accents may be subtle overlays or targeted accessory/emissive parts, not a 78% global material lerp. Add debug metadata that lets tests assert each main character has distinct `body`, `outfit`, `hair`, `accessory/silhouette`, and `kind` without relying on screenshots alone.
  Must NOT do: Do not merely reduce tint strength. Do not add paid assets. Do not add shadows or new always-on lights. Do not change combat hitboxes or story state. Do not make DOT a villain or a generic mascot.

  Baseline characterization: Capture current `qa-tutorial` and `qa-arena` desktop/mobile screenshots before code changes and save them as `.omo/evidence/h17-loop-1-baseline-desktop.png` and `.omo/evidence/h17-loop-1-baseline-mobile.png`; record current roster/factory findings in `.omo/evidence/h17-loop-1-baseline.txt`.
  Failing-first test/repro: Add the identity/texture-preservation assertions first and capture the failing command output in `.omo/evidence/h17-loop-1-red.txt`.
  Minimal implementation scope: Limit code changes to character profile metadata, material preparation, DOT/accessory creation, runtime hair asset registration, and the focused tests/QA spec.
  Exit criteria: Focused character tests, full `npm test`, desktop/mobile screenshots, license/asset checks, and cleanup receipt all pass/exist.

  Parallelization: Can parallel: NO | Wave 1 | Blocks: [2, 3, 4, 5] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `src/reboot/characters/factory.js:18` - material preparation entry point to replace with texture-preserving role accents.
  - Pattern:  `src/reboot/characters/factory.js:28` - current 78% tint flattening to remove or restrict to accessory-only parts.
  - Pattern:  `src/reboot/characters/factory.js:29` - current uniform emissive block to replace with material-aware emissive.
  - Pattern:  `src/reboot/characters/factory.js:84` - character creation boundary where procedural DOT and accessory attachments can be selected by profile.
  - Pattern:  `src/reboot/characters/catalog.js:51` - `createProfile` contract to extend with identity metadata.
  - Pattern:  `src/reboot/characters/catalog.js:65` - `player` currently Ranger.
  - Pattern:  `src/reboot/characters/catalog.js:66` - `dot` currently Ranger.
  - Pattern:  `src/reboot/characters/catalog.js:67` - `haru` currently Ranger.
  - Pattern:  `src/reboot/characters/catalog.js:68` - `yoonseo` currently Ranger.
  - Pattern:  `src/reboot/characters/cast.js:5` - school cast positions for live-camera identity comparison.
  - Pattern:  `src/reboot/camera/framing.js:42` - default camera distance makes subtle palette differences insufficient.
  - Pattern:  `src/reboot/render/schoolSceneCamera.js:56` - combat camera pulls back; identity must survive this view.
  - Test:     `tests/reboot-characters.test.js:30` - existing roster/asset contract to expand.
  - Test:     `tests/reboot-characters.test.js:81` - existing license and local-asset test to update with imported hair.
  - Test:     `tests/reboot-e2e/reboot.spec.js:20` - fixture open helper waits for `data-characters`.
  - Asset:    `public/reboot-assets.json:1` - service-worker/runtime asset manifest to update for imported hair files.
  - License:  `ASSET_LICENSES.md:8` - Universal Base Characters provenance row to update if hair glTF/BIN/texture files are added.
  - External: `https://quaternius.com/packs/universalbasecharacters.html` - official CC0/glTF/hairstyle source.
  - External: `https://threejs.org/docs/#api/en/materials/MeshStandardMaterial` - material color/map/emissive behavior reference.

  Acceptance criteria (agent-executable only):
  - [ ] Add a red test in `tests/reboot-characters.test.js` that fails on the current code because `player`, `dot`, `haru`, and `yoonseo` are not identifiable by distinct face/hair/outfit/silhouette metadata; capture `node --test tests/reboot-characters.test.js` output in `.omo/evidence/h17-loop-1-red.txt`.
  - [ ] Add or update tests proving no main-cast non-skin material is globally lerped toward a single tint at `0.78`, and hair/eye/base texture maps survive `factory.create()`.
  - [ ] `node --test tests/reboot-characters.test.js` passes after implementation.
  - [ ] `npm test` passes after the loop.
  - [ ] Every newly imported runtime asset path exists, is listed in `public/reboot-assets.json`, and is covered by a precise `ASSET_LICENSES.md` row.
  - [ ] Browser screenshots prove all four school-cast roles are visually distinct in live camera, not only in a close-up debug page.
  - [ ] Cleanup receipt `.omo/evidence/h17-loop-1-cleanup.txt` exists and records `git diff --check`, touched files, added asset paths, and character debug identity summary.

  QA scenarios (MANDATORY - task incomplete without these):
  > Use Playwright real Chrome. If Chrome channel launch fails, install the repo browser with `npm run browser:install`, use bundled Chromium, and record the fallback reason in the evidence text.
  ```
  Scenario: live desktop cast identity
    Tool:     playwright(real Chrome)
    Steps:    Run `npx playwright test --config=playwright.config.js tests/reboot-e2e/h17-polish.spec.js --grep "@loop1-desktop"`; the spec opens `/reboot.html?testHook=h17&tools=hidden&motion=reduced&sound=off&sw=off&fixture=qa-tutorial`, waits for `[data-reboot-canvas][data-characters="ready"]`, captures a screenshot, and reads `window.__ethicsReboot.getSceneDebugState().characters`.
    Expected: Screenshot shows player, DOT, Haru, and Yoonseo with distinct 3D silhouette/face/hair/outfit/accessory; debug state reports no character errors and all identity ids.
    Evidence: .omo/evidence/h17-loop-1-characters-desktop.png

  Scenario: mobile combat-camera identity edge
    Tool:     playwright(real Chrome)
    Steps:    Run `npx playwright test --config=playwright.config.js tests/reboot-e2e/h17-polish.spec.js --grep "@loop1-mobile"`; set viewport `390x844`, open `/reboot.html?testHook=h17&tools=hidden&motion=reduced&sound=off&sw=off&quality=low&fixture=qa-arena&viewport=portrait`, wait for `data-characters="ready"`, then screenshot after camera settles.
    Expected: Character identity remains visible, `data-dpr` is `1`, `data-light-count` is `<=4`, console error array is empty.
    Evidence: .omo/evidence/h17-loop-1-characters-mobile.png
  ```

  Commit: YES | Message: `feat(characters): make h17 cast visually identifiable` | Files: [`src/reboot/characters/catalog.js`, `src/reboot/characters/factory.js`, `src/reboot/characters/cast.js`, `public/assets/reboot/characters/base/*`, `public/reboot-assets.json`, `ASSET_LICENSES.md`, `tests/reboot-characters.test.js`, `tests/reboot-e2e/h17-polish.spec.js`]

- [ ] 2. Loop 2 - Story, Usability, and Readability Pass

  What to do: Baseline the current first-chapter story/HUD flow, then add failing-first tests for readable arc delivery without spoilers. Improve the first 10 minutes so the player understands who is present and why actions matter: short radio lines, objective text, feedback prompts, and result summaries must reinforce Haru agency, DOT's helpful-but-complicit role, the player's responsibility, and Yoonseo's later policy role without rewriting canon. Make HUD/radio/result text readable on desktop and mobile: keep lines short, non-overlapping, and visible under reduced motion. Add small positive feedback for successful TRACE/REFLECT/SECURE events through existing feedback prompts or HUD chips, not random rewards.
  Must NOT do: Do not reveal `PLAYER-ID` before the boss record opens. Do not add moral scoring, correct/wrong labels, or long exposition modals. Do not require stopping movement to read story. Do not alter save schema except compatible text metadata if tests prove it is needed.

  Baseline characterization: Capture current radio/objective/result flow screenshots and transcript state in `.omo/evidence/h17-loop-2-baseline-desktop.png`, `.omo/evidence/h17-loop-2-baseline-mobile.png`, and `.omo/evidence/h17-loop-2-baseline.txt`.
  Failing-first test/repro: Add missing role-cue/readability assertions first and capture failing output in `.omo/evidence/h17-loop-2-red.txt`.
  Minimal implementation scope: Limit edits to short authored text, HUD/result binding, reboot inline CSS for text fit, and focused tests.
  Exit criteria: Focused story/campaign tests, full `npm test`, desktop/mobile layout screenshots, and cleanup receipt all pass/exist.

  Parallelization: Can parallel: NO | Wave 2 | Blocks: [3, 5] | Blocked by: [1]

  References (executor has NO interview context - be exhaustive):
  - Canon:    `docs/reboot/story-bible.md:3` - story should be delivered through play and results.
  - Canon:    `docs/reboot/story-bible.md:13` - player responsibility contract.
  - Canon:    `docs/reboot/story-bible.md:14` - Haru is active and alive.
  - Canon:    `docs/reboot/story-bible.md:15` - DOT helps but executed deletion.
  - Canon:    `docs/reboot/story-bible.md:17` - Yoonseo has reasons and responsibility.
  - Canon:    `docs/reboot/story-bible.md:82` - dialogue must be short and concrete.
  - Pattern:  `src/reboot/content/story/chapter1.js:6` - radio budget limits.
  - Pattern:  `src/reboot/content/story/chapter1.js:19` - chapter-one beats array.
  - Pattern:  `src/reboot/content/story/chapter1.js:124` - current PLAYER-ID reveal timing.
  - Pattern:  `src/reboot/content/chapters/catalog.js:43` - chapter 2 reversal.
  - Pattern:  `src/reboot/content/chapters/catalog.js:87` - chapter 3 DOT reversal.
  - Pattern:  `src/reboot/content/chapters/catalog.js:133` - chapter 4 Yoonseo/player linked approval.
  - Pattern:  `src/reboot/content/chapters/catalog.js:178` - chapter 5 responsibility-chain reversal.
  - Pattern:  `src/reboot/render/schoolSceneHud.js:43` - objective text update point.
  - Pattern:  `src/reboot/render/schoolSceneHud.js:47` - radio subtitle visibility.
  - Pattern:  `src/reboot/render/schoolSceneHud.js:50` - feedback prompt rendering.
  - Pattern:  `reboot.html:14` through `reboot.html:27` - HUD/radio/feedback layout.
  - Pattern:  `reboot.html:81` through `reboot.html:89` - objective/radio/result DOM.
  - Test:     `tests/reboot-story.test.js:27` - story validation boundary.
  - Test:     `tests/reboot-story.test.js:137` - no early signature reveal.
  - Test:     `tests/reboot-story-director.test.js:53` - radio advances without blocking movement.
  - Test:     `tests/reboot-e2e/slice.spec.js:39` - desktop secure route screenshot pattern.
  - Test:     `tests/reboot-e2e/slice.spec.js:62` - touch purge route screenshot pattern.

  Acceptance criteria (agent-executable only):
  - [ ] Add a red test proving chapter arc text currently lacks at least one explicit non-spoiler role cue for Haru, DOT, player responsibility, or Yoonseo; capture `node --test tests/reboot-story.test.js tests/reboot-story-director.test.js tests/reboot-campaign-chapters.test.js` output in `.omo/evidence/h17-loop-2-red.txt`.
  - [ ] `node --test tests/reboot-story.test.js tests/reboot-story-director.test.js tests/reboot-campaign-chapters.test.js` passes after implementation.
  - [ ] Existing spoiler gate still passes: no `PLAYER-ID` or `플레이어의 학생 ID` appears before `approval-record-opened`.
  - [ ] Browser evidence proves no HUD/radio/result overlap at desktop `1180x820` and mobile `390x844`.
  - [ ] `npm test` passes after the loop.
  - [ ] Cleanup receipt `.omo/evidence/h17-loop-2-cleanup.txt` exists and records text budget checks, changed story beats, and `git diff --check`.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: desktop story readability and positive action feedback
    Tool:     playwright(real Chrome)
    Steps:    Run `npx playwright test --config=playwright.config.js tests/reboot-e2e/h17-polish.spec.js --grep "@loop2-desktop"`; open `/reboot.html?testHook=h17&tools=hidden&motion=reduced&sound=off&sw=off&fixture=qa-arena`, press `e`, `k`, and `j`, then inspect `[data-radio-subtitle]`, `[data-feedback-prompts]`, `[data-route-objective]`, and screenshot the HUD.
    Expected: Objective/radio/feedback are non-empty when expected, do not overlap, and mention action consequences without moral scoring; console errors `0`.
    Evidence: .omo/evidence/h17-loop-2-story-desktop.png

  Scenario: mobile story layout edge
    Tool:     playwright(real Chrome)
    Steps:    Run `npx playwright test --config=playwright.config.js tests/reboot-e2e/h17-polish.spec.js --grep "@loop2-mobile"`; set viewport `390x844`, open `/reboot.html?testHook=h17&tools=hidden&motion=reduced&sound=off&sw=off&quality=low&fixture=qa-consequence-secure&viewport=portrait`, wait for result/radio state, screenshot full page.
    Expected: Radio/result text stays above touch controls or hides safely, all visible text fits its container, touch buttons remain tappable, console errors `0`.
    Evidence: .omo/evidence/h17-loop-2-story-mobile.png
  ```

  Commit: YES | Message: `feat(story): clarify h17 arcs during play` | Files: [`src/reboot/content/story/chapter1.js`, `src/reboot/content/chapters/catalog.js`, `src/reboot/render/schoolSceneHud.js`, `src/reboot/render/campaignChapterScene.js`, `src/reboot/render/finalBroadcastPreviewScene.js`, `reboot.html`, `tests/reboot-story.test.js`, `tests/reboot-story-director.test.js`, `tests/reboot-campaign-chapters.test.js`, `tests/reboot-e2e/h17-polish.spec.js`]

- [ ] 3. Loop 3 - Chapter 1 School Environment Dressing

  What to do: Baseline the current chapter-one route screenshots showing flat navy boxes, then add failing-first route-render tests for segment-specific school dressing. Implement low-cost procedural school props in `createSchoolRoute` driven by existing `level.layers.visual.kind`: classroom record terminal/desks, collapsing corridor lockers/emergency signs, first-arena projector/source grid, memory terminal, scanner beacons, and gym scoreboard/broadcast door. Keep collision flat and data-owned. Reuse geometries/materials through `createDisposableRegistry`; prefer instanced meshes. No new external art is needed for this loop.
  Must NOT do: Do not change navigation/collision bounds, add stairs/ramps, add shadows, exceed light budget, or add high-poly decorative meshes. Do not introduce random prop placement.

  Baseline characterization: Capture current chapter-one route screenshots and route budget/debug state in `.omo/evidence/h17-loop-3-baseline-desktop.png`, `.omo/evidence/h17-loop-3-baseline-mobile.png`, and `.omo/evidence/h17-loop-3-baseline.json`.
  Failing-first test/repro: Add route decor/debug assertions first and capture failing output in `.omo/evidence/h17-loop-3-red.txt`.
  Minimal implementation scope: Limit edits to procedural route decoration, deterministic debug/budget reporting, and route tests.
  Exit criteria: Focused route tests, full `npm test`, desktop/mobile route screenshots, route budget receipt, and cleanup receipt all pass/exist.

  Parallelization: Can parallel: NO | Wave 3 | Blocks: [4, 5] | Blocked by: [1, 2]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `src/reboot/render/schoolRoute.js:21` - existing instanced box helper.
  - Pattern:  `src/reboot/render/schoolRoute.js:49` - route renderer entry point.
  - Pattern:  `src/reboot/render/schoolRoute.js:67` - current flat floor/wall materials.
  - Pattern:  `src/reboot/render/schoolRoute.js:111` - visual layer lookup by segment.
  - Pattern:  `src/reboot/render/schoolRoute.js:136` - current five instanced meshes.
  - Pattern:  `src/reboot/render/schoolRoute.js:142` - light limit handling to preserve.
  - Pattern:  `src/reboot/render/schoolRoute.js:181` - budget calculation to expand.
  - Data:     `src/reboot/content/levels/chapter1.js:80` through `src/reboot/content/levels/chapter1.js:87` - visual kind records.
  - Data:     `src/reboot/content/levels/chapter1.js:103` through `src/reboot/content/levels/chapter1.js:110` - authored local lights.
  - Test:     `tests/reboot-route-render.test.js:13` - route debug state test.
  - Test:     `tests/reboot-route-render.test.js:33` - flat walkability guard.
  - Test:     `tests/reboot-route-render.test.js:57` - light guard.
  - Test:     `tests/reboot-route-render.test.js:77` - conservative budget guard.
  - Test:     `tests/reboot-route-render.test.js:117` - disposal idempotence.
  - Budget:   `docs/reboot/performance-budgets.md:55` through `docs/reboot/performance-budgets.md:60` - frame/draw/tri/light limits.

  Acceptance criteria (agent-executable only):
  - [ ] Add a red test in `tests/reboot-route-render.test.js` requiring each chapter-one visual kind to produce at least one named debug/decor object; capture `node --test tests/reboot-route-render.test.js` output in `.omo/evidence/h17-loop-3-red.txt`.
  - [ ] `node --test tests/reboot-route-render.test.js` passes after implementation.
  - [ ] Route debug state includes deterministic decoration ids, decoration budget, and segment mapping; two independent route builds still deep-equal.
  - [ ] Route budget remains `drawCalls <= 18`, `triangles <= 5000`, dynamic route lights unchanged by default, and disposal remains idempotent.
  - [ ] Desktop and mobile screenshots show school-specific props in at least classroom, first arena, memory, and gym views.
  - [ ] `npm test` passes after the loop.
  - [ ] Cleanup receipt `.omo/evidence/h17-loop-3-cleanup.txt` exists and records route budget before/after, `git diff --check`, and proof no runtime asset files were added.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: desktop chapter-one environment identity
    Tool:     playwright(real Chrome)
    Steps:    Run `npx playwright test --config=playwright.config.js tests/reboot-e2e/h17-polish.spec.js --grep "@loop3-desktop"`; open fixtures `qa-tutorial`, `qa-arena`, and `boss-secure` at `1180x820`, wait for `data-characters="ready"`, collect route debug state, and capture screenshots.
    Expected: Each captured segment contains named procedural school props, `data-draw-calls <= 250`, `data-triangles <= 150000`, `data-light-count <= 4`, console errors `0`.
    Evidence: .omo/evidence/h17-loop-3-school-desktop.png

  Scenario: mobile low-quality environment readability
    Tool:     playwright(real Chrome)
    Steps:    Run `npx playwright test --config=playwright.config.js tests/reboot-e2e/h17-polish.spec.js --grep "@loop3-mobile"`; set viewport `390x844`, open `/reboot.html?testHook=h17&tools=hidden&motion=reduced&sound=off&sw=off&quality=low&fixture=qa-tutorial&viewport=portrait`, capture screenshot and metrics.
    Expected: Environment props remain readable but do not cover player, touch controls, or objective; `data-dpr=1`, `data-light-count <=4`, console errors `0`.
    Evidence: .omo/evidence/h17-loop-3-school-mobile.png
  ```

  Commit: YES | Message: `feat(environment): dress h17 school route procedurally` | Files: [`src/reboot/render/schoolRoute.js`, `src/reboot/content/levels/chapter1.js`, `tests/reboot-route-render.test.js`, `tests/reboot-e2e/h17-polish.spec.js`]

- [ ] 4. Loop 4 - Campaign and Finale Scene Differentiation

  What to do: Baseline chapter 2-5/campaign preview screenshots, then add failing-first tests proving later scenes are currently too samey. Use the Loop 1 cast and Loop 3 route/decor patterns to give each real-player surface a distinct read: chapter 2 Copycat/share-chain stage, chapter 3 dual-school comfort/verified contrast with mirrored physical props, chapter 4 approval queue/control-room identity with Yoonseo visible, and chapter 5 broadcast booth with Haru/DOT/LUMEN silhouettes separated. Improve camera/staging only as much as needed for readability. Keep scene code deterministic and resource-owned.
  Must NOT do: Do not implement full new gameplay systems, add a sixth chapter, or replace current campaign progression. Do not hide visuals behind result cards. Do not add new lights beyond existing scene light counts unless another light is removed.

  Baseline characterization: Capture current chapter 2, dual-school, chapter 4, and finale screenshots/debug state in `.omo/evidence/h17-loop-4-baseline-desktop.png`, `.omo/evidence/h17-loop-4-baseline-mobile.png`, and `.omo/evidence/h17-loop-4-baseline.json`.
  Failing-first test/repro: Add scene-distinction/debug assertions first and capture failing output in `.omo/evidence/h17-loop-4-red.txt`.
  Minimal implementation scope: Limit edits to deterministic campaign/finale staging, procedural decor reuse, scene debug state, and focused tests.
  Exit criteria: Focused production/campaign tests, full `npm test`, desktop/mobile campaign screenshots, budget/debug cleanup receipt all pass/exist.

  Parallelization: Can parallel: NO | Wave 4 | Blocks: [5] | Blocked by: [1, 3]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `src/reboot/render/campaignChapterScene.js:13` through `src/reboot/render/campaignChapterScene.js:17` - chapters 2-4 configs and cast.
  - Pattern:  `src/reboot/render/campaignChapterScene.js:31` through `src/reboot/render/campaignChapterScene.js:48` - current fixed camera, ring, and lights.
  - Pattern:  `src/reboot/render/campaignChapterScene.js:74` - campaign presentation sync point.
  - Pattern:  `src/reboot/render/dualSchoolPreviewScene.js:10` through `src/reboot/render/dualSchoolPreviewScene.js:14` - current dual-school cast.
  - Pattern:  `src/reboot/render/dualSchoolPreviewScene.js:34` through `src/reboot/render/dualSchoolPreviewScene.js:56` - current flat half-floor presentation.
  - Pattern:  `src/reboot/render/finalBroadcastPreviewScene.js:12` through `src/reboot/render/finalBroadcastPreviewScene.js:17` - finale cast.
  - Pattern:  `src/reboot/render/finalBroadcastPreviewScene.js:37` through `src/reboot/render/finalBroadcastPreviewScene.js:54` - current route/ring/lights.
  - Pattern:  `src/reboot/render/finalBroadcastPreviewScene.js:84` through `src/reboot/render/finalBroadcastPreviewScene.js:101` - finale result card binding.
  - Routing:  `src/reboot/entry.js:81` through `src/reboot/entry.js:100` - production and QA scene registry.
  - Test:     `tests/reboot-production-campaign.test.js:10` - production scene routing.
  - Test:     `tests/reboot-production-campaign.test.js:40` - deterministic campaign adapters.
  - Test:     `tests/reboot-campaign-chapters.test.js:50` - chapter data distinction.
  - Test:     `tests/reboot-e2e/campaign.spec.js` - existing campaign browser coverage.
  - Canon:    `docs/reboot/story-bible.md:21` through `docs/reboot/story-bible.md:25` - chapter-by-chapter reveals.

  Acceptance criteria (agent-executable only):
  - [ ] Add a red test in `tests/reboot-production-campaign.test.js` or `tests/reboot-campaign-chapters.test.js` requiring distinct scene/decor debug ids for chapters 2, 3, 4, and finale; capture output in `.omo/evidence/h17-loop-4-red.txt`.
  - [ ] `node --test tests/reboot-production-campaign.test.js tests/reboot-campaign-chapters.test.js` passes after implementation.
  - [ ] Browser evidence captures chapter 2, dual-school chapter 3, chapter 4, and final broadcast with distinct 3D visual grammar and separated character silhouettes.
  - [ ] Campaign/finale scene debug state exposes deterministic decoration ids and no character load errors.
  - [ ] `npm test` passes after the loop.
  - [ ] Cleanup receipt `.omo/evidence/h17-loop-4-cleanup.txt` exists and records scene budget metrics, character ids, route/decor ids, and `git diff --check`.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: desktop campaign scene differentiation
    Tool:     playwright(real Chrome)
    Steps:    Run `npx playwright test --config=playwright.config.js tests/reboot-e2e/h17-polish.spec.js --grep "@loop4-desktop"`; open H-17 QA fixtures for `campaign-chapter-2`, dual-school comfort/verified, `campaign-chapter-4`, and `final-broadcast`, wait for `data-characters="ready"` or the scene-specific ready marker, and capture screenshots.
    Expected: Chapter 2, chapter 3, chapter 4, and finale screenshots are visually distinct by environment and cast staging; console errors `0`; metrics stay within budgets.
    Evidence: .omo/evidence/h17-loop-4-campaign-desktop.png

  Scenario: mobile finale readability edge
    Tool:     playwright(real Chrome)
    Steps:    Run `npx playwright test --config=playwright.config.js tests/reboot-e2e/h17-polish.spec.js --grep "@loop4-mobile"`; set viewport `390x844`, open final-broadcast QA fixture with a resolved and unresolved ending, drive actions `reflect`, `trace`, `space`, `j`, then screenshot.
    Expected: Haru, DOT, and LUMEN remain visually separated, result card text fits, touch controls do not overlap required action buttons, console errors `0`.
    Evidence: .omo/evidence/h17-loop-4-finale-mobile.png
  ```

  Commit: YES | Message: `feat(campaign): distinguish h17 chapter scenes` | Files: [`src/reboot/render/campaignChapterScene.js`, `src/reboot/render/dualSchoolPreviewScene.js`, `src/reboot/render/finalBroadcastPreviewScene.js`, `src/reboot/content/levels/chapter2.js`, `src/reboot/content/levels/chapter3.js`, `src/reboot/content/levels/chapter4.js`, `src/reboot/content/levels/chapter5.js`, `tests/reboot-production-campaign.test.js`, `tests/reboot-campaign-chapters.test.js`, `tests/reboot-e2e/h17-polish.spec.js`]

- [ ] 5. Loop 5 - Mobile, Accessibility, Licenses, and Regression Gates

  What to do: Run a full baseline gate after Loops 1-4, then add any missing failing-first tests for mobile/accessibility/license regressions. Harden `tests/reboot-e2e/h17-polish.spec.js` into the final visual/performance evidence producer and write `.omo/evidence/h17-five-loop-slice-manifest.json` matching `src/reboot/slice/gate.js`. Fix only the minimum remaining layout/accessibility/license gaps: canvas labels, aria-live result/radio semantics, focus visibility, touch-control overlap, reduced-motion behavior, asset manifest, and license rows. End with all final gate commands passing.
  Must NOT do: Do not add broad redesigns or new features. Do not weaken slice gate thresholds. Do not delete old tests. Do not edit legacy `src/main.js`, learning-report logic, progress schema, or print CSS unless a regression from this work proves it necessary.

  Baseline characterization: Capture the post-Loop-4 full gate state in `.omo/evidence/h17-loop-5-baseline.txt` and screenshots `.omo/evidence/h17-loop-5-baseline-desktop.png` / `.omo/evidence/h17-loop-5-baseline-mobile.png`.
  Failing-first test/repro: Add a failing assertion for any remaining mobile/a11y/license/gate gap; if none exists, record the no-gap baseline in `.omo/evidence/h17-loop-5-red-or-baseline.txt`.
  Minimal implementation scope: Limit edits to final Playwright evidence production, manifest/gate compatibility, minimal reboot layout/a11y fixes, and license/asset manifest corrections.
  Exit criteria: Final Playwright spec, `npm test`, `npm run build`, `npm run smoke`, `npm run slice:gate -- .omo/evidence/h17-five-loop-slice-manifest.json`, license check, and cleanup receipt all pass/exist.

  Parallelization: Can parallel: NO | Wave 5 | Blocks: [final verification] | Blocked by: [1, 2, 3, 4]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `reboot.html:13` - full viewport canvas sizing.
  - Pattern:  `reboot.html:21` through `reboot.html:22` - reboot button/focus styles.
  - Pattern:  `reboot.html:28` through `reboot.html:44` - touch controls and mobile media query.
  - Pattern:  `reboot.html:64` - canvas accessibility label.
  - Pattern:  `reboot.html:83` through `reboot.html:85` - radio/feedback/result semantics.
  - Pattern:  `src/reboot/input/touchControls.js:47` - attach/detach lifecycle.
  - Pattern:  `src/reboot/settings/quality.js:1` through `src/reboot/settings/quality.js:15` - DPR cap and quality profiles.
  - Pattern:  `src/reboot/render/renderer.js:4` through `src/reboot/render/renderer.js:16` - renderer quality application.
  - Pattern:  `src/reboot/slice/gate.js:1` through `src/reboot/slice/gate.js:3` - required gates.
  - Pattern:  `src/reboot/slice/gate.js:19` through `src/reboot/slice/gate.js:58` - manifest evaluation.
  - Script:   `scripts/verify-reboot-slice.mjs:5` - manifest argument path.
  - Script:   `package.json:6` through `package.json:14` - required scripts.
  - Test:     `tests/reboot-e2e/reboot.spec.js:54` - performance dataset pattern.
  - Test:     `tests/reboot-e2e/slice.spec.js:39` through `tests/reboot-e2e/slice.spec.js:82` - secure desktop and purge touch patterns.
  - Test:     `tests/reboot-slice-gate.test.js:44` through `tests/reboot-slice-gate.test.js:63` - complete manifest shape.
  - Test:     `tests/reboot-slice-gate.test.js:100` - script contract.
  - License:  `ASSET_LICENSES.md:1` through `ASSET_LICENSES.md:11` - runtime asset provenance table.
  - License:  `ASSET_LICENSES.md:22` through `ASSET_LICENSES.md:27` - 3D asset policy.
  - Legacy guard: `docs/reboot/runtime-contracts.md:71` through `docs/reboot/runtime-contracts.md:107` - do not retire legacy tests without equivalent gates.

  Acceptance criteria (agent-executable only):
  - [ ] Add a red test or Playwright assertion for any remaining final gap found after Loops 1-4; if no final gap exists, capture the passing baseline and state "no extra production fix required" in `.omo/evidence/h17-loop-5-red-or-baseline.txt`.
  - [ ] `npx playwright test --config=playwright.config.js tests/reboot-e2e/h17-polish.spec.js` passes and writes all H-17 loop screenshots plus `.omo/evidence/h17-five-loop-slice-manifest.json`.
  - [ ] `npm test` passes.
  - [ ] `npm run build` passes.
  - [ ] `npm run smoke` passes.
  - [ ] `npm run slice:gate -- .omo/evidence/h17-five-loop-slice-manifest.json` passes.
  - [ ] Final manifest has both `secure` and `purge` runs, `desktop` and `touch` devices, `consoleErrors: 0`, all required gates true, `signatureRevealed: true`, distinct `reportId`s, and no P0/P1 blockers.
  - [ ] License check confirms every runtime file under `public/assets/reboot/characters/**` is listed in `public/reboot-assets.json` and covered by `ASSET_LICENSES.md`; generated procedural props require no external license row and this is stated in cleanup.
  - [ ] Cleanup receipt `.omo/evidence/h17-loop-5-cleanup.txt` exists and records final command results, manifest path, browser screenshots, and `git diff --check`.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: final desktop regression gate
    Tool:     playwright(real Chrome)
    Steps:    Run `npx playwright test --config=playwright.config.js tests/reboot-e2e/h17-polish.spec.js --grep "@final-desktop"`; the spec opens secure route, campaign scene, dual-school, and finale at `1180x820`, collects screenshots, console errors, canvas metrics, and writes the desktop run into `.omo/evidence/h17-five-loop-slice-manifest.json`.
    Expected: Console errors `0`, all visual gates true, `p95FrameMs <= 16.7` where real-browser measurement is stable or recorded with SwiftShader caveat plus separate budget dataset, draw calls `<=250`, triangles `<=150000`, lights `<=4`, DPR within cap.
    Evidence: .omo/evidence/h17-five-loop-desktop.png

  Scenario: final mobile touch/accessibility regression gate
    Tool:     playwright(real Chrome)
    Steps:    Run `npx playwright test --config=playwright.config.js tests/reboot-e2e/h17-polish.spec.js --grep "@final-mobile"`; set viewport `390x844`, open purge/touch route and finale, dispatch touch button actions using `[data-touch-action]`, verify focus-visible styles through keyboard tabbing, collect screenshots and metrics, and append the touch run to `.omo/evidence/h17-five-loop-slice-manifest.json`.
    Expected: Touch controls remain usable, no text/control overlap, aria-live regions have non-empty labels when visible, reduced-motion path avoids shake/flash dependence, console errors `0`, manifest passes `npm run slice:gate`.
    Evidence: .omo/evidence/h17-five-loop-mobile.png
  ```

  Commit: YES | Message: `test(reboot): gate h17 polish across devices` | Files: [`reboot.html`, `tests/reboot-e2e/h17-polish.spec.js`, `tests/reboot-slice-gate.test.js`, `src/reboot/slice/gate.js`, `public/reboot-assets.json`, `ASSET_LICENSES.md`, `.omo/evidence/h17-five-loop-slice-manifest.json`]

## Final verification wave (MANDATORY - after all implementation tasks)
> Runs in PARALLEL. ALL must APPROVE. Surface results to the caller and wait for an explicit "okay" before declaring complete.
> Agent budget note: use only one final reviewer agent for F1-F4; the implementation worker must provide evidence paths before reviewer starts.
- [ ] F1. Plan compliance audit - every task done, every acceptance criterion met, exactly five development/review loops completed, every cleanup receipt present.
- [ ] F2. Code quality review - diagnostics clean, idioms match vanilla JS/Three.js patterns, no dead code, no random gameplay paths, no resource leaks.
- [ ] F3. Real manual QA - every QA scenario executed with screenshots/videos/text evidence captured under the paths in this plan.
- [ ] F4. Scope fidelity - nothing extra shipped beyond Must-Have, no Must-NOT-Have introduced, canon and safety constraints preserved.

## Commit strategy
- One logical commit per loop, in loop order.
- Conventional Commits (`<type>(<scope>): <subject>` body + footer).
- Atomic: every commit builds and passes its loop's focused tests on its own.
- No "WIP" / "fix typo squash later" commits on the final branch - clean up before merge.
- Reference the plan file path in the final commit footer: `Plan: .omo/plans/h17-five-loop-character-story-polish.md`.
- Include existing project co-author footer only if the repo's active human workflow requires it; do not add model IDs.

## Success criteria
- All five loops are committed with evidence and cleanup receipts.
- Main cast is identifiable by face/hair/outfit/silhouette in desktop and mobile live camera.
- Story/HUD communicates canon character arcs and action consequences without spoilers, moral scoring, or text overlap.
- Chapter 1 route, campaign scenes, dual-school, and finale have distinct procedural 3D environments within budgets.
- Runtime assets are self-contained, licensed, and listed.
- `npm test`, `npm run build`, `npm run smoke`, `npm run slice:gate -- .omo/evidence/h17-five-loop-slice-manifest.json`, and `npx playwright test --config=playwright.config.js tests/reboot-e2e/h17-polish.spec.js` pass.
- Final reviewer approves F1-F4 and the caller explicitly says okay.
