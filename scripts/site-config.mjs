import { readFile } from 'node:fs/promises';

const configUrl = new URL('../config/site.json', import.meta.url);
const rawConfig = JSON.parse(await readFile(configUrl, 'utf8'));

function parseWebUrl(value, label) {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a URL string.`);
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new TypeError(`${label} must be an HTTP(S) URL without credentials.`);
  }
  return url;
}

const canonicalUrl = parseWebUrl(rawConfig.url, 'Site URL');
if (canonicalUrl.protocol !== 'https:' || canonicalUrl.search || canonicalUrl.hash || !canonicalUrl.pathname.endsWith('/')) {
  throw new TypeError('Site URL must be an HTTPS URL with a trailing slash and no query or fragment.');
}
if (!Array.isArray(rawConfig.legacyUrls)) throw new TypeError('legacyUrls must be an array of HTTP(S) URLs.');

export const siteConfig = Object.freeze({
  url: canonicalUrl.href,
  legacyUrls: Object.freeze(rawConfig.legacyUrls.map((value, index) =>
    parseWebUrl(value, `Legacy URL ${index + 1}`).href)),
});
