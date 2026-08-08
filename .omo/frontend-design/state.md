# H-17 frontend design state

## Current Objective

2026-08-08: H-17: NULL을 실제 3D 부유 학교 6장 캠페인과 제품 수준의 타이틀·HUD·설정·보고서로 전면 개선한다.

## Locked Decisions

- 기준 SHA `c7e37d87`, 브랜치 `codex/h17-six-chapter-campus-overhaul`, 사용자 승인 전 main 미병합.
- 초등 5–6학년, 장 내부 열린 탐색 + 6장 독립 캠페인.
- 기존 1–4장 보존, 새 5장 증언 보관소 삽입, 기존 마지막 방송은 6장으로 이동.
- 실제 3D GLB/GLTF/PBR 사용, 2D 배경 위장 금지, CC0/상업 재배포 가능 자산만 사용.
- 남색 달빛 + 호박빛 기억, 저사양 예산과 개인정보 0 우선.

## Source Inputs

- `DESIGN.md`
- `docs/reboot/H17-6장-전면개선-실행계획.md`
- 사용자 캠퍼스 레퍼런스 설명
- 기존 `.omo/evidence/h17-loop-*` 기준 화면
- Kenney, ambientCG, Poly Haven, Quaternius 공식 CC0 조사

## Inclusive Personas

| 상황 | 목표 | 통과 기준 |
| --- | --- | --- |
| 키보드 사용자 | 1–6장과 제품 메뉴 완주 | 포인터 없이 모든 메뉴/결정/일시정지 가능 |
| 터치 소형 화면 | 전투와 탐색 완주 | 왼쪽 스틱·오른쪽 동사, 44px, HUD/자막 겹침 없음 |
| 색각 차이 | 상태와 위험 판별 | 색 외에 아이콘·텍스트·형상 사용 |
| 모션 민감 | 흔들림 없이 플레이 | reduced motion에서 흔들림·맥동·섬광 대체 |
| 공유 교실 기기 | 개인정보 없이 이어하기/보고서 | 자유 입력 0, 저장 복구, 인쇄물 PII 0 |

## Design Principles

1. 한 화면에서 다음 목적지와 현재 위협이 동시에 읽힌다.
2. 윤리 선택은 점수가 아니라 인물·공간·접근 경로의 비용으로 보인다.
3. 주요 장소는 실루엣·재질·동선·상호작용이 모두 다르다.
4. 시각 효과보다 전투 예고, 자막, TRACE, 터치 입력 가독성이 우선한다.

## Open Questions

- 실제 사용자 첨부 캠퍼스 원본 파일이 현재 워크스페이스에 없어 동일 크기 pixel diff 기준 파일은 아직 연결되지 않았다. 구현 전 verbal contract는 고정하되 최종 P0 기준 비교에는 원본 재첨부가 필요하다.

## Verification Matrix

- 1440×900 desktop, 390×844 mobile fresh screenshots.
- 1–6장, 타이틀, 설정, 결과/보고서, WebGL failure 전 화면 캡처.
- 키보드/터치 풀런, reduced motion, CJK, 44px, print 확인.
- visual-qa dual review와 final review의 blocking 0.

## Design Debt Register

| ID | Source | Severity | Issue | Affected users | Suggested fix | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DD-001 | reference packet | major | 캠퍼스 레퍼런스 원본 파일 미확보 | 시각 품질 검토자 | 원본 재첨부 후 same-size diff | open | P0 최종 승인 전 차단 |

## Evidence Index

- 실행 원장: `C:/Users/종환/AppData/Local/Temp/h17-ultrawork-dKzstH.md`
- 초기 기존 화면: `.omo/evidence/h17-loop-*`
- 신규 증빙: `.omo/evidence/h17-six-chapter/`에 생성 예정
