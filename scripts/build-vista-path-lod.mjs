import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Accessor, Document, NodeIO } from '@gltf-transform/core';

const [inputArgument, outputArgument] = process.argv.slice(2);
if (!inputArgument || !outputArgument) {
  throw new Error('사용법: node scripts/build-vista-path-lod.mjs <입력.glb> <출력.glb>');
}

const inputPath = resolve(inputArgument);
const outputPath = resolve(outputArgument);
const io = new NodeIO();
const source = await io.readBinary(await readFile(inputPath));
const sourceMaterial = source.getRoot().listMaterials()[0];
const sourceTexture = sourceMaterial?.getBaseColorTexture();
if (!sourceTexture?.getImage()) throw new Error('석로 원본에 base color 텍스처가 없습니다.');

const corners = [
  [-0.48, 0.07, -0.42],
  [0.44, 0.09, -0.49],
  [0.5, 0.06, 0.38],
  [-0.41, 0.08, 0.48],
  [-0.44, -0.03, -0.39],
  [0.4, -0.025, -0.45],
  [0.46, -0.035, 0.35],
  [-0.38, -0.025, 0.44]
];
const triangles = [
  [0, 1, 2], [0, 2, 3],
  [6, 5, 4], [7, 6, 4],
  [0, 4, 5], [0, 5, 1],
  [1, 5, 6], [1, 6, 2],
  [2, 6, 7], [2, 7, 3],
  [3, 7, 4], [3, 4, 0]
];
const positions = [];
const normals = [];
const texcoords = [];

function normalOf(a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cross = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0]
  ];
  const length = Math.hypot(...cross) || 1;
  return cross.map((value) => value / length);
}

for (const [triangleIndex, triangle] of triangles.entries()) {
  const vertices = triangle.map((index) => corners[index]);
  const normal = normalOf(...vertices);
  for (const [vertexIndex, vertex] of vertices.entries()) {
    positions.push(...vertex);
    normals.push(...normal);
    texcoords.push(
      triangleIndex < 4 ? vertex[0] + 0.5 : vertexIndex === 1 ? 1 : 0,
      triangleIndex < 4 ? vertex[2] + 0.5 : vertexIndex === 2 ? 1 : 0
    );
  }
}

const output = new Document();
const buffer = output.createBuffer('vista-path-lod-buffer');
const texture = output.createTexture('PathRocks_Diffuse')
  .setImage(sourceTexture.getImage())
  .setMimeType(sourceTexture.getMimeType());
const material = output.createMaterial('PathRocks_LOD')
  .setBaseColorFactor(sourceMaterial.getBaseColorFactor())
  .setBaseColorTexture(texture)
  .setMetallicFactor(0)
  .setRoughnessFactor(0.94);
const primitive = output.createPrimitive()
  .setAttribute('POSITION', output.createAccessor('position')
    .setType(Accessor.Type.VEC3).setArray(new Float32Array(positions)).setBuffer(buffer))
  .setAttribute('NORMAL', output.createAccessor('normal')
    .setType(Accessor.Type.VEC3).setArray(new Float32Array(normals)).setBuffer(buffer))
  .setAttribute('TEXCOORD_0', output.createAccessor('texcoord')
    .setType(Accessor.Type.VEC2).setArray(new Float32Array(texcoords)).setBuffer(buffer))
  .setMaterial(material);
const mesh = output.createMesh('RockPath_Irregular_Slab_LOD').addPrimitive(primitive);
output.createScene('Scene').addChild(output.createNode('vista-path-stone').setMesh(mesh));

await writeFile(outputPath, await io.writeBinary(output));
