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
