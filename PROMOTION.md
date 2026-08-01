# Promotion plan

Working notes, not a marketing document. Kept in the repo because the honest
version of "how did people find this" is worth being able to reread later.

## Before anything

Two things must be true first, or every link posted anywhere is broken:

- [ ] `npm publish` has run, so `npx cockpit-claude` actually installs something.
      Every channel below leads with that command.
- [ ] The social preview image is uploaded (Settings, General, Social preview,
      `site/assets/banner.png`). There is no API for it. Without it, every link
      shared anywhere renders as a grey box.

## The one-liner

Reuse this wording everywhere so the thing is recognisable across channels:

> A four-line statusline for Claude Code: usable context after auto-compact,
> burn rate, and whether your pace hits the 5-hour cap before it resets.

The hook that is actually interesting to a stranger is not "I made a
statusline". It is **the cross-session pool**: rate limits are billed to the
account, not the window, so four terminals are four sessions draining one
budget and none of them knows about the others. Lead with the problem.

## Channels

### Show HN

**Verified 2026-08-01** from the [Show HN guidelines](https://news.ycombinator.com/showhn.html)
and the [site guidelines](https://news.ycombinator.com/newsguidelines.html):

- Show HN is for things people can **run themselves**. A CLI qualifies. Blog
  posts and sign-up pages do not.
- Put `Show HN:` in the title when there is something to try.
- Self-promotion is allowed but must not be your primary use of the site. Posting
  your own work "part of the time" is fine; an account that only submits its own
  projects is not.

Title to use:

```
Show HN: Cockpit, a Claude Code statusline that warns before you hit the rate cap
```

Post the repo, not the landing page. Be in the thread to answer. The trade-offs
section of the README exists partly so the first critical comment is one already
made honestly.

### r/ClaudeAI and related subreddits

**Rules not verified.** Reddit blocks the crawler used here, so the subreddit
rules could not be read programmatically. Open the sidebar and read them
manually before posting. Several Claude-adjacent subreddits require a flair, ban
link-only posts, or restrict self-promotion to a weekly thread, and getting this
wrong costs the post and sometimes the account.

When it is allowed: lead with the problem, show the panel as text rather than a
screenshot, and put the repo link in the body rather than the title.

### awesome-claude-code and similar lists

A pull request to the relevant awesome-list is usually worth more long-term
traffic than a single post that peaks in a day. Check the list's contribution
rules for whether it wants a certain description length or category.

### X

One post, the gif from `assets/demo.gif`, the one-liner, and the repo link.
The gif is the whole pitch; the text is a caption for it.

### adatepe.dev

A short build note is the only channel here that is fully under your control and
does not expire. Worth writing once the first outside issue arrives, because
"what people actually asked" is the interesting half.

## What not to do

- Do not post to every channel on the same day. One at a time leaves room to fix
  whatever the first round of feedback finds.
- Do not open pull requests against unrelated repos to add a link.
- Do not describe it as a replacement for anything. It is a statusline with a
  particular set of trade-offs, and the README already lists the costs.
- Do not claim numbers that are not measured. No "10x", no invented user counts.
