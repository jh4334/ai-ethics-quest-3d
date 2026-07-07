import * as THREE from 'three';

// 「AI 윤리의 섬」 캐릭터 모델 — 원시 도형 조합으로 '실루엣만 봐도 누군지' 알게 만든다.
// 모든 빌더는 발이 y=0, 정면이 +z인 THREE.Group을 돌려준다.

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, ...opts });
}

function castAll(group) {
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return group;
}

// 플레이어 — 노란 우비를 입은 표류자 (원뿔 후드 + 백팩 실루엣)
export function createPlayerCharacter() {
  const g = new THREE.Group();
  const yellow = mat(0xffcf3f, { roughness: 0.5 });

  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.92, 14), yellow);
  cloak.position.y = 0.46;
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.42, 12), yellow);
  hood.position.y = 1.0;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat(0xffd9ad, { roughness: 0.75 }));
  face.position.set(0, 0.86, 0.12);
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.24), mat(0x9a6a3c));
  bag.position.set(0, 0.58, -0.3);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), mat(0x6d4a2a));
  strap.position.set(0, 0.66, 0);
  for (const side of [-0.15, 0.15]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.22), mat(0x5a7f8f));
    boot.position.set(side, 0.07, 0.04);
    g.add(boot);
  }
  g.add(cloak, hood, face, bag, strap);
  return castAll(g);
}

// 도트 — 겁 많은 픽셀 반딧불 (각진 빛의 별). 발광이라 블룸에 반짝인다.
export function createCompanion() {
  const g = new THREE.Group();
  const glow = new THREE.MeshStandardMaterial({
    color: 0xfff4c0,
    emissive: 0xffdf6a,
    emissiveIntensity: 1.6,
    roughness: 0.3
  });
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), glow);
  g.add(core);
  // 십자 별을 이루는 작은 픽셀 팔
  for (const [x, y] of [[0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), glow);
    arm.position.set(x, y, 0);
    g.add(arm);
  }
  const light = new THREE.PointLight(0xffe08a, 0.5, 3.2);
  g.add(light);
  g.userData.eyes = core;
  return g;
}

// 담 — 등껍질이 금고인 비밀지기 거북
function createTurtle(color) {
  const g = new THREE.Group();
  const shellColor = 0x4f7d52;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.56, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat(shellColor));
  shell.position.y = 0.42;
  shell.scale.set(1, 0.72, 1);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.07, 10, 24), mat(0x3c5f40));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.42;
  // 금고 다이얼
  const dialRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 8, 20), mat(0xb9c0c7, { metalness: 0.6, roughness: 0.35 }));
  dialRing.position.set(0, 0.6, 0.34);
  const dialKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12), mat(0xdfe4e8, { metalness: 0.7, roughness: 0.3 }));
  dialKnob.rotation.x = Math.PI / 2;
  dialKnob.position.set(0, 0.6, 0.36);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), mat(0x86b06a));
  head.position.set(0, 0.4, 0.52);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), mat(0x9cc47e));
  snout.position.set(0, 0.36, 0.66);
  for (const [x, z] of [[-0.32, 0.28], [0.32, 0.28], [-0.32, -0.28], [0.32, -0.28]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 8), mat(0x86b06a));
    leg.position.set(x, 0.11, z);
    g.add(leg);
  }
  // 지팡이
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8), mat(0x8a5a33));
  staff.position.set(0.5, 0.45, 0.1);
  staff.rotation.z = 0.12;
  g.add(shell, rim, dialRing, dialKnob, head, snout, staff);
  return castAll(g);
}

// 모리 — 한쪽만 보는 외알안경 부엉이 사서
function createOwl() {
  const g = new THREE.Group();
  const feather = mat(0x8a6a45);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), feather);
  body.position.y = 0.5;
  body.scale.set(1, 1.15, 0.9);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), feather);
  head.position.y = 0.95;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), mat(0xe4d3ad));
  belly.position.set(0, 0.46, 0.2);
  belly.scale.set(1, 1.1, 0.5);
  for (const side of [-1, 1]) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 8), feather);
    tuft.position.set(side * 0.16, 1.2, 0);
    tuft.rotation.z = side * -0.3;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), mat(0xfbf7ea, { roughness: 0.4 }));
    eye.position.set(side * 0.12, 0.98, 0.25);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), mat(0x20160c));
    pupil.position.set(side * 0.12, 0.98, 0.32);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.24), feather);
    wing.position.set(side * 0.36, 0.5, 0);
    wing.rotation.z = side * 0.18;
    g.add(tuft, eye, pupil, wing);
  }
  // 왼눈의 큰 외알안경 (금테)
  const monocle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 10, 20), mat(0xeba52c, { metalness: 0.6, roughness: 0.3 }));
  monocle.position.set(-0.12, 0.98, 0.3);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 8), mat(0xe0a030));
  beak.position.set(0, 0.88, 0.32);
  beak.rotation.x = Math.PI / 2;
  // 겨드랑이에 낀 책
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.09), mat(0xb2472f));
  book.position.set(0.42, 0.44, 0.06);
  book.rotation.z = 0.2;
  g.add(body, head, belly, monocle, beak, book);
  return castAll(g);
}

// 무로 — 앞발이 끌인 조각가 두더지
function createMole() {
  const g = new THREE.Group();
  const fur = mat(0x6b5545);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), fur);
  body.position.y = 0.42;
  body.scale.set(1.15, 0.95, 1);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), fur);
  head.position.set(0, 0.72, 0.1);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 10), mat(0xd98c8c));
  snout.position.set(0, 0.68, 0.36);
  snout.rotation.x = Math.PI / 2;
  // 둥근 선글라스
  const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.05), mat(0x14110d, { roughness: 0.25 }));
  glasses.position.set(0, 0.76, 0.24);
  for (const side of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 14), mat(0x1c1712, { roughness: 0.2 }));
    lens.rotation.x = Math.PI / 2;
    lens.position.set(side * 0.1, 0.76, 0.26);
    // 커다란 쐐기 앞발(끌)
    const paw = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.32), mat(0xcfc3a6));
    paw.position.set(side * 0.28, 0.3, 0.24);
    paw.rotation.y = side * -0.2;
    g.add(lens, paw);
  }
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), fur);
  foot.position.y = 0.06;
  g.add(body, head, snout, glasses, foot);
  return castAll(g);
}

// 에코 — 꼬리가 아홉인 메아리 여우 (부챗살 꼬리 실루엣)
function createFox() {
  const g = new THREE.Group();
  const orange = mat(0xe8894a);
  const cream = mat(0xf6e6cf);
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 14), orange);
  body.position.y = 0.4;
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), cream);
  chest.position.set(0, 0.4, 0.18);
  chest.scale.set(1, 1.3, 0.5);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), orange);
  head.position.set(0, 0.82, 0.06);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 10), cream);
  snout.position.set(0, 0.78, 0.28);
  snout.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), mat(0x2a1c12));
  nose.position.set(0, 0.78, 0.4);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 8), orange);
    ear.position.set(side * 0.11, 1.02, 0.04);
    const earIn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 8), cream);
    earIn.position.set(side * 0.11, 1.0, 0.08);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), mat(0x2a1c12));
    eye.position.set(side * 0.09, 0.86, 0.24);
    g.add(ear, earIn, eye);
  }
  // 아홉 개의 꼬리 (부챗살)
  for (let i = 0; i < 9; i += 1) {
    const t = (i / 8 - 0.5) * 1.5; // -0.75..0.75 rad 부채꼴
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.6, 8), orange);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.2, 8), cream);
    const px = Math.sin(t) * 0.5;
    const py = 0.62 + Math.cos(t) * 0.16;
    tail.position.set(px, py, -0.34);
    tail.rotation.set(-0.9, 0, -t);
    tip.position.set(px * 1.32, py + 0.24, -0.5);
    tip.rotation.set(-0.9, 0, -t);
    g.add(tail, tip);
  }
  g.add(body, chest, head, snout, nose);
  return castAll(g);
}

const NPC_BUILDERS = {
  privacy: createTurtle,
  bias: createOwl,
  copyright: createMole,
  deepfake: createFox
};

export function createNpcCharacter(topicId) {
  const builder = NPC_BUILDERS[topicId] ?? createTurtle;
  return builder();
}

// 노이즈 — 잘못 배운 아기 AI. 커다란 지지직 정전기 뭉치(회색+보라 글리치), 노란 눈 두 개만 껌뻑.
// 무섭기보다 '고장난' 느낌. 최종장에서 도구를 쓸 때마다 작아지고, 마지막엔 노바로 바뀐다.
export function createNoiseBoss() {
  const g = new THREE.Group();

  // 울퉁불퉁한 안개 몸통(저폴리 + 플랫셰이딩으로 지지직 실루엣).
  const body = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0x6b6478, emissive: 0x3a2d55, emissiveIntensity: 0.5, roughness: 0.9, flatShading: true })
  );
  g.add(body);

  // 몸을 둘러싸고 지지직 도는 글리치 픽셀들(회색·보라).
  const pixels = new THREE.Group();
  const pixelMat = [
    new THREE.MeshStandardMaterial({ color: 0x9a90b4, emissive: 0x5a4d7a, emissiveIntensity: 0.7, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x7a72a0, emissive: 0x7a3dcf, emissiveIntensity: 0.6, roughness: 0.8 })
  ];
  const pixelList = [];
  for (let i = 0; i < 14; i += 1) {
    const s = 0.14 + (i % 3) * 0.06;
    const cube = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), pixelMat[i % 2]);
    const a = (i / 14) * Math.PI * 2;
    const r = 1.15 + (i % 4) * 0.12;
    cube.position.set(Math.cos(a) * r, Math.sin(a * 1.3) * 0.8, Math.sin(a) * r);
    cube.userData.seed = i;
    pixels.add(cube);
    pixelList.push(cube);
  }
  g.add(pixels);

  // 노란 눈 두 개.
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xffca1a, emissiveIntensity: 1.8, roughness: 0.3 });
  const eyes = [];
  for (const x of [-0.32, 0.32]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), eyeMat);
    eye.position.set(x, 0.15, 0.86);
    g.add(eye);
    eyes.push(eye);
  }

  const light = new THREE.PointLight(0x9a6dff, 0.9, 8);
  light.position.set(0, 0.6, 0);
  g.add(light);

  g.userData = { body, pixels: pixelList, eyes, light, kind: 'noise' };
  return g;
}

// 노바 — 네 개의 약속을 소화하고 다시 태어난 작고 둥근 별빛 AI.
export function createNova() {
  const g = new THREE.Group();
  const starMat = new THREE.MeshStandardMaterial({ color: 0xeafcff, emissive: 0x7cf0ff, emissiveIntensity: 1.8, roughness: 0.25 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 1), starMat);
  g.add(core);
  // 반짝이는 십자 빛살.
  for (const [x, y] of [[0.42, 0], [-0.42, 0], [0, 0.42], [0, -0.42]]) {
    const ray = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), starMat);
    ray.position.set(x, y, 0);
    g.add(ray);
  }
  const light = new THREE.PointLight(0x7cf0ff, 1.4, 7);
  g.add(light);
  g.userData = { core, light, kind: 'nova' };
  return g;
}
