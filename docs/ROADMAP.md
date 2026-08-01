# Roadmap

Nothing here is claimed. Nothing here is promised. This is the honest list of
what cockpit cannot do yet, roughly ordered by how much fixing it would help.

If you want one, say so in [Discussions](https://github.com/noluyorAbi/cockpit-claude/discussions)
so two people do not build it twice.

## Worth doing next

### Per-project config
One global `~/.claude/cockpit.config.json` today. A `<repo>/.claude/cockpit.config.json`
overlay, merged on top of the global file, would let a monorepo drop the `git`
segment without changing anything for other repos.

Where: `loadConfig()` in `src/statusline.js`. It already takes a candidate list;
this is one more candidate plus a merge, and the merge function already exists.

### Write its own ledger
`repo Σ$…` reads `<repo>/.claude/costs.csv`, a file some other tool has to
produce. Most people therefore never see the segment. A small append-on-render
writer, guarded behind a config flag so it stays opt-in, would make it work out
of the box.

Care needed: renders are frequent, so this must be an append of one row per
session with an in-place update rather than a rewrite, and it must never make
the statusline slow or throw.

### Configurable segment order
Segments can be turned off but not moved. Replacing the boolean map with an
optional ordered array per line would fix that without touching any reader.

## Ideas

### `cockpit doctor`
A subcommand that prints the payload it actually received, which config file
won, and why a given segment is hiding. Most support questions are one of those
three.

### Burn sparkline
The pool heartbeats already carry `burn_hr`. Keeping the last N would give the
spend a shape rather than a single number.

### ASCII-only glyph mode
`▰ ▱ █ ░ ⌁ ↻ ⚡ Σ ⎇` all assume a capable font. A flag that swaps in plain ASCII
would make cockpit safe over an old SSH session or a bare console.

### A `--json` mode
Everything the panel computes is useful to other tools: the usable-context
figure, the projection, the cap ETA, the pool count. Emitting the same values as
JSON would let people build on it without re-deriving the maths.

## Deliberately not planned

**Acting on your behalf.** cockpit prints `↓ease`. It will not change your
effort level, cancel a request, or throttle anything. A statusline that mutates
your session is a different and much scarier tool.

**Network access.** No update checks, no telemetry, no remote config. The zero
in "zero network calls" is a feature, and it stays at zero.

**A config UI.** The config file is twenty lines and documented. A GUI for it
would be more code than the thing it configures.
