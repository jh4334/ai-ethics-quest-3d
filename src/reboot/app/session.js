import { createSaveRepository } from '../save/repository.js';

export function createRebootSession({ storage }) {
  const repository = createSaveRepository(storage);
  const boot = repository.boot();
  let state = boot.state;

  return Object.freeze({
    getLegacyBackup: () => repository.getLegacyBackup(),
    getRecoveryNotice: () => boot.recoveryNotice,
    getState: () => state,
    reset() {
      state = repository.reset();
      return state;
    },
    update(reducer) {
      if (typeof reducer !== 'function') throw new TypeError('진행 상태 변경 함수가 필요합니다.');
      const next = reducer(state);
      repository.write(next);
      state = next;
      return state;
    }
  });
}
