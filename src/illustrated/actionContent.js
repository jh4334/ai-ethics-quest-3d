export const FIXED_WORLD = Object.freeze({
  width: 6200,
  groundY: 560,
  gravity: 1900,
  moveSpeed: 310,
  jumpSpeed: 720
});

export const EVIDENCE_DATA = Object.freeze([
  Object.freeze({
    id: 'privacy',
    label: '개인정보',
    x: 1080,
    enemyId: 'eraser-privacy',
    checkpointX: 930,
    message: '하루의 사적인 대화가 동의 없이 수집됐어. 내용보다 먼저 당사자의 허락을 확인해야 해.'
  }),
  Object.freeze({
    id: 'bias',
    label: '편향',
    x: 2220,
    enemyId: 'eraser-bias',
    checkpointX: 2050,
    message: '한쪽 기록만 학습한 판정표야. 누락된 사람과 반대 사례를 함께 살펴봐야 해.'
  }),
  Object.freeze({
    id: 'copyright',
    label: '저작권',
    x: 3360,
    enemyId: 'eraser-copyright',
    checkpointX: 3190,
    message: '출처가 지워진 창작물이 섞여 있어. 만든 사람과 사용 허락을 기록에 다시 연결하자.'
  }),
  Object.freeze({
    id: 'deepfake',
    label: '딥페이크',
    x: 4500,
    enemyId: 'eraser-deepfake',
    checkpointX: 4330,
    message: '하루의 얼굴을 합성한 영상이야. 자극적인 장면보다 원본과 생성 흔적을 먼저 검증해야 해.'
  })
]);

export const ENEMY_DATA = Object.freeze([
  Object.freeze({ id: 'eraser-privacy', x: 870 }),
  Object.freeze({ id: 'eraser-bias', x: 2010 }),
  Object.freeze({ id: 'eraser-copyright', x: 3150 }),
  Object.freeze({ id: 'eraser-deepfake', x: 4290 })
]);
