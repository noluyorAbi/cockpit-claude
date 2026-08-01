<p align="center">
  <img src="https://raw.githubusercontent.com/noluyorAbi/cockpit-claude/main/site/assets/banner.png" alt="cockpit · claude: your session, from the flight deck" width="100%">
</p>

<p align="center">
  <a href="https://noluyorabi.github.io/cockpit-claude">Website</a> ·
  <a href="docs/CONFIG.md">Config</a> ·
  <a href="docs/FAQ.md">FAQ</a> ·
  <a href="docs/ROADMAP.md">Roadmap</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="https://github.com/noluyorAbi/cockpit-claude/discussions">Discussions</a> ·
  <a href="https://www.npmjs.com/package/cockpit-claude">npm</a>
</p>

<p align="center">
  <img alt="MIT" src="https://img.shields.io/badge/license-MIT-1c1b16">
  <img alt="zero dependencies" src="https://img.shields.io/badge/dependencies-0-1c1b16">
  <img alt="node 18+" src="https://img.shields.io/badge/node-%3E%3D18-1c1b16">
</p>

---

A four-line instrument panel for a Claude Code session.

```
Opus 5 (1M) ·high │ style:default │ ▸ ~/repos/cockpit-claude ⎇ main [~3 +1] ↑2
ctx ██████░░░░  65% │ in:128.4k out:22.9k cache:1.94M │ $4.82   ⌁$6.9/hr  │ repo Σ$1,284 · time 96h · 37× │ +318/-74
◷ limits  5h ▰▰▰▰▰▱▱▱ 62% ↻2h15m ⚡cap~1h41m  │  7d ▰▰▱▱▱▱▱▱ 31% ↻2d14h →49%  │  pool 5 live ⌁Σ$31/hr
▶ Wiring the limit projection │ todos:4/7
```

## Install

```bash
npx cockpit-claude
```

Then restart Claude Code. That is the whole setup.

Want to see what it would do first:

```bash
npx cockpit-claude --dry-run   # prints every change, writes nothing
npx cockpit-claude --preview   # renders a sample panel with fake data
npx cockpit-claude --uninstall # puts things back
```

The installer copies the statusline to `~/.claude/cockpit/statusline.js`, writes a
default `~/.claude/cockpit.config.json` if you do not already have one, and points
`statusLine.command` at it. Your `settings.json` is backed up to a timestamped file
first, and an existing `statusLine` is printed before it is replaced.

## Why four lines

A single line has room for the numbers. It has no room for what they mean next.

**Context you can actually use.** Auto-compact fires while there is still headroom on
the clock, so a raw `82% remaining` overstates how much room you have. cockpit
subtracts the buffer and reports *usable* context. 100% means compaction, not empty.

**Pace, not just position.** `62%` used means nothing without knowing how fast you got
there. cockpit extrapolates your burn against the window and prints where you will
land (`→84%`). If that lands past 100% it prints the clock until you are capped
(`⚡cap~1h41m`) and the effort badge starts saying `↓ease`, because nothing else can
downshift effort for you.

**The sessions you forgot were running.** Rate limits are billed to the account, not
the window. Every cockpit heartbeats to a shared temp directory, so each panel can
report the whole fleet and its combined burn rate (`pool 5 live ⌁Σ$31/hr`). No single
window can work that number out on its own.

## What it shows

| Line | Segment | Reads |
|---|---|---|
| 1 | `model` | Model, plus the reasoning effort badge that escalates to `↓ease` |
| 1 | `style` | Active output style |
| 1 | `cwd` | Home-relative working directory |
| 1 | `git` | Branch, `~`modified `+`added `-`deleted, `↑`ahead `↓`behind |
| 2 | `context` | Usable context bar, green through blinking red |
| 2 | `tokens` | `in` / `out` / `cache` for the session |
| 2 | `cost` | Session spend and the `⌁$/hr` rate it is running at |
| 2 | `ledger` | This repo's lifetime spend, active time, and session count |
| 2 | `churn` | Lines added and removed |
| 3 | `limits` | 5h and 7d windows: used, reset clock, pace projection, cap ETA |
| 3 | `pool` | Sessions currently sharing your limit, and their combined burn |
| 4 | `todos` | The in-progress task and completed-over-total |

Every one of them has an off switch. See [docs/CONFIG.md](docs/CONFIG.md).

## Under the hood

- **One payload in.** Claude Code pipes JSON to the statusline command on every render.
  cockpit reads that, the repo's `.claude/costs.csv` if it exists, and git.
- **No network, ever.** Zero dependencies, zero fetches, zero telemetry. Rate limits
  arrive inside the payload.
- **Fails to blank, not to a stack trace.** Every reader is wrapped. A missing ledger,
  a corrupt config, or a repo with no upstream drops that segment and renders the rest.
- **It does not jitter.** Live numbers sit in fixed-width fields, so `$9.99` rolling to
  `$10.00` does not shove the rest of the line sideways.

## What it costs you

The honest half, so you can decide before installing rather than after.

- **Four lines is real estate.** On a 24-row terminal that is roughly a sixth of it,
  gone before you type anything. Turning off `ledger`, `todos` and `pool` collapses it
  to two.
- **Four `git` subprocesses per render.** On a huge repo or a network filesystem this
  is the slowest thing it does. `"segments": { "git": false }` is the fix.
- **The 16.5% auto-compact buffer is a constant, not a reading.** If Claude Code
  retunes auto-compact, the context bar is wrong until you retune the config.
- **The projection is naive.** Straight linear extrapolation. Bursty work makes it
  swing, and it only ever answers "if you keep going exactly like this".
- **The pool is a floor, not a total.** It counts sessions running cockpit. A window
  with a different statusline is invisible to it.
- **Config is global.** One file for every repo, and no way to reorder segments.
- **It cannot act.** It says `↓ease`. It will never change your effort level for you.

[docs/ROADMAP.md](docs/ROADMAP.md) tracks which of these are worth fixing and which are
deliberate.

## Contributing

MIT, developed in the open, and small enough to read in one sitting. The whole
statusline is one dependency-free file; adding a segment is a function and a config
key. The one hard rule is that `render()` must never throw, because a throw blanks the
user's statusline on every render rather than printing an error.

Start with [CONTRIBUTING.md](CONTRIBUTING.md), or with anything in
[the roadmap](docs/ROADMAP.md) that is unclaimed. Open-ended ideas and arguments about
the defaults belong in
[Discussions](https://github.com/noluyorAbi/cockpit-claude/discussions), which is also
what the comment thread on the website reads from.

## Showcase

Built something on top of this? A fork, an extra segment, a terminal theme, a port, a
tool that reads the same numbers: open a
[showcase issue](https://github.com/noluyorAbi/cockpit-claude/issues/new?template=showcase.yml)
and it goes on [the website](https://noluyorabi.github.io/cockpit-claude/#community). You do not need to
have contributed here first.

## The repo ledger segment

`repo Σ$1,284 · time 96h · 37×` reads `<repo>/.claude/costs.csv`, a per-repo CSV with a
`session_id` header row and an `equiv_api_cost_usd` (or legacy `cost_usd`) column.
cockpit only reads it; writing it is someone else's job. No file, no segment.

## Development

```bash
npm run preview            # render a sample panel
npm test                   # render fixtures, assert the panel survives bad input
./scripts/build-banner.sh  # re-render site/assets/banner.png from scripts/banner.html
```

The site in `site/` is static: plain HTML, one stylesheet, one script, no build step.
Its hero panel is a simulation running the same `projectLimit` maths as the real
statusline, so if you change that function, change the ported copy in `site/main.js`
too.

## License

MIT

Made by [Alperen Adatepe](https://adatepe.dev), a full-stack engineer in Munich.
More at [adatepe.dev](https://adatepe.dev).
