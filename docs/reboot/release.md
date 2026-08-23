# H-17: NULL 운영·롤백 안내

## 운영 진입점

- 정식 주소: `/index.html` 또는 저장소 Pages 루트. 리디렉션 없이 6장 3D 팝업 동화를 직접 실행한다.
- 3D 동화 저장 키: `ethics-quest-storybook3d-v1`; 페이지·단서·선택만 저장하며 개인정보를 받지 않는다.
- 보존된 2D 직접 주소: `/illustrated.html`
- 보존된 전투형 3D 주소: `/reboot.html`, `/legacy.html`
- 2D 저장 키: `ethics-quest-illustrated-action-v3`; 기존 2D v2 저장은 장 진행도로 이관한다.
- 3D 저장 키 `h17.null.save.v4`와 백업 `h17.legacy.v3.backup`은 삭제하지 않는다.

## 배포 게이트

```bash
npm ci
npm test
npm run build
npm run smoke
npm run slice:gate
npm run e2e
```

GitHub Pages는 `main`의 위 게이트가 모두 성공한 동일 커밋만 배포한다. 배포 후에는 루트 로드, 3D 페이지 전환, 단서 두 개와 선택, 저장 후 계속, 가로·세로 화면, 축소 동작, 콘솔 오류, 프레임 예산과 오프라인 재실행을 별도로 확인한다.

## 안전한 한 명령 롤백

롤백 기준 태그는 `pre-reboot-fa1ac50`이며 대상 커밋은 `fa1ac503d7d21dce0ff7c43b1268fd1207f24f4c`이다. 아래 명령은 Git 기록이나 브라우저 저장을 삭제하지 않고 해당 태그의 검증·배포 워크플로를 다시 실행한다.

```bash
gh workflow run pages.yml --ref main -f deploy_ref=pre-reboot-fa1ac50
```

현재 `main`을 다시 배포하는 명령:

```bash
gh workflow run pages.yml --ref main
```

롤백 중에도 3D 동화 v1, 2D v3, 3D v4와 레거시 백업 키는 그대로 둔다. 저장소 키 삭제나 강제 리셋은 롤백 절차에 포함하지 않는다. `/illustrated.html`, `/reboot.html`, `/legacy.html`은 새 배포에서도 이전 런타임을 확인하는 보조 경로다.
