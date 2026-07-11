---
name: slice
description: 기능 슬라이스 하나를 구현→테스트→브라우저 검증→배포(PR·머지)까지 한 번에 완주하는 표준 워크플로. 사용자가 "/slice <슬라이스 설명>"으로 호출하거나, 슬라이스 단위 개발을 요청할 때 사용.
---

# Slice Workflow — 슬라이스 하나를 끝까지 배송한다

인자(`$ARGUMENTS`)로 받은 슬라이스를 아래 순서대로 완주한다. 각 단계는 이전 단계가 그린일 때만 진행한다.

## 0. 스코프 확정 (짧게)

- 슬라이스의 **수용 기준(AC)을 3~5줄로 먼저 적는다**: 무엇이 보이고/동작하고/기록되어야 완료인가.
- 건드리지 말 것을 명시한다. 기본 불가침: 학습 리포트·관문 신호(`getLearningReport`, `progress` 스키마), 인쇄 CSS, 결정성(게임플레이 경로 `Math.random` 금지), 외부 에셋 0, 좌 이동 스틱/우 A 터치 마크업.
- 큰 구조 변경이면 구현 전에 관련 코드를 **먼저 읽는다** (편집→재편집 왕복 방지: 쓰기 전에 Read/Grep로 지도 그리기).

## 1. 구현

- 순수 로직은 `src/*.js` 모듈(THREE 무의존)로, 3D 표현은 표현 계층으로 분리한다 (`dungeonPuzzles.js` ↔ `dungeon.js` 패턴).
- 코드 스타일: 기존 파일의 한국어 주석 밀도·명명 관례를 따른다.

## 2. 테스트

- 새 로직에 유닛 테스트(`tests/*.test.js`, node --test), 구조 불변식엔 `tests/sourceRegression.test.js`에 assert 추가.
- `npm test` 전부 통과할 때까지 수정. **기존 테스트 수가 줄면 안 된다** (의도적 갱신만 허용).
- `npm run build` + `npm run smoke` 통과 확인.

## 3. 브라우저 실플레이 검증 (필수 — 테스트만으로 끝내지 않는다)

이 저장소의 검증된 헤드리스 패턴을 사용한다:

```bash
# 서버+프로브를 반드시 한 셸 세션에서 (백그라운드 nohup은 셸 간에 리핑됨)
PORT=87XX  # 매번 새 포트
python3 -m http.server $PORT --bind 127.0.0.1 --directory dist > /tmp/srv.log 2>&1 &
SRV=$!
NODE_PATH=<scratchpad>/node_modules node -e '…playwright-core probe…'
kill $SRV
```

- Chromium: `executablePath: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"`, args `--use-angle=swiftshader --enable-unsafe-swiftshader --no-sandbox`.
- `addInitScript`으로 `window.__ETHICS_TEST_HOOK__ = true` → `window.__ethicsGame` / `window.__ethicsUi` 훅 사용.
- 프로브 팁: 타이틀은 `button.title-start` 클릭, 프롤로그는 `[data-prologue-skip]` 또는 `[data-prologue-next]` 클릭. 사당 진입은 `nearest` 주입보다 **실좌표 텔레포트 + 400ms 대기**가 안정적. 던전 A 연타 전 `dungeon.actionCooldown = 0` 리셋.
- **콘솔·페이지 에러 0**을 확인하고, 시각 변경이면 스크린샷을 찍어 눈으로 본다.

## 4. 시각 변경 시 가독성 자가 점검

- 스크린샷에서 확인: 글씨(3D 이름표·HUD)가 또렷한가, 화면이 희멀겋게 씻기지 않는가, 어두운 실내(던전)가 검게 짓눌리지 않는가.
- 주의: 오버월드용 톤 교정(노출<1 + 콘트라스트)은 어두운 방을 검게 만든다 — 던전은 자체 발광/조명으로 보정, 안개는 방 너머(시작 24+)로.

## 5. 배포

1. 커밋 — 한국어 제목, 본문에 무엇을/왜/검증 요약. 끝에 `Co-Authored-By: Claude <noreply@anthropic.com>`. 모델 ID는 커밋·PR에 절대 넣지 않는다.
2. `git push -u origin claude/ai-ethics-game-trilogy-raq6fv` (실패 시 2·4·8·16초 백오프 재시도).
3. GitHub MCP로 PR 생성(main ←) → **squash 머지** → 브랜치 재동기화:
   `git fetch origin main && git checkout -B claude/ai-ethics-game-trilogy-raq6fv origin/main && git push --force-with-lease origin claude/ai-ethics-game-trilogy-raq6fv`
   (머지된 커밋만 담긴 브랜치라 force-with-lease 안전.)
4. 머지가 곧 GitHub Pages 배포다.

## 6. 보고

최종 메시지에: 무엇이 배포됐는지(사용자 눈에 보이는 변화 위주) → 검증 결과(테스트 수·브라우저 확인) → 다음 슬라이스 후보 1~2개. 과정 나열보다 결과 우선.

## 공모전 불가침 조건 (항상)

- 외부 에셋 파일 0 (지오메트리·텍스처·사운드 전부 코드 생성)
- 게임플레이 경로 `Math.random` 금지 (교실 재현성)
- 제출물·문서에 개인정보(이름·소속·이메일) 금지
- 저사양 목표: 신규 렌더타깃·그림자 캐스터·상시 라이트 추가는 근거와 함께만
