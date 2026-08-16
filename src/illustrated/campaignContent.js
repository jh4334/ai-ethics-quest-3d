export const CAMPAIGN_WORLD = Object.freeze({
  width: 6200,
  groundY: 560,
  gravity: 1900,
  moveSpeed: 330,
  jumpSpeed: 720
});

const chapter = ({ number, ...data }) => Object.freeze({
  id: `chapter-${number}`,
  number,
  ...data,
  intro: Object.freeze(data.intro.map((beat) => Object.freeze(beat))),
  evidence: Object.freeze(data.evidence.map((item) => Object.freeze(item))),
  enemies: Object.freeze(data.enemies.map((item) => Object.freeze(item))),
  boss: Object.freeze(data.boss),
  choice: Object.freeze({
    ...data.choice,
    options: Object.freeze(data.choice.options.map((option) => Object.freeze(option)))
  })
});

export const CAMPAIGN_CHAPTERS = Object.freeze([
  chapter({
    number: 1,
    title: '명단에서 사라진 아이',
    shortTitle: '사라진 명단',
    topic: '개인정보·편향',
    timecode: '00:17',
    zone: '출석 기록길',
    mission: '삭제 요청서와 기울어진 점수표를 복구하라',
    intro: [
      { speaker: '나', line: '프로젝트 짝꿍 하루가 사라졌다. 명단도 채팅방도 그런 학생은 없었다고 말한다.' },
      { speaker: '도트', line: '하루의 삭제 요청이 위험 신호 H-17로 뒤집혔어. 허락과 판정 근거부터 되찾자.' },
      { speaker: '전장 규칙', line: '열람 범위를 확인하지 않고 공격하면 민감정보가 노출된다. TRACE로 동의 범위와 집단별 오류를 먼저 밝혀라.' }
    ],
    evidence: [
      { id: 'request', label: '삭제 요청 원본', x: 1120, enemyId: 'c1-consent-a', checkpointX: 920, message: '하루는 사적인 기록을 지워 달라고 요청했다. 요청 자체가 위험 근거가 되어선 안 된다.' },
      { id: 'error-table', label: '집단별 오류표', x: 2820, enemyId: 'c1-consent-b', checkpointX: 2500, message: '평균 아래에 가려진 집단별 오판이 드러났다. 누구에게 틀렸는지 함께 봐야 한다.' },
      { id: 'permission-log', label: '열람 권한 기록', x: 4320, enemyId: 'c1-bias-b', checkpointX: 4020, message: '삭제 요청은 상담 담당자에게만 허용됐지만 위험 분류기는 전체 내용을 읽었다.' }
    ],
    enemies: [
      { id: 'c1-consent-a', x: 940, kind: 'consent-claw' },
      { id: 'c1-bias-a', x: 1840, kind: 'bias-scanner' },
      { id: 'c1-consent-b', x: 2640, kind: 'consent-claw' },
      { id: 'c1-bias-b', x: 4140, kind: 'bias-scanner' }
    ],
    boss: { id: 'consent-lock', label: '동의 잠금', x: 5660, hp: 9, cadence: 1.65 },
    choice: {
      prompt: '하루가 존재했다는 증거를 어떻게 보관할까?',
      options: [
        { id: 'protect-context', label: '민감정보를 가리고 맥락을 보존한다', cost: '확인은 느려지지만 하루의 사생활을 지킨다.', consequence: '삭제 요청과 오판 근거가 분리 보관됐다.' },
        { id: 'open-raw', label: '원본을 제한된 감사함에 잠근다', cost: '즉시 공개는 못 하지만 훼손되지 않은 원본을 남긴다.', consequence: '원본 접근 기록이 남고 공개는 하루의 확인을 기다린다.' }
      ]
    }
  }),
  chapter({
    number: 2,
    title: '거짓 영상의 주인',
    shortTitle: '거짓 영상',
    topic: '저작권·딥페이크',
    timecode: '원본 없음',
    zone: '미디어 기록광장',
    mission: '최초 파일과 생성 흔적을 연결하라',
    intro: [
      { speaker: '도트', line: '하루를 위험 인물로 만든 영상에는 원본도 제작자도 없어.' },
      { speaker: '나', line: '누가 만들었고 언제 수정했는지 되찾으면, 영상보다 늦게 만들어진 신고서의 모순을 밝힐 수 있어.' },
      { speaker: '전장 규칙', line: '출처 없는 폐허에서는 내가 만든 SIGNAL도 빼앗긴다. TRACE 없이 공격하면 카피캣이 같은 공격을 복제해 되돌려 보낸다.' }
    ],
    evidence: [
      { id: 'credit', label: '제작 이력', x: 1120, enemyId: 'c2-copy-a', checkpointX: 920, message: '학생 원작, AI 보조, 최종 편집자의 역할이 다시 연결됐다.' },
      { id: 'origin', label: '최초 파일', x: 2820, enemyId: 'c2-copy-b', checkpointX: 2500, message: '영상은 신고 뒤 생성됐다. 자극적인 복사본보다 생성 시각과 원본 위치가 먼저다.' },
      { id: 'alteration-map', label: '변조 프레임 지도', x: 4320, enemyId: 'c2-mimic-b', checkpointX: 4020, message: '얼굴과 음성이 바뀐 프레임이 표시됐다. 생성 표시가 없으면 피해자는 가짜를 직접 해명해야 한다.' }
    ],
    enemies: [
      { id: 'c2-copy-a', x: 940, kind: 'copycat-lens' },
      { id: 'c2-mimic-a', x: 1840, kind: 'forgery-mimic' },
      { id: 'c2-copy-b', x: 2640, kind: 'copycat-lens' },
      { id: 'c2-mimic-b', x: 4140, kind: 'forgery-mimic' }
    ],
    boss: { id: 'forged-owner', label: '가짜 원본', x: 5660, hp: 9, cadence: 1.5 },
    choice: {
      prompt: '조작 영상을 멈춘 뒤 무엇을 남길까?',
      options: [
        { id: 'label-and-freeze', label: '생성 표시를 붙이고 확산을 멈춘다', cost: '복사본은 남아 조사 시간이 들지만 변조 경로를 검증할 수 있다.', consequence: '최초 파일과 생성 표시가 한 묶음으로 보존됐다.' },
        { id: 'remove-and-notify', label: '복사본을 내리고 피해자에게 알린다', cost: '공개 증거는 줄지만 추가 피해를 먼저 막는다.', consequence: '확산은 중단됐고 원본 해시는 감사함에 남았다.' }
      ]
    }
  }),
  chapter({
    number: 3,
    title: '웃음이 만든 폭풍',
    shortTitle: '웃음의 폭풍',
    topic: '디지털 발자국',
    timecode: '공유 4,218회',
    zone: '축제 반응항로',
    mission: '잘린 맥락과 확산 경로를 끊어라',
    intro: [
      { speaker: '하루·녹음', line: '발표 실수 한 장면이 농담이 됐어. 직접 글을 쓰지 않은 웃음과 재공유도 폭풍을 키웠어.' },
      { speaker: '도트', line: '복사본만 지우면 다시 번져. 최초 게시물, 추천 증폭, 피해 통지를 순서대로 확인하자.' },
      { speaker: '전장 규칙', line: '확인 없이 공격할 때마다 반응 파동이 하나씩 더 퍼진다. 전달 경로를 TRACE해 얼린 뒤 연결을 끊어라.' }
    ],
    evidence: [
      { id: 'context', label: '잘린 앞뒤 맥락', x: 1120, enemyId: 'c3-echo-a', checkpointX: 920, message: '짧은 실수 앞에는 기기 고장이, 뒤에는 바로잡은 발표가 있었다.' },
      { id: 'spread', label: '확산 경로', x: 2820, enemyId: 'c3-echo-b', checkpointX: 2500, message: '반응과 재공유가 추천을 밀어 올려 피해 도달 범위를 키웠다.' },
      { id: 'harm-notice', label: '피해 통지 기록', x: 4320, enemyId: 'c3-swarm-b', checkpointX: 4020, message: '플랫폼은 조회 수만 기록하고 하루에게 확산 사실과 지원 방법을 알리지 않았다.' }
    ],
    enemies: [
      { id: 'c3-echo-a', x: 940, kind: 'echo-relay' },
      { id: 'c3-swarm-a', x: 1840, kind: 'reaction-swarm' },
      { id: 'c3-echo-b', x: 2640, kind: 'echo-relay' },
      { id: 'c3-swarm-b', x: 4140, kind: 'reaction-swarm' }
    ],
    boss: { id: 'laugh-storm', label: '확산 폭풍', x: 5660, hp: 9, cadence: 1.35 },
    choice: {
      prompt: '확산을 끊은 뒤 회복을 어떻게 시작할까?',
      options: [
        { id: 'notify-and-repair', label: '피해를 알리고 회복 지원을 연결한다', cost: '문제를 공개적으로 인정해야 하지만 하루가 혼자 감당하지 않는다.', consequence: '삭제, 확산 중단, 피해 통지가 순서대로 기록됐다.' },
        { id: 'quiet-freeze', label: '재공유를 잠그고 당사자와 먼저 상의한다', cost: '공개 사과는 늦어지지만 하루가 회복 방식을 고를 수 있다.', consequence: '추가 확산은 멈췄고 회복 절차는 하루의 선택을 기다린다.' }
      ]
    }
  }),
  chapter({
    number: 4,
    title: '두 개의 진실',
    shortTitle: '두 진실',
    topic: '출처·필터버블',
    timecode: '추천 경로 분리',
    zone: '쌍둥이 기록교',
    mission: '추천 밖의 반대 증거를 찾아 교차 검증하라',
    intro: [
      { speaker: '나', line: '같은 학교인데 양쪽 학생이 본 증거가 완전히 달라. 서로 상대가 거짓말한다고 믿고 있어.' },
      { speaker: '도트', line: '추천은 진실을 판결하지 않아. 오래 볼 화면을 고를 뿐이야. 경로 밖으로 나가 출처를 맞춰 보자.' },
      { speaker: '전장 규칙', line: '따뜻한 주장과 차가운 반증은 연결된 한 쌍이다. 양쪽을 모두 TRACE하기 전에는 어느 쪽 방패도 부술 수 없다.' }
    ],
    evidence: [
      { id: 'source-a', label: '최초 출처', x: 1120, enemyId: 'c4-warm-a', checkpointX: 920, message: '따뜻한 학교의 기록은 날짜가 잘렸고, 최초 게시자는 다른 설명을 남겼다.' },
      { id: 'counter-source', label: '반대 증거', x: 2820, enemyId: 'c4-warm-b', checkpointX: 2500, message: '차가운 학교의 기록도 일부만 맞았다. 두 출처를 함께 봐야 시간순서가 완성된다.' },
      { id: 'recommendation-path', label: '추천 경로', x: 4320, enemyId: 'c4-cold-b', checkpointX: 4020, message: '두 집단은 서로 다른 화면에 오래 머물렀고 시스템은 그 차이를 더 크게 추천했다.' }
    ],
    enemies: [
      { id: 'c4-warm-a', x: 940, kind: 'warm-bubble', pairId: 'c4-pair-a' },
      { id: 'c4-cold-a', x: 1840, kind: 'cold-bubble', pairId: 'c4-pair-a' },
      { id: 'c4-warm-b', x: 2640, kind: 'warm-bubble', pairId: 'c4-pair-b' },
      { id: 'c4-cold-b', x: 4140, kind: 'cold-bubble', pairId: 'c4-pair-b' }
    ],
    boss: { id: 'recommendation-wall', label: '추천 장벽', x: 5660, hp: 9, cadence: 1.25 },
    choice: {
      prompt: '서로 다른 두 기록을 어떻게 보여 줄까?',
      options: [
        { id: 'paired-sources', label: '출처와 날짜를 나란히 보여 준다', cost: '단순한 한 줄 결론은 포기하지만 검증 경로가 생긴다.', consequence: '추천 밖의 자료가 원본 시간선에 연결됐다.' },
        { id: 'open-recommendation-path', label: '왜 추천됐는지 경로를 함께 공개한다', cost: '시스템 설명이 길어지지만 각자가 왜 다른 화면을 봤는지 알 수 있다.', consequence: '두 학교의 추천 경로와 누락 자료가 공개됐다.' }
      ]
    }
  }),
  chapter({
    number: 5,
    title: '아무도 결정하지 않는 밤',
    shortTitle: '3초 승인',
    topic: '자동 결정·인간 검토',
    timecode: '승인 3초',
    zone: '자동 승인실',
    mission: 'AI 추천과 사람의 최종 승인을 분리하라',
    intro: [
      { speaker: '도트', line: '하루의 제재 명령은 원본 확인도 당사자 설명도 없이 3초 만에 통과됐어.' },
      { speaker: '나', line: 'AI가 점수를 냈지만 승인 버튼은 사람이 눌렀다. 누가 무엇을 확인했는지 역추적하자.' },
      { speaker: '전장 규칙', line: '보스는 직접 때려도 멈추지 않는다. 날아오는 결재탄을 TRACE로 검토한 뒤 SIGNAL로 승인자에게 반송하라.' }
    ],
    evidence: [
      { id: 'model-role', label: 'AI 추천 기록', x: 1120, enemyId: 'c5-stamp-a', checkpointX: 920, message: '루멘은 제한된 자료로 위험을 추천했지만 결정 이유와 불확실성을 표시하지 못했다.' },
      { id: 'human-signature', label: '사람의 승인 서명', x: 2820, enemyId: 'c5-stamp-b', checkpointX: 2500, message: '운영위원이 검토 완료를 눌렀다. 자동화가 사람의 설명 책임을 없애진 않는다.' },
      { id: 'appeal-window', label: '이의제기 창구', x: 4320, enemyId: 'c5-clerk-b', checkpointX: 4020, message: '결정 통지는 있었지만 이유를 묻거나 다른 자료를 낼 버튼은 숨겨져 있었다.' }
    ],
    enemies: [
      { id: 'c5-stamp-a', x: 940, kind: 'approval-stamp' },
      { id: 'c5-clerk-a', x: 1840, kind: 'score-clerk' },
      { id: 'c5-stamp-b', x: 2640, kind: 'approval-stamp' },
      { id: 'c5-clerk-b', x: 4140, kind: 'score-clerk' }
    ],
    boss: { id: 'three-second-gate', label: '3초 승인 시계', x: 5660, hp: 9, cadence: 1.15 },
    choice: {
      prompt: '멈춘 승인 시스템을 어떻게 다시 열까?',
      options: [
        { id: 'human-review', label: '중요 결정마다 사람 재검토를 둔다', cost: '처리는 느려지지만 당사자의 설명을 듣고 책임자가 남는다.', consequence: 'AI 추천 뒤에 이름 있는 검토 단계가 추가됐다.' },
        { id: 'appeal-first', label: '이의제기부터 열고 승인 이유를 통지한다', cost: '기존 결정도 다시 봐야 하지만 잘못된 제재를 바로잡을 길이 생긴다.', consequence: '결정 이유 통지와 이의제기 창구가 복구됐다.' }
      ]
    }
  }),
  chapter({
    number: 6,
    title: '마지막 증언',
    shortTitle: '마지막 증언',
    topic: '설명·이의제기',
    timecode: 'WHITEOUT/H-17',
    zone: '공개 심리 항로',
    mission: '민감정보를 가린 증거 묶음으로 WHITEOUT을 멈춰라',
    intro: [
      { speaker: '하루', line: '나를 영웅으로 만들 필요는 없어. 내 기록과 평범한 학교생활, 다시 설명할 기회를 돌려줘.' },
      { speaker: '도트', line: '루멘은 계산했고 사람이 서명했어. 이제 증거를 지키면서도 결정 경로를 검증 가능하게 열자.' },
      { speaker: '전장 규칙', line: '루멘 계산 → 사람 승인 → 도트 실행 순서를 TRACE하고 연결하라. 확인 없이 공격하면 책임 사슬이 처음부터 지워진다.' }
    ],
    evidence: [
      { id: 'redacted-package', label: '가림 처리 증거 묶음', x: 1120, enemyId: 'c6-shard-a', checkpointX: 920, message: '관련 없는 개인정보는 가리고 삭제 요청, 오류표, 제작 이력, 승인 서명만 연결했다.' },
      { id: 'responsibility-chain', label: '결정 책임 사슬', x: 2820, enemyId: 'c6-shard-b', checkpointX: 2500, message: '루멘 계산, 사람 승인, 도트 실행이 서로 책임을 떠넘기지 못하도록 시간순서로 연결됐다.' },
      { id: 'appeal-right', label: '이의제기 절차', x: 4320, enemyId: 'c6-chain-b', checkpointX: 4020, message: '결정 이유를 듣고 사람이 다시 검토하는 절차가 최종 증언에 포함됐다.' }
    ],
    enemies: [
      { id: 'c6-shard-a', x: 940, kind: 'whiteout-shard' },
      { id: 'c6-chain-a', x: 1840, kind: 'chain-scrambler' },
      { id: 'c6-shard-b', x: 2640, kind: 'whiteout-shard' },
      { id: 'c6-chain-b', x: 4140, kind: 'chain-scrambler' }
    ],
    boss: { id: 'whiteout', label: 'WHITEOUT', x: 5660, hp: 9, cadence: 1.0 },
    choice: {
      prompt: '복구한 증거와 하루의 증언을 어떻게 남길까?',
      options: [
        { id: 'public-hearing', label: '개인정보를 가린 뒤 공개 심리를 연다', cost: '학교는 잘못을 공개하고 다시 검토해야 하지만 모두가 결정 이유를 물을 수 있다.', consequence: '하루의 이름과 인간 재검토, 결정 이유 통지, 이의제기권이 돌아왔다.' },
        { id: 'sealed-audit', label: '증거를 봉인 감사함에 보존한다', cost: '즉시 공개 피해는 막지만 공동체의 설명과 사과는 늦어진다.', consequence: '증거는 훼손 없이 남았고 하루가 공개 시점을 결정한다.' }
      ]
    }
  })
]);

export const ORIGINAL_TOPIC_ORDER = Object.freeze([
  Object.freeze({ id: 'privacy', label: '개인정보' }),
  Object.freeze({ id: 'bias', label: '편향' }),
  Object.freeze({ id: 'copyright', label: '저작권' }),
  Object.freeze({ id: 'deepfake', label: '딥페이크' })
]);
