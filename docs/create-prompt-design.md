# Create prompt design

The Create tab uses one editor with two authoring aids:

- `//` searches the existing production preset library. The picker stays beside the prompt, filters by category, and inserts editable text at the cursor. Arrow keys move through results; Enter or Tab inserts; Escape closes.
- `##` opens the existing H3 section picker. Auto tag adds a `##scene` section and recognizes explicit scene, sound, and music labels. It leaves already tagged prompts untouched.

Local inline suggestions are short append-only continuations. They appear beneath the prompt for review, and Tab or click accepts one. Editing the prompt invalidates an earlier response. The bottom bar saves the on/off preference locally. The initial state is off, so opening an existing project does not send prompts to a model automatically.

The desktop bridge routes both Ollama and LM Studio requests through Electron. LM Studio uses its OpenAI-compatible `/v1/chat/completions` endpoint and a small token limit. The UI shows the selected provider and model, and exposes connection errors without changing the prompt.

Design references: [W3C editable combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/), [VS Code inline suggestion behavior](https://code.visualstudio.com/docs/editing/ai-powered-suggestions), [LM Studio API overview](https://lmstudio.ai/docs/developer/rest), and [LM Studio OpenAI-compatible endpoints](https://lmstudio.ai/docs/developer/openai-compat).
