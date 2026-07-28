import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const unavailable = () => {
  throw new Error('chapter 4/5 finale contracts are not implemented');
};
const chapterCatalog = await import('../src/reboot/content/chapters/catalog.js').catch(() => ({}));
const campaignRuntime = await import('../src/reboot/campaign/runtime.js').catch(() => ({}));
const approvalPipeline = await import('../src/reboot/campaign/approvalPipeline.js').catch(() => ({}));
const finaleFixtures = await import('../src/reboot/campaign/finaleFixtures.js').catch(() => ({}));
const endings = await import('../src/reboot/campaign/endingEvaluator.js').catch(() => ({}));
const enemyCatalog = await import('../src/reboot/content/enemies/catalog.js').catch(() => ({}));
const enemyValidation = await import('../src/reboot/content/enemies/validateEnemies.js').catch(() => ({}));
const broadcast = await import('../src/reboot/bosses/broadcastProtocol.js').catch(() => ({}));
const chapterFourLevel = await import('../src/reboot/content/levels/chapter4.js').catch(() => ({}));
const chapterFiveLevel = await import('../src/reboot/content/levels/chapter5.js').catch(() => ({}));
const levelValidation = await import('../src/reboot/level/validateLevel.js').catch(() => ({}));

const { CHAPTERS_2_5 = [], CHAPTERS_4_5 = [] } = chapterCatalog;
const { validateChapterDefinitions = unavailable } = campaignRuntime;
const {
  applyApprovalCommand = unavailable,
  createApprovalPipelineState = unavailable
} = approvalPipeline;
const { createFinaleFixture = unavailable } = finaleFixtures;
const { finalizeCampaign = unavailable } = endings;
const { APPROVAL_DEFINITION = {}, ENEMY_DEFINITIONS = {} } = enemyCatalog;
const { validateEnemyDefinitions = unavailable } = enemyValidation;
const {
  createBroadcastProtocolState = unavailable,
  stepBroadcastProtocol = unavailable
} = broadcast;
const { chapterFourLevel: level4 = null } = chapterFourLevel;
const { chapterFiveLevel: level5 = null } = chapterFiveLevel;
const { validateLevel = unavailable } = levelValidation;

function reversePipeline(decision) {
  let state = createApprovalPipelineState();
  while (!state.readyForDecision) {
    state = applyApprovalCommand(state, { type: 'inspect' }).state;
    state = applyApprovalCommand(state, { type: 'reverse' }).state;
  }
  return applyApprovalCommand(state, { decision, type: 'decide' });
}

function advanceProtocolWindow(state) {
  const phase = state.definition.phases[state.phaseIndex];
  let current = state;
  while (current.phaseTick < phase.timing.windupTicks) current = stepBroadcastProtocol(current).state;
  return current;
}

test('Given chapters 4 and 5, When validated with the campaign, Then five chapters fit the canonical 2–3 hour route', () => {
  // Given: 승인실과 마지막 방송을 포함한 확장 카탈로그.
  const validation = validateChapterDefinitions(CHAPTERS_2_5);
  const chapterOneMinutes = 29;
  const totalMinutes = chapterOneMinutes
    + CHAPTERS_2_5.reduce((total, chapter) => total + chapter.timeline.desktopMinutes, 0);

  // Then: 4·5장의 루프/보스/PATCH/반전과 전체 길이가 정본 범위에 든다.
  assert.deepEqual(CHAPTERS_4_5.map((chapter) => chapter.id), [
    'chapter-4-three-second-approval', 'chapter-5-final-broadcast'
  ]);
  assert.deepEqual(validation.errors, []);
  assert.equal(totalMinutes >= 120 && totalMinutes <= 180, true);
  assert.equal(CHAPTERS_4_5.every((chapter) => chapter.boss.phases.length >= 3), true);
});

test('Given the approval pipeline, When reversed before deciding, Then speed and preservation remain viable with explicit costs', () => {
  // Given/When: 같은 삭제 파이프라인을 역주행한 뒤 서로 다른 결정을 내린다.
  const fast = reversePipeline('fast-shutdown');
  const preserve = reversePipeline('preserve-support');

  // Then: 둘 다 완료되지만 지원 기록과 다음 전투 압력이 반대로 남는다.
  assert.equal(fast.state.status, 'complete');
  assert.equal(preserve.state.status, 'complete');
  assert.equal(fast.state.supportRecordAction, 'purge');
  assert.equal(preserve.state.supportRecordAction, 'secure');
  assert.notEqual(fast.state.finalPressure, preserve.state.finalPressure);
  assert.match(fast.event.costKo, /지원/);
  assert.match(preserve.event.costKo, /시간|추격/);
});

test('Given the Approval enemy, When shared validation runs, Then it joins the immutable reusable catalog', () => {
  const definitions = Object.values(ENEMY_DEFINITIONS);
  const validation = validateEnemyDefinitions(definitions);

  assert.deepEqual(definitions.map((definition) => definition.id), [
    'eraser', 'stamper', 'copycat', 'recommender', 'approval'
  ]);
  assert.deepEqual(validation.errors, []);
  assert.equal(APPROVAL_DEFINITION.role, 'pipeline-support');
});

test('Given the final protection protocol, When every learned verb lands in its window, Then preparation changes pressure but not viability', () => {
  // Given: 지원 기록을 보존한 경로와 빠르게 중단한 경로.
  const prepared = createFinaleFixture('redacted').campaign;
  const exposed = createFinaleFixture('raw').campaign;
  let state = createBroadcastProtocolState(prepared);
  const expectedActions = ['reflect', 'trace', 'dash', 'attack'];
  const phaseIds = [];

  // When: 너무 이른 입력은 거부되고, 네 숙련 동사를 각 활성 창에 넣는다.
  const early = stepBroadcastProtocol(state, { actions: [{ id: 'early', type: 'attack' }] });
  assert.equal(early.events.some((event) => event.type === 'protocol-rejected'), true);
  for (const [index, action] of expectedActions.entries()) {
    state = advanceProtocolWindow(state);
    phaseIds.push(state.definition.phases[state.phaseIndex].id);
    const targetId = action === 'trace' ? 'consent-ledger' : undefined;
    state = stepBroadcastProtocol(state, {
      actions: [{ id: `mastery-${index}`, targetId, type: action }]
    }).state;
  }

  // Then: 순서가 고정되고 승리하며, 불완전 경로도 더 좁은 창으로 시작할 뿐 막히지 않는다.
  const exposedState = createBroadcastProtocolState(exposed);
  assert.deepEqual(phaseIds, ['reflect-shield', 'trace-consent', 'dash-relay', 'signal-core']);
  assert.equal(state.status, 'victory');
  assert.equal(state.hp, 0);
  assert.ok(state.activeWindowTicks > exposedState.activeWindowTicks);
  assert.equal(exposedState.status, 'active');
});

test('Given documented histories, When the campaign finalizes twice, Then three concrete endings are reachable and save once', () => {
  const results = ['redacted', 'raw', 'sealed'].map((id) => {
    const fixture = createFinaleFixture(id);
    const first = finalizeCampaign(fixture.campaign, { decision: fixture.decision });
    const repeated = finalizeCampaign(first.state, { decision: fixture.decision });
    return { first, id, repeated };
  });

  assert.deepEqual(results.map(({ first }) => first.outcome.id), [
    'redacted-broadcast', 'raw-disclosure', 'sealed-incident'
  ]);
  for (const { first, repeated } of results) {
    assert.equal(repeated.state, first.state);
    assert.equal(first.state.evidence.filter((record) => record.evidenceId === 'broadcast-queue').length, 1);
    assert.ok(first.outcome.peopleChanges.length >= 3);
    assert.ok(first.outcome.worldChanges.length >= 2);
    assert.ok(first.outcome.costs.length >= 1);
    assert.doesNotMatch(JSON.stringify(first.outcome), /correct|morality|grade|score|정답|점수/i);
  }
});

test('Given chapter 4/5 routes and pure finale rules, When inspected, Then levels validate and simulation stays deterministic', () => {
  assert.deepEqual([level4, level5].map((level) => validateLevel(level).errors), [[], []]);
  const sources = [
    '../src/reboot/campaign/approvalPipeline.js',
    '../src/reboot/campaign/endingEvaluator.js',
    '../src/reboot/bosses/broadcastProtocol.js'
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
  assert.equal(/Math\.random|from ['"]three['"]/.test(sources), false);
});
