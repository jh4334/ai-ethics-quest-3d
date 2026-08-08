import { CHARACTER_IDS, deepFreeze, normalizeRebootState } from './model.js';
import { createLearningReport } from './learningReport.js';

const evidenceLabels = Object.freeze({
  'haru-memory-backup': '하루의 기억 백업',
  'player-approval-record': '플레이어 승인 기록',
  'original-upload-trace': '최초 업로드 흔적',
  'dot-deletion-log': 'DOT 삭제 로그',
  'support-record': '긴급 지원 기록',
  'verified-package': '검증된 증언 패키지',
  'broadcast-queue': '방송 대기열'
});

const actionLabels = Object.freeze({
  secure: '확보했다.',
  purge: '삭제했다.',
  expose: '공개했다.'
});

const consequenceLabels = Object.freeze({
  secure: '검증 가능한 기록이 남고 공개 범위는 제한되었다.',
  purge: '공개 범위는 제한되었지만 검증할 기록이 사라졌다.',
  expose: '기록은 남았지만 공개 범위가 넓어졌다.'
});

const characterLabels = Object.freeze({
  dot: 'DOT',
  haru: '하루',
  lumen: 'LUMEN',
  yoonseo: '윤서'
});

export function createResultSummary(state, gateDefinitions = []) {
  const current = normalizeRebootState(state);
  const observedActions = current.evidence.map((record) => (
    `${evidenceLabels[record.evidenceId]}을 ${actionLabels[record.action]}`
  ));
  const evidenceConsequences = current.evidence.map((record) => consequenceLabels[record.action]);
  const characterChanges = CHARACTER_IDS
    .filter((id) => current.trust[id] !== 0)
    .map((id) => `${characterLabels[id]}의 신뢰 변화: ${current.trust[id] > 0 ? '+' : ''}${current.trust[id]}`);

  return deepFreeze({
    observedActions,
    evidenceConsequences,
    characterChanges,
    learning: createLearningReport(current, gateDefinitions),
    worldChanges: [
      `확보된 기록 ${current.integrity.secured}개, 잃은 기록 ${current.integrity.lost}개`,
      `제한 공개 ${current.exposure.contained}개, 넓은 공개 ${current.exposure.disclosed}개`
    ]
  });
}
