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

test('voyage guide: 화살표가 다음 목적지를 가리키고, 출항 브리지·기억 조각 서사가 이어진다', () => {
  const seaSrc = readFileSync(new URL('../src/sea.js', import.meta.url), 'utf8');
  const worldSrc = readFileSync(new URL('../src/worldData.js', import.meta.url), 'utf8');
  // 가이드 화살표: 표현은 sea.js, 목적지 판정(첫 '진행 중' 섬)은 main.
  assert.match(seaSrc, /guideArrow/);
  assert.match(mainSource, /find\(\(s\) => s\.state === 'current'\)/);
  assert.match(mainSource, /arrow\.rotation\.y = Math\.atan2\(dx, dz\)/);
  // 첫 출항 브리지 서사(1회) — 스키마에 voyageIntroSeen 추가(기존 필드 불변).
  assert.match(worldSrc, /voyageIntroSeen: candidate\.voyageIntroSeen === true/);
  assert.match(mainSource, /voyageIntroSeen: true/);
  // 기억 조각 관통 서사: 3섬 치유에 심고 심장·엔딩에서 회수한다.
  assert.match(mainSource, /아무도 나에게 말을 걸어 주지 않았어/);
  assert.match(mainSource, /진짜 내가 누군지 잊어버렸어/);
  assert.match(mainSource, /멈추는 법을 배운 적이 없어서/);
  assert.match(mainSource, /전부 별이 되어 돌아오고 있어/);
});

test('living world(Z1): 풀 흔들림·앰비언트 생물·블롭 그림자가 결정적으로 존재한다', () => {
  const charSrc = readFileSync(new URL('../src/characters.js', import.meta.url), 'utf8');
  // 풀 해류 바람 — 인스턴스 위치 위상 + uTime 정점 셰이더(CPU 무비용).
  assert.match(mainSource, /swayPhase = instanceMatrix\[3\]\.x/);
  assert.match(mainSource, /uTime \* 1\.9 \+ swayPhase/);
  // 앰비언트 생물: 비트나비·소식 갈매기·굴뚝 연기 — elapsed 기반 결정적 궤도.
  const lifeBlock = mainSource.match(/function createAmbientLife[\s\S]*?\n\}\n/)?.[0] ?? '';
  assert.ok(lifeBlock.includes('butterflies'), 'createAmbientLife에 비트나비');
  assert.ok(lifeBlock.includes('gulls'), 'createAmbientLife에 갈매기');
  assert.ok(lifeBlock.includes('puffs'), 'createAmbientLife에 연기 퍼프');
  assert.doesNotMatch(lifeBlock, /Math\.random/);
  // 블롭 그림자 — 그림자 캐스터 없이 접지감. 플레이어·NPC에 부착.
  assert.match(charSrc, /export function makeBlobShadow/);
  assert.match(charSrc, /g\.add\(makeBlobShadow\(0\.46\)\)/);
  assert.match(charSrc, /g\.add\(makeBlobShadow\(0\.52\)\)/);
});

test('ceremony(Z2): 획득 의식 + 팡파레 + 오버월드 멜로디가 결정적으로 존재한다', () => {
  const audioSrc = readFileSync(new URL('../src/audio.js', import.meta.url), 'utf8');
  const cssSrc = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  // 획득 의식 — 도구(공통 헬퍼: 던전 제단·사당 통과)와 관문 조각 경로에서 호출.
  assert.match(mainSource, /function showItemCeremony/);
  assert.match(mainSource, /function showToolCeremony/);
  const toolCalls = mainSource.match(/showToolCeremony\(game, ui, /g) ?? [];
  assert.ok(toolCalls.length >= 2, `도구 의식 호출 ${toolCalls.length}곳(던전 제단·사당)`);
  // 순수 연출 — 입력을 가로채면 안 된다.
  assert.match(cssSrc, /\.ceremony \{[\s\S]*?pointer-events: none;/);
  // 팡파레 + 멜로디: 악보는 고정 배열(결정적), 오디오 파일 0.
  assert.match(audioSrc, /playFanfare\(\)/);
  // 멜로디는 씬별 고정 악보 레이어(오버월드·항해·보스)로 일반화(루프4).
  assert.match(audioSrc, /function startMelodyLayers/);
  assert.match(audioSrc, /layer: musicLayers\.voyage/);
  assert.match(audioSrc, /layer: musicLayers\.boss/);
  assert.match(audioSrc, /voyage: 0\.06/);
  assert.match(mainSource, /setMusicMode\?\.\('voyage'\)/);
  assert.doesNotMatch(audioSrc, /Math\.random/);
  // 멜로디 큐는 타이머가 아니라 게임 루프가 채운다(오디오 클록 예약 = 샘플 정확 박자).
  assert.match(audioSrc, /tickMusic/);
  assert.match(mainSource, /audio\?\.tickMusic\?\.\(\)/);
});

test('data currents(Z3): 열린 항로 입자 해류·줄무늬·접속 링이 항해 씬에 존재한다', () => {
  const seaSrc = readFileSync(new URL('../src/sea.js', import.meta.url), 'utf8');
  // 해류는 '연속으로 열린 두 섬' 사이에만 — 안개 섬으로는 정보가 흐르지 않는다(컨셉 규칙).
  assert.match(seaSrc, /islands\[i\]\.open && islands\[i \+ 1\]\.open/);
  assert.match(seaSrc, /THREE\.Points\(/);
  assert.match(seaSrc, /streaks/);
  assert.match(seaSrc, /connectRings/);
  assert.doesNotMatch(seaSrc, /Math\.random/);
  // 구동은 updateVoyage에서 elapsed 기반(결정적).
  assert.match(mainSource, /vg\.built\.currents/);
  assert.match(mainSource, /vg\.built\.streaks/);
  assert.match(mainSource, /vg\.built\.connectRings/);
});

test('lighthouse(Z4): 진실의 등대 — 진행도 광선·유도등·대화가 존재한다', () => {
  // 세로 랜드마크 + 광선 = 치유한 스테이지 수(진행도가 풍경에 기록).
  assert.match(mainSource, /function createLighthouse/);
  assert.match(mainSource, /game\.beaconCount = getStageStates\(game\.progress\)\.filter/);
  assert.match(mainSource, /lighthouseBeams/);
  // 부두→등대→코어 유도등(활주로 등화 문법) + 등대 대화.
  assert.match(mainSource, /guideLights/);
  assert.match(mainSource, /type === 'lighthouse'/);
  assert.match(mainSource, /진실의 등대/);
});

test('bottles(Z5): 지식의 유리병 12개 — 결정적 배치·세이브·도감이 존재한다', () => {
  const worldSrc = readFileSync(new URL('../src/worldData.js', import.meta.url), 'utf8');
  // 데이터 단일 출처(worldData) — 12개, 스키마는 필드 추가만.
  assert.match(worldSrc, /export const KNOWLEDGE_BOTTLES/);
  assert.match(worldSrc, /knowledgeBottles: \[\.\.\.new Set\(stringArray\(candidate\.knowledgeBottles\)/);
  assert.match(worldSrc, /export function collectKnowledgeBottle/);
  // 수집 경로 + 도감(항해일지) + 완집 안내.
  assert.match(mainSource, /type === 'bottle'/);
  assert.match(mainSource, /function createKnowledgeBottles/);
  assert.match(mainSource, /항해일지 — 지식의 유리병/);
});

test('return hook(R-루프9): 복귀 시 진척 리캡으로 재참여(스트릭 압박 없이)', () => {
  const cssSrc = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  // 진행 중 세이브가 있으면 성취 리캡을 반갑게 되짚는다.
  assert.match(mainSource, /다시 온 걸 환영해, 수호자/);
  assert.match(mainSource, /title-recap/);
  assert.match(mainSource, /윤리 조각 \$\{summary\.collected\}/);
  assert.match(cssSrc, /\.title-recap \{/);
  // 정보형 재참여 — 결석 처벌형 스트릭 문구가 없다.
  assert.doesNotMatch(mainSource, /연속 출석|스트릭이 끊/);
});

test('collection(R-루프8): 유리병 근접 반짝임 + 수집 카운터 주스', () => {
  // 근접(getting-warmer) — 플레이어 거리로 발광·회전·부양을 키운다(결정적).
  assert.match(mainSource, /const near = player \?/);
  assert.match(mainSource, /glass\.material\.emissiveIntensity = pulse/);
  // 수집 시 카운터를 크게 띄워 진행 손맛.
  assert.match(mainSource, /수집 카운터 주스/);
  assert.match(mainSource, /flashCombatPopup\(ui, `🍾 지식의 유리병 \$\{count\}/);
});

test('escalation(R-루프7): 코어 개방 절정이 점증 스펙터클로 착지한다', () => {
  assert.match(mainSource, /function triggerCoreAwakening/);
  // 점증하는 다연속 버스트(파티클 한 번이 아니라).
  assert.match(mainSource, /\[340, 640, 980\]\.forEach/);
  assert.match(mainSource, /AI 코어가 깨어난다/);
  // 마지막 조각 획득 시 단발 celebrate 대신 에스컬레이션 호출.
  assert.match(mainSource, /triggerCoreAwakening\(game, ui\), 900/);
});

test('anti-repetition(R-루프6): 사당 던전 진입이 구역마다 다른 색·첫인상', () => {
  // 주제색 플래시(흰색 고정 대신) + 구역별 고유 진입 한 줄.
  assert.match(mainSource, /triggerFlash\(ui, topic\?\.color/);
  assert.match(mainSource, /const DUNGEON_ENTRY_LINE = \{/);
  assert.match(mainSource, /비밀지기의 방/);
  assert.match(mainSource, /편향의 온실/);
  assert.match(mainSource, /잊힌 아틀리에/);
  assert.match(mainSource, /거울의 방/);
});

test('mastery(R-루프5): 완벽 반사 등급은 보너스만 — 실패 처벌 없이 숙련을 축하', () => {
  const corridorSrc = readFileSync(new URL('../src/corridorLogic.js', import.meta.url), 'utf8');
  // 순수 로직이 근접도로 완벽 등급을 판정(마지막 순간).
  assert.match(corridorSrc, /perfectRange:/);
  assert.match(corridorSrc, /'deflected-perfect' : 'deflected'/);
  // 표현: 완벽엔 강화 연출·연속 카운트, 일반 반사도 여전히 성공.
  assert.match(mainSource, /완벽 반사/);
  assert.match(mainSource, /perfectStreak/);
  assert.match(mainSource, /연속/);
});

test('curiosity(R-루프4): 콜드오픈 훅 + 조각 획득 뒤 다음 구역 예고', () => {
  const worldSrc = readFileSync(new URL('../src/worldData.js', import.meta.url), 'utf8');
  // 타이틀 콜드오픈: 잊혀진 수호자의 미스터리('네가 누구였는지')를 심는다.
  assert.match(mainSource, /title-hook/);
  assert.match(mainSource, /네가 누구였는지 알아내라/);
  // 조각 획득 결말에 다음 구역 예고 훅 노출.
  assert.match(mainSource, /quest-teaser/);
  assert.match(mainSource, /topic\?\.teaserKo/);
  assert.match(worldSrc, /teaserKo:/);
});

test('game-feel(R-루프3): 햅틱(성공만)·발밑 그림자 착지 스쿼시로 순간 손맛', () => {
  // 햅틱: 기능 감지 + 성공 순간에만(실패 무진동 — 무처벌 원칙).
  assert.match(mainSource, /function triggerHaptic/);
  assert.match(mainSource, /navigator\.vibrate === 'function'/);
  assert.match(mainSource, /kind === 'match' \|\| kind === 'hit' \|\| kind === 'win'/);
  // 획득·의식·코어에 햅틱 연결.
  assert.match(mainSource, /triggerHaptic\(25\)/); // 획득
  assert.match(mainSource, /triggerHaptic\(\[20, 30, 20, 30, 50\]\)/); // 의식
  // 발밑 그림자 착지 스쿼시(신규 오브젝트 0 — 기존 블롭 그림자 재사용).
  assert.match(mainSource, /renderState\.playerShadow/);
  assert.match(mainSource, /shadow\.scale\.set\(s, s, 1\)/);
});

test('goal-gradient(R-루프2): 코어 개방 임박이 HUD에 생생하게 드러난다', () => {
  const cssSrc = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  // 임계(3조각)까지 남은 거리 계산 + 하나 남음/열림 상태 문구.
  assert.match(mainSource, /remainingToUnlock = Math\.max\(0, 3 - summary\.collected\)/);
  assert.match(mainSource, /조각 하나면 코어가 열려/);
  assert.match(mainSource, /AI 코어 열림 — 중앙으로/);
  assert.match(mainSource, /coreStatus\.dataset\.coreState = coreState/);
  // 좁은 화면에서도 하나 남음/열림 순간엔 코어 상태를 되살린다.
  assert.match(cssSrc, /\[data-core-state="close"\][\s\S]*?\[data-core-state="open"\][\s\S]*?display: inline/);
});

test('first-control beat(R-루프1): 시네마틱 종료·스킵 후 첫 조작이 보상 순간이 된다', () => {
  const cssSrc = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  // 넘겨받기 비트: 밝은 사운드 + 도트 반짝임 + 목표 칩 펄스 + '네 차례' 팝업.
  assert.match(mainSource, /function playFirstControlBeat/);
  assert.match(mainSource, /이제 네 차례야, 수호자/);
  assert.match(mainSource, /pulse-attn/);
  // 첫 플레이 1회만(재방문 세이브에선 안 뜸).
  assert.match(mainSource, /firstControlBeatDone/);
  // finishPrologueCinematic이 비트를 호출(스킵·정상 종료 공통 경로).
  assert.match(mainSource, /snapCamera\(game\.renderState\.camera, game\.player\.position\);\n  playFirstControlBeat/);
  assert.match(cssSrc, /@keyframes chipAttn/);
});

test('bundle & 허브(루프E): three 벤더 청크 분리 + 허브 2부 소개 최신화', () => {
  const vite = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  const hub = readFileSync(new URL('../public/trilogy.html', import.meta.url), 'utf8');
  // Three.js를 별도 청크로 — 재배포 시 게임 코드만 재다운로드(PWA 캐시 세밀화).
  assert.match(vite, /manualChunks\(id\)/);
  assert.match(vite, /node_modules\/three/);
  // 교사 허브: 2부 소개가 정보의 바다·심화 2막·오프라인을 반영.
  assert.match(hub, /「정보의 바다」/);
  assert.match(hub, /심화 2막 「잡음의 군도」/);
  assert.match(hub, /지식의 유리병 12개/);
});

test('a11y & 재방문(루프D): 포커스 링·대화 role + 초기화 후 월드 재구성', () => {
  const cssSrc = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  // 키보드 포커스 링(고대비) — 커스텀 버튼셋에서도 어디 있는지 보이게.
  assert.match(cssSrc, /button:focus-visible[\s\S]*?outline: 3px solid/);
  // 대화창은 스크린리더가 대화로 인식하도록 role 부여.
  assert.match(mainSource, /data-dialog hidden role="dialog"/);
  // 공유 기기 재사용: 기록 초기화가 3D 월드까지 새로 세운다(재로드).
  assert.match(mainSource, /clearStoredProgress\(\);[\s\S]*?window\.location\.reload\(\)/);
});

test('isle guidance(루프C): 상륙 힌트는 목표 우선 + 도전 힌트가 동사 버튼을 명시한다', () => {
  // 첫 상륙: 나가는 법보다 목표(정령에게 말 걸기)를 먼저.
  assert.match(mainSource, /정령에게 다가가 A로 말을 걸어요/);
  // 각 섬 도전 힌트는 어떤 동사(F/도구버튼)를 쓰는지 학생이 알 수 있어야 한다.
  assert.match(mainSource, /🛡️ 방패\(F\/도구버튼\)/);
  assert.match(mainSource, /🔔 종\(F\/도구버튼\)/);
});

test('dispose(루프B): 범용 dispose가 Points까지 회수하고, 레거시 퍼즐도 dispose를 쓴다', () => {
  const dungeonSrc = readFileSync(new URL('../src/dungeon.js', import.meta.url), 'utf8');
  // 데이터 해류(THREE.Points)가 귀항마다 누수되던 버그의 재발 방지.
  assert.match(dungeonSrc, /child\.isMesh \|\| child\.isSprite \|\| child\.isLine \|\| child\.isPoints/);
  // 레거시 오버레이 퍼즐 정리도 remove가 아니라 dispose 경유.
  assert.match(mainSource, /disposeDungeonRoom\(ped\.group, game\.renderState\.scene\)/);
  // 밀기 던전 소프트락 안내(재입장 리셋을 학생이 알게).
  assert.match(mainSource, /나갔다 오면 처음부터/);
});

test('touch dialog(루프1): 터치 기기에서 대화 버튼 타깃 확대 + 스틱 겹침 방지', () => {
  const cssSrc = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  // 터치 공통 레이어: 닫기·선택지·확인 버튼 최소 높이.
  const start = cssSrc.indexOf('터치 기기 공통');
  assert.ok(start >= 0, '터치 공통 대화 레이어 존재');
  const coarseBlock = cssSrc.slice(start, start + 800);
  assert.match(coarseBlock, /\.choice-button \{[\s\S]*?min-height: 54px/);
  assert.match(coarseBlock, /\.panel-heading button \{[\s\S]*?min-height: 46px/);
  assert.match(coarseBlock, /\.finale-next \{[\s\S]*?min-height: 52px/);
  // 태블릿에서 대화창이 하단 스틱과 겹치지 않게 위치·높이 캡.
  assert.match(cssSrc, /top: 40%;\n    max-height: min\(60vh, 560px\)/);
});

test('pwa(루프2): 매니페스트·서비스워커·등록이 오프라인 주장(요약본)을 실제로 충족한다', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  // 매니페스트: 상대 경로 스코프(GitHub Pages 서브패스 호환) + SVG 아이콘(외부 에셋 0).
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.display, 'standalone');
  assert.match(manifest.icons[0].src, /icon\.svg/);
  // 서비스워커: 이동은 네트워크 우선(새 배포 즉시 반영), 에셋은 캐시 우선.
  assert.match(sw, /request\.mode === 'navigate'/);
  assert.match(sw, /caches\.match\(request\)/);
  assert.match(sw, /self\.skipWaiting\(\)/);
  // 등록: dev 서버(5173)에선 제외 — 개발 중 소스 캐시 사고 방지.
  assert.match(html, /serviceWorker/);
  assert.match(html, /5173/);
  assert.match(html, /rel="manifest"/);
});

test('concept: 「정보의 바다」 언어가 타이틀·출항 브리지에 정착돼 있다', () => {
  // 공간 컨셉(기획서 7장) — 세계의 바다 이름. 지역명 「잡음의 군도」와 공존한다.
  assert.match(mainSource, /정보의 바다에 떠 있는 섬/);
  assert.match(mainSource, /「정보의 바다」/);
  assert.match(mainSource, /잡음의 군도/);
});

test('camera keeps the player near screen center (no strong center bias)', () => {
  // 시선은 항상 플레이어 — 중심 편향(x*0.6·시선 x*0.4)이 부활하면 넓은 씬에서 캐릭터가 화면 밖으로 밀린다.
  assert.match(mainSource, /target\.x \* 0\.9, target\.y \+ 8\.7, target\.z \+ 13\.8/);
  assert.match(mainSource, /new THREE\.Vector3\(target\.x, target\.y \+ 1\.35, target\.z - 1\.2\)/);
  assert.doesNotMatch(mainSource, /target\.x \* 0\.6/);
  // snapCamera와 updateCamera 상수는 반드시 일치(씬 전환 활공 방지) — 두 곳 다 같은 공식.
  const matches = mainSource.match(/target\.x \* 0\.9, target\.y \+ 8\.7, target\.z \+ 13\.8/g) ?? [];
  assert.equal(matches.length, 2);
});

test('idle overview: 3초 유휴 시 씬 전체 조망, 전투·도전 중엔 꺼진다', () => {
  // 씬별 조망 시점 + 스무스 블렌드.
  assert.match(mainSource, /const OVERVIEW_VIEWS = \{/);
  assert.match(mainSource, /game\.idleT > 3/);
  // 전투·섬 도전(타이밍 게임) 중엔 조망 금지.
  assert.match(mainSource, /overviewBlocked = game\.combat\?\.active \|\| \(game\.isle\?\.challenge && !game\.isle\.challenge\.cleared\)/);
  // 항해 조망 시 안개를 밀어 군도 전체 가시화(복귀 시 원상).
  assert.match(mainSource, /fog\.far = 130 \+ ovBlend \* 160/);
  // 씬 전환 시 조망 상태 리셋.
  assert.match(mainSource, /game\.lastCameraMode !== game\.mode/);
});

test('epilogue: 마지막 편지 → 별똥별 인사(결정적·1회성 dispose) + 완결 기록·3부 연결', () => {
  assert.match(mainSource, /function triggerStarShower/);
  // 결정적: 경로·시차는 인덱스 기반 상수, 랜덤 금지.
  const showerBlock = mainSource.match(/function triggerStarShower[\s\S]*?\n\}/)?.[0] ?? '';
  assert.doesNotMatch(showerBlock, /Math\.random/);
  // 마지막 편지에서만 발동 + 끝나면 dispose로 정리.
  assert.match(mainSource, /if \(stageId === 'memory-core'\)/);
  assert.match(mainSource, /disposeDungeonRoom\(shower\.group, game\.renderState\.overworld\)/);
  // 별똥별 동안 시선을 하늘로 — 팔로우 카메라는 아래를 보므로 이 블렌드 없이는 연출이 화면 밖이다.
  assert.match(mainSource, /skyGazing = game\.renderState\?\.starShower\?\.active === true/);
  assert.match(mainSource, /look\.y \+= sg \* 15/);
  // 완독 시 항로 지도에 완결 기록과 3부 연결 안내.
  assert.match(mainSource, /패스파인더/);
});

test('story depth: 정령 재방문 대화 + 노바의 편지(읽음 세이브·항로 순서)', () => {
  const worldSrc2 = readFileSync(new URL('../src/worldData.js', import.meta.url), 'utf8');
  // 재방문 사이드 대화 — 치유 후 두 번째 대화부터.
  assert.match(mainSource, /spiritRevisitKo/);
  assert.match(mainSource, /game\.isle\.spiritTalked/);
  // 노바의 편지: 항로 순서 고정 + 읽음은 세이브에.
  assert.match(mainSource, /NOVA_LETTER_ORDER = \['whisper-cape', 'echo-cave', 'hourglass-port', 'memory-core'\]/);
  assert.match(mainSource, /function getUnreadNovaLetters/);
  assert.match(worldSrc2, /novaLettersRead: \[\.\.\.new Set\(stringArray\(candidate\.novaLettersRead\)\)\]/);
  assert.match(mainSource, /type: 'letter'/);
});

test('touch movement is a virtual stick on the left (free direction)', () => {
  // 이동 스틱: 브라우저 제스처를 막고(touch-action) 포인터 캡처로 끊김 없이 따라간다.
  const stickRule = cssSource.match(/\.touch-stick \{[\s\S]*?\}/)?.[0] ?? '';
  assert.match(stickRule, /touch-action:\s*none/);
  assert.doesNotMatch(stickRule, /display:\s*none/);
  assert.match(mainSource, /data-stick/);
  assert.match(mainSource, /setPointerCapture/);
  // 스틱 벡터가 이동 방향이 된다(아날로그 방향 · 일정 속도) — 키보드 이동은 그대로.
  assert.match(mainSource, /game\.touchStick/);
  assert.match(mainSource, /move\.set\(stick\.x, 0, stick\.z\)/);
  assert.match(mainSource, /game\.keys\.has\('right'\)/);
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
  assert.match(registryBlock, /'memory-outer'/);
  assert.match(registryBlock, /'memory-core'/);
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

test('heart seals: 순수 로직 + 4동사 봉인 + 완료 전이', () => {
  const heartSource = readFileSync(new URL('../src/heartLogic.js', import.meta.url), 'utf8');
  const isleSrc3 = readFileSync(new URL('../src/isle.js', import.meta.url), 'utf8');
  assert.doesNotMatch(heartSource, /from 'three'/);
  assert.doesNotMatch(heartSource, /Math\.random/);
  // 봉인 = 도구 4종 id와 동일(동사 조합 훈련) — 좌표는 로직이 단일 출처.
  assert.match(heartSource, /'shield'/);
  assert.match(heartSource, /'mirror'/);
  assert.match(isleSrc3, /HEART\.seals\.forEach/);
  assert.match(mainSource, /heartUse\(game, ui\)/);
  assert.match(mainSource, /function finishHeart/);
});

test('residue: 패배 연출 → 각성 → 4껍질 동사전 → 2막 엔딩 (프롤로그 증명서 불변)', () => {
  const residueSource = readFileSync(new URL('../src/residueLogic.js', import.meta.url), 'utf8');
  assert.doesNotMatch(residueSource, /from 'three'/);
  assert.doesNotMatch(residueSource, /Math\.random/);
  // 패배 연출은 심부 도입부에 있다 — 프롤로그 보스 흐름은 건드리지 않는다(기획 재결정).
  assert.match(residueSource, /'intro'/);
  assert.match(residueSource, /deflectsToAwaken/);
  assert.match(mainSource, /function residueAwaken/);
  assert.match(mainSource, /function finishResidue/);
  // 페이즈 = 도구 4종 순서(방패→나침반→종→거울).
  assert.match(residueSource, /'shield'[\s\S]*'compass'[\s\S]*'bell'[\s\S]*'mirror'/);
  // 프롤로그 승리 흐름(가르침→증명서)은 그대로 남아 있다.
  assert.match(mainSource, /startBossFight/);
  assert.match(mainSource, /buildNovaCertificate/);
  // 외곽 관문에서 심부 직행(섬→섬 전환).
  assert.match(mainSource, /enterIsle\(game, ui, 'memory-core'\)/);
});

test('tablet: 섬 도전에서 동사 버튼이 보이고, 태블릿 레이어가 터치 타깃을 키운다', () => {
  // 섬(is-isle)에서 터치 동사 버튼이 반드시 표시되어야 한다 — 2막 도전의 필수 입력.
  assert.match(cssSource, /\.is-isle \.touch-tool/);
  assert.match(mainSource, /classList\.add\('is-isle'\)/);
  assert.match(mainSource, /classList\.remove\('is-isle'\)/);
  // 태블릿 레이어: 터치 + 넓은 화면에서 스틱·A·동사 버튼 확대.
  assert.match(cssSource, /@media \(pointer: coarse\) and \(min-width: 700px\)/);
  const tabletBlock = cssSource.slice(cssSource.indexOf('@media (pointer: coarse) and (min-width: 700px)'));
  assert.match(tabletBlock, /\.touch-stick \{[\s\S]*?width: 172px/);
  // 도구 버튼 아이콘은 맥락 동사와 일치한다.
  assert.match(mainSource, /function syncToolButton/);
  assert.match(mainSource, /ISLE_VERB_EMOJI/);
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

test('story-v2(N1): 잊혀진 수호자 — 콜드오픈·기억 파편·잡음의 속삭임이 배선돼 있다', () => {
  const storySource = readFileSync(new URL('../src/story.js', import.meta.url), 'utf8');
  // 프롤로그 콜드오픈: 기억을 잃은 주인공(미스터리 훅)으로 시작한다.
  assert.match(storySource, /내가 누구인지조차 기억나지 않는다/);
  assert.match(storySource, /잊혀진 수호자/);
  // 기억 파편: 사당 4주제 각각의 흑백 회상 + 마지막 파편의 코어 예고.
  assert.match(storySource, /export const MEMORY_FRAGMENTS = \{/);
  for (const key of ['privacy', 'bias', 'copyright', 'deepfake']) {
    assert.match(storySource, new RegExp(`${key}: \\[`), `기억 파편 누락: ${key}`);
  }
  assert.match(storySource, /export const FINAL_MEMORY_TEASE/);
  // 표현 계층: 제단 획득 → 기억 파편 회상 → 진행도별 노이즈 속삭임(반전 복선).
  assert.match(mainSource, /const NOISE_WHISPERS = \{/);
  assert.match(mainSource, /function showNoiseWhisper/);
  assert.match(mainSource, /function showMemoryFragment/);
  assert.match(mainSource, /showMemoryFragment\(game, ui, fragmentTopicId\)/);
  // 회상 대화창 스타일은 닫을 때 반드시 벗겨야 다음 일반 대화가 오염되지 않는다.
  assert.match(mainSource, /ui\.dialog\.classList\.remove\('memory-dialog'\)/);
  assert.match(cssSource, /\.noise-whisper/);
  assert.match(cssSource, /\.dialog-panel\.memory-dialog/);
});
