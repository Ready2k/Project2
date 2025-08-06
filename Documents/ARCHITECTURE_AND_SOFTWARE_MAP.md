# Architecture & Software Map

This document provides a high-level overview of the voice-to-voice financial services assistant’s architecture and a software map of the main components in this client-side application.

---

## 1. System Overview

The application is a fully client-side, browser-based voice assistant for financial services support. It comprises:

- **Voice Processing Layer**: Captures microphone input, performs speech-to-text (OpenAI Whisper), and text-to-speech (OpenAI TTS).
- **Agent System**: Domain-specific agents (Banking Info, Payments, Fraud, Identity Verification) routed by an AI-powered AgentRouter.
- **Dual-Mode Engine**: Supports Batch (request→process→respond) and Streaming (real-time conversation) workflows.
- **Management & Configuration UI**: Interfaces for persona management, system-prompts (guardrails), voice settings, and performance dashboards.
- **Robustness Layer**: Error recovery, rate limiting, circuit-breakers, audit logging, and resource cleanup.
- **Testing Framework**: 100+ HTML/JS test suites covering unit, integration, and failure-simulation scenarios.

---

## 2. Logical Components

```text
 [Microphone] → [StreamingManager] → [Whisper API]
          ↘                            ↙
        [AgentRouter] → [Domain Agent] → [GPT API] → [TTS API]
                                         ↖
                                       [UI: Transcripts & Controls]
```

---

## 3. Software Map

Below is the filesystem layout of the key modules and their responsibilities.

| Path                                 | Description                                                 |
|--------------------------------------|-------------------------------------------------------------|
| index.html                           | Main UI shell, debug & test panels                          |
| main-styles.css                      | Core styling for the application UI                         |
| version-config.js                    | Application version and release metadata                    |
|                                      |                                                             |
| **Core JavaScript**                  |                                                             |
| main-interface.js                    | Orchestrates voice, agent and UI components                  |
| connection-manager.js                | Manages API request queue, rate limiting, retries            |
| streaming-manager.js                 | Handles real-time audio streaming and VAD                    |
| audio-resource-manager.js            | Audio context and media-stream resource cleanup              |
| token-tracker.js                     | Tracks token usage and metrics for cost monitoring           |
|                                      |                                                             |
| **Agent System**                     |                                                             |
| agents/                              | Domain-specific agent modules and helpers                   |
| agents/agent-router.js               | Routes user inputs to the appropriate agent                 |
| agents/base-agent.js                 | Abstract base class for all domain agents                   |
| agents/banking-info-agent.js         | Banking inquiries agent                                     |
| agents/payments-agent.js             | Payments processing agent                                   |
| agents/fraud-agent.js                | Fraud detection & reporting agent                           |
| agents/idv-agent.js                  | Identity verification agent                                 |
| agents/guardrails-manager.js         | Enforces system-prompts and capability restrictions          |
| agents/rate-limiter.js               | Client-side rate-limiting logic                             |
| agents/circuit-breaker.js            | Circuit-breaker for API failures                             |
| agents/audit-logger.js               | Tracks audit events and security boundaries                  |
| ...                                  | (other helpers: caching, fallback, telemetry hooks)         |
|                                      |                                                             |
| **Persona & Prompts**                |                                                             |
| personas.json                        | Sample customer personas and transaction data                |
| system-prompts.json                  | Base and custom system prompts (guardrails templates)        |
| persona-manager.js                   | Loads and persists persona data                              |
| system-prompts-manager.js            | Loads and persists custom prompt overrides                   |
|                                      |                                                             |
| **Admin & UI Modules**               |                                                             |
| persona-editor.html/js               | Persona management UI                                       |
| llm-manager-admin-ui.html/js         | Guardrails & voice-config administration UI                 |
| streaming-agent-integration.html/js  | Demo pages for streaming-mode workflows                      |
| configure-agents-example.js          | Sample agent configuration loader                           |
|                                      |                                                             |
| **Testing**                          |                                                             |
| test/                                | >100 test harnesses (unit, integration, failure-simulation) |
| test-modules.html                    | Quick smoke tests for core modules                           |

---

## 4. Deployment & Hosting

- **Local:** `python3 -m http.server` or any static file server
- **Production (static host):** GitHub Pages, Netlify, Vercel
- No build step: all files are delivered client-side.

---

_Last updated: please regenerate this map when core modules or directories change._
