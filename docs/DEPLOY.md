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

## Social preview

`site/assets/banner.png` is the 1280x640 GitHub social preview. Set it under
**Settings → General → Social preview → Upload an image**. It is also the image
`og:image` points at, and the header of the README.

Re-render it from source rather than editing the PNG:

```bash
./scripts/build-banner.sh
```
