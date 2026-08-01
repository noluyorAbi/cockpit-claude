# Launch asset template: contract for the agent filling it in

This directory is a self-contained Remotion workspace that produces the four
launch assets for a project. It is copied into a repo as `video/`, one file is
rewritten, and four files come out.

You are the agent that rewrites that one file. Read this document fully before
you touch anything.

## What it produces

| Command                 | Output                      | Size at 1x             | Purpose                       |
| ----------------------- | --------------------------- | ---------------------- | ----------------------------- |
| `npm run render:mp4`    | `../assets/demo.mp4`        | 1920x1080, 30fps, h264 | linked from the README        |
| `npm run render:gif`    | `../assets/demo.gif`        | 960x540, 15fps         | embedded inline in the README |
| `npm run render:banner` | `../assets/banner.png`      | 1584x396               | README hero, LinkedIn 4:1     |
| `npm run render:social` | `../assets/social-card.png` | 1280x640               | GitHub social preview         |

`npm run build` runs all four, in about 31 seconds. Every path is relative to
this directory, so the assets land in `<repo>/assets/`, next to `<repo>/video/`.
The directory is created for you if it does not exist (verified).

## The one-file rule

**`src/content.ts` is the only file you edit.** Nothing else in `src/` is
project specific. If you feel the need to edit a scene, a colour or a timing,
you are working around a missing value in `content.ts`, and the answer is
almost always a different value there.

The layout, the palette, the easing curves and the composition sizes are shared
on purpose: every project launched with this template should look like it came
from the same shelf.

```
video/
  TEMPLATE.md              this file
  README.md                short operator notes, gets copied into the repo
  package.json             scripts the skill calls blind
  tsconfig.json            strict
  remotion.config.ts       codec-agnostic settings only
  eslint.config.mjs
  .nvmrc                   Node 24
  public/
    fonts/                 JetBrains Mono woff2 (OFL, licence included)
    screens/               placeholder screenshots, replace or delete
  src/
    content.ts             <- THE ONLY FILE YOU EDIT
    content-types.ts       the contract content.ts is checked against
    ansi.ts                real ANSI escape output to spans
    spans.ts               the span model
    color.ts               hex maths for the accent
    theme.ts               palette, easing, derived terminal metrics
    font.ts                offline font loading
    timeline.ts            every frame number, derived from content.ts
    Demo.tsx               scene layout
    Root.tsx               the three compositions
    index.ts               registerRoot
    components/            Window, Term, Brand, Proof
    scenes/                ColdOpen, TerminalScene, ScreensScene, EndCard,
                           Banner, SocialCard
```

## Quick start

```sh
cd video
nvm use                 # Node 24. Do not use Node 26, see Gotchas.
npm install             # about 12 s, 293 packages
# edit src/content.ts
npm run typecheck       # must be clean before you render
npm run build           # about 30 s for all four assets
```

The template ships with working placeholder content for a fictional CLI called
`trailhead`. A fresh copy renders all four assets with zero edits, which is how
you verify the toolchain before writing anything.

## `src/content.ts` field by field

| Field         | Required | Type                | Rule                                                                                |
| ------------- | -------- | ------------------- | ----------------------------------------------------------------------------------- |
| `name`        | yes      | `string`            | The project name, exact casing. No tagline glued on.                                |
| `tagline`     | yes      | `string`            | The promise. Under about 60 characters, ends in a period.                           |
| `description` | yes      | `string`            | One line of plain prose, under about 100 characters.                                |
| `install`     | yes      | `string`            | The one command, no leading `$`.                                                    |
| `repoUrl`     | yes      | `string`            | `github.com/user/repo`. No scheme, no trailing slash.                               |
| `accent`      | no       | `string`            | Hex. Defaults to the Claude coral `#d97757`. Override only for a real brand colour. |
| `highlights`  | no       | `string[]`          | Two to four short, checkable claims. Banner only.                                   |
| `coldOpen`    | no       | `string[]`          | At most three opening lines, each under about 42 characters.                        |
| `windowTitle` | no       | `string`            | Title bar label. Defaults to `name`.                                                |
| `demo`        | yes      | discriminated union | `{kind: "terminal", ...}` or `{kind: "screens", ...}`. See below.                   |

### Writing the tagline

Say what the user gets, not what the software is. Read it out loud after the
name:

```
trailhead. Every branch you left behind, in one list.        good
trailhead. A CLI tool for git branch management.             bad, a category
trailhead. The ultimate branch management solution.          bad, and untrue
```

Banned words unless they are literally load bearing: powerful, seamless,
blazingly fast, modern, simple, ultimate, revolutionary, effortless.

### Writing the cold open

Three lines maximum. The situation, the cost, then the question the tool
answers. The last line is emphasised and gets the cursor, so it must be the one
worth reading:

```ts
coldOpen: ["Twelve branches.", "Nothing merged.", "Which one was the hotfix?"],
```

Lines longer than about 42 characters get smaller type so they still fit. Two
lines is fine. One is fine if it lands.

### Writing highlights

Facts, not adjectives: `["read-only", "zero deps", "offline"]`, `["MIT", "no
telemetry", "one binary"]`. If you cannot name three true ones, give two, or
omit the field.

## The two demo modes

Pick the one that shows the product doing its job in the fewest seconds.

| The project is                                                            | Use                                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| a CLI, a script, a git tool, an MCP server, anything whose output is text | `kind: "terminal"`                                                              |
| a web app, a dashboard, a browser extension, anything with a UI           | `kind: "screens"`                                                               |
| a library with no UI and no CLI                                           | `kind: "terminal"`, showing the test suite or a REPL session running against it |

Both modes render inside the same window chrome, share the same cold open, and
share the same end card. Only the middle of the video differs.

### Mode 1: terminal

```ts
demo: {
  kind: "terminal",
  command: "trailhead --stale 7d",
  lines: fromAnsi(CAPTURED_OUTPUT.replace(/^\n/, "")),
}
```

Capture the output for real. Do not retype it by hand and do not invent it: the
whole point is that the video shows what the tool actually prints.

```sh
# macOS
script -q /dev/null trailhead --stale 7d > /tmp/capture.txt
# Linux
script -q -c "trailhead --stale 7d" /tmp/capture.txt
```

`script` gives the program a TTY, so tools that disable colour when piped keep
their colour. Then:

1. Paste the contents into the `CAPTURED_OUTPUT` template literal in
   `content.ts`.
2. Replace every raw ESC byte (0x1b) with the six characters `\u001b`. The file
   must stay printable ASCII plus the box-drawing glyphs.
3. Escape any backtick or `${` in the output.
4. Trim it. Twenty rows is a comfortable maximum. Keep every line under about
   100 columns: the type size is derived from the widest line, so one runaway
   line shrinks the whole terminal.

The parser (`src/ansi.ts`) understands 16-colour, 256-colour (`38;5;N`) and
truecolor (`38;2;R;G;B`) SGR codes, bold, faint, tabs, and carriage returns (a
progress bar collapses to its final state). Cursor movement, erase-line and
window-title sequences are consumed and dropped. Backgrounds are parsed and
ignored on purpose.

If the output has no colour at all, that is fine: it renders in the terminal
foreground colour and still looks like a terminal.

### Mode 2: screens

```ts
demo: {
  kind: "screens",
  shots: [
    { src: "screens/01-home.png", caption: "Paste a URL" },
    { src: "screens/02-run.png", caption: "One click to run" },
    { src: "screens/03-result.png", caption: "The result", holdFrames: 120 },
  ],
}
```

Three to five shots. Each holds for 90 frames (3 seconds) unless `holdFrames`
says otherwise. Captions are optional, short, and sentence case.

**Capture against a LOCAL dev server. Never a production URL.** A production
capture puts real user data, real account names and a live domain into a file
that gets committed and embedded in a README.

```sh
# 1. start the app locally, in the project's own way
npm run dev &            # or: pnpm dev, cargo run, uv run ..., docker compose up

# 2. drive it with agent-browser (verified syntax, agent-browser 0.32.3)
S=launch-shots
agent-browser --session $S set viewport 1600 900
agent-browser --session $S open localhost:3000
agent-browser --session $S screenshot /abs/path/to/repo/video/public/screens/01-home.png

agent-browser --session $S find text "Dashboard" click
agent-browser --session $S wait --load networkidle
agent-browser --session $S screenshot /abs/path/to/repo/video/public/screens/02-dashboard.png

# 3. close YOUR session, once
agent-browser --session $S close
```

Rules that matter here:

- `set viewport 1600 900` before the first `open`. That is 16:9, which is the
  shape of the stage, so nothing gets cropped. Verified: the PNG comes out
  exactly 1600x900.
- Always pass an absolute path to `screenshot`. A relative path or a missing
  parent directory silently writes to a temp dir while still printing success.
- Always pass `--session`, and close only that session, once. Never
  `close --all`: it kills other agents' browsers.
- Never pass `--profile`, `--auto-connect` or `--cdp`.
- If the app has a dark mode, use it: `agent-browser --session $S set media dark`.
  The frame around the shot is near black.
- `src` is relative to `public/`, so `screens/01-home.png` means
  `public/screens/01-home.png`.
- Delete the shipped `public/screens/0*-placeholder-*.png` once you have real
  shots.

**When you switch to `kind: "screens"`, delete the `CAPTURED_OUTPUT` constant
and the `import { fromAnsi }` line.** `noUnusedLocals` is on, so leaving them
behind fails `npm run typecheck` with `TS6133`.

## Rendering

```sh
npm run typecheck      # tsc, strict. Do this first, every time.
npm run lint           # eslint + tsc
npm run compositions   # prints the three compositions and the frame count
npm run build          # all four assets
```

Measured on an Apple Silicon Mac, 536-frame video, warm cache:

| Step                    | Wall time | Output size  |
| ----------------------- | --------- | ------------ |
| `npm install`           | 12 s      | 293 packages |
| `npm run typecheck`     | 2 s       |              |
| `npm run render:banner` | 1.9 s     | 294 KB       |
| `npm run render:social` | 1.7 s     | 321 KB       |
| `npm run render:mp4`    | 14 s      | 1.1 MB       |
| `npm run render:gif`    | 10 s      | 1.2 MB       |

The first render on a fresh machine also downloads Chrome Headless Shell
(93.5 MB, once). That is silent and looks exactly like a hang, so run
`npx remotion browser ensure` first if you want to see the progress bar.

The mp4 is rendered at `--crf=21`, which keeps flat dark UI footage around 1 to
3 MB. GitHub's hard limit is 100 MB and the warning threshold is 50 MB, so there
is no realistic way to breach it at these durations. If a demo somehow runs
long, raise the crf rather than dropping the resolution.

The GIF is rendered with `--every-nth-frame=2 --scale=0.5`, so 30fps 1920x1080
becomes 15fps 960x540. Do not remove those flags: at full size the same GIF is
roughly eight times larger and unusable in a README.

### Verifying what you produced

```sh
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,r_frame_rate,nb_frames \
  -of default=nw=1 ../assets/demo.gif
```

Expect `960 x 540`, `15/1`. For the mp4, `1920 x 1080`, `30/1`.

## How long the video will be

You do not set the duration. It is derived:

```
cold open        132 frames (4.4 s), fixed
body             terminal: typing + one row every 2 to 6 frames + a 3 s hold
                 screens:  sum of holdFrames, 3 s each by default
end card         168 frames (5.6 s), fixed, fades out at the end
```

The placeholder content lands at 536 frames (17.9 s). Anything between 15 and
30 seconds is healthy. If `npm run compositions` reports much more than 900
frames, your demo is too long: cut output rows or shots, do not speed anything
up.

## Motion rules already baked in, do not fight them

- Scenes cross dissolve against a background that never moves. No hard cuts,
  nothing slides across the frame.
- Typing is linear, never eased. Output rows enter with opacity plus a 6px lift
  over 8 frames on the house ease-out curve. No spring, no bounce, no scale on
  text.
- Exits are plainer than entrances: attention is already moving on.
- The payoff frame holds still for three seconds. Holding is the animation.
- The end card fades to the empty background on the last frame, which is the
  same frame as frame 0, so the GIF loops with no visible seam. Verified: the
  first and last frames are byte identical.
- Every animation is a pure function of `useCurrentFrame()`. Remotion renders
  frames out of order and in parallel, so `useState` or `setInterval` produces
  corrupted, nondeterministic output.

## Gotchas that will cost you an hour

**Node 24, not Node 26.** Remotion's browser fetcher depends on `extract-zip`,
which breaks on Node 26, so Chrome Headless Shell is never extracted and the
render dies quietly. `.nvmrc` pins 24.

**Do not put codec options in `remotion.config.ts`.** It applies to every render
regardless of codec. A `Config.setCrf()` there makes every GIF render fail with
`The "gif" codec does not support the --crf option`. Codec-specific flags belong
on the CLI, which is where the package scripts put them.

**Do not switch the font to `@remotion/google-fonts`.** It fetches
fonts.gstatic.com at render time with an 18 second timeout, so the render stops
being offline and deterministic. The woff2 files are committed under
`public/fonts/` and loaded with `@remotion/fonts`.

**Keep the full JetBrains Mono, not a subset.** The fontsource "latin" subset is
229 codepoints and is missing every non-ASCII glyph a CLI prints (`─ ● ◆ ▁ █ ≈`),
which renders captured output as tofu boxes. The committed files are the full
1363-codepoint webfont. The one glyph no JetBrains Mono ships is `⎇` (U+2387),
so the parser turns it into an inline SVG automatically.

**Never remove the ligature reset.** JetBrains Mono fuses `--` into one long dash
glyph, so `--stale` would render as a dash and stop showing the flag the user
actually types. `termText` in `components/Term.tsx` disables `liga` and `calt`.

**`noUnusedLocals` is on.** Leftover constants from the mode you did not use
fail the typecheck. That is deliberate: it stops dead placeholder data being
shipped in a repo.

**Do not commit `node_modules` or the lockfile from this template.** The skill
installs at copy time.

## Worked example, filled in

A web project, screens mode, with everything set:

```ts
import type { Content } from "./content-types";

export const content: Content = {
  name: "Sweep",
  tagline: "Every dead asset in your repo, found and gone.",
  description:
    "Scans a repo for unreferenced images, fonts and CSS, then removes them.",
  install: "npx sweep .",
  repoUrl: "github.com/noluyorAbi/sweep",
  accent: "#d97757",
  highlights: ["dry run by default", "no config", "MIT"],
  coldOpen: [
    "400 files in /assets.",
    "Nobody knows which ones ship.",
    "Find out in 4 seconds.",
  ],
  windowTitle: "sweep",
  demo: {
    kind: "screens",
    shots: [
      { src: "screens/01-scan.png", caption: "Point it at a repo" },
      {
        src: "screens/02-report.png",
        caption: "Every unreferenced file, with its size",
      },
      {
        src: "screens/03-clean.png",
        caption: "One flag to remove them",
        holdFrames: 120,
      },
    ],
  },
};
```

The same project as a CLI, terminal mode:

```ts
const CAPTURED_OUTPUT = `
\u001b[1m\u001b[38;5;253msweep\u001b[0m  scanned 412 files in 3.9s
\u001b[38;5;242m  38 unreferenced  ·  14.2 MB reclaimable\u001b[0m
\u001b[38;5;238m  run with --apply to delete\u001b[0m
`;

demo: {
  kind: "terminal",
  command: "npx sweep .",
  lines: fromAnsi(CAPTURED_OUTPUT.replace(/^\n/, "")),
},
```

## Before you hand off

- [ ] `src/content.ts` has no `trailhead` left in it.
- [ ] `public/screens/0*-placeholder-*.png` deleted, or real shots in their place.
- [ ] `npm run typecheck` is clean.
- [ ] `npm run lint` is clean.
- [ ] `npm run build` produced all four files in `../assets/`.
- [ ] `demo.mp4` is under 10 MB, `demo.gif` is under 5 MB.
- [ ] The tagline would still be true if a stranger read it.
- [ ] No screenshot contains a real name, a real email, a production URL or a
      token.
