# H-17: NULL 6장 캠페인 최종 검증 보고서

## 결과와 전달 상태

- 기준: `origin/main`의 `c7e37d87a960a79d150f94e6720fc8a8d483cfda`에서 분기한 `codex/h17-six-chapter-campus-overhaul`.
- Draft PR: <https://github.com/jh4334/ai-ethics-quest-3d/pull/112>. `main`에는 병합하지 않았다.
- 기존 SIGNAL BLADE, DASH, REFLECT, TRACE, SECURE/PURGE, 저장, 모바일 입력, 세 결말, `/legacy.html` 롤백을 유지했다.
- 타이틀, 새 게임/이어하기, 1~6장 지도, 설정, 조작 안내, 개인정보 입력 없는 교사용 조사 보고서·인쇄 CSS, WebGL 실패 안내를 제공한다.

## 변경된 1~6장 구조

1. `00:17 — 출석번호 없음`: 부유 캠퍼스, 열린 교실, 명단탑, 운동장·체육관, 기록 단말, 삭제 행정 타워.
2. `웃는 얼굴의 폭동`: 미디어 광장, 편집 구역, 업로드 추적실, Copycat 확산전.
3. `두 개의 학교`: 누락된 따뜻한 학교와 검증 가능한 차가운 학교의 서로 다른 동선·랜드마크·위험.
4. `3초 승인실`: 자동 결재 컨베이어, 점수 산정실, 긴급 지원 기록 보관실, 승인 역추적.
5. `증언 보관소`: 하루와 재회하고 출처·동의·개인정보 표식을 검증해 방송 패키지를 구성.
6. `마지막 방송`: 방송국 진입, 보호 프로토콜, 중계 릴레이, 코어 보스전과 세 결말.

2~6장은 각각 최소 네 개의 저작 공간과 고유 랜드마크·조사·전투 또는 퍼즐·체크포인트를 갖는다. 기존 5장을 이름만 바꾼 것이 아니라 증언 검증과 방송 피날레를 별도 장으로 분리했다.

## P0 시각 증빙

- 최신 P0 캡처: `p0/chapter-1-classroom-desktop-1440x900.png`, `p0/chapter-1-classroom-tablet-768x1024.png`, `p0/chapter-1-classroom-mobile-390x844.png`, `p0/chapter-1-desktop-1440x900.png`, `p0/chapter-1-mobile-390x844.png`.
- 동일 크기 비교: `p0/reference-vs-actual-chapter1-2880x900.png`. 저장소 기준 이미지 `docs/design/concepts/gameplay-screen-v3.webp`와 최신 1장 화면을 각각 1440×900으로 배치했다.

![레퍼런스와 최신 1장 동일 크기 비교](./p0/reference-vs-actual-chapter1-2880x900.png)

![최신 모바일 1장 화면](./p0/chapter-1-classroom-mobile-390x844.png)

- 자동 동일 크기 픽셀 비교는 유사도 0/100이다. 구도·아트 디렉션이 다른 상태라는 경고값이며 레퍼런스 충실도 승인으로 해석하지 않는다.
- 1장 첫 화면은 레퍼런스의 시선 축을 따라 161개 높이차 판석, 60개 절벽 암석, 14개 텍스처 판석 LOD, 황금 기억 발자국과 목표 광선, 구멍 표식 공중 기록 조각 11개, 좌우 CC0 GLB 식생·암석 프레임, 후방 열린 교실로 재구성했다. 플레이어·중앙 길·운동장·명단탑을 한 축에 맞추고 전경 에셋을 실제 사람 기준 0.4~1.5m로 정규화했다. 충돌·저장·전투 동선은 바꾸지 않았으며 레퍼런스 이미지를 2D 배경으로 사용하지 않았다.
- Quaternius Stylized Nature MegaKit의 관목·고사리·긴 풀·암석·석로를 추가했다. 관목은 원본 알파 텍스처를 유지한 6-triangle cross-card LOD, 석로는 원본 텍스처를 유지한 12-triangle 불규칙 판석 LOD로 재구성했고, 중복 절차식 전경 잎·기억 halo·원거리 나무 줄기를 제거해 시각 레이어를 4 draw calls로 줄였다.
- 최신 P0 5/5 캡처는 Chromium SwiftShader WebGL에서 생성했으며 환경·캐릭터 ready, 콘솔 오류와 4xx/5xx 실패 응답은 각각 0건이다. 최대 199 draw calls·147,234 triangles·4 lights다. 같은 최신 빌드의 headful Intel Iris Xe D3D11 P0 측정은 dataset p95 16.7ms, 직접 rAF p95 8.5ms, 오류 0건이다.
- 전 장 최신 캡처는 `chapters/chapter-1-desktop-1440x900.png`부터 `chapter-6-mobile-390x844.png`까지 12개이며 `chapters/capture-report.json`에 측정값이 있다.
- 전 장 12/12 캡처는 재현 가능한 SwiftShader WebGL로 생성했고 콘솔 오류 0건, 4xx/5xx 실패 응답 0건, 모바일 6/6 터치 UI 표시를 확인했다. SwiftShader 직접 rAF p95 최대 866.6ms는 GPU 성능값으로 해석하지 않고 위 Intel 하드웨어 P0 측정과 분리한다.

## 플레이스루와 접근성

- 키보드: 현재 바이너리에서 1~6장 각각 실제 이동·전투·입력·저장 후 재접속·다음 장 전환 통과. 합계 자동 검증 시간 359.0초.
- 터치: 같은 범위를 390×844에서 통과. 합계 자동 검증 시간 235.2초, 터치 스틱 연결, 모든 주요 버튼 최소 44px.
- 장별 자동 검증 시간(키보드/터치): 1장 103.1/63.1초, 2장 51.3/33.5초, 3장 46.8/32.7초, 4장 57.8/37.5초, 5장 62.5/44.7초, 6장 37.5/23.7초.
- 이는 테스트 훅과 자동 입력을 사용하는 QA 실행 시간이지 사람의 플레이 시간은 아니다. 사람 기준 25~35분 같은 값을 임의로 주장하지 않는다.
- 교사용 보고서는 이름·학교·이메일 등 개인정보 입력 없이 장별 결정·증거·행동 비용을 인쇄한다. 선악 점수는 없다.

## 테스트·빌드·호환성

- `npm test`: 511/511 통과.
- `npm run test:h17`: 311/311 통과.
- `npm run test:legacy`: 200/200 통과.
- Playwright E2E: 리부트 3/3, 슬라이스 2/2, 캠페인 7/7, 폴리시 11/11, 합계 23/23 통과. 리부트 오프라인 시나리오는 CDP로 HTTP 캐시를 비활성화·삭제하고 브라우저 네트워크까지 차단한 뒤 환경·캐릭터·저장 체크포인트·보스 승리·요청 실패 0을 실제 reload로 검증한다. 서비스워커 등록과 CacheStorage를 지운 음성 대조군은 `net::ERR_INTERNET_DISCONNECTED`, 복원한 동일 시나리오는 3/3 통과했다.
- GitHub Actions는 23개를 한 무제한 단계에서 돌리지 않고 캠페인·시각/접근성·저장/오프라인·결말 파일로 나눴다. 각 단계는 30분, 전체 빌드 작업은 120분으로 제한하며 첫 확정 실패에서 중단한다.
- 최신 구현 SHA `6d79bdf982c0`의 [GitHub Actions 실행 31345712772](https://github.com/jh4334/ai-ethics-quest-3d/actions/runs/31345712772)은 단위·빌드·스모크·슬라이스·캠페인·시각/접근성·저장/오프라인·결말 전 단계를 통과했다.
- `npm run build`: 통과, 176개 모듈. 리부트 청크 344.70kB(gzip 114.98kB), Three.js 681.29kB(gzip 173.48kB).
- `npm run smoke`, `npm run slice:gate`: 통과. H-17 기본 진입점과 legacy 롤백 경로를 확인했다.
- 현재 dist 프로덕션 검증: v5 저장 키, v12 설치 캐시, 별도 `ethics-quest-h17-environment` runtime cache, 오프라인 재접속 뒤 `chapter-3:start` 복원 통과. 환경 로더는 서비스워커 제어 전에도 성공한 현재 장 에셋을 runtime cache에 직접 저장한다. 워커는 환경 요청을 같은 tier로 라우팅하고 activate 때 해당 tier를 보존하면서 매니페스트 밖의 항목은 정리한다. CI의 페이지 CacheStorage 목록 API가 정지하는 환경 차이는 내부 목록 assertion을 제거하고 더 강한 HTTP 캐시 제거·브라우저 오프라인 reload 검증으로 대체했으며 Linux CI 리부트 3/3이 통과했다.
- v4 저장을 v5 6장 구조로 마이그레이션하고 원본 v4 바이트를 보존한다. 기존 5장 완료 상태, 손상·미래 버전·중단 쓰기 회복 테스트가 통과했다.
- 공개 GitHub Pages는 아직 구형 `main` 배포다. 이 브랜치를 병합·배포하지 않았으므로 공개 주소에는 6장 변경이 반영되지 않은 것이 정상이다.

## 에셋과 라이선스

- Quaternius Universal Base Characters, Modular Character Outfits, Universal Animation Library 1·2: CC0 1.0.
- Kenney Building Kit, Furniture Kit, Nature Kit: CC0 1.0.
- ambientCG Bricks001, Concrete004, WoodFloor041, Asphalt009 1K PBR: CC0 1.0.
- Poly Haven Rock 07(Jenelle van Heerden): CC0 1.0. 공식 1K glTF에서 512px 텍스처와 2,670 triangles로 재현 가능하게 경량화한 218,836바이트 GLB를 1장 첫 화면의 우측 전경 바위로 사용했다.
- Quaternius Stylized Nature MegaKit: CC0 1.0. Standard 무료판에서 5개 모델만 선별해 5개 GLB, 284,896바이트로 경량화했으며 원본 ZIP과 결과 파일 SHA-256을 기록했다.
- 프로젝트 전용 타이틀 이미지: OpenAI 이미지 생성 도구로 생성.
- 파일별 출처, 사용 위치, 다운로드 날짜, ZIP SHA-256, 수정 범위는 `ASSET_LICENSES.md`에 기록했다.

## 다운로드와 성능

- 초기 셸: 1,382,997바이트, 12파일(1.32MiB).
- 설치 프리캐시: 39,527,688바이트, 57파일(37.70MiB).
- 장 환경: 13,539,607바이트, 47파일(12.91MiB).
- 캐릭터: 35,799,811바이트, 43파일(34.14MiB). 애니메이션은 사용 클립만 남겨 15,709,880바이트에서 2,344,880바이트(2.24MiB)로 85.1% 줄였다.
- 전체 분류 자산: 53,067,295바이트, 104파일(50.61MiB).
- 최신 캡처의 장별 데스크톱 전송량: 1장 45.32MiB, 2장 24.91MiB, 3장 21.58MiB, 4장 35.30MiB, 5장 30.27MiB, 6장 34.78MiB. 로컬 서버의 장별 독립 진입 측정이므로 합산 다운로드로 해석하지 않는다.
- 최신 P0 5개 SwiftShader 화면 최대치: 199 draw calls, 147,234 triangles, 4 lights, 콘솔 오류·실패 응답 0건. 첫 조우 데스크톱은 172 calls·118,734 triangles, 모바일은 169 calls·116,382 triangles다. 같은 최신 빌드의 Intel Iris Xe D3D11 P0는 199 calls·147,234 triangles·4 lights, 직접 rAF p95 8.5ms다.

## 남은 위험과 솔직한 품질 평가

- 최신 1장은 실제 PBR 바인딩, 더 낮고 가까운 어깨너머 카메라, 좁아지는 암석 동선, 황금 광선, 기록 조각, 화면 안으로 투영한 전경 GLB 식생으로 기존의 넓은 청색 평면보다 레퍼런스의 구도와 목표 가독성에 가까워졌다. 그러나 반복되는 로우폴리 학교 외벽, 제한된 식생 종류, 단순한 산악 실루엣과 회화적 후처리 부족 때문에 픽셀 단위 자동 비교는 여전히 0/100이다. 현재 평가는 완주 가능한 스타일라이즈드 로우폴리 3D 게임이며 레퍼런스와 동일하거나 AAA 수준이라고 주장하지 않는다.
- 50.61MiB 전체 자산과 37.70MiB 설치 프리캐시는 학교망 첫 설치에 여전히 부담이다. 장 환경 지연 로딩과 저화질 프로필은 작동하며, 남은 캐릭터 본체·의상 GLB의 Meshopt/Draco 검토와 KTX2 텍스처화, 실제 저사양 기기·학교망 검증이 남았다.
- `npm audit`의 high 1건(`nanoid`)·moderate 1건(`postcss`)은 Vite 8.1.0의 개발 전용 전이 의존성으로, 최적화 전 커밋과 동일 버전이다. 런타임 번들 경로는 아니지만 도구 체인 갱신 때 해소해야 한다.
- 사람 기준 플레이 시간, 실제 학생용 모바일 기기, 실제 학교망 다운로드는 아직 측정하지 못했다.
- 사용자 제한인 최대 3개 서브에이전트를 앞선 라운드에서 모두 사용했다. 따라서 현재 SHA의 새 독립 리뷰를 실행하지 못했으며 자체 리뷰를 독립 승인으로 가장하지 않는다.
