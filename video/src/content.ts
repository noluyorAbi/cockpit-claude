/**
 * The only project-specific file in this workspace.
 *
 * CAPTURED_OUTPUT below is real stdout from `node bin/cockpit.js --preview`,
 * taken through `script` so the tool kept its colour, with the ESC bytes
 * escaped. Nothing in it was retyped or invented: it is three lines because
 * the preview payload has no todo list and the repo has no cost ledger, and
 * the panel correctly hides both of those segments.
 */

import { fromAnsi } from "./ansi";
import type { Content } from "./content-types";

const CAPTURED_OUTPUT = `
\u001b[1m\u001b[35mOpus 5 (1M)\u001b[0m \u001b[1m\u001b[31m·high ↓ease\u001b[0m \u001b[2m│\u001b[0m \u001b[36mstyle:default\u001b[0m \u001b[2m│\u001b[0m \u001b[1;96m▸ ~/repos/cockpit-claude\u001b[0m \u001b[36m⎇ main\u001b[0m \u001b[33m[+1]\u001b[0m \u001b[36m↑1\u001b[0m
\u001b[2mctx\u001b[0m \u001b[38;5;208m██████░░░░  65%\u001b[0m \u001b[2m│\u001b[0m \u001b[38;5;245min:128.4k out:22.9k cache:1.94M\u001b[0m \u001b[2m│\u001b[0m \u001b[32m$4.82   \u001b[0m\u001b[2m⌁$6.9/hr \u001b[0m \u001b[2m│\u001b[0m \u001b[32m+318\u001b[0m/\u001b[31m-74\u001b[0m
\u001b[2m◷ limits\u001b[0m  \u001b[1m\u001b[38;5;245m5h\u001b[0m \u001b[33m▰▰▰▰▰▱▱▱\u001b[0m \u001b[33m62%\u001b[0m \u001b[2m↻2h15m\u001b[0m \u001b[1m\u001b[31m⚡cap~1h41m\u001b[0m  \u001b[2m│\u001b[0m  \u001b[1m\u001b[38;5;245m7d\u001b[0m \u001b[32m▰▰▱▱▱▱▱▱\u001b[0m \u001b[32m31%\u001b[0m \u001b[2m↻2d14h\u001b[0m \u001b[32m→49%\u001b[0m  \u001b[2m│\u001b[0m  \u001b[2mpool\u001b[0m \u001b[33m4 live\u001b[0m \u001b[2m⌁Σ$47/hr\u001b[0m
`;

export const content: Content = {
  name: "cockpit",
  tagline: "Your session, from the flight deck.",
  description: "Usable context, burn rate, and the limit you are about to hit.",
  install: "npx cockpit-claude",
  repoUrl: "github.com/noluyorAbi/cockpit-claude",
  accent: "#dfa440",
  highlights: ["zero deps", "no network", "MIT"],
  coldOpen: ["Four terminals open.", "One rate limit.", "Which one is burning it?"],
  windowTitle: "claude \u00b7 cockpit",
  demo: {
    kind: "terminal",
    command: "npx cockpit-claude --preview",
    lines: fromAnsi(CAPTURED_OUTPUT.replace(/^\n/, "")),
  },
};

export default content;
