import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { siteConfig } from '../scripts/site-config.mjs';

function decode(bytes) {
  const image = PNG.sync.read(bytes);
  return jsQR(new Uint8ClampedArray(image.data), image.width, image.height)?.data;
}

for (const lang of ['en', 'ro', 'ru', 'hu']) {
  test(`${lang}: displayed and downloaded branded QR codes decode at screen and print sizes`, async ({ page }) => {
    const route = lang === 'en' ? '/' : `/${lang}`;
    const destination = new URL(lang === 'en' ? '' : lang, siteConfig.url).href;
    const stem = `sitthefuckdown-qr${lang === 'en' ? '' : `-${lang}`}`;
    await page.goto(route);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    const image = page.locator('.qr-frame img');
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(image => image.decode());
    expect(await image.getAttribute('src')).toContain(`${stem}.png`);
    expect(decode(await page.locator('.qr-frame').screenshot())).toBe(destination);

    for (const format of ['png', 'svg']) {
      const downloadEvent = page.waitForEvent('download');
      await page.locator(`.qr-link[data-qr-format="${format}"]`).click();
      const download = await downloadEvent;
      expect(download.suggestedFilename()).toBe(`${stem}.${format}`);
      expect(await download.failure()).toBeNull();
      const bytes = await readFile(await download.path());
      if (format === 'png') expect(decode(bytes)).toBe(destination);
      else expect(bytes.toString()).toContain('sitthefuckdown.com');

      // The same delivered file is rasterized at actual screen size, two print
      // sizes (about 25/51 mm at 300 dpi), and native download resolution.
      for (const size of [224, 300, 600, 984]) {
        const encoded = await page.evaluate(async ({ format, size, stem }) => {
          const image = new Image();
          image.src = new URL(`./${stem}.${format}`, document.baseURI).href;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = size;
          const context = canvas.getContext('2d');
          context.fillStyle = '#fff';
          context.fillRect(0, 0, size, size);
          context.drawImage(image, 0, 0, size, size);
          return canvas.toDataURL('image/png').split(',')[1];
        }, { format, size, stem });
        expect(decode(Buffer.from(encoded, 'base64')), `${lang} ${format} at ${size}px`).toBe(destination);
      }
    }
  });
}
