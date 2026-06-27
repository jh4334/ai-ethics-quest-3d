# 09 Review Fixes

## Codex Reviewer findings addressed

### P2 — Restore down touch control
- File: `src/styles.css`
- Fix: expanded touch grid to 3 rows and placed `[data-touch="down"]` on row 3 instead of hiding it.
- Regression test: `tests/sourceRegression.test.js` checks the down control is not `display: none` and grid has 3 rows.

### P2 — Do not swallow dialog button activation keys
- File: `src/main.js`
- Fix: global Enter/Space/E interaction now skips native form controls/buttons so focused dialog buttons can activate with keyboard.
- Regression test: `tests/sourceRegression.test.js` checks the `isFormControl` guard.

### P2 — Disable final-core choices after success
- File: `src/main.js`
- Fix: after a correct final-core answer, all final-core choice buttons are disabled immediately.
- Regression test: `tests/sourceRegression.test.js` checks correct-result disabling logic.

## Verification after fixes
- `npm test`: pass, 11 tests.
- `npm run smoke`: pass.
- `node --check src/main.js`: pass.
- `node --check src/worldData.js`: pass.
- `npm run build`: pass.
