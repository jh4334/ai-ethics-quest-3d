# Clone / visual fidelity review — H-17 2D campaign

Reviewed commit: `bac351ded96ba5f4281f7ea9b1a703c11a4b2599` (full SHA). The worktree was clean and matched this SHA at review time. The commit differs from `35dd22085151f07d94d094dbd2be4d320c7b41b6` only by a prior Markdown review artifact; the runtime, styles, and supplied screenshots are therefore the same revision as the requested visual-fix commit.

## Recommendation

`REQUEST_CHANGES`

## Evidence inspected

- `.omo/evidence/h17-2d-campaign/desktop-1440x900-title.png` — PNG signature, 1440×900.
- `.omo/evidence/h17-2d-campaign/desktop-1440x900-chapter-1.png` — PNG signature, 1440×900.
- `.omo/evidence/h17-2d-campaign/desktop-1440x900-chapter-6-result.png` — PNG signature, 1440×900.
- `.omo/evidence/h17-2d-campaign/desktop-1440x900-ending.png` — PNG signature, 1440×900.
- `.omo/evidence/h17-2d-campaign/mobile-390x844-{title,chapter-1,chapter-6-result,ending}.png` — PNG signature; 780×1688 because capture uses deviceScaleFactor 2 for the declared 390×844 CSS viewport.
- `.omo/evidence/h17-2d-campaign/{desktop-1440x900-report,mobile-390x844-report,summary}.json`.
- `.omo/evidence/h17-2d-campaign/reference-vs-desktop-chapter-1.png` — PNG signature, 2880×900, two 1440×900 panels.
- Reference `.omo/evidence/h17-six-chapter/p0/reference-chapter1-1440x900.png` — PNG signature, 1440×900; `docs/design/concepts/gameplay-screen-v3.webp` is the source used by the capture script.
- `src/illustrated/{entry.js,style.css,campaignContent.js}` and `scripts/verify-illustrated-six-chapter.mjs`.

The independent `visual-qa.mjs image-diff` run on the normalized 1440×900 reference and the current 1440×900 chapter-one capture returned `dimensionsMatch: true`, `alphaChannelIntact: true`, but `diffRatio: 1`, `similarityScore: 0`, and 64 materially different grid hotspots.

## Findings

### CRITICAL

None. The gameplay surface is live Canvas plus DOM controls, not a pasted full-screen screenshot: images are drawn during play in `src/illustrated/entry.js:128-162`, while title/HUD/panels are live DOM nodes updated by `entry.js:404-439`. CSS colors, spacing, radii, and control sizing are substantially tokenized in `src/illustrated/style.css:1-30`.

### HIGH

1. **[product] Desktop ending omits chapter 6 from the visible report.** The inspected `desktop-1440x900-ending.png` visibly stops after rows 1–5, although both report JSON files contain six chapters. This fails the explicit all-six-rows-visible requirement. The cause is the desktop `.report-list` `max-height: 170px` plus scrolling at `src/illustrated/style.css:568-573`; the runtime correctly appends all six rows at `src/illustrated/entry.js:427-435`, but the initial rendered state does not expose the final row. Capture the complete ending state with all six rows visible, not only a scrollable partial list.

2. **[product] Chapter 6 mobile HUD title remains truncated.** In `mobile-390x844-chapter-6-result.png`, the left HUD title reads `WHITEOUT/...` instead of the full `WHITEOUT/H-17`; its fixed sibling topic is legible, but the title requirement is not. The constrained mobile grid at `style.css:744-752, 919-922` combines with the inherited forced single-line ellipsis at `style.css:137-145`. This is a visible regression blocker, not merely a source-style issue.

3. **[product] Chapter 6 mobile result has an orphaned Korean final syllable.** `mobile-390x844-chapter-6-result.png` renders the decision as `개인정보를 가린 뒤 공개 심리를 연` / `다`, leaving `다` alone on line two. This violates the required CJK wrapping quality. The result heading inherits normal word breaking from `style.css:494-502`; the mobile rule changes only size (`style.css:976-980`) and does not prevent semantic fragmentation.

4. **[product] The supplied reference comparison is same-size but does not meet reference fidelity.** The side-by-side artifact is geometrically like-for-like (two 1440×900 images), and the target/current image-diff has matching dimensions and intact alpha. Its `0/100` similarity nevertheless corroborates direct inspection: every region differs—top HUD hierarchy, player/camera composition, character/evidence placement, prompt placement, and the game scene. No exception or accepted deviation establishes this as a non-pixel reference, so the requested reference-fidelity gate cannot approve it.

### MEDIUM

1. **[product] Mobile ending fits six rows only by reducing instructional text to 0.58rem (about 9.3 CSS px).** All six rows are present in `mobile-390x844-ending.png`, but the decision/consequence text is materially smaller than the surrounding UI and is not comfortably readable for the stated primary-school audience. The value is explicit at `src/illustrated/style.css:1007-1011`. Do not treat row presence alone as readability.

2. **[evidence] The verification script checks document horizontal overflow and button rectangles but does not assert that every ending row is in the visible viewport.** `scripts/verify-illustrated-six-chapter.mjs:168-181` confirms six report data rows and target dimensions, while its screenshots are viewport captures after the change at lines `90, 128, 147, 159`. Consequently a scroll-clipped ending passes the automated evidence path. Add a visible-row/ending-panel geometry assertion before treating the screenshot as proof.

### LOW

1. **[product] The current title/logline fix itself looks substantially improved.** In `mobile-390x844-title.png`, `사라진 학생 H-17` breaks between meaningful units and the logline breaks naturally into two lines; no clipped glyph, one-character orphan, or horizontal overflow was seen. Preserve this while fixing the remaining HUD/result text.

## Positive checks to preserve

- Desktop screenshots are exactly 1440×900, and the side-by-side comparison is exactly 2880×900; this corrects the prior full-page/viewport mismatch.
- Mobile capture maps to the declared 390×844 viewport at DPR 2, has no horizontal document overflow in the supplied reports, and touch controls measure at least 44×44 CSS px (the visible movement/action controls are 52×58).
- The chapter-six mission is two readable lines in the mobile HUD; it does not overlap health, rail, or scene.
- The 2D runtime is dynamic rather than an image substitute: `entry.js:68-89, 128-162` loads/draws assets and the UI panels/HUD are independently updated DOM.

## Blockers before approval

1. Make all six ending report rows simultaneously visible in the 1440×900 initial ending state, then capture it fresh.
2. Render the complete chapter-six HUD title at 390×844 without an ellipsis.
3. Reflow the chapter-six mobile result heading so Korean semantic units do not leave `다` alone.
4. Either bring the actual capture materially into the provided reference contract or explicitly establish and approve a non-pixel 2D deviation; then re-run a same-size comparison with a defensible diff result.

