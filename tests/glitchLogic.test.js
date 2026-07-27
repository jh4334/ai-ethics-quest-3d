import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GLITCH_ARCHETYPES,
  GLITCH_SPAWNS,
  GLITCH_WAVES,
  LORE_CARDS,
  PURIFY,
  SLASH,
  ZONE_CLEAR_BONUS,
  buildFieldGlitches,
  buildWaveGlitches,
  comboMultiplier,
  consumeGlitchHit,
  createGlitch,
  hitGlitch,
  purifyGlitch,
  stealFromPlayer,
  stepGlitch,
  zoneWaveCount
} from '../src/glitchLogic.js';

const step = (g, dist, dt = 0.05) => stepGlitch(g, { dx: dist, dz: 0, dist }, dt);

test('아키타입: 모든 기술에 선딜·유효·후딜 프레임 데이터가 있다 (design-action-combat)', () => {
  for (const arch of Object.values(GLITCH_ARCHETYPES)) {
    assert.ok(arch.move.windup > 0.3, `${arch.id}: 텔레그래프 없는 공격 금지`);
    assert.ok(arch.move.active > 0 && arch.move.recover > 0 && arch.move.cooldown > 0);
    assert.ok(arch.speed < 7.4, `${arch.id}: 플레이어보다 빠르면 도망 불가(무처벌 위반)`);
    assert.ok(arch.shardReward > 0);
  }
  assert.ok(SLASH.startup > 0 && SLASH.active > 0 && SLASH.recover > 0);
  assert.equal(SLASH.chainMax, 3);
});

test('상태기계: idle→pursue→windup→attack→recover 전이가 결정적이다 (tune-enemy-ai)', () => {
  const g = createGlitch('scavenger', 'privacy', 0, 0, 0);
  assert.equal(g.state, 'idle');
  step(g, 10); // 어그로 밖
  assert.equal(g.state, 'idle');
  step(g, 5); // 어그로 안
  assert.equal(g.state, 'pursue');
  const intent = step(g, 5);
  assert.ok(intent.moveX > 0, '추적 이동 의도');
  step(g, 1.2); // 공격 거리
  assert.equal(g.state, 'windup');
  // 선딜 동안 이동 없음 + 텔레그래프 신호.
  const tele = step(g, 1.2, 0.3);
  assert.equal(tele.moveX, 0);
  assert.ok(tele.telegraph > 0);
  // 선딜을 끝까지 소모하면 유효 창.
  step(g, 1.2, 0.4);
  assert.equal(g.state, 'attack');
  const atk = step(g, 1.2, 0.01);
  assert.ok(atk.hitActive, '유효 창에만 판정');
  assert.ok(atk.moveX > 5, '고정된 방향으로 돌진(즉시 회전 타격 금지)');
  // 유효 종료 → 후딜(처벌 창) → 쿨다운과 함께 추적 복귀.
  step(g, 1.2, 0.25);
  assert.equal(g.state, 'recover');
  step(g, 1.2, 1.1);
  assert.equal(g.state, 'pursue');
  assert.ok(g.cd > 0, '공격 후 쿨다운');
  // 결정성: 같은 시퀀스를 다시 돌리면 같은 결과.
  const a = createGlitch('scavenger', 'bias', 0, 0, 0);
  const b = createGlitch('scavenger', 'bias', 0, 0, 0);
  for (let i = 0; i < 40; i += 1) {
    step(a, 3 - i * 0.05);
    step(b, 3 - i * 0.05);
  }
  assert.deepEqual({ s: a.state, t: a.t, cd: a.cd }, { s: b.state, t: b.t, cd: b.cd });
});

test('접촉은 유효 창당 1회만 소비된다 (권위 있는 판정)', () => {
  const g = createGlitch('scavenger', 'privacy', 0, 0, 0);
  g.state = 'windup';
  g.lungeX = 1;
  step(g, 1.2, 0.7); // windup 소모 → attack
  assert.equal(g.state, 'attack');
  assert.ok(step(g, 0.5, 0.01).hitActive);
  consumeGlitchHit(g);
  assert.equal(step(g, 0.5, 0.01).hitActive, false, '소비 후 재판정 금지');
});

test('피격→스태거→정화 보상, 스태거 방치 시 자비 복귀', () => {
  const g = createGlitch('scavenger', 'copyright', 0, 0, 0);
  assert.equal(hitGlitch(g), 'hit');
  assert.equal(g.state, 'recover', '피격 경직 = 반격 창');
  assert.equal(hitGlitch(g), 'hit');
  assert.equal(hitGlitch(g), 'staggered');
  assert.equal(g.state, 'stagger');
  assert.equal(hitGlitch(g), 'ignored', '스태거 중 추가타 무의미 — 정화를 유도');
  // 정화: 파편 + 로어(주제 일치), 콤보 배수 적용.
  const reward = purifyGlitch(g, 2);
  assert.equal(reward.multiplier, 2);
  assert.equal(reward.shards, GLITCH_ARCHETYPES.scavenger.shardReward * 2);
  assert.equal(reward.loreTopicId, 'copyright');
  assert.equal(reward.loreKo, LORE_CARDS.copyright);
  assert.equal(g.state, 'purified');
  assert.equal(purifyGlitch(g, 1), null, '중복 정화 금지');
  // 방치 자비: 스태거를 오래 두면 hp 1로 일어난다(벌점 없음).
  const h = createGlitch('scavenger', 'bias', 0, 0, 0);
  h.hp = 0;
  h.state = 'stagger';
  h.t = 0;
  step(h, 10, GLITCH_ARCHETYPES.scavenger.staggerHold + 0.1);
  assert.equal(h.state, 'pursue');
  assert.equal(h.hp, 1);
});

test('슬쩍이(G2): 훔치기→도주→복귀, 피격 시 즉시 떨굼 — 영구 손실 없음(무처벌)', () => {
  const arch = GLITCH_ARCHETYPES.snitcher;
  assert.ok(arch.steals && arch.fleeSpeed < 6.1, '도주가 걷기보다 빠르면 회수 불가(무처벌 위반)');
  const g = createGlitch('snitcher', 'bias', 0, 0, 0);
  // 잡기 성공: 캡(2)만큼만 훔치고 도주로 전환.
  assert.equal(stealFromPlayer(g, 9), arch.stealCap);
  assert.equal(g.stolen, 2);
  assert.equal(g.state, 'flee');
  // 도주 의도: 플레이어 반대 방향, fleeTime 뒤 재추적.
  const intent = step(g, 3);
  assert.ok(intent.moveX < 0, '플레이어 반대 방향으로 달아난다');
  step(g, 3, arch.fleeTime + 0.1);
  assert.equal(g.state, 'pursue');
  // 피격 → 떨굼(전량) + 정상 피해 진행.
  assert.equal(hitGlitch(g), 'hit');
  assert.equal(g.stolen, 0);
  assert.equal(g.droppedShards, 2);
  // 빈손 잡기: 허탕(0)이어도 도주 리듬은 유지.
  const h = createGlitch('snitcher', 'bias', 1, 0, 0);
  assert.equal(stealFromPlayer(h, 0), 0);
  assert.equal(h.state, 'flee');
  // 훔치지 않는 종은 잡아도 0.
  const s = createGlitch('scavenger', 'bias', 2, 0, 0);
  assert.equal(stealFromPlayer(s, 9), 0);
});

test('에코 쌍둥이(G2): 가짜는 베면 흩어지고 보상·벌점 없음, 진짜는 기존 문법 (딥페이크)', () => {
  const fake = createGlitch('echo', 'deepfake', 0, 0, 0, 'echo');
  assert.equal(hitGlitch(fake), 'dispersed');
  assert.equal(fake.state, 'purified');
  assert.equal(purifyGlitch(fake, 1), null, '가짜에게 정화 보상 없음');
  const real = createGlitch('echo', 'deepfake', 1, 0, 0);
  assert.equal(real.variant, 'real');
  assert.equal(hitGlitch(real), 'hit');
  assert.equal(hitGlitch(real), 'staggered');
  const reward = purifyGlitch(real, 0);
  assert.equal(reward.shards, GLITCH_ARCHETYPES.echo.shardReward);
  assert.equal(reward.loreTopicId, 'deepfake');
});

test('조우 웨이브(G2): 고정표·결정적, 딥페이크 최종 웨이브는 진짜/가짜 한 쌍', () => {
  assert.equal(zoneWaveCount('privacy'), 1, '첫 구역은 온보딩 — 추가 웨이브 없음');
  assert.ok(zoneWaveCount('bias') >= 2 && zoneWaveCount('deepfake') >= 2);
  assert.ok(ZONE_CLEAR_BONUS > 0);
  const center = { x: 10, z: -5 };
  const a = buildWaveGlitches('deepfake', 1, center);
  const b = buildWaveGlitches('deepfake', 1, center);
  assert.deepEqual(a.map((g) => [g.id, g.x, g.z]), b.map((g) => [g.id, g.x, g.z]), '결정성');
  assert.equal(a.filter((g) => g.archetypeId === 'echo' && g.variant === 'real').length, 1);
  assert.equal(a.filter((g) => g.variant === 'echo').length, 1, '가짜는 정확히 하나 — 구별 학습');
  // id는 1웨이브(GLITCH_SPAWNS)와 절대 충돌하지 않는다.
  const wave0 = buildFieldGlitches({ deepfake: center }, []);
  const ids = new Set([...wave0, ...a].map((g) => g.id));
  assert.equal(ids.size, wave0.length + a.length);
  // 모든 웨이브 항목은 실제 아키타입만 참조한다.
  for (const waves of Object.values(GLITCH_WAVES)) {
    for (const wave of waves) {
      for (const s of wave) {
        assert.ok(GLITCH_ARCHETYPES[s.arch], `unknown archetype: ${s.arch}`);
      }
    }
  }
});

test('세공 트랙(G3): 순서 고정 구매·잔액 계산·강화 반영 파라미터', async () => {
  const { DODGE, UPGRADE_TRACK, getSlashParams, nextUpgrade, purchaseUpgrade } = await import('../src/glitchLogic.js');
  // 트랙: 회피 → 사거리 → 체인 → 파동. 비용은 오름차순(진행 구배).
  assert.deepEqual(UPGRADE_TRACK.map((u) => u.id), ['dodge', 'reach', 'chain4', 'purifyWave']);
  for (let i = 1; i < UPGRADE_TRACK.length; i += 1) {
    assert.ok(UPGRADE_TRACK[i].cost > UPGRADE_TRACK[i - 1].cost);
  }
  // 구매: 순서대로만, 파편 부족이면 null(벌점 없음 — 거래 자체가 안 일어남).
  assert.equal(nextUpgrade([]).id, 'dodge');
  assert.equal(purchaseUpgrade([], 3), null, '파편 부족');
  const first = purchaseUpgrade([], 5);
  assert.deepEqual(first, { id: 'dodge', shards: 1 });
  assert.equal(nextUpgrade(['dodge']).id, 'reach');
  assert.equal(nextUpgrade(UPGRADE_TRACK.map((u) => u.id)), null, '품절');
  // 강화 반영: 기본 ↔ 사거리·체인 업그레이드.
  assert.deepEqual(getSlashParams([]), { range: SLASH.range, chainMax: 3 });
  assert.deepEqual(getSlashParams(['dodge', 'reach', 'chain4']), { range: SLASH.range + 0.5, chainMax: 4 });
  // 회피 프레임 데이터: 무적 창·쿨다운 존재, 대시가 무한 도주 수단이 되지 않게 지속은 짧다.
  assert.ok(DODGE.iframes > 0 && DODGE.cooldown > 0 && DODGE.duration < 0.4);
});

test('콤보 배수는 x3 캡, 스폰은 고정표·미해결 구역만 (교실 재현성)', () => {
  assert.equal(comboMultiplier(0), 1);
  assert.equal(comboMultiplier(1), 1);
  assert.equal(comboMultiplier(2), 2);
  assert.equal(comboMultiplier(5), 3);
  assert.equal(comboMultiplier(99), 3, '무한 배수 금지(건강한 참여)');
  const centers = {
    privacy: { x: -10, z: -9 },
    bias: { x: 10, z: -6 },
    copyright: { x: -9, z: 7 },
    deepfake: { x: 12, z: 8 }
  };
  const all = buildFieldGlitches(centers, []);
  const expected = Object.values(GLITCH_SPAWNS).reduce((n, s) => n + s.length, 0);
  assert.equal(all.length, expected);
  assert.equal(GLITCH_SPAWNS.privacy.length, 1, '첫 구역은 온보딩용 1체');
  // 해결 구역엔 스폰 없음 + 두 번 만들어도 동일(결정적).
  const partial = buildFieldGlitches(centers, ['privacy', 'bias']);
  assert.ok(partial.every((g) => g.topicId !== 'privacy' && g.topicId !== 'bias'));
  assert.deepEqual(
    buildFieldGlitches(centers, []).map((g) => [g.id, g.x, g.z]),
    all.map((g) => [g.id, g.x, g.z])
  );
  assert.ok(PURIFY.range > 0);
});
