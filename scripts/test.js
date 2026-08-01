#!/usr/bin/env node
// Smoke tests. No framework: the whole point of this project is zero deps.
//
//   node scripts/test.js
//
// The contract being tested is narrow but load-bearing: whatever we are handed,
// render() must return a string and must never throw, because a throw here
// blanks the user's statusline on every single render.

const assert = require("assert");
const path = require("path");
const os = require("os");
const { render, loadConfig, projectLimit, DEFAULTS } = require("../src/statusline.js");

const claudeDir = path.join(os.homedir(), ".claude");
const cfg = DEFAULTS;
let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${e.message}`);
    process.exitCode = 1;
  }
}

const now = Math.floor(Date.now() / 1000);

const full = {
  model: { display_name: "Opus 5 (1M)" },
  session_id: "test-session",
  cwd: "/tmp",
  output_style: { name: "default" },
  effort: { level: "high" },
  cost: { total_cost_usd: 4.82, total_lines_added: 318, total_lines_removed: 74, total_duration_ms: 2.5e6 },
  context_window: { remaining_percentage: 46, input_tokens: 128400, output_tokens: 22900, cached_input_tokens: 1940000 },
  rate_limits: {
    five_hour: { used_percentage: 62, resets_at: now + 8100 },
    seven_day: { used_percentage: 31, resets_at: now + 225000 },
  },
};

console.log("\nrender");

test("renders a full payload", () => {
  const out = render(full, cfg, claudeDir);
  assert.ok(out.includes("Opus 5 (1M)"), "model missing");
  assert.ok(out.includes("ctx"), "context missing");
  assert.ok(out.includes("5h"), "5h limit missing");
  assert.ok(out.split("\n").length >= 3, "expected at least three lines");
});

test("survives an empty payload", () => {
  assert.strictEqual(typeof render({}, cfg, claudeDir), "string");
});

test("survives null-ish and wrong-typed fields", () => {
  const junk = {
    model: null,
    cost: { total_cost_usd: null, total_duration_ms: "nope" },
    context_window: { remaining_percentage: undefined, input_tokens: NaN },
    rate_limits: { five_hour: {}, seven_day: null },
    output_style: 42,
  };
  assert.strictEqual(typeof render(junk, cfg, claudeDir), "string");
});

test("falls back to a default model label", () => {
  assert.ok(render({}, cfg, claudeDir).includes("Claude"));
});

console.log("\nsegments");

test("a disabled segment does not render", () => {
  const off = { ...cfg, segments: { ...cfg.segments, context: false, limits: false } };
  const out = render(full, off, claudeDir);
  assert.ok(!out.includes("ctx "), "context should be gone");
  assert.ok(!out.includes("◷ limits"), "limits should be gone");
  assert.ok(out.includes("Opus 5 (1M)"), "the rest should survive");
});

test("everything off still returns a string", () => {
  const none = Object.fromEntries(Object.keys(cfg.segments).map((k) => [k, false]));
  assert.strictEqual(typeof render(full, { ...cfg, segments: none }, claudeDir), "string");
});

console.log("\ncontext maths");

test("the auto-compact buffer is subtracted", () => {
  // 46% raw remaining, 16.5 reserved => (46-16.5)/83.5 = 35.3% usable => 65% used
  const out = render(full, cfg, claudeDir);
  assert.ok(out.includes("65%"), `expected 65% usable, got: ${out.split("\n")[1]}`);
});

test("a zero buffer reports raw remaining", () => {
  const raw = { ...cfg, context: { ...cfg.context, autoCompactBuffer: 0 } };
  assert.ok(render(full, raw, claudeDir).includes("54%"));
});

console.log("\nprojection");

test("too early in a window means no projection", () => {
  // 1% of the window elapsed: pace is meaningless
  assert.strictEqual(projectLimit({ used_percentage: 4, resets_at: now + 17820 }, 18000), null);
});

test("a sane pace projects an end-of-window figure", () => {
  const p = projectLimit({ used_percentage: 30, resets_at: now + 9000 }, 18000);
  assert.strictEqual(p.proj, 60);
  assert.strictEqual(p.capEtaSecs, null);
});

test("an over-cap pace returns a cap ETA", () => {
  const p = projectLimit({ used_percentage: 80, resets_at: now + 9000 }, 18000);
  assert.ok(p.proj > 100, `expected a projection past 100, got ${p.proj}`);
  assert.ok(p.capEtaSecs > 0 && p.capEtaSecs < 9000, "cap ETA should fall inside the window");
});

test("an expired window projects nothing", () => {
  assert.strictEqual(projectLimit({ used_percentage: 90, resets_at: now - 60 }, 18000), null);
});

console.log("\nconfig");

test("an unreadable config falls back to defaults", () => {
  const prev = process.env.COCKPIT_CONFIG;
  process.env.COCKPIT_CONFIG = path.join(os.tmpdir(), "cockpit-does-not-exist-xyz.json");
  try {
    assert.deepStrictEqual(loadConfig(claudeDir).segments, DEFAULTS.segments);
  } finally {
    if (prev === undefined) delete process.env.COCKPIT_CONFIG;
    else process.env.COCKPIT_CONFIG = prev;
  }
});

console.log(`\n${passed} passed${process.exitCode ? ", with failures" : ""}\n`);
