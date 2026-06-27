# 02 Agent Roles

## Hermes — state manager / deterministic QA / deployment control
- Maintains .orchestration docs, state.json, iteration_log.md.
- Runs exact commands: npm test, npm run build, node smoke tests, curl/HTTP checks, GitHub Actions/Pages status.
- Creates repo, commits, pushes, enables Pages, confirms deployed marker text.
- Does not make vague quality claims without evidence.

## Claude Code — read-only PM / art director / high-level reviewer
- Max 3 calls.
- Call 1: initial PM/UX/learning design and acceptance review.
- Call 2: mid-loop review only if material quality risk remains.
- Call 3: final readiness review only if useful.
- Source-code editing prohibited by default.

## Codex Builder — implementation engine
- Implements Three.js game, tests, docs, UI, and fixes failures.
- Uses TDD where possible: tests first for data/puzzle/progress logic.
- Writes builder report after each major pass.

## Codex Reviewer — independent Code Autopsy reviewer
- Separate from Builder.
- Reviews uncommitted/committed changes with Q1-Q12 rubric.
- Must include file:line, severity, evidence, and concrete fix for findings.
