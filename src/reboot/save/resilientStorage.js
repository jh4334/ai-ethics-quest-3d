// 저장소 강등 어댑터 — localStorage가 막힌 환경(사생활 모드·쿼터 초과·접근 차단)에서
// 게임을 죽이는 대신 세션 메모리로 계속한다. 쓰기가 한 번이라도 실패하면 이후 쓰기는
// 전부 메모리로 가고(반복 예외 방지), 메모리에 있는 키는 실제 값보다 우선한다(그림자 읽기).
// 읽기는 계속 실저장소를 시도한다 — 쿼터 초과 환경에서도 읽기는 대개 살아 있다.
// 결과: 진행은 이 세션 동안 유지되고, 브라우저를 닫으면 사라진다 — 크래시보다 낫다.

export function createResilientStorage(storage) {
  const memory = new Map();
  let degraded = !storage;

  function readRaw(key) {
    if (!storage) return null;
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }

  return Object.freeze({
    getItem(key) {
      if (memory.has(key)) return memory.get(key);
      return readRaw(key);
    },
    isDegraded: () => degraded,
    removeItem(key) {
      memory.delete(key);
      if (degraded) return;
      try {
        storage.removeItem(key);
      } catch {
        degraded = true;
      }
    },
    setItem(key, value) {
      if (!degraded) {
        try {
          storage.setItem(key, value);
          // 실저장 성공 — 그림자를 지워 실제 값이 진실이 되게 한다.
          memory.delete(key);
          return;
        } catch {
          degraded = true;
        }
      }
      memory.set(key, value);
    }
  });
}

// window.localStorage는 접근 자체가 throw할 수 있다(쿠키 차단 환경) — 진입부 전용 안전 획득.
export function safeLocalStorage(windowRef) {
  try {
    const storage = windowRef.localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}
