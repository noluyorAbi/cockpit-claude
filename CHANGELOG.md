# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0]

First public release.

### Added

- Four-line statusline for Claude Code, rendered from the JSON payload Claude Code
  pipes to the statusline command.
  - **Line 1** model with an escalating reasoning-effort badge, output style,
    working directory, git branch and working-tree state.
  - **Line 2** usable context bar, token split, session spend with hourly burn rate,
    per-repository lifetime ledger, line churn.
  - **Line 3** 5-hour and 7-day rate-limit windows with a linear pace projection, a
    cap ETA when that projection exceeds the window, and a cross-session pool count.
  - **Line 4** the in-progress todo and completion count.
- Usable-context reporting: the auto-compact buffer is subtracted before the bar is
  drawn, so 100% means compaction rather than a literally full window.
- Cross-session pool: each running instance heartbeats to a shared temp directory, so
  every panel can report how many sessions are burning the same account limit and at
  what combined rate.
- Configuration through `~/.claude/cockpit.config.json`. Every one of the fourteen
  segments has an off switch; a missing or malformed file falls back to the full panel
  rather than to a blank line.
- Installer (`npx cockpit-claude`) with `--dry-run`, `--preview` and `--uninstall`.
  It backs up `settings.json` to a timestamped file before writing, and prints any
  existing `statusLine` entry before replacing it.
- Dependency-free test suite covering malformed payloads, segment toggles, the
  auto-compact arithmetic and the projection edge cases.
- Website at [noluyorabi.github.io/cockpit-claude](https://noluyorabi.github.io/cockpit-claude) with a live simulation of the
  panel running the same projection maths as the statusline itself.

### Security

- Zero dependencies and zero network calls. Rate limits arrive inside the payload
  Claude Code already provides.
- Every reader is wrapped, so a failure drops one segment instead of blanking the
  statusline with a stack trace.

[Unreleased]: https://github.com/noluyorAbi/cockpit-claude/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/noluyorAbi/cockpit-claude/releases/tag/v1.0.0
