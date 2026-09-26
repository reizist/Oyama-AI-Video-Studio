# Application module map

`src/App.tsx` coordinates workspace navigation, shared generation state, and the H3 render lifecycle. The following modules own narrower responsibilities:

| Module | Responsibility |
| --- | --- |
| `src/lib/workspacePersistence.ts` | Workspace defaults, legacy saved-state recovery, and preview-free storage copies. |
| `src/components/LtxRippleWorkspace.tsx`, `src/components/PhotoEditWorkspace.tsx`, `src/lib/ltxRippleWorkflow.ts`, and `src/lib/fireRedEditWorkflow.ts` | Ripple frame 0 extraction, FireRed photo editing, in-app image handoff, and separate ComfyUI workflow graphs. |
| `src/lib/workspaceProjects.ts` and `src/components/WorkspaceProjectManager.tsx` | Local project index and the save/open manager. Source media files remain in place. |
| `src/lib/workspaceSearch.tsx` | Setting discovery and result labels; the active workspace controls remain the source of truth. |
| `src/lib/workspaceTips.ts` and `src/components/WorkspaceTips.tsx` | Workspace help copy and its dialog. |
| `src/lib/jobPresentation.ts` and `src/components/JobsView.tsx` | Queue status, render configuration, and activity display. |
| `src/components/LibraryView.tsx` and `src/components/VideoPlayer.tsx` | Render library filtering, output cards, and media playback controls. |
| `src/components/SettingsView.tsx` and `src/components/FormFields.tsx` | Settings panels and shared labeled input controls. |
| `src/lib/h3Diagnostics.ts` and `src/lib/h3NodeDetection.ts` | H3 benchmark persistence, model stack reports, and ComfyUI node detection. |
| `src/components/CreatePromptPanel.tsx`, `src/lib/promptPresets.ts`, and `src/lib/promptAutoTags.ts` | Create prompt tools, shared `//` command search, and deterministic H3 section tagging. |
| `electron/promptCompletion.ts` | Bounded Ollama and LM Studio inline suggestion request contracts; privileged transport stays in Electron main. |
| `src/lib/comfyJobState.ts` | Interpret ComfyUI queue/history state and guard terminal updates against cancellation races. |
| `src/lib/jobPersistence.ts` | Restore saved Queue jobs independently, isolating malformed entries and migrating playback URLs. |
| `electron/comfyCancellation.ts` | One cancellation path for Electron IPC and LAN, with modern ComfyUI and legacy queue handling. |
| `electron/legacyBrowserStorage.ts` and `src/components/LegacyMigrationControl.tsx` | Staged, pre-session Local Storage restore with a recoverable backup and visible retry errors. |
| `electron/gpuTelemetry.ts` | Bounded `nvidia-smi` polling behind the desktop process. |

The remaining large sections in `App.tsx` are H3 submission, history/output reconciliation, continuation, and the video workspace UI. A future extraction should keep the history lookup tied to the exact ComfyUI prompt ID and preserve local output paths for continuation. Avoid moving privileged file or process operations into renderer modules.

Run `pnpm test`, `pnpm typecheck`, `pnpm build:web`, `pnpm build:electron`, and `pnpm test:ui-e2e` after changing these boundaries. The UI test requires the Vite server at `127.0.0.1:5173`.
