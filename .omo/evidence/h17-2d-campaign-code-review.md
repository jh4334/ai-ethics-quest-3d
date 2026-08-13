# Code review — H-17 2D campaign

Reviewed commit: `e2a2132fe972280736e5d15bc1c2e8fdbeb343e0` (full SHA), compared with `origin/main` at `344fdd7b8783563f04affc36045f96520b5ba086`.

## Verdict

- codeQualityStatus: BLOCK
- recommendation: REQUEST_CHANGES
- confidence: high

## Findings

### CRITICAL

None.

### HIGH

1. **v2 saves are not preserved; completed progress is downgraded to a new incomplete campaign.** `src/illustrated/campaignGame.js:33-43` converts every v2 save to an empty evidence/decision set, forces checkpoint `150`, and always sets `completed: false`, including `saved.completed === true`.  A direct runtime probe with a completed v2 save containing all four legacy evidence IDs produced v3 `{ chapterIndex: 5, checkpointX: 150, evidenceIds: [], decisions: {}, completed: false }`.  This loses saved accomplishments and violates the save migration requirement.  `tests/illustrated-campaign.test.js:33-50` only asserts an arbitrary chapter index and does not exercise completed v2 state, retained evidence, or the old checkpoint.

2. **Choices in chapters 1–5 are not consequential gameplay branches.** `src/illustrated/campaignGame.js:346-373` records the selected ID then sends either option through precisely the same unlocked chapter, reset runtime, checkpoint, and next chapter.  The only use of a choice outside the immediate result/report text is the chapter-six predicate at `src/illustrated/campaignGame.js:400-414`.  A direct probe of both chapter-one IDs (`protect-context`, `open-raw`) yielded identical serialized next-chapter state except `decisions['chapter-1']`.  Thus the campaign supplies two labels/cost strings, but no two consequential non-score choices per chapter as required.

3. **The commit contains identifying personal metadata despite the project’s zero-personal-information submission constraint.** Every commit in the submitted range, including the reviewed SHA, has author email `ouiking@email.com` and author name `백종환` (`git log --format='%H%x09%ae%x09%an' origin/main..e2a2132…`).  This will be exposed with a GitHub submission.  Rewrite the submitted commits with non-identifying author metadata before publication.

### MEDIUM

1. **The new 2D implementation is concentrated in oversized mixed-responsibility modules.** `src/illustrated/entry.js:1-598` mixes persistence, DOM orchestration, keyboard/touch input, Canvas drawing, dialogs, test hooks, and RAF scheduling; `src/illustrated/campaignGame.js:1-439` mixes migration, simulation, combat, progression, and reporting.  This violates the `remove-ai-slops` size/complexity perspective and makes future changes risky.  Split by real responsibilities (rendering, UI/persistence, simulation/migration) rather than creating generic utilities.

2. **The main browser evidence is non-representative and can pass without validating both decision paths or genuine traversal.** `scripts/verify-illustrated-six-chapter.mjs:45-55` mutates the game state through a test-only teleport; `:85` always clicks the first option.  It never validates any second option, no alternate ending, and no v2 migration.  The committed reports therefore demonstrate one scripted happy path only.  This is an implementation-coupled test hook, not sufficient proof of the required consequence branches.

3. **The offline pre-cache test is tautological and does not cover the real emitted image assets.** `tests/reboot-cache-tiers.test.js:7, 53, 92-104` gives the service worker synthetic HTML that directly contains one JavaScript asset.  In the production build, the three Canvas PNGs are referenced from the emitted entry JavaScript, not literal HTML attributes.  `public/sw.js:12-21` only scrapes entry HTML, so the test does not establish that a first offline session has the required raster assets.  Verify the built distribution’s actual offline first-load behavior (and cache the image URLs if that requirement is intended).

### LOW

1. `public/sw.js:70-72` silently swallows activation cleanup failures.  The offline fallback rationale is reasonable, but diagnostics (at least in a development/test mode) would make a cache-migration failure auditable.

## Evidence and validation

- Working tree was clean at review start and HEAD exactly matched the reviewed SHA.  `e2a2132` differs from `2abb2e8` only by four EOF blank-line deletions; `git diff --check origin/main...e2a2132` is clean.
- `npm.cmd test`: PASS, 526/526.
- `npm.cmd run build`: PASS.  Vite warns that the 681 kB Three.js bundle exceeds its 500 kB advisory threshold (pre-existing 3D rollback cost; not a new blocker for the 2D route).
- `npm.cmd run smoke`: PASS.
- The supplied `.omo/evidence/h17-2d-campaign` screenshots and JSON report were inspected but are not sufficient to override the findings above.  The committed summary predates this review and shows one first-option desktop/mobile path, zero console errors, and zero failed responses.
- `npm.cmd run qa:2d` was started after the preceding checks; it rewrote five tracked evidence files before completion/output could be observed.  Those local evidence mutations are not part of the reviewed SHA and must not be included in any submission commit.

## Skill-perspective check

Ran: yes.  `omo:remove-ai-slops` and `omo:programming` were read from the installed OMO skills before judging tests/maintainability.

- `remove-ai-slops`: violated by the oversized, multi-responsibility `entry.js` and `campaignGame.js`; also identifies the QA coverage gap rather than treating screenshot artifacts as behavior coverage.
- `programming`: violated by brittle/implementation-coupled browser verification (direct state mutation and always-first-option assertion) and insufficient boundary migration validation.  No untyped escape hatch applies to this vanilla JavaScript code.

## Required blockers before approval

1. Make v2 migration preserve a completed state and retain/meaningfully map prior evidence/checkpoints (or preserve it in a clearly documented, accessible legacy record), then add tests for complete and partial v2 saves.
2. Give both choices in every chapter an observable downstream consequence beyond local result/report copy; test both paths, including at least one downstream state/report/ending effect per choice.
3. Remove name/email personal data from the submitted commit history.
4. Replace the evidence test’s teleport/first-option-only proof with end-user input coverage of both choices and a built/offline asset-cache scenario.
