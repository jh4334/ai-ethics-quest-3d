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
- `docs/design/concepts/gameplay-screen-v3.webp` (동일 크기 비교 기준)
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

- 저장소의 콘셉트 이미지를 동일 크기 비교 기준으로 연결했지만, 픽셀 유사도 0/100이므로 레퍼런스 충실도에 대한 사용자 승인은 아직 필요하다.

## Verification Matrix

- 1440×900 desktop, 390×844 mobile fresh screenshots.
- 1–6장, 타이틀, 설정, 결과/보고서, WebGL failure 전 화면 캡처.
- 키보드/터치 풀런, reduced motion, CJK, 44px, print 확인.
- visual-qa dual review와 final review의 blocking 0.

## Design Debt Register

| ID | Source | Severity | Issue | Affected users | Suggested fix | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DD-001 | reference packet | major | 캠퍼스 레퍼런스 동일 크기 비교 미연결 | 시각 품질 검토자 | 1440×900 same-size diff 생성 | closed | `p0/reference-vs-actual-chapter1-2880x900.png` |
| DD-002 | latest comparison | major | 회화적 원경·건축 디테일이 레퍼런스보다 단순함 | 시각 품질 검토자 | 고유 건축 GLB·식생 변형·원경 후처리 보강 | open | 기능·성능은 통과했으나 충실도 승인은 미완료 |

## Evidence Index

- 실행 원장: `C:/Users/종환/AppData/Local/Temp/h17-ultrawork-dKzstH.md`
- 초기 기존 화면: `.omo/evidence/h17-loop-*`
- 신규 증빙: `.omo/evidence/h17-six-chapter/`의 P0 5화면, 전 장 12화면, 키보드·터치 풀런, 성능 보고서
