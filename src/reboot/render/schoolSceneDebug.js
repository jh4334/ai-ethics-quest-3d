import { getFramingReport } from '../camera/controller.js';
import { getSceneViewport } from './schoolSceneCamera.js';

export function createSchoolSceneDebugSnapshot({
  activeTargets, bossGame, cameraState, canvas, cast, combatSafeArea, currentSegment,
  enemyCast, feedback, game, lastEnemyEvents, lastEvents, lastFrame, performanceProbe,
  route, story
}) {
  return Object.freeze({
    boss: bossGame?.getState() ?? null,
    camera: Object.freeze({
      ...getFramingReport(cameraState, activeTargets, getSceneViewport(canvas)),
      combatSafeArea
    }),
    characters: cast.getDebugState(),
    combat: Object.freeze({
      action: lastFrame.hud.action,
      chainLevel: lastFrame.hud.chainLevel,
      hp: lastFrame.hud.hp,
      // 체크포인트 리스폰·게이트 QA(S6a) — 플레이어 월드 좌표를 그대로 노출한다.
      player: Object.freeze({ x: lastFrame.player.position.x, z: lastFrame.player.position.z }),
      signal: lastFrame.hud.signal ?? null,
      tick: lastFrame.tick
    }),
    enemies: enemyCast.getDebugState(),
    feedback: feedback.getDebugState(),
    performance: performanceProbe.report(),
    enemyEventTypes: Object.freeze(lastEnemyEvents.map((event) => event.type)),
    encounter: game.getState().encounter,
    eventTypes: Object.freeze(lastEvents.map((event) => event.type)),
    route: route.getDebugState(),
    routeSegmentId: currentSegment.id,
    story: story.getState()
  });
}
