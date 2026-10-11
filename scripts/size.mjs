import { readdir, stat, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const root = new URL('../public/', import.meta.url);
let total = 0;
let compressed = 0;
for (const name of (await readdir(root, { recursive: true })).sort()) {
  const path = new URL(name, root);
  if (!(await stat(path)).isFile()) continue;
  const contents = await readFile(path);
  total += contents.length;
  compressed += gzipSync(contents).length;
  console.log(`${name}: ${contents.length} bytes`);
}
console.log(`Deployment total: ${total} bytes (${(total / 1024).toFixed(2)} KiB)`);
console.log(`Individually gzipped estimate: ${compressed} bytes (${(compressed / 1024).toFixed(2)} KiB)`);
