import { readFile } from 'node:fs/promises';

import { evaluateSliceManifest } from '../src/reboot/slice/contract.js';

const manifestPath = process.argv[2] ?? '.omo/evidence/task-12-slice-manifest.json';

try {
  const raw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  const result = evaluateSliceManifest(manifest);
  if (!result.pass) {
    console.error(`H-17 수직 슬라이스 게이트 실패: ${result.failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`H-17 수직 슬라이스 게이트 통과: ${manifestPath}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`H-17 수직 슬라이스 증거를 읽을 수 없습니다: ${message}`);
  process.exitCode = 1;
}
