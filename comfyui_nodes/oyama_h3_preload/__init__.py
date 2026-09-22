"""Guarded two-GPU model preload nodes for Oyama AI Video Studio.

The start node schedules ComfyUI's own model-management load operation. The
await node is a hard synchronization barrier placed after H3 conditioning and
before any sampler or scheduler can consume the model.
"""

from concurrent.futures import Future, ThreadPoolExecutor
import logging
import math
import threading

import comfy.model_management as model_management


_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="oyama-h3-preload")
_submit_lock = threading.Lock()


def _preload(model):
    device = getattr(model, "load_device", None)
    if device is None or getattr(device, "type", str(device).split(":", 1)[0]) != "cuda":
        return "skipped: diffusion model is not routed to CUDA"
    logging.info("[Oyama H3 Preload] Loading diffusion model on %s while H3 conditioning runs.", device)
    # Use ComfyUI's allocator instead of model.to(). This preserves dynamic
    # VRAM, patching, clone tracking, and the server's configured memory policy.
    model_management.load_models_gpu([model])
    logging.info("[Oyama H3 Preload] Diffusion model is ready on %s.", device)
    return f"ready: {device}"


class OyamaH3PreloadStart:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"model": ("MODEL",)}}

    RETURN_TYPES = ("MODEL", "OYAMA_H3_PRELOAD")
    RETURN_NAMES = ("model", "preload")
    FUNCTION = "start"
    CATEGORY = "Oyama/GPU Routing"
    DESCRIPTION = "Begins guarded H3 diffusion residency on its routed CUDA device."

    @classmethod
    def IS_CHANGED(cls, **_kwargs):
        # A cached Future belongs to a previous prompt and must never be reused.
        return math.nan

    def start(self, model):
        with _submit_lock:
            future = _executor.submit(_preload, model)
        return model, future


class OyamaH3PreloadAwait:
    @classmethod
    def INPUT_TYPES(cls):
        # Required-input order matters to Comfy's dependency traversal: start
        # preload, compute conditioning, then wait at the barrier.
        return {"required": {
            "model": ("MODEL",),
            "conditioning": ("CONDITIONING",),
            "preload": ("OYAMA_H3_PRELOAD",),
        }}

    RETURN_TYPES = ("MODEL", "CONDITIONING")
    RETURN_NAMES = ("model", "conditioning")
    FUNCTION = "await_preload"
    CATEGORY = "Oyama/GPU Routing"
    DESCRIPTION = "Waits for H3 diffusion residency before sampling can start."

    def await_preload(self, model, conditioning, preload: Future):
        try:
            result = preload.result()
            logging.info("[Oyama H3 Preload] Barrier released (%s).", result)
        except Exception:
            # Returning the untouched model is a safe fallback: ComfyUI's
            # sampler will perform its normal synchronous load.
            logging.exception("[Oyama H3 Preload] Background preload failed; falling back to normal sampler loading.")
        return model, conditioning


NODE_CLASS_MAPPINGS = {
    "OyamaH3PreloadStart": OyamaH3PreloadStart,
    "OyamaH3PreloadAwait": OyamaH3PreloadAwait,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "OyamaH3PreloadStart": "Oyama · Start H3 DiT Preload",
    "OyamaH3PreloadAwait": "Oyama · Await H3 DiT Preload",
}

