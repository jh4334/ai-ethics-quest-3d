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
  },
  // 파편 도둑 — 잡기에 닿으면 파편을 훔쳐 도주한다. 때리면 즉시 떨군다(무처벌: 영구 손실 없음).
  snitcher: {
    id: 'snitcher',
    nameKo: '슬쩍이',
    hp: 2,
    speed: 3.1,
    aggroRange: 6.5,
    attackRange: 1.6,
    move: { windup: 0.45, active: 0.18, recover: 0.7, cooldown: 2.2, lungeSpeed: 8.0 },
    staggerHold: 4.0,
    shardReward: 2,
    steals: true,
    stealCap: 2, // 한 번에 훔치는 최대 파편
    fleeSpeed: 5.0, // 걷기(6.1)보다 느리다 — 추격하면 반드시 잡힌다
    fleeTime: 3.2 // 도주 후 다시 노린다
  },
  // 에코 — 딥페이크의 화신. 쌍으로 나타나 진짜 흉내를 낸다.
  // 가짜(variant 'echo')는 미세하게 깜빡이고, 공격이 스쳐도 해가 없다(환영).
  echo: {
    id: 'echo',
    nameKo: '메아리',
    hp: 2,
    speed: 2.6,
    aggroRange: 6.0,
    attackRange: 1.7,
    move: { windup: 0.55, active: 0.2, recover: 0.9, cooldown: 1.8, lungeSpeed: 7.2 },
    staggerHold: 4.0,
    shardReward: 4
  }
};

// 정화 로어 카드 — 전리품이 곧 교육(주제별 한 줄, 도감에 축적).
export const LORE_CARDS = {
  privacy: '이 글리치는 「허락 없이 퍼진 사진들」이 뭉쳐 태어난 잡음이었다.',
  bias: '이 글리치는 「한쪽 이야기만 먹은 추천」이 뭉쳐 태어난 잡음이었다.',
  copyright: '이 글리치는 「이름표를 뗀 작품들」이 뭉쳐 태어난 잡음이었다.',
  deepfake: '이 글리치는 「진짜 흉내를 낸 목소리」가 뭉쳐 태어난 잡음이었다.'
};

// ── 파편 세공 (G3) — 강화 트랙·회피 프레임 데이터 ──────
// 순서 고정 트랙(교실 재현성): 회피 → 사거리 → 4타 체인 → 정화 파동.
export const UPGRADE_TRACK = [
  { id: 'dodge', nameKo: '회피 스텝', emoji: '💨', cost: 4, descKo: '앞으로 짧게 미끄러지며 공격을 흘린다' },
  { id: 'reach', nameKo: '긴 빛날', emoji: '🗡️', cost: 8, descKo: '베기가 닿는 거리가 늘어난다' },
  { id: 'chain4', nameKo: '4연 체인', emoji: '⚡', cost: 14, descKo: '베기 체인이 4타까지 이어진다' },
  { id: 'purifyWave', nameKo: '정화 파동', emoji: '✨', cost: 20, descKo: '정화의 빛이 주변 글리치까지 휘청이게 한다' }
];

// 회피 스텝 프레임 데이터 — 무적 창(iframes)은 시전 직후부터, 쿨다운은 짧게(리듬 유지).
export const DODGE = { speed: 13, duration: 0.2, iframes: 0.45, cooldown: 0.9, waveRange: 3.6 };

// 다음 구매 가능 항목(트랙 순서 고정). 전부 샀으면 null.
export function nextUpgrade(owned) {
  return UPGRADE_TRACK.find((u) => !owned.includes(u.id)) ?? null;
}

// 구매 시도 — 성공 시 { id, shards(잔액) }, 불가(품절·파편 부족) 시 null. 순수 함수.
export function purchaseUpgrade(owned, shards) {
  const next = nextUpgrade(owned);
  if (!next || shards < next.cost) {
    return null;
  }
  return { id: next.id, shards: shards - next.cost };
}

// 강화 반영 베기 파라미터 — 표현 계층은 항상 이 값으로 판정한다.
export function getSlashParams(owned) {
  return {
    range: SLASH.range + (owned.includes('reach') ? 0.5 : 0),
    chainMax: owned.includes('chain4') ? 4 : SLASH.chainMax
  };
}

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
export function createGlitch(archetypeId, topicId, index, x, z, variant = 'real') {
  const arch = GLITCH_ARCHETYPES[archetypeId];
  if (!arch) {
    throw new RangeError(`Unknown glitch archetype: ${archetypeId}`);
  }
  return {
    id: `${archetypeId}-${variant}-${topicId}-${index}`,
    archetypeId,
    topicId,
    variant, // 'real' | 'echo'(가짜 분신 — 베면 흩어지고 공격은 환영)
    x,
    z,
    homeX: x,
    homeZ: z,
    hp: arch.hp,
    state: 'idle', // idle → pursue → windup → attack → recover → (flee) → (stagger) → purified
    t: 0, // 현재 상태 경과 시간
    cd: 0, // 공격 쿨다운
    lungeX: 0, // windup 진입 시 고정되는 돌진 방향(즉시 회전 타격 금지)
    lungeZ: 0,
    hitConsumed: false, // 유효 창당 접촉 1회(권위 있는 판정)
    stolen: 0, // 슬쩍이가 들고 있는 훔친 파편
    droppedShards: 0 // 피격으로 떨군 파편 — 표현 계층이 회수 처리 후 0으로
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
  if (g.state === 'flee') {
    // 도주 — 플레이어 반대 방향, 걷기보다 느려 추격하면 반드시 잡힌다.
    if (g.t >= (arch.fleeTime ?? 0)) {
      g.state = 'pursue';
      g.t = 0;
      return out;
    }
    out.moveX = -nx * (arch.fleeSpeed ?? arch.speed);
    out.moveZ = -nz * (arch.fleeSpeed ?? arch.speed);
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

// 잡기 성공(슬쩍이) — 파편을 훔치고 도주로 전환. 훔친 양을 반환한다.
// playerShards가 0이면 허탕(0 반환)이지만 도주는 한다(리듬 유지).
export function stealFromPlayer(g, playerShards) {
  const arch = GLITCH_ARCHETYPES[g.archetypeId];
  const amount = arch.steals ? Math.min(arch.stealCap, Math.max(0, Math.floor(playerShards))) : 0;
  g.stolen += amount;
  g.state = 'flee';
  g.t = 0;
  g.cd = arch.move.cooldown;
  return amount;
}

// 베기 피격 — hp가 다하면 스태거(정화 대기).
// 반환: 'hit' | 'staggered' | 'dispersed'(가짜 에코가 흩어짐) | 'ignored'
export function hitGlitch(g) {
  if (g.state === 'purified' || g.state === 'stagger') {
    return 'ignored';
  }
  if (g.variant === 'echo') {
    // 가짜였다 — 보상도 벌점도 없이 흩어진다. 진짜를 찾아라(딥페이크).
    g.state = 'purified';
    g.t = 0;
    return 'dispersed';
  }
  // 훔친 파편은 첫 피격에 즉시 떨군다 — 표현 계층이 회수해 돌려준다(영구 손실 없음).
  if (g.stolen > 0) {
    g.droppedShards += g.stolen;
    g.stolen = 0;
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

// 미해결 구역에만 글리치를 깐다(해결 구역은 정화된 땅). 1웨이브(GLITCH_SPAWNS)만.
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

// ── 조우 웨이브 (고정표 — 교실 재현성) ──────────────────
// 1웨이브(GLITCH_SPAWNS)를 소탕하면 등장하는 추가 웨이브. 첫 구역(privacy)은 온보딩이라 없음.
// deepfake 최종 웨이브는 에코 쌍둥이 — 진짜/가짜 구별이 곧 주제 학습.
export const GLITCH_WAVES = {
  privacy: [],
  bias: [
    [
      { arch: 'scavenger', ox: -3.8, oz: 3.6 },
      { arch: 'snitcher', ox: 4.2, oz: 2.8 }
    ]
  ],
  copyright: [
    [
      { arch: 'snitcher', ox: -4.2, oz: 3.2 },
      { arch: 'scavenger', ox: 3.6, oz: -3.8 }
    ]
  ],
  deepfake: [
    [
      { arch: 'echo', ox: -3.6, oz: -3.4, variant: 'real' },
      { arch: 'echo', ox: 3.4, oz: -3.6, variant: 'echo' },
      { arch: 'snitcher', ox: 0.4, oz: 5.2 }
    ]
  ]
};

// 구역 소탕 보너스 — 모든 웨이브를 전투로 비웠을 때 1회(진행 저장).
export const ZONE_CLEAR_BONUS = 6;

// 구역의 전체 웨이브 수(1웨이브 포함).
export function zoneWaveCount(topicId) {
  return 1 + (GLITCH_WAVES[topicId]?.length ?? 0);
}

// n번째 추가 웨이브 인스턴스 생성 (waveIndex 1부터 — 0은 GLITCH_SPAWNS).
export function buildWaveGlitches(topicId, waveIndex, center) {
  const wave = GLITCH_WAVES[topicId]?.[waveIndex - 1] ?? [];
  return wave.map((s, i) =>
    createGlitch(s.arch, topicId, waveIndex * 10 + i, center.x + s.ox, center.z + s.oz, s.variant ?? 'real')
  );
}
