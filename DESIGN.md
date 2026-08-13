# H-17 2D 캠페인 디자인 시스템

## 0. Research Log

- Embedded refs: `docs/design/concepts/gameplay-screen-v3.webp`와 `art-direction-v3.webp`를 비교해 후자를 공간·재질 기준, 전자를 HUD·캐릭터 크기·행동 프롬프트 기준으로 선택했다.
- Existing assets: `h17-side-scroll-background-v1.png`와 `h17-action-sprites-v1.png`가 선택 원화를 직접 반영한 프로젝트 생성 자산임을 확인했다.
- Browser: 인앱 브라우저가 연결되지 않아 저장소의 Chromium 검증 스크립트와 실제 캡처를 사용한다.
- Image generation: 이미 선택 원화에서 생성된 전용 배경·스프라이트가 있어 새 화풍을 만들지 않고 재사용한다.

## 1. Atmosphere & Identity

깊은 남색 달빛 속에서 호박빛 발자국만이 길과 진실을 드러내는 ‘밤의 기록 항로’다. 서늘한 부유 섬과 따뜻한 증거 불빛의 대비가 정체성이며, 한 장이 끝날 때마다 중앙 진행선의 봉인이 켜지는 순간을 기억점으로 삼는다. 화면은 웹 페이지가 아니라 한 장의 영화적인 횡스크롤 게임 화면처럼 보여야 한다.

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

## 9. Accessibility Constraints & Accepted Debt

### Constraints

- WCAG 2.2 AA 목표: 본문 4.5:1, 큰 글자와 비텍스트 경계 3:1 이상.
- 모든 주요 버튼 44px 이상, 키보드 포커스 가시화, 터치로 전체 완주 가능.
- Canvas의 현재 상태는 DOM HUD, 라이브 영역, 이야기·선택 패널에 같은 의미로 노출한다.
- 색만으로 체력·장 완료·선택 결과를 구분하지 않는다.
- 개인정보 입력 없이 저장·결과 보고서를 로컬에서만 만든다.

### Accepted Debt

없음. 새로운 접근성 부채는 사용자 승인 전에는 남기지 않는다.
