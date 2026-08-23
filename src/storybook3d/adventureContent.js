import { STORYBOOK_CHAPTERS } from './content.js';

const CHAPTER_PROFILES = Object.freeze([
  { ground: 0x8c795f, path: 0xd5b978, accent: 0xf2bc61, enemy: '먹물 새싹', boss: '빈 이름을 먹는 수호자', landmark: '유리 등불 정원' },
  { ground: 0x687b61, path: 0xcbb97c, accent: 0xf0b85b, enemy: '기운 저울벌레', boss: '큰 숫자의 저울왕', landmark: '저울나무 뿌리길' },
  { ground: 0x7f5c72, path: 0xd7ae77, accent: 0xffc56e, enemy: '손자국 도깨비', boss: '이름 없는 가면지기', landmark: '반딧불 축제뜰' },
  { ground: 0x557481, path: 0xb9c6b2, accent: 0xf0b85d, enemy: '메아리 종이새', boss: '빌린 목소리의 둥지왕', landmark: '물 위 메아리 극장' },
  { ground: 0x765d57, path: 0xc9ad7a, accent: 0xe9a958, enemy: '도장 톱니', boss: '멈추지 않는 손', landmark: '세 겹 시계탑' },
  { ground: 0xa69e8e, path: 0xe2d6b7, accent: 0xffc865, enemy: '흰 먹물 조각', boss: '이야기를 삼키는 흰 먹물', landmark: '반딧불 하얀 방' }
]);

const ENEMY_POSITIONS = Object.freeze([
  [[-2.7, 0.2], [2.5, -1.2]],
  [[-3.1, -0.5], [2.7, 0.7]],
  [[-2.2, 1.1], [2.8, -0.4]],
  [[-3.0, 0.8], [2.4, -1.4]],
  [[-2.6, -1.0], [3.0, 0.4]],
  [[-2.8, 0.5], [2.6, -0.8]]
]);

function freezePoint(point) {
  return Object.freeze({ x: point[0], z: point[1] });
}

export function getAdventureZone(chapterIndex) {
  const chapter = STORYBOOK_CHAPTERS[chapterIndex];
  const profile = CHAPTER_PROFILES[chapterIndex];
  if (!chapter || !profile) throw new RangeError(`존재하지 않는 모험 장: ${chapterIndex}`);
  return Object.freeze({
    chapterId: chapter.id,
    title: chapter.title,
    subtitle: chapter.subtitle,
    ...profile,
    bounds: Object.freeze({ minX: -8, maxX: 8, minZ: -6, maxZ: 6 }),
    start: freezePoint([0, 4.6]),
    clues: Object.freeze([
      Object.freeze({ ...chapter.clues[0], ...freezePoint([-4.5, -2.7]) }),
      Object.freeze({ ...chapter.clues[1], ...freezePoint([0.2, -3.7]) })
    ]),
    sigils: Object.freeze([freezePoint([-3.5, 1.8]), freezePoint([3.5, 1.8])]),
    key: freezePoint([0, 0.4]),
    gate: freezePoint([0, -4.9]),
    boss: freezePoint([0, -5.35]),
    enemies: Object.freeze(ENEMY_POSITIONS[chapterIndex].map((point, index) => Object.freeze({
      id: `${chapter.id}-ink-${index + 1}`,
      ...freezePoint(point)
    })))
  });
}
