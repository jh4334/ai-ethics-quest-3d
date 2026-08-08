import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const referencePath = path.join(root, 'docs/design/concepts/gameplay-screen-v3.webp');
const actualPath = path.join(root, '.omo/evidence/h17-six-chapter/p0/chapter-1-classroom-desktop-1440x900.png');
const outputPath = path.join(root, '.omo/evidence/h17-six-chapter/p0/reference-vs-actual-chapter1-2880x900.png');

const [reference, actual] = await Promise.all([
  readFile(referencePath),
  readFile(actualPath)
]);
await mkdir(path.dirname(outputPath), { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 2880, height: 900 } });
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; display: grid; grid-template-columns: 1fr 1fr; background: #08101f; }
      figure { height: 900px; margin: 0; position: relative; overflow: hidden; }
      img { width: 100%; height: 100%; object-fit: cover; }
      figcaption { position: absolute; top: 18px; left: 18px; padding: 10px 14px;
        color: #fff5dd; background: #07101ee6; border: 1px solid #e5bc72; border-radius: 8px;
        font: 700 22px/1.2 system-ui, sans-serif; letter-spacing: .04em; }
    </style>
    <figure><img src="data:image/webp;base64,${reference.toString('base64')}"><figcaption>REFERENCE · 1440×900</figcaption></figure>
    <figure><img src="data:image/png;base64,${actual.toString('base64')}"><figcaption>H-17 ACTUAL · 1440×900</figcaption></figure>
  `);
  await page.screenshot({ path: outputPath });
  console.log(path.relative(root, outputPath).replaceAll('\\', '/'));
} finally {
  await browser.close();
}
