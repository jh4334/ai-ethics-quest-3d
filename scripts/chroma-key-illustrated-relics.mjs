import { rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const source = fileURLToPath(new URL('../public/assets/illustrated/h17-evidence-relics-v1.png', import.meta.url));
const output = `${source}.alpha.png`;
const image = sharp(source).ensureAlpha();
const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

for (let index = 0; index < data.length; index += 4) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const dominance = green - Math.max(red, blue);
  if (green < 110 || dominance < 28) continue;
  const alpha = Math.max(0, Math.min(255, 255 - Math.round((dominance - 28) * 1.55)));
  data[index + 3] = alpha;
  if (alpha < 245) data[index + 1] = Math.min(green, Math.max(red, blue));
}

await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(output);
await rm(source);
await rename(output, source);

