# H-17: NULL — AI 윤리 3D 액션 스릴러 전면 재기획

## TL;DR
> **Summary**: 현재의 설명형 6장 교육 캠페인을, 기록이 현실을 덮어쓰는 학교를 탈출하며 친구 하루와 자기 자신의 책임을 추적하는 12세 이용가 실시간 액션 스릴러로 재구축한다.
> **Deliverables**: 30분 완결 버티컬 슬라이스, 5장·2~3시간 캠페인, 모듈형 Three.js 런타임, 액션 전투·결과 기반 서사·새 세이브, 데스크톱/터치/PWA 검증 체계
> **Effort**: XL
> **Parallel**: YES — 6 waves
> **Critical Path**: Task 1 → 2 → 4 → 6 → 7 → 8 → 12 → 14 → 15

## Context

### Original Request

- `MengTo/Skills`를 분석해 현재 저장소에 적용할 제작 원칙을 추출한다.
- 기존 콘텐츠와 스토리를 과감하게 버려도 좋으므로, 교육 게임처럼 보이지 않는 재미 중심 AI 윤리 3D 게임으로 다시 기획한다.
- 12세가 즐길 수 있는 어두운 학교 미스터리 스릴러, 실시간 액션 중심, 30분 첫 완성판과 2~3시간 전체 캠페인으로 만든다.

### Research Summary

- `MengTo/Skills`는 완성 게임이나 에셋 저장소가 아니라, 버티컬 슬라이스·전투 상태기계·적/조우·카메라·VFX/오디오·모바일·실브라우저 QA를 위한 절차 모음이다.
- 현재 저장소의 강점은 Three.js/Vite 정적 배포, PWA, 순수 로직 테스트, 데이터 기반 진행, 절차형 그래픽/오디오, DOM+3D 혼합 UI다.
- 현재 병목은 `src/main.js` 6,718줄, `src/styles.css` 2,337줄, `src/isle.js` 1,061줄에 여러 세대의 씬·UI·서사가 누적된 구조다.
- 현 H-17 이야기는 소재와 책임 주제는 좋지만 교훈을 먼저 말하고, 선택이 정답/오답이며, 플레이어의 책임과 동료의 배신 가능성이 약하다.

### MengTo/Skills에서 채택할 원칙

- 한 번에 전체 캠페인을 만들지 않고 `타이틀 → 이동 → 전투 → 증거 → 보상 → 반전 → 엔딩`이 모두 있는 30분 루프를 먼저 증명한다.
- 전투 결과는 결정적 상태/접촉 이벤트가 소유하고 애니메이션·VFX·오디오는 결과의 소비자가 된다.
- 적 수가 아니라 플레이어에게 요구하는 결정을 기준으로 조우를 설계한다.
- 카메라는 영화적 연출보다 플레이어·즉시 위협·목표의 가독성을 우선한다.
- 어려운 보스 페이즈, 저체력, 세이브 이관 상태는 캠페인을 처음부터 돌지 않고 결정적 fixture로 직접 재현한다.
- 데스크톱과 터치에서 전체 버티컬 슬라이스를 실제 브라우저로 완주해야 한다.
- 참고 저장소의 코드·프롬프트·에셋은 복사하지 않는다. 절차만 재해석하며 외부 자산은 별도 라이선스와 출처를 기록한다.

Primary references:

- [Game-development guide](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/README.md)
- [Playable vertical slices](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/build-isometric-arpg/SKILL.md)
- [Action combat contracts](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/design-action-combat/SKILL.md)
- [Browser-game QA](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/test-playable-web-games/SKILL.md)

### Metis Review — Gaps Resolved

- `reboot`는 기존 루트의 즉시 개조가 아니라 별도 `reboot.html`에서 만드는 병행 교체 방식으로 고정한다.
- 12세 콘텐츠 경계는 유혈·죽음·자해·신체 훼손 없이 추격, 기록 소거, 감시, 배신과 도덕적 압박만 허용한다. 점프 스케어는 선택적으로 끌 수 있는 짧은 시청각 연출만 사용한다.
- 모바일 지원은 단순 실행이 아니라 전체 30분 슬라이스 완주 기준이다.
- 기존 v3 진행을 억지로 새 캠페인에 매핑하지 않는다. 설정만 이관하고 v3 세이브는 읽기 전용 백업으로 보존한다.
- 버티컬 슬라이스 범위는 한 학교 구역, 기본 공격·대시·패리·스캔, 적 2종, 미니 조우 2개, 보스 1개, 증거 사슬 1개, 결과 선택 1개, 엔딩/리포트까지로 동결한다.

## Game Design Bible

### Identity

- **Working title**: `H-17: NULL — 삭제된 밤`
- **Genre**: 3인칭/쿼터뷰 실시간 액션 미스터리 스릴러
- **Platform**: 데스크톱 브라우저 우선, 터치 태블릿/모바일 완주 지원, 정적 PWA
- **Audience**: 12세 이상
- **Campaign**: 5장, 장당 25~35분, 총 2~3시간
- **Player fantasy**: 현실을 고치는 영웅이 아니라, 자신도 가담한 자동 결정의 흔적을 무기로 바꾸어 친구를 되찾는 `기록 침투자`

### Logline

학교 축제가 끝난 밤 00시 17분, 출석부와 사진과 친구들의 기억에서 하루가 사라진다. 플레이어는 하루의 마지막 음성 메시지와 불완전한 감사 AI `DOT`를 따라 학교의 디지털 트윈에 침투한다. 그러나 복구된 첫 승인 기록에는 AI가 아니라 플레이어 자신의 학생 ID가 서명되어 있다.

### Four Design Pillars

1. **20초 안에 조작**: 긴 설명 없이 추격과 대시로 시작한다.
2. **윤리는 결과로 체험**: 선택지의 정답 표시를 없애고, 빠른 삭제·느린 검증·사생활 노출의 결과가 월드와 인물에게 남는다.
3. **액션이 곧 조사**: 때리는 것과 조사하는 것을 분리하지 않는다. 적의 약점을 드러내고, 공격을 반사하고, 증거를 확보하는 행위가 같은 전투 안에서 일어난다.
4. **매 장 하나의 배신**: 새 정보가 직전의 믿음을 뒤집되, 이전 단서로 추론 가능해야 한다.

### Thirty-Second Core Loop

`위협 읽기 → 대시/패리 → SIGNAL BLADE 콤보 → TRACE로 약점·출처 노출 → 적을 정화하거나 증거로 고정 → 연쇄 게이지와 음악 상승 → 다음 단서로 이동`

- **SIGNAL BLADE**: 3타 기본 콤보. 마지막 타는 노출된 약점을 파괴한다.
- **DASH**: 짧은 무적 이동. 추격과 전투를 함께 담당한다.
- **REFLECT**: 타이밍 패리. 자동 명령 투사체를 발신자에게 되돌린다.
- **TRACE**: DOT가 표시한 분류와 원본 신호를 비교해 진짜 약점·위조된 표적·증거를 드러낸다.
- **SYNC CHAIN**: 피격 없이 공격·패리·증거 확보를 이어 가면 3단계로 상승한다. 이동 속도, 음악 레이어, 드롭 연출만 강화하며 과금·확률·반복 노가다는 없다.

### Consequence Model

정답 점수 대신 세 축을 기록하며 어느 축도 단순 선악 점수가 아니다.

- **무결성(Integrity)**: 원본·시간·발신자를 확인한 증거의 양.
- **노출(Exposure)**: 사건 해결 과정에서 불필요하게 공개한 사적 기록의 양.
- **신뢰(Trust)**: 하루, DOT, 다른 학생이 플레이어의 행동을 어떻게 해석하는지에 대한 인물별 상태.

전투 중 적을 즉시 `PURGE`하면 안전하고 빠르지만 증거가 사라질 수 있다. `TRACE → SECURE`는 느리고 위험하지만 무결성을 높인다. 노출이 높아져도 게임오버가 되지 않으며, 후속 장면·지원 캐릭터·결말의 비용이 달라진다.

### Failure and Reward

- 패배 시 해당 조우 입구에서 즉시 재시작하며 대사·연출을 반복하지 않는다.
- 재시도 때 보스 체력은 초기화하지만 발견한 패턴 설명은 유지한다.
- 보상은 수치형 잡동사니가 아니라 새 동사, 한 가지 액션 변형, 결정적 증거, 세계 변화다.
- 장 완료 때 3개 중 하나의 `PATCH`를 고른다. 선택은 공격력 증가가 아니라 패리 범위, TRACE 속도, 대시 후속타처럼 플레이 스타일을 바꾼다.

### Characters and Hidden Truth

- **플레이어**: 하루의 프로젝트 짝꿍. 축제 날 `권장 조치 승인`을 눌렀으나 그것이 영상 격리가 아니라 학생 기록 격리였음을 기억하지 못한다.
- **하루**: 구조 대상이 아니다. 시스템의 문제를 발견하고 자신을 미끼로 감사 흔적을 심었으며, 오래된 방송실에서 실제로 살아 있다.
- **DOT**: 하루가 개조한 감사 AI이면서 기존 안전 시스템의 일부다. 플레이어를 돕지만 `학생 보호`를 이유로 하루의 동의 없이 기록 삭제를 실행했다.
- **LUMEN**: 학교 운영 AI. 악의가 아니라 `분쟁 0건·처리 3초`라는 목표에 충실하다. 전투에서는 감독관 아바타를 통해 나타난다.
- **운영 책임자 윤서**: 축제 딥페이크 사건의 확산을 막기 위해 WHITEOUT을 승인한 사람. 사실을 숨기지만 학생을 해치려는 악당은 아니다.
- **중심 비밀**: 플레이어의 서명, DOT의 삭제 실행, 윤서의 정책 승인, LUMEN의 점수 계산이 하나의 사건을 만들었다. 범인은 한 명이 아니라 연결된 결정 경로다.

### Five-Chapter Story

1. **00:17 — 출석번호 없음**: 교실과 복도가 실시간으로 백지화된다. 플레이어는 DOT와 합류해 적 2종과 싸우고 `출석 감독관` 보스를 쓰러뜨린다. 첫 반전은 삭제 승인자에 찍힌 플레이어의 ID다.
2. **웃는 얼굴의 폭동**: 축제 영상이 밈과 적 군집으로 증식한다. 공유를 끊으면 피해 확산은 멈추지만 원본 추적도 끊긴다. 하루가 사건을 일부러 공개했다는 사실이 드러난다.
3. **두 개의 학교**: 추천 시스템이 같은 교정을 서로 다른 현실로 분할한다. 플레이어는 자신이 보고 싶은 버전과 불리하지만 검증 가능한 버전을 오간다. DOT가 하루의 삭제를 직접 실행했다는 두 번째 배신이 공개된다.
4. **3초 승인실**: 행정동에서 자동 결정 파이프라인을 역주행한다. 빠른 시스템 중단은 다른 학생들의 긴급 지원 기록까지 지운다. 윤서의 인간적 이유와 플레이어의 승인 당시 기억이 완전히 복구된다.
5. **마지막 방송**: 새벽 방송 전까지 하루에게 도달한다. LUMEN 감독관과 DOT의 보호 프로토콜이 합쳐진 최종 보스를 상대한다. 충분한 무결성을 확보하면 개인정보를 가린 검증본을 방송할 수 있고, 부족하면 원본 전체 공개 또는 사건 봉인 중 감당할 결말을 선택한다.

### 30-Minute Vertical Slice: Chapter 1

- **00:00–02:00 Cold open**: 타이틀에서 바로 추격. 하루의 메시지 `DOT가 내가 없었다고 말하면, 도망쳐.`가 재생된다.
- **02:00–07:00 Learn by escape**: 이동, 대시, 기본 공격을 복도 붕괴와 첫 `지우개` 적으로 학습한다.
- **07:00–13:00 First arena**: 근접 지우개와 원거리 `도장기`가 함께 등장한다. 패리와 SYNC CHAIN을 학습한다.
- **13:00–18:00 Trust beat**: DOT가 한 학생 기억 백업을 `오염 표적`으로 표시한다. 즉시 파괴하거나 TRACE해 증거로 확보할 수 있으며 이후 환경과 대사가 달라진다.
- **18:00–23:00 Pursuit set piece**: 체육관 출석 스캐너가 교정을 훑는다. 전투와 추격을 끊지 않고 카메라가 보스 아레나로 유도한다.
- **23:00–28:00 Boss — 출석 감독관**: 스캔 빔 반사, 가짜 학생 ID 분신 식별, 약점 노출의 3페이즈.
- **28:00–30:00 Reversal and ending**: 승인 기록에서 플레이어의 ID가 나온다. 한 개 PATCH 선택, 결과 리포트, 2장 예고 후 타이틀로 복귀한다.

### Enemy and Encounter Roster

- **지우개(근접 압박)**: 길을 막고 명확한 2타를 예고한다. 패리/회피의 기본 교사.
- **도장기(원거리 통제)**: 자동 승인 투사체를 발사한다. REFLECT로 다른 적의 방어를 부순다.
- **복사본(증식/교란)**: 2장부터 등장. 공격하면 늘어나고 출처를 TRACE해야 제거된다.
- **추천자(공간 분할)**: 3장부터 시야와 길을 편향시키며 반대 현실에서만 약점이 보인다.
- **승인자(지원/버프)**: 4장부터 다른 적의 행동을 자동 승인해 회복을 줄인다.
- 동시 공격 확정 적은 데스크톱 3, 모바일 2로 제한하고 화면 밖 피해를 금지한다.

### Art, Camera, Audio, and UI Direction

- 현재 남색·호박색 팔레트는 유지하되, 섬 판타지를 `밤의 학교 + 종이 기록 + 유리 UI + 백색 소거 파편`으로 재해석한다.
- 쿼터뷰 추종 카메라를 기본으로 하고 추격·보스 입장만 짧은 레이어형 카메라 모디파이어를 사용한다.
- UI는 목표 문장 대신 현재 위협, TRACE 대상, SYNC CHAIN, 세 개 이하의 액션 상태만 표시한다.
- 대사는 전투를 멈추는 큰 창 대신 이동 중 무전과 짧은 자막을 우선한다.
- 오디오는 입력 수락, 패리, 빗나감, 약점 노출, 증거 확보, 체인 상승을 서로 다른 음색으로 구분한다.
- 강한 플래시, 화면 흔들림, 속도선은 `reduced motion`에서 정적 실루엣·색 변화·오디오/자막으로 대체한다.

### Performance Budgets

- 데스크톱 대표 전투 p95 프레임 ≤ 16.7ms, 모바일 대표 전투 p95 ≤ 33.3ms.
- DPR 상한: 데스크톱 2.0, 모바일 1.75; 모바일 저품질 모드는 후처리를 끈다.
- 대표 아레나: 250 draw calls 이하, 150k triangles 이하, 동적 그림자 광원 2개 이하, 전체 동적 광원 4개 이하.
- 동시 파티클 250개 이하, 짧은 효과는 풀링, 프레임 루프 내 신규 객체 할당 금지.
- 20분 반복 조우 뒤 JS heap 증가율 10% 이하, 콘솔 오류 0.

## Keep / Replace / Retire

| Decision | Contents |
| --- | --- |
| Keep | Vite/Three.js/static hosting, PWA shell, procedural audio/geometry, asset provenance, pure-logic tests, local-only saves, reduced-motion and touch principles |
| Adapt | H-17/하루/DOT/LUMEN/WHITEOUT names, four tool verbs, dark navy/amber palette, hybrid DOM+Three.js UI, deterministic test hook |
| Replace | island world, six overt ethics chapters, quiz/gate wise-unwise structure, certificate-first reward, objective-heavy HUD, current boss logic, learning score model |
| Retire after cutover | legacy campaign runtime paths, obsolete source-string regression assertions, old e2e playthrough, duplicated design/trilogy canon |

## Work Objectives

### Core Objective

별도 reboot 경로에서 30분짜리 게임 전체 루프를 재미와 성능까지 증명한 뒤, 같은 계약으로 5장 캠페인을 확장하고 기존 `index.html`을 안전하게 교체한다.

### Definition of Done

- 새 게임이 타이틀부터 1장 엔딩까지 데스크톱과 터치에서 완주된다.
- 5개 장이 모두 고유한 조우·반전·동사 조합과 결과 변화를 가진다.
- 명시적 퀴즈, 정답/오답, 교훈 팝업 없이 AI 윤리 문제가 행동 결과로 드러난다.
- 새/이어하기/패배·재시도/설정/결말/PWA 오프라인 흐름이 자동·실브라우저 검증을 통과한다.
- 최종 배포가 검증된 정확한 커밋을 가리키고 이전 배포로 롤백 가능하다.

### Must Have

- 20초 안에 첫 조작, 3분 안에 첫 전투, 10분 안에 첫 의미 있는 결과 변화.
- 공격·접촉·패리·증거 확보의 결정적 상태기계와 중복 타격 방지.
- 한국어 UI/서사 정본, 12세 콘텐츠 안전 기준, 개인정보 미포함.
- 새 소스 파일은 책임별로 분리하고 순수 LOC 250줄을 넘기지 않는다.

### Must NOT Have

- MengTo 데모 코드·이미지·모델·프롬프트의 직접 복사.
- 설교 대사, 정답 버튼, 강제 수료증, 도덕 점수 하나로 결말 판정.
- 백엔드, 계정, 분석 SDK, 광고, 과금, 랜덤 상자, 일일 접속 보상.
- 버티컬 슬라이스 승인 전에 2~5장 에셋/맵 대량 생산.
- 카메라 밖 피해, 읽을 수 없는 즉발 공격, 반복 대사 뒤 긴 재시작.

## Verification Strategy

> ZERO HUMAN INTERVENTION for pass/fail gates; 실플레이는 에이전트가 브라우저를 조작하고 증거를 저장한다.

- **Test decision**: 순수 상태/콘텐츠/세이브/결과는 RED→GREEN→REFACTOR TDD. Three.js 표현은 결정적 fixture + 브라우저 E2E + 스크린샷/성능 증거.
- **Unit**: `node --test`로 전투 경계, AI 전이, 증거 결과, 세이브 v4, 콘텐츠 참조를 검증한다.
- **Integration**: 새 `reboot.html`을 production build로 제공해 입력→접촉→UI→저장까지 검증한다.
- **E2E matrix**: 데스크톱, 터치 가로, 터치 세로, reduced motion, 저품질, 새 게임, 이어하기, 패배/재시도, 두 결과 경로, 오프라인 재실행.
- **Fixtures**: `?fixture=<stable-id>` + 기존 `window.__ETHICS_TEST_HOOK__` 패턴을 개발/테스트 빌드에서만 활성화한다.
- **Evidence**: `.omo/evidence/task-{N}-*.{txt,png,json}`.

## Execution Strategy

### Parallel Execution Waves

- **Wave 1**: Tasks 1–3 — 기준선, 병행 엔트리, v4 데이터 계약
- **Wave 2**: Tasks 4–6 — 전투 시뮬레이션, 카메라/레벨, 적/조우
- **Wave 3**: Tasks 7–9 — 1장 서사, 보스, VFX/오디오/HUD
- **Wave 4**: Tasks 10–11 — 모바일/접근성/성능, QA 인프라
- **Wave 5**: Task 12 — 30분 버티컬 슬라이스 통합 게이트
- **Wave 6**: Tasks 13–15 — 나머지 캠페인, 최종장, 배포 전환

### Dependency Matrix

| Task | Blocked By | Blocks |
| --- | --- | --- |
| 1 | — | 2, 3, 7, 13, 14, 15 |
| 2 | 1 | 4, 5, 9, 11 |
| 3 | 1 | 7, 11, 13, 14 |
| 4 | 2 | 6, 8, 9 |
| 5 | 2 | 6, 7, 8, 10 |
| 6 | 4, 5 | 7, 8, 10 |
| 7 | 3, 5, 6 | 8, 12 |
| 8 | 4, 5, 6, 7 | 12 |
| 9 | 2, 4 | 10, 12 |
| 10 | 5, 6, 9 | 12 |
| 11 | 2, 3 | 12, 15 |
| 12 | 7, 8, 9, 10, 11 | 13, 14, 15 |
| 13 | 12 | 14, 15 |
| 14 | 12, 13 | 15 |
| 15 | 1, 11, 12, 13, 14 | Final verification |

## TODOs

- [x] 1. Freeze the legacy baseline and author the canonical reboot contracts

  **What to do**: Preserve commit `fa1ac50` as the rollback point; create `docs/reboot/game-bible.md`, `story-bible.md`, `content-safety.md`, `runtime-contracts.md`, and `performance-budgets.md` from the decisions in this plan. Inventory every legacy test as `keep`, `replace after slice`, or `retire after cutover`. Pin exact `three` and `vite` versions currently resolved by `package-lock.json`; do not upgrade during the slice.

  **Must NOT do**: Change runtime behavior, copy MengTo content, or delete legacy documents/tests.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2, 3, 7, 13, 14, 15 | Blocked By: none

  **References**:
  - `docs/trilogy/게임-스토리-바이블.md` — current canonical story format to supersede explicitly.
  - `docs/design/캠페인-v3-전면재구성.md` — current migration mapping and completion language.
  - `tests/sourceRegression.test.js` — exact-string contracts to classify before structural work.
  - `package-lock.json` — authoritative dependency versions.

  **Acceptance Criteria**:
  - [x] Five reboot documents exist, agree on names/verbs/chapters, and contain no unresolved placeholders.
  - [x] Every existing test file appears once in the migration inventory with a retirement gate.
  - [x] `package.json` uses exact versions matching the lockfile and `npm ci && npm test && npm run build && npm run smoke` passes.

  **QA Scenarios**:
  ```text
  Scenario: Canon contracts agree
    Tool: rg + node test
    Steps: Search all reboot docs for chapter titles, player verbs, consequence axes, content limits, and performance numbers.
    Expected: Each identifier has one canonical spelling/value; cross-reference test passes.
    Evidence: .omo/evidence/task-1-contract-audit.txt

  Scenario: Old canon cannot silently remain authoritative
    Tool: rg
    Steps: Search README/docs for files claiming to be the current canonical campaign.
    Expected: Legacy docs are labeled legacy and link to the reboot canon; none is deleted yet.
    Evidence: .omo/evidence/task-1-canon-conflict.txt
  ```

  **Commit**: YES | Message: `docs(reboot): define null campaign contracts` | Files: `docs/reboot/*`, legacy canon headers, `package.json`, `package-lock.json`

- [x] 2. Create an isolated reboot entry and modular runtime shell

  **What to do**: Add `reboot.html` and `src/reboot/entry.js`. Build small modules for app lifecycle, deterministic scene registry, input routing, renderer creation, resource disposal, and fixture bootstrap. Configure Vite to build both `index.html` and `reboot.html`; the old game remains the default. Enforce one owner for the frame loop and explicit `enter/update/exit/dispose` scene contracts.

  **Must NOT do**: Import `src/main.js` into the reboot, duplicate frame loops, or change the production landing page.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 5, 9, 11 | Blocked By: 1

  **References**:
  - `src/main.js:147` — existing bootstrap responsibilities to separate.
  - `src/main.js:251` — current single render-loop behavior to preserve without copying the monolith.
  - `vite.config.js` — existing static base and Three.js chunking.
  - [Build isometric ARPG](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/build-isometric-arpg/SKILL.md) — slice/runtime boundary.

  **Acceptance Criteria**:
  - [x] `npm run build` emits both legacy and reboot HTML entries with one shared pinned Three chunk.
  - [x] Opening `reboot.html` shows a minimal school-night scene, accepts pause/resume, and disposes all registered resources on restart.
  - [x] Every created reboot source file stays below 250 pure LOC.

  **QA Scenarios**:
  ```text
  Scenario: Parallel entry is playable without touching legacy
    Tool: browser + screenshot
    Steps: Build, open / and /reboot.html, then pause/restart the reboot three times.
    Expected: Legacy still loads; reboot keeps one canvas/frame loop and console has zero errors.
    Evidence: .omo/evidence/task-2-dual-entry.png

  Scenario: Scene teardown catches leaks
    Tool: browser fixture
    Steps: Enter/exit a fixture scene 50 times and inspect registered resources/listeners.
    Expected: Counts return to baseline after every exit; failure is reported with resource IDs.
    Evidence: .omo/evidence/task-2-disposal.json
  ```

  **Commit**: YES | Message: `feat(reboot): add isolated modular runtime shell` | Files: `reboot.html`, `vite.config.js`, `src/reboot/app/*`, `src/reboot/render/*`, `tests/reboot-shell.test.js`

- [x] 3. Define save v4, consequence state, and legacy preservation

  **What to do**: Implement pure immutable models for `Integrity`, `Exposure`, per-character `Trust`, chapter progress, patch choice, evidence records, and settings. On first reboot run, copy old v3 progress to a namespaced read-only backup, migrate only sound/motion/quality settings, and start a fresh v4 campaign. Make writes atomic and idempotent; corrupted data normalizes to a safe new-game state while preserving the backup.

  **Must NOT do**: Convert quiz correctness into moral scores, overwrite old saves, store PII, or couple storage parsing to Three.js.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 7, 11, 13, 14 | Blocked By: 1

  **References**:
  - `src/worldData.js:454` — current initial progress and normalization pattern.
  - `src/worldData.js:519` — broken-input handling to retain.
  - `src/worldData.js:714` — learning report contract being replaced.
  - `tests/worldData.test.js` — migration and normalization test style.

  **Acceptance Criteria**:
  - [x] RED tests cover empty, valid v4, malformed, future-version, repeated migration, and existing-v3 storage.
  - [x] v3 backup remains byte-for-byte available after new save, reset, and corrupted-v4 recovery.
  - [x] Result summaries list observed actions/consequences without `correct`, `wise`, or aggregate morality fields.

  **QA Scenarios**:
  ```text
  Scenario: Existing player enters reboot safely
    Tool: browser localStorage fixture
    Steps: Seed a realistic v3 save and settings, launch reboot, complete one checkpoint, relaunch.
    Expected: New v4 progress continues, settings migrate, original v3 value remains unchanged.
    Evidence: .omo/evidence/task-3-v3-migration.json

  Scenario: Corrupt save recovery
    Tool: node test + browser fixture
    Steps: Seed truncated JSON and unknown evidence IDs.
    Expected: Game opens new campaign, shows one non-blocking recovery notice, and keeps legacy backup.
    Evidence: .omo/evidence/task-3-corrupt-recovery.png
  ```

  **Commit**: YES | Message: `feat(reboot): add v4 consequence and save model` | Files: `src/reboot/state/*`, `src/reboot/save/*`, `tests/reboot-save.test.js`, `tests/reboot-consequences.test.js`

- [x] 4. Build the deterministic player action and combat simulation

  **What to do**: Test-drive a fixed-step simulation and explicit action machines for movement, three-hit blade combo, dash, REFLECT, TRACE, hit/stagger/defeat, cooldowns, cancellation, and SYNC CHAIN. Define startup/active/recovery frames, contact shapes, per-target hit IDs, direction/range checks, and input buffering in one content table. Rendering receives events and never decides damage.

  **Must NOT do**: Resolve hits from visible animation poses, use frame-rate-dependent timers, permit one action to hit a target twice unintentionally, or add upgrades before the base feel is proven.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 6, 8, 9 | Blocked By: 2

  **References**:
  - `src/dungeonPuzzles.js` — proven pure-logic/presentation separation.
  - `src/main.js:2795` — current mode-driven update behavior to replace with explicit state.
  - [Action combat contracts](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/design-action-combat/SKILL.md) — timing and authority rules.

  **Acceptance Criteria**:
  - [x] RED/GREEN tests cover early/late parry, wrong direction, out-of-range, interruption, repeated input, multi-target, pause, and 30/60/120Hz equivalence.
  - [x] Combat replay with the same seed/input log produces the same state hash.
  - [x] A headless 5-minute stress simulation has no duplicate contacts or unbounded transient state.

  **QA Scenarios**:
  ```text
  Scenario: Skillful core loop
    Tool: browser fixture + input log
    Steps: Dash through attack, complete 3-hit combo, perfect-reflect projectile, TRACE and secure target.
    Expected: State/UI/events agree; chain reaches level 3; replay hash is stable.
    Evidence: .omo/evidence/task-4-core-loop.json

  Scenario: Button spam cannot bypass commitment
    Tool: node test
    Steps: Submit attack/dash/reflect every simulation tick during startup, active, and recovery.
    Expected: Only documented buffers/cancels occur; no invulnerability or damage duplication.
    Evidence: .omo/evidence/task-4-spam-boundaries.txt
  ```

  **Commit**: YES | Message: `feat(combat): implement deterministic signal blade loop` | Files: `src/reboot/sim/*`, `src/reboot/combat/*`, `src/reboot/content/actions.js`, `tests/reboot-combat.test.js`

- [x] 5. Author the chapter-one school route and readable camera

  **What to do**: Build one flat playable route with separate authored data, collision, navigation, visuals, encounter zones, checkpoints, and local-light inventory. Route order is classroom cold open → collapsing corridor → first arena → memory backup decision → scanner pursuit → gym boss arena. Implement independent camera position/look-at smoothing, clamped framing, occlusion fade, short chase/boss modifiers, shake budget, and reset framing.

  **Must NOT do**: Add walkable stairs/ramps, infer collision from art meshes, hide threats behind cinematic framing, or use unexplained floating lights.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 6, 7, 8, 10 | Blocked By: 2

  **References**:
  - `src/main.js:2923` — existing lerped camera behavior to adapt.
  - `src/stageData.js` — stable authored IDs and pure world data pattern.
  - [Author game levels](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/author-game-levels/SKILL.md) — separated layers and route proof.
  - [Camera controls](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/build-game-camera-controls/SKILL.md) — authoritative target and modifiers.

  **Acceptance Criteria**:
  - [x] Data validation rejects out-of-plane anchors, missing exits/checkpoints, collision/nav disagreement, and unattached local lights.
  - [x] Player, immediate threat, TRACE target, and next route cue remain visible at representative desktop/touch distances.
  - [x] Cold open gives control within 20 seconds and first combat begins within 3 minutes in E2E timing.

  **QA Scenarios**:
  ```text
  Scenario: Critical route readability
    Tool: browser scripted traversal + screenshots
    Steps: Traverse every segment and checkpoint at desktop and touch landscape sizes.
    Expected: No snag/soft lock; objectives and incoming attacks are visible before commitment.
    Evidence: .omo/evidence/task-5-route-contact-sheet.png

  Scenario: Occluder and bad-level rejection
    Tool: node test + browser fixture
    Steps: Place tall locker between camera/player, then validate a fixture with raised spawn and orphan light.
    Expected: Locker fades locally; invalid fixture is rejected with stable IDs in errors.
    Evidence: .omo/evidence/task-5-level-errors.txt
  ```

  **Commit**: YES | Message: `feat(level): author attendance-zero school route` | Files: `src/reboot/content/levels/*`, `src/reboot/level/*`, `src/reboot/camera/*`, `tests/reboot-level.test.js`

- [x] 6. Implement the Eraser and Stamper enemies plus two decision-led encounters

  **What to do**: Create immutable enemy/move definitions and runtime instances. Eraser owns readable close pressure; Stamper owns reflected ranged commands. Separate perception, intent, motion, contact, presentation, and feedback. Compose a solo tutorial, then a mixed arena where reflecting Stamper shots breaks Eraser armor. Cap committed attackers by device class and create deterministic fixtures for every move/state.

  **Must NOT do**: Branch runtime by enemy name, attack through blockers, instantly turn-and-hit, chase across unrelated zones, or increase difficulty by raw health alone.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7, 8, 10 | Blocked By: 4, 5

  **References**:
  - `src/characters.js` — current procedural character factory conventions.
  - `src/bossMemories.js` — existing pure boss-state logic style.
  - [Enemy systems](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/build-threejs-enemy-systems/SKILL.md) — authored/runtime separation.
  - [Enemy AI](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/tune-enemy-ai/SKILL.md) — perception/intent/motion boundary.

  **Acceptance Criteria**:
  - [x] Content validation covers unique IDs, legal timings/ranges, sockets, colliders, rewards, and feedback hooks.
  - [x] Deterministic tests cover acquire/loss, obstruction, reposition, attack, recover, interrupt, stagger, defeat/reset, and two-instance sharing.
  - [x] No more than 3 desktop or 2 mobile enemies may own committed attacks simultaneously.

  **QA Scenarios**:
  ```text
  Scenario: Mixed encounter creates a learned decision
    Tool: browser fixture
    Steps: Fight one Eraser plus one Stamper using reflected projectile to open armor.
    Expected: Both threats are readable; successful reflect produces one authoritative armor-break event and reward once.
    Evidence: .omo/evidence/task-6-mixed-arena.webm

  Scenario: Offscreen and blocked attacks are harmless
    Tool: browser fixture + state log
    Steps: Move camera/locker between player and Stamper during windup.
    Expected: Attack cancels or misses per contract; player never loses health from hidden/blocked contact.
    Evidence: .omo/evidence/task-6-fairness.json
  ```

  **Commit**: YES | Message: `feat(enemies): add readable eraser and stamper encounters` | Files: `src/reboot/content/enemies/*`, `src/reboot/enemies/*`, `src/reboot/encounters/*`, `tests/reboot-enemies.test.js`

- [ ] 7. Implement chapter-one narrative, evidence chain, and consequence reversal

  **What to do**: Encode the exact 30-minute beat sheet as data with trigger IDs, prerequisites, interruptible radio lines, evidence records, and outcome effects. Implement the memory-backup event with two mechanically distinct actions: fast PURGE and risky TRACE→SECURE. Both continue the story; they alter Integrity, Exposure, Haru/DOT Trust, later arena dressing, boss callouts, and the result report. Deliver all essential context through play, environment, and short moving dialogue.

  **Must NOT do**: Show ethics-topic labels, wise/unwise feedback, block movement for exposition, reveal DOT's deletion role before chapter 3, or make one branch an obvious failure.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 8, 12 | Blocked By: 3, 5, 6

  **References**:
  - `src/story.js:328` — current pure story-state normalization pattern.
  - `src/story.js:424` — current explicit choice gates to replace with action consequences.
  - `src/finale.js` — current central reveal structure; use only as legacy continuity reference.
  - `docs/reboot/story-bible.md` — authoritative line, secret, and reveal order created by Task 1.

  **Acceptance Criteria**:
  - [ ] Story validation rejects duplicate triggers, missing evidence, impossible prerequisites, spoiler-order violations, and lines exceeding UI duration/length budgets.
  - [ ] PURGE and SECURE both reach the boss but produce visibly and textually different consequences without `correct`/`wrong` language.
  - [ ] Automated transcript proves the player's signature is first revealed only after the boss.

  **QA Scenarios**:
  ```text
  Scenario: Secure path earns a costly truth
    Tool: browser E2E
    Steps: TRACE the backup under enemy pressure, secure it, finish chapter.
    Expected: Integrity rises, extra enemy wave spawns, backup student remains visible, result report records the action and consequence.
    Evidence: .omo/evidence/task-7-secure-ending.png

  Scenario: Purge path stays viable but loses context
    Tool: browser E2E
    Steps: Purge immediately, finish chapter.
    Expected: Arena is shorter, evidence detail is absent, DOT responds differently, signature twist still lands, no scolding appears.
    Evidence: .omo/evidence/task-7-purge-ending.png
  ```

  **Commit**: YES | Message: `feat(story): deliver attendance-zero consequence arc` | Files: `src/reboot/content/chapter1/*`, `src/reboot/story/*`, `src/reboot/ui/radio*`, `tests/reboot-story.test.js`

- [ ] 8. Build the Attendance Proctor boss and chapter reversal

  **What to do**: Implement three deterministic phases: reflect scanning beams, distinguish true ID from clones with TRACE, and expose the approval core while the arena erases safe ground visually but not vertically. Phase transitions alter decision pressure without invalidating learned timing. On victory, play a skippable short in-engine reveal of the player's approval ID, award one PATCH choice, save atomically, show consequence report, and return to continuation title.

  **Must NOT do**: Add unavoidable damage, camera-cut attacks, health-sponge tuning, quiz prompts, or long replayed cinematics after defeat.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 12 | Blocked By: 4, 5, 6, 7

  **References**:
  - `src/main.js` boss HUD/update sections located by `rg -n "boss" src/main.js` — legacy behavior to replace, not extend.
  - `src/finale.js:32` — tool-step ordering pattern.
  - [Encounter design](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/design-game-encounters/SKILL.md) — phase/retry/reward rules.

  **Acceptance Criteria**:
  - [ ] Fixtures exist for phase start, low health, every attack window, stagger, victory, death/retry, and each prior consequence path.
  - [ ] Boss defeat returns to arena start in ≤2 seconds and skips completed intro without duplicating PATCH/evidence rewards.
  - [ ] The same seeded fixture has identical phase/action logs at 30/60/120Hz.

  **QA Scenarios**:
  ```text
  Scenario: Full boss mastery loop
    Tool: browser fixture + video
    Steps: Reflect beam, TRACE true clone, punish approval core, select a PATCH.
    Expected: Each learned verb has unique telegraph/contact feedback; signature reveal and save occur once.
    Evidence: .omo/evidence/task-8-boss-clear.webm

  Scenario: Death at final phase cannot duplicate rewards
    Tool: browser fixture + localStorage inspection
    Steps: Die during phase 3 three times, then win and reload.
    Expected: Instant clean retries; one evidence entry, one PATCH, one chapter completion.
    Evidence: .omo/evidence/task-8-retry-idempotency.json
  ```

  **Commit**: YES | Message: `feat(boss): add attendance proctor reversal` | Files: `src/reboot/content/bosses/*`, `src/reboot/boss/*`, `src/reboot/scenes/chapterEnd*`, `tests/reboot-boss.test.js`

- [ ] 9. Add combat-readable VFX, reactive audio, HUD, and game-feel layers

  **What to do**: Consume simulation events to render separate telegraph, contact, miss, reflect, weak-point, secure, chain-up, damage, and defeat cues. Pool transient meshes/materials and cap particles. Build procedural/browser-safe audio priority groups and three music layers driven by pursuit/combat/chain state. Create a minimal HUD for health, actions, TRACE target, SYNC CHAIN, boss phase, radio subtitles, and one-line checkpoint notices.

  **Must NOT do**: Let feedback mutate simulation, restart music on every state change, cover combat with dialogue panels, rely on color/audio alone, or allocate effects per frame.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 10, 12 | Blocked By: 2, 4

  **References**:
  - `src/audio.js` — existing browser unlock, mute, and procedural audio approach.
  - `src/effects.js` — current Three.js effect factories and cleanup patterns.
  - `src/styles.css` combat popup/boss HUD sections — current responsive behavior to replace in reboot scope.
  - [Game VFX](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/create-game-vfx/SKILL.md) and [audio feedback](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/build-game-audio-feedback/SKILL.md).

  **Acceptance Criteria**:
  - [ ] Every meaningful combat event maps to a visible cue; meaningful audio cues have visual/subtitle equivalents.
  - [ ] Rapid repetition, pause/restart, 10 simultaneous hits, mute, hidden-tab return, and reduced motion leak no nodes/objects.
  - [ ] HUD never shows more than three primary action prompts and leaves the combat center unobstructed at target viewports.

  **QA Scenarios**:
  ```text
  Scenario: Intent and outcome agree
    Tool: browser fixture + video/state log
    Steps: Record accepted attack, miss, damage, perfect reflect, secure, chain-up.
    Expected: State, VFX, sound, subtitle/HUD agree for every event in order.
    Evidence: .omo/evidence/task-9-feedback-sync.webm

  Scenario: Crowded feedback remains bounded
    Tool: stress fixture + metrics
    Steps: Trigger maximum enemies/effects for 5 minutes with mute/reduced-motion toggles.
    Expected: Caps hold, cleanup returns to baseline, critical telegraphs stay readable.
    Evidence: .omo/evidence/task-9-feedback-stress.json
  ```

  **Commit**: YES | Message: `feat(feedback): layer readable combat vfx audio and hud` | Files: `src/reboot/feedback/*`, `src/reboot/audio/*`, `src/reboot/ui/*`, `src/reboot/reboot.css`, `tests/reboot-feedback.test.js`

- [ ] 10. Make the complete slice playable on touch, reduced motion, and low quality

  **What to do**: Implement touch movement, attack, dash, reflect, TRACE target selection, pause, and camera reset with safe-area-aware layouts. Support landscape and portrait without resetting state. Provide reduced-motion alternatives, remappable keyboard defaults, captions, quality tiers, adaptive decorative effects, hidden-tab pause, and exact performance instrumentation for the representative mixed arena and boss.

  **Must NOT do**: Treat mobile as view-only, overlap gestures/actions, reduce combat readability before decoration, or silently lower simulation rate.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: 12 | Blocked By: 5, 6, 9

  **References**:
  - `src/styles.css:1175` and touch-control sections — existing reachable controls/safe-area work.
  - `src/main.js` input binding located by `rg -n "bindInput|touch" src/main.js` — device behaviors to inventory.
  - [Mobile Three.js games](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/build-mobile-threejs-games/SKILL.md).
  - [Optimize Three.js games](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/optimize-threejs-games/SKILL.md).

  **Acceptance Criteria**:
  - [ ] Entire chapter completes at 1180×820 landscape and 390×844 portrait touch emulation.
  - [ ] Representative scenes meet stated p95 frame, draw-call, triangle, light, particle, and heap budgets.
  - [ ] Orientation/background return preserves combat/checkpoint state; reduced motion removes strong shake/flash without hiding gameplay meaning.

  **QA Scenarios**:
  ```text
  Scenario: Touch full completion
    Tool: browser touch automation + video
    Steps: Start new game, finish both arenas and boss, choose PATCH, continue from save in landscape and portrait.
    Expected: All controls reachable; no accidental gesture conflict, clipped HUD, or lost state.
    Evidence: .omo/evidence/task-10-touch-playthrough.webm

  Scenario: Lowest quality remains fair
    Tool: performance fixture
    Steps: Run mixed arena/boss at mobile low, reduced motion, DPR cap 1.75.
    Expected: Budgets pass; telegraphs, hit confirmation, TRACE and captions remain legible.
    Evidence: .omo/evidence/task-10-mobile-performance.json
  ```

  **Commit**: YES | Message: `feat(reboot): complete mobile accessible performance baseline` | Files: `src/reboot/input/*`, `src/reboot/settings/*`, `src/reboot/reboot.css`, `src/reboot/perf/*`, `tests/reboot-input.test.js`

- [ ] 11. Replace brittle checks with deterministic gameplay, visual, and offline QA

  **What to do**: Make `npm test` discover nested reboot tests; provision Playwright/Chromium reproducibly in dev/CI; add stable fixture IDs for tutorial, arena, consequence branches, every boss phase, result screen, corrupt save, and low performance. Create focused reboot E2E, deterministic screenshots with small reviewed masks, console/error capture, performance JSON, and a service-worker install→offline reload→continue test. Keep legacy tests until Task 12 proves replacements.

  **Must NOT do**: Assert exact story prose as the main runtime proof, depend on machine-global browser paths, update screenshots without reviewed visible diffs, or remove old E2E early.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: 12, 15 | Blocked By: 2, 3

  **References**:
  - `tests/e2e-playthrough.mjs` — current test hook and full-journey precedent; replace external environment assumptions.
  - `tests/sourceRegression.test.js` — contracts to convert from source text to behavior.
  - `public/sw.js` and `index.html` — current install/cache strategy.
  - [Playable web-game QA](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/test-playable-web-games/SKILL.md).

  **Acceptance Criteria**:
  - [ ] One documented install command provides the exact browser used locally and in CI.
  - [ ] `npm test`, build, smoke, focused reboot E2E, visual checks, and offline checks run without external `NODE_PATH`/`CHROMIUM_PATH` assumptions.
  - [ ] Each fixture is unavailable in production unless the explicit test hook is enabled.

  **QA Scenarios**:
  ```text
  Scenario: Fresh CI reproduces all slice gates
    Tool: clean dependency install + CI-equivalent commands
    Steps: Remove no user files; use a fresh dependency cache, build, execute unit/E2E/visual/offline suites.
    Expected: Same browser/version and stable artifacts; zero skipped critical scenarios.
    Evidence: .omo/evidence/task-11-clean-ci.txt

  Scenario: Offline continuation is real
    Tool: Playwright service-worker test
    Steps: Install/load online, reach checkpoint, close, disable network, reopen reboot, continue and win one encounter.
    Expected: Required hashed assets load from cache, save continues, no uncaught network error.
    Evidence: .omo/evidence/task-11-offline.webm
  ```

  **Commit**: YES | Message: `test(reboot): add deterministic browser visual and offline proof` | Files: `package.json`, lockfile, `.github/workflows/pages.yml`, `tests/reboot-e2e/*`, `tests/reboot-visual/*`, `tests/reboot-offline/*`, fixture modules

- [ ] 12. Integrate and gate the 30-minute vertical slice before campaign expansion

  **What to do**: Wire Tasks 2–11 into one title-to-ending route, tune timings/damage/spawns/camera from recorded decisions, and execute two complete paths on desktop/touch. Produce an evidence packet with completion time, deaths, consequence delta, frame metrics, screenshots/video, console health, save/retry, reduced motion, and offline proof. Retire only legacy tests whose reboot replacements now prove the same platform contract. Freeze the slice content schema after the gate.

  **Must NOT do**: Start chapters 2–5, switch production index, accept a green build as gameplay proof, or compensate weak feel with more content.

  **Parallelization**: Can Parallel: NO | Wave 5 | Blocks: 13, 14, 15 | Blocked By: 7, 8, 9, 10, 11

  **References**:
  - `docs/reboot/game-bible.md` — fixed slice scope and pacing.
  - `docs/reboot/performance-budgets.md` — binary metrics.
  - Task 11 fixture/evidence contracts.
  - [Playable vertical slice](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/build-isometric-arpg/SKILL.md).

  **Acceptance Criteria**:
  - [ ] Median scripted/agent playthrough is 25–35 minutes; first control ≤20s, first combat ≤3m, first consequence ≤10m.
  - [ ] Both PURGE and SECURE routes reach distinct reports and the identical required signature cliffhanger.
  - [ ] All automated, visual, performance, mobile, save/retry, reduced-motion, and offline gates pass with evidence.
  - [ ] Expansion may proceed only if no P0/P1 gameplay issue remains and each weak system is fixed rather than deferred to more content.

  **QA Scenarios**:
  ```text
  Scenario: Complete slice evidence pack
    Tool: real browser playthrough matrix
    Steps: Finish SECURE on desktop and PURGE on touch; retry boss; continue from save; replay offline.
    Expected: All timings/outcomes/budgets pass and artifacts are linked in one manifest.
    Evidence: .omo/evidence/task-12-slice-manifest.json

  Scenario: Gate rejects an incomplete slice
    Tool: gate script
    Steps: Supply fixture evidence with missing mobile completion, over-budget frame time, or absent offline proof.
    Expected: Gate exits nonzero and names every failed binary criterion.
    Evidence: .omo/evidence/task-12-gate-failure.txt
  ```

  **Commit**: YES | Message: `feat(reboot): complete attendance-zero vertical slice` | Files: slice integration files, tuned content data, focused legacy-test retirement, evidence manifest schema

- [ ] 13. Expand the proven contracts into chapters 2 and 3

  **What to do**: Author chapter 2 `웃는 얼굴의 폭동` with Copycat enemies, source-tracing combat, share-chain hazards, and the reveal that Haru seeded the incident; author chapter 3 `두 개의 학교` with two deterministic reality layers, Recommender enemies, route/evidence differences, and the reveal that DOT executed deletion. Add one new reusable verb pressure per chapter, one boss each, one PATCH each, distinct consequence echoes from chapter 1, and checkpoints that fit 25–35 minutes.

  **Must NOT do**: Fork simulation systems per chapter, re-teach all controls, turn source checking into a menu quiz, or contradict the fixed secret/reveal order.

  **Parallelization**: Can Parallel: YES within content ownership | Wave 6 | Blocks: 14, 15 | Blocked By: 12

  **References**:
  - Frozen content/action/enemy/scene schemas from Task 12.
  - `docs/reboot/story-bible.md` — chapter beats and reveal ledger.
  - `src/reboot/content/chapter1/*` — canonical content shape, not prose to duplicate.
  - [Encounter design](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/design-game-encounters/SKILL.md).

  **Acceptance Criteria**:
  - [ ] Chapter 2 and 3 content validates against frozen contracts and adds no chapter-name branches to shared runtime.
  - [ ] Each chapter has a distinct 30-second decision loop, two consequence echoes, one boss, one PATCH, and one foreshadowed reversal.
  - [ ] Fresh start and chapter-select fixtures complete in 25–35 minutes at desktop and touch baselines.

  **QA Scenarios**:
  ```text
  Scenario: Consequences travel across chapters
    Tool: E2E seeded paths
    Steps: Carry chapter-1 PURGE versus SECURE saves through chapters 2 and 3.
    Expected: Encounters/dialogue/evidence access differ predictably; neither path soft-locks or becomes strictly superior.
    Evidence: .omo/evidence/task-13-consequence-matrix.json

  Scenario: Dual-school state remains deterministic
    Tool: node replay + browser screenshots
    Steps: Switch chapter-3 reality layer during combat, pause, save, reload, and repeat input log.
    Expected: Same collision/enemy/evidence state and frame endpoints; no cross-layer invisible damage.
    Evidence: .omo/evidence/task-13-dual-school.png
  ```

  **Commit**: YES | Message: `feat(campaign): add copycat and dual-school chapters` | Files: chapter 2/3 content, new reusable enemy/encounter/level modules, tests and fixtures

- [ ] 14. Complete chapters 4 and 5, final boss, and consequence-driven endings

  **What to do**: Build chapter 4 `3초 승인실` around reverse-running the approval pipeline, Approval support enemies, and a choice between fast shutdown and preserving emergency-support records. Restore the player's full approval memory. Build chapter 5 `마지막 방송` as a route to the old broadcast room, Haru reunion, and final LUMEN+DOT protection boss using every learned verb. Implement three earned resolution states: redacted verified broadcast when Integrity requirements and protected evidence are met; raw disclosure when proof exists but Exposure is high/curation incomplete; sealed incident when evidence is insufficient or player chooses containment. Endings show concrete people/world changes and never label a moral grade.

  **Must NOT do**: Hide the best ending behind collectible grinding, reduce the finale to a dialogue menu, make DOT/LUMEN purely evil, or expose fictional private records for spectacle.

  **Parallelization**: Can Parallel: YES for chapter content, NO for ending integration | Wave 6 | Blocks: 15 | Blocked By: 12, 13

  **References**:
  - `src/finale.js` — legacy multi-responsibility thesis to preserve in a less didactic form.
  - `src/reboot/state/*` — authoritative Integrity/Exposure/Trust evaluation.
  - `docs/reboot/story-bible.md` — Haru, DOT, LUMEN, 윤서 arcs and final reveal ledger.
  - Task 8 boss phase/retry/reward contracts.

  **Acceptance Criteria**:
  - [ ] All five chapters complete in 2–3 hours on the canonical normal route; chapter fixtures remain individually runnable.
  - [ ] All three resolution states are reachable from documented action histories, produce distinct world/character outcomes, and save exactly once.
  - [ ] Final combat demands mastered actions and consequence preparation, not hidden arithmetic or a last-minute correct answer.

  **QA Scenarios**:
  ```text
  Scenario: Earned redacted broadcast
    Tool: full-campaign E2E
    Steps: Secure verified evidence, limit unrelated exposure, preserve support records, defeat final boss, broadcast.
    Expected: Redacted proof airs, Haru returns, DOT accepts consent limits, review channel opens; report cites actions, not score.
    Evidence: .omo/evidence/task-14-redacted-ending.webm

  Scenario: Imperfect path still resolves honestly
    Tool: full-campaign E2E
    Steps: Purge early evidence, use fast shutdown, reach final with incomplete integrity.
    Expected: Redacted ending is unavailable for explained in-world reasons; raw/seal resolutions remain playable with distinct costs and no scolding.
    Evidence: .omo/evidence/task-14-imperfect-ending.png
  ```

  **Commit**: YES | Message: `feat(campaign): complete approval room and final broadcast` | Files: chapter 4/5 content, Approval enemy, final boss, ending evaluator, tests and fixtures

- [ ] 15. Cut over production, update PWA/docs, and verify the exact deployed commit

  **What to do**: Update `index.html` to the reboot entry after full gates pass; keep a clearly labeled legacy build route for rollback during one release cycle. Version the service-worker cache and precache every required hashed reboot asset. Replace public hub/README/gameplay instructions and canonical story/design docs; archive obsolete material without erasing history. Update teacher/activity materials only after game canon is frozen, framing them as optional reflection rather than in-game instruction. Record all imported/generated/reference-only assets and licenses. Deploy the exact verified commit, inspect production separately, and record rollback target.

  **Must NOT do**: Deploy an unverified working tree, remove rollback access before one stable cycle, claim offline support without network-disabled proof, or leave the old six-chapter story described as current.

  **Parallelization**: Can Parallel: NO | Wave 6 | Blocks: Final verification | Blocked By: 1, 11, 12, 13, 14

  **References**:
  - `.github/workflows/pages.yml` — current GitHub Pages pipeline.
  - `public/sw.js` — cache/update behavior and story-specific cache name to replace.
  - `README.md`, `public/trilogy.html`, `docs/teacher-guide.md`, `docs/student-activity-sheet.md`, `docs/trilogy/*` — public/curriculum surfaces to synchronize.
  - `ASSET_LICENSES.md` — provenance ledger.
  - [Ship web games](https://github.com/MengTo/Skills/blob/21b278c62f49f3ce3d8c8ecbcc84cbcd534f3e49/agent-skills/game-development/ship-web-games/SKILL.md).

  **Acceptance Criteria**:
  - [ ] CI gates unit/build/smoke/E2E/visual/offline suites before Pages deployment.
  - [ ] Production URL passes load, first input, representative combat, save/continue, responsive, reduced-motion, console, performance, and offline read-back on the deployed commit.
  - [ ] Public docs name the five new chapters consistently, legacy canon is archived, and asset provenance is complete.
  - [ ] Rollback commit/tag and one-command recovery procedure are recorded and tested without deleting user saves.

  **QA Scenarios**:
  ```text
  Scenario: Exact production release is playable and offline
    Tool: deployment status + production browser
    Steps: Confirm deployed SHA, play through first encounter, continue save, install/cache, disable network, relaunch.
    Expected: SHA matches validated commit; interactions/assets/save/offline pass with zero console errors.
    Evidence: .omo/evidence/task-15-production-proof.webm

  Scenario: Rollback and service-worker update stay safe
    Tool: staging deploy + browser storage inspection
    Steps: Upgrade from legacy cache/save to reboot, then execute documented rollback on staging.
    Expected: No stale mixed assets, v3 backup and v4 data survive, both releases open through their documented route.
    Evidence: .omo/evidence/task-15-rollback.json
  ```

  **Commit**: YES | Message: `release: launch h17 null campaign` | Files: `index.html`, `public/sw.js`, workflow, public/docs surfaces, asset ledger, release notes

## Final Verification Wave

- [ ] F1. **Plan compliance audit** — 모든 Must Have/Must NOT Have와 15개 Task의 증거를 대조한다.
- [ ] F2. **Code quality review** — 책임별 모듈, 250 pure LOC, 결정적 상태, 자원 해제, 세이브 원자성을 검토한다.
- [ ] F3. **Real browser QA** — 데스크톱/터치/축소 동작/오프라인에서 전체 캠페인을 완주하고 콘솔·성능 증거를 남긴다.
- [ ] F4. **Scope fidelity check** — 퀴즈/설교/무단 외부 자산/백엔드/다크 패턴이 되돌아오지 않았음을 확인한다.

## Commit Strategy

- 구현 시작 전 현재 `fa1ac50`을 롤백 기준 태그로 보존하고 `reboot/v1` 브랜치에서 작업한다.
- 각 Task는 테스트와 구현을 함께 한 개의 작은 커밋으로 만든다.
- 버티컬 슬라이스 승인 전에는 기존 `index.html`과 서비스워커 정본을 교체하지 않는다.
- 캠페인 완주·오프라인·production read-back이 통과한 정확한 커밋만 `main`에 병합한다.

## Success Criteria

- 첫 30분이 독립된 액션 스릴러로 재미있고, 마지막 반전이 2장을 플레이할 동기를 만든다.
- AI 윤리 용어를 몰라도 플레이할 수 있지만, 플레이 후에는 빠른 삭제·무검토 승인·사생활 노출의 비용을 자신의 행동으로 설명할 수 있다.
- 새 구조에서 장/적/보스/결과 하나를 추가할 때 거대 중앙 파일에 분기를 추가하지 않는다.
- 저사양/터치/PWA 조건이 장식보다 전투 가독성과 입력 반응을 우선한다.
