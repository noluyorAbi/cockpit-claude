# Security Policy

## Reporting a vulnerability

Use GitHub's private reporting:
[**Report a vulnerability**](https://github.com/noluyorAbi/cockpit-claude/security/advisories/new).

That channel is private until an advisory is published. Do not open a public issue
for a security problem.

If you would rather email, use `alperen@adatepe.dev`.

Expect an acknowledgement within a few days. This is a single-maintainer project, so
please allow reasonable time before disclosing publicly.

## Threat model

Knowing what cockpit does and does not touch will tell you quickly whether something
is in scope.

cockpit is a statusline. Claude Code runs it as a subprocess on every render and pipes
it a JSON payload. In that process cockpit:

- **reads** the payload from stdin,
- **reads** `~/.claude/cockpit.config.json`, the todo files under `~/.claude/todos/`,
  and `<repo>/.claude/costs.csv` when it exists,
- **writes** one small heartbeat file per session to `$TMPDIR/claude-pool/`,
- **runs** four fixed `git` commands in the working directory,
- **writes** its rendered output to stdout.

It has **zero dependencies** and makes **no network calls of any kind**. It does not
read your source files, your conversation, your credentials, or your environment
beyond `CLAUDE_CONFIG_DIR` and `COCKPIT_CONFIG`.

The installer additionally writes to `~/.claude/settings.json` and
`~/.claude/cockpit/`, always taking a timestamped backup of `settings.json` first.

### In scope

- Anything that makes cockpit execute code it was not meant to execute, including
  through a crafted payload, config file, cost CSV, or heartbeat file.
- Anything that leaks the contents of the pool heartbeat files to another user on a
  shared machine, or that lets another local user influence what your panel reports.
- A path traversal or symlink issue in the installer's writes.
- A command injection through the `git` invocations.

### Out of scope

- That the statusline reports your spend on screen. It is a statusline.
- That the pool directory is world-readable if your `$TMPDIR` is. Report the specific
  permission mistake, not the general observation.
- Vulnerabilities in Claude Code itself. Take those to Anthropic.
- Anything requiring an attacker who already has write access to your home directory.
  At that point they can replace the statusline outright.

## Supported versions

The latest release on `main` is the supported version. This project is small enough
that backporting to an older line would be theatre rather than security.
