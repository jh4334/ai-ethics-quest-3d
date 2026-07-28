# Asset licenses and provenance

런타임에 포함되는 비코드 에셋의 출처를 기록한다. 구매 에셋은 사용자 승인 없이 추가하지 않는다.

| 파일 | 용도 | 출처 | 권리/조건 |
|---|---|---|---|
| `public/assets/campaign-key-art.webp` | 타이틀 화면 배경 | 이 프로젝트를 위해 OpenAI 이미지 생성 도구로 생성, 2026-07-24 | 사용자 제공 프롬프트를 바탕으로 생성된 프로젝트 전용 산출물. 제3자 로고·캐릭터 없음 |
| `public/assets/reboot/characters/base/*` | 리부트 캐릭터 얼굴·몸체 | Quaternius, [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html), Standard 무료판, 2026-07-28 내려받음 | CC0 1.0. 필요한 glTF·BIN·텍스처만 선별하고 텍스처를 최대 1024px로 축소 |
| `public/assets/reboot/characters/outfits/*` | 리부트 캐릭터 의상 | Quaternius, [Modular Character Outfits - Fantasy](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html), Standard 무료판, 2026-07-28 내려받음 | CC0 1.0. 필요한 완성 의상 4종만 선별하고 텍스처를 최대 1024px로 축소·런타임 색상 조정 |
| `public/assets/reboot/characters/animations/ual1-standard.glb` | 대기·이동·상호작용·피격 애니메이션 | Quaternius, [Universal Animation Library](https://quaternius.itch.io/universal-animation-library), Standard 무료판, 2026-07-28 내려받음 | CC0 1.0. 루트 모션 없는 GLB를 파일명만 단순화 |
| `public/assets/reboot/characters/animations/ual2-standard.glb` | 적·보스 전용 이동·공격 애니메이션 | Quaternius, [Universal Animation Library 2](https://quaternius.itch.io/universal-animation-library-2), Standard 무료판, 2026-07-28 내려받음 | CC0 1.0. 루트 모션 없는 GLB를 파일명만 단순화 |

## 디자인 참고 전용

아래 파일은 런타임에 로드하지 않으며 구현 기준으로만 보관한다.

- `docs/design/concepts/gameplay-screen-v3.webp`
- `docs/design/concepts/art-direction-v3.webp`

두 파일 모두 이 프로젝트를 위해 OpenAI 이미지 생성 도구로 생성했으며 제3자 로고·캐릭터를 포함하지 않는다.

## 3D 에셋 정책

기존 캠페인의 3D 캐릭터·환경·퍼즐 소품은 프로젝트 코드에서 직접 생성한다. 리부트 캠페인의 캐릭터는 위 CC0 모델과 애니메이션을 사용하고,
환경·퍼즐 소품은 코드 생성 방식을 유지한다. 외부 캐릭터는 남색 달빛 장면에 맞춘 역할별 색상과 체격만 런타임에서 조정한다.
향후 외부 모델을 추가할 때는 실제 파일을 넣기 전 공식 배포 페이지에서 라이선스를 재확인하고,
파일별 출처·라이선스·수정 여부를 위 표에 기록한다.
