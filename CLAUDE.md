# AI 윤리의 섬 3D — 작업 규칙

초등 5–6학년 AI 윤리 교육용 Three.js 오픈월드 게임 (교육자료 공모전 제출물, 3부작 중 2부).

## 기술 스택

- 바닐라 JS + Three.js 0.185 (Vite 빌드, GitHub Pages 배포). 프레임워크·TS 도입 금지.
- 순수 로직과 3D 표현을 분리: `src/dungeonPuzzles.js`(THREE 무의존, node 테스트 가능) ↔ `src/dungeon.js`(표현), `src/worldData.js`/`src/story.js`(데이터·상태 전이) ↔ `src/main.js`(씬·UI).
- 주석·문자열은 한국어, 기존 파일의 주석 밀도를 따른다.

## 불가침 제약 (공모전 조건)

- **외부 에셋 파일 0**: 지오메트리·텍스처(캔버스/DataTexture)·사운드(Web Audio) 전부 코드 생성.
- **결정성**: 게임플레이 경로에 `Math.random` 금지 (교실 재현성). `sourceRegression.test.js`가 검사한다.
- **개인정보 0**: 문서·제출물에 이름·소속·이메일·연락처 금지.
- **저사양**: 신규 렌더타깃·그림자 캐스터·상시 라이트는 근거 있을 때만. 픽셀레이쇼 캡(1.75) 유지.
- 학습 리포트·관문 신호(`getLearningReport`, `progress` 스키마, first-try/retry 기록)와 인쇄 CSS는 깨지 않는다.

## 워크플로

- 작업은 **수직 슬라이스** 단위: 구현 → 테스트 → 브라우저 실플레이 검증 → 배포(PR·squash 머지) 후 다음 슬라이스. 상세 절차는 `/slice` 스킬 참고.
- 큰 구조 변경은 **쓰기 전에 관련 코드를 먼저 읽는다** (같은 파일 재편집 왕복 방지).
- 개발 브랜치: `claude/ai-ethics-game-trilogy-raq6fv`. 머지 후 `origin/main`으로 재동기화(force-with-lease).
- 커밋·PR에 모델 ID를 넣지 않는다. 커밋 끝: `Co-Authored-By: Claude <noreply@anthropic.com>`.

## 테스트·검증

- `npm test`(node --test) 전부 통과 + `npm run build` + `npm run smoke`가 배포 전 최소선. 기존 테스트 수 감소 금지.
- 테스트만으로 끝내지 말 것 — 헤드리스 Chromium으로 실플레이 확인 (경로·훅·프로브 팁은 `/slice` 스킬에 문서화). 콘솔 에러 0 확인.
- 테스트 훅: `window.__ETHICS_TEST_HOOK__ = true` → `window.__ethicsGame` / `window.__ethicsUi` 노출.

## 시각 변경 규칙

- 변경 후 스크린샷으로 자가 점검: 3D 이름표·HUD 글씨 또렷한가, 화면이 희멀겋게 씻기지 않는가, 어두운 실내가 검게 짓눌리지 않는가.
- 오버월드 톤 교정(노출 0.96 + 콘트라스트 그레이딩)은 어두운 던전을 짓누른다 — 던전은 자체 발광·조명으로 보정하고 안개는 방 너머(시작 24+)에서만.
- 모바일(터치) 레이아웃 유지: 이동 d-pad 왼쪽, 확인/공격 A 버튼 오른쪽.
