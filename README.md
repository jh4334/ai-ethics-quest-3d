# H-17: NULL — 삭제된 밤

학교 축제가 끝난 00시 17분, 출석부·사진·기억에서 사라진 하루의 결정 경로를 추적하는 Three.js 3D 액션 스릴러입니다. 정답 퀴즈 대신 이동·전투·TRACE·증거 보존 행동이 다음 장과 결말을 바꿉니다.

## 5장 캠페인

1. `00:17 — 출석번호 없음`: 사라지는 학교에서 기억 백업을 지우거나 추적해 보존한다.
2. `웃는 얼굴의 폭동`: Copycat 군집을 막으며 최초 업로드 경로를 찾는다.
3. `두 개의 학교`: 편안한 현실과 검증 가능한 현실을 전환해 Recommender를 무너뜨린다.
4. `3초 승인실`: 삭제 파이프라인을 역주행하고 긴급 지원 기록의 운명을 정한다.
5. `마지막 방송`: LUMEN·DOT 보호 프로토콜을 모든 동사로 돌파하고 행동 이력에 맞는 결말을 감당한다.

결말은 `개인정보를 가린 검증 방송`, `원본 공개`, `사건 봉인` 세 상태이며 도덕 점수나 정답 낙인을 붙이지 않습니다.

## 실행

```bash
npm install --cache ./.npm-cache
npm test
npm run dev
```

배포 전 최소 검증:

```bash
npm run build
npm run smoke
npm run e2e
```

- 운영 진입점: `/index.html` → `/reboot.html`
- 한 릴리스 동안 보존하는 이전 캠페인: `/legacy.html`
- 키보드: WASD/방향키 이동, J SIGNAL BLADE, K REFLECT, E TRACE, Space DASH, F SECURE, Q PURGE
- 터치: 왼쪽 이동 스틱, 오른쪽 동사 버튼

## 안전·오프라인·출처

- 계정·백엔드·분석·결제 없음
- 이름·소속·연락처 등 개인정보 입력 없음
- 진행은 브라우저 `localStorage`에만 저장
- 첫 온라인 로드 뒤 서비스워커로 오프라인 재실행 가능
- 외부 캐릭터와 애니메이션은 CC0 자산만 사용하며 [ASSET_LICENSES.md](ASSET_LICENSES.md)에 기록

정본 서사는 [스토리 바이블](docs/reboot/story-bible.md), 구현·롤백 절차는 [릴리스 안내](docs/reboot/release.md)를 참고하세요.
