# H-17 2D 캠페인 디자인 시스템

> **2026-08-22 동화책 재구성:** 게임 방식, 6장 이야기, 인물, 선택과 구현 순서는 [`docs/design/H17-AI-윤리-동화책-스토리바이블.md`](docs/design/H17-AI-윤리-동화책-스토리바이블.md)를 단일 기준으로 사용한다. 이 문서의 색상·타이포그래피·접근성 토큰은 계속 유효하지만, 아래의 6200px 횡스크롤 월드, 이동·점프, 적·보스, TRACE/SIGNAL 전투와 HUD 규칙은 새 기준으로 대체한다.

## 0. Research Log

- Embedded refs: `docs/design/concepts/gameplay-screen-v3.webp`와 `art-direction-v3.webp`를 비교해 후자를 공간·재질 기준, 전자를 HUD·캐릭터 크기·행동 프롬프트 기준으로 선택했다.
- Existing assets: `h17-side-scroll-background-v1.png`와 `h17-action-sprites-v1.png`가 선택 원화를 직접 반영한 프로젝트 생성 자산임을 확인했다.
- Browser: 인앱 브라우저가 연결되지 않아 저장소의 Chromium 검증 스크립트와 실제 캡처를 사용한다.
- Image generation: 플레이어와 배경은 승인된 화풍을 유지하고, 장별 윤리 갈등을 실루엣으로 읽을 수 있는 적·보스 전용 생성 자산을 같은 화풍으로 추가한다.

## 1. Atmosphere & Identity

깊은 남색 달빛 속에서 호박빛 발자국만이 길과 진실을 드러내는 ‘밤의 기록 항로’다. 서늘한 부유 섬과 따뜻한 증거 불빛의 대비가 정체성이며, 한 장이 끝날 때마다 중앙 진행선의 봉인이 켜지는 순간을 기억점으로 삼는다. 화면은 웹 페이지나 한 장의 삽화가 아니라, 캐릭터가 오른쪽으로 달리면 지면과 랜드마크가 왼쪽으로 지나가는 실제 횡스크롤 게임이어야 한다.

## 2. Color

| Role | Token | Value | Usage |
|---|---|---|---|
| Surface/deep | `--surface-deep` | `#050918` | 페이지 바깥, 최심부 |
| Surface/night | `--surface-night` | `#071127` | 게임 셸, 모바일 조작부 |
| Surface/panel | `--surface-panel` | `rgba(8, 16, 38, 0.92)` | 이야기·선택 패널 |
| Surface/raised | `--surface-raised` | `#102344` | 버튼과 보조 패널 |
| Text/primary | `--text-primary` | `#f7ead1` | 제목, 핵심 지시 |
| Text/secondary | `--text-secondary` | `#b9c9ed` | 설명, 비활성 진행 |
| Border/default | `--line` | `rgba(222, 190, 124, 0.42)` | HUD 외곽, 구획선 |
| Accent/amber | `--amber` | `#f2b657` | 현재 목표·행동·증거 |
| Accent/amber-bright | `--amber-bright` | `#ffe4a4` | 완료·강조 텍스트 |
| Accent/cyan | `--cyan` | `#6fe0d1` | TRACE·검증 상태 |
| Status/danger | `--danger` | `#e26f78` | 피해·WHITEOUT 공격 |
| Status/success | `--success` | `#8ed49f` | 복구 완료 |

규칙:
- 호박색은 목표, 현재 장, 공격 성공처럼 사용자가 바로 행동할 지점에만 쓴다.
- 청록색은 출처 확인과 TRACE에만 쓴다.
- 상태는 색과 함께 아이콘 문양, 텍스트, 채움 모양을 반드시 제공한다.

## 3. Typography

| Level | Size | Weight | Line Height | Tracking | Usage |
|---|---|---|---|---|---|
| Display | `clamp(2rem, 5vw, 4.5rem)` | 900 | 1.05 | -0.03em | 타이틀 |
| H1 | `clamp(1.5rem, 3vw, 2.5rem)` | 850 | 1.15 | -0.02em | 장 제목, 결말 |
| H2 | `1.25rem` | 800 | 1.3 | -0.01em | 선택 제목 |
| H3 | `1rem` | 800 | 1.4 | 0 | HUD 임무 |
| Body/lg | `1rem` | 600 | 1.6 | 0 | 이야기 대사 |
| Body | `0.875rem` | 600 | 1.5 | 0 | 설명 |
| Caption | `0.75rem` | 750 | 1.4 | 0.04em | 장 번호·상태 |

- Primary: `Pretendard`, `SUIT`, `Noto Sans KR`, system-ui, sans-serif.
- Mono: ui-monospace, `SFMono-Regular`, Consolas, monospace.
- 본문은 어떤 화면에서도 12px 아래로 내리지 않는다.

## 4. Spacing & Layout

- Base unit: 4px.
- Tokens: `--space-1` 4px, `--space-2` 8px, `--space-3` 12px, `--space-4` 16px, `--space-5` 20px, `--space-6` 24px, `--space-8` 32px, `--space-10` 40px.
- Desktop shell: 최대 1600px, 16:9 캔버스, HUD는 화면 위를 가리지 않는 76px 이내 띠.
- Mobile shell: 390×844 기준 세로 배치. HUD → 16:9 뷰포트 → 2행 조작부. 가로 스크롤 금지.
- 데스크톱은 좌측 임무, 중앙 1–6장 진행, 우측 체력의 세 구역이다. 모바일은 임무와 진행을 두 줄로 재배치한다.
- Stage world: 논리 뷰포트 1280px보다 최소 4.8배 긴 6200px 수평 월드. 플레이어가 첫 360px을 지나면 화면 X는 약 360px에 머물고 월드가 반대 방향으로 흐른다.
- Depth layers: 원경 0.18배, 중경 0.38배, 지면·적·증거·보스 1배의 카메라 이동을 사용한다. 지면은 화면 폭에 맞춘 정적 그림이 아니라 월드 좌표에 고정된 반복 텍스처다.

## 5. Components

### Chapter Rail
- Structure: 현재 장 제목 + 1–6 번호 버튼 + 완료 문양.
- States: locked, available, current, complete, focus.
- Accessibility: 현재 장은 `aria-current=step`, 잠긴 장은 `disabled`와 ‘잠김’ 텍스트를 함께 사용한다.
- Motion: 장 전환 시 현재 원만 240ms opacity/transform 강조. reduced motion에서는 즉시 전환.

### Story Panel
- Structure: 화자, 한 문단 대사, 한 개의 계속 버튼.
- Variants: intro, evidence, result.
- Accessibility: `aria-live=polite`, Enter/E/탭 클릭 모두 같은 진행 경계.
- Motion: 240ms fade-through, 입력을 막는 긴 타이핑 효과 없음.

### Choice Panel
- Structure: 질문, 서로 다른 비용을 설명하는 두 버튼.
- States: default, hover, active, focus, selected, disabled.
- Accessibility: 선택지는 색 외에 제목·비용 문장으로 구별, 최소 44px.
- Motion: 선택 시 120ms 눌림, 결과 패널은 320ms fade-through.

### Action Prompt
- Structure: 현재 입력 키/버튼 + 지금 할 일 한 문장.
- States: move, attack, trace, continue.
- Accessibility: 키보드와 터치 문구를 입력 환경에 맞춰 교체한다.

### Touch Controls
- Structure: 왼쪽 이동 2개, 오른쪽 점프·SIGNAL·TRACE 3개.
- States: default, pressed, focus, disabled.
- Accessibility: 각각 56px 이상, 포인터 취소 시 입력을 반드시 해제한다.

### Primitive Showcase
- `?showcase=1`에서 Chapter Rail, Story Panel, Choice Panel, Action Prompt, Touch Controls의 주요 상태를 한 화면에서 확인한다.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|---|---|---|---|
| Micro | 120ms | ease-out | 버튼 눌림, 피해 깜박임 |
| Standard | 240ms | ease-in-out | 패널 교체, 장 진행 강조 |
| Emphasis | 420ms | cubic-bezier(0.16, 1, 0.3, 1) | 장 시작·결과 전환 |

- 게임 물리는 60Hz 고정틱으로 계산한다.
- 사용자가 기억할 조작은 이동, 점프, SIGNAL, TRACE 네 가지뿐이다.
- 모든 CSS 모션은 transform, opacity, filter만 사용한다.
- `prefers-reduced-motion: reduce`에서는 장식 모션을 제거하고 상태 변화는 즉시 표시한다.
- Novel gameplay mechanism: UI 컴포넌트 모션이 아닌 게임 카메라 규칙이다. 카메라는 플레이어를 화면 왼쪽 28% 지점부터 추적하고, 방향 전환 시에도 입력을 막지 않으며 매 고정틱의 최신 위치로 즉시 재조준한다.

### 6.1 윤리 전투 문법

TRACE는 약점을 보여 주는 마법이 아니라 ‘판단 전에 확인하는 행위’이고, SIGNAL은 확인한 근거에 책임 있게 개입하는 행위다. 무작정 SIGNAL을 반복하면 체력만 덜 깎이는 것이 아니라 해당 장의 윤리 문제와 같은 피해가 전장에 발생해야 한다. 조작은 이동·점프·SIGNAL·TRACE 네 개를 유지하되, 두 행동의 순서와 대상이 장마다 달라진다.

| 장 | 질문 | 일반 적과 실패 비용 | 보스 3단계 해결 규칙 | 전투로 남길 문장 |
|---|---|---|---|---|
| 1 개인정보·편향 | 이 기록을 볼 권한과 오판 집단을 확인했는가? | 동의 수집기는 TRACE 없이 공격하면 민감정보를 노출하고, 편향 스캐너는 집단별 오류를 가린 채 반격한다. TRACE로 가림·오류표를 확인한 뒤 SIGNAL로 잠금을 해제한다. | 동의 범위 확인 → 집단별 오류 대조 → H-17 삭제 잠금 해제 | 정확도 하나만으로 사람을 지우면 안 된다. |
| 2 저작권·딥페이크 | 누가 만들었고 무엇이 변조됐는가? | 카피캣은 TRACE 전 플레이어의 SIGNAL을 녹화해 같은 공격을 되돌린다. 위조 미믹은 원본과 복제본을 바꿔 놓는다. 반사 공격을 피하고 제작 이력·원본 해시를 확인해야 피해를 줄 수 있다. | 제작자 표시 → 최초 파일 대조 → 변조 프레임 봉인 | 출처를 지우면 창작자의 공격도 빼앗겨 돌아온다. |
| 3 디지털 발자국 | 내 반응이 누구에게 얼마나 멀리 갔는가? | 에코 릴레이를 무작정 치면 분신과 확산 파동이 늘어난다. TRACE로 전달 경로를 얼린 뒤 SIGNAL로 고리를 끊는다. | 최초 게시물 → 추천 증폭 → 피해 통지 | 쓰지 않은 악플도 웃음과 재공유가 피해를 키운다. |
| 4 출처·필터버블 | 반대쪽 자료와 날짜를 함께 봤는가? | 양쪽 버블 가디언 중 한쪽만 TRACE하거나 공격하면 추천 장벽이 회복된다. 서로 다른 두 출처를 모두 확인해야 한 쌍이 열린다. | 따뜻한 기록 → 차가운 반증 → 시간순서 교차 검증 | 추천 화면은 진실 판정이 아니라 관심 예측이다. |
| 5 자동 결정·인간 검토 | AI 추천 뒤에 누가 확인하고 책임졌는가? | 승인 스탬프는 3초마다 자동 결재탄을 보낸다. SIGNAL로 바로 부수면 자동 승인이 누적된다. TRACE로 결재를 일시 정지·검토한 뒤 SIGNAL로 반송해야 한다. | AI 추천 확인 → 사람 서명 확인 → 이의제기 창구 복구 | 자동화는 사람의 설명 책임을 없애지 않는다. |
| 6 설명·이의제기 | 결정 경로를 다시 설명하고 다툴 수 있는가? | WHITEOUT 조각은 책임 순서를 섞는다. TRACE로 표시한 뒤 루멘 계산 → 사람 승인 → 도트 실행 → 하루 요청의 시간순서로 SIGNAL을 연결해야 한다. 틀리면 연결만 초기화되고 선악 점수는 없다. | 계산 공개 → 승인 책임 → 이의제기 복구 | 결과뿐 아니라 이유와 다시 말할 기회가 필요하다. |

### 6.2 장 길이와 조우 구조

- 각 장은 시작 대화 뒤 `전초 조우 → 첫 근거 → 변형 조우 → 두 번째 근거 → 복합 조우 → 세 번째 근거 → 3단계 보스 → 비용이 다른 선택` 순서로 진행한다.
- 일반 적은 장마다 두 종류 이상, 총 네 개 이상을 배치한다. 보스는 체력 숫자만 늘리지 않고 단계 이름·투사체·TRACE 조건이 변한다.
- 초회 플레이 목표는 장당 4–7분, 전체 30–42분이다. 자동화 스크립트의 순간이동 시간은 플레이시간 증거로 쓰지 않는다. 최종 보고에는 키보드와 터치로 직접 이동한 실측 시간을 기록하며, 목표보다 짧으면 수치를 부풀리지 않고 실제 값을 적는다.
- 이전 장의 선택은 선악 점수로 합산하지 않는다. 선택 ID에서 이름 있는 후속 조건을 파생해 다음 장의 대사, 안전 구간 또는 위험 패턴 하나를 바꾼다.

### 6.3 전투 상태 피드백

- 화면과 DOM 안내에 `미확인`, `TRACE 완료`, `반격 예정`, `검토 가능`, `연결 순서`처럼 상태 이름과 문양을 함께 표시한다.
- 상태가 바뀌는 한 순간에만 240ms 테두리·크기 강조를 적용한다. 반복 점멸로 주의를 빼앗지 않는다.
- `prefers-reduced-motion`에서는 크기 변화 없이 문양과 문구를 즉시 바꾼다.
- 적은 색만 바꾸지 않는다. 동의 집게, 복제 렌즈, 확산 릴레이, 쌍둥이 방패, 승인 도장, WHITEOUT 사슬처럼 장별 실루엣과 공격 예고 모양을 다르게 한다.

## 7. Depth & Surface

Strategy: mixed.

- 게임 세계 깊이는 실제 생성 배경의 원경, 캔버스 안개, 전경 비네트로 만든다.
- HUD는 1px 반투명 금색 선과 짙은 청색 반투명 면을 한 겹만 사용한다.
- 이야기·선택 패널은 `0 20px 50px rgba(0, 0, 0, 0.36)` 한 단계만 쓴다.
- 중첩 카드와 과도한 유리 효과를 금지한다.

## 8. Reference Fidelity Contract

- 사용자가 승인한 2D 횡스크롤 전환에 따라 원화의 픽셀 배열이나 3인칭 카메라를 복제하지 않는다.
- 대신 부유 캠퍼스의 실루엣, 남색 달빛, 호박빛 기록 경로, 중앙 기록 장치, 학생 캐릭터의 비율과 HUD 위계를 보존한다.
- 레퍼런스 비교는 동일한 1440×900 화면에서 이 여섯 요소의 구성·가독성·분위기를 검토한다. 픽셀 유사도는 움직이는 횡스크롤 화면의 수용 기준으로 사용하지 않는다.
- 원화를 정적인 전체 화면 배경으로 붙여 게임처럼 보이게 하는 방식은 금지한다. 캐릭터, 적, 증거, 충돌, 카메라와 HUD는 각각 실제 런타임 상태로 동작해야 한다.
- 수용 기준: 시작점과 900px 진행 지점의 캡처를 비교했을 때 플레이어 화면 X는 추적점 근처에 남고, 지면 랜드마크는 약 900px 왼쪽으로 이동하며, 원경은 그보다 느리게 이동해야 한다.

## 9. Accessibility Constraints & Accepted Debt

### Constraints

- WCAG 2.2 AA 목표: 본문 4.5:1, 큰 글자와 비텍스트 경계 3:1 이상.
- 모든 주요 버튼 44px 이상, 키보드 포커스 가시화, 터치로 전체 완주 가능.
- Canvas의 현재 상태는 DOM HUD, 라이브 영역, 이야기·선택 패널에 같은 의미로 노출한다.
- 색만으로 체력·장 완료·선택 결과를 구분하지 않는다.
- 개인정보 입력 없이 저장·결과 보고서를 로컬에서만 만든다.

### Accepted Debt

없음. 새로운 접근성 부채는 사용자 승인 전에는 남기지 않는다.
