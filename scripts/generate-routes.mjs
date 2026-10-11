import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const sourcePath = join(publicRoot, 'index.html');
const languages = ['ro', 'ru', 'hu'];
const checkOnly = process.argv.includes('--check');
const source = (await readFile(sourcePath, 'utf8')).replace(/\r\n/g, '\n');

if (!source.includes('<html lang="en">') || !source.includes('<head>')) {
  throw new Error('The canonical public/index.html must contain <html lang="en"> and <head>.');
}

for (const lang of languages) {
  const outputPath = join(publicRoot, lang, 'index.html');
  const routeHtml = source
    .replace('<html lang="en">', `<html lang="${lang}">`)
    .replace('<head>', '<head>\n  <base href="../" />');

  if (checkOnly) {
    let existing;
    try {
      existing = (await readFile(outputPath, 'utf8')).replace(/\r\n/g, '\n');
    } catch {
      console.error(`Missing generated route: ${outputPath}`);
      process.exitCode = 1;
      continue;
    }
    if (existing !== routeHtml) {
      console.error(`Stale generated route: ${outputPath}`);
      process.exitCode = 1;
    }
    continue;
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, routeHtml, 'utf8');
  console.log(`Generated /${lang}/`);
}
