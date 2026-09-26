# H3 Video UI layout

The H3 Video workspace now uses the shared app sidebar, a middle workbench with Source, Create, Settings, and Result sections, a persistent preview on the right, and a bottom status and action bar. The existing dark and lime theme is retained. Controls in inactive sections stay mounted so prompt text and section state are not discarded when switching sections.

The sidebar navigation is now a separate component with Create, Libraries, and Project groups. Reference mode groups character, location, and scene-media inputs in expandable sections; the full asset browser remains available on demand. Hair, Wardrobe, Accessory, and Location studios share a searchable library rail. Character Studio shows search results and a clear-filter empty state; the render library can filter images and videos.

## Follow-up work

- Cancellation recovery: after cancelling a render, the UI can remain on “Rendering…” or Generate can do nothing until the app restarts. Reproduce in H3 and Continue, then ensure terminal job state clears the active action and a new job can be submitted without restarting.
- Prompt workflow: review the H3 prompt authoring flow for clearer structure, suggestions, and recovery from invalid or conflicting input. Keep the current prompt compiler behavior intact until the interaction design is agreed.
- Continue workspace: apply the source, create, settings, result layout and persistent preview after the H3 layout is reviewed.
- LTX 2.5 retirement: remove its creation UI and generation path in a separate change, preserving saved projects and existing media through tolerant readers or an explicit import path.
