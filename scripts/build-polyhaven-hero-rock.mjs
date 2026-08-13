import { NodeIO } from '@gltf-transform/core';
import { prune, simplify } from '@gltf-transform/functions';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const SOURCE_FILES = Object.freeze([
  Object.freeze({
    md5: '2bdb563c126a9d284e60e94951759e2f',
    path: 'rock_07_1k.gltf',
    url: 'https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/rock_07/rock_07_1k.gltf'
  }),
  Object.freeze({
    md5: '817b2cfd1626cb06f18a825f87f58ec3',
    path: 'rock_07.bin',
    url: 'https://dl.polyhaven.org/file/ph-assets/Models/gltf/8k/rock_07/rock_07.bin'
  }),
  Object.freeze({
    md5: '530bfd2a510fe6f778bb1198a2395574',
    path: 'textures/rock_07_arm_1k.jpg',
    url: 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/rock_07/rock_07_arm_1k.jpg'
  }),
  Object.freeze({
    md5: 'b68ac1824bb3bd3867641b830ad02099',
    path: 'textures/rock_07_diff_1k.jpg',
    url: 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/rock_07/rock_07_diff_1k.jpg'
  }),
  Object.freeze({
    md5: 'd3a2a0df0db0177c4df8ef644b003652',
    path: 'textures/rock_07_nor_gl_1k.jpg',
    url: 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/rock_07/rock_07_nor_gl_1k.jpg'
  })
]);

const outputPath = fileURLToPath(new URL(
  '../public/assets/reboot/environment/polyhaven-rock07/rock_07_512_simplified.glb',
  import.meta.url
));

function digest(algorithm, bytes) {
  return createHash(algorithm).update(bytes).digest('hex');
}

async function downloadSource(root, source) {
  const response = await fetch(source.url, {
    headers: { 'User-Agent': 'H17CampusBuild/1.0 (academic game project)' }
  });
  if (!response.ok) throw new Error(`Poly Haven 다운로드 실패 ${response.status}: ${source.path}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualMd5 = digest('md5', bytes);
  if (actualMd5 !== source.md5) throw new Error(`Poly Haven MD5 불일치: ${source.path}`);
  const path = join(root, source.path);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, bytes);
}

async function resizeTextures(root) {
  for (const source of SOURCE_FILES.filter(({ path }) => path.endsWith('.jpg'))) {
    const path = join(root, source.path);
    const sourceBytes = await readFile(path);
    const output = await sharp(sourceBytes)
      .resize({ fit: 'inside', height: 512, width: 512, withoutEnlargement: true })
      .jpeg({ chromaSubsampling: '4:4:4', mozjpeg: true, quality: 76 })
      .toBuffer();
    await writeFile(path, output);
  }
}

function triangleCount(document) {
  return document.getRoot().listMeshes().reduce((total, mesh) => (
    total + mesh.listPrimitives().reduce((meshTotal, primitive) => {
      const indices = primitive.getIndices();
      return meshTotal + (indices ? indices.getCount() : primitive.getAttribute('POSITION').getCount()) / 3;
    }, 0)
  ), 0);
}

const tempRoot = await mkdtemp(join(tmpdir(), 'h17-polyhaven-rock07-'));
try {
  for (const source of SOURCE_FILES) await downloadSource(tempRoot, source);
  await resizeTextures(tempRoot);
  const io = new NodeIO();
  const document = await io.read(join(tempRoot, 'rock_07_1k.gltf'));
  const sourceTriangles = triangleCount(document);
  await document.transform(
    simplify({ error: 0.02, lockBorder: true, ratio: 0.18, simplifier: MeshoptSimplifier }),
    prune()
  );
  const triangles = triangleCount(document);
  const bytes = Buffer.from(await io.writeBinary(document));
  await mkdir(join(outputPath, '..'), { recursive: true });
  await writeFile(outputPath, bytes);
  console.log(JSON.stringify({
    bytes: bytes.byteLength,
    outputPath,
    sha256: digest('sha256', bytes),
    sourceTriangles,
    triangles
  }, null, 2));
} finally {
  await rm(tempRoot, { force: true, recursive: true });
}
