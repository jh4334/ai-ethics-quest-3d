import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const charactersSource = readFileSync(new URL('../src/characters.js', import.meta.url), 'utf8');
const dungeonSource = readFileSync(new URL('../src/dungeon.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('keyboard interaction does not swallow native button activation keys', () => {
  assert.match(mainSource, /isFormControl/);
  // 폼 컨트롤 예외는 유지하되, 눌린 채 반복되는 키(event.repeat)는 확인/공격을 재발동하지 않는다.
  assert.match(mainSource, /!isFormControl && !event\.repeat && \(event\.code === 'KeyE'/);
});

test('final core runs the Noise->Nova finale and is terminal once completed', () => {
  // 최종장: 지운다/가르친다 선택을 거쳐 노바로 재탄생 → 증명서.
  assert.match(mainSource, /data-finale-choice/);
  assert.match(mainSource, /renderTeach|renderErase/);
  // 가르치면 검증된 완료 전이를 재사용해 코어를 완료하고 증명서를 띄운다.
  assert.match(mainSource, /completeFinalCore\(game\.progress, 'balanced-promise'\)/);
  assert.match(mainSource, /showCertificate\(game, ui\)/);
  // 이미 완료했다면 선택을 다시 묻지 않고 후일담을 보여준다.
  assert.match(mainSource, /if \(game\.progress\.aiCoreCompleted\)/);
});

test('touch controls expose all movement directions including down', () => {
  const downRule = cssSource.match(/\.touch-dpad \[data-touch="down"\] \{[\s\S]*?\}/)?.[0] ?? '';
  assert.match(downRule, /grid-row:\s*3/);
  assert.doesNotMatch(downRule, /display:\s*none/);
  assert.match(cssSource, /grid-template-rows:\s*repeat\(3, 48px\)/);
});

test('defeated boss does not become a full-HP re-fight, and certificate prints cleanly', () => {
  // 제압 후 대화를 닫아도 재전투가 아니라 선택 재개.
  assert.match(mainSource, /game\.finaleResolving = true/);
  assert.match(mainSource, /!game\.progress\.aiCoreCompleted && !game\.finaleResolving/);
  assert.match(mainSource, /if \(game\.finaleResolving\)/);
  // 증명서만 인쇄되도록 @media print 격리(단, 증명서가 열려 있을 때만 — 일지도 인쇄 가능).
  assert.match(cssSource, /@media print/);
  assert.match(cssSource, /body:has\(\.certificate:not\(\[hidden\]\)\)/);
  assert.match(cssSource, /\.certificate\[hidden\] \{\s*\n?\s*display: none !important/);
});

test('each zone has its own procedural corruption/heal (not one generic haze) and stays deterministic', () => {
  assert.match(mainSource, /ZONE_AURA_BUILDERS/);
  for (const name of ['buildPrivacyAura', 'buildBiasAura', 'buildCopyrightAura', 'buildDeepfakeAura']) {
    assert.match(mainSource, new RegExp(name));
  }
  // 전환은 구역별 t/ease로 오염↔치유를 보간한다.
  assert.match(mainSource, /aura\.animate\?\.\(elapsed, delta, ease\)/);
  // 결정성: 게임 로직(main.js)에는 Math.random을 쓰지 않는다(교실 재현성).
  assert.doesNotMatch(mainSource, /Math\.random/);
});

test('boss fight has depth: weak-point tool matching, weakness rotation, and dodgeable waves', () => {
  // 약점 색과 다른 도구는 튕겨 대미지가 없어야 한다.
  assert.match(mainSource, /activeToolId !== c\.weakToolId/);
  assert.match(mainSource, /function rotateWeakness/);
  // 잡음 파도 발사 + 회피 실패 시 스턴.
  assert.match(mainSource, /function fireNoiseWave/);
  assert.match(mainSource, /function staggerPlayer/);
  assert.match(mainSource, /c\.stun = STUN_TIME/);
  // 도구 전환(키보드/터치/벨트 탭).
  assert.match(mainSource, /function cycleActiveTool/);
  assert.match(mainSource, /function selectActiveTool/);
  assert.match(mainSource, /data-touch="tool"/);
});

test('controls are split: movement d-pad on the left, action/attack button on the right', () => {
  // 이동은 왼쪽 d-pad, 확인·공격은 오른쪽 A 버튼(젤다식 액션 배치).
  const controls = cssSource.match(/\.touch-controls \{[\s\S]*?\}/)?.[0] ?? '';
  assert.match(controls, /justify-content:\s*space-between/);
  assert.match(cssSource, /\.touch-a \{/);
  // 전투 중 공격을 '확인'과 분리해 처리한다.
  assert.match(mainSource, /function primaryAction/);
  assert.match(mainSource, /game\.combat\?\.active/);
  assert.match(mainSource, /function playerAttack/);
});

test('heroes use cel-shaded toon material with a code-generated nearest-filtered ramp (no asset files)', () => {
  // 셀 셰이딩: MeshToonMaterial + 코드 생성 그라디언트 램프(DataTexture).
  assert.match(charactersSource, /MeshToonMaterial/);
  assert.match(charactersSource, /gradientMap: TOON_RAMP/);
  // 램프는 Nearest 필터라야 계단식 밴딩이 살고, 수동 업로드 플래그가 필요하다.
  assert.match(charactersSource, /minFilter = THREE\.NearestFilter/);
  assert.match(charactersSource, /needsUpdate = true/);
  // 캐릭터엔 더 이상 PBR(MeshStandardMaterial) 머티리얼을 직접 만들지 않는다.
  assert.doesNotMatch(charactersSource, /MeshStandardMaterial/);
  // 램프는 코드 생성이므로 외부 텍스처 로드가 없어야 한다.
  assert.doesNotMatch(charactersSource, /TextureLoader|\.load\(/);
});

test('color-grading/vignette pass runs after bloom and before the OutputPass', () => {
  // 그레이딩 패스는 블룸 뒤·OutputPass(톤매핑) 앞의 리니어 공간에서 적용된다.
  const setup = mainSource.match(/function setupPostProcessing[\s\S]*?\n}/)?.[0] ?? '';
  const bloomIdx = setup.indexOf('composer.addPass(bloom)');
  const gradeIdx = setup.indexOf('composer.addPass(grade)');
  const outputIdx = setup.indexOf('new OutputPass()');
  assert.ok(bloomIdx >= 0 && gradeIdx >= 0 && outputIdx >= 0, 'all three passes present');
  assert.ok(bloomIdx < gradeIdx && gradeIdx < outputIdx, 'order must be bloom → grade → output');
  assert.match(setup, /renderState\.gradePass = grade/);
  // 셰이더는 정적 uniform만 — 시간·랜덤 없음(결정성).
  assert.match(setup, /vignetteStrength/);
});

test('entering a shrine loads a separate dungeon map (overworld hidden), not just an overlay', () => {
  // 사당 진입은 별도 맵 로드 — 오버월드 그룹을 통째로 숨기고 던전 룸을 씬에 추가한다.
  assert.match(mainSource, /renderState\.overworld = world/);
  assert.match(mainSource, /function enterDungeon/);
  assert.match(mainSource, /function exitDungeon/);
  assert.match(mainSource, /rs\.overworld\.visible = false/);
  assert.match(mainSource, /buildDungeonRoom\(topicId/);
  // 진입 라우터는 던전이 있으면 별도 맵으로, 없으면 오버레이 퍼즐로 폴백.
  assert.match(mainSource, /function enterShrineChallenge/);
  assert.match(mainSource, /hasDungeonRoom\(topicId\)/);
  // 던전 안에서는 던전 로직만 돌린다(오버월드 애니메이션 스킵).
  assert.match(mainSource, /game\.mode === 'dungeon'/);
  // 던전 표현 계층은 게임 로직처럼 결정적이어야 한다.
  assert.doesNotMatch(dungeonSource, /Math\.random/);
});

test('boss is a 4-phase fight keyed by the four shrine items', () => {
  // 4아이템 = 4페이즈: 사당에서 모은 도구가 각 껍질의 열쇠.
  assert.match(mainSource, /const PHASE_TOOLS = PROMISE_TOOLS\.map/);
  assert.match(mainSource, /const BOSS_MAX_HP = PHASE_HITS \* PHASE_TOOLS\.length/);
  // 도구 4개를 모두 모아야 전투 진입(입장 게이트, 남은 사당 안내).
  assert.match(mainSource, /owned\.length < PHASE_TOOLS\.length/);
  // 페이즈 격파 연출 + 페이즈별 파도 가속.
  assert.match(mainSource, /function breakBossShell/);
  assert.match(mainSource, /PHASE_FIRE\[c\.phase\]/);
});

test('prologue is short (2 beats) and skippable', () => {
  const storySource = readFileSync(new URL('../src/story.js', import.meta.url), 'utf8');
  const beats = storySource.match(/speakerKo:/g) ?? [];
  // PROLOGUE의 비트 수가 다시 늘어나 첫인상이 텍스트박스가 되지 않게.
  const prologueBlock = storySource.match(/export const PROLOGUE = \{[\s\S]*?\n\};/)?.[0] ?? '';
  assert.equal((prologueBlock.match(/speakerKo:/g) ?? []).length, 2);
  assert.match(mainSource, /data-prologue-skip/);
  void beats;
});

test('prologue cinematic is in-engine, deterministic, and hands the camera back', () => {
  // 인엔진 연출: 카메라 키프레임 플라이오버 + 레터박스 + 자막 카드(외부 영상 파일 0).
  assert.match(mainSource, /const CINEMATIC_KEYS = \[/);
  assert.match(mainSource, /function startPrologueCinematic/);
  assert.match(mainSource, /function updateCinematic/);
  assert.match(mainSource, /function finishPrologueCinematic/);
  // 자막은 PROLOGUE 비트를 재사용한다(스토리 데이터 단일 출처).
  assert.match(mainSource, /PROLOGUE\.beats\[key\]/);
  assert.match(cssSource, /\.cine-bar/);
  assert.match(cssSource, /\.cine-caption/);
  // 연출이 끝나면 카메라를 플레이어 추종 위치로 즉시 스냅해야 한다(활공 방지).
  assert.match(mainSource, /snapCamera\(game\.renderState\.camera, game\.player\.position\)/);
  // 시네마틱 동안에도 조작 게임 루프는 돌지 않는다(카메라 소유권 충돌 방지).
  assert.match(mainSource, /if \(game\.cinematic\) \{\s*\n\s*updateCinematic\(raw, game, renderState, ui\);/);
});

test('voyage: 항해 씬은 저사양·결정적이고 부두는 프롤로그 완료로 게이트된다', () => {
  const seaSource = readFileSync(new URL('../src/sea.js', import.meta.url), 'utf8');
  // 결정성 + 저사양: 랜덤 금지, 그림자 캐스터 0(밤바다는 발광 재질로 보정).
  assert.doesNotMatch(seaSource, /Math\.random/);
  assert.doesNotMatch(seaSource, /castShadow = true/);
  assert.match(seaSource, /emissive/);
  // 던전과 같은 수명주기: 오버월드 숨김 → dispose 재사용 → 복귀 시 톤 복원.
  assert.match(mainSource, /function enterVoyage/);
  assert.match(mainSource, /function exitVoyage/);
  assert.match(mainSource, /disposeDungeonRoom\(vg\.built\.root, rs\.scene\)/);
  // 부두 게이트: 노이즈를 가르치기 전엔 항해가 열리지 않는다.
  assert.match(mainSource, /type: 'dock'/);
  assert.match(
    mainSource.replace(/\s+/g, ' '),
    /if \(game\.progress\.aiCoreCompleted\) \{ enterVoyage\(game, ui\);/
  );
  // 열린 섬 판정은 항로 지도와 같은 getStageStates에서 나온다(데이터 단일 출처).
  assert.match(mainSource, /getStageStates\(game\.progress\)\.map/);
});

test('isle: 확장 섬 씬은 저사양·결정적이고 도착 서사는 visited 신호로 1회만', () => {
  const isleSource = readFileSync(new URL('../src/isle.js', import.meta.url), 'utf8');
  assert.doesNotMatch(isleSource, /Math\.random/);
  assert.doesNotMatch(isleSource, /castShadow = true/);
  // 던전·바다와 같은 수명주기 + 상륙·귀환 왕복.
  assert.match(mainSource, /function enterIsle/);
  assert.match(mainSource, /function exitIsle/);
  assert.match(mainSource, /disposeDungeonRoom\(isle\.built\.root, rs\.scene\)/);
  // 도착 서사는 세이브 v2 visited 신호로 첫 상륙에만.
  assert.match(mainSource, /stages\?\.\[stageId\]\?\.visited/);
  assert.match(mainSource, /markStageVisited\(game\.progress, stageId\)/);
  // 다중 섬: 씬 빌더 레지스트리 + 섬별 연출 데이터로 일반화.
  const registryBlock = isleSource.match(/export const ISLE_SCENES = \{[\s\S]*?\};/)?.[0] ?? '';
  assert.match(registryBlock, /'whisper-cape'/);
  assert.match(registryBlock, /'echo-cave'/);
  assert.match(registryBlock, /'hourglass-port'/);
  assert.match(mainSource, /ISLE_SCENES\[stageId\]\(/);
  assert.match(mainSource, /const ISLE_CONTENT = \{/);
  // built:true인 섬은 반드시 씬이 등록되어 있어야 한다(상륙 불가 섬 방지).
  assert.match(mainSource, /if \(ISLE_SCENES\[island\.id\]\)/);
});

test('corridor: 회랑 도전은 순수 로직 + F 가드 라우팅 + 완료 전이', () => {
  const corridorSource = readFileSync(new URL('../src/corridorLogic.js', import.meta.url), 'utf8');
  // 순수 로직: THREE 무의존 + 랜덤 금지(결정적 발사 순서·타이밍).
  assert.doesNotMatch(corridorSource, /from 'three'/);
  assert.doesNotMatch(corridorSource, /Math\.random/);
  // F키·터치 도구버튼이 회랑 가드로 이어진다.
  assert.match(mainSource, /game\.isle\?\.challenge && !game\.isle\.challenge\.cleared/);
  assert.match(mainSource, /function corridorGuard/);
  assert.match(mainSource, /game\.dungeon\?\.active \|\| game\.isle\?\.challenge/);
  // 클리어 → 정령 치유 + 스테이지 완료 기록(항로 지도 전이).
  assert.match(mainSource, /function finishCorridor/);
  assert.match(mainSource, /markStageCompleted\(game\.progress, isle\.stageId\)/);
  assert.match(mainSource, /healSpiritVisuals\(isle\.built\)/);
});

test('rumor wall: 순수 로직 + 종 라우팅 + blind 강제 + 완료 전이', () => {
  const rumorSource = readFileSync(new URL('../src/rumorLogic.js', import.meta.url), 'utf8');
  const isleSrc = readFileSync(new URL('../src/isle.js', import.meta.url), 'utf8');
  // 순수 로직 + 결정성(라운드 원본 고정 시퀀스).
  assert.doesNotMatch(rumorSource, /from 'three'/);
  assert.doesNotMatch(rumorSource, /Math\.random/);
  assert.match(rumorSource, /rounds: \['s3', 's0', 's2'\]/);
  // 돌 좌표는 로직이 단일 출처 — 표현 계층이 읽는다.
  assert.match(isleSrc, /RUMOR\.stones\.forEach/);
  // F = 섬별 동사 디스패치(메아리 동굴 = 종).
  assert.match(mainSource, /rumorBell\(game, ui\)/);
  assert.match(mainSource, /function rumorBell/);
  // 울림 없이 고르면 평가하지 않는다(검증 습관) + 클리어 → 완료 기록.
  assert.match(rumorSource, /return \['blind'\]/);
  assert.match(mainSource, /function finishRumor/);
  assert.match(mainSource, /isle\.built\.heal\(\)/);
});

test('dunes: 순수 로직 + 나침반 라우팅 + 타이밍 잠금 + 완료 전이', () => {
  const dunesSource = readFileSync(new URL('../src/dunesLogic.js', import.meta.url), 'utf8');
  const isleSrc2 = readFileSync(new URL('../src/isle.js', import.meta.url), 'utf8');
  assert.doesNotMatch(dunesSource, /from 'three'/);
  assert.doesNotMatch(dunesSource, /Math\.random/);
  // 모래시계 좌표·주기는 로직이 단일 출처 — 표현 계층이 읽는다.
  assert.match(isleSrc2, /DUNES\.glasses\.forEach/);
  // F = 섬별 동사 디스패치(모래시계 항구 = 당기기) + 잠금은 창 안에서만.
  assert.match(mainSource, /dunesPull\(game, ui\)/);
  assert.match(dunesSource, /lockWindow/);
  assert.match(mainSource, /function finishDunes/);
});

test('stage frame: 순수 데이터 모듈 + 세이브 v2 + 항로 지도', () => {
  const stageSource = readFileSync(new URL('../src/stageData.js', import.meta.url), 'utf8');
  const worldSource = readFileSync(new URL('../src/worldData.js', import.meta.url), 'utf8');
  // 스테이지 데이터는 THREE 무의존 순수 모듈이어야 한다(node 테스트 가능).
  assert.doesNotMatch(stageSource, /from 'three'/);
  assert.match(stageSource, /export const STAGES = \[/);
  // 세이브 v2: version + stages 맵, 프롤로그 완료는 기존 신호에서 파생(중복 기록 금지).
  assert.match(worldSource, /version: 2/);
  assert.match(worldSource, /stages: normalizeStages\(candidate\.stages\)/);
  assert.match(stageSource, /aiCoreCompleted === true/);
  // 탐험 노트의 항로 지도.
  assert.match(mainSource, /data-voyage-map/);
  assert.match(cssSource, /\.voyage-list/);
});

test('bias room is colorblind-accessible: each seed color has a distinct shape', () => {
  // 색으로만 구분하면 색약 학생이 편향 방을 풀 수 없다 — 색+모양 병행.
  assert.match(dungeonSource, /const SEED_GEOS = \[/);
  assert.match(dungeonSource, /SEED_GEOS\[d\.colorIdx\]/);
  assert.match(dungeonSource, /bloom\.geometry = SEED_GEOS\[colorIdx\]/);
});

test('certificate has a handwriting name line (no input — privacy stays zero)', () => {
  assert.match(mainSource, /cert-name-line/);
  const nameRule = cssSource.match(/\.cert-name-line \{[\s\S]*?\}/)?.[0] ?? '';
  assert.match(nameRule, /border-bottom/);
  // 이름을 입력받는 코드가 아니어야 한다(개인정보 0 정책).
  assert.doesNotMatch(mainSource, /<input[^>]*name/);
});

test('scene BGM: three procedural layers crossfade on dungeon/boss transitions (no assets, no timers)', () => {
  const audioSource = readFileSync(new URL('../src/audio.js', import.meta.url), 'utf8');
  // 3레이어(오버월드/던전/보스) + 크로스페이드 API.
  assert.match(audioSource, /setMusicMode/);
  assert.match(audioSource, /MUSIC_LEVEL = \{ overworld:/);
  assert.match(audioSource, /function applyMusicMode/);
  // 리듬은 setInterval/타이머가 아니라 LFO 게이팅 — 결정적이고 저렴하다.
  assert.match(audioSource, /gateHz/);
  assert.doesNotMatch(audioSource, /setInterval/);
  assert.doesNotMatch(audioSource, /Math\.random/);
  // 장면 전환 지점에서 모드가 바뀐다: 던전 진입·퇴장, 보스 시작·격파.
  assert.match(mainSource, /setMusicMode\?\.\('dungeon'\)/);
  assert.match(mainSource, /setMusicMode\?\.\('boss'\)/);
  assert.ok((mainSource.match(/setMusicMode\?\.\('overworld'\)/g) ?? []).length >= 2);
});

test('mobile HUD stays minimal: one-line objective, small popups, clamped dungeon/boss panels', () => {
  const mobile = cssSource.match(/@media \(pointer: coarse\), \(max-width: 760px\) \{[\s\S]*?\n\}\n/g)?.join('') ?? '';
  // 목표 칩은 모바일에서 한 줄로(작은 화면에서 조작 공간 확보).
  assert.match(mobile, /\.objective-chip p:last-child \{[\s\S]*?-webkit-line-clamp: 1/);
  // 전투 팝업·던전 목표·보스 말풍선은 축소/클램프.
  assert.match(mobile, /\.combat-popup \{[\s\S]*?font-size: 1\.35rem/);
  assert.match(mobile, /\.puzzle-goal \{[\s\S]*?-webkit-line-clamp: 1/);
  assert.match(mobile, /\.boss-memory \{[\s\S]*?-webkit-line-clamp: 2/);
  // 수업 차시 칩은 모바일에서 숨긴다(교사용 정보).
  assert.match(mobile, /\.class-hint \{\s*\n?\s*display: none/);
});

test('tool verbs exist: shield guard reflects waves, compass pulls crates (items are verbs, not keys)', () => {
  // 동사 시스템 진입점 + F키/터치 도구버튼 라우팅.
  assert.match(mainSource, /function useToolVerb/);
  assert.match(mainSource, /event\.code === 'KeyF'/);
  // 방패 가드: 가드 중 파도 명중은 스턴 대신 반사.
  assert.match(mainSource, /function shieldGuard/);
  assert.match(mainSource, /hit && c\.guard > 0/);
  // 나침반 당기기: 시선 직선 탐색 후 플레이어 쪽으로 한 칸(발밑 금지).
  assert.match(mainSource, /function compassPull/);
  assert.match(mainSource, /firstCrateInLine\(dg\.topicId/);
});

test('all four verbs are wired: bell shockwave/resonance and mirror reveal/lens', () => {
  // 전투: 종 = 파도·예고 광역 소거(쿨다운), 거울 = 이번 껍질 약점 공개.
  assert.match(mainSource, /function bellShockwave/);
  assert.match(mainSource, /c\.bellCd = BELL_COOLDOWN/);
  assert.match(mainSource, /function mirrorReveal/);
  // 던전: 잡기 방 종 공명(어긋난 자리 반짝), 빛 방 거울 렌즈(가짜만 흔들림).
  assert.match(mainSource, /function bellResonate/);
  assert.match(mainSource, /function mirrorTruthLens/);
  assert.match(mainSource, /dg\.lensT > 0 && !orb\.real/);
});

test('package engine range matches the locked Vite runtime floor', () => {
  assert.equal(packageJson.engines.node, '^20.19.0 || >=22.12.0');
});

test('visibility restore keeps the game paused while a dialog is open', () => {
  assert.match(mainSource, /game\.paused = document\.hidden \|\| !ui\.dialog\.hidden/);
});

test('mobile progress panel is a slim top bar (not overlapping the touch d-pad)', () => {
  const mobileStatusRule = cssSource.match(/@media \(pointer: coarse\), \(max-width: 760px\) \{[\s\S]*?\.status-strip \{[\s\S]*?\}/)?.[0] ?? '';
  // 하단 d-pad와 겹치지 않도록 상단에 배치하고 가로 슬림 바로 만든다.
  assert.match(mobileStatusRule, /top:\s*64px/);
  assert.match(mobileStatusRule, /flex-direction:\s*row/);
});

test('mobile interaction prompt is positioned beside rather than under touch controls', () => {
  const mobilePromptRule = cssSource.match(/@media \(pointer: coarse\), \(max-width: 760px\) \{[\s\S]*?\.interaction-prompt \{[\s\S]*?\}/)?.[0] ?? '';
  assert.match(mobilePromptRule, /right:\s*172px/);
  assert.match(mobilePromptRule, /transform:\s*none/);
});
