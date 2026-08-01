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

## The cockpit.js.org domain

The site links and the `og:url` already point at `https://cockpit.js.org`. That domain
does not exist until it is requested, so do these two steps **in order**:

1. Open a PR against [js-org/js.org](https://github.com/js-org/js.org) adding
   `cockpit.js.org` pointed at your Pages target, and wait for it to merge.
2. Only then add `site/CNAME` containing `cockpit.js.org` and push.

Adding the `CNAME` file first is the failure mode worth avoiding: GitHub Pages starts
redirecting to a domain that does not resolve yet, and the site is unreachable at both
addresses until the js.org PR lands. There is deliberately no `CNAME` in this repo for
that reason.

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

`site/assets/banner.png` is the 1280x640 GitHub social preview. Set it under
**Settings → General → Social preview → Upload an image**. It is also the image
`og:image` points at, and the header of the README.

Re-render it from source rather than editing the PNG:

```bash
./scripts/build-banner.sh
```
