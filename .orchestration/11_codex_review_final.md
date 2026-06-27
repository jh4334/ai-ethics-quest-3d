The app builds and tests pass, and previous review items appear fixed, but the mobile interaction prompt is still obscured by the touch controls on supported coarse-pointer layouts.

Review comment:

- [P2] Move the mobile prompt above touch controls — /private/tmp/ai-ethics-quest-3d/src/styles.css:425-428
  On coarse-pointer/mobile layouts, the three-row touch-control cluster sits at `bottom: 16px` with a 146px height and higher z-index, while this override pins `.interaction-prompt` to `bottom: 12px`. On phone-sized screens the interaction prompt overlaps underneath the controls, so the `E: ...` cue for NPCs, shrines, and the core is obscured for touch users; place the prompt above or away from the control cluster.