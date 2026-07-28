export function chooseCharacterAnimation(profile, state = {}) {
  if (state.defeated) return profile.animations.defeat;
  if (state.hit) return profile.animations.hit;
  if (state.acting) return profile.animations.action;
  if (state.moving) return profile.animations.move;
  return profile.animations.idle;
}
