import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

async function findTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await findTests(path));
    else if (entry.name.endsWith('.test.js')) found.push(path);
  }
  return found.sort();
}

const files = await findTests(fileURLToPath(new URL('.', import.meta.url)));
if (files.length === 0) throw new Error('실행할 node 테스트를 찾지 못했습니다.');
const suite = process.argv.find((argument) => argument.startsWith('--suite='))?.split('=')[1] ?? 'all';
if (!['all', 'h17', 'legacy'].includes(suite)) throw new RangeError(`지원하지 않는 테스트 묶음입니다: ${suite}`);
const selected = files.filter((path) => {
  const normalized = path.replaceAll('\\', '/');
  const h17 = normalized.includes('/tests/reboot/') || normalized.split('/').at(-1).startsWith('reboot-');
  return suite === 'all' || (suite === 'h17' ? h17 : !h17);
});
if (selected.length === 0) throw new Error(`${suite} 묶음에서 실행할 테스트를 찾지 못했습니다.`);

const child = spawn(process.execPath, ['--test', ...selected], { stdio: 'inherit' });
child.once('error', (error) => { throw error; });
child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
