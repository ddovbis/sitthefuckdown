import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { siteConfig } from './site-config.mjs';

const baseUrl = new URL(process.argv[2] || siteConfig.url);
if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password ||
    baseUrl.search || baseUrl.hash || !baseUrl.pathname.endsWith('/')) {
  throw new Error('Use an HTTP(S) site URL without credentials, query, or fragment, with a trailing slash.');
}

const outputDir = fileURLToPath(new URL('../public/', import.meta.url));
const languages = ['en', 'ro', 'ru', 'hu'];
const sizes = [224, 300, 600, 984];
const quietModules = 4;
const qrWidth = 33;
const totalModules = qrWidth + quietModules * 2;
const labelBandWidth = 19;
const labelBandHeight = 4;
const labelBandLeft = (totalModules - labelBandWidth) / 2;
const labelBandTop = (totalModules - labelBandHeight) / 2;
const label = 'sitthefuckdown.com';

function makeSvg(qr, destination) {
  if (qr.version !== 4 || qr.modules.size !== qrWidth) {
    throw new Error(`Expected a version 4 QR matrix, received version ${qr.version}.`);
  }

  const paths = [];
  for (let y = 0; y < qrWidth; y++) {
    let start = null;
    for (let x = 0; x <= qrWidth; x++) {
      const black = x < qrWidth && qr.modules.get(y, x);
      if (black && start === null) start = x;
      if (!black && start !== null) {
        paths.push(`M${start + quietModules} ${y + quietModules}h${x - start}v1h-${x - start}z`);
        start = null;
      }
    }
  }

  // Version 4's alignment pattern is centered at (26, 26) in the QR matrix.
  // With the four-module quiet zone, it is at (30, 30). The centered label
  // band spans x=11..30 and y=18.5..22.5: it preserves the vertical timing
  // column at x=10, the horizontal timing row at y=10, and the alignment
  // pattern, as well as all finder patterns and the quiet zone.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="984" height="984" viewBox="0 0 ${totalModules} ${totalModules}" role="img" aria-label="QR code for ${destination}"><rect width="${totalModules}" height="${totalModules}" fill="#fff"/><path d="${paths.join('')}" fill="#111"/><rect x="${labelBandLeft}" y="${labelBandTop}" width="${labelBandWidth}" height="${labelBandHeight}" fill="#fff"/><text x="${totalModules / 2}" y="${labelBandTop + 2.72}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="1.7" font-weight="700" fill="#111">${label}</text></svg>`;
  return svg;
}

function decodePng(base64) {
  const png = PNG.sync.read(Buffer.from(base64, 'base64'));
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data ?? null;
}

const configuredExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
if (configuredExecutable && !existsSync(configuredExecutable)) {
  throw new Error(`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH does not exist: ${configuredExecutable}`);
}
const browserCandidates = process.platform === 'win32'
  ? [
      join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
      join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
      join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Microsoft/Edge/Application/msedge.exe'),
    ]
  : [];
const executablePath = configuredExecutable || browserCandidates.find(path => existsSync(path));
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
try {
  const page = await browser.newPage();
  const failures = [];

  for (const lang of languages) {
    const destination = lang === 'en' ? baseUrl.href : new URL(lang, baseUrl).href;
    const qr = QRCode.create(destination, { errorCorrectionLevel: 'H', version: 4 });
    const svg = makeSvg(qr, destination);
    const stem = lang === 'en' ? 'sitthefuckdown-qr' : `sitthefuckdown-qr-${lang}`;
    await writeFile(join(outputDir, `${stem}.svg`), svg);

    for (const size of sizes) {
      const png = await page.evaluate(async ({ markup, imageSize }) => {
        const image = new Image();
        image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(markup)))}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = imageSize;
        canvas.height = imageSize;
        const context = canvas.getContext('2d', { alpha: false });
        context.imageSmoothingEnabled = false;
        context.fillStyle = '#fff';
        context.fillRect(0, 0, imageSize, imageSize);
        context.drawImage(image, 0, 0, imageSize, imageSize);
        return canvas.toDataURL('image/png').split(',')[1];
      }, { markup: svg, imageSize: size });
      const actual = decodePng(png);
      if (actual !== destination) {
        failures.push(`${lang} at ${size}px decoded ${actual || '(nothing)'}`);
      }
      if (size === 984) await writeFile(join(outputDir, `${stem}.png`), Buffer.from(png, 'base64'));
    }
  }

  if (failures.length) throw new Error(`Branded QR scan checks failed:\n${failures.join('\n')}`);
  console.log(`Generated branded PNG and SVG QR codes for ${languages.join(', ')} at ${baseUrl.href}`);
  console.log(`All destinations decoded at ${sizes.join(', ')}px with H-level correction.`);
} finally {
  await browser.close();
}
