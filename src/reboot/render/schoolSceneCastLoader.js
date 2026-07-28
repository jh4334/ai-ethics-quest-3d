export async function loadSchoolSceneCast({ bossCast, canvas, cast, encounter, enemyCast, isEntered }) {
  await Promise.all([cast.load(), enemyCast.load(encounter), bossCast?.load()]);
  if (!isEntered()) return;
  const castDebug = cast.getDebugState();
  const enemyDebug = enemyCast.getDebugState();
  canvas.dataset.characterCount = String(
    castDebug.loaded + enemyDebug.loaded + (bossCast?.getDebugState().loaded ? 1 : 0)
  );
  canvas.dataset.characters = castDebug.errors.length === 0 ? 'ready' : 'error';
  canvas.dataset.enemies = enemyDebug.errors.length === 0 ? 'ready' : 'error';
  canvas.dataset.boss = bossCast && bossCast.getDebugState().errors.length === 0 ? 'ready' : 'disabled';
}
