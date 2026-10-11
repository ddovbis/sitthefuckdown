import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve4, resolve6, resolveCname } from 'node:dns/promises';
import { resolve, join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { siteConfig } from './site-config.mjs';

const pagesDns = JSON.parse(await readFile(new URL('../config/pages-dns.json', import.meta.url), 'utf8'));
const assetTypes = {
  '.html': ['text/html'], '.js': ['text/javascript', 'application/javascript'],
  '.css': ['text/css'], '.svg': ['image/svg+xml'], '.png': ['image/png'],
  '.webp': ['image/webp'], '.avif': ['image/avif'], '.ico': ['image/x-icon', 'image/vnd.microsoft.icon'],
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function releaseFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await releaseFiles(join(directory, entry.name), path + '/'));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Release contains a non-regular file: ${path}`);
  }
  return files.sort();
}

const publicRequest = (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
const publicResolve = (host, type) => ({ A: resolve4, AAAA: resolve6, CNAME: resolveCname })[type](host);

// Network dependencies can be supplied by tests without contacting production.
export async function verifyLive({ site = siteConfig, expectedDir, checkDns = false,
  request = publicRequest, resolveRecords = publicResolve } = {}) {
  const base = new URL(site.url);
  const checks = [];
  async function check(kind, target, action) {
    try { checks.push({ kind, target, ok: true, ...await action() }); }
    catch (error) { checks.push({ kind, target, ok: false, error: error.message }); }
  }

  let paths = ['index.html', 'script.js', 'styles.css', 'favicon.svg', 'stfd-qr.png', 'stfd-qr.svg'];
  if (expectedDir) {
    // Check all deployed files, including images added after the initial rollout.
    const files = await releaseFiles(expectedDir);
    if (!files.includes('index.html') || !files.includes('stfd-qr.png') || !files.includes('stfd-qr.svg')) {
      throw new Error('--expected-dir must contain the release index.html and both QR assets.');
    }
    paths = [...new Set([...paths, ...files])];
  }
  for (const path of paths) {
    const url = new URL(path === 'index.html' ? '' : path.split('/').map(encodeURIComponent).join('/'), base).href;
    await check('asset', url, async () => {
      const response = await request(url, { redirect: 'manual' });
      if (response.status !== 200) throw new Error(`Expected 200, received ${response.status}`);
      const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const allowed = assetTypes[extname(path)];
      if (allowed && !allowed.includes(type)) throw new Error(`Unexpected content type ${type || '(missing)'}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) throw new Error('Empty asset');
      const result = { path, status: response.status, contentType: type, bytes: bytes.length };
      if (expectedDir) {
        result.sha256 = sha256(bytes);
        if (result.sha256 !== sha256(await readFile(join(expectedDir, path)))) {
          throw new Error('Deployed bytes differ from the selected release');
        }
      }
      if (path === 'stfd-qr.png') {
        const png = PNG.sync.read(bytes);
        result.destination = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
        if (result.destination !== base.href) throw new Error(`QR destination mismatch: ${result.destination || '(undecodable)'}`);
      }
      return result;
    });
  }

  const http = new URL(base); http.protocol = 'http:';
  const www = new URL(base); www.hostname = base.hostname.startsWith('www.') ? base.hostname.slice(4) : `www.${base.hostname}`;
  const httpWww = new URL(www); httpWww.protocol = 'http:';
  for (const url of new Set([http.href, httpWww.href, www.href, ...site.legacyUrls])) {
    if (url === base.href) continue;
    await check('redirect', url, async () => {
      const first = await request(url, { redirect: 'manual' });
      if (![301, 308].includes(first.status)) throw new Error(`Expected a permanent redirect, received ${first.status}`);
      const location = first.headers.get('location');
      if (!location || new URL(location, url).href !== base.href) throw new Error(`Redirect does not point to ${base.href}`);
      const final = await request(url, { redirect: 'follow' });
      if (final.status !== 200 || final.url !== base.href) throw new Error(`Final response is ${final.status} at ${final.url}`);
      await final.body?.cancel();
      return { status: first.status, location, final: final.url, finalStatus: final.status };
    });
  }
  if (checkDns) {
    const apex = base.hostname.replace(/^www\./, '');
    const expected = [[apex, 'A', pagesDns.A], [apex, 'AAAA', pagesDns.AAAA], [`www.${apex}`, 'CNAME', [pagesDns.wwwCname]]];
    for (const [host, type, values] of expected) {
      await check('dns', `${host} ${type}`, async () => {
        const normalize = value => type === 'CNAME' ? value.toLowerCase().replace(/\.$/, '')
          : type === 'AAAA' ? new URL(`http://[${value}]/`).hostname : value;
        const answers = await resolveRecords(host, type);
        const actual = [...new Set(answers.map(normalize))].sort();
        if (JSON.stringify(actual) !== JSON.stringify([...new Set(values.map(normalize))].sort())) {
          throw new Error(`Expected ${values.join(', ')}, received ${answers.join(', ')}`);
        }
        return { answers };
      });
    }
  }
  return { checkedAt: new Date().toISOString(), site: base.href,
    releaseComparison: Boolean(expectedDir), dnsChecked: checkDns,
    ok: checks.every(item => item.ok), checks };
}

async function main() {
  const { values } = parseArgs({ options: {
    'expected-dir': { type: 'string' }, dns: { type: 'boolean', default: false },
    output: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log('Usage: npm run verify:live -- [--expected-dir <release/public>] [--dns] [--output <report.json>]\nRead-only HTTPS, redirect, asset and QR checks. DNS expectations are in config/pages-dns.json.\nWithout --expected-dir, asset hashes are not compared. Reports default to ignored outputs/.');
    return;
  }
  const report = await verifyLive({ expectedDir: values['expected-dir'] && resolve(values['expected-dir']), checkDns: values.dns });
  const output = resolve(values.output || `outputs/domain-check-${report.checkedAt.replace(/[:.]/g, '-')}.json`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  for (const check of report.checks) console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.kind} ${check.target}${check.error ? ': ' + check.error : ''}`);
  console.log(`Report: ${output}\nRelease hashes: ${report.releaseComparison ? 'checked' : 'not requested'}`);
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
