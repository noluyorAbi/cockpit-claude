# FAQ

### Four lines is a lot of terminal.

It is. Turn segments off in [`cockpit.config.json`](CONFIG.md) until it is the size you
want; with `ledger`, `todos` and `pool` off it collapses to two. The default is
deliberately maximal because a segment you never configured is a segment you never had
to think about.

### Why does my context bar read higher than Claude Code's own number?

Because it is measuring something different. Claude Code reports raw remaining context.
Auto-compact fires while a buffer is still on the clock, so raw remaining overstates
your actual headroom. cockpit subtracts that buffer, which means its 100% is the moment
compaction fires, not the moment the window is literally full. Set
`context.autoCompactBuffer` to `0` if you want the raw number back.

### What is `⚡cap~1h41m`?

Your current pace, extended to the end of the 5-hour window, lands past 100%. That is
the estimated time until you hit the cap. It replaces the `→N%` projection whenever the
projection would exceed 100.

It is a straight linear extrapolation of the pace so far. Stop working and it stops
being true, which is rather the point of showing it.

### Why does the effort badge say `↓ease`?

Because the 5-hour window is projecting past its cap and nothing in Claude Code can
downshift reasoning effort on your behalf. Hooks cannot read rate limits or change
effort, so the statusline is the only place that can tell you when to ease off. It is a
suggestion, not an action: cockpit never changes a setting.

### Does it phone home?

No. Zero dependencies, no network calls of any kind. Rate limits arrive inside the JSON
payload Claude Code already pipes to the statusline command. The only things cockpit
reads from disk are your todo files, an optional per-repo cost CSV, and the pool
heartbeats it writes itself.

### What is the `pool` number, exactly?

Every running cockpit writes a small heartbeat file to `$TMPDIR/claude-pool/`. When a
panel renders, it scans that directory, discards anything older than 90 seconds,
dedupes by session id, and reports the count and the combined burn rate. It hides
itself when you are the only session running.

It counts sessions using cockpit, not every Claude Code session on the machine. A
window with a different statusline is invisible to it.

### Will the heartbeat files pile up?

No. Anything older than ten minutes is deleted by whichever panel next scans the
directory, and they live in the OS temp directory, which is cleared on reboot anyway.
Each file is a few hundred bytes.

### The `repo Σ$…` segment never appears.

It needs `<repo>/.claude/costs.csv`: a CSV with a `session_id` header row and an
`equiv_api_cost_usd` (or legacy `cost_usd`) column. cockpit only reads that file, it
never writes it. Without one, the segment hides.

### It slows my terminal down.

It should not: one small JSON parse, one small CSV read, a directory scan of a folder
holding one file per live session, and three `git` calls. If git is the problem (a very
large repo, or a slow network filesystem), set `"segments": { "git": false }`.

### Does it work on Windows?

Yes. It is plain Node with `path` and `os` doing the platform-specific work. The pool
directory follows `os.tmpdir()`.

### Something broke and my statusline is blank.

That is the failure mode by design: cockpit renders an empty line rather than a stack
trace. To see the actual error, run it against a payload by hand:

```bash
echo '{"model":{"display_name":"Test"}}' | node ~/.claude/cockpit/statusline.js
```

To back out entirely, `npx cockpit-claude --uninstall`, or restore one of the
`settings.json.bak-cockpit-*` files the installer left behind.

### Can I use it with a non-standard Claude config directory?

Yes. `CLAUDE_CONFIG_DIR` is honoured by both the installer and the statusline.

### How is this different from redacted?

[redacted](https://example.invalid/) is a well-made single-line statusline, and if one
line is what you want you should use it. cockpit is the maximal end of the same idea:
it spends four lines to add the pace projection, the repo lifetime ledger, and the
cross-session pool, none of which fit on one line.
