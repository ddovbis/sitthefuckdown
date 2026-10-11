import QRCode from 'qrcode';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { siteConfig } from './site-config.mjs';

const url = new URL(process.argv[2] || siteConfig.url);
if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
  throw new Error('Use an HTTP(S) site URL without credentials.');
}
const options = { errorCorrectionLevel: 'M', margin: 4, width: 740 };
await QRCode.toFile(fileURLToPath(new URL('../public/sitthefuckdown-qr.png', import.meta.url)), url.href, options);
await writeFile(new URL('../public/sitthefuckdown-qr.svg', import.meta.url), await QRCode.toString(url.href, { ...options, type: 'svg' }));
console.log(`Sit the Fuck Down QR assets point to ${url.href}`);
