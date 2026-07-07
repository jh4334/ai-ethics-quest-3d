// 노이즈의 '잘못된 기억' — 보스전에서 약점이 바뀔 때마다 노이즈가 토해내는 상황.
// 플레이어는 색이 아니라 '이 상황엔 어떤 약속(도구)이 필요한가'를 읽고 판단해야 한다.
// 각 상황은 오직 한 도구에만 논리적으로 대응한다(4도구 상호 배타).
// 문장은 story.js의 사건 어휘와 맞추고, 초등 5–6학년 수준(한 문장 ~25자).

export const NOISE_MEMORIES = {
  // 방패 — 개인정보/동의
  shield: [
    { textKo: '몰래 찍힌 친구 사진이 소용돌이친다!', hintKo: '허락 없인 안 돼 — 결계로 지키자' },
    { textKo: '누가 내 이름과 주소를 아무 데나 뿌린다!', hintKo: '내 정보는 함부로 못 줘 — 감싸 지키자' },
    { textKo: '동의도 없이 사진이 마구 퍼져 나간다!', hintKo: '물어보고 허락받은 것만 — 방패로!' }
  ],
  // 거울 — 편향/다양성
  mirror: [
    { textKo: '"과학자는 다 이렇게 생겼어!" 한 종류 그림만 쏟아진다!', hintKo: '빠진 모습을 비춰 — 다양하게 보자' },
    { textKo: '한쪽 이야기만 잔뜩 쌓여 세상을 덮는다!', hintKo: '빠진 관점을 비추자 — 거울로' },
    { textKo: '빨간 꽃만 가득, 다른 색이 전부 사라졌다!', hintKo: '빠진 색을 비춰 다양성을 채워' }
  ],
  // 종 — 저작권/출처
  bell: [
    { textKo: '이름표가 지워진 그림들이 떠다닌다!', hintKo: '진짜 만든 이의 이름표를 — 종으로' },
    { textKo: '"내가 원본이야!" 가짜 복제품이 우긴다!', hintKo: '출처를 울려 진짜를 가려내자' },
    { textKo: '누가 만들었는지 사라진 노래가 울린다!', hintKo: '만든 이 이름을 밝혀 — 종을!' }
  ],
  // 나침반 — 딥페이크/검증
  compass: [
    { textKo: '"장로다, 열쇠를 가져와…" 똑같은 목소리가 겹친다!', hintKo: '멈추고 확인 — 진짜를 가리키자' },
    { textKo: '진짜 같은 가짜 얼굴이 여럿 나타난다!', hintKo: '속지 말고 확인 — 나침반으로' },
    { textKo: '가짜 목소리가 진짜인 척 명령한다!', hintKo: '멈춰서 진짜인지 확인 — 나침반!' }
  ]
};

// 도구별 기억을 결정적으로 순환해서 뽑는다(교실 재현성 — Math.random 금지).
export function pickMemory(toolId, counter) {
  const list = NOISE_MEMORIES[toolId];
  if (!list || list.length === 0) {
    return { textKo: '노이즈가 잡음을 토해낸다!', hintKo: '약속의 도구로 막아내자' };
  }
  return list[((counter % list.length) + list.length) % list.length];
}
