# Deploying the site

`site/` is static: HTML, one stylesheet, one script, no build step. Anything that can
serve a folder can host it.

```bash
python3 -m http.server 8791 --directory site   # local preview
```

## GitHub Pages

`.github/workflows/pages.yml` publishes `site/` on every push to `main` that touches
it. Enable it once, under **Settings → Pages → Source → GitHub Actions**.

That gives you `https://<user>.github.io/cockpit-claude/`.

## Moving to a custom domain

Every canonical URL, `og:url`, JSON-LD `@id`, sitemap entry and `llms.txt` link
currently points at `https://noluyorabi.github.io/cockpit-claude`, because that is the
origin that actually serves the page. This matters more than it looks: a canonical
pointing at a domain that does not resolve tells a crawler the real page is somewhere
it cannot fetch, which suppresses indexing of the page that does exist.

So the order is fixed, and it is the reverse of what feels natural:

1. Get the domain working first. For js.org, open a PR against
   [js-org/js.org](https://github.com/js-org/js.org) pointing `cockpit.js.org` at the
   Pages target, and wait for it to merge.
2. Add `site/CNAME` containing the domain and push. Adding it before step 1 makes
   Pages redirect to a domain that does not resolve, taking the site down at both
   addresses. There is deliberately no `CNAME` in this repo yet.
3. Only once the domain serves the page, rewrite the URLs:

```bash
grep -rl "noluyorabi.github.io/cockpit-claude" site/ docs/ *.md package.json .github/ \
  | xargs sed -i '' 's|https://noluyorabi.github.io/cockpit-claude|https://cockpit.js.org|g'
```

Then re-check `site/sitemap.xml`, the `<link rel="canonical">` and the JSON-LD block,
and run `curl -sI <domain>` to confirm it is a 200 rather than a redirect chain.

## Comments (giscus)

The Discussion tab on the site renders GitHub Discussions in place through
[giscus](https://giscus.app). Until it is wired up it shows a card linking to
Discussions instead, so the page is never broken, only unfinished.

Three steps, in this order:

1. **Settings → General → Features → Discussions**, enabled on the repo.
2. Install the [giscus app](https://github.com/apps/giscus) and grant it this repo.
3. Fill in the two IDs. Visit [giscus.app](https://giscus.app), enter
   `noluyorAbi/cockpit-claude`, pick the **Ideas** category, and copy `data-repo-id`
   and `data-category-id` from the snippet it generates into the config block at the
   bottom of `site/index.html`:

```html
<script id="giscus-config" type="application/json">
{
  "repo": "noluyorAbi/cockpit-claude",
  "repoId": "R_kgDO...",
  "category": "Ideas",
  "categoryId": "DIC_kwDO..."
}
</script>
```

Neither ID is a secret; both are public identifiers that appear in every giscus
embed on the web.

The widget loads only when the Discussion tab is first opened, and it follows the
site's theme toggle over `postMessage`.

## Machine-readable files

`site/` also ships `robots.txt`, `sitemap.xml` and `llms.txt`. The last one is a
plain-text summary aimed at answer engines and coding agents: what cockpit is, the
three things that justify four lines, the limitations stated plainly, and links to
every doc. Keep it in sync when the feature set changes, since it is the version an
LLM is most likely to quote.

`robots.txt` explicitly allows the named AI crawlers. That is deliberate for an
open-source tool whose whole documentation is public.

## Social preview

`site/assets/og.png` is the 1280x640 GitHub social preview. Set it under
**Settings → General → Social preview → Upload an image**. It is also what `og:image`
points at. The README header is the wider `site/assets/banner.png` instead.

Re-render it from source rather than editing the PNG. All four assets come from
the Remotion workspace in `video/`, whose only project-specific file is
`src/content.ts`:

```bash
cd video
npm run render:social    # site/assets/og.png,     1280x640, og:image + social preview
npm run render:banner    # site/assets/banner.png, 1584x396, README hero
npm run render:mp4       # site/assets/demo.mp4
npm run render:gif       # site/assets/demo.gif
```
