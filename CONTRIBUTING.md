# Contributing

The whole statusline is one file with no dependencies. If you can read
`src/statusline.js` you already know the codebase.

## The one hard rule

**`render()` must never throw.**

A throw here does not produce an error message. It blanks the user's statusline
on every single render, in every session, until they work out which file to
delete. Every reader is therefore wrapped in `safe()`, and every segment is
expected to return nothing rather than fail.

Everything else is negotiable. That is not.

## Getting set up

```bash
git clone https://github.com/noluyorAbi/cockpit-claude
cd cockpit-claude
node scripts/test.js      # no install step, there are no dependencies
node bin/cockpit.js --preview
```

You do not need a running Claude Code session to work on this. Pipe a payload in
by hand:

```bash
echo '{"model":{"display_name":"Test"},"context_window":{"remaining_percentage":40}}' \
  | node src/statusline.js
```

To try your build against a real session without disturbing your current setup,
point `CLAUDE_CONFIG_DIR` at a scratch directory:

```bash
CLAUDE_CONFIG_DIR=/tmp/cockpit-dev node bin/cockpit.js
```

## Adding a segment

1. **Write the reader.** A function that returns its data or `null`. Wrap
   anything that touches the filesystem or a subprocess in `safe()`.
2. **Render it.** Push onto `line1Parts`, `line2Parts`, `cells`, or line four,
   guarded by `S.<yourSegment>`.
3. **Add the switch.** A key in `DEFAULTS.segments`, defaulting to `true` if it
   is genuinely useful to everyone and `false` if it is niche.
4. **Document it.** A row in the `segments` table in `docs/CONFIG.md`, and an
   entry in the `SIGNALS` array in `site/main.js` so it shows up in the
   inspector on the site.
5. **Test the ugly path.** Add a case to `scripts/test.js` with the worst
   payload you can imagine. Missing keys, wrong types, `NaN`, `null`.

### Things that will get a change sent back

- A network call. cockpit makes zero, and that is a promise to its users.
- A dependency. Same reason.
- A segment with no off switch.
- Width that changes as a value grows, without a `fixW`/`fixWR` field around it.
  A live number that shoves the rest of the line sideways is worse than no
  number.
- A colour used decoratively. In the panel, colour means severity. Green is
  fine, red is not, and nothing may say red for style.

## Style

Match the surrounding file. Two-space indent, double quotes, semicolons, and
comments that explain *why* rather than restating the code. The existing
comments are the standard: if a threshold is a judgement call, the comment says
what the judgement was.

Commit messages: conventional prefix, imperative mood, and a body explaining the
reasoning if the change is not obvious.

```
feat: per-project config overlay

A monorepo wants the git segment off without changing every other repo.
loadConfig now takes the repo-local file as the highest-priority candidate
and merges it over the global one.
```

## The site

`site/` is static. No build step, no framework, no bundler. Open
`site/index.html` through any local server and edit.

```bash
python3 -m http.server 8791 --directory site
```

The hero panel is a simulation running the same `projectLimit` maths as the real
statusline. If you change that function in `src/statusline.js`, change the
ported copy in `site/main.js` too, or the site starts lying.

## Showing what you built

Forks, extra segments, terminal themes, ports, tools that read the same numbers:
open a [showcase issue](https://github.com/noluyorAbi/cockpit-claude/issues/new?template=showcase.yml)
and it goes on the site. You do not need permission and you do not need to have
contributed anything here first.

## Licence

MIT. By contributing you agree your work ships under it.
