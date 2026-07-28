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

const child = spawn(process.execPath, ['--test', ...files], { stdio: 'inherit' });
child.once('error', (error) => { throw error; });
child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
