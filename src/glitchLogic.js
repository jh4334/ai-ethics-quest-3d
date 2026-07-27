// 필드 글리치 전투 — 순수 로직 (THREE 무의존, node 테스트 가능).
// MengTo/Skills `design-action-combat`·`tune-enemy-ai`·`build-threejs-enemy-systems` 원칙:
//  - 콘텐츠(불변 아키타입 정의) ↔ 런타임 인스턴스 분리
//  - 지각→의도→동작 3단 분리, 명명 상태기계, 텔레그래프 후 공격
//  - 모든 동사에 선딜(startup)·유효(active)·후딜(recovery) 프레임 데이터
//  - 전부 결정적: Math.random 0, 타이머·고정표만.

// ── 플레이어 베기 프레임 데이터 ─────────────────────────
export const SLASH = {
  startup: 0.12, // 선딜 — 입력 후 판정까지
  active: 0.14, // 유효 창 — 이 동안에만 접촉 판정
  recover: 0.24, // 후딜
  range: 2.1, // 판정 거리
  arcCos: 0.2, // 전방 부채꼴(cos 값, 약 ±78도)
  chainWindow: 0.55, // 후딜 중 재입력하면 다음 타로 체인
  chainMax: 3 // 3타째는 넉백 강화
};

// 정화 피니셔 — 스태거 상태의 글리치에게만.
export const PURIFY = { range: 2.2, recover: 0.5 };

// ── 글리치 아키타입 (불변 콘텐츠 정의) ──────────────────
// G1은 기본 몹 '주워듣개' 1종. G2에서 스니처·에코 쌍둥이 추가 예정.
export const GLITCH_ARCHETYPES = {
  scavenger: {
    id: 'scavenger',
    nameKo: '주워듣개',
    hp: 3,
    speed: 2.4, // 플레이어보다 느리다 — 도망은 항상 가능(무처벌)
    aggroRange: 5.5,
    attackRange: 1.7,
    // 돌진 한 방: 선딜이 길어(0.62s) 읽고 피할 수 있다. 후딜은 처벌 창.
    move: { windup: 0.62, active: 0.2, recover: 1.0, cooldown: 1.5, lungeSpeed: 7.5 },
    staggerHold: 4.0, // 스태거 유지 시간 — 이 안에 정화하지 않으면 일어난다(hp 1 회복)
    shardReward: 3
  }
};

// 정화 로어 카드 — 전리품이 곧 교육(주제별 한 줄, 도감에 축적).
export const LORE_CARDS = {
  privacy: '이 글리치는 「허락 없이 퍼진 사진들」이 뭉쳐 태어난 잡음이었다.',
  bias: '이 글리치는 「한쪽 이야기만 먹은 추천」이 뭉쳐 태어난 잡음이었다.',
  copyright: '이 글리치는 「이름표를 뗀 작품들」이 뭉쳐 태어난 잡음이었다.',
  deepfake: '이 글리치는 「진짜 흉내를 낸 목소리」가 뭉쳐 태어난 잡음이었다.'
};

// 콤보 배수 — 피격 없이 연속 정화. 상한 x3, 끊겨도 벌점 없음(참여 원칙).
export function comboMultiplier(streak) {
  if (streak >= 5) {
    return 3;
  }
  if (streak >= 2) {
    return 2;
  }
  return 1;
}

// ── 런타임 인스턴스 ─────────────────────────────────────
export function createGlitch(archetypeId, topicId, index, x, z) {
  const arch = GLITCH_ARCHETYPES[archetypeId];
  if (!arch) {
    throw new RangeError(`Unknown glitch archetype: ${archetypeId}`);
  }
  return {
    id: `${archetypeId}-${topicId}-${index}`,
    archetypeId,
    topicId,
    x,
    z,
    homeX: x,
    homeZ: z,
    hp: arch.hp,
    state: 'idle', // idle → pursue → windup → attack → recover → (stagger) → purified
    t: 0, // 현재 상태 경과 시간
    cd: 0, // 공격 쿨다운
    lungeX: 0, // windup 진입 시 고정되는 돌진 방향(즉시 회전 타격 금지)
    lungeZ: 0,
    hitConsumed: false // 유효 창당 접촉 1회(권위 있는 판정)
  };
}

// 지각 → 의도 → 동작. 순수 함수: 같은 입력이면 항상 같은 결과(결정적).
// perception: { dx, dz, dist } — 플레이어까지의 벡터·거리.
// 반환: { moveX, moveZ, hitActive, telegraph } — 표현 계층이 소비할 의도.
export function stepGlitch(g, perception, dt) {
  const arch = GLITCH_ARCHETYPES[g.archetypeId];
  const out = { moveX: 0, moveZ: 0, hitActive: false, telegraph: 0 };
  if (g.state === 'purified') {
    return out;
  }
  g.t += dt;
  if (g.cd > 0) {
    g.cd = Math.max(0, g.cd - dt);
  }
  const { dx, dz, dist } = perception;
  const nx = dist > 0.0001 ? dx / dist : 0;
  const nz = dist > 0.0001 ? dz / dist : 0;

  if (g.state === 'idle') {
    if (dist < arch.aggroRange) {
      g.state = 'pursue';
      g.t = 0;
    }
    return out;
  }
  if (g.state === 'stagger') {
    if (g.t >= arch.staggerHold) {
      // 정화 기회를 놓쳤다 — 일어난다(벌점 없음, hp 1로 재개).
      g.hp = 1;
      g.state = 'pursue';
      g.t = 0;
    }
    return out;
  }
  if (g.state === 'pursue') {
    if (dist > arch.aggroRange * 1.9) {
      g.state = 'idle'; // 멀어지면 포기 — 무한 추적 금지(공정성)
      g.t = 0;
      return out;
    }
    if (dist <= arch.attackRange && g.cd <= 0) {
      g.state = 'windup';
      g.t = 0;
      g.lungeX = nx; // 텔레그래프 시작 시 방향 고정
      g.lungeZ = nz;
      return out;
    }
    out.moveX = nx * arch.speed;
    out.moveZ = nz * arch.speed;
    return out;
  }
  if (g.state === 'windup') {
    out.telegraph = Math.min(1, g.t / arch.move.windup);
    if (g.t >= arch.move.windup) {
      g.state = 'attack';
      g.t = 0;
      g.hitConsumed = false;
    }
    return out;
  }
  if (g.state === 'attack') {
    out.moveX = g.lungeX * arch.move.lungeSpeed;
    out.moveZ = g.lungeZ * arch.move.lungeSpeed;
    out.hitActive = !g.hitConsumed;
    if (g.t >= arch.move.active) {
      g.state = 'recover';
      g.t = 0;
    }
    return out;
  }
  if (g.state === 'recover') {
    if (g.t >= arch.move.recover) {
      g.state = 'pursue';
      g.t = 0;
      g.cd = arch.move.cooldown;
    }
    return out;
  }
  return out;
}

// 접촉을 소비한다(유효 창당 1회) — 표현 계층이 권위 판정 후 호출.
export function consumeGlitchHit(g) {
  g.hitConsumed = true;
}

// 베기 피격 — hp가 다하면 스태거(정화 대기). 반환: 'hit' | 'staggered' | 'ignored'
export function hitGlitch(g) {
  if (g.state === 'purified' || g.state === 'stagger') {
    return 'ignored';
  }
  g.hp -= 1;
  if (g.hp <= 0) {
    g.state = 'stagger';
    g.t = 0;
    return 'staggered';
  }
  // 경직: 후딜로 밀어 넣어 반격 창을 만든다.
  g.state = 'recover';
  g.t = 0;
  return 'hit';
}

// 정화 피니셔 — 스태거 상태에서만. 보상(파편·로어)을 반환한다.
export function purifyGlitch(g, comboStreak) {
  if (g.state !== 'stagger') {
    return null;
  }
  const arch = GLITCH_ARCHETYPES[g.archetypeId];
  g.state = 'purified';
  g.t = 0;
  const mult = comboMultiplier(comboStreak);
  return {
    shards: arch.shardReward * mult,
    multiplier: mult,
    loreTopicId: g.topicId,
    loreKo: LORE_CARDS[g.topicId] ?? ''
  };
}

// ── 구역별 스폰 배치 (고정표 — 교실 재현성) ─────────────
// 구역 중심 기준 오프셋. 첫 구역(privacy)은 온보딩용 1체.
// NPC·사당·관문 상호작용 반경(2.25)과 겹치지 않게 중심·관문에서 3.5+ 떨어진 길목에 둔다.
export const GLITCH_SPAWNS = {
  privacy: [{ ox: 4.6, oz: -0.6 }],
  bias: [{ ox: -4.8, oz: -0.5 }, { ox: 0.6, oz: 4.8 }],
  copyright: [{ ox: 4.9, oz: 0.4 }, { ox: -0.4, oz: -4.9 }],
  deepfake: [{ ox: -5.0, oz: 0.6 }, { ox: 1.8, oz: -4.6 }]
};

// 미해결 구역에만 글리치를 깐다(해결 구역은 정화된 땅).
export function buildFieldGlitches(zoneCenters, solvedTopicIds) {
  const solved = new Set(solvedTopicIds);
  const out = [];
  for (const [topicId, center] of Object.entries(zoneCenters)) {
    if (solved.has(topicId)) {
      continue;
    }
    const spawns = GLITCH_SPAWNS[topicId] ?? [];
    spawns.forEach((s, i) => {
      out.push(createGlitch('scavenger', topicId, i, center.x + s.ox, center.z + s.oz));
    });
  }
  return out;
}
