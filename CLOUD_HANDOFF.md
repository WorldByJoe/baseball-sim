# Handing a step to Claude Code on the web

`CLOUD_HANDOFF.md · v0.1 · 2026-10-01`

Claude Code on the web (claude.ai/code) runs on Anthropic's machines against this GitHub repository and is paid from cloud session credits, not the weekly model limit. It works on a branch and opens a pull request; nothing lands on `main` until you merge it. It cannot see the Mac: there is no `jsc` there and no screen, so it runs the headless checks through `headless/run_node.js` under Node, and screen work (the renderer, screenshots) stays local.

## The steps

1. Go to claude.ai/code and sign in. The first time, connect GitHub and allow the `WorldByJoe/baseball-sim` repository (private is fine).
2. Start a new session on that repository, branch `main`. Pick Opus for a building step; Sonnet is enough for a mechanical one.
3. Paste a brief (below) as the first message and let it run. It will push a branch and open a pull request.
4. Read the pull request on GitHub: the description carries the before/after table, "Files changed" shows the code. Ask questions in the PR comments if you like; the session can answer there.
5. If it is good, merge it on GitHub. Then on the Mac, in the `Baseball sim` folder:

```bash
git pull
```

6. If it is not good, close the pull request without merging; nothing else is needed.

A local Claude session can verify a merged step on the Mac afterwards (jsc suites, the screen).

## What a brief needs

Five parts, in this order. The example that produced PR #1 is saved in `docs/briefs/2026-09-30_contact_model.md`; copy its shape.

1. **What the project is**: the one rule (traits and labelled physical constants are the only knobs; a gap is a missing mechanism) and what to read first (README, CALIBRATION, the targets, the engine sections involved).
2. **Prove the tooling first**: the exact `run_node.js` commands and the league line the engine must reproduce before anything is changed (it is seeded, so the numbers are exact).
3. **The problem in numbers** and **the mechanism in physics**: what is measured, what the league does, where in the physics to look, in what order to try things.
4. **Acceptance across seeds**: the whole metric suite, judged on several seeds, never one number; what must not get worse.
5. **House rules and the report**: file headers `name · vX.Y · date` with a CHANGED list of at most five lines; delete old code; comments change with the code; a CALIBRATION.md section in the past tense; branch, commits with the Co-Authored-By line, a PR and no merge; a report under 60 lines that says plainly whether the band was reached.

A local Claude session can write the brief for a step into `docs/briefs/` so that it only needs pasting.
