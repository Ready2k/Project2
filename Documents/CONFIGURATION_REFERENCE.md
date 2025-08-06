# Configuration & API Reference

This reference details the JSON and API configuration formats used by the voice-to-voice assistant.

---

## 1. Agent Configuration (config/agents/*.json)

Each domain agent has a JSON file under `config/agents/` defining its guardrails, system prompts, and operational settings:

| Field             | Type           | Description                                                 |
|-------------------|----------------|-------------------------------------------------------------|
| id                | string         | Unique agent identifier (e.g. "PaymentsAgent").           |
| name              | string         | Human-readable agent name displayed in UI.                  |
| description       | string         | Short summary of agent domain and responsibilities.         |
| systemPromptKey   | string         | Key into `system-prompts.json` for the base prompt.         |
| capabilities      | array[string]  | List of allowed operations (e.g. ["transfer","balance"]).|
| rateLimitPerMin   | integer        | Maximum requests per minute to OpenAI for this agent.      |
| retryPolicy       | object         | Exponential backoff settings: `{initialDelayMs, maxRetries}`|
| voiceSettings     | object         | Default TTS voice config: `{voiceName, speed, quality}`     |

Example (`config/agents/payments-agent-config.json`):
```json
{
  "id": "PaymentsAgent",
  "name": "Payments Processor",
  "description": "Handles customer money transfers and payment inquiries.",
  "systemPromptKey": "financialContext",
  "capabilities": ["transfer","balance","transactionHistory"],
  "rateLimitPerMin": 60,
  "retryPolicy": { "initialDelayMs": 500, "maxRetries": 3 },
  "voiceSettings": { "voiceName": "Nova", "speed": 1.0, "quality": "high" }
}
```

---

## 2. System Prompts (system-prompts.json)

Defines reusable prompt templates that enforce guardrails, personality, and domain context.

| Key               | Description                                                 |
|-------------------|-------------------------------------------------------------|
| basePersonality   | Global assistant behavior and tone.                         |
| financialContext  | Common financial instructions (UK terminology, regulations).|
| responseInstructions | Voice response guidelines (length, style, contractions).|
| customPrompts     | List of named domain‑specific prompt fragments.             |

Example snippet:
```json
{
  "basePersonality": "You are a helpful, professional AI assistant...",
  "financialContext": "When handling financial services requests:...",
  "responseInstructions": "Response Guidelines:\n1. Keep responses conversational,...",
  "customPrompts": [
    { "name": "Loan Inquiries", "prompt": "When discussing loans..." },
    { "name": "Account Security", "prompt": "For security-related queries..." }
  ]
}
```

---

## 3. Persona Schema (personas.json)

Defines sample customer profiles and their transaction history.

| Field              | Type            | Description                               |
|--------------------|-----------------|-------------------------------------------|
| id                 | string          | Persona identifier (e.g. "alice_001").   |
| name               | string          | Customer full name.                       |
| accountNumber      | string          | UK bank account number (formatted).       |
| sortCode           | string          | UK sort code.                             |
| balance            | number          | Current account balance in GBP.           |
| transactions       | array[object]   | List of recent transactions.              |

Each transaction:
```json
{
  "date": "2023-03-15",
  "description": "Coffee Shop",
  "amount": -3.50,
  "currency": "GBP"
}
```

---

## 4. Version & Release (version-config.js)

Minimal config for application versioning:
```js
export default {
  version: '2.4.2',
  buildDate: '2023-07-28T12:34:56Z'
};
```

---

_Keep this reference up to date when introducing new config fields or agent capabilities._
