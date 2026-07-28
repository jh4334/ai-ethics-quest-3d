// GitHub Pages의 저장소 하위 경로에서도 현재 문서를 기준으로 에셋을 찾는다.
const ASSET_ROOT = './assets/reboot/characters';

export const CHARACTER_ASSET_PATHS = Object.freeze({
  animationLibrary1: `${ASSET_ROOT}/animations/ual1-standard.glb`,
  animationLibrary2: `${ASSET_ROOT}/animations/ual2-standard.glb`,
  femaleBody: `${ASSET_ROOT}/base/Superhero_Female_FullBody.gltf`,
  femalePeasant: `${ASSET_ROOT}/outfits/Female_Peasant.gltf`,
  femaleRanger: `${ASSET_ROOT}/outfits/Female_Ranger.gltf`,
  maleBody: `${ASSET_ROOT}/base/Superhero_Male_FullBody.gltf`,
  malePeasant: `${ASSET_ROOT}/outfits/Male_Peasant.gltf`,
  maleRanger: `${ASSET_ROOT}/outfits/Male_Ranger.gltf`
});

export const BODY_ASSETS = Object.freeze({
  female: CHARACTER_ASSET_PATHS.femaleBody,
  male: CHARACTER_ASSET_PATHS.maleBody
});

export const OUTFIT_ASSETS = Object.freeze({
  female: Object.freeze({
    peasant: CHARACTER_ASSET_PATHS.femalePeasant,
    ranger: CHARACTER_ASSET_PATHS.femaleRanger
  }),
  male: Object.freeze({
    peasant: CHARACTER_ASSET_PATHS.malePeasant,
    ranger: CHARACTER_ASSET_PATHS.maleRanger
  })
});

export const ANIMATION_ASSETS = Object.freeze({
  ual1: CHARACTER_ASSET_PATHS.animationLibrary1,
  ual2: CHARACTER_ASSET_PATHS.animationLibrary2
});

const UAL1 = Object.freeze({
  action: 'Interact',
  defeat: 'Death01',
  hit: 'Hit_Chest',
  idle: 'Idle_Loop',
  move: 'Jog_Fwd_Loop'
});
const UAL2_ENEMY = Object.freeze({
  action: 'Melee_Hook',
  defeat: 'Hit_Knockback',
  hit: 'Hit_Knockback',
  idle: 'Idle_FoldArms_Loop',
  move: 'Zombie_Walk_Fwd_Loop'
});

function createProfile({ animations = UAL1, body, id, label, library = 'ual1', outfit, scale = 1, tint }) {
  return Object.freeze({
    animations,
    body,
    id,
    label,
    library,
    outfit,
    scale,
    tint
  });
}

export const CHARACTER_ROSTER = Object.freeze({
  player: createProfile({ id: 'player', label: '기록자', body: 'female', outfit: 'ranger', scale: 0.98, tint: '#315f92' }),
  dot: createProfile({ id: 'dot', label: 'DOT', body: 'female', outfit: 'ranger', scale: 0.84, tint: '#28b8c7' }),
  haru: createProfile({ id: 'haru', label: '하루', body: 'male', outfit: 'ranger', scale: 0.98, tint: '#3e5e7c' }),
  yoonseo: createProfile({ id: 'yoonseo', label: '윤서', body: 'female', outfit: 'ranger', scale: 0.9, tint: '#7b579a' }),
  'student-a': createProfile({ id: 'student-a', label: '학생 A', body: 'male', outfit: 'peasant', scale: 0.88, tint: '#3d6c64' }),
  'student-b': createProfile({ id: 'student-b', label: '학생 B', body: 'female', outfit: 'peasant', scale: 0.86, tint: '#72576f' }),
  eraser: createProfile({ id: 'eraser', label: '삭제자', body: 'male', outfit: 'ranger', scale: 1.02, tint: '#582d44', library: 'ual2', animations: UAL2_ENEMY }),
  stamper: createProfile({ id: 'stamper', label: '도장꾼', body: 'female', outfit: 'ranger', scale: 1, tint: '#8a3d35', library: 'ual2', animations: UAL2_ENEMY }),
  copycat: createProfile({ id: 'copycat', label: '복제자', body: 'male', outfit: 'peasant', scale: 0.96, tint: '#514078', library: 'ual2', animations: UAL2_ENEMY }),
  recommender: createProfile({ id: 'recommender', label: '추천자', body: 'female', outfit: 'ranger', scale: 1.04, tint: '#294f6f', library: 'ual2', animations: UAL2_ENEMY }),
  approval: createProfile({ id: 'approval', label: '승인관', body: 'male', outfit: 'ranger', scale: 1.08, tint: '#6f5428', library: 'ual2', animations: UAL2_ENEMY }),
  'attendance-proctor': createProfile({ id: 'attendance-proctor', label: '출석 감독관', body: 'male', outfit: 'ranger', scale: 1.22, tint: '#25283b', library: 'ual2', animations: UAL2_ENEMY }),
  lumen: createProfile({ id: 'lumen', label: '루멘', body: 'female', outfit: 'ranger', scale: 0.98, tint: '#d29b42' })
});

export function getCharacterProfile(id) {
  const profile = CHARACTER_ROSTER[id];
  if (!profile) throw new Error(`등록되지 않은 캐릭터: ${id}`);
  return profile;
}
