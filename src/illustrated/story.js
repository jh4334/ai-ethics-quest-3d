export const STORY_BEATS = Object.freeze([
  Object.freeze({
    speaker: '도트',
    line: '저 발자국은 하루가 마지막으로 남긴 흔적이야. 따라가 보자.'
  }),
  Object.freeze({
    speaker: '나',
    line: '발자국 옆에 찢어진 채팅 기록이 떠 있다. 누군가 하루의 말을 잘라서 퍼뜨렸다.'
  }),
  Object.freeze({
    speaker: '하루·녹음',
    line: '내가 한 말만 보지 말고, 그 앞뒤에 무슨 일이 있었는지 확인해 줘.'
  }),
  Object.freeze({
    speaker: '도트',
    line: '원본 기록을 찾았어. 하루의 허락 없이 이걸 다시 퍼뜨리면 같은 상처가 반복돼.'
  })
]);

export function advanceStory(step) {
  if (!Number.isInteger(step) || step < 0) return Object.freeze({ phase: 'story', step: 0 });
  if (step < STORY_BEATS.length - 1) return Object.freeze({ phase: 'story', step: step + 1 });
  return Object.freeze({ phase: 'choice', step });
}

export function resolveChoice(choice) {
  if (choice === 'protect') {
    return Object.freeze({
      phase: 'complete',
      speaker: '하루·녹음',
      line: '고마워. 내 이야기를 되찾는 일은 내 비밀을 또 퍼뜨리는 일이 아니야.',
      outcome: 'protected'
    });
  }
  return Object.freeze({
    phase: 'recovery',
    speaker: '도트',
    line: '잠깐. 진실이어도 허락 없이 퍼뜨리면 하루가 다시 다칠 수 있어. 이번에는 먼저 확인하자.',
    outcome: 'shared'
  });
}
