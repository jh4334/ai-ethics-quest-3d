# Asset licenses and provenance

런타임에 포함되는 비코드 에셋의 출처를 기록한다. 구매 에셋은 사용자 승인 없이 추가하지 않는다.

| 파일 | 용도 | 출처 | 권리/조건 |
|---|---|---|---|
| `public/assets/campaign-key-art.webp` | 타이틀 화면 배경 | 이 프로젝트를 위해 OpenAI 이미지 생성 도구로 생성, 2026-07-24 | 사용자 제공 프롬프트를 바탕으로 생성된 프로젝트 전용 산출물. 제3자 로고·캐릭터 없음 |
| `public/assets/reboot/characters/base/*` | 리부트 캐릭터 얼굴·몸체 | Quaternius, [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html), Standard 무료판, 2026-07-28 내려받음 | CC0 1.0. 필요한 glTF·BIN·텍스처만 선별하고 텍스처를 최대 1024px로 축소 |
| `public/assets/reboot/characters/base/Hair_Buns.{gltf,bin}`, `Hair_Long.{gltf,bin}`, `Hair_SimpleParted.{gltf,bin}` | 기록자·하루·윤서의 얼굴 식별용 head-bone rigged 헤어 | Quaternius, [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html), 로컬 Standard ZIP의 `Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)`에서 2026-07-29 선별 추출 | CC0 1.0. 세 헤어의 glTF·BIN만 추가하며 기존 최적화된 `T_Hair_1_*`·`T_Hair_2_*` 텍스처를 재사용 |
| `public/assets/reboot/characters/outfits/*` | 리부트 캐릭터 의상 | Quaternius, [Modular Character Outfits - Fantasy](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html), Standard 무료판, 2026-07-28 내려받음 | CC0 1.0. 필요한 완성 의상 4종만 선별하고 텍스처를 최대 1024px로 축소·런타임 색상 조정 |
| `public/assets/reboot/characters/animations/ual1-standard.glb` | 대기·이동·상호작용·피격 애니메이션 | Quaternius, [Universal Animation Library](https://quaternius.itch.io/universal-animation-library), Standard 무료판, 2026-07-28 내려받음 | CC0 1.0. 루트 모션 없는 GLB를 파일명만 단순화 |
| `public/assets/reboot/characters/animations/ual2-standard.glb` | 적·보스 전용 이동·공격 애니메이션 | Quaternius, [Universal Animation Library 2](https://quaternius.itch.io/universal-animation-library-2), Standard 무료판, 2026-07-28 내려받음 | CC0 1.0. 루트 모션 없는 GLB를 파일명만 단순화 |
| `public/assets/reboot/environment/building/*` | 리부트 1~6장 캠퍼스·미디어 구역·이중 학교·승인실·보관소·방송국의 바닥·벽·출입구·창·기둥·계단 | Kenney, [Kenney Building Kit](https://kenney.nl/assets/building-kit), [공식 ZIP](https://kenney.nl/media/pages/assets/building-kit/0de7aaa492-1743244741/kenney_building-kit.zip), 2026-08-08 내려받음 | CC0 1.0. ZIP SHA-256 `2740EF5772FB5FB3D7AAB881DB22D129F6B68AFE711B1A79E6D5E9E19CF3EEC6`. 원본 GLB 6개를 선별 복사했으며 파일명·바이너리는 변경하지 않음 |
| `public/assets/reboot/environment/furniture/*` | 리부트 각 장의 교실·편집실·기록실·보관소·방송국 책상·의자·화면·책장·책 | Kenney, [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit), [공식 ZIP](https://kenney.nl/media/pages/assets/furniture-kit/440e0608a4-1677580847/kenney_furniture-kit.zip), 2026-08-08 내려받음 | CC0 1.0. ZIP SHA-256 `E67652D0932CEE41683F74711C03D3E192A2AF9979EF8E6B237711F5482D46B0`. 원본 GLB 5개를 선별 복사했으며 파일명·바이너리는 변경하지 않음 |
| `public/assets/reboot/environment/nature/*` | 리부트 캠퍼스와 장별 외부 동선의 나무·관목·바위 | Kenney, [Kenney Nature Kit](https://kenney.nl/assets/nature-kit), [공식 ZIP](https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip), 2026-08-08 내려받음 | CC0 1.0. ZIP SHA-256 `FA7974A0D342BFE63C38664BA9F8EC1A4AAB8EA25F099BDC56870E33588C4D9D`. 원본 GLB 3개를 선별 복사했으며 파일명·바이너리는 변경하지 않음 |
| `public/assets/reboot/environment/materials/bricks/*` | 벽돌 외벽 PBR 재질 | ambientCG, [ambientCG Bricks 001](https://ambientcg.com/view?id=Bricks001), [공식 1K JPG ZIP](https://ambientcg.com/get?file=Bricks001_1K-JPG.zip), 2026-08-08 내려받음 | CC0 1.0. ZIP SHA-256 `D4E4109F305B7D1094E1C18B2F7F6A3468C62477DE915FF66975FD0155B6873C`. 원본 1K Color·NormalGL·Roughness JPG만 선별 복사했으며 파일명·바이너리는 변경하지 않음 |
| `public/assets/reboot/environment/materials/concrete/*` | 콘크리트 구조물 PBR 재질 | ambientCG, [ambientCG Concrete 004](https://ambientcg.com/view?id=Concrete004), [공식 1K JPG ZIP](https://ambientcg.com/get?file=Concrete004_1K-JPG.zip), 2026-08-08 내려받음 | CC0 1.0. ZIP SHA-256 `371D2350CD619853C5A6B6B358B67A2AA633E770BDC1180E8E821BD9BAF8E566`. 원본 1K Color·NormalGL·Roughness JPG만 선별 복사했으며 파일명·바이너리는 변경하지 않음 |
| `public/assets/reboot/environment/materials/wood/*` | 실내 목재 바닥 PBR 재질 | ambientCG, [ambientCG Wood Floor 041](https://ambientcg.com/view?id=WoodFloor041), [공식 1K JPG ZIP](https://ambientcg.com/get?file=WoodFloor041_1K-JPG.zip), 2026-08-08 내려받음 | CC0 1.0. ZIP SHA-256 `E7364EF32A8DB269B2475E76A7E1832ECA82BDF6574191CD96B1CDB2B362CDC6`. 원본 1K Color·NormalGL·Roughness JPG만 선별 복사했으며 파일명·바이너리는 변경하지 않음 |
| `public/assets/reboot/environment/materials/asphalt/*` | 캠퍼스 도로 PBR 재질 | ambientCG, [ambientCG Asphalt 009](https://ambientcg.com/view?id=Asphalt009), [공식 1K JPG ZIP](https://ambientcg.com/get?file=Asphalt009_1K-JPG.zip), 2026-08-08 내려받음 | CC0 1.0. ZIP SHA-256 `3282415AFAD2C74A4665FF191481545138C33C963B4EE0D7E7D292B66B1B4C7E`. 원본 1K Color·NormalGL·Roughness JPG만 선별 복사했으며 파일명·바이너리는 변경하지 않음 |

## 디자인 참고 전용

아래 파일은 런타임에 로드하지 않으며 구현 기준으로만 보관한다.

- `docs/design/concepts/gameplay-screen-v3.webp`
- `docs/design/concepts/art-direction-v3.webp`

두 파일 모두 이 프로젝트를 위해 OpenAI 이미지 생성 도구로 생성했으며 제3자 로고·캐릭터를 포함하지 않는다.

## 3D 에셋 정책

기존 캠페인의 3D 캐릭터·환경·퍼즐 소품은 프로젝트 코드에서 직접 생성한다. 리부트 캠페인의 캐릭터는 위 CC0 모델과 애니메이션을 사용하고,
환경·퍼즐 소품은 코드 생성과 위 Kenney CC0 GLB·ambientCG CC0 PBR 재질을 함께 사용한다. 외부 캐릭터는 남색 달빛 장면에 맞춘 역할별 색상과 체격만 런타임에서 조정한다.
향후 외부 모델을 추가할 때는 실제 파일을 넣기 전 공식 배포 페이지에서 라이선스를 재확인하고,
파일별 출처·라이선스·수정 여부를 위 표에 기록한다.
