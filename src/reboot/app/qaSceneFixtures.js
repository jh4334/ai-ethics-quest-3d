import { createBossFixture } from '../bosses/fixtures.js';
import { createChapterOneBossFixture, createChapterOneEndingFixture } from '../story/chapterOneDirector.js';

const ROUTES = Object.freeze([
  ['route-classroom', { x: 0, y: -1 }], ['route-corridor', { x: 0, y: -18 }],
  ['route-first-arena', { x: 0, y: -39 }], ['route-memory', { x: 0, y: -54 }],
  ['route-pursuit', { x: 0, y: -76 }], ['route-gym', { x: 0, y: -104 }]
]);
const ENCOUNTERS = Object.freeze([
  ['enemy-mixed', { x: -7, y: -39 }, {}],
  ['enemy-blocked', { x: -7, y: -39 }, {
    blockAfterTick: 30,
    delayedBlockers: [{ id: 'qa-locker', maxX: -4, maxZ: -37, minX: -6, minZ: -40 }]
  }],
  ['enemy-offscreen', { x: -7, y: -39 }, { offscreenAfterTick: 30 }]
]);
const BOSS_PHASES = Object.freeze([
  ['qa-boss-phase-1', 'phase-1-window'],
  ['qa-boss-phase-2', 'phase-2-window'],
  ['qa-boss-phase-3', 'phase-3-window']
]);

export const QA_SCENE_IDS = Object.freeze([
  'qa-tutorial', 'qa-arena', 'qa-consequence-secure', 'qa-consequence-purge',
  ...BOSS_PHASES.map(([id]) => id), 'qa-result-secure', 'qa-corrupt-save', 'qa-low-performance'
]);

function endingOptions(branch) {
  const fixture = createChapterOneEndingFixture(branch);
  return { campaign: fixture.campaign, persist: () => {}, showOutcome: true };
}

export function createQaSceneFixtures({ createScene, persist }) {
  const bossCampaign = createChapterOneBossFixture('secure').campaign;
  return Object.freeze([
    ['disposal-fixture', () => createScene()],
    ...ROUTES.map(([id, position]) => [id, () => createScene(position)]),
    ...ENCOUNTERS.map(([id, position, options]) => [id, () => createScene(position, options)]),
    ...['secure', 'purge'].map((branch) => [
      `story-${branch}-ending`, () => createScene({ x: 0, y: -104 }, {}, endingOptions(branch), { enabled: false })
    ]),
    ...['secure', 'purge'].map((branch) => {
      const fixture = createChapterOneBossFixture(branch);
      return [`boss-${branch}`, () => createScene(
        { x: 0, y: -104 }, {}, { campaign: fixture.campaign, persist }, { enabled: true }
      )];
    }),
    ['qa-tutorial', () => createScene({ x: 0, y: -1 })],
    ['qa-arena', () => createScene({ x: -7, y: -39 })],
    ['qa-consequence-secure', () => createScene({ x: 0, y: -104 }, {}, endingOptions('secure'), { enabled: false })],
    ['qa-consequence-purge', () => createScene({ x: 0, y: -104 }, {}, endingOptions('purge'), { enabled: false })],
    ...BOSS_PHASES.map(([id, fixtureId]) => [id, () => createScene(
      { x: 0, y: -104 }, {}, { campaign: bossCampaign, persist },
      { enabled: true, initialState: createBossFixture(fixtureId) }
    )]),
    ['qa-result-secure', () => createScene({ x: 0, y: -104 }, {}, endingOptions('secure'), { enabled: false })],
    ['qa-corrupt-save', () => createScene({ x: 0, y: -1 })],
    ['qa-low-performance', () => createScene({ x: -7, y: -39 })]
  ]);
}
