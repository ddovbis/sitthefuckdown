import { execFileSync } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const repository = fileURLToPath(new URL('../', import.meta.url));
const git = args => execFileSync('git', args, { cwd: repository, maxBuffer: 16 * 1024 * 1024 });

// Export object bytes instead of checkout bytes, which may have CRLF conversion.
export async function exportRelease({ ref = 'HEAD', output } = {}) {
  const commit = git(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).toString('utf8').trim();
  const destination = resolve(output || `outputs/release-${commit.slice(0, 12)}`);
  try { await access(destination); throw new Error(`Output already exists: ${destination}. Choose a new directory.`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const entries = git(['ls-tree', '-rz', commit, '--', 'public/']).toString('utf8').split('\0').filter(Boolean);
  const files = entries.map(entry => {
    const match = /^(100644|100755) blob ([a-f0-9]+)\t(public\/[^\0]+)$/.exec(entry);
    if (!match) throw new Error('Release public/ must contain only regular files.');
    const path = match[3].slice('public/'.length);
    if (path.split('/').some(part => !part || part === '..' || part.includes('\\'))) throw new Error(`Invalid release path: ${path}`);
    return { path, sha: match[2] };
  });
  if (!files.some(file => file.path === 'index.html')) throw new Error('The commit has no public/index.html.');
  await mkdir(destination, { recursive: true });
  const publicDir = join(destination, 'public');
  const manifest = { commit, files: [] };
  for (const file of files) {
    const bytes = git(['cat-file', 'blob', file.sha]);
    const target = join(publicDir, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    manifest.files.push({ path: file.path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  await writeFile(join(destination, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { commit, publicDir, files: files.length };
}

async function main() {
  const { values } = parseArgs({ options: { ref: { type: 'string', default: 'HEAD' }, output: { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help) { console.log('Usage: npm run export:release -- [--ref <commit>] [--output <new-directory>]\nExports committed public/ bytes and a release manifest without checkout line-ending conversion.'); return; }
  console.log(JSON.stringify(await exportRelease(values), null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
