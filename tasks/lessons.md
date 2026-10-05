# Lessons

Patterns to keep (and mistakes not to repeat) on this project.

## Verification
- **Chain verification and commit with `&&`, never `;`.** A `pnpm test:e2e; git commit` once committed a failing build. Gate the commit on the checks.
- **Kill the old `next-server` before restarting on the same port.** A stale server against a fresh build serves mismatched chunks (400s, "Application error"). Use `ps aux | grep "[n]ext-server" | awk '{print $2}' | xargs -r kill`, and never `pkill -f "next start"`, which matches the shell running it.
- **Golden fixtures first.** Capture engine output before any engine change, then re-capture inside the commit that moves numbers and explain the delta.
- **Test the stack you ship.** The e2e console-error check, run against `next build && next start`, found what dev mode hid (hydration, error bodies).

## Shell (zsh in this container)
- Don't name a loop variable `path`: zsh ties it to `$PATH` and every later command "isn't found".
- `$VAR` holding a command doesn't word-split in zsh. Use a function or a bash script file.
- `pnpm cf:build` fails here with `EACCES ... .open-next/.build`: Node 24's native `fs.cpSync` can't write to the virtiofs workspace mount. It's not a project bug (Cloudflare CI is fine). To test locally, copy the repo to the scratchpad and build there.

## Next.js
- `next.config.js` runs once per build worker. Resolve anything environment-derived (git hash) once and export it through `process.env`, or server and client bundles can disagree.
- Server components can't import plain constants from a `"use client"` module (they get a client reference). Keep shared constants in a neutral module (`lib/theme.ts`).
- Anything that must respect `prefers-reduced-motion` in SSR markup belongs in CSS media queries, not in `useReducedMotion()` (null on the server).

## Data and copy
- Re-verify catalog rows against a spec source. Two "Bitcoin miners" were CKB miners, and two models didn't exist.
- Prefer in-stock market prices over list prices when they diverge a lot, and say which one you used in `price_source`.
