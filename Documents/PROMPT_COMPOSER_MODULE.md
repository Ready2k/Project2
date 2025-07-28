
# 📘 PROMPT_COMPOSER_MODULE.md

## Purpose

The `prompt-composer.js` module builds a validated prompt message array for use in LLM calls. It merges:

- A **non-negotiable global system prompt**
- An optional **agent-level system prompt**
- And validates agent prompts using a **guardrails manager**

## Usage

```
import { buildPromptMessages } from './prompt-composer.js';

const messages = buildPromptMessages({
  systemPrompt: "Always be professional.",
  agentPrompt: "Speak like a pirate!",
  guardrails: {
    checkPromptOverride(globalPrompt, agentPrompt) {
      if (agentPrompt.includes("pirate")) return "Pirate persona is disallowed.";
      return null;
    }
  }
});
```

## Result Format

Returns an array like:

```json
[
  { "role": "system", "content": "Always be professional." },
  { "role": "system", "content": "Speak like a pirate!" }
]
```

If the guardrails reject the agent prompt, it is omitted and only the global prompt is sent.

## Integration Instructions

1. Place `prompt-composer.js` in the `agents/` folder.
2. Import and use in your LLM provider logic (e.g., OpenAI or custom provider).
3. Run `test/test-prompt-composer.html` in a browser to validate behavior.

