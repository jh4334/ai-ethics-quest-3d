# 01 Acceptance Criteria

## Functional game criteria
- Three.js 3D scene renders in the browser without external API keys.
- Player can move around a compact island using keyboard controls.
- World includes at least 4 identifiable ethics zones: 개인정보, 편향, 저작권, 딥페이크.
- Game includes at least 4 NPC/prompt interactions or equivalent learning stations.
- Game includes at least 3 shrine-style puzzles/choices tied to ethics concepts.
- Game tracks progress and shows collected ethics fragments.
- Final AI Core mission unlocks after enough learning objectives are completed.
- UI includes mission panel, interaction prompts, progress, and class-use instructions.

## Educational criteria
- Fits a 2-class lesson: class 1 exploration/concepts, class 2 mission/discussion/reflection.
- Includes teacher guide, student activity sheet, and evaluation rubric in docs/.
- Ethics explanations must be age-appropriate for 초등 고학년.
- Avoid incorrect or oversimplified ethics claims.

## Technical criteria
- Static web app or Vite app deployable to GitHub Pages.
- No secrets, payment, student data, accounts, or backend storage.
- Automated tests cover world data integrity and ethics puzzle logic.
- Smoke test verifies DOM marker and script wiring.
- Build/test commands must pass before deployment.

## UX criteria
- Lightweight 3D; works on normal laptops and modern mobile browsers where possible.
- Clear learning objectives and visible next step.
- Zelda-inspired atmosphere without copyrighted assets or names.
- Keyboard controls documented on screen.

## Deployment criteria
- GitHub repository created under the user's GitHub account if auth is available.
- GitHub Pages URL serves latest marker text: `AI Ethics Quest 3D`.
- Public demo is allowed because there are no secrets, no student data, and no backend.
