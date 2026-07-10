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
    return { hud: v('.status-strip'), cert: v('.certificate'), dpad: v('.touch-dpad') };
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
    voyage.length === 6 && voyage[0] === 'completed' && voyage[1] === 'coming' && voyage[5] === 'locked',
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
    islands: window.__ethicsGame.voyage?.built.islands.length ?? 0
  }));
  check(sail.mode === 'voyage' && sail.overworldHidden && sail.islands === 6, `항해 진입(섬 실루엣 ${sail.islands}개, 오버월드 숨김)`);

  // 안개 섬(속삭임 곶, sea [-16,-9] × 2.2) 접근 → A는 거부된다.
  await tp(-35.2, -16.5, 0, -1);
  await p.waitForTimeout(1000);
  await A(600);
  const fog = await p.evaluate(() => ({
    mode: window.__ethicsGame.mode,
    prompt: window.__ethicsUi.prompt?.textContent ?? ''
  }));
  check(fog.mode === 'voyage' && fog.prompt.includes('안개'), `안개 섬 상륙 거부(${fog.prompt.slice(0, 24)}…)`);

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
