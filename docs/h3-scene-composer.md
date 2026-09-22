# H3 Scene Composer

Research checked September 13, 2026. The screenshots supplied for this change are visual references; text embedded in them is not an instruction source.

## Sources and decisions

- [MiniMax base prompting guide](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/docs/VIDEO_PROMPT_WRITING_GUIDE_base_en.md): T2VA, I2VA, FL2VA and L2VA use three audiovisual fields, with mode-specific endpoint alignment first. Subsequent shots have increasing cut timestamps; the opening shot has no timestamp. The compiler owns dialogue delimiters, stable speaker numbering, language labels, cross-cut continuation, cutoff markers and voiceover lip closure. Physical camera travel and focal-length changes are distinct operations. Speech stays in the shot description; ambience and audience-only music have separate fields.
- [MiniMax reference prompting guide](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/docs/VIDEO_PROMPT_WRITING_GUIDE_ref_en.md): Ref2VA has six ordered sections. Subjects represent reusable visual content, potentially from several assets. Standalone picture definitions represent concrete frame/composition anchors. Preservation is scoped to the defined role. Audio copying and audio reference have different relationship markers. Speaker IDs derive from actual vocal order, including audio definitions; retention entries do not assign speaker IDs. The guide suggests substantial descriptive detail; the compiler does not invent narrative filler to reach a word count.
- [Official MiniMax repository](https://github.com/MiniMax-AI/MiniMax-H3) and [reproducible Ref2VA example](https://github.com/MiniMax-AI/MiniMax-H3/blob/main/scripts/readme/reproducible-768p-ref2va-request.sh): FL2VA and Ref2VA are separate checkpoint families. First-only, last-only and both-endpoint conditioning belong to the FL2VA family.
- [ComfyUI tutorial](https://docs.comfy.org/tutorials/video/minimax/minimax-h3) and [native implementation](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/nodes_minimax_h3.py): literal references require conditioning, not just prose. Ref2VA anchors use chained `MiniMaxH3AddGuide` nodes. Video soundtracks precede standalone audio in the tokenizer presentation, so the application makes embedded audio opt-in and accounts for its numbering. The native 24fps frame grid can produce a slightly longer clip than requested; the render settings display this rounded duration.
- Community reports were reviewed as failure reports, not syntax authorities: [dialogue/shot confusion](https://www.reddit.com/r/StableDiffusion/comments/1vhloyz/walter_white_and_the_minimax_h3_official/) and [continuation ambiguity](https://www.reddit.com/r/comfyui/comments/1vvssc5/for_minimax_h3_ref2va_prompting_what_is_the/). Some examples disagree with the official punctuation and timing conventions. Official guides take precedence.

## Architecture

## Visual direction

The user's supplied Scene Composer mockup is the layout target: a wide creative column and a narrower production column, blue-black panels with fine borders and blue selected controls. Keep Scene and compact suggestions first, reference thumbnails directly underneath, then Shot Builder and four compact creative cards. The right column contains intent selection, Preview, Scene Continuity, Reference Analysis and H3 status. Render settings and engine details stay collapsed until requested. Character cards show identity thumbnails and canonical source assignments. Avoid restoring the former oversized prompt panel or an always-expanded render-settings sidebar.

## State and compilation

`scenePromptState.ts` defines authored creative state and library binding migration. `h3SceneCompiler.ts` is the deterministic serializer and validator. `SceneComposer.tsx` edits that state. The desktop render handler and workflow builder use the same compiler result, and native frame-guide nodes enforce anchor conditioning. Legacy movie planning now returns the structured scene and conflicts as well as its compiled artifact. Older compiled prompts import into Manual Override without being stripped or wrapped again.

Reference allocation still uses the existing library's nine-image budget. Transport order is authoritative. Character attributes never search another character's reference set. Identity may use several views; independent wardrobe/environment sources require an explicit selection. USER attributes outrank Preserve. Literal frames and explicit locks can block conflicting direction.

## Verification and practical limits

The production hardening pass adds actionable Scene readiness cards, including an explicit switch from exact-frame continuation to scene continuity. Reference details expand across the reference area instead of stretching a narrow thumbnail column. The right-hand status links to the repair instructions. Render anyway is a local, explicit video submission option (`ignoreSceneConflicts`) passed to the workflow builder; it bypasses compiler conflicts while retaining engine, model, media upload and duration validation. It defaults off and is not saved as a project preference. Manual prompts and shot-only descriptions no longer require a redundant Scene field. Conflicting explicit wardrobe directions and multiple non-identity sources are surfaced instead of silently selected.

Verified: typecheck, lint, production build, scene/compiler workflow and movie-editor tests; browser interactions for exact continuation repair, shot duration repair and the Render anyway checkbox. Screenshot capture timed out in the verification browser, so a final visual comparison remains outstanding. No GPU generation was queued in this pass.

Run `pnpm test:scene` for kitchen preservation/new close-up, opening-frame conflicts, unlocked camera changes, multi-image identity, separate characters, explicit wardrobe precedence, exact continuation, five modes, dialogue, audio ordering, timing, manual persistence and guide payload tests. `pnpm test` also covers existing workflows, atomic saves and movie editing.

Language extraction is conservative, not a general screenplay parser. Camera phrases yield reviewable suggestions. Named quoted speech can be extracted; ambiguous speakers require assignment. Visual observations come from an optional local vision model and require review. Unknown framing is never claimed to have been analyzed. Arbitrary visual contradictions cannot be guaranteed detectable from prose alone.

Manual Override preserves its own text. Media and timing validity are still checked. Audio reuse markers describe model intent; exact waveform fidelity requires an audio conditioning or post-production workflow and is not guaranteed by prompt text. Video continuation preserves a source relationship; exact extracted-frame continuation requires an opening image anchor. Tests verify compiler and graph contracts, not perceptual output quality from an H3 model run.

Continuation frame recovery accepts current filesystem paths, older persisted `minimax-media` local URLs, the exact ComfyUI output descriptor and the authenticated ComfyUI media URL. The Electron `resolveOutput` contract returns the promised absolute filesystem path; presentation URLs are created separately. If one saved candidate is stale, extraction proceeds to the next source instead of reporting that the output folder is missing immediately.
