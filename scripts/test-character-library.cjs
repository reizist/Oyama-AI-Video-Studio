const assert = require('node:assert/strict')
const { load } = require('./test-ts-loader.cjs')

const { removeCharacterImage, characterReferences } = load('src/lib/characterLibrary.ts')
const image = name => ({ path: `C:/characters/${name}.png`, name: `${name}.png`, kind: 'image' })
const master = image('master')
const profile = image('profile')
const detail = image('detail')
const character = {
  id: 'character-1', name: 'Actor', referenceMode: 'set', baseImage: master,
  referenceImages: [master, profile], selectedReferencePaths: [master.path],
  detailReferences: [{ id: 'eyes', label: 'Eyes', notes: '', images: [master, detail], image: master }],
}

const removed = { ...character, ...removeCharacterImage(character, master.path) }
assert.equal(removed.id, character.id, 'the character remains')
assert.equal(removed.baseImage, undefined, 'primary image is removed')
assert.deepEqual(removed.referenceImages.map(file => file.path), [profile.path], 'only the chosen identity image is removed')
assert.deepEqual(Array.from(removed.selectedReferencePaths), [profile.path], 'a remaining image becomes the selected anchor')
assert.deepEqual(removed.detailReferences[0].images.map(file => file.path), [detail.path], 'shared detail references are cleared')
assert.equal(removed.detailReferences[0].image, undefined, 'legacy detail image is cleared')
assert.deepEqual(Array.from(characterReferences(removed), file => file.path), [profile.path], 'renders use only remaining references')
assert.equal(character.baseImage.path, master.path, 'the input record is not mutated')

process.stdout.write('PASS: character image removal preserves the character and removes all links to the chosen image\n')
