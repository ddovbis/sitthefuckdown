import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import QRCode from 'qrcode';
import { verifyLive } from './verify-live.mjs';
import { exportRelease } from './export-release.mjs';

const site = { url: 'https://example.com/', legacyUrls: ['https://example.github.io/site/'] };
const png = await QRCode.toBuffer(site.url, { width: 200 });
const assets = {
  'index.html': ['text/html', Buffer.from('<h1>Release</h1>')],
  'script.js': ['text/javascript', Buffer.from('console.log("release")')],
  'styles.css': ['text/css', Buffer.from('body { color: black; }')],
  'favicon.svg': ['image/svg+xml', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')],
  'sitthefuckdown-qr.png': ['image/png', png],
  'sitthefuckdown-qr.svg': ['image/svg+xml', Buffer.from(await QRCode.toString(site.url, { type: 'svg' }))],
};
for (const lang of ['ro', 'ru', 'hu']) {
  const url = new URL(lang, site.url).href;
  assets[`${lang}/index.html`] = ['text/html', Buffer.from(`<html lang="${lang}"><h1>Release</h1></html>`)];
  assets[`sitthefuckdown-qr-${lang}.png`] = ['image/png', await QRCode.toBuffer(url, { width: 200 })];
  assets[`sitthefuckdown-qr-${lang}.svg`] = ['image/svg+xml', Buffer.from(await QRCode.toString(url, { type: 'svg' }))];
}

function requestFor({ overrides = {}, redirectStatus = 301, tlsFailure = false } = {}) {
  return async (url, options) => {
    if (tlsFailure && url === 'https://www.example.com/') throw new Error('Certificate hostname mismatch');
    let response;
    if (url.startsWith(site.url)) {
      let path = new URL(url).pathname.slice(1) || 'index.html';
      if (['ro', 'ru', 'hu'].includes(path)) return new Response(null, { status:301, headers:{location:`${url}/`} });
      if (path.endsWith('/')) path += 'index.html';
      const [type, bytes] = overrides[path] || assets[path] || [];
      response = bytes ? new Response(bytes, { headers: { 'content-type': type } }) : new Response(null, { status: 404 });
    } else if (options.redirect === 'manual') {
      response = new Response(null, { status: redirectStatus, headers: { location: site.url } });
    } else {
      response = new Response('<h1>Release</h1>');
    }
    Object.defineProperty(response, 'url', { value: options.redirect === 'follow' ? site.url : url });
    return response;
  };
}

test('checks canonical assets, decoded QR and every permanent redirect', async () => {
  const report = await verifyLive({ site, request: requestFor() });
  assert.equal(report.ok, true);
  assert.equal(report.releaseComparison, false);
  assert.equal(report.checks.filter(check => check.kind === 'redirect').length, 4);
});

test('rejects temporary redirects even when their final destination works', async () => {
  const report = await verifyLive({ site, request: requestFor({ redirectStatus: 302 }) });
  assert.equal(report.ok, false);
  assert.match(report.checks.find(check => check.kind === 'redirect').error, /permanent redirect/);
});

test('reports TLS failures without bypassing certificate validation', async () => {
  const report = await verifyLive({ site, request: requestFor({ tlsFailure: true }) });
  assert.equal(report.ok, false);
  assert.match(report.checks.find(check => check.target === 'https://www.example.com/').error, /Certificate/);
});

test('rejects HTML served in place of JavaScript', async () => {
  const report = await verifyLive({ site, request: requestFor({ overrides: { 'script.js': ['text/html', Buffer.from('<h1>404</h1>')] } }) });
  assert.equal(report.ok, false);
  assert.match(report.checks.find(check => check.target.endsWith('script.js')).error, /content type/);
});

test('rejects a valid QR encoding the wrong domain', async () => {
  const wrong = await QRCode.toBuffer('https://wrong.example/', { width: 200 });
  const report = await verifyLive({ site, request: requestFor({ overrides: { 'sitthefuckdown-qr.png': ['image/png', wrong] } }) });
  assert.equal(report.ok, false);
  assert.match(report.checks.find(check => check.target.endsWith('sitthefuckdown-qr.png')).error, /QR destination mismatch/);
});

test('rejects a language QR that incorrectly opens English', async () => {
  const report = await verifyLive({ site, request: requestFor({ overrides: { 'sitthefuckdown-qr-ro.png': ['image/png', png] } }) });
  assert.equal(report.ok, false);
  assert.match(report.checks.find(check => check.target.endsWith('sitthefuckdown-qr-ro.png')).error, /QR destination mismatch/);
});

test('rejects language routes that serve the wrong static language', async () => {
  const report = await verifyLive({ site, request: requestFor({ overrides: { 'ru/index.html': ['text/html', Buffer.from('<html lang="en">Wrong page</html>')] } }) });
  assert.equal(report.ok, false);
  assert.match(report.checks.find(check => check.kind === 'language-route' && check.target.endsWith('/ru')).error, /Incorrect static language/);
});

test('selected release detects stale assets and missing newly added images', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stfd-release-check-'));
  try {
    for (const [path, [, bytes]] of Object.entries(assets)) {
      await mkdir(dirname(join(directory, path)), { recursive: true });
      await writeFile(join(directory, path), bytes);
    }
    await writeFile(join(directory, 'illustration.webp'), Buffer.from('release image'));
    const report = await verifyLive({ site, expectedDir: directory,
      request: requestFor({ overrides: { 'styles.css': ['text/css', Buffer.from('old release')] } }) });
    assert.equal(report.ok, false);
    assert.match(report.checks.find(check => check.target.endsWith('styles.css')).error, /selected release/);
    assert.match(report.checks.find(check => check.target.endsWith('illustration.webp')).error, /404/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('DNS checks are opt-in and compare complete record sets', async () => {
  const responses = {
    A: ['185.199.111.153', '185.199.110.153', '185.199.109.153', '185.199.108.153'],
    AAAA: ['2606:50c0:8003::153', '2606:50c0:8002::153', '2606:50c0:8001::153', '2606:50c0:8000::153'],
    CNAME: ['DDOVBIS.GITHUB.IO.'],
  };
  let calls = 0;
  const resolver = async (_host, type) => { calls++; return responses[type]; };
  await verifyLive({ site, request: requestFor(), resolveRecords: resolver });
  assert.equal(calls, 0);
  assert.equal((await verifyLive({ site, checkDns: true, request: requestFor(), resolveRecords: resolver })).ok, true);
  responses.AAAA.pop();
  const failure = await verifyLive({ site, checkDns: true, request: requestFor(), resolveRecords: resolver });
  assert.equal(failure.ok, false);
  assert.match(failure.checks.find(check => check.target.endsWith('AAAA')).error, /Expected/);
});

test('export uses committed blob bytes, only public files, and refuses overwrites', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'stfd-export-check-'));
  const output = join(temporary, 'release');
  const repository = fileURLToPath(new URL('../', import.meta.url));
  try {
    const result = await exportRelease({ ref: 'HEAD', output });
    const expected = execFileSync('git', ['show', `${result.commit}:public/favicon.svg`], { cwd: repository });
    assert.deepEqual(await readFile(join(result.publicDir, 'favicon.svg')), expected);
    assert.match(result.commit, /^[a-f0-9]{40}$/);
    const manifest = JSON.parse(await readFile(join(output, 'release.json'), 'utf8'));
    assert.equal(manifest.commit, result.commit);
    assert.equal(manifest.files.length, result.files);
    await assert.rejects(readFile(join(output, 'package.json')), { code: 'ENOENT' });
    await assert.rejects(exportRelease({ output }), /already exists/);
    assert.deepEqual(await readFile(join(result.publicDir, 'favicon.svg')), expected);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
