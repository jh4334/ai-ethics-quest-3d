import * as THREE from 'three';

function addMesh(parent, geometry, material, at = [0, 0, 0], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...at);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function makeMaterials(palette) {
  const toon = (color, emissive = 0x000000) => new THREE.MeshToonMaterial({ color, emissive, emissiveIntensity: 0.18 });
  return {
    accent: toon(palette.accent, palette.accent),
    dark: toon(0x20213b),
    ink: toon(0x2c2940),
    paper: toon(palette.paper),
    red: toon(0xb64955, 0x4b0b18),
    secondary: toon(palette.secondary),
    white: toon(0xf8f2df, 0xb9a978),
    wood: toon(0x74523d)
  };
}

function roundedPageGeometry(width, depth) {
  const shape = new THREE.Shape();
  const w = width / 2;
  const d = depth / 2;
  shape.moveTo(-w + 0.35, -d);
  shape.quadraticCurveTo(-w, -d, -w, -d + 0.35);
  shape.lineTo(-w, d - 0.35);
  shape.quadraticCurveTo(-w, d, -w + 0.35, d);
  shape.lineTo(w - 0.35, d);
  shape.quadraticCurveTo(w, d, w, d - 0.35);
  shape.lineTo(w, -d + 0.35);
  shape.quadraticCurveTo(w, -d, w - 0.35, -d);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.08, bevelThickness: 0.05 });
}

function addOpenBook(root, materials) {
  const cover = addMesh(root, roundedPageGeometry(9.6, 5.4), materials.dark, [0, 0.08, 0], [-Math.PI / 2, 0, 0]);
  cover.scale.set(1.02, 1.02, 1);
  for (const side of [-1, 1]) {
    const page = addMesh(root, roundedPageGeometry(4.65, 5), materials.paper, [side * 2.28, 0.27, 0], [-Math.PI / 2, side * -0.025, 0]);
    page.scale.z = 0.62;
  }
  addMesh(root, new THREE.CylinderGeometry(0.075, 0.075, 5, 12), materials.accent, [0, 0.42, 0], [Math.PI / 2, 0, 0]);
}

function addBackdrop(root, materials) {
  addMesh(root, new THREE.SphereGeometry(0.72, 16, 10), materials.paper, [-4.6, 4.2, -5.4]);
  for (let index = 0; index < 7; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const x = side * (3.8 + (index % 3) * 1.4);
    const y = 0.3 + (index % 3) * 0.48;
    const z = -3.5 - (index % 4) * 1.3;
    const island = addMesh(root, new THREE.ConeGeometry(0.8 + (index % 3) * 0.22, 1.35, 7), index % 2 ? materials.secondary : materials.ink, [x, y, z], [Math.PI, 0, index * 0.17]);
    island.scale.z = 0.78;
    addMesh(root, new THREE.ConeGeometry(0.28, 1.05, 6), materials.secondary, [x + 0.18, y + 1, z]);
  }
}

function addGoldenThread(root, material, points) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const thread = addMesh(root, new THREE.TubeGeometry(curve, 52, 0.035, 7, false), material);
  thread.name = 'golden-thread';
  return thread;
}

function addCluePins(root, chapter, materials) {
  const anchors = new Map();
  for (const clue of chapter.clues) {
    const anchor = new THREE.Group();
    anchor.name = `clue-${clue.id}`;
    anchor.position.set(...clue.at);
    anchor.userData.clueId = clue.id;
    const halo = addMesh(anchor, new THREE.TorusGeometry(0.23, 0.035, 8, 24), materials.accent, [0, 0, 0], [Math.PI / 2, 0, 0]);
    halo.name = 'clue-halo';
    addMesh(anchor, new THREE.OctahedronGeometry(0.12, 0), materials.white);
    root.add(anchor);
    anchors.set(clue.id, anchor);
  }
  return anchors;
}

function addDot(root, materials) {
  const dot = new THREE.Group();
  dot.name = 'dot-paper-star';
  const points = [];
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? 0.32 : 0.15;
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    points.push(new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  const shape = new THREE.Shape(points);
  const star = addMesh(dot, new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.02 }), materials.accent);
  star.position.z = -0.04;
  for (const x of [-0.08, 0.08]) addMesh(dot, new THREE.SphereGeometry(0.022, 8, 6), materials.ink, [x, 0.03, 0.08]);
  dot.position.set(-2.7, 2.15, 1.25);
  root.add(dot);
  return dot;
}

function addChapterOne(root, m) {
  addMesh(root, new THREE.CylinderGeometry(0.44, 0.62, 1.7, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xf5d99b, emissive: 0xf0a94b, emissiveIntensity: 0.65, opacity: 0.42, transparent: true, side: THREE.DoubleSide }), [2.25, 1.3, -0.2]);
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? 0.52 : 0.22;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) star.moveTo(x, y); else star.lineTo(x, y);
  }
  star.closePath();
  addMesh(root, new THREE.ExtrudeGeometry(star, { depth: 0.12, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.04 }), m.white, [-2.25, 0.46, 0.05], [-Math.PI / 2, 0, 0]);
  addGoldenThread(root, m.accent, [[-2.1, 0.52, 0.3], [-0.8, 0.52, -0.4], [0.7, 0.52, 0.1], [2.2, 0.52, -0.2]]);
}

function addChapterTwo(root, m) {
  const trunk = addMesh(root, new THREE.CylinderGeometry(0.42, 0.65, 3.2, 9), m.wood, [0, 1.85, -0.75]);
  trunk.rotation.z = -0.12;
  const beam = addMesh(root, new THREE.CylinderGeometry(0.12, 0.12, 4.4, 8), m.accent, [0, 3.25, -0.75], [0, 0, Math.PI / 2 - 0.16]);
  for (const side of [-1, 1]) {
    addMesh(root, new THREE.CylinderGeometry(0.02, 0.02, 1.05, 6), m.ink, [side * 1.65, 2.62 + side * -0.25, -0.75]);
    addMesh(root, new THREE.CylinderGeometry(0.7, 0.5, 0.12, 12), side < 0 ? m.secondary : m.paper, [side * 1.65, 2.05 + side * -0.25, -0.75]);
  }
  beam.userData.landmark = 'scale-tree';
  addMesh(root, new THREE.BoxGeometry(0.8, 0.75, 0.55), m.red, [2.3, 0.75, 0.45]);
  addGoldenThread(root, m.accent, [[-3.2, 0.52, 1], [-1.2, 0.58, 0.2], [0.3, 0.62, -0.4], [2.3, 0.8, 0.45]]);
}

function addChapterThree(root, m) {
  for (let i = 0; i < 11; i += 1) {
    const angle = i * Math.PI * 2 / 11;
    const radius = 2.2 + (i % 2) * 0.5;
    const lantern = addMesh(root, new THREE.IcosahedronGeometry(0.18 + (i % 3) * 0.04, 0), m.accent, [Math.cos(angle) * radius, 1.2 + (i % 3) * 0.38, Math.sin(angle) * radius * 0.52]);
    lantern.userData.floatPhase = i * 0.7;
  }
  const plaque = addMesh(root, new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-1.8, -0.22), new THREE.Vector2(1.8, -0.22), new THREE.Vector2(1.65, 0.22), new THREE.Vector2(-1.65, 0.22)]), { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02 }), m.paper, [0, 0.85, 0.25]);
  plaque.rotation.x = -0.25;
  addGoldenThread(root, m.accent, [[-3, 0.55, 0.5], [-1, 0.7, 0.2], [0.4, 0.9, 0.3], [3, 0.62, -0.4]]);
}

function birdGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0.18, -0.55, 0.12, 0, 0, -0.12, 0,
    0, 0, 0.18, 0.55, 0.12, 0, 0, -0.12, 0
  ], 3));
  geometry.computeVertexNormals();
  return geometry;
}

function addChapterFour(root, m) {
  addMesh(root, new THREE.CylinderGeometry(3.4, 3.4, 0.16, 32), new THREE.MeshStandardMaterial({ color: 0x173e57, metalness: 0.05, roughness: 0.28 }), [0, 0.5, -0.2]);
  for (let i = 0; i < 13; i += 1) {
    const bird = addMesh(root, birdGeometry(), i === 0 ? m.accent : m.paper, [-2.7 + (i % 6) * 1.05, 1.2 + (i % 4) * 0.48, -0.7 + Math.floor(i / 6) * 0.9]);
    bird.scale.setScalar(0.75 + (i % 3) * 0.2);
    bird.userData.floatPhase = i * 0.45;
  }
  const nest = addMesh(root, new THREE.TorusGeometry(0.65, 0.12, 8, 20), m.wood, [2.7, 0.72, 0.6], [Math.PI / 2, 0, 0]);
  nest.userData.landmark = 'quiet-nest';
  addGoldenThread(root, m.accent, [[-2.8, 0.58, 0.8], [-1, 0.8, 0.1], [0.5, 1.2, -0.1], [2.7, 0.75, 0.6]]);
}

function addChapterFive(root, m) {
  const tower = new THREE.Group();
  tower.position.set(0, 0.55, -0.65);
  for (let level = 0; level < 3; level += 1) {
    const gear = addMesh(tower, new THREE.TorusGeometry(0.65 + level * 0.16, 0.13, 8, 12), level === 1 ? m.red : m.accent, [0, 0.75 + level * 0.75, 0], [0, Math.PI / 2, 0]);
    gear.userData.gearDirection = level % 2 === 0 ? 1 : -1;
  }
  addMesh(tower, new THREE.CylinderGeometry(0.12, 0.12, 2.5, 10), m.ink, [0, 1.5, 0]);
  root.add(tower);
  for (let i = 0; i < 3; i += 1) addMesh(root, new THREE.TorusKnotGeometry(0.18, 0.055, 32, 6), m.accent, [-1.2 + i * 1.2, 0.86, 0.55]);
  addGoldenThread(root, m.accent, [[-3, 0.55, 0.5], [-1.2, 0.85, 0.55], [1.2, 0.85, 0.55], [2.9, 0.58, 0.9]]);
}

function addChapterSix(root, m) {
  for (let i = 0; i < 18; i += 1) {
    const x = -3.5 + (i % 9) * 0.85;
    const y = 1 + Math.floor(i / 9) * 1.1 + (i % 3) * 0.18;
    const light = addMesh(root, new THREE.SphereGeometry(0.055 + (i % 2) * 0.018, 8, 6), m.accent, [x, y, -1.55]);
    light.userData.floatPhase = i * 0.38;
  }
  for (const x of [-1.25, 1.25]) addMesh(root, new THREE.TorusKnotGeometry(0.2, 0.055, 36, 6), x < 0 ? m.ink : m.accent, [x, 1.08, 0.45]);
  const key = addMesh(root, new THREE.TorusGeometry(0.24, 0.06, 8, 20), m.accent, [2.7, 1.6, -0.2]);
  addMesh(key, new THREE.BoxGeometry(0.08, 0.55, 0.07), m.accent, [0, -0.35, 0]);
  addGoldenThread(root, m.accent, [[-3.1, 0.58, 0.4], [-1.25, 1.05, 0.45], [1.25, 1.05, 0.45], [2.7, 1.3, -0.2]]);
}

const BUILDERS = Object.freeze({
  'empty-desk': addChapterOne,
  'tilted-tree': addChapterTwo,
  'nameless-festival': addChapterThree,
  'echo-birds': addChapterFour,
  'three-second-tower': addChapterFive,
  'firefly-white-room': addChapterSix
});

export function createChapterLandmarks(chapter) {
  const root = new THREE.Group();
  root.name = `storybook-${chapter.sceneId}`;
  const materials = makeMaterials(chapter.palette);
  addOpenBook(root, materials);
  addBackdrop(root, materials);
  BUILDERS[chapter.sceneId](root, materials);
  const dot = addDot(root, materials);
  const clueAnchors = addCluePins(root, chapter, materials);

  return Object.freeze({
    clueAnchors,
    dot,
    root,
    update(elapsed, spreadIndex, discoveries) {
      dot.position.y = 2.15 + Math.sin(elapsed * 1.7) * 0.08;
      root.traverse((object) => {
        if (object.userData.floatPhase !== undefined) object.position.y += Math.sin(elapsed * 1.6 + object.userData.floatPhase) * 0.0007;
        if (object.userData.gearDirection) object.rotation.z = elapsed * 0.35 * object.userData.gearDirection;
      });
      for (const [id, anchor] of clueAnchors) {
        anchor.visible = spreadIndex === 1;
        const found = discoveries.includes(id);
        anchor.scale.setScalar(found ? 0.72 : 1 + Math.sin(elapsed * 3.2) * 0.09);
        anchor.userData.discovered = found;
      }
    }
  });
}
