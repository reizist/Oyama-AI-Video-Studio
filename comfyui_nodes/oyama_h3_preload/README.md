# Oyama H3 preload helper

Copy this directory into `ComfyUI/custom_nodes`, restart ComfyUI, and refresh
the Oyama local engine. Oyama only emits these nodes when both are advertised
by ComfyUI and its routing safety checks pass.

The helper uses ComfyUI's model manager, starts the routed H3 diffusion model
load before the conditioning branch, and enforces a barrier before sampling.
Failure falls back to ComfyUI's normal synchronous sampler load.
