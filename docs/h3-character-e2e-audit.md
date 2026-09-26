# H3 and Character end-to-end audit

## Verified on 2026-09-22

- `pnpm test:comfy-cancel` uses a local HTTP ComfyUI simulator to exercise running and queued cancellation through the current job API and legacy queue API. It also checks a completion race, terminal states, and submission of a new job after cancellation.
- `pnpm test:ui-e2e` uses headless Edge against the running Vite app (`pnpm dev:web`). It checks H3's offline state, visible Character settings search, inspector tabs, the Character library and Generate sections, preview visibility, uncaught browser errors, and document overflow at 1379 × 982 and 860 × 620.
- `pnpm test:workspace-persistence` checks legacy workspace migration, malformed media recovery, saved sampling choices, and corrupt JSON fallback.
- `pnpm test:comfy-job-state` checks queue/history interpretation and rejects stale terminal updates after cancellation or another job state change.
- `pnpm test:job-persistence` checks that malformed saved jobs cannot hide valid Queue history and that older ComfyUI playback URLs migrate on load.
- Render polling now records one actionable Queue or history warning per failing connection attempt instead of silently swallowing bridge errors. A live ComfyUI session is still needed to verify recovery after an actual engine disconnect.
- `pnpm typecheck`, `pnpm test`, `pnpm build:web`, `pnpm build:electron`, and repo-wide `pnpm lint` pass. The ESLint configuration now gives root Node `.cjs` files the same Node globals as scripts.

## Live checks still needed

- TODO(h3-generation): run text, image, first/last-frame, and reference generation against an installed ComfyUI with MiniMax H3 weights; complete when each mode submits, progresses, saves a playable output, and shows recoverable errors for invalid inputs.
- TODO(h3-cancellation): interrupt a running render and remove a pending render in the Electron app, then submit another render without restarting; complete when the queue and UI return to ready and the second render finishes.
- TODO(character-generation): create and approve identity candidates and a Ref2VA survey, then verify the approved reference set is usable in H3; complete when images, video, and saved Character metadata persist after app restart.
- TODO(ui-navigation): remove the remaining LTX 2.5 navigation and handoff controls requested for retirement; complete when the app no longer offers that workflow and older saved projects still open safely.
- Packaged Windows alpha.52 was installed and launched after a previous `EPERM` restore failure. It kept the pending request and current profile intact, then completed the restore after the separate development Electron processes were closed. The migration marker records `browserStorageMigrated: true`, the prior Oyama Local Storage backup exists, and the pending request was removed.
- TODO(legacy-migration): inspect the restored character, wardrobe, and location libraries in the running UI and open their referenced media; complete when the saved entries and previews are usable after restart.

The current H3 graph follows ComfyUI's [MiniMax H3 guide](https://github.com/Comfy-Org/docs/blob/main/tutorials/video/minimax/minimax-h3.mdx) and [reference workflow template](https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_minimax_h3_r2v.json). Cancellation prefers ComfyUI's current [job cancellation route](https://github.com/Comfy-Org/ComfyUI/blob/master/server.py) and falls back to the legacy queue endpoints.
