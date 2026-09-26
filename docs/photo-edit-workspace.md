# Photo Edit and Ripple handoff

Photo Edit is an in-app FireRed Image Edit workspace. A source photo plus a written instruction produce a new image. LTX Ripple still needs an actual replacement image for frame 0; Photo Edit creates that image so the user can start from the extracted source frame and a description. Turbo uses an installed 8-step Lightning LoRA; Quality runs 40 steps without a LoRA. The mode is selected explicitly and saved with the Photo Edit draft.

1. In Ripple, choose a source video and use **Edit this frame with FireRed** beneath the extracted first frame.
2. In Photo Edit, describe the change and render. Review the saved image.
3. Use **Use as Ripple replacement**. Ripple retains its source clip and render controls and loads the edited image into Replacement Frame 0.

Photo Edit also accepts an independent local photo. Its draft and last saved output are stored locally; generated images are copied to the configured output directory under `FireRed Photo Edits`. If the save fails after ComfyUI has rendered, Retry save uses the same prompt ID. Choose existing edited image can select a previously completed ComfyUI output without rerendering. Rendering uses the [official FireRed 1.1 ComfyUI workflow](https://huggingface.co/FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI) as the graph reference: Qwen image edit conditioning from the source photo, a VAE-encoded source latent, AuraFlow sampling, and optional 8-step Lightning LoRA.

The frame resolution control is shared with Ripple. Photo Edit scales and center crops its source to the selected 32-pixel-aligned output dimensions before FireRed conditioning and encoding, then shows the saved image's actual dimensions. Ripple passes its chosen size into Photo Edit, and Photo Edit sends the actual result size back, so an edit stays aligned across the handoff. If a separately chosen existing image has a nonaligned size, Ripple rounds to a valid canvas and shows the resampling before rendering.

The workspace checks ComfyUI `/object_info` for a FireRed transformer in `models/diffusion_models`, a Qwen 2.5 VL 7B encoder in `models/text_encoders`, `qwen_image_vae.safetensors` in `models/vae`, and the required nodes. It accepts the official safetensors transformer or an official GGUF transformer through ComfyUI-GGUF; an installed GGUF is preferred to avoid loading a 40 GB bf16 model. When components are missing, rendering is disabled with a setup message. After installing models, restart ComfyUI and refresh the engine in Settings.
