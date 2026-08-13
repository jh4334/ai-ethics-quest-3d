# 2D 레퍼런스 적용 디자인 QA

**비교 대상**

- source visual truth path: `docs/design/concepts/gameplay-screen-v3.webp`
- implementation screenshot path: `.omo/evidence/illustrated-2d/desktop-1440x900-start.png`
- side-by-side comparison: `.omo/evidence/illustrated-2d/reference-vs-implementation.png`
- responsive evidence: `.omo/evidence/illustrated-2d/mobile-390x844-start.png`, `.omo/evidence/illustrated-2d/tablet-768x1024-start.png`
- interaction evidence: 각 크기의 `*-recovery.png`, `*-complete.png`, `capture-report.json`
- viewport: 데스크톱 1440×900, 태블릿 768×1024, 모바일 390×844
- density normalization: CSS 픽셀과 캡처 픽셀 모두 deviceScaleFactor 1
- source pixels: 1672×941 WebP
- desktop comparison pixels: 1440×900, 원화 영역 1440×810
- state: 저장 데이터가 없는 최초 진입 `idle`

**Findings**

- P0/P1/P2 없음.
- 글꼴·타이포그래피: 최초 화면의 모든 글자는 원화에 포함된 동일 픽셀이다. 이야기 시작 뒤 표시되는 한국어 카드도 데스크톱·모바일 캡처에서 잘림이나 한 글자 고아 줄이 없다.
- 간격·레이아웃: 데스크톱은 원화 전체를 1440×810으로 중앙 정렬한다. 모바일과 태블릿도 `contain`을 사용해 화면 일부를 자르지 않는다.
- 색상: 원화 영역은 브라우저 정규화 비교에서 1,166,400픽셀 중 차이 0, 유사도 100/100이다. 남는 영역은 디자인 계약의 짙은 남색으로만 채운다.
- 이미지 품질: 제공된 1672×941 WebP를 직접 사용하며 재생성, 근사 도형, 2D를 3D로 위장하는 처리가 없다.
- 문구·내용: 원화의 임무·진행도·상태 문구는 바꾸지 않았다. 추가 대사는 하루·도트 중심의 기존 줄거리를 짧고 쉬운 문장으로 이어 간다.
- 상호작용: 클릭/E/터치 행동, 도움말, 잘못 공유한 뒤 재선택, 보호 선택 완료를 실제 Chromium에서 모두 실행했다. 세 화면 모두 최종 `complete`, 콘솔 오류 0, 실패 응답 0이다.
- 접근성: 데스크톱 원화 핫스폿은 245×105px, 모바일·태블릿 행동 버튼은 76×58px, 도움 버튼은 76×52px이다.

**Focused Region Comparison**

- 원화가 단일 통합 일러스트이고 최초 화면의 추가 가시 레이어가 없으므로 별도 부분 확대보다 전체 원화 영역 픽셀 비교가 더 엄격하다.
- `.omo/evidence/illustrated-2d/reference-art-region.png`와 `.omo/evidence/illustrated-2d/implementation-art-region.png` 비교 결과: diffRatio 0, similarityScore 100, hotspot 0.

**Comparison History**

1. 첫 캡처: 테스트 서버가 CSS를 `application/octet-stream`으로 보내 기본 여백과 세로 크롭이 발생했다.
2. 수정: 테스트 서버에 `text/css; charset=utf-8` MIME을 추가하고 장면을 `contain` 중심 레이아웃으로 고쳤다.
3. 두 번째 캡처: 데스크톱·태블릿·모바일 모두 원화 전체 표시, 버튼 최소 크기, 두 선택 흐름, 콘솔 오류 0을 확인했다.
4. 최종 비교: 동일 Chromium 정규화 원화 영역과 최초 화면이 픽셀 단위로 완전히 일치했다.

**Open Questions**

- 없음.

**Implementation Checklist**

- [x] 원화를 자르지 않고 표시
- [x] 시작 화면에 새 가시 패널을 덧씌우지 않음
- [x] 기존 하루 이야기와 두 선택 흐름 연결
- [x] 데스크톱 E/클릭과 모바일 행동 버튼 검증
- [x] 기존 3D 버전 링크 보존
- [x] 콘솔 오류·누락 응답 확인

**Follow-up Polish**

- P3: 세로 모바일에서는 가로 원화를 온전히 보존하므로 원화가 작게 보인다. 사용자가 전체 구도 보존보다 확대를 원할 때만 별도 세로 원화를 제작한다.

final result: passed
