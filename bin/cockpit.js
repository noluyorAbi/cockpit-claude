#!/usr/bin/env node
// cockpit-claude installer.
//
//   npx cockpit-claude            install + wire up settings.json
//   npx cockpit-claude --dry-run  print what would change, touch nothing
//   npx cockpit-claude --uninstall  remove the statusLine entry, keep the backup
//   npx cockpit-claude --preview   render a sample panel with fake data
//
// Every write to settings.json is preceded by a timestamped backup, and the
// existing statusLine value (if any) is reported before it is replaced.

const fs = require("fs");
const path = require("path");
const os = require("os");

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const DRY = has("--dry-run") || has("-n");
const UNINSTALL = has("--uninstall");
const PREVIEW = has("--preview");

const c = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m",
  cyan: "\x1b[36m", gold: "\x1b[38;5;220m",
};

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
const settingsPath = path.join(claudeDir, "settings.json");
const targetDir = path.join(claudeDir, "cockpit");
const targetFile = path.join(targetDir, "statusline.js");
const sourceFile = path.join(__dirname, "..", "src", "statusline.js");
const configPath = path.join(claudeDir, "cockpit.config.json");
const exampleConfig = path.join(__dirname, "..", "cockpit.config.example.json");

function say(msg) { process.stdout.write(msg + "\n"); }
function step(msg) { say(`${c.green}✓${c.reset} ${msg}`); }
function warn(msg) { say(`${c.yellow}!${c.reset} ${msg}`); }
function fail(msg) { say(`${c.red}✗${c.reset} ${msg}`); process.exitCode = 1; }

function banner() {
  say("");
  say(`  ${c.bold}${c.gold}cockpit${c.reset}${c.dim} · claude${c.reset}`);
  say(`  ${c.dim}four-line instrument panel for a Claude Code session${c.reset}`);
  say("");
}

// --- preview -----------------------------------------------------------------

function preview() {
  const { render, loadConfig } = require(sourceFile);
  const now = Math.floor(Date.now() / 1000);
  const sample = {
    model: { display_name: "Opus 5 (1M)" },
    session_id: "preview",
    cwd: path.join(os.homedir(), "repos", "cockpit-claude"),
    output_style: { name: "default" },
    effort: { level: "high" },
    cost: {
      total_cost_usd: 4.82,
      total_lines_added: 318,
      total_lines_removed: 74,
      total_duration_ms: 42 * 60 * 1000,
    },
    context_window: {
      remaining_percentage: 46,
      input_tokens: 128_400,
      output_tokens: 22_900,
      cached_input_tokens: 1_940_000,
    },
    rate_limits: {
      five_hour: { used_percentage: 62, resets_at: now + 2 * 3600 + 900 },
      seven_day: { used_percentage: 31, resets_at: now + 2 * 86400 + 14 * 3600 },
    },
  };
  say("");
  say(render(sample, loadConfig(claudeDir), claudeDir));
  say("");
  say(`${c.dim}  (sample data; your real panel adapts to the live session)${c.reset}`);
  say("");
}

// --- settings.json -----------------------------------------------------------

function readSettings() {
  if (!fs.existsSync(settingsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch (e) {
    fail(`could not parse ${settingsPath}: ${e.message}`);
    fail("fix or move that file, then re-run. Nothing was changed.");
    process.exit(1);
  }
}

function backupSettings() {
  if (!fs.existsSync(settingsPath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const bak = `${settingsPath}.bak-cockpit-${stamp}`;
  if (!DRY) fs.copyFileSync(settingsPath, bak);
  return bak;
}

function install() {
  banner();

  if (!fs.existsSync(sourceFile)) return fail(`missing source: ${sourceFile}`);

  const settings = readSettings();
  const existing = settings.statusLine;
  const command = `node "${targetFile}"`;

  if (existing && existing.command === command) {
    step("already installed and wired up");
  } else if (existing) {
    warn("replacing an existing statusLine:");
    say(`    ${c.dim}${JSON.stringify(existing)}${c.reset}`);
  }

  if (DRY) {
    say("");
    say(`${c.bold}dry run, nothing written${c.reset}`);
    say(`  copy    ${sourceFile}`);
    say(`       -> ${targetFile}`);
    say(`  config  ${configPath}${fs.existsSync(configPath) ? c.dim + " (exists, kept)" + c.reset : ""}`);
    say(`  set     statusLine.command = ${command}`);
    say(`  backup  ${settingsPath}.bak-cockpit-<timestamp>`);
    say("");
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(sourceFile, targetFile);
  step(`installed statusline -> ${targetFile}`);

  if (!fs.existsSync(configPath) && fs.existsSync(exampleConfig)) {
    fs.copyFileSync(exampleConfig, configPath);
    step(`wrote default config -> ${configPath}`);
  } else if (fs.existsSync(configPath)) {
    step(`kept your existing config at ${configPath}`);
  }

  const bak = backupSettings();
  if (bak) step(`backed up settings -> ${path.basename(bak)}`);

  settings.statusLine = { type: "command", command };
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  step("wired statusLine into settings.json");

  say("");
  preview();
  say(`  ${c.cyan}restart Claude Code${c.reset} ${c.dim}(or start a new session) to see it live${c.reset}`);
  say(`  ${c.dim}customise:${c.reset} ${configPath}`);
  say("");
}

function uninstall() {
  banner();
  const settings = readSettings();
  const command = `node "${targetFile}"`;

  if (!settings.statusLine) {
    warn("no statusLine entry in settings.json, nothing to remove");
  } else if (settings.statusLine.command !== command) {
    warn("settings.json points at a different statusline; leaving it alone:");
    say(`    ${c.dim}${JSON.stringify(settings.statusLine)}${c.reset}`);
    return;
  }

  if (DRY) {
    say(`${c.bold}dry run${c.reset} would remove statusLine and delete ${targetDir}`);
    return;
  }

  const bak = backupSettings();
  if (bak) step(`backed up settings -> ${path.basename(bak)}`);
  delete settings.statusLine;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  step("removed statusLine from settings.json");

  try {
    fs.rmSync(targetDir, { recursive: true, force: true });
    step(`removed ${targetDir}`);
  } catch {}
  say(`  ${c.dim}your config at ${configPath} was left in place${c.reset}`);
  say("");
}

if (has("--help") || has("-h")) {
  banner();
  say("  usage: npx cockpit-claude [options]");
  say("");
  say("    (no flags)     install and wire up settings.json");
  say("    --preview      render a sample panel, change nothing");
  say("    --dry-run, -n  show what would change, change nothing");
  say("    --uninstall    remove the statusLine entry and installed file");
  say("    --help, -h     this");
  say("");
} else if (PREVIEW) {
  preview();
} else if (UNINSTALL) {
  uninstall();
} else {
  install();
}
