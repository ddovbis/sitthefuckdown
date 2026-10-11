# Domain and GitHub Pages

This repository's public website uses `https://sitthefuckdown.com/` on GitHub
Pages. The canonical URL and old project-site URL are listed in
[`config/site.json`](../config/site.json).

## DNS records

For the current GitHub Pages configuration, the expected website records are:

The read-only DNS checker uses [`config/pages-dns.json`](../config/pages-dns.json).
Update that file and the table together when the hosting configuration changes.

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| A | `@` | `185.199.108.153` | 600 |
| A | `@` | `185.199.109.153` | 600 |
| A | `@` | `185.199.110.153` | 600 |
| A | `@` | `185.199.111.153` | 600 |
| AAAA | `@` | `2606:50c0:8000::153` | 600 |
| AAAA | `@` | `2606:50c0:8001::153` | 600 |
| AAAA | `@` | `2606:50c0:8002::153` | 600 |
| AAAA | `@` | `2606:50c0:8003::153` | 600 |
| CNAME | `www` | `ddovbis.github.io` | 600 |

Before editing DNS, save the current record set. Replace only records that
conflict with the website records. Preserve mail, SPF, ACME, domain ownership,
and other unrelated records. Do not point a wildcard (`*`) at the website.
GitHub Actions is the Pages source, so this project does not need a `CNAME` file.

## Changing or repairing the domain

1. Complete account-level GitHub domain ownership verification, then configure
   the intended custom domain in the repository's **Settings → Pages** before
   routing DNS to it.
2. Set the website records above at the DNS provider. Keep the ownership TXT
   record GitHub requests for the account and domain.
3. Wait for DNS to resolve, then confirm the apex and `www` records. GitHub's
   certificate issuance can take time after DNS changes.
4. If troubleshooting requires removing and re-adding the custom domain in
   Pages, check **Enforce HTTPS** again afterward; GitHub may clear the setting.
5. Set the intended canonical URL in `config/site.json`, regenerate the QR
   assets with `npm run qr`, and update site links or redirect expectations.
   Previously printed QR codes retain their encoded URL.
6. Run `npm ci`, `npm test`, and deploy the reviewed commit. Then verify the
   live host against that release's `public/` directory:

   ```sh
   npm run verify:live -- --expected-dir outputs/release/public --output outputs/live-checks.json
   npm run verify:live -- --dns --expected-dir outputs/release/public
   ```

   Keep generated reports in ignored `outputs/`. The checker is read-only.

If a backend is added later, choose its host before publishing DNS changes. An
`api` subdomain can point to that backend while GitHub Pages continues serving
the static website.

## References

- [GitHub Pages: managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub Pages: troubleshooting custom domains and HTTPS](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages)
