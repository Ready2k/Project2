# Technology Stack & Build System

## Core Technologies

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Architecture**: Modular ES6 classes with dependency injection
- **APIs**: OpenAI (Whisper, GPT-3.5/4, TTS, Realtime API)
- **Audio**: Web Audio API, MediaRecorder API
- **Storage**: LocalStorage for settings and configuration persistence

## Key Libraries & Frameworks

- **Font Awesome 6.0.0**: Icons via CDN
- **No build tools**: Direct browser execution, no compilation step
- **No package manager**: All dependencies loaded via script tags or CDN

## Architecture Patterns

- **Agent-Based System**: Domain-specific agents (Banking, Payments, Fraud, IDV) with base class inheritance
- **Manager Pattern**: Separate managers for personas, system prompts, LLM configuration, voice settings
- **JSON-Driven Configuration**: External JSON files for personas, system prompts, and agent configurations
- **Debug Logging**: Centralized debug manager with module-specific loggers
- **Security Sandboxing**: Security manager with sandboxed API clients for agents

## Development Commands

### Local Development Server
```bash
# Python 3 (recommended)
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (if available)
npx serve . -p 8000

# PHP (if available)
php -S localhost:8000
```

### Testing
- **No automated test runner**: Tests are HTML pages opened in browser
- **Test files**: Located in `/test/` directory
- **Main test suites**:
  - `test-agent-system-comprehensive.html` - Complete agent system testing
  - `test-llm-manager-comprehensive.html` - LLM manager features
  - `test-streaming-integration.html` - Real-time streaming tests

### Deployment
- **Static hosting**: Can be deployed to any static web host (GitHub Pages, Netlify, Vercel)
- **No build step**: Direct file upload to hosting service
- **Environment variables**: API keys entered via UI (not environment-based)

## File Loading Patterns

- **Script loading order matters**: Dependencies must be loaded before dependents
- **Global namespace**: Classes attached to `window` object for cross-module access
- **Async initialization**: Many components use async `init()` methods
- **Error handling**: Graceful degradation when optional dependencies are missing