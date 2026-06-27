The tests and build pass, but the patch still has concrete environment, pause-state, and mobile-layout issues that can break supported usage paths. These should be fixed before considering the changes correct.

Full review comments:

- [P2] Align Node engines with the locked Vite release — /private/tmp/ai-ethics-quest-3d/package.json:18-20
  On Node 20.0 through 20.18, this package advertises support via `"node": ">=20"`, but the locked `vite@8.1.0` requires `^20.19.0 || >=22.12.0`; users or CI with engine checks can install/run a declared-supported environment that Vite rejects. Raise this engine floor or pin Vite to a version compatible with the stated range.

- [P2] Preserve pause state when returning to a dialog — /private/tmp/ai-ethics-quest-3d/src/main.js:75-77
  When a dialog is open and the tab/app is backgrounded, this handler sets `game.paused` back to `false` as soon as the page becomes visible even though the dialog remains open. In that scenario movement keys or touch controls can move the player behind the modal; keep visibility pause separate or include the dialog/WebGL pause state before unpausing.

- [P2] Move the mobile status strip above touch controls — /private/tmp/ai-ethics-quest-3d/src/styles.css:399-403
  On coarse-pointer/mobile layouts, the touch controls are a 3-row grid at `bottom: 16px`, so placing the status strip at `bottom: 78px` puts progress/core status underneath the controls; because the controls have the higher z-index, part of the status UI is covered on mobile. Move the strip above the full control cluster or use a non-overlapping mobile layout.