const assert = require('node:assert/strict')
const { load } = require('./test-ts-loader.cjs')
const { buildFireRedEditWorkflow, inferFireRedSelection, FIRE_RED_REQUIRED_NODES } = load('src/lib/fireRedEditWorkflow.ts')

const info = {
  UNETLoader: { input: { required: { unet_name: [['FireRed-Image-Edit-1.0-transformer.safetensors', 'FireRed-Image-Edit-1.1-transformer.safetensors']] } } },
  CLIPLoader: { input: { required: { clip_name: [['qwen_2.5_vl_7b_fp8_scaled.safetensors']] } } },
  VAELoader: { input: { required: { vae_name: [['qwen_image_vae.safetensors']] } } },
  LoraLoaderModelOnly: { input: { required: { lora_name: [['FireRed-Image-Edit-1.0-Lightning-8steps-v1.1.safetensors']] } } },
}
const selected = inferFireRedSelection(info)
assert.equal(selected.model, 'FireRed-Image-Edit-1.1-transformer.safetensors')
assert.equal(selected.modelLoader, 'UNETLoader')
assert.equal(selected.encoder, 'qwen_2.5_vl_7b_fp8_scaled.safetensors')
assert.equal(selected.lightningLora, 'FireRed-Image-Edit-1.0-Lightning-8steps-v1.1.safetensors')
assert.equal(inferFireRedSelection({ ...info, LoraLoaderModelOnly: { input: { required: { lora_name: [['FireRed-Image-Edit-1.0-Lightning-8steps-v1.1.safetensors', 'FireRed-Image-Edit-1.1-Lightning-8steps-v1.2.safetensors']] } } } }).lightningLora, 'FireRed-Image-Edit-1.1-Lightning-8steps-v1.2.safetensors')
assert.equal(inferFireRedSelection({}).model, '')

const size = { width: 1024, height: 576 }
const graph = buildFireRedEditWorkflow({ name: 'frame.png', subfolder: 'ripple' }, 'Change only the jacket to red.', 42, selected, 'turbo', size)
assert.equal(graph['4'].inputs.image, 'ripple/frame.png')
assert.equal(graph['5'].class_type, 'ImageScale')
assert.equal(graph['5'].inputs.width, 1024)
assert.equal(graph['5'].inputs.height, 576)
assert.deepEqual(Array.from(graph['7'].inputs.image1), ['5', 0])
assert.deepEqual(Array.from(graph['8'].inputs.image1), ['5', 0])
assert.deepEqual(Array.from(graph['6'].inputs.pixels), ['5', 0])
assert.equal(graph['7'].inputs.prompt, 'Change only the jacket to red.')
assert.equal(graph['11'].inputs.steps, 8)
assert.equal(graph['11'].inputs.cfg, 1)
assert.deepEqual(Array.from(graph['9'].inputs.model), ['13', 0])
assert.deepEqual(Array.from(graph['14'].inputs.images), ['12', 0])
assert.equal(graph['14'].inputs.filename_prefix, 'FireRed/Photo_Edit')
const referenced = buildFireRedEditWorkflow({ name: 'frame.png' }, 'Use Image 2 for the jacket and Image 3 for the hat.', 42, selected, 'turbo', size, [{ name: 'jacket.png', subfolder: 'refs' }, { name: 'hat.png', subfolder: 'refs' }])
assert.equal(referenced['15'].inputs.image, 'refs/jacket.png')
assert.equal(referenced['16'].inputs.image, 'refs/hat.png')
for (const encoder of ['7', '8']) {
  assert.deepEqual(Array.from(referenced[encoder].inputs.image2), ['15', 0])
  assert.deepEqual(Array.from(referenced[encoder].inputs.image3), ['16', 0])
}
assert.deepEqual(Array.from(referenced['6'].inputs.pixels), ['5', 0], 'Source photo still determines the output latent')
const oneReference = buildFireRedEditWorkflow({ name: 'frame.png' }, 'Use Image 2.', 42, selected, 'quality', size, [{ name: 'jacket.png' }])
assert.equal(oneReference['16'], undefined)
assert.equal(oneReference['7'].inputs.image3, undefined)
const quality = buildFireRedEditWorkflow({ name: 'frame.png' }, 'Keep the face.', 2, selected, 'quality', size)
assert.equal(quality['11'].inputs.steps, 40)
assert.equal(quality['11'].inputs.cfg, 4)
assert.equal(quality['13'], undefined)
const ggufSelection = inferFireRedSelection({ ...info, UnetLoaderGGUF: { input: { required: { unet_name: [['FireRed-Image-Edit-1.1-transformer-q4_1.gguf', 'FireRed-Image-Edit-1.1-transformer-q4_k_m.gguf']] } } } })
assert.equal(ggufSelection.model, 'FireRed-Image-Edit-1.1-transformer-q4_k_m.gguf')
assert.equal(ggufSelection.modelLoader, 'UnetLoaderGGUF')
assert.equal(buildFireRedEditWorkflow({ name: 'frame.png' }, 'Edit', 1, ggufSelection, 'quality', size)['1'].class_type, 'UnetLoaderGGUF')
assert.throws(() => buildFireRedEditWorkflow({ name: 'frame.png' }, '  ', 42, selected, 'turbo', size), /Describe the photo edit/)
assert.throws(() => buildFireRedEditWorkflow({ name: 'frame.png' }, 'Edit', -1, selected, 'turbo', size), /valid nonnegative seed/)
assert.throws(() => buildFireRedEditWorkflow({ name: 'frame.png' }, 'Edit', 1, { ...selected, lightningLora: '' }, 'turbo', size), /Turbo requires/)
assert.throws(() => buildFireRedEditWorkflow({ name: 'frame.png' }, 'Edit', 1, selected, 'quality', { width: 1024, height: 575 }), /aligned to 32/)
assert.throws(() => buildFireRedEditWorkflow({ name: 'frame.png' }, 'Edit', 1, selected, 'quality', size, [{ name: 'a.png' }, { name: 'b.png' }, { name: 'c.png' }]), /up to two reference/)
for (const type of [...FIRE_RED_REQUIRED_NODES, 'LoraLoaderModelOnly']) assert.ok(Object.values(graph).some(node => node.class_type === type), `${type} in FireRed graph`)
console.log('PASS: FireRed model selection, source and reference conditioning, Lightning and quality graphs, and validation')
