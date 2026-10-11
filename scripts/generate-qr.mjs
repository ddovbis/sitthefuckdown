import QRCode from 'qrcode';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const url = new URL(process.argv[2] || 'https://sitthefuckdown.com/');
if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP(S) site URL.');
const options = { errorCorrectionLevel: 'M', margin: 4, width: 740 };
await QRCode.toFile(fileURLToPath(new URL('../public/stfd-qr.png', import.meta.url)), url.href, options);
await writeFile(new URL('../public/stfd-qr.svg', import.meta.url), await QRCode.toString(url.href, { ...options, type: 'svg' }));
console.log(`STFD QR assets point to ${url.href}`);
