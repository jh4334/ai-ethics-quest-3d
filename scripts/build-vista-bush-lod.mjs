import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Accessor, Document, NodeIO } from '@gltf-transform/core';

const [inputArgument, outputArgument] = process.argv.slice(2);
if (!inputArgument || !outputArgument) {
  throw new Error('사용법: node scripts/build-vista-bush-lod.mjs <입력.glb> <출력.glb>');
}

const io = new NodeIO();
const source = await io.readBinary(await readFile(resolve(inputArgument)));
const sourceMaterial = source.getRoot().listMaterials()[0];
const sourceTexture = sourceMaterial?.getBaseColorTexture();
if (!sourceTexture?.getImage()) throw new Error('관목 원본에 base color 텍스처가 없습니다.');

const positions = [];
const normals = [];
const texcoords = [];
const corners = [
  [-0.95, 0, 0, 0, 0],
  [0.95, 0, 0, 1, 0],
  [0.95, 1.58, 0, 1, 1],
  [-0.95, 1.58, 0, 0, 1]
];

for (const angle of [0, Math.PI / 3, Math.PI * 2 / 3]) {
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const rotated = corners.map(([x, y, z, u, v]) => [
    x * cosine + z * sine, y, -x * sine + z * cosine, u, v
  ]);
  const normal = [sine, 0, cosine];
  for (const index of [0, 1, 2, 0, 2, 3]) {
    const [x, y, z, u, v] = rotated[index];
    positions.push(x, y, z);
    normals.push(...normal);
    texcoords.push(u, v);
  }
}

const output = new Document();
const buffer = output.createBuffer('vista-bush-lod-buffer');
const texture = output.createTexture('Leaves_TwistedTree_C')
  .setImage(sourceTexture.getImage())
  .setMimeType(sourceTexture.getMimeType());
const material = output.createMaterial('Leaves_TwistedTree_LOD')
  .setAlphaMode('MASK')
  .setAlphaCutoff(0.32)
  .setBaseColorFactor(sourceMaterial.getBaseColorFactor())
  .setBaseColorTexture(texture)
  .setDoubleSided(true)
  .setMetallicFactor(0)
  .setRoughnessFactor(0.96);
const primitive = output.createPrimitive()
  .setAttribute('POSITION', output.createAccessor('position')
    .setType(Accessor.Type.VEC3).setArray(new Float32Array(positions)).setBuffer(buffer))
  .setAttribute('NORMAL', output.createAccessor('normal')
    .setType(Accessor.Type.VEC3).setArray(new Float32Array(normals)).setBuffer(buffer))
  .setAttribute('TEXCOORD_0', output.createAccessor('texcoord')
    .setType(Accessor.Type.VEC2).setArray(new Float32Array(texcoords)).setBuffer(buffer))
  .setMaterial(material);
const mesh = output.createMesh('Bush_Common_Cross_Card_LOD').addPrimitive(primitive);
output.createScene('Scene').addChild(output.createNode('vista-bush').setMesh(mesh));

await writeFile(resolve(outputArgument), await io.writeBinary(output));
