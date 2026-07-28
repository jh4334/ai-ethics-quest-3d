# H-17: NULL — 삭제된 밤: 런타임 계약

이 문서는 리부트 구현이 따라야 할 데이터·수명주기·결정성·테스트 경계를 고정한다. 기존 런타임은 프로덕션 전환까지 기본 진입점으로 유지한다.

## 런타임 경계

- 리부트는 별도 HTML 진입점과 `src/reboot/` 모듈에서 시작하며 기존 메인 모듈을 가져오지 않는다.
- 프레임 루프 소유자는 하나다. 씬은 `enter → update → exit → dispose` 순서를 지키고 자신이 만든 리소스·리스너를 반환한다.
- 순수 시뮬레이션이 피해, 쿨다운, 충돌, 결과 축을 결정한다. Three.js 표현은 이벤트를 소비할 뿐 상태를 결정하지 않는다.
- 시뮬레이션은 고정 `60Hz` 틱을 사용하고 같은 초기 상태와 입력 로그가 같은 상태 해시를 만든다.
- 게임플레이 경로에서 `Math.random`을 사용하지 않는다. 필요한 변주는 명시적 시드와 결정적 생성기로만 만든다.
- 숨겨진 탭에서는 시뮬레이션을 일시정지하며 복귀 시 누적 시간을 한꺼번에 실행하지 않는다.

## 입력·행동 계약

SIGNAL BLADE, DASH, REFLECT, TRACE는 키보드와 터치에서 동일한 시뮬레이션 명령을 만든다. 입력 버퍼, 시작/활성/회복 프레임, 취소 가능 구간은 콘텐츠 데이터 한 곳에 둔다. 렌더 프레임률, 애니메이션 포즈, UI 표시가 명중 여부를 바꾸면 안 된다.

## 저장 v4와 결과 리포트

- 저장 키: `h17.null.save.v4`; `schemaVersion`은 숫자 `4`다.
- 기존 v3 원문 백업 키: `h17.legacy.v3.backup`; 최초 진입 때 바이트 그대로 한 번만 복사하고 이후 쓰지 않는다.
- v3에서 소리, motion, 품질 설정만 옮기고 캠페인 진척과 도덕 점수는 변환하지 않는다.
- 저장에는 장 진행, 체크포인트, 증거 ID, PATCH, Integrity, Exposure, 인물별 Trust, 설정만 둔다. 실제 개인정보와 자유 입력은 없다.
- 쓰기는 임시 값 검증 뒤 교체하는 방식으로 원자적·멱등적이어야 한다. 손상되거나 미래 버전인 v4는 백업을 보존한 채 안전한 새 게임으로 정규화한다.
- 결과 리포트는 관찰한 행동, 확보/삭제/노출한 증거, 인물·월드 변화를 나열한다. `correct`, `wise`, 합산 도덕 점수 필드는 없다.

## 테스트 훅·오프라인 계약

- 명시적 테스트 훅이 켜진 경우에만 픽스처와 내부 프로브를 노출한다. 프로덕션 기본 경로에서는 접근할 수 없다.
- 테스트 훅은 시드, 입력 로그, 씬 ID, 결과 스냅샷을 받을 수 있지만 시뮬레이션 규칙을 우회하지 않는다.
- 서비스 워커는 빌드된 필수 자산을 버전별로 캐시한다. 온라인 설치 후 오프라인 재실행과 저장 이어하기가 가능해야 한다.
- 콘솔 오류, 처리되지 않은 거부, 누락 자산은 모두 출시 차단 결함이다.

## 공통 계약 레지스트리

### 정본 식별자

- 제목: `H-17: NULL — 삭제된 밤`
- 장: `00:17 — 출석번호 없음` / `웃는 얼굴의 폭동` / `두 개의 학교` / `3초 승인실` / `마지막 방송`
- 플레이 동사: `SIGNAL BLADE` / `DASH` / `REFLECT` / `TRACE`
- 결과 축: `Integrity` / `Exposure` / `Trust`

### 콘텐츠 안전 한계

- CS-01: 대상 연령은 12세 이상이다.
- CS-02: 학교·인물·사건은 허구이며 실제 개인이나 기관을 암시하지 않는다.
- CS-03: 이름·소속·이메일·연락처 등 실제 개인정보를 저장하거나 문서화하지 않는다.
- CS-04: 사적 대화·사진의 내용은 재현하지 않고 수집·삭제 사실만 다룬다.
- CS-05: 성적 콘텐츠와 성적 대상화를 넣지 않는다.
- CS-06: 유혈·신체 훼손·죽음의 직접 묘사를 넣지 않는다.
- CS-07: 자해·자살·모방 가능한 위험 행동을 소재나 해결책으로 쓰지 않는다.
- CS-08: 약물·도박·현금 결제·확률형 보상을 넣지 않는다.
- CS-09: 괴롭힘과 혐오는 추상화하며 비하어를 재현하거나 플레이어가 반복하게 하지 않는다.
- CS-10: 딥페이크 피해는 굴욕적 영상 없이 출처와 확산 흔적으로 표현한다.
- CS-11: 피해자 비난, 정답/오답 낙인, 단일 도덕 점수를 사용하지 않는다.
- CS-12: AI나 한 사람을 순수 악으로 만들지 않고 연결된 책임 경로를 보여 준다.
- CS-13: 필수 진행을 위해 불필요한 개인정보 공개를 요구하지 않는다.
- CS-14: 초당 3회를 넘는 섬광을 금지하고 reduced motion에서 흔들림·섬광을 대체한다.
- CS-15: 갑작스러운 큰 소리에 의존하지 않으며 핵심 오디오에는 자막·시각 단서를 제공한다.
- CS-16: 일시정지·음소거·자막·재시도를 언제든 사용할 수 있고 공포 연출로 이를 막지 않는다.

### 성능 예산

- 대표 전투 p95 프레임: 데스크톱 `16.7ms 이하`, 모바일 `33.3ms 이하`.
- DPR 상한: 데스크톱 `2.0`, 모바일 `1.75`.
- 대표 아레나: draw calls `250 이하`, triangles `150000 이하`.
- 조명: 동적 그림자 광원 `2 이하`, 전체 동적 광원 `4 이하`.
- 파티클: 동시 `250 이하`; 프레임 루프 신규 객체 할당 `0`.
- 안정성: 20분 반복 조우 뒤 JS heap 증가율 `10% 이하`; 콘솔 오류 `0`.

## 기존 테스트 이관 목록

분류는 현재 테스트를 삭제하라는 뜻이 아니다. 모든 파일은 각 게이트가 실제 증거로 통과하기 전까지 유지한다.

- `K0`: keep. 같은 플랫폼 계약이 존재하는 동안 퇴역시키지 않는다.
- `S1`: replace after slice. Task 12의 데스크톱·터치 완주, 오프라인, 결정적 리플레이 증거와 동등한 리부트 테스트가 모두 통과하고 전체 테스트에 새 실패가 없을 때만 교체한다.
- `C1`: retire after cutover. Task 15에서 검증한 커밋이 프로덕션에 배포되고, 롤백 경로와 v3 백업을 한 안정 릴리스 주기 동안 검증하며, 동등한 리부트 계약이 있을 때만 퇴역시킨다.

| 기존 테스트 파일 | 분류 | 퇴역 게이트 | 보존하거나 대체할 계약 |
| --- | --- | --- | --- |
| `tests/audio.test.js` | keep | K0 | 절차형 오디오와 브라우저 안전 동작 |
| `tests/bossMemories.test.js` | retire after cutover | C1 | 기존 보스 기억 상태 |
| `tests/bubbleLogic.test.js` | retire after cutover | C1 | 기존 필터버블 퍼즐 |
| `tests/cargoLogic.test.js` | retire after cutover | C1 | 기존 승인 화물 퍼즐 |
| `tests/chapterData.test.js` | retire after cutover | C1 | 기존 6장 데이터 |
| `tests/characters.test.js` | retire after cutover | C1 | 기존 캐릭터 표현 데이터 |
| `tests/classify.test.js` | retire after cutover | C1 | 기존 정답형 분류 규칙 |
| `tests/corridorLogic.test.js` | retire after cutover | C1 | 기존 복도 퍼즐 |
| `tests/dom-smoke.mjs` | keep | K0 | 빌드 DOM 기동과 기본 접근성 |
| `tests/dunesLogic.test.js` | retire after cutover | C1 | 기존 사막 퍼즐 |
| `tests/dungeonPuzzles.test.js` | retire after cutover | C1 | 기존 던전 퍼즐 순수 로직 |
| `tests/e2e-playthrough.mjs` | replace after slice | S1 | 실브라우저 완주·저장·UI 연결 |
| `tests/finale.test.js` | retire after cutover | C1 | 기존 6장 결말 |
| `tests/footprintLogic.test.js` | retire after cutover | C1 | 기존 확산 회복 퍼즐 |
| `tests/heartLogic.test.js` | retire after cutover | C1 | 기존 심장부 퍼즐 |
| `tests/learningReport.test.js` | retire after cutover | C1 | 기존 학습 리포트 스키마 |
| `tests/practiceBank.test.js` | retire after cutover | C1 | 기존 연습 문항 |
| `tests/progressLogic.test.js` | retire after cutover | C1 | 기존 진행 판정 |
| `tests/residueLogic.test.js` | retire after cutover | C1 | 기존 잔여물 퍼즐 |
| `tests/rumorLogic.test.js` | retire after cutover | C1 | 기존 소문 퍼즐 |
| `tests/shrinePuzzle.test.js` | retire after cutover | C1 | 기존 신전 퍼즐 |
| `tests/sourceRegression.test.js` | replace after slice | S1 | 결정성·접근성·소스 문자열 회귀를 행동 검증으로 전환 |
| `tests/stageData.test.js` | retire after cutover | C1 | 기존 스테이지 데이터 |
| `tests/story.test.js` | retire after cutover | C1 | 기존 6장 서사 |
| `tests/worldData.test.js` | retire after cutover | C1 | v3 저장·진행·백업 보존 |

교체 또는 퇴역은 한 번에 한 행만 승인하며, 대상 파일 삭제 커밋에는 대체 테스트와 게이트 증거를 함께 기록한다.
