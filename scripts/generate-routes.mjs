import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const sourcePath = join(publicRoot, 'index.html');
const descriptions = {
  ro: 'Un mic manifest pentru băi mai curate.',
  ru: 'Небольшой манифест за чистоту в туалете.',
  hu: 'Egy kis kiáltvány a tisztább mosdókért.',
};
const checkOnly = process.argv.includes('--check');
const source = (await readFile(sourcePath, 'utf8')).replace(/\r\n/g, '\n');

if (!source.includes('<html lang="en">') || !source.includes('<head>')) {
  throw new Error('The canonical public/index.html must contain <html lang="en"> and <head>.');
}

for (const [lang, description] of Object.entries(descriptions)) {
  const outputPath = join(publicRoot, lang, 'index.html');
  const routeHtml = source
    .replace('<html lang="en">', `<html lang="${lang}">`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${description}" />`)
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
