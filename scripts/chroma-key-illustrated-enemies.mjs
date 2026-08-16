import { rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const files = Array.from({ length: 6 }, (_, index) => fileURLToPath(new URL(
  `../public/assets/illustrated/h17-chapter-${index + 1}-enemies-v1.png`,
  import.meta.url
)));

for (const source of files) {
  const output = `${source}.alpha.png`;
  const image = sharp(source).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const dominance = green - Math.max(red, blue);
    if (green < 105 || dominance < 24) continue;
    const alpha = Math.max(0, Math.min(255, 255 - Math.round((dominance - 24) * 1.8)));
    data[index + 3] = alpha;
    if (alpha < 250) data[index + 1] = Math.min(green, Math.max(red, blue));
  }

  await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(output);
  await rm(source);
  await rename(output, source);
}

const targetCellSize = 512;
const sourceRanges = [
  [[0, 430], [430, 910], [910, 1536]],
  [[0, 420], [420, 875], [875, 1536]],
  [[0, 455], [455, 990], [990, 1536]],
  [[0, 405], [405, 850], [850, 1536]],
  [[0, 370], [370, 790], [790, 1536]],
  [[0, 500], [500, 1020], [1020, 1536]]
];
for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
  const source = files[fileIndex];
  const sprites = [];
  for (let cell = 0; cell < 3; cell += 1) {
    const targetSize = cell === 2 ? 476 : 372;
    const [left, right] = sourceRanges[fileIndex][cell];
    const extracted = await sharp(source)
      .extract({ left, top: 0, width: right - left, height: 1024 })
      .png()
      .toBuffer();
    const { data, info } = await sharp(extracted)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
      .resize({ width: targetSize, height: targetSize, fit: 'inside' })
      .png()
      .toBuffer({ resolveWithObject: true });
    sprites.push({
      input: data,
      left: cell * targetCellSize + Math.floor((targetCellSize - info.width) / 2),
      top: targetCellSize - info.height - 12
    });
  }
  const normalized = `${source}.normalized.png`;
  await sharp({
    create: {
      width: targetCellSize * 3,
      height: targetCellSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).composite(sprites).png({ compressionLevel: 9 }).toFile(normalized);
  await rm(source);
  await rename(normalized, source);
}
