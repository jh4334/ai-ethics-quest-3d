# H-17: NULL 운영·롤백 안내

## 운영 진입점

- 정식 주소: `/index.html` 또는 저장소 Pages 루트. 쿼리와 해시를 보존해 `/reboot.html`로 이동한다.
- 직접 주소: `/reboot.html`
- 이전 6장 캠페인: `/legacy.html` — 이번 안정화 주기 동안만 보존한다.
- 저장 키: `h17.null.save.v4`; 이전 저장의 바이트 단위 백업은 `h17.legacy.v3.backup`이다.

## 배포 게이트

```bash
npm ci
npm test
npm run build
npm run smoke
npm run slice:gate
npm run e2e
```

GitHub Pages는 `main`의 위 게이트가 모두 성공한 동일 커밋만 배포한다. 배포 후에는 루트 로드, 첫 입력, 대표 전투, 저장 후 계속, 가로·세로 화면, 축소 동작, 콘솔 오류, 프레임 예산과 오프라인 재실행을 별도로 확인한다.

## 안전한 한 명령 롤백

롤백 기준 태그는 `pre-reboot-fa1ac50`이며 대상 커밋은 `fa1ac503d7d21dce0ff7c43b1268fd1207f24f4c`이다. 아래 명령은 Git 기록이나 브라우저 저장을 삭제하지 않고 해당 태그의 검증·배포 워크플로를 다시 실행한다.

```bash
gh workflow run pages.yml --ref pre-reboot-fa1ac50
```

현재 `main`을 다시 배포하는 명령:

```bash
gh workflow run pages.yml --ref main
```

롤백 중에도 v4와 레거시 백업 키는 그대로 둔다. 저장소 키 삭제나 강제 리셋은 롤백 절차에 포함하지 않는다. `/legacy.html`은 새 배포에서도 이전 런타임을 즉시 확인하는 보조 경로다.
