# H-17 2D 횡스크롤 액션 — 디자인 QA

검토일: 2026-08-13

기준 이미지: `docs/design/concepts/gameplay-screen-v3.webp`

비교 이미지: `.omo/evidence/illustrated-action/reference-vs-game.png`

## Scope audited

- 1440×900 데스크톱 플레이 중간 상태와 결말
- 390×844 모바일 첫 증거 회수 상태
- 원화의 남색 밤 캠퍼스, 호박빛 발자국, 부유 기록, 주인공·도트, HUD 계층
- 실제 키보드·터치 입력, 버튼 크기, 가로 오버플로, 콘솔·네트워크 오류

## Findings by severity

### P0 — Critical

없음.

### P1 — Major

없음.

### P2 — Minor

없음. 첫 캡처에서 캐릭터가 전경 바닥보다 낮게 떠 보였고 일반 적의 접촉 판정이 공격 거리와 겹쳤다. 배경 소스 크롭을 하단 80%로 조정하고 접촉 반경을 58→40으로 줄였다. 새 회귀 테스트와 두 번째 실제 완주에서 데스크톱 respawn 0, 모바일 체력 3/3을 확인했다.

## Visual comparison

- 원화의 핵심 대비인 남색 달빛과 호박색 기억 경로를 유지했다.
- 부유 섬·기록 종이·탑·다리·결정 코어를 좌→우 이동 가능한 횡스크롤 랜드마크로 재해석했다.
- 남색 롱코트와 호박색 스카프 주인공, 작은 도트, 결정형 WHITEOUT은 실제 투명 PNG 스프라이트를 사용한다.
- 원화의 좌상단 임무, 상단 진행, 하단 상호작용 계층을 유지하면서 2D 액션에 필요한 체력과 네 증거 상태를 명시했다.
- 모바일은 게임 뷰를 중앙 크롭하고 HUD와 52×58px 터치 버튼을 별도 영역에 배치해 조작 중 화면을 가리지 않는다.

## Functional QA evidence

- Desktop: `.omo/evidence/illustrated-action/desktop-action.png`, `desktop-complete.png`, `desktop-report.json`
- Mobile: `.omo/evidence/illustrated-action/mobile-action.png`, `mobile-report.json`
- Reference comparison: `.omo/evidence/illustrated-action/reference-vs-game.png`
- Desktop result: 4/4 evidence, WHITEOUT HP 0, protected ending, respawn 0, console errors 0, failed responses 0
- Mobile result: privacy evidence 1/4 by touch only, HP 3/3, all action buttons ≥52×58px, horizontal overflow 0, console errors 0, failed responses 0
- Save/reload result: localStorage contains only `version`, `checkpointX`, `evidenceIds`, `completed`; reload restores the latest checkpoint and does not persist position, HP, boss state, input, or runtime events.

## final result

passed
