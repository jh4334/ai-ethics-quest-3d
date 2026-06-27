The app builds and tests pass, but the patch introduces concrete interaction regressions in mobile touch navigation, keyboard dialog operation, and final mission completion feedback. These should be fixed before considering the changes correct.

Full review comments:

- [P2] Restore the down touch control — /private/tmp/ai-ethics-quest-3d/src/styles.css:382-384
  On coarse-pointer/mobile layouts the touch controls are the only advertised movement UI, but this rule hides `[data-touch="down"]` while `bindInput` still depends on that action to move the player toward positive Z. A touch-only student who moves to the northern zones cannot move back south/return to the center or southern zones, making the mobile path incomplete despite the touch UI.

- [P2] Do not swallow dialog button activation keys — /private/tmp/ai-ethics-quest-3d/src/main.js:626-629
  When a dialog choice or close button has focus, pressing Enter/Space bubbles to this global handler; it calls `preventDefault()` and then `interact()` immediately returns because the dialog is open. That cancels native button activation, so keyboard-only users can open dialogs but cannot answer shrine/core choices or close them with standard keys.

- [P2] Disable final-core choices after success — /private/tmp/ai-ethics-quest-3d/src/main.js:887-893
  After the correct final-core answer, this handler updates `aiCoreCompleted` but leaves all core choice buttons enabled until the dialog is reopened. In that same completed dialog, a student can click a wrong choice and replace the success message with incorrect feedback while the HUD says complete; the shrine flow disables siblings on a correct answer, so the final mission should do the same when `outcome.result?.correct` is true.