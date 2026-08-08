import { createTeacherInvestigationReport } from './teacherInvestigationReport.js';

const STATUS_LABELS = Object.freeze({
  'first-try': '첫 시도 통과',
  'legacy-grandfathered': '이전 5장 완료 기록 승계',
  retry: '재시도 뒤 통과', struggling: '추가 연습 필요', unknown: '확인 중'
});

function appendList(documentRef, parent, items, label) {
  const list = documentRef.createElement('ul');
  if (items.length === 0) items = [label];
  for (const item of items) {
    const row = documentRef.createElement('li');
    row.textContent = typeof item === 'string' ? item : item;
    list.append(row);
  }
  parent.append(list);
}

export function createTeacherReportView({ getState, root, windowRef = window }) {
  const report = root.querySelector('[data-teacher-report]');
  const content = report?.querySelector('[data-teacher-report-content]');
  if (!report || !content) throw new Error('교사용 조사 보고서 UI가 필요합니다.');

  function render() {
    const data = createTeacherInvestigationReport(getState());
    const documentRef = windowRef.document;
    content.replaceChildren();
    const lead = documentRef.createElement('p');
    lead.textContent = `현재 ${data.progress.current}장 · 첫 시도 통과 ${data.summary.firstTryCount}회 · 재시도 통과 ${data.summary.retryCount}회`;
    content.append(lead);
    const sections = [
      ['결정 기록', data.decisions.map(({ action, chapter, evidenceId }) => `${chapter}장: ${action} · ${evidenceId}`), '기록된 결정이 없습니다.'],
      ['확보한 증거', data.evidence.map(({ chapter, evidenceId }) => `${chapter}장: ${evidenceId}`), '확보한 증거가 없습니다.'],
      ['관문 시도', data.gateAttempts.map(({ attempts, chapter, gateId, status }) => `${chapter}장 ${gateId}: ${STATUS_LABELS[status]} (${attempts}회)`), '관문 시도가 없습니다.'],
      ['결과 요약', [
        `기록 보존 ${data.outcomes.integrity.secured}건 / 손실 ${data.outcomes.integrity.lost}건`,
        `노출 통제 ${data.outcomes.exposure.contained}건 / 공개 ${data.outcomes.exposure.disclosed}건`
      ], '결과가 없습니다.']
    ];
    for (const [title, items, empty] of sections) {
      const section = documentRef.createElement('section');
      const heading = documentRef.createElement('h2');
      heading.textContent = title;
      section.append(heading);
      appendList(documentRef, section, items, empty);
      content.append(section);
    }
  }

  function open() {
    render();
    report.hidden = false;
    report.querySelector('[data-teacher-report-heading]')?.focus();
  }

  report.querySelector('[data-teacher-report-close]')?.addEventListener('click', () => {
    report.hidden = true;
  });
  report.querySelector('[data-teacher-report-print]')?.addEventListener('click', () => windowRef.print());
  report.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') report.hidden = true;
  });
  return Object.freeze({ open, render });
}
