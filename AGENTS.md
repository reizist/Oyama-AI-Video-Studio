# Oyama AI Video Studio contributor guide

## Scope and architecture

- This is a local-first Electron + React + TypeScript application. The renderer lives in `src/`, privileged desktop operations live in `electron/`, and workflow builders live in `src/lib/`.
- Keep filesystem, process, FFmpeg, and network privileges behind the typed preload bridge. Do not enable Node integration in renderer code.
- Preserve user media and project data. Avoid destructive migrations; make stored-data readers tolerant of older shapes and write versioned or atomic outputs where the existing API supports it.

## Working agreement

- Before editing, run `git status --short` and preserve unrelated user changes.
- Prefer small, typed changes. Reuse existing UI primitives, theme tokens, protocol URLs, and workflow helpers instead of introducing parallel systems.
- For media, test loading, seeking, buffering, decode failure, clip boundaries, and keyboard/accessibility feedback. Local media URLs must continue to support byte-range requests.
- Realtime status must describe the current operation, expose failures with recovery guidance, and use `role="status"`/`aria-live="polite"` for meaningful state changes. Avoid announcing high-frequency frame or timer updates.
- Add comments only for non-obvious constraints. Use `TODO(owner-or-area): reason; completion condition` for deferred work, and do not leave generic TODOs that merely restate the code.

## Validation

Run the narrowest relevant check while iterating, then before handoff run:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm build:web
```

For UI changes, also exercise the affected screen in the Electron app at its smallest supported layout and a typical desktop size. Verify empty, loading, success, failure, and disabled states when applicable.

## Known follow-up audit items

- TODO(movie-editor): replace the current primary-track-only export with a compositor that honors gaps, overlays, transforms, titles, and mixed audio; complete when exported output matches the visible timeline.
- TODO(media-preview): add cached poster-frame extraction for large libraries; complete when media cards show stable thumbnails without each card opening a decoder.
- TODO(testing): add renderer interaction tests for playback boundary advance, buffering/error feedback, modal focus trapping, and reduced-motion behavior.
- TODO(accessibility): complete a keyboard and screen-reader pass on the dense editor/studio screens and document the supported shortcut map in-product.
