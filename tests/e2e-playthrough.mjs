// E2E 전체 플레이스루 — 심사위원/학생이 하는 그대로 처음부터 증명서까지.
// 타이틀 → 프롤로그 스킵 → 상호작용 간격 불변식 → 4던전(실조작) → NPC·관문 4곳
// → 보스 4페이즈 → 가르침 → 증명서 → 인쇄 격리(visibility) → 학습 리포트.
//
// 실행: npm run build && npm run e2e
// 요구: playwright-core(NODE_PATH로 주입 가능) + 헤드리스 크로미움.
//   NODE_PATH=<playwright-core가 있는 node_modules> CHROMIUM_PATH=<headless_shell> npm run e2e
// 배경: 유닛 테스트 95개가 못 잡던 '관문-사당 반경 겹침(진행 불능)' 회귀를 이 스크립트가 잡는다.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright-core'));
} catch {
  console.error('e2e: playwright-core를 찾을 수 없습니다. NODE_PATH에 playwright-core가 있는 node_modules를 지정하세요.');
  process.exit(2);
}

const CHROMIUM = process.env.CHROMIUM_PATH
  ?? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (!existsSync(CHROMIUM)) {
  console.error(`e2e: 크로미움을 찾을 수 없습니다(${CHROMIUM}). CHROMIUM_PATH로 지정하세요.`);
  process.exit(2);
}
if (!existsSync(new URL('../dist/index.html', import.meta.url))) {
  console.error('e2e: dist/가 없습니다. 먼저 npm run build를 실행하세요.');
  process.exit(2);
}

const PORT = process.env.E2E_PORT ?? '8899';
const MIN_SEPARATION = 2.6; // 상호작용 반경(2.25)보다 커야 프롬프트가 겹치지 않는다

const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failures.push(label);
};

const cw = (c, r) => ({ x: (c - 4) * 1.2, z: (r - 3) * 1.2 });
const DIR = { W: [-1, 0], E: [1, 0], N: [0, -1], S: [0, 1] };

const server = spawn('python3', ['-m', 'http.server', PORT, '--bind', '127.0.0.1', '--directory', 'dist'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

let browser;
try {
  browser = await chromium.launch({
    executablePath: CHROMIUM,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CON: ' + m.text()); });
  await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} window.__ETHICS_TEST_HOOK__ = true; });
  await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  const A = async (ms = 260) => { await p.evaluate(() => { const g = window.__ethicsGame; if (g.dungeon) g.dungeon.actionCooldown = 0; }); await p.keyboard.press('e'); await p.waitForTimeout(ms); };
  const tp = (x, z, dx = 0, dz = -1) => p.evaluate(([x, z, dx, dz]) => { const g = window.__ethicsGame; g.player.position.set(x, 0.55, z); g.player.direction.set(dx, 0, dz); if (g.dungeon) g.dungeon.actionCooldown = 0; }, [x, z, dx, dz]);
  const st = () => p.evaluate(() => { const g = window.__ethicsGame; return { mode: g.mode, tools: g.progress.tools, frags: g.progress.collectedFragments }; });
  const interactable = (type, key, id) => p.evaluate(([type, key, id]) => { const it = window.__ethicsGame.renderState.interactables.find((i) => i.type === type && i[key] === id); return it ? { x: it.position.x, z: it.position.z } : null; }, [type, key, id]);
  const closeDlg = async () => { await p.evaluate(() => window.__ethicsUi.dialogClose?.click()); await p.waitForTimeout(400); };

  // ── 타이틀 → 프롤로그 시네마틱 스킵 ─────────────────
  await p.click('button.title-start');
  await p.waitForFunction(() => Boolean(window.__ethicsGame?.cinematic), { timeout: 5000 }).catch(() => {});
  const cine = await p.evaluate(() => {
    const g = window.__ethicsGame;
    const overlay = document.querySelector('[data-cinematic]');
    return { active: Boolean(g.cinematic), letterbox: Boolean(overlay && !overlay.hidden && overlay.classList.contains('is-on')) };
  });
  check(cine.active && cine.letterbox, '프롤로그 인엔진 시네마틱 시작(레터박스 표시)');
  const skip = await p.$('[data-prologue-skip]');
  if (skip) { await skip.click(); await p.waitForTimeout(400); }
  const afterSkip = await p.evaluate(() => ({ cine: Boolean(window.__ethicsGame.cinematic), seen: window.__ethicsGame.progress.prologueSeen }));
  check(!afterSkip.cine && afterSkip.seen, '시네마틱 스킵 → prologueSeen 저장·연출 종료');
  check((await st()).mode === 'overworld', '타이틀→프롤로그 스킵→오버월드 진입');

  // ── 간격 불변식: 모든 상호작용 대상 쌍 ≥ MIN_SEPARATION ──
  const sep = await p.evaluate(() => {
    const its = window.__ethicsGame.renderState.interactables;
    let worst = { d: Infinity, a: '', b: '' };
    for (let i = 0; i < its.length; i += 1) {
      for (let j = i + 1; j < its.length; j += 1) {
        const d = its[i].position.distanceTo(its[j].position);
        if (d < worst.d) {
          worst = { d: +d.toFixed(2), a: `${its[i].type}:${its[i].topicId ?? its[i].shrineId}`, b: `${its[j].type}:${its[j].topicId ?? its[j].shrineId}` };
        }
      }
    }
    return worst;
  });
  check(sep.d >= MIN_SEPARATION, `상호작용 간격 불변식 최솟값 ${sep.d} (${sep.a} ↔ ${sep.b}) ≥ ${MIN_SEPARATION}`);

  // ── 지식의 유리병: 하나 주워서 대화·세이브·도감 확인 ──
  const bottlePos = await p.evaluate(() => {
    const it = window.__ethicsGame.renderState.interactables.find((i) => i.type === 'bottle' && i.bottleId === 'kb-ad');
    return it ? { x: it.position.x, z: it.position.z } : null;
  });
  check(Boolean(bottlePos), '지식의 유리병 12개 배치(kb-ad 존재)');
  await tp(bottlePos.x, bottlePos.z + 0.5, 0, -1);
  await p.waitForTimeout(1100);
  await A(600);
  const bottleGot = await p.evaluate(() => ({
    dialog: !window.__ethicsUi.dialog.hidden,
    text: window.__ethicsUi.dialogBody?.innerText ?? '',
    saved: window.__ethicsGame.progress.knowledgeBottles.includes('kb-ad'),
    meshGone: !window.__ethicsGame.renderState.bottleMeshes.has('kb-ad')
  }));
  check(bottleGot.dialog && bottleGot.saved && bottleGot.meshGone && bottleGot.text.includes('광고'), '유리병 수집 → 꿀팁 대화·세이브·메시 정리');
  await closeDlg();

  // ── 부두 게이트: 프롤로그 완료 전엔 도트가 항해를 말린다 ──
  const dockPos = await p.evaluate(() => {
    const it = window.__ethicsGame.renderState.interactables.find((i) => i.type === 'dock');
    return it ? { x: it.position.x, z: it.position.z } : null;
  });
  await tp(dockPos.x, dockPos.z - 0.6, 0, 1);
  await p.waitForTimeout(1000);
  await A(500);
  const dockGate = await p.evaluate(() => ({
    mode: window.__ethicsGame.mode,
    dialog: !window.__ethicsUi.dialog.hidden,
    text: window.__ethicsUi.dialogBody?.innerText ?? ''
  }));
  check(dockGate.mode === 'overworld' && dockGate.dialog && dockGate.text.includes('시련'), '부두 게이트(완료 전 출항 거부 대화)');
  await closeDlg();

  // ── 던전 공통 ──────────────────────────────────────
  const enterDungeon = async (topic) => {
    const s = await interactable('shrine', 'shrineId', `${topic}-shrine`);
    await tp(s.x, s.z + 1.2);
    await p.waitForTimeout(1000);
    for (let i = 0; i < 4; i += 1) {
      // 느린 프레임에서 stale nearest가 연 잔류 대화를 정리(부두 대화 재오픈 경합 방지).
      await p.evaluate(() => { if (!window.__ethicsUi.dialog.hidden) window.__ethicsUi.dialogClose?.click(); });
      await p.waitForTimeout(200);
      await A(600);
      if ((await st()).mode === 'dungeon') return true;
      await p.waitForTimeout(600);
    }
    return false;
  };
  const solved = () => p.evaluate(() => window.__ethicsGame.dungeon?.solved === true);
  const collect = async () => { const ped = cw(4, 0); await tp(ped.x, ped.z + 0.4); await A(700); };
  const push = async (crateId, dirKey) => {
    const [dx, dz] = DIR[dirKey];
    await p.evaluate(([crateId, dx, dz]) => {
      const g = window.__ethicsGame;
      const [c, r] = g.dungeon.state.crates[crateId];
      g.player.position.set(((c - dx) - 4) * 1.2, 0.55, ((r - dz) - 3) * 1.2);
      g.player.direction.set(dx, 0, dz);
      g.dungeon.actionCooldown = 0;
    }, [crateId, dx, dz]);
    await p.keyboard.press('e');
    await p.waitForTimeout(200);
  };

  // ① 개인정보(밀기)
  check(await enterDungeon('privacy'), '개인정보 던전 진입(오버월드 소멸)');
  for (const d of ['W', 'W', 'N', 'N']) await push('p1', d);
  for (const d of ['W', 'W', 'W', 'N', 'N']) await push('p3', d);
  for (const d of ['E', 'E', 'N', 'N']) await push('p2', d);
  check(await solved(), '개인정보: 상자 11수 해결');
  await collect();
  const ceremonyShown = await p.evaluate(() =>
    !window.__ethicsUi.ceremony.hidden && (window.__ethicsUi.ceremonyTitle.textContent ?? '').includes('획득')
  );
  check(ceremonyShown, '도구 획득 의식(데이터 캡슐·팡파레) 표시');

  // ② 편향(잡기·프리셋 중복 교정)
  check(await enterDungeon('bias'), '편향 던전 진입');
  const at = async ([c, r], ox = 0, oz = 0.5) => { const w = cw(c, r); await tp(w.x + ox, w.z + oz); await A(); };
  await at([4, 3]); // 노이즈가 심어둔 중복 빨강 되집기(bed2)
  await at([0, 2], 0.6, 0); // 파랑으로 교체
  await at([4, 3]); // 심기
  await at([0, 4], 0.6, 0); await at([5, 3]); // 노랑
  await at([0, 5], 0.6, 0); await at([6, 3]); // 보라
  check(await solved(), '편향: 프리셋 중복을 되집어 4색 완성');
  await collect();

  // ③ 저작권(이름표)
  check(await enterDungeon('copyright'), '저작권 던전 진입');
  const putPlate = async (plate, exhibit) => { await at(plate); await at(exhibit, 0, 0.7); };
  await putPlate([1, 4], [2, 2]); // 무로→별 그림
  await putPlate([2, 4], [4, 2]); // 에코→파도 노래
  await putPlate([4, 4], [6, 2]); // 모리→숲 이야기
  check(await solved(), '저작권: 진짜 이름표 3개 매칭');
  await collect();

  // ④ 딥페이크(거울 3장 — 두 번 돌려야 진짜)
  check(await enterDungeon('deepfake'), '딥페이크 던전 진입');
  await at([5, 1], 0, 0.6); // m2
  check(!(await solved()), '딥페이크: 한 번으로는 미해결(가짜 경유)');
  await at([5, 4], 0, 0.6); // m3
  check(await solved(), '딥페이크: 거울 2회 조작으로 진짜 얼굴 명중');
  await collect();
  check((await st()).tools.length === 4, '약속의 도구 4개 획득');

  // ── NPC 소개 + 관문 4곳 ────────────────────────────
  for (const topic of ['privacy', 'bias', 'copyright', 'deepfake']) {
    const npc = await interactable('npc', 'topicId', topic);
    let talked = false;
    for (const dz of [0.9, 0.5, 0.2]) {
      await tp(npc.x, npc.z + dz); await p.waitForTimeout(1100);
      if ((await p.evaluate(() => window.__ethicsGame.nearest?.type)) === 'npc') { await A(500); talked = true; break; }
    }
    check(talked, `${topic} NPC 대화(근접 인식)`);
    await closeDlg();
    const gate = await interactable('gate', 'topicId', topic);
    await tp(gate.x, gate.z + 1.0); await p.waitForTimeout(1100); await A(700);
    const tried = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const r = await p.evaluate((tried) => {
        const btns = [...window.__ethicsUi.dialogBody.querySelectorAll('[data-gate-choice]:not([disabled])')];
        const pick = btns.find((b) => !tried.includes(b.dataset.gateChoice)) ?? btns[0];
        if (!pick) return null;
        pick.click();
        return pick.dataset.gateChoice;
      }, tried);
      if (r) tried.push(r);
      await p.waitForTimeout(900);
      const ok = await p.evaluate(() => window.__ethicsUi.dialogBody.querySelector('[data-gate-feedback]')?.dataset.correct === 'true');
      if (ok) break;
      await p.waitForTimeout(2000);
    }
    await p.waitForTimeout(800);
    await closeDlg();
  }
  check((await st()).frags.length === 4, '윤리 조각 4개(관문 4곳 해결)');

  // ── 보스 4페이즈 → 가르침 → 증명서 ─────────────────
  await closeDlg();
  let bossStarted = false;
  for (let i = 0; i < 4 && !bossStarted; i += 1) {
    await tp(0, 2.2); await p.waitForTimeout(1000); await A(800);
    bossStarted = await p.evaluate(() => Boolean(window.__ethicsGame.combat));
  }
  check(bossStarted, '보스전 진입(도구 4개 게이트 통과)');
  for (let i = 0; i < 8; i += 1) {
    await p.evaluate(() => {
      const g = window.__ethicsGame; const c = g.combat; if (!c) return;
      const boss = g.renderState.noiseBoss;
      c.activeTool = c.tools.indexOf(c.weakToolId); c.cooldown = 0; c.stun = 0;
      g.player.position.set(boss.baseX ?? 0, 0.55, (boss.baseZ ?? 0) + 1.0);
    });
    await p.keyboard.press('e'); await p.waitForTimeout(300);
  }
  for (let i = 0; i < 25; i += 1) {
    if (await p.evaluate(() => window.__ethicsUi.certificate && !window.__ethicsUi.certificate.hidden)) break;
    await p.evaluate(() => {
      const body = window.__ethicsUi.dialogBody;
      (body.querySelector('[data-finale-choice="teach"]')
        ?? body.querySelector('[data-finale]')
        ?? body.querySelector('[data-dialog-ok], .finale-next'))?.click();
    });
    await p.waitForTimeout(500);
  }
  const fin = await p.evaluate(() => ({
    cert: window.__ethicsUi.certificate && !window.__ethicsUi.certificate.hidden,
    done: window.__ethicsGame.progress.aiCoreCompleted,
    nameLine: Boolean(document.querySelector('.cert-name-line'))
  }));
  check(fin.cert && fin.done, '가르침 선택 → 증명서 발급');
  check(fin.nameLine, '증명서에 이름 손글씨 칸 존재');

  // ── 인쇄 격리(증명서만 보임) ───────────────────────
  await p.emulateMedia({ media: 'print' });
  const vis = await p.evaluate(() => {
    const v = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).visibility : 'missing'; };
    return { hud: v('.status-strip'), cert: v('.certificate'), dpad: v('.touch-stick') };
  });
  await p.emulateMedia({ media: 'screen' });
  check(vis.cert === 'visible' && vis.hud === 'hidden' && vis.dpad === 'hidden', `인쇄 격리(cert=${vis.cert}, hud=${vis.hud}, dpad=${vis.dpad})`);

  // ── 학습 리포트 ────────────────────────────────────
  await p.evaluate(() => document.querySelector('[data-cert-close]')?.click());
  await p.waitForTimeout(400);
  await p.evaluate(() => window.__ethicsUi.journalToggle?.click());
  await p.waitForTimeout(500);
  const journal = await p.evaluate(() => window.__ethicsUi.journalContent?.innerText ?? '');
  check(journal.length > 400 && journal.includes('개인정보'), `학습 리포트 렌더(${journal.length}자)`);

  // ── 항로 지도(스테이지 프레임): 보스 격파 후 프롤로그=완료, 섬1=준비 중 ──
  const voyage = await p.evaluate(() => {
    const items = [...document.querySelectorAll('[data-voyage-map] .voyage-list li')];
    return items.map((li) => li.dataset.state);
  });
  check(
    voyage.length === 6 && voyage[0] === 'completed' && voyage[1] === 'current' && voyage[5] === 'locked',
    `항로 지도 6섬 상태(${voyage.join(',')})`
  );

  // ── 항해 씬: 출항 → 안개 섬 거부 → 귀항 ──────────────
  await p.evaluate(() => window.__ethicsUi.journalClose?.click());
  await p.waitForTimeout(400);
  await tp(dockPos.x, dockPos.z - 0.6, 0, 1);
  await p.waitForTimeout(1000);
  await A(700);
  const sail = await p.evaluate(() => ({
    mode: window.__ethicsGame.mode,
    overworldHidden: !window.__ethicsGame.renderState.overworld.visible,
    islands: window.__ethicsGame.voyage?.built.islands.length ?? 0,
    dest: window.__ethicsGame.voyage?.dest?.id,
    bridge: !window.__ethicsUi.dialog.hidden && (window.__ethicsUi.dialogBody?.innerText ?? '').includes('찌꺼기'),
    introSeen: window.__ethicsGame.progress.voyageIntroSeen === true
  }));
  check(sail.mode === 'voyage' && sail.overworldHidden && sail.islands === 6, `항해 진입(섬 실루엣 ${sail.islands}개, 오버월드 숨김)`);
  check(sail.bridge && sail.introSeen && sail.dest === 'whisper-cape', '첫 출항 브리지 서사 + 가이드 목적지(속삭임 곶)');
  await closeDlg();

  // 안개 섬(메아리 동굴, sea [12,-14] × 2.2) 접근 → A는 거부된다.
  await tp(26.4, -27.2, 0, -1);
  await p.waitForTimeout(1000);
  await A(600);
  const fog = await p.evaluate(() => ({
    mode: window.__ethicsGame.mode,
    prompt: window.__ethicsUi.prompt?.textContent ?? ''
  }));
  check(fog.mode === 'voyage' && fog.prompt.includes('안개'), `안개 섬 상륙 거부(${fog.prompt.slice(0, 24)}…)`);

  // ── 속삭임 곶 상륙: 도착 서사 → 정령 대화 → 뗏목 복귀 ──
  await tp(-35.2, -14.5, 0, -1);
  await p.waitForTimeout(1000);
  await A(800);
  const landed = await p.evaluate(() => ({
    mode: window.__ethicsGame.mode,
    stage: window.__ethicsGame.isle?.stageId,
    arrival: !window.__ethicsUi.dialog.hidden,
    visited: window.__ethicsGame.progress.stages['whisper-cape']?.visited === true
  }));
  check(
    landed.mode === 'isle' && landed.stage === 'whisper-cape' && landed.arrival && landed.visited,
    '속삭임 곶 상륙(도착 서사 + visited 기록)'
  );
  await closeDlg();
  await tp(0.4, -3.6, 0, -1);
  await p.waitForTimeout(1000);
  await A(600);
  const spirit = await p.evaluate(() => ({
    dialog: !window.__ethicsUi.dialog.hidden,
    text: window.__ethicsUi.dialogBody?.innerText ?? ''
  }));
  check(spirit.dialog && spirit.text.includes('말'), '바닷새 정령 대화(말-화살 증상)');
  await closeDlg();

  // ── 말-화살 회랑: 도전 시작 → 방패 가드 반사 → 3발사대 파괴 → 정령 치유·완료 ──
  await tp(3.2, -5.0, 0, -1);
  await p.waitForTimeout(1000);
  await A(600);
  const challengeOn = await p.evaluate(() => Boolean(window.__ethicsGame.isle?.challenge));
  check(challengeOn, '회랑 도전 시작(발사대 가동)');
  // 로직은 유닛이 전부 검증 — e2e는 마지막 발사대 하나를 실제 가드로 통합 검증한다(느린 헤드리스 프레임 대응 워프).
  await p.evaluate(() => {
    const ch = window.__ethicsGame.isle.challenge;
    ch.broken.e1 = true;
    ch.broken.e2 = true;
    ch.arrow = null;
    ch.fireTimer = 0.05;
  });
  await p.waitForTimeout(1600); // e3 발사 대기
  await p.evaluate(() => {
    const g = window.__ethicsGame;
    const arrow = g.isle.challenge.arrow;
    // 화살을 비행선상 플레이어 앞 1.0 지점으로 워프(가드 판정 거리 안).
    arrow.x = g.player.position.x - arrow.dx * 1.0;
    arrow.z = g.player.position.z - arrow.dz * 1.0;
  });
  await p.keyboard.press('f');
  await p.waitForTimeout(1400);
  const deflected = await p.evaluate(() => window.__ethicsGame.isle.challenge.arrow?.returning === true);
  check(deflected, '방패 가드 반사(화살이 주인에게 돌아감)');
  await p.evaluate(() => {
    const arrow = window.__ethicsGame.isle.challenge.arrow;
    arrow.x = 3.9; // e3 발사대 코앞으로 워프 — 다음 프레임에 파괴 판정
    arrow.z = -7.5;
  });
  await p.waitForTimeout(1600);
  const healed = await p.evaluate(() => {
    const g = window.__ethicsGame;
    return {
      completed: g.progress.stages['whisper-cape']?.completed === true,
      cleared: g.isle.challenge?.cleared === true,
      wispsGone: g.isle.built.wisps.every((w) => !w.visible),
      thanks: !window.__ethicsUi.dialog.hidden
    };
  });
  check(
    healed.completed && healed.cleared && healed.wispsGone && healed.thanks,
    '회랑 클리어 → 정령 치유 + 스테이지 완료 기록 + 감사 대화'
  );
  await closeDlg();

  await tp(-3.4, 10.2, 0, 1);
  await p.waitForTimeout(1000);
  await A(800);
  const backToSea = await p.evaluate(() => ({
    mode: window.__ethicsGame.mode,
    isle: Boolean(window.__ethicsGame.isle),
    dest: window.__ethicsGame.voyage?.dest?.id
  }));
  check(backToSea.mode === 'voyage' && !backToSea.isle, '뗏목으로 바다 복귀(곶 dispose)');
  check(backToSea.dest === 'echo-cave', '가이드 목적지 전이(곶 완료 → 메아리 동굴)');

  // ── 메아리 동굴: 속삭임 곶 완료로 항로 개방 → 상륙 → 고래 정령 ──
  await tp(26.4, -25.6, 0, -1);
  await p.waitForTimeout(1000);
  await A(800);
  const echo = await p.evaluate(() => ({
    mode: window.__ethicsGame.mode,
    stage: window.__ethicsGame.isle?.stageId,
    arrival: !window.__ethicsUi.dialog.hidden,
    visited: window.__ethicsGame.progress.stages['echo-cave']?.visited === true
  }));
  check(echo.mode === 'isle' && echo.stage === 'echo-cave' && echo.arrival && echo.visited, '메아리 동굴 상륙(항로 개방 + 도착 서사)');
  await closeDlg();
  await tp(0.6, -0.5, 0, -1);
  await p.waitForTimeout(1000);
  await A(600);
  const whale = await p.evaluate(() => ({
    dialog: !window.__ethicsUi.dialog.hidden,
    text: window.__ethicsUi.dialogBody?.innerText ?? ''
  }));
  check(whale.dialog && (whale.text.includes('메아리') || whale.text.includes('출처')), '고래 정령 대화(메아리 증상·종 예고)');
  await closeDlg();

  // ── 소문의 벽: 종 울림 판별 → 원본 돌 3라운드 → 고래 치유·완료 ──
  await tp(5.0, -1.9, 0, -1);
  await p.waitForTimeout(1000);
  await A(600);
  const rumorOn = await p.evaluate(() => window.__ethicsGame.isle?.challenge?.round === 0);
  check(rumorOn, '소문의 벽 도전 시작(3라운드)');
  // 울림 없이 원본 앞에서 A → 평가하지 않는다(blind).
  await tp(4.88, 1.4, 0, -1);
  await p.waitForTimeout(1000);
  await A(600);
  const blind = await p.evaluate(() => window.__ethicsGame.isle.challenge.round === 0);
  check(blind, '울림 없는 선택은 평가하지 않음(출처 확인 강제)');
  // 라운드별: 종 울림(F) → 원본 돌 앞 A. (헤드리스 느린 프레임: 쿨다운 리셋)
  const origins = [[4.88, 0.9], [4.97, -3.6], [4.8, -0.6]];
  for (const [ox, oz] of origins) {
    await p.evaluate(() => { window.__ethicsGame.isle.bellCd = 0; });
    await p.keyboard.press('f');
    await p.waitForTimeout(800);
    await tp(ox, oz + 0.5, 0, -1);
    await p.waitForTimeout(1000);
    await A(700);
  }
  const rumorDone = await p.evaluate(() => {
    const g = window.__ethicsGame;
    return {
      cleared: g.isle.challenge?.cleared === true,
      completed: g.progress.stages['echo-cave']?.completed === true,
      bubblesGone: [...g.isle.built.stoneBubbles.values()].every((b) => !b.visible),
      thanks: !window.__ethicsUi.dialog.hidden
    };
  });
  check(
    rumorDone.cleared && rumorDone.completed && rumorDone.bubblesGone && rumorDone.thanks,
    '소문의 벽 클리어 → 고래 치유 + 스테이지 완료 기록 + 감사 대화'
  );
  await closeDlg();

  await tp(-3.4, 10.0, 0, 1);
  await p.waitForTimeout(1000);
  await A(800);
  check((await st()).mode === 'voyage', '메아리 동굴 → 바다 복귀');

  // ── 모래시계 항구: 메아리 동굴 완료로 개방 → 상륙 → 등대거북 정령 ──
  await tp(-13.2, -38.8, 0, -1);
  await p.waitForTimeout(1000);
  await A(800);
  const port = await p.evaluate(() => ({
    mode: window.__ethicsGame.mode,
    stage: window.__ethicsGame.isle?.stageId,
    arrival: !window.__ethicsUi.dialog.hidden,
    visited: window.__ethicsGame.progress.stages['hourglass-port']?.visited === true
  }));
  check(port.mode === 'isle' && port.stage === 'hourglass-port' && port.arrival && port.visited, '모래시계 항구 상륙(항로 개방 + 도착 서사)');
  await closeDlg();
  await tp(0.5, -2.4, 0, -1);
  await p.waitForTimeout(1000);
  await A(600);
  const turtle = await p.evaluate(() => ({
    dialog: !window.__ethicsUi.dialog.hidden,
    text: window.__ethicsUi.dialogBody?.innerText ?? ''
  }));
  check(turtle.dialog && (turtle.text.includes('모래시계') || turtle.text.includes('잠')), '등대거북 정령 대화(불면 증상·나침반 예고)');
  await closeDlg();

  // ── 모래시계 사구: 나침반 당김 타이밍 → 3개 잠금 → 거북 숙면·완료 ──
  await tp(-6.6, 0.6, 0, -1);
  await p.waitForTimeout(1000);
  await A(600);
  const dunesOn = await p.evaluate(() => Boolean(window.__ethicsGame.isle?.challenge?.locked));
  check(dunesOn, '사구 도전 시작(모래시계 흔들림)');
  // 타이밍 미스: 최대 기울기 시점에 당기면 wobble(잠기지 않음).
  await p.evaluate(() => {
    const isle = window.__ethicsGame.isle;
    isle.pullCd = 0;
    isle.challenge.t = Math.PI / 0.9 + Math.PI / (2 * 0.9); // g1 최대 기울기
    window.__ethicsGame.player.position.set(-6.4 + 0.6, 0.55, -3.2);
  });
  await p.keyboard.press('f');
  await p.waitForTimeout(900);
  const wobbled = await p.evaluate(() => window.__ethicsGame.isle.challenge.locked.g1 === false);
  check(wobbled, '기울어진 순간의 당김은 실패(멈출 때 타이밍)');
  // 각 모래시계: 똑바로 선 t로 워프 → F (느린 프레임 드리프트 대비 재시도).
  const glasses = [
    ['g1', -6.4, -3.2, Math.PI / 0.9],
    ['g2', -8.6, 1.4, (Math.PI - 1.3) / 1.3],
    ['g3', -4.6, 2.8, (Math.PI - 2.6) / 1.7]
  ];
  for (const [gid, gx, gz, tUp] of glasses) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await p.evaluate(([gx, gz, tUp]) => {
        const g = window.__ethicsGame;
        g.isle.pullCd = 0;
        g.isle.challenge.t = tUp;
        g.player.position.set(gx + 0.6, 0.55, gz);
      }, [gx, gz, tUp]);
      await p.keyboard.press('f');
      await p.waitForTimeout(900);
      if (await p.evaluate((gid) => window.__ethicsGame.isle.challenge?.locked[gid] !== false, gid)) break;
    }
  }
  const dunesDone = await p.evaluate(() => {
    const g = window.__ethicsGame;
    return {
      cleared: g.isle.challenge?.cleared === true,
      completed: g.progress.stages['hourglass-port']?.completed === true,
      sand: [...g.isle.built.sandCores.values()].every((s) => s.visible),
      thanks: !window.__ethicsUi.dialog.hidden
    };
  });
  check(
    dunesDone.cleared && dunesDone.completed && dunesDone.sand && dunesDone.thanks,
    '사구 클리어 → 거북 숙면 + 스테이지 완료 기록 + 감사 대화'
  );
  await closeDlg();

  await tp(-3.4, 10.0, 0, 1);
  await p.waitForTimeout(1000);
  await A(800);
  check((await st()).mode === 'voyage', '모래시계 항구 → 바다 복귀');

  // ── 기억의 심장 외곽: 상륙 → 심장의 목소리(도전 시작) → 4봉인 해제 → 심부 개방 ──
  await tp(17.6, -51.9, 0, -1);
  await p.waitForTimeout(1000);
  await A(800);
  const outer = await p.evaluate(() => ({
    mode: window.__ethicsGame.mode,
    stage: window.__ethicsGame.isle?.stageId,
    arrival: !window.__ethicsUi.dialog.hidden
  }));
  check(outer.mode === 'isle' && outer.stage === 'memory-outer' && outer.arrival, '기억의 심장 외곽 상륙(도착 서사)');
  await closeDlg();
  await tp(0.4, -2.6, 0, -1);
  await p.waitForTimeout(1000);
  await A(700);
  const heartVoice = await p.evaluate(() => ({
    dialog: !window.__ethicsUi.dialog.hidden,
    challenge: Boolean(window.__ethicsGame.isle?.challenge?.released)
  }));
  check(heartVoice.dialog && heartVoice.challenge, '심장의 목소리 → 4봉인 훈련 시작');
  await closeDlg();
  // 봉인별: 빛 만개 t로 워프 → F (느린 프레임 드리프트 대비 재시도).
  const seals = [
    ['shield', -5.2, -1.2, (Math.PI / 2 + 2 * Math.PI) / 1.1],
    ['compass', 5.8, -1.6, (Math.PI / 2 - 1.6 + 2 * Math.PI) / 1.4],
    ['bell', -3.8, -9.0, (Math.PI / 2 - 3.2 + 2 * Math.PI) / 0.8],
    ['mirror', 4.6, -9.2, (Math.PI / 2 - 4.8 + 2 * Math.PI) / 0.65]
  ];
  for (const [sid, sx, sz, tPeak] of seals) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await p.evaluate(([sx, sz, tPeak]) => {
        const g = window.__ethicsGame;
        g.isle.pullCd = 0;
        g.isle.challenge.t = tPeak;
        g.player.position.set(sx + 0.6, 0.55, sz);
      }, [sx, sz, tPeak]);
      await p.keyboard.press('f');
      await p.waitForTimeout(900);
      if (await p.evaluate((sid) => window.__ethicsGame.isle.challenge?.released[sid] !== false, sid)) break;
    }
  }
  const heartDone = await p.evaluate(() => {
    const g = window.__ethicsGame;
    return {
      cleared: g.isle.challenge?.cleared === true,
      completed: g.progress.stages['memory-outer']?.completed === true,
      portal: g.isle.built.portalMat.color.getHex() !== 0x140f22,
      dialog: !window.__ethicsUi.dialog.hidden
    };
  });
  check(
    heartDone.cleared && heartDone.completed && heartDone.portal && heartDone.dialog,
    '4봉인 해제 → 심부 관문 개방 + 스테이지 완료 기록'
  );
  await closeDlg();

  // ── 심부: 관문 직행 → 패배 연출 → 각성 → 4껍질 동사전 → 2막 엔딩 ──
  await tp(0.4, -7.6, 0, -1);
  await p.waitForTimeout(1000);
  await A(800);
  const core = await p.evaluate(() => ({
    mode: window.__ethicsGame.mode,
    stage: window.__ethicsGame.isle?.stageId,
    intro: window.__ethicsGame.isle?.challenge?.stage === 'intro',
    arrival: !window.__ethicsUi.dialog.hidden
  }));
  check(core.mode === 'isle' && core.stage === 'memory-core' && core.intro && core.arrival, '심부 관문 직행(잔영 조우·패배 연출 시작)');
  await closeDlg();
  // 패배 연출: 힘이 3번 튕겨나면 정령들이 각성시킨다.
  await tp(0.4, -1.5, 0, -1);
  await p.waitForTimeout(1000);
  for (let i = 0; i < 3; i += 1) {
    await p.evaluate(() => { window.__ethicsGame.isle.pullCd = 0; });
    await p.keyboard.press('f');
    await p.waitForTimeout(900);
  }
  const awaken = await p.evaluate(() => ({
    stage: window.__ethicsGame.isle.challenge?.stage,
    dialog: !window.__ethicsUi.dialog.hidden,
    spirits: window.__ethicsGame.isle.built.spiritOrbs.every((o) => o.visible)
  }));
  check(awaken.stage === 'fight' && awaken.dialog && awaken.spirits, '패배 연출 → 정령들의 각성 개입');
  await closeDlg();
  // 4껍질: 페이즈별 공격 자세 절정 t로 워프 → F.
  const phases = [
    [0, (Math.PI / 2 + 2 * Math.PI) / 1.2],
    [1, (Math.PI / 2 - 1.1 + 2 * Math.PI) / 1.5],
    [2, (Math.PI / 2 - 2.2 + 2 * Math.PI) / 0.9],
    [3, (Math.PI / 2 - 3.3 + 2 * Math.PI) / 0.7]
  ];
  for (const [idx, tPeak] of phases) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await p.evaluate((tPeak) => {
        const g = window.__ethicsGame;
        g.isle.pullCd = 0;
        g.isle.challenge.t = tPeak;
      }, tPeak);
      await p.keyboard.press('f');
      await p.waitForTimeout(900);
      if (await p.evaluate((idx) => window.__ethicsGame.isle.challenge?.phase > idx || window.__ethicsGame.isle.challenge?.stage === 'defeated', idx)) break;
    }
  }
  const finale = await p.evaluate(() => {
    const g = window.__ethicsGame;
    const stages = g.progress.stages;
    return {
      defeated: g.isle.challenge?.stage === 'defeated',
      completed: stages['memory-core']?.completed === true,
      allHealed: ['whisper-cape', 'echo-cave', 'hourglass-port', 'memory-outer', 'memory-core'].every((id) => stages[id]?.completed === true),
      stars: g.isle.built.memoryStars.every((s) => s.visible),
      bossGone: !g.isle.built.boss.visible,
      ending: !window.__ethicsUi.dialog.hidden
    };
  });
  check(
    finale.defeated && finale.completed && finale.allHealed && finale.stars && finale.bossGone && finale.ending,
    '잔영 격파 → 2막 엔딩(기억의 별·군도 완전 치유)'
  );
  await closeDlg();
  await tp(-3.4, 8.4, 0, 1);
  await p.waitForTimeout(1000);
  await A(800);
  check((await st()).mode === 'voyage', '심부 → 바다 복귀');

  // 시작의 섬으로 귀항.
  await tp(0, 5, 0, -1);
  await p.waitForTimeout(1000);
  await A(700);
  const home = await p.evaluate(() => ({
    mode: window.__ethicsGame.mode,
    overworldVisible: window.__ethicsGame.renderState.overworld.visible,
    voyage: Boolean(window.__ethicsGame.voyage)
  }));
  check(home.mode === 'overworld' && home.overworldVisible && !home.voyage, '시작의 섬 귀항(오버월드 복원)');

  // 진실의 등대 — 전 스테이지 치유 후 광선 6줄기가 전부 켜져 있어야 한다.
  const beacon = await p.evaluate(() => {
    const g = window.__ethicsGame;
    const lb = g.renderState.lighthouseBeams;
    return { count: g.beaconCount, visible: lb ? lb.beams.filter((a) => a.visible).length : -1 };
  });
  check(beacon.count === 6 && beacon.visible === 6, `진실의 등대 진행도 광선 6줄기 (실제 ${beacon.visible})`);

  // ── 에필로그: 노바의 편지 4통 완독 → 별똥별 인사 + 완결 기록 ──
  await tp(0.4, 17.2, 0, -1);
  await p.waitForTimeout(1000);
  for (let i = 0; i < 4; i += 1) {
    await A(700);
    await closeDlg();
  }
  const epilogue = await p.evaluate(() => ({
    read: window.__ethicsGame.progress.novaLettersRead.length,
    shower: window.__ethicsGame.renderState.starShower?.active === true
      || window.__ethicsGame.renderState.starShower?.stars?.length > 0
  }));
  check(epilogue.read === 4 && epilogue.shower, `노바 편지 4통 완독 → 별똥별 에필로그(읽음 ${epilogue.read})`);
  await p.evaluate(() => window.__ethicsUi.journalToggle?.click());
  await p.waitForTimeout(600);
  const finaleNote = await p.evaluate(() => (window.__ethicsUi.journalContent?.innerText ?? '').includes('패스파인더'));
  check(finaleNote, '항로 지도 완결 기록 + 3부 패스파인더 연결 안내');
  await p.evaluate(() => window.__ethicsUi.journalClose?.click());
  await p.waitForTimeout(300);

  check(errs.length === 0, `콘솔·페이지 에러 0 (실제 ${errs.length}${errs.length ? ': ' + errs[0] : ''})`);
} catch (e) {
  failures.push('예외: ' + e.message);
  console.error('FATAL', e.message);
} finally {
  await browser?.close();
  server.kill();
}

console.log(failures.length === 0
  ? '\ne2e: 전체 플레이스루 통과 ✅'
  : `\ne2e: 실패 ${failures.length}건 ❌\n- ${failures.join('\n- ')}`);
process.exit(failures.length === 0 ? 0 : 1);
