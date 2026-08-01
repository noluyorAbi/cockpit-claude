# Configuration

cockpit reads `~/.claude/cockpit.config.json` (or the path in `$COCKPIT_CONFIG`).

Every key is optional and every default is "on". A missing file gives you the full
panel; a corrupt file also gives you the full panel rather than a blank line. Config
can only turn things off or retune a number, never break the render.

```json
{
  "segments": { "ledger": false, "todos": false },
  "context":  { "autoCompactBuffer": 16.5, "width": 10 },
  "limits":   { "width": 8, "projection": true },
  "pool":     { "staleSeconds": 600, "activeSeconds": 90, "minSessions": 2 },
  "colors":   { "ledger": "gold" }
}
```

## `segments`

Set any of these to `false` to drop that piece. Everything defaults to `true`.

| Key | Line | Drops |
|---|---|---|
| `model` | 1 | Model name and the effort badge |
| `effort` | 1 | Just the effort badge, keeping the model |
| `style` | 1 | `style:default` |
| `cwd` | 1 | Working directory |
| `git` | 1 | Branch, dirty counts, ahead/behind |
| `context` | 2 | The usable-context bar |
| `tokens` | 2 | `in` / `out` / `cache` |
| `cost` | 2 | Session spend |
| `burn` | 2 | Just the `⌁$/hr` rate, keeping the spend |
| `ledger` | 2 | Repo lifetime spend, time and session count |
| `churn` | 2 | `+added/-removed` |
| `limits` | 3 | Both rate-limit cells |
| `pool` | 3 | The cross-session readout, **and the heartbeat that feeds it** |
| `todos` | 4 | Active task and todo progress |
| `updateNudge` | 1 | The `⬆ /gsd:update` prefix |

Turning `pool` off also stops this session writing its heartbeat file, so it becomes
invisible to every other cockpit's fleet count. That is deliberate: opting out of the
readout opts you out of the reporting.

## `context`

| Key | Default | Meaning |
|---|---|---|
| `autoCompactBuffer` | `16.5` | Percent of the window auto-compact reserves. Subtracted before the bar is drawn, which is what makes the bar report *usable* context. Set to `0` to see raw remaining instead. |
| `width` | `10` | Bar width in cells. |

If Claude Code changes its auto-compact threshold, this is the one number to retune.

## `limits`

| Key | Default | Meaning |
|---|---|---|
| `width` | `8` | Width of each mini bar. |
| `projection` | `true` | Set `false` to print percentage and reset clock only, with no `→84%` or `⚡cap~`. |

The projection is a straight linear extrapolation: `used / fraction-of-window-elapsed`.
It is deliberately suppressed for the first 5% of a window, where the pace is too
noisy to mean anything.

## `pool`

| Key | Default | Meaning |
|---|---|---|
| `staleSeconds` | `600` | Heartbeat files older than this are deleted on sight. |
| `activeSeconds` | `90` | A session counts as live only if its heartbeat is newer than this. |
| `minSessions` | `2` | Below this count the segment hides entirely. Raise it if a fleet of two is not news to you. |

Heartbeats live in `$TMPDIR/claude-pool/claude-ctx-<session>.json` and hold the session
id, context percentage, burn rate, 5h percentage, project name and a timestamp. They
are garbage-collected by whichever cockpit next scans the directory.

## `colors`

Override the colour of a segment by name. Only `model`, `cwd` and `ledger` are wired
up. Valid names:

`red` `green` `yellow` `cyan` `magenta` `orange` `pink` `brightCyan` `brightYellow`
`gray` `gold`

An unknown name silently falls back to the built-in choice rather than emitting a
broken escape sequence.

Threshold colours (the context bar, the limit bars, the pool count) are intentionally
not configurable. They encode meaning, not taste: green is fine, red is not.

## Installing by hand

If you would rather not run the installer, point `statusLine` at the file yourself:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"/absolute/path/to/cockpit-claude/src/statusline.js\""
  }
}
```

`CLAUDE_CONFIG_DIR` is honoured throughout, so a non-standard Claude config directory
works without further setup.
