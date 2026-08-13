import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENTRY_DOCUMENTS = ['index.html', 'reboot.html', 'legacy.html'];
const SHELL_FILES = [
  ...ENTRY_DOCUMENTS,
  'manifest.webmanifest',
  'icon.svg',
  'trilogy.html',
  'reboot-assets.json'
];

function resolveBuildPath(distRoot, manifestPath) {
  if (typeof manifestPath !== 'string') throw new TypeError('에셋 매니페스트 경로는 문자열이어야 합니다.');
  const normalized = manifestPath.replace(/^\.\//, '').replaceAll('\\', '/');
  const absolutePath = resolve(distRoot, normalized);
  const relativePath = relative(distRoot, absolutePath);
  if (!normalized || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new RangeError(`빌드 루트 밖의 에셋 경로입니다: ${manifestPath}`);
  }
  return { absolutePath, normalized };
}

async function measurePaths(distRoot, paths) {
  const normalizedPaths = [...new Set(paths)].sort();
  const sizes = await Promise.all(normalizedPaths.map(async (path) => {
    const { absolutePath } = resolveBuildPath(distRoot, path);
    const file = await stat(absolutePath);
    if (!file.isFile()) throw new TypeError(`에셋 경로가 파일이 아닙니다: ${path}`);
    return file.size;
  }));
  return Object.freeze({
    bytes: sizes.reduce((sum, size) => sum + size, 0),
    files: normalizedPaths.length
  });
}

async function readShellAssetPaths(distRoot) {
  const paths = new Set(SHELL_FILES);
  for (const document of ENTRY_DOCUMENTS) {
    const html = await readFile(resolve(distRoot, document), 'utf8');
    for (const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)) {
      if (/^(?:\.?\/)?assets\//.test(match[1])) paths.add(match[1].replace(/^\.?\//, ''));
    }
  }
  return [...paths];
}

export async function buildAssetTransferReport(projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))) {
  const distRoot = resolve(projectRoot, 'dist');
  const manifestPath = resolve(distRoot, 'reboot-assets.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!Array.isArray(manifest)) throw new TypeError('reboot-assets.json은 경로 배열이어야 합니다.');
  const assetPaths = manifest.map((path) => resolveBuildPath(distRoot, path).normalized);
  const initialShellPaths = await readShellAssetPaths(distRoot);
  const environmentPaths = assetPaths.filter((path) => path.startsWith('assets/reboot/environment/'));
  const installAssetPaths = assetPaths.filter((path) => !path.startsWith('assets/reboot/environment/'));
  const animationPaths = assetPaths.filter((path) => path.startsWith('assets/reboot/characters/animations/'));
  const characterPaths = assetPaths.filter((path) => (
    path.startsWith('assets/reboot/characters/') && !path.startsWith('assets/reboot/characters/animations/')
  ));

  return Object.freeze({
    categories: Object.freeze({
      initialShell: await measurePaths(distRoot, initialShellPaths),
      installPrecache: await measurePaths(distRoot, [...initialShellPaths, ...installAssetPaths]),
      chapterEnvironment: await measurePaths(distRoot, environmentPaths),
      character: await measurePaths(distRoot, characterPaths),
      animation: await measurePaths(distRoot, animationPaths)
    }),
    total: await measurePaths(distRoot, [...initialShellPaths, ...assetPaths])
  });
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const report = await buildAssetTransferReport(process.argv[2] ? resolve(process.argv[2]) : undefined);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
