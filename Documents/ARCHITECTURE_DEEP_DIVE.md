# Architecture Deep Dive

This document provides a narrative discussion of key design decisions and architectural patterns in the voice-to-voice financial assistant.

---

## 1. Dual-Mode Operation: Batch vs. Streaming

The application supports two interaction modes:

- **Batch Mode**: Records a complete speech segment, then sends it to the ASR, routes to the agent, and returns a synthesized response. This simplifies error recovery and ensures clear turn-taking.
- **Streaming Mode**: Opens a continuous, low-latency audio stream to the ASR (OpenAI Realtime API) and renders TTS chunks on-the-fly for true conversational feel.

Rationale:
- Batch mode provides robustness and easier debugging for short queries.
- Streaming mode offers a natural back-and-forth experience, essential for extended dialogues or voice-driven IVR systems.

---

## 2. Guardrails & Security Boundaries

All domain agents enforce strict guardrails via system prompts and capability checks:

- **System Prompts** drive the assistant’s base personality and domain constraints (e.g. only discuss banking topics).
- **Capability Lists** in agent configs limit permitted operations (e.g. PaymentsAgent cannot handle fraud inquiries).
- **Audit Logging** records every request and guardrail decision for compliance and debugging.

These policies live in JSON (`system-prompts.json`, `config/agents/*.json`) and are loaded at runtime, enabling no-code adjustments.

---

## 3. Robustness & Resilience Layer

Key patterns ensure fault tolerance and graceful degradation:

- **Circuit Breakers** halt requests to unstable services after repeated failures.
- **Exponential Backoff** retries recover from transient API errors.
- **Rate Limiting** prevents runaway costs or abuse by capping requests per agent.
- **Resource Cleanup** on the Web Audio and MediaRecorder APIs avoids memory leaks when users start/stop sessions frequently.

These components are implemented in `agents/circuit-breaker.js`, `agents/rate-limiter.js`, and `connection-manager.js`.

---

## 4. Extensibility & Modularity

The codebase is organized into clear ES6 modules:

- **Domain Agents** (`agents/*.js`): Each agent extends `BaseAgent` and implements `process()`.
- **Routing & SPI**: The `AgentRouter` routes user input to agents; new agents can be registered by adding config and class definitions.
- **Configuration-Driven**: Almost every behavior (voice settings, prompts, guardrails) is driven by external JSON—no code changes required for new domains.

This modular structure makes it straightforward to add new agents, swap in different ASR/TTS providers, or integrate server-side extensions.

---

## 5. Testing & Observability

Over 100 test harnesses simulate unit, integration, and failure scenarios. The key testing patterns:

- **HTML/JS Test Pages** invoke individual modules in isolation via browser platforms.
- **Failure Simulations** inject faults (network errors, localStorage failures) to validate retry and cleanup logic.
- **Telemetry Hooks** and the `AgentTelemetry` module gather metrics on usage, errors, and performance, aiding continuous improvement.

Together, these ensure high confidence in each component before deployment.
