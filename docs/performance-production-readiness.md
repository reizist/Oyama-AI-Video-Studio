# Performance and production readiness

## Scope and evidence

This review covers the accelerators and routing paths currently wired into the desktop application: ComfyUI's `ModelAttentionBackend` selection (Kitchen, Sage, and native), H3 Sol-Attn and optional cache, H3 parallel attention, model/text/VAE device routing, residency/offload choices, preview decoding, and the reproducible H3 benchmark. It is deliberately runtime-first: `object_info` is the authority for which nodes this particular ComfyUI server can execute, while `/system_stats` is inventory and launch-context telemetry. ComfyUI documents those server routes, including `/prompt`, `/queue`, `/history/{prompt_id}`, `/object_info`, and `/system_stats`, which matches the application's queue-and-poll interaction. [ComfyUI server routes](https://docs.comfy.org/development/comfyui-server/comms_routes)

## What is already a performance feature

| Feature | Current protection | Production position |
| --- | --- | --- |
| Kitchen / Sage / native attention | Resolved from `ModelAttentionBackend` choices at runtime; unavailable choices fall back to native. | Keep the runtime gate. Attention is a model clone/patch selection, so measure it per model and ComfyUI build rather than treating a name as a permanent guarantee. [Model Attention Backend](https://github.com/Comfy-Org/embedded-docs/blob/main/comfyui_embedded_docs/docs/ModelAttentionBackend/en.md) |
| Sol-Attn and cross-step cache | Sol is exclusive on H3 graphs; the generic attention patch is not stacked with it. Cache is only added when a compatible Sol cache node is detected. | Keep it H3-only and benchmark it independently. Sol-Attn is a custom-node integration, not a ComfyUI core capability. [Sol-Attn repository](https://github.com/sumeetprashant/ComfyUI-SolAttn) |
| H3 parallel attention | Enabled only if both the parallel node and Kitchen are detected. | Treat as opt-in experimental hardware acceleration. Validate peer access and output quality on the exact multi-GPU machine before using it for production jobs. |
| Per-component GPU routing | Uses loader nodes first, then ComfyUI core selectors; a diagnostic queues a real short decode. | Keep routing at component boundaries. It avoids pretending that a VAE can be split across devices. [Core multi-GPU selectors](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/nodes_multigpu.py) |
| VAE on a secondary GPU | Core `SelectVAEDevice` is selected for a detected GPU target. | Supported for another GPU. It is not CPU-capable in ComfyUI core; only a multi-GPU VAE loader should offer a CPU choice. |
| VRAM estimate guard | A persisted explicit override is required before a predicted overcommit is queued. | Keep as a guardrail, not an admission guarantee: ComfyUI can still offload or reject. |
| H3 Kitchen/Sage/Sol benchmark | Fixed prompt, seed, model stack and steps; duration and resolution are user-selected and results are persisted. | Use it after driver, model, launch-flag, GPU-routing, or custom-node changes. Compare like for like. |

## ComfyUI interaction decisions

The app should not write ComfyUI launch flags or infer server support from a package name. ComfyUI's launch arguments materially affect residency: `--highvram` and `--gpu-only` retain more on the GPU, while `--lowvram`, `--novram`, reserve/headroom controls, dynamic VRAM, and async offload change allocation behavior. The right product behavior is to report detectable launch context in Settings, warn about risky combinations, and leave process ownership to ComfyUI Desktop or the operator. [ComfyUI CLI arguments](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy/cli_args.py)

Core device selectors expose different contracts. `SelectModelDevice` and `SelectCLIPDevice` may receive a CPU or `gpu:N` target. `SelectVAEDevice` only exposes the default/GPU choices, so a CPU VAE request must degrade to Auto with an explanation rather than emit a graph that looks valid but cannot meet the request. The new capability gate makes this distinction visible before rendering. [Core selector implementation](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/nodes_multigpu.py)

The application now also preserves the CUDA number in ComfyUI's device name (`cuda:1`, for example) when it joins `/system_stats` with NVIDIA telemetry. Previously the first ComfyUI device could be incorrectly treated as GPU 0 when ComfyUI had been launched on another CUDA index. That is a real routing-safety fix, with a regression test.

Tiled VAE decode is a valid future low-VRAM option, but it should not be injected generically into H3/LTX workflows until the app has confirmed the exact model/node contract and benchmarked both output and elapsed time. ComfyUI's tiled decoder specifically exposes spatial and temporal tile and overlap controls; those controls are not equivalent to a transparent substitute for every normal VAE decode. [VAE Decode Tiled](https://docs.comfy.org/built-in-nodes/VAEDecodeTiled)

## Production hardening priorities

### P0 — keep the render truthful

- Use `object_info` before inserting every optional acceleration or routing node. A detected node is availability, while the short placement render is execution validation.
- Keep the current explicit VRAM override and clear, persisted warning. Never auto-enable it after a settings reset or changed GPU inventory.
- Serialize benchmark runs and block them while a normal render is active. A shared ComfyUI queue makes concurrent timing meaningless and can evict resident models.
- Retain the new CUDA-index regression test. Multi-GPU machines are exactly where a one-index error is most expensive.
- Keep Sol exclusive from generic model-attention patches and arbitrary cache nodes. Its own documentation warns that it applies through the same model patch path. [Sol-Attn repository](https://github.com/sumeetprashant/ComfyUI-SolAttn)

### P1 — make settings explain the runtime

- Show the advertised node for diffusion, text, VAE, and preview routing; label missing capability as Auto, not Ready.
- Show available launch context as telemetry only: memory policy, dynamic-VRAM disable flag, async-offload disable flag, and PyTorch version. Older ComfyUI builds may not report arguments, which should read as “not reported,” never “enabled.”
- Persist benchmark configuration and results, but invalidate old recommendations when duration or resolution changes. A result is a machine/profile measurement, not a universal ranking.
- Record the exact ComfyUI and PyTorch versions alongside future benchmark records. This is the missing piece for cross-upgrade comparability.

### P2 — add only after measured validation

- Offer tiled VAE as an explicit advanced profile after detecting its node and compatible inputs. Provide a baseline-vs-tiled comparison rather than silently changing output behavior.
- Add a bounded warm-up option to the benchmark only if it records both cold and warm results. Model residency can dominate a three-second clip's total time.
- Add a post-render capability ledger: node/version, selected GPU, resolved route, allocation strategy, and output status. Do not claim VRAM placement from a successfully queued prompt alone.

## Defaults to avoid

Do not default to `--gpu-only` or `--highvram` simply because two GPUs exist; the main diffusion model, text encoder, VAE, preview decoder, and active work all compete for capacity. Do not advertise CPU VAE placement with only the core selector. Do not enable experimental block-sparse attention as a default: current upstream reports show a crash path in recent core releases, so it needs a version-specific runtime test before it becomes a user setting. [Open BlockSparseAttention issue](https://github.com/Comfy-Org/ComfyUI/issues/16236)

## Operator runbook

1. Restart ComfyUI after installing or updating an attention/routing custom node, then run **Test connection** to refresh `object_info` and `/system_stats`.
2. In **GPU Routing**, confirm the capability gate shows the selector/loader actually advertised by this server. For a VAE on another GPU, choose that GPU and run **Test GPU Routing**.
3. Leave **Allow render despite VRAM estimate** off unless the operator intentionally accepts offload/OOM risk.
4. Choose an H3 benchmark duration and resolution that reflects production delivery, then run the benchmark only with the ComfyUI queue otherwise idle.
5. Re-run the diagnostic and benchmark after a driver, CUDA/PyTorch, ComfyUI, custom-node, launch-flag, model precision, or routing change.

## Sources

- [ComfyUI communication routes](https://docs.comfy.org/development/comfyui-server/comms_routes)
- [ComfyUI CLI and memory flags](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy/cli_args.py)
- [ComfyUI core multi-GPU device nodes](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/nodes_multigpu.py)
- [ComfyUI Model Attention Backend](https://github.com/Comfy-Org/embedded-docs/blob/main/comfyui_embedded_docs/docs/ModelAttentionBackend/en.md)
- [ComfyUI VAE Decode Tiled](https://docs.comfy.org/built-in-nodes/VAEDecodeTiled)
- [Sol-Attn integration](https://github.com/sumeetprashant/ComfyUI-SolAttn)
