/* ===========================================================================
   cockpit · claude / site behaviour
   The hero panel is a real simulation, not a video: the same thresholds and
   the same pace projection the installed statusline uses, running on a
   compressed session clock. Watching it long enough shows the whole arc,
   including auto-compact firing and the 5h window going hot.
   =========================================================================== */

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* --- formatters (ported 1:1 from src/statusline.js) ------------------------ */

const fmtNum = (n) =>
  n < 1000 ? String(Math.round(n))
  : n < 1e6 ? `${(n / 1000).toFixed(1)}k`
  : `${(n / 1e6).toFixed(2)}M`;

const fmtUSD = (n) =>
  n < 0.01 ? `$${n.toFixed(4)}` : n < 1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;

const fmtRate = (n) =>
  n >= 10 ? `$${Math.round(n)}` : n >= 1 ? `$${n.toFixed(1)}` : `$${n.toFixed(2)}`;

function fmtDur(secs) {
  if (secs <= 0) return "now";
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d${h % 24}h`;
  if (h > 0) return `${h}h${m}m`;
  if (m > 0) return `${m}m`;
  return "<1m";
}

const fixW  = (s, n) => String(s).padEnd(n, " ");
const fixWR = (s, n) => String(s).padStart(n, " ");

function limitColor(pct) {
  if (pct < 50) return "c-green";
  if (pct < 75) return "c-yellow";
  if (pct < 90) return "c-orange";
  return "c-red";
}

function ctxColor(pct) {
  if (pct < 50) return "c-green";
  if (pct < 65) return "c-yellow";
  if (pct < 80) return "c-orange";
  return "c-red";
}

// Linear-pace projection, identical to the shipped implementation.
function projectLimit(usedPct, remainingSecs, windowSecs) {
  if (remainingSecs <= 0) return null;
  const elapsed = windowSecs - remainingSecs;
  if (elapsed <= 0) return null;
  if (usedPct <= 0) return { proj: 0, capEtaSecs: null };
  const frac = elapsed / windowSecs;
  if (frac < 0.05) return null;
  const proj = usedPct / frac;
  let capEtaSecs = null;
  if (proj > 100) {
    const pace = usedPct / elapsed;
    const secsToCap = (100 - usedPct) / pace;
    if (secsToCap < remainingSecs) capEtaSecs = secsToCap;
  }
  return { proj: Math.round(proj), capEtaSecs };
}

const bar = (pct, width, on, off) => {
  const filled = Math.max(0, Math.min(width, Math.floor((pct / 100) * width)));
  return on.repeat(filled) + off.repeat(width - filled);
};

/* --- tiny DOM helpers ------------------------------------------------------ */

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

// Only touch the DOM when the value actually changed. Keeps the panel from
// thrashing 60 times a second and keeps text selection alive.
function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}
function setCls(node, cls) {
  if (node.className !== cls) node.className = cls;
}

/* --- fit the panel to its container ---------------------------------------- */
/* The panel's whole argument is density, so it must not truncate. Shrink the
   type until the widest line fits, down to a floor where it would stop being
   readable; below that the panel scrolls instead. */

const FIT_MAX = 13.5, FIT_MIN = 8.5, FIT_STEP = 0.25;

function fitPanel(node) {
  let size = FIT_MAX;
  node.style.fontSize = size + "px";
  // scrollWidth reflects the widest pre-formatted line
  let guard = Math.ceil((FIT_MAX - FIT_MIN) / FIT_STEP) + 1;
  while (node.scrollWidth > node.clientWidth + 1 && size > FIT_MIN && guard-- > 0) {
    size -= FIT_STEP;
    node.style.fontSize = size + "px";
  }
}

// Values change width as they grow, so refit on content change as well as on
// resize. rAF-coalesced: many calls in one frame cost one measurement.
function makeFitter(node) {
  let queued = false;
  const run = () => { queued = false; fitPanel(node); };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  };
  if ("ResizeObserver" in window) new ResizeObserver(schedule).observe(node);
  window.addEventListener("resize", schedule, { passive: true });
  // The first measurement can land before the webfont does, and a fallback
  // mono has a different advance width. Remeasure once the real font is in.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  schedule();
  return schedule;
}

/* --- segment catalogue ----------------------------------------------------- */
/* Order matters: it is the order the arrow keys walk. */

const SIGNALS = [
  {
    id: "model", name: "Model + effort",
    sample: "Opus 5 (1M) ·high",
    text: "Which model you are actually on, and the reasoning effort you last set. When the 5-hour window starts projecting past its cap, this badge turns red and adds ↓ease, because nothing else can downshift effort for you.",
  },
  {
    id: "style", name: "Output style",
    sample: "style:default",
    text: "The active output style. Easy to forget you left one on three sessions ago and then wonder why the tone changed.",
  },
  {
    id: "cwd", name: "Working directory",
    sample: "▸ ~/repos/cockpit-claude",
    text: "Home-relative working directory. Across six terminals this is the fastest way to answer \"which one is this\".",
  },
  {
    id: "git", name: "Git state",
    sample: "⎇ main [~3 +1] ↑2",
    text: "Branch, then the working tree: ~modified, +added or untracked, -deleted, or a green ✓ when clean. ↑ and ↓ are commits ahead of and behind upstream.",
  },
  {
    id: "ctx", name: "Usable context",
    sample: "ctx ██████░░░░  65%",
    text: "Not raw context: usable context. Auto-compact fires with a buffer still on the clock, so the buffer is subtracted first. 100% here means compaction, not an empty window. Green under 50, then yellow, orange, and blinking red past 80.",
  },
  {
    id: "tokens", name: "Token split",
    sample: "in:128.4k out:22.9k cache:1.94M",
    text: "Input, output, and cached input for the session. A cache number far above input is the sign that prompt caching is doing its job.",
  },
  {
    id: "cost", name: "Session spend + burn",
    sample: "$4.82   ⌁$6.9/hr",
    text: "What this session has cost, and the rate it is spending at. The rate is the useful half: $6.90/hr tells you what the next hour costs if you keep going exactly like this.",
  },
  {
    id: "ledger", name: "Repo lifetime",
    sample: "repo Σ$1,284 · time 96h · 37×",
    text: "Read from this repo's own cost ledger: everything ever spent here, total active time, and how many sessions it took. Σ is the signature number; the × marks a tally so it never reads as a unit of time.",
  },
  {
    id: "churn", name: "Line churn",
    sample: "+318/-74",
    text: "Lines added and removed this session. A quiet sanity check on whether an hour of spend actually moved any code.",
  },
  {
    id: "limit5", name: "5-hour window",
    sample: "5h ▰▰▰▰▰▱▱▱ 62% ↻2h15m ⚡cap~1h41m",
    text: "Percentage used, time until reset, and where your current pace lands. →84% is a projection of the end of the window. ⚡cap~1h41m replaces it when the projection goes past 100%: that is the clock until you are cut off.",
  },
  {
    id: "limit7", name: "7-day window",
    sample: "7d ▰▰▱▱▱▱▱▱ 31% ↻2d14h →49%",
    text: "The same treatment for the weekly allowance. It moves slowly, which is exactly why a projection is worth more here than a raw number.",
  },
  {
    id: "pool", name: "Cross-session pool",
    sample: "pool 5 live ⌁Σ$31/hr",
    text: "How many Claude Code sessions are burning your shared limit right now, and their combined rate. Every cockpit heartbeats to one temp directory, so each panel can see the fleet. This is the number no single window can work out on its own.",
  },
  {
    id: "task", name: "Active task",
    sample: "▶ Wiring the limit projection",
    text: "The in-progress item from the current todo list, so a long tool run always says what it is in the middle of.",
  },
  {
    id: "todos", name: "Todo progress",
    sample: "todos:4/7",
    text: "Completed over total for the active list. Pairs with the task above: what it is doing, and how much is left.",
  },
];

/* --- panel construction ---------------------------------------------------- */

function buildPanel(root, { interactive = false } = {}) {
  root.textContent = "";
  const refs = {};
  const segs = new Map();

  const line = () => {
    const d = el("div", "pline");
    root.appendChild(d);
    return d;
  };
  const sep = (parent, s = " │ ") => parent.appendChild(el("span", "c-dim", s));
  const seg = (parent, id) => {
    const s = el("span", "seg");
    s.dataset.sig = id;
    if (interactive) s.tabIndex = -1;
    parent.appendChild(s);
    segs.set(id, s);
    return s;
  };
  const part = (parent, cls, text) => parent.appendChild(el("span", cls, text));

  // ── line 1: identity
  const l1 = line();
  const sModel = seg(l1, "model");
  refs.model = part(sModel, "c-magenta bold", "Opus 5 (1M)");
  refs.effort = part(sModel, "c-dim", " ·high");
  sep(l1);
  const sStyle = seg(l1, "style");
  part(sStyle, "c-cyan", "style:default");
  sep(l1);
  const sCwd = seg(l1, "cwd");
  part(sCwd, "c-bcyan", "▸ ~/repos/cockpit-claude");
  part(l1, null, " ");
  const sGit = seg(l1, "git");
  part(sGit, "c-cyan", "⎇ main");
  refs.gitStatus = part(sGit, "c-yellow", " [~3 +1]");
  part(sGit, "c-cyan", " ↑2");

  // ── line 2: resources
  const l2 = line();
  const sCtx = seg(l2, "ctx");
  part(sCtx, "c-dim", "ctx ");
  refs.ctxBar = part(sCtx, "c-green", "");
  sep(l2);
  const sTok = seg(l2, "tokens");
  refs.tokens = part(sTok, "c-gray", "");
  sep(l2);
  const sCost = seg(l2, "cost");
  refs.cost = part(sCost, "c-green", "");
  refs.burn = part(sCost, "c-dim", "");
  sep(l2);
  const sLed = seg(l2, "ledger");
  part(sLed, "c-dim", "repo ");
  refs.ledger = part(sLed, "c-gold", "Σ$1,284");
  part(sLed, "c-dim", " · ");
  part(sLed, "c-dim", "time ");
  part(sLed, "c-gray", "96h");
  part(sLed, "c-dim", " · 37×");
  sep(l2);
  const sChurn = seg(l2, "churn");
  refs.add = part(sChurn, "c-green", "+318");
  part(sChurn, null, "/");
  refs.rm = part(sChurn, "c-red", "-74");

  // ── line 3: limits
  const l3 = line();
  part(l3, "c-dim", "◷ limits  ");
  const s5 = seg(l3, "limit5");
  part(s5, "c-gray bold", "5h ");
  refs.b5 = part(s5, "c-green", "");
  refs.p5 = part(s5, "c-green", "");
  refs.r5 = part(s5, "c-dim", "");
  refs.j5 = part(s5, "c-green", "");
  sep(l3, "  │  ");
  const s7 = seg(l3, "limit7");
  part(s7, "c-gray bold", "7d ");
  refs.b7 = part(s7, "c-green", "");
  refs.p7 = part(s7, "c-green", "");
  refs.r7 = part(s7, "c-dim", "");
  refs.j7 = part(s7, "c-green", "");
  sep(l3, "  │  ");
  const sPool = seg(l3, "pool");
  part(sPool, "c-dim", "pool ");
  refs.pool = part(sPool, "c-green", "");
  refs.poolBurn = part(sPool, "c-dim", "");

  // ── line 4: work
  const l4 = line();
  const sTask = seg(l4, "task");
  refs.task = part(sTask, "bold", "▶ Wiring the limit projection");
  sep(l4);
  const sTodo = seg(l4, "todos");
  refs.todos = part(sTodo, "c-dim", "todos:4/7");

  return { root, refs, segs };
}

/* --- render a state into a panel ------------------------------------------- */

function paint(panel, s) {
  const { refs } = panel;

  // effort badge escalates exactly the way the shipped statusline does
  const p5 = projectLimit(s.five, s.fiveResetIn, 5 * 3600);
  const danger = !!(p5 && p5.capEtaSecs != null);
  const warn = s.five >= 85;
  if (danger) {
    setText(refs.effort, " ·high ↓ease");
    setCls(refs.effort, "c-red bold");
  } else if (warn) {
    setText(refs.effort, " ·high");
    setCls(refs.effort, "c-orange");
  } else {
    setText(refs.effort, " ·high");
    setCls(refs.effort, "c-dim");
  }

  const ctxPct = Math.round(s.ctx);
  setText(refs.ctxBar, `${bar(ctxPct, 10, "█", "░")} ${fixWR(ctxPct, 3)}%`);
  setCls(refs.ctxBar, ctxColor(ctxPct));

  setText(refs.tokens, `in:${fmtNum(s.inTok)} out:${fmtNum(s.outTok)} cache:${fmtNum(s.cache)}`);
  setText(refs.cost, fixW(fmtUSD(s.cost), 8));
  setText(refs.burn, `⌁${fixW(fmtRate(s.burn) + "/hr", 8)}`);
  setText(refs.add, `+${s.add}`);
  setText(refs.rm, `-${s.rm}`);

  // 5h cell
  const c5 = limitColor(s.five);
  setText(refs.b5, bar(s.five, 8, "▰", "▱") + " ");
  setCls(refs.b5, c5);
  setText(refs.p5, `${fixWR(Math.round(s.five), 2)}%`);
  setCls(refs.p5, c5);
  setText(refs.r5, ` ↻${fmtDur(s.fiveResetIn)}`);
  if (danger) {
    setText(refs.j5, ` ⚡cap~${fmtDur(p5.capEtaSecs)}`);
    setCls(refs.j5, "c-red bold");
  } else if (p5 && p5.proj > 0) {
    setText(refs.j5, ` →${p5.proj}%`);
    setCls(refs.j5, limitColor(Math.min(p5.proj, 100)));
  } else {
    setText(refs.j5, "");
  }

  // 7d cell
  const c7 = limitColor(s.seven);
  const p7 = projectLimit(s.seven, s.sevenResetIn, 7 * 86400);
  setText(refs.b7, bar(s.seven, 8, "▰", "▱") + " ");
  setCls(refs.b7, c7);
  setText(refs.p7, `${fixWR(Math.round(s.seven), 2)}%`);
  setCls(refs.p7, c7);
  setText(refs.r7, ` ↻${fmtDur(s.sevenResetIn)}`);
  if (p7 && p7.proj > 0) {
    setText(refs.j7, ` →${p7.proj}%`);
    setCls(refs.j7, limitColor(Math.min(p7.proj, 100)));
  } else {
    setText(refs.j7, "");
  }

  const poolCls = s.pool < 3 ? "c-green" : s.pool < 6 ? "c-yellow" : s.pool < 9 ? "c-orange" : "c-red";
  setText(refs.pool, `${s.pool} live`);
  setCls(refs.pool, poolCls);
  setText(refs.poolBurn, ` ⌁Σ${fmtRate(s.poolBurn)}/hr`);

  setText(refs.task, `▶ ${s.task}`);
  setText(refs.todos, `todos:${s.done}/7`);
  setText(refs.gitStatus, s.dirty ? ` [~${s.dirty} +1]` : " ✓");
  setCls(refs.gitStatus, s.dirty ? "c-yellow" : "c-green");

  return { danger, warn };
}

/* --- the simulation -------------------------------------------------------- */

const LOOP = 58; // seconds of wall clock for one full session arc
const TASKS = [
  "Reading the payload contract",
  "Wiring the limit projection",
  "Chasing a width jitter",
  "Summarising for the handoff",
];

// Everything the panel shows, derived from one normalised clock. Same input,
// same easing: the bar, the percentage, the colour and the projection all move
// as one thing rather than as four independent widgets.
function simulate(p, spike) {
  // context climbs, then auto-compact fires at 0.80 and drops it
  const preCompact = p < 0.8;
  const ctx = preCompact ? 8 + (p / 0.8) * 84 : 14 + ((p - 0.8) / 0.2) * 22;

  const cost = 0.14 + p * 6.3 + spike * 1.7;
  const burn = 3.1 + Math.sin(p * 7.3) * 1.1 + p * 2.4 + spike * 5.5;

  // The 5h window opens two hours in, so the pace projection has real elapsed
  // time to work with from the first frame. Consumption accelerates slightly,
  // which is what tips the projection past the cap near the end of the loop:
  // going hot should be an event you watch happen, not the resting state.
  const five = Math.min(99, 18 + p * 66 + p * p * 14 + spike * 26);
  const fiveResetIn = Math.round(3 * 3600 - p * 9300);
  // The weekly window is already well into its cycle: roughly four and a half
  // days elapsed. Anything else makes the projection arithmetic look absurd,
  // because a tiny elapsed fraction extrapolates to hundreds of percent.
  const seven = 28 + p * 5;
  const sevenResetIn = Math.round((2.6 - p * 0.06) * 86400);

  const poolCurve = [2, 2, 3, 4, 5, 5, 4, 3];
  const pool = poolCurve[Math.floor(p * poolCurve.length)] + (spike ? 2 : 0);

  return {
    ctx,
    inTok: 18_000 + p * 142_000,
    outTok: 2_400 + p * 26_000,
    cache: 180_000 + p * 2_100_000,
    cost,
    burn,
    add: Math.round(24 + p * 402),
    rm: Math.round(4 + p * 96),
    five,
    fiveResetIn,
    seven,
    sevenResetIn,
    pool,
    poolBurn: burn * pool * 0.82,
    task: TASKS[Math.min(TASKS.length - 1, Math.floor(p * TASKS.length))],
    done: Math.min(7, Math.floor(p * 7.4)),
    dirty: Math.max(0, Math.round(1 + p * 8) % 9),
    compacted: !preCompact,
  };
}

function narrate(s, flags, spike) {
  if (spike) return "You pressed the beacon. Pace bent upward, and the panel is already saying <b>↓ease</b>.";
  if (flags.danger) return "Pace now projects past the cap before reset. The badge says <b>↓ease</b> and the clock is the time you have left.";
  if (s.compacted) return "Auto-compact fired. Usable context reset, the spend did not.";
  if (s.ctx > 78) return "Usable context past 78%. Compaction is close, and the bar is blinking about it.";
  if (s.pool >= 5) return `<b>${s.pool} sessions</b> are burning the same 5-hour limit right now.`;
  if (s.five > 55) return "Over half the 5-hour window gone. Watch the projection, not the percentage.";
  return "Ordinary working session. Everything is where it should be.";
}

/* --- boot ------------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", () => {
  const panelRoot = document.getElementById("panel");
  const narration = document.getElementById("narration");
  const wrap = panelRoot.closest(".panel-wrap");
  const live = buildPanel(panelRoot);
  const refitLive = makeFitter(panelRoot);

  let spikeUntil = 0;
  let lastNarration = "";
  let lastLen = -1;

  function setNarration(html) {
    if (html === lastNarration) return;
    lastNarration = html;
    narration.classList.add("swap");
    setTimeout(() => {
      narration.innerHTML = html;
      narration.classList.remove("swap");
    }, 200);
  }

  // A frozen, representative frame for anyone who asked not to be animated at.
  if (reduced) {
    const s = simulate(0.62, 0);
    const flags = paint(live, s);
    refitLive();
    narration.innerHTML = narrate(s, flags, 0);
    document.getElementById("liveTag").textContent = "PAUSED";
  } else {
    const t0 = performance.now();
    const tick = (now) => {
      const spike = now < spikeUntil ? 1 : 0;
      const p = (((now - t0) / 1000) % LOOP) / LOOP;
      const s = simulate(p, spike);
      const flags = paint(live, s);
      wrap.classList.toggle("hot", flags.danger);
      setNarration(narrate(s, flags, spike));
      // Only remeasure when the rendered text actually changed length; a
      // fit pass costs layout, and most frames change colour, not width.
      const len = panelRoot.textContent.length;
      if (len !== lastLen) { lastLen = len; refitLive(); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* beacon: the one hidden control on the page */
  const beacon = document.getElementById("beacon");
  beacon.addEventListener("click", () => {
    spikeUntil = performance.now() + 6500;
    beacon.classList.add("armed");
    setTimeout(() => beacon.classList.remove("armed"), 6500);
  });

  /* --- inspector ---------------------------------------------------------- */

  const staticRoot = document.getElementById("staticPanel");
  const detail = document.getElementById("detail");
  const insp = buildPanel(staticRoot, { interactive: true });
  paint(insp, simulate(0.62, 0));
  makeFitter(staticRoot);

  const byId = new Map(SIGNALS.map((s) => [s.id, s]));
  let current = -1;

  function show(id) {
    const sig = byId.get(id);
    if (!sig) return;
    current = SIGNALS.findIndex((s) => s.id === id);
    staticRoot.classList.add("inspecting");
    insp.segs.forEach((node, key) => node.classList.toggle("on", key === id));

    detail.textContent = "";
    const box = el("div", "detail-in");
    box.appendChild(el("p", "detail-name", sig.name));
    box.appendChild(el("code", "detail-sample", sig.sample));
    box.appendChild(el("p", "detail-text", sig.text));
    detail.appendChild(box);
  }

  function clear() {
    staticRoot.classList.remove("inspecting");
    insp.segs.forEach((node) => node.classList.remove("on"));
    detail.textContent = "";
    detail.appendChild(el("p", "detail-idle", "Hover a segment to read it."));
    current = -1;
  }

  insp.segs.forEach((node, id) => {
    node.addEventListener("mouseenter", () => show(id));
    node.addEventListener("click", () => show(id));
  });
  staticRoot.addEventListener("mouseleave", clear);

  staticRoot.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (current + dir + SIGNALS.length) % SIGNALS.length;
    show(SIGNALS[next].id);
  });
  staticRoot.addEventListener("focus", () => { if (current < 0) show(SIGNALS[0].id); });

  /* --- copy --------------------------------------------------------------- */

  const copyBtn = document.getElementById("copyBtn");
  const copyLabel = document.getElementById("copyLabel");
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("npx cockpit-claude");
      copyLabel.textContent = "COPIED";
      copyLabel.classList.add("done");
    } catch {
      copyLabel.textContent = "⌘C IT";
    }
    setTimeout(() => {
      copyLabel.textContent = "COPY";
      copyLabel.classList.remove("done");
    }, 1800);
  });

  /* --- chrome ------------------------------------------------------------- */

  const topbar = document.querySelector(".topbar");
  const onScroll = () => topbar.classList.toggle("stuck", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (!reduced && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("shown"); io.unobserve(e.target); }
      }),
      { rootMargin: "0px 0px -12% 0px" },
    );
    document.querySelectorAll(".band > *, .diff, .card").forEach((n, i) => {
      n.classList.add("reveal");
      n.style.transitionDelay = `${Math.min(i * 28, 180)}ms`;
      io.observe(n);
    });
  }
});
