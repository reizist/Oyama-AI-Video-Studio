# Stylesheet boundaries

`src/styles.css` is the ordered entry point for the older application styles. Its imports retain the original cascade order:

| File | Responsibility |
| --- | --- |
| `shell-and-controls.css` | Base tokens, controls, and application shell. |
| `creation-workspaces.css` | Creation forms, previews, and generation controls. |
| `movie-and-mobile.css` | Movie workspace and LAN companion layout. |
| `visual-system.css` | Shared visual language and workspace composition rules. |
| `workstation.css` | Shared desktop layout and accessibility refinements. |
| `feature-workspaces.css` | Movie editor, reference prep, settings, queue, library, and music workspace rules. |
| `studio-refresh.css` | Final shared palette, shell rhythm, panel treatment, and responsive H3 layout. |

New workspace rules should live beside their feature, while shared colors and shell rules belong in `studio-refresh.css`. Keep the ordered imports in `styles.css` until the remaining legacy rules have been moved by feature; changing their order changes the cascade.
