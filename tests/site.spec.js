import { test, expect } from '@playwright/test';
import { mkdir, mkdtemp, writeFile, symlink, unlink, rmdir, rm } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const languages = {
  en: { code: 'EN', cta: 'I accept the throne', done: 'Pledge accepted ✅' },
  ro: { code: 'RO', cta: 'Gata, mă așez', done: 'Așa da, civilizat ✅' },
  ru: { code: 'RU', cta: 'Окей, сажусь', done: 'Вот это по-человечески ✅' },
  hu: { code: 'HU', cta: 'Oké, leülök', done: 'Na, ez már kultúra ✅' },
};

for (const [lang, copy] of Object.entries(languages)) {
  test(`${lang}: branding, complete translations, pledge, slogans and layout`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const failures = [];
    page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
    await page.goto(`/?lang=${lang}`);
    await expect(page).toHaveTitle('Sit the Fuck Down');
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('h1')).toHaveText('Sit the Fuck Down');
    await expect(page.locator('.contribution a')).toHaveAttribute('href', 'https://github.com/ddovbis/sitthefuckdown');
    await expect(page.locator('.contribution a')).toHaveAccessibleName('GitHub');
    await expect(page.locator('body')).not.toContainText('ddovbis');
    await expect(page.locator('#language-code')).toHaveText(copy.code);
    await expect(page.locator('.language-options [data-lang] span')).toHaveText(['EN', 'RO', 'RU', 'HU']);
    await expect(page.locator('#language-toggle')).toHaveAttribute('aria-label', await page.evaluate(() => translations[currentLang].languageToggleLabel));
    await expect(page.locator('#language-options')).toHaveAttribute('aria-label', await page.evaluate(() => translations[currentLang].languageMenuLabel));
    await expect(page.locator('#qr-download-png')).toHaveAttribute('data-qr-format', 'png');
    await expect(page.locator('#qr-download-svg')).toHaveAttribute('data-qr-format', 'svg');
    await expect(page.locator('#qr-download-svg')).toHaveText(/SVG/);
    await expect(page.locator('#qr-image')).toHaveAttribute('alt', await page.evaluate(() => translations[currentLang].qrImageAlt));
    await expect(page.locator('#pledge')).toHaveText(copy.cta);
    expect(await page.evaluate(() => Array.from(document.querySelectorAll('[data-i18n]')).every(node => {
      const value = translations[currentLang][node.dataset.i18n];
      return typeof value === 'string' && node.textContent === value;
    }))).toBe(true);
    const illustration = page.locator('.last-argument img');
    await illustration.scrollIntoViewIfNeeded();
    await expect.poll(() => illustration.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
    await expect(illustration).toHaveAttribute('alt', await page.evaluate(() => translations[currentLang].lastImageAlt));
    await page.locator('#pledge').click();
    await expect(page.locator('#pledge')).toHaveText(copy.done);
    expect(await page.evaluate(() => translations[currentLang].pledges.includes(document.querySelector('#microcopy').textContent))).toBe(true);
    const firstSlogan = await page.locator('#line').textContent();
    await page.locator('#more').click();
    await expect(page.locator('#line')).not.toHaveText(firstSlogan);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    expect(failures).toEqual([]);
  });
}

test('owner-reviewed Romanian and Russian wording is preserved', async ({ page }) => {
  await page.goto('/ro/');
  await expect(page.locator('#line')).toHaveText('“Așază-te jos, ține standardele sus.”');
  await expect(page.locator('#last-title')).toHaveText('…Și dacă nici asta nu te-a convins');
  await expect(page.locator('.last-close')).toHaveText('Fii civilizat. Sit the fuck down.');
  await page.goto('/ru/');
  await expect(page.locator('.last-close')).toHaveText('Будь, блять, человеком и сядь.');
  await expect(page.locator('[data-i18n="medical"]')).toHaveText('Медицинская ремарка: если мочиться трудно, больно или слишком часто — сходи к врачу, а не к QR-коду.');
});

test('source sentence and hyphenated words stay together across responsive widths', async ({ page }) => {
  const wordsToKeep = {
    en: [],
    ro: [['#line', 'Așază-te']],
    ru: [['#qr-title', 'QR-код'], ['[data-i18n="medical"]', 'QR-коду']],
    hu: [['[data-i18n="medical"]', 'QR-kódhoz']],
  };
  for (const width of [320, 390, 540, 768, 800, 801, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const lang of Object.keys(languages)) {
      await page.goto(`/?lang=${lang}`);
      const source = page.locator('.source-reference');
      const geometry = await source.evaluate(node => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const tops = [...range.getClientRects()].filter(r => r.width > 0).map(r => r.top);
        const box = node.getBoundingClientRect();
        return { lineSpread: Math.max(...tops) - Math.min(...tops), left: box.left, right: box.right };
      });
      expect(geometry.lineSpread, `${lang} source sentence at ${width}px`).toBeLessThan(2);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(width);
      await expect(source.locator('a')).toHaveText('GitHub');
      for (const [selector, word] of wordsToKeep[lang]) {
        const lineSpread = await page.locator(selector).evaluate((node, text) => {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          let textNode;
          while ((textNode = walker.nextNode())) {
            const offset = textNode.textContent.indexOf(text);
            if (offset < 0) continue;
            const range = document.createRange();
            range.setStart(textNode, offset);
            range.setEnd(textNode, offset + text.length);
            const tops = [...range.getClientRects()].map(r => r.top);
            return Math.max(...tops) - Math.min(...tops);
          }
          return Infinity;
        }, word);
        expect(lineSpread, `${word} at ${width}px`).toBeLessThan(2);
      }
    }
  }
});

test('language picker persists choice, resets pledge, and URL takes priority', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pledge').click();
  for (const [lang, copy] of Object.entries(languages)) {
    await page.locator('#language-toggle').click();
    await expect(page.locator('#language-toggle')).toHaveAttribute('aria-expanded', 'true');
    await page.locator(`[data-lang="${lang}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('#pledge')).toHaveText(copy.cta);
    await expect(page.locator('#language-toggle')).toHaveAttribute('aria-expanded', 'false');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
  }
  await page.goto('/?lang=ro');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
});

test('language paths beat saved and query preferences, and survive refresh', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('stfd-language', 'hu'));
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  for (const lang of ['ro', 'ru', 'hu']) {
    await page.goto(`/${lang}/?lang=en`);
    await expect(page).toHaveURL(new RegExp(`/${lang}/\\?lang=en$`));
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    const expectedQr = `sitthefuckdown-qr-${lang}.png`;
    await expect.poll(() => page.locator('#qr-image').evaluate(image => new URL(image.src).pathname)).toBe(`/${expectedQr}`);
  }

  await page.goto('/ro/index.html');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro');

  await page.goto('/?lang=ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('language picker changes routes, resets pledge, and follows browser history', async ({ page }) => {
  await page.goto('/');
  await page.locator('#pledge').click();
  await page.locator('#language-toggle').click();
  await page.locator('[data-lang="ro"]').click();
  await expect(page).toHaveURL(/\/ro\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
  await expect(page.locator('#pledge')).toHaveText(languages.ro.cta);
  await expect(page.locator('#qr-download-png')).toHaveAttribute('href', /sitthefuckdown-qr-ro\.png$/);
  await expect(page.locator('#qr-download-svg')).toHaveAttribute('href', /sitthefuckdown-qr-ro\.svg$/);
  await expect(page.locator('#qr-image')).toHaveAttribute('alt', /română/);
  expect(await page.evaluate(() => localStorage.getItem('stfd-language'))).toBe('ro');

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.goForward();
  await expect(page).toHaveURL(/\/ro\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
  await expect(page.locator('#qr-download-png')).toHaveAttribute('href', /sitthefuckdown-qr-ro\.png$/);
  await expect(page.locator('#qr-download-svg')).toHaveAttribute('href', /sitthefuckdown-qr-ro\.svg$/);
  await expect(page.locator('#qr-image')).toHaveAttribute('alt', /română/);
});

test('unsupported language falls back to English', async ({ page }) => {
  await page.goto('/?lang=unsupported');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#pledge')).toHaveText(languages.en.cta);
  await page.goto('/?lang=constructor');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('storage restrictions do not break the site or language switching', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  });
  await page.goto('/');
  await page.locator('#language-toggle').click();
  await page.locator('[data-lang="ru"]').click();
  await expect(page.locator('#pledge')).toHaveText(languages.ru.cta);
  expect(errors).toEqual([]);
});

test('menu closes on Escape and outside click; hidden options are not focusable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-lang="en"]')).not.toBeVisible();
  await page.locator('#language-toggle').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#pledge')).toBeFocused();
  await page.locator('#language-toggle').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#language-toggle')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#language-toggle').click();
  await page.locator('h1').click();
  await expect(page.locator('#language-toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('only deployment files are served', async ({ request }) => {
  for (const asset of ['/', '/script.js', '/styles.css', '/favicon.svg', '/sitthefuckdown-qr.png', '/sitthefuckdown-qr.svg', '/splashback-600.webp', '/splashback-1200.webp', '/ro/', '/ru/', '/hu/']) {
    expect((await request.get(asset)).status()).toBe(200);
  }
  const favicon = await request.get('/favicon.svg');
  expect(favicon.headers()['content-type']).toContain('image/svg+xml');
  expect(await favicon.text()).toContain('🚽');
  expect((await request.get('/splashback-1200.webp')).headers()['content-type']).toBe('image/webp');
  for (const privatePath of ['/.git/config', '/README.MD', '/package.json', '/tests/site.spec.js', '/config/site.json', '/docs/domain.md']) {
    expect((await request.get(privatePath)).status()).toBe(404);
  }
});

test('preview rejects links to files outside public', async ({ request }) => {
  const temporaryRoot = resolve(fileURLToPath(new URL('../.playwright-tmp/', import.meta.url)));
  const publicRoot = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
  await mkdir(temporaryRoot, { recursive: true });
  const privateDirectory = await mkdtemp(join(temporaryRoot, 'serve-boundary-'));
  const publicLink = join(publicRoot, basename(privateDirectory));
  let linkCreated = false;
  try {
    await writeFile(join(privateDirectory, 'private.txt'), 'Not a deployment asset');
    await symlink(privateDirectory, publicLink, process.platform === 'win32' ? 'junction' : 'dir');
    linkCreated = true;
    expect((await request.get(`/${basename(publicLink)}/private.txt`)).status()).toBe(403);
  } finally {
    if (linkCreated) {
      expect(resolve(publicLink).startsWith(`${publicRoot}${sep}`)).toBe(true);
      if (process.platform === 'win32') await rmdir(publicLink);
      else await unlink(publicLink);
    }
    expect(resolve(privateDirectory).startsWith(`${temporaryRoot}${sep}`)).toBe(true);
    await rm(privateDirectory, { recursive: true, force: true });
  }
});

test('all languages keep the header centered and usable across screen widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 800, 801]) {
    await page.setViewportSize({ width, height: 720 });
    for (const lang of Object.keys(languages)) {
      await page.goto(`/?lang=${lang}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      for (const selector of ['h1', '.hero-top', '.qr-card', '#pledge']) {
        const box = await page.locator(selector).boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      }
      const badge = await page.locator('.badge').boundingBox();
      const toilet = await page.locator('.toilet').boundingBox();
      const toggle = await page.locator('#language-toggle').boundingBox();
      expect(Math.abs(badge.x + badge.width / 2 - width / 2)).toBeLessThan(1);
      expect(Math.abs(toilet.x + toilet.width / 2 - width / 2)).toBeLessThan(1);
      expect(Math.abs(badge.y + badge.height / 2 - toggle.y - toggle.height / 2)).toBeLessThan(1);
      expect(toggle.x - badge.x - badge.width).toBeGreaterThanOrEqual(8);
      await page.locator('#language-toggle').click();
      await expect(page.locator('#language-options')).toBeVisible();
      const menu = await page.locator('#language-options').boundingBox();
      expect(menu.x).toBeGreaterThanOrEqual(0);
      expect(menu.x + menu.width).toBeLessThanOrEqual(width + 1);
    }
  }
});

test('works under a project-site subpath', async ({ page }) => {
  await page.route('**/sitthefuckdown/**', async route => {
    const url = new URL(route.request().url());
    url.pathname = url.pathname.replace(/^\/sitthefuckdown\//, '/');
    const response = await route.fetch({ url: url.href });
    await route.fulfill({ response });
  });
  const failures = [];
  page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
  await page.goto('/sitthefuckdown/?lang=hu');
  await expect(page.locator('#pledge')).toHaveText(languages.hu.cta);
  const illustration = page.locator('.last-argument img');
  await illustration.scrollIntoViewIfNeeded();
  await expect.poll(() => illustration.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.qr-frame img')).toBeVisible();
  expect(await page.locator('.qr-frame img').evaluate(image => image.naturalWidth > 0)).toBe(true);
  expect(await page.locator('link[rel="icon"]').evaluate(async link => {
    const image = new Image();
    image.src = link.href;
    await image.decode();
    return image.naturalWidth > 0 && image.naturalHeight > 0;
  })).toBe(true);
  expect(failures).toEqual([]);
});
