#!/usr/bin/env node
// cockpit-claude: a four-line instrument panel for a Claude Code session.
//
// Line 1  identity   model · effort · output style · cwd · git
// Line 2  resources  context · tokens · session spend · repo lifetime · churn
// Line 3  limits     5h / 7d windows with pace projection · cross-session pool
// Line 4  work       active todo · todo progress
//
// Zero dependencies. Reads only stdin (the payload Claude Code hands the
// statusline command), a couple of local files, and git. Never touches network.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const ESC = "\x1b[";
const C = {
  reset: `${ESC}0m`,
  dim: `${ESC}2m`,
  bold: `${ESC}1m`,
  red: `${ESC}31m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  cyan: `${ESC}36m`,
  magenta: `${ESC}35m`,
  orange: `${ESC}38;5;208m`,
  pink: `${ESC}38;5;213m`,
  brightCyan: `${ESC}1;96m`,
  brightYellow: `${ESC}1;93m`,
  gray: `${ESC}38;5;245m`,
  gold: `${ESC}38;5;220m`,
  blink: `${ESC}5m`,
};

function safe(fn, fallback = "") {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
// Every segment is on by default. A config file only ever turns things OFF or
// retunes a number, so a missing/corrupt file degrades to the full panel rather
// than to a blank line.

const DEFAULTS = {
  segments: {
    model: true,
    effort: true,
    style: true,
    cwd: true,
    git: true,
    context: true,
    tokens: true,
    cost: true,
    burn: true,
    ledger: true,
    churn: true,
    limits: true,
    pool: true,
    todos: true,
    updateNudge: true,
  },
  context: { autoCompactBuffer: 16.5, width: 10 },
  limits: { width: 8, projection: true },
  pool: { staleSeconds: 600, activeSeconds: 90, minSessions: 2 },
  colors: {},
};

function deepMerge(base, over) {
  if (!over || typeof over !== "object") return base;
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const k of Object.keys(over)) {
    const v = over[k];
    if (v && typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object") {
      out[k] = deepMerge(out[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function loadConfig(claudeDir) {
  return safe(() => {
    const candidates = [
      process.env.COCKPIT_CONFIG,
      path.join(claudeDir, "cockpit.config.json"),
    ].filter(Boolean);
    for (const p of candidates) {
      if (!fs.existsSync(p)) continue;
      return deepMerge(DEFAULTS, JSON.parse(fs.readFileSync(p, "utf8")));
    }
    return DEFAULTS;
  }, DEFAULTS);
}

// A user-supplied color name resolves against the palette; anything unknown
// falls back to the built-in choice rather than emitting a broken escape.
function col(cfg, key, fallback) {
  const name = cfg.colors && cfg.colors[key];
  return (name && C[name]) || fallback;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtNum(n) {
  if (n == null) return "?";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function fmtUSD(n) {
  if (n == null) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function fmtDur(secs) {
  if (secs == null) return "";
  if (secs <= 0) return "now";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d${h % 24}h`;
  if (h > 0) return `${h}h${m}m`;
  if (m > 0) return `${m}m`;
  return "<1m";
}

function fmtEta(epoch) {
  if (epoch == null) return "";
  return fmtDur(epoch - Math.floor(Date.now() / 1000));
}

// Compact spend-rate: $/hr with sane precision.
function fmtRate(n) {
  if (n == null) return "";
  if (n >= 10) return `$${Math.round(n)}`;
  if (n >= 1) return `$${n.toFixed(1)}`;
  return `$${n.toFixed(2)}`;
}

// Compact active-time: 42m, 3h20m, 18h, 240h. Hours-first; minutes only under 10h.
function fmtDurC(sec) {
  if (!sec || sec <= 0) return null;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), mm = m % 60;
  return h < 10 ? `${h}h${mm}m` : `${h}h`;
}

// Repo LIFETIME cost: cents are noise at this scale. Whole dollars with a
// thousands separator ($1,099), one decimal under $10, $12.3k past five figures.
function fmtRepoUSD(n) {
  if (n == null) return "$0";
  if (n >= 10000) return `$${(n / 1000).toFixed(1)}k`;
  if (n >= 10) return `$${Math.round(n).toLocaleString("en-US")}`;
  return `$${n.toFixed(1)}`;
}

// Anti-jitter: pad a PLAIN (un-colored) string to a fixed width so a segment
// keeps constant width as its value grows, and downstream segments never shift.
// padEnd keeps the value left-aligned in a reserved field (no odd leading gap).
function fixW(plain, n) {
  plain = String(plain);
  return plain.length >= n ? plain : plain + " ".repeat(n - plain.length);
}
// Right-align variant for pure numbers (decimal points line up).
function fixWR(plain, n) {
  plain = String(plain);
  return plain.length >= n ? plain : " ".repeat(n - plain.length) + plain;
}

// ---------------------------------------------------------------------------
// Repo lifetime ledger
// ---------------------------------------------------------------------------

// Walk up for a .git entry (file for worktrees, dir otherwise); no subprocess.
function findRepoRoot(cwd) {
  return safe(() => {
    let dir = path.resolve(cwd);
    for (let i = 0; i < 64; i++) {
      if (fs.existsSync(path.join(dir, ".git"))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return cwd;
  }, cwd);
}

function parseCsvLine(line) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

// Sum this repo's lifetime equivalent cost from <repo>/.claude/costs.csv.
// Returns {total, sessions, activeSec} or null. Fast: one small CSV read,
// header-indexed so it survives schema growth and reads the legacy cost_usd
// column too.
function projectLedger(cwd) {
  return safe(() => {
    const root = findRepoRoot(cwd);
    const csv = path.join(root, ".claude", "costs.csv");
    const txt = fs.readFileSync(csv, "utf8");
    let header = null, total = 0, activeSec = 0;
    const sessions = new Set();
    for (const line of txt.split("\n")) {
      if (!line.trim()) continue;
      const c = parseCsvLine(line);
      if (c[0] === "session_id") { header = c; continue; }
      if (!header) continue;
      let ci = header.indexOf("equiv_api_cost_usd");
      if (ci < 0) ci = header.indexOf("cost_usd");
      const v = parseFloat(c[ci]);
      if (!isNaN(v)) total += v;
      const ai = header.indexOf("active_seconds");
      if (ai >= 0) { const a = parseFloat(c[ai]); if (!isNaN(a)) activeSec += a; }
      if (c[0]) sessions.add(c[0]);
    }
    if (total <= 0) return null;
    return { total, sessions: sessions.size, activeSec };
  }, null);
}

// ---------------------------------------------------------------------------
// Rate limits + cross-session pool
// ---------------------------------------------------------------------------

function limitColor(pct) {
  if (pct < 50) return C.green;
  if (pct < 75) return C.yellow;
  if (pct < 90) return C.orange;
  return C.red;
}

// Cross-session pool: how many sessions are actively burning the SHARED 5h limit
// right now, and their combined spend rate. Each session heartbeats a file in
// tmpdir; we read the fleet, GC stale files, count only currently-active ones,
// dedupe by session_id. Returns {n, burn} or null when alone.
// This is the one thing a single window cannot see: the rate limits track the
// whole account, but each statusline otherwise shows only its own slice.
function poolReadout(cfg) {
  return safe(() => {
    const dir = path.join(os.tmpdir(), "claude-pool");
    const now = Math.floor(Date.now() / 1000);
    let names;
    try { names = fs.readdirSync(dir); } catch { return null; }
    const bySess = new Map();
    for (const n of names) {
      if (n.indexOf("claude-ctx-") !== 0 || !n.endsWith(".json")) continue;
      const fp = path.join(dir, n);
      let o;
      try { o = JSON.parse(fs.readFileSync(fp, "utf8")); } catch { continue; }
      const age = now - (o.timestamp || 0);
      if (age > cfg.pool.staleSeconds) { try { fs.unlinkSync(fp); } catch {} continue; }
      if (age > cfg.pool.activeSeconds || !o.session_id) continue;
      const e = bySess.get(o.session_id);
      if (!e || (o.timestamp || 0) > (e.timestamp || 0)) bySess.set(o.session_id, o);
    }
    const all = [...bySess.values()];
    if (all.length < cfg.pool.minSessions) return null; // alone: nothing to surface
    let burn = 0, haveBurn = false;
    for (const o of all) if (typeof o.burn_hr === "number") { burn += o.burn_hr; haveBurn = true; }
    return { n: all.length, burn: haveBurn ? burn : null };
  }, null);
}

function poolColor(n) {
  if (n < 3) return C.green;
  if (n < 6) return C.yellow;
  if (n < 9) return C.orange;
  return C.red;
}

// Linear-pace projection for a usage window.
// Returns {proj, capEtaSecs} or null when too early/idle to trust.
function projectLimit(win, windowSecs) {
  if (!win || win.used_percentage == null || win.resets_at == null) return null;
  const now = Math.floor(Date.now() / 1000);
  const remaining = win.resets_at - now;
  if (remaining <= 0) return null;
  const elapsed = windowSecs - remaining;
  if (elapsed <= 0) return null;
  const used = win.used_percentage;
  if (used <= 0) return { proj: 0, capEtaSecs: null };
  const fracElapsed = elapsed / windowSecs;
  if (fracElapsed < 0.05) return null; // too early, pace unstable
  const proj = used / fracElapsed; // projected end-of-window %
  let capEtaSecs = null;
  if (proj > 100) {
    const pace = used / elapsed; // % per second
    const secsToCap = (100 - used) / pace;
    if (secsToCap < remaining) capEtaSecs = secsToCap;
  }
  return { proj: Math.round(proj), capEtaSecs };
}

// One rate-limit cell: label + mini bar + pct + reset clock + pace projection.
function limitCell(cfg, label, win, windowSecs) {
  if (!win || win.used_percentage == null) return "";
  const width = cfg.limits.width;
  const pct = Math.round(win.used_percentage);
  const filled = Math.min(width, Math.round((pct / 100) * width));
  const bar = "▰".repeat(filled) + "▱".repeat(width - filled);
  const c = limitColor(pct);
  const eta = fmtEta(win.resets_at);
  const reset = eta ? ` ${C.dim}↻${eta}${C.reset}` : "";

  let proj = "";
  const p = cfg.limits.projection ? projectLimit(win, windowSecs) : null;
  if (p) {
    if (p.capEtaSecs != null) {
      proj = ` ${C.bold}${C.red}⚡cap~${fmtDur(p.capEtaSecs)}${C.reset}`;
    } else if (p.proj > 0) {
      proj = ` ${limitColor(Math.min(p.proj, 100))}→${p.proj}%${C.reset}`;
    }
  }

  return (
    `${C.bold}${C.gray}${label}${C.reset} ` +
    `${c}${bar}${C.reset} ` +
    `${c}${String(pct).padStart(2)}%${C.reset}` +
    reset +
    proj
  );
}

// ---------------------------------------------------------------------------
// Git + context
// ---------------------------------------------------------------------------

function gitInfo(cwd) {
  return safe(() => {
    const opts = { cwd, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" };
    const branch = execSync("git rev-parse --abbrev-ref HEAD", opts).trim();
    let status = "";
    try {
      const dirty = execSync("git status --porcelain", opts).trim();
      if (dirty) {
        const lines = dirty.split("\n");
        const mod = lines.filter((l) => l.match(/^[ MARC]M/)).length;
        const add = lines.filter((l) => l.startsWith("A") || l.startsWith("??")).length;
        const del = lines.filter((l) => l.match(/^[ MARC]D/)).length;
        const parts = [];
        if (mod) parts.push(`~${mod}`);
        if (add) parts.push(`+${add}`);
        if (del) parts.push(`-${del}`);
        status = ` ${C.yellow}[${parts.join(" ")}]${C.reset}`;
      } else {
        status = ` ${C.green}✓${C.reset}`;
      }
    } catch {}
    let upstream = "";
    try {
      const ahead = execSync("git rev-list --count @{u}..HEAD", opts).trim();
      const behind = execSync("git rev-list --count HEAD..@{u}", opts).trim();
      const a = parseInt(ahead, 10);
      const b = parseInt(behind, 10);
      if (a > 0) upstream += ` ${C.cyan}↑${a}${C.reset}`;
      if (b > 0) upstream += ` ${C.magenta}↓${b}${C.reset}`;
    } catch {}
    return ` ${C.cyan}⎇ ${branch}${C.reset}${status}${upstream}`;
  });
}

function ctxBar(cfg, usedPct) {
  const width = cfg.context.width;
  const filled = Math.floor((usedPct / 100) * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  let color;
  if (usedPct < 50) color = C.green;
  else if (usedPct < 65) color = C.yellow;
  else if (usedPct < 80) color = C.orange;
  else color = C.blink + C.red;
  return `${color}${bar} ${fixWR(usedPct, 3)}%${C.reset}`;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function render(data, cfg, claudeDir) {
  const S = cfg.segments;

  const model = data.model?.display_name || data.model?.id || "Claude";
  const session = data.session_id || "";
  const cwd = data.workspace?.current_dir || data.cwd || process.cwd();
  const outputStyle = data.output_style?.name || "default";

  const cost = data.cost || {};
  const totalCost = cost.total_cost_usd;
  const linesAdd = cost.total_lines_added;
  const linesRm = cost.total_lines_removed;
  const durMs = cost.total_duration_ms;
  // Spend rate $/hr, skipped on tiny durations (noisy).
  let burnHr = null;
  if (totalCost != null && durMs && durMs > 30000) {
    burnHr = totalCost / (durMs / 3600000);
  }

  const ctx = data.context_window || {};
  const remaining = ctx.remaining_percentage;
  const inTok = ctx.input_tokens;
  const outTok = ctx.output_tokens;
  const cachedTok = ctx.cached_input_tokens;
  const exceeds200k = data.exceeds_200k_tokens;
  const rl = data.rate_limits || {};
  const effort = data.effort?.level || null;

  // 5h-window danger, drives the effort "cockpit" nudge. Hooks cannot read
  // rate limits or change effort, so the statusline is the only place that can
  // tell you WHEN and HOW to ease off: "danger" once linear pace projects to hit
  // the cap before reset, "warn" past 85% used.
  let fiveHot = null;
  const fiveProj = projectLimit(rl.five_hour, 5 * 3600);
  if (fiveProj && fiveProj.capEtaSecs != null) fiveHot = "danger";
  else if (rl.five_hour && rl.five_hour.used_percentage >= 85) fiveHot = "warn";

  // The context bar reports USABLE context, not raw. Auto-compact fires with a
  // buffer still on the clock, so raw "82% remaining" is a lie about how much
  // room you actually have left before the conversation is compacted.
  const buffer = cfg.context.autoCompactBuffer;
  let usedPct = 0;
  if (remaining != null) {
    const usableRemaining = Math.max(0, ((remaining - buffer) / (100 - buffer)) * 100);
    usedPct = Math.max(0, Math.min(100, Math.round(100 - usableRemaining)));
  }

  // Heartbeat for the cross-session pool readout: every live session drops one
  // file in a DEDICATED tmp subdir (not tmpdir root, which on macOS holds
  // thousands of entries) so the fleet scan stays O(sessions).
  if (session && S.pool) {
    try {
      const poolDir = path.join(os.tmpdir(), "claude-pool");
      try { fs.mkdirSync(poolDir, { recursive: true }); } catch {}
      fs.writeFileSync(
        path.join(poolDir, `claude-ctx-${session}.json`),
        JSON.stringify({
          session_id: session,
          remaining_percentage: remaining != null ? remaining : null,
          used_pct: usedPct,
          burn_hr: burnHr,
          five_pct: rl.five_hour && rl.five_hour.used_percentage != null
            ? Math.round(rl.five_hour.used_percentage) : null,
          project: safe(() => path.basename(findRepoRoot(cwd)), ""),
          timestamp: Math.floor(Date.now() / 1000),
        }),
      );
    } catch {}
  }

  // Active todo from the most recently touched agent todo file for this session.
  let task = "";
  let totalTodos = 0;
  let doneTodos = 0;
  const todosDir = path.join(claudeDir, "todos");
  if (S.todos && session && fs.existsSync(todosDir)) {
    try {
      const files = fs
        .readdirSync(todosDir)
        .filter((f) => f.startsWith(session) && f.includes("-agent-") && f.endsWith(".json"))
        .map((f) => ({ name: f, mtime: fs.statSync(path.join(todosDir, f)).mtime }))
        .sort((a, b) => b.mtime - a.mtime);
      if (files.length > 0) {
        const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), "utf8"));
        totalTodos = todos.length;
        doneTodos = todos.filter((t) => t.status === "completed").length;
        const inProgress = todos.find((t) => t.status === "in_progress");
        if (inProgress) task = inProgress.activeForm || inProgress.content || "";
      }
    } catch {}
  }

  let gsdUpdate = "";
  if (S.updateNudge) {
    const cacheFile = path.join(claudeDir, "cache", "gsd-update-check.json");
    if (fs.existsSync(cacheFile)) {
      try {
        const cache = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
        if (cache.update_available) gsdUpdate = `${C.brightYellow}⬆ /gsd:update${C.reset} │ `;
      } catch {}
    }
  }

  const home = os.homedir();
  const cwdHome = cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd;

  // --- Line 1: identity -----------------------------------------------------
  // The effort badge sits on the model so the level you juggle is always
  // visible. When the 5h window runs hot it escalates to an actionable nudge,
  // since nothing can auto-downshift effort for you.
  let effortBadge = "";
  if (S.effort && effort) {
    if (fiveHot === "danger") effortBadge = ` ${C.bold}${C.red}·${effort} ↓ease${C.reset}`;
    else if (fiveHot === "warn") effortBadge = ` ${C.orange}·${effort}${C.reset}`;
    else effortBadge = ` ${C.dim}·${C.gray}${effort}${C.reset}`;
  }

  const line1Parts = [];
  if (S.model) line1Parts.push(`${C.bold}${col(cfg, "model", C.magenta)}${model}${C.reset}${effortBadge}`);
  if (S.style) line1Parts.push(`${C.cyan}style:${outputStyle}${C.reset}`);
  let line1 = gsdUpdate + line1Parts.join(` ${C.dim}│${C.reset} `);
  if (S.cwd) {
    if (line1Parts.length) line1 += ` ${C.dim}│${C.reset} `;
    line1 += `${col(cfg, "cwd", C.brightCyan)}▸ ${cwdHome}${C.reset}`;
  }
  if (S.git) line1 += gitInfo(cwd);

  // --- Line 2: resources ----------------------------------------------------
  const line2Parts = [];
  if (S.context) line2Parts.push(`${C.dim}ctx${C.reset} ${ctxBar(cfg, usedPct)}`);
  if (S.tokens && (inTok != null || outTok != null || cachedTok != null)) {
    const tokParts = [];
    if (inTok != null) tokParts.push(`in:${fmtNum(inTok)}`);
    if (outTok != null) tokParts.push(`out:${fmtNum(outTok)}`);
    if (cachedTok != null) tokParts.push(`cache:${fmtNum(cachedTok)}`);
    line2Parts.push(`${C.gray}${tokParts.join(" ")}${C.reset}`);
  }
  if (exceeds200k) line2Parts.push(`${C.red}⚠ >200k${C.reset}`);
  if (S.cost && totalCost != null) {
    // Reserve width on the live $ and burn so the repo segment to their right
    // holds its column as the session spend grows.
    let costSeg = `${C.green}${fixW(fmtUSD(totalCost), 8)}${C.reset}`;
    if (S.burn && burnHr != null) {
      costSeg += `${C.dim}⌁${fixW(fmtRate(burnHr) + "/hr", 8)}${C.reset}`;
    }
    line2Parts.push(costSeg);
  }
  // Repo lifetime, in a clear 3-level hierarchy under a "repo" scope label:
  //   Σ$…    gold  = total equivalent cost (the signature number; Σ = "sum")
  //   time … gray  = total active engagement time in this repo
  //   …×     faint = session count, the "×" marking a tally so it is never read
  //                  as a time unit next to the hours value.
  // Inner "·" separators sit one level below the segment-level "│".
  const ledger = S.ledger ? projectLedger(cwd) : null;
  if (ledger) {
    const sep = `${C.dim} · ${C.reset}`;
    const parts = [`${col(cfg, "ledger", C.gold)}Σ${fmtRepoUSD(ledger.total)}${C.reset}`];
    const t = fmtDurC(ledger.activeSec);
    if (t) parts.push(`${C.dim}time ${C.gray}${t}${C.reset}`);
    if (ledger.sessions > 1) parts.push(`${C.dim}${ledger.sessions}×${C.reset}`);
    line2Parts.push(`${C.dim}repo${C.reset} ${parts.join(sep)}`);
  }
  if (S.churn && (linesAdd != null || linesRm != null)) {
    line2Parts.push(`${C.green}+${linesAdd ?? 0}${C.reset}/${C.red}-${linesRm ?? 0}${C.reset}`);
  }
  const line2 = line2Parts.join(` ${C.dim}│${C.reset} `);

  // --- Line 3: limits + pool ------------------------------------------------
  let limitsLine = "";
  const cells = S.limits
    ? [
        limitCell(cfg, "5h", rl.five_hour, 5 * 3600),
        limitCell(cfg, "7d", rl.seven_day, 7 * 24 * 3600),
      ].filter(Boolean)
    : [];
  const pool = S.pool ? poolReadout(cfg) : null;
  let poolSeg = "";
  if (pool) {
    poolSeg = `${C.dim}pool${C.reset} ${poolColor(pool.n)}${pool.n} live${C.reset}`;
    if (pool.burn != null) poolSeg += ` ${C.dim}⌁Σ${fmtRate(pool.burn)}/hr${C.reset}`;
  }
  if (cells.length) {
    limitsLine = `${C.dim}◷ limits${C.reset}  ${cells.join(`  ${C.dim}│${C.reset}  `)}`;
    if (poolSeg) limitsLine += `  ${C.dim}│${C.reset}  ${poolSeg}`;
  } else if (poolSeg) {
    limitsLine = `${C.dim}◷${C.reset}  ${poolSeg}`;
  }

  // --- Line 4: work ---------------------------------------------------------
  let line4 = "";
  if (task || totalTodos > 0) {
    const parts = [];
    if (task) parts.push(`${C.bold}▶ ${task}${C.reset}`);
    if (totalTodos > 0) parts.push(`${C.dim}todos:${doneTodos}/${totalTodos}${C.reset}`);
    line4 = parts.join(` ${C.dim}│${C.reset} `);
  }

  return [line1, line2, limitsLine, line4].filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

function main() {
  let input = "";
  // Claude Code always closes stdin; the timeout is a belt-and-braces guard so a
  // wedged pipe can never hang the terminal's status render.
  const stdinTimeout = setTimeout(() => process.exit(0), 3000);
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (input += chunk));
  process.stdin.on("end", () => {
    clearTimeout(stdinTimeout);
    let data = {};
    try {
      data = JSON.parse(input);
    } catch {}
    const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
    const cfg = loadConfig(claudeDir);
    // A crash here would blank the statusline on every render, so the whole
    // pipeline is wrapped: worst case you get an empty line, never a stack trace.
    process.stdout.write(safe(() => render(data, cfg, claudeDir), ""));
  });
}

if (require.main === module) main();

module.exports = { render, loadConfig, projectLimit, projectLedger, DEFAULTS, C };
