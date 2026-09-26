const assert = require('node:assert/strict')
const { load } = require('./test-ts-loader.cjs')
const { sanitizeErrorMessage, sanitizeError } = load('src/lib/logSanitize.ts')

// --- sanitizeErrorMessage -------------------------------------------------

assert.equal(sanitizeErrorMessage(''), '', 'Empty input stays empty')
assert.equal(sanitizeErrorMessage('   '), '[details redacted]', 'Whitespace-only input has no fragments and is redacted')
assert.equal(sanitizeErrorMessage('The quick brown fox jumps over the lazy dog'), '[details redacted]', 'Prose with no technical fragments is redacted, never echoed')

const technical = sanitizeErrorMessage('ComfyUI failed to allocate VRAM, CUDA oom at step 42')
assert.equal(technical.includes('ComfyUI'), true)
assert.equal(technical.includes('CUDA'), true)
assert.equal(technical.includes('oom'), true)
assert.equal(technical.includes('42'), true, 'Numeric fragments are preserved')
assert.equal(technical.includes('allocate'), false, 'Prose around the fragments is dropped')

// A prose-only user prompt carries no technical fragments and must be redacted,
// never echoed back to the UI.
assert.equal(sanitizeErrorMessage('a cute puppy playing in the garden'), '[details redacted]', 'Prose user prompt is redacted, not surfaced')

const long = `connection refused at http://127.0.0.1:8188 ${'node '.repeat(100)} etimedout`
assert.equal(sanitizeErrorMessage(long).length <= 200, true, 'Output is capped at the documented length')

// --- sanitizeError --------------------------------------------------------

// Plain string errors carry their own message.
const fromString = sanitizeError('CUDA oom')
assert.equal(fromString.name, 'Error')
assert.equal(fromString.reason, 'CUDA oom')
assert.equal(fromString.path, '')

// null / undefined must not throw.
assert.deepEqual(sanitizeError(null), { name: 'Error', reason: '', path: '' })
assert.deepEqual(sanitizeError(undefined), { name: 'Error', reason: '', path: '' })

// Error instances: prose prompt text is redacted while a technical token survives.
const boom = new Error('a cute puppy playing in the garden but CUDA oom')
const cleaned = sanitizeError(boom)
assert.equal(cleaned.name, 'Error', 'Error name is preserved')
assert.equal(cleaned.reason.includes('puppy'), false, 'Prose prompt text is redacted from the reason')
assert.equal(cleaned.reason.includes('CUDA'), true, 'Technical fragment survives redaction')

const real = new Error('render failed')
const cleanedReal = sanitizeError(real)
assert.match(cleanedReal.path, /test-log-sanitize\.cjs:\d+:\d+/, 'First "at file:line:col" frame becomes the path')

// A non-Error object with name/message is honored.
const custom = sanitizeError({ name: 'RenderError', message: 'ffmpeg timeout', stack: '' })
assert.equal(custom.name, 'RenderError')
assert.equal(custom.reason, 'ffmpeg timeout')

console.log('PASS: error messages redact user prompts, preserve technical fragments, cap length and extract the source frame')
