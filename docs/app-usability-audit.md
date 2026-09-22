# App usability and reliability pass — 2026-09-21

This pass preserves the continuation, rendering, and scene changes that were already in the working tree.

## Changes

- Replaced the hidden logo menus with a visible Workspaces button on both app shells. The searchable navigator groups tools by task, explains each tool, identifies the current workspace, and exposes projects, workspace tips, setting search, and workspace reset.
- Added Ctrl/Cmd+K, arrow-key navigation, Enter to open, focus containment, and Escape dismissal. Exact tool names rank ahead of incidental matches in descriptions. The dialog leaves room for Electron's window controls.
- Replaced abbreviated video input labels with References, Text, Image, and First + last. Workspace labels and the Library navigation label now match their destinations. Offline engine status opens setup.
- Added a recoverable settings-load error instead of an endless opening screen. Connection checks always release their busy state, ignore stale responses, and replace their failure notice after a successful retry. Model-scan failures and settings-refresh outcomes now report failures instead of unconditional success.
- Keep error notices visible until dismissed or replaced. The video shell allows longer errors to scroll.
- Keep failed video-workspace and job-history writes in memory with a persistent retry action. Project mutations update the saved-project list only after storage succeeds; a failed save keeps the entered name. Creating an 81st project no longer silently evicts a saved snapshot.
- Music 3 projects use their own storage and reload the correct engine. Legacy music projects continue to open ACE-Step. Project titles are shown only in the matching workspace. Project dialogs contain keyboard focus and show save feedback inside the dialog.
- Queue history uses cached posters or a placeholder instead of opening one video decoder per completed job. Audio jobs identify Music 3 correctly. Frame bookmarks exclude image outputs.

## Validation

- TypeScript, lint, the full test suite, and the production web build passed during this pass. The build required execution outside the sandbox because its worker initially failed with `spawn EPERM`.
- Added regression coverage for all 18 navigation destinations, exact-name ranking, empty search, task-description search, separate music snapshot keys, failed-write preservation, serialization failure, and retry.
- Opened every workspace through the navigator in a browser preview at 860×620. The initial image-search mismatch was corrected and covered by the regression test. Other destinations rendered without hitting the error boundary.
- Checked search, no results, keyboard opening, and current-workspace labels. Verified settings-load failure followed by successful retry, and connection failure followed by an enabled retry and successful connection, using a temporary mock fixture that was removed after testing.
- Inspected the actual renderer in an isolated Electron window at 860×620, including empty video state, disabled generation, and the workspace navigator. Created a second 1480×940 test window, but did not finish its visual pass before Computer Use was stopped with Escape.

## Remaining work

- Complete the normal-size Electron pass and the storage-failure UI retry check. Storage failure and recovery are covered at the persistence-function level, but that UI sequence was interrupted.
- Test real ComfyUI generation, interruption, reconnect, native file dialogs, and FFmpeg output using disposable media. The visual checks used the browser mock, not the user's production profile or backend.
- Movie export still has the compositor limitations documented in AGENTS.md. This pass does not change export fidelity.
- Broader media seeking, buffering, decode-failure, boundary-advance, and screen-reader interaction checks remain, along with focus handling in older dialogs beyond the navigator and project manager.
- The production build still reports a large application bundle. Splitting the monolithic App and workspace loading remains a separate performance improvement.
