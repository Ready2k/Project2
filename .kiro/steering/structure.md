# Project Structure & Organization

## Root Directory Layout

```
/
├── index.html                 # Main application entry point
├── script.js                  # Core application logic (4000+ lines)
├── main-styles.css           # Primary stylesheet
├── api-client.js             # OpenAI API integration
├── personas.json             # Customer persona configurations
├── system-prompts.json       # AI system prompt templates
├── version-config.js         # Version and release information
└── README.md                 # Comprehensive project documentation
```

## Core Modules

```
/
├── persona-manager.js        # Customer persona management
├── system-prompts-manager.js # AI prompt configuration
├── streaming-manager.js      # Real-time audio streaming
├── token-tracker.js          # API usage and cost tracking
├── connection-manager.js     # Network connection handling
├── debug-manager.js          # Centralized debug logging
└── main-interface.js         # UI coordination and state management
```

## Agent System (`/agents/`)

```
agents/
├── base-agent.js            # Abstract base class for all agents
├── agent-router.js          # Central routing with AI-powered selection
├── agent-config-manager.js  # Agent configuration management
├── llm-manager.js           # Advanced LLM configuration system
├── banking-info-agent.js    # Account information specialist
├── payments-agent.js        # Payment processing specialist
├── fraud-agent.js           # Security and fraud prevention
├── idv-agent.js            # Identity verification specialist
├── guardrails-manager.js    # Security and compliance management
└── security-manager.js      # Security sandboxing and validation
```

## Testing Framework (`/test/`)

```
test/
├── test-agent-system-comprehensive.html    # Complete agent testing
├── test-llm-manager-comprehensive.html     # LLM manager features
├── test-streaming-integration.html         # Real-time streaming tests
├── test-guardrails-system.html            # Security compliance tests
├── verify-*.js                            # Automated verification scripts
└── test-*.html                            # Individual component tests
```

## Documentation (`/Documents/`)

```
Documents/
├── FEATURES.md                    # Feature documentation
├── IMPLEMENTATION_SUMMARY.md      # Technical implementation details
├── TESTING_GUIDE.md              # Testing procedures and guidelines
├── GUARDRAILS_SYSTEM_GUIDE.md    # Security and compliance guide
└── *_SUMMARY.md                  # Various feature summaries
```

## Naming Conventions

- **Files**: kebab-case for HTML/CSS, camelCase for JavaScript
- **Classes**: PascalCase (e.g., `BaseAgent`, `PersonaManager`)
- **Methods**: camelCase (e.g., `canHandle()`, `processAudio()`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `VERSION_CONFIG`)
- **CSS Classes**: kebab-case with BEM methodology where applicable

## Module Dependencies

- **Core App** (`script.js`) depends on all managers and API client
- **Agents** depend on `base-agent.js` and are managed by `agent-router.js`
- **Managers** are standalone but may depend on debug-manager
- **Test files** are independent and can be run individually

## Configuration Files

- **JSON configs**: `personas.json`, `system-prompts.json` - runtime configuration
- **Version config**: `version-config.js` - build and release information
- **Git config**: `.gitignore` - standard web project exclusions
- **No package.json**: Pure client-side application, no Node.js dependencies