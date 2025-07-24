# 🎤 Voice-to-Voice Financial Services Bot

An advanced AI-powered voice assistant for financial services customer support, featuring **dual-mode operation** (Batch & Streaming), real-time speech recognition, natural voice responses, comprehensive customer persona management, and **configurable AI system prompts** - all without touching code!

## 🚀 Quick Start

Simply open `index.html` in your browser or run a local server:
```bash
python3 -m http.server 8000
# Then visit http://localhost:8000
```

## ✨ Key Features

### 🔄 **Dual-Mode Operation**
- **Batch Mode**: Traditional record → process → respond workflow
- **Streaming Mode**: Real-time conversation using OpenAI Realtime API with full-duplex audio
- **Seamless switching** between modes with visual toggle
- **Mode-specific settings** and optimizations

### 🧠 **Advanced LLM Manager System**
- **Configuration Templates**: Pre-built agent setups (Basic Banking, Security-Focused, Payments Specialist, Customer Service)
- **Performance Metrics Dashboard**: Real-time monitoring with charts, success rates, and token usage analytics
- **Configuration Comparison Tools**: Side-by-side agent comparison with compatibility scoring
- **Scheduled Configuration Changes**: Time-based updates with rollback support and notifications
- **Multi-Environment Management**: Development, staging, and production environment separation with promotion workflows

### 🎙️ **Advanced Speech Recognition**
- **OpenAI Whisper** integration for high-accuracy speech-to-text
- **Financial context optimization** for banking terminology
- **Multi-language support** (English variants: US, UK, AU)
- **Noise reduction** and audio quality enhancement
- **Persistent microphone access** - eliminates permission popups

### 🗣️ **Natural Voice Responses**
- **OpenAI TTS** with 6 professional voices (Nova, Shimmer, Onyx, etc.)
- **High-quality audio** (TTS-1 and TTS-1-HD models)
- **Customizable speech speed** and voice selection
- **Natural conversation flow** with proper pauses

### 👥 **JSON-Driven Customer Persona Management**
- **Fully modular personas** - extracted to separate JSON file and manager class
- **UK Sterling currency** - all amounts displayed in proper GBP formatting (£1,234.56)
- **Transaction management** - add/remove transactions with real-time balance updates
- **Pre-loaded UK customer profiles** - realistic data with UK merchants
- **Admin panel** for comprehensive persona and transaction management
- **Dynamic persona switching** for testing various customer scenarios

### 🤖 **JSON-Driven AI System Prompts**
- **Fully modular system prompts** - extracted to separate JSON file and manager class
- **No-code AI customization** - modify AI behavior by editing JSON or admin panel
- **Base personality configuration** - set tone, empathy, professionalism
- **Financial context prompts** - customize banking procedures and UK-specific responses
- **Real-time prompt testing** - preview generated prompts before use
- **Banking restrictions** - configurable topic limitations

### 📞 **Full-Duplex Streaming Mode**
- **Real-time conversation** - Continuous bidirectional audio like a phone call
- **OpenAI Realtime API** - Direct WebSocket connection to GPT-4o Realtime
- **Voice Activity Detection** - Server-side VAD with configurable sensitivity
- **Persona integration** - AI knows customer details (balance, transactions, card info)
- **Real-time audio streaming** - PCM16 audio processing with proper buffering
- **Text + Audio responses** - See responses in chat AND hear them spoken

### 💰 **Comprehensive Cost Tracking**
- **Real-time token usage monitoring** for all OpenAI services
- **Cost breakdown** by service (Whisper, GPT, TTS)
- **Usage analytics** with detailed pricing information
- **Reset functionality** for cost tracking

### 🔍 **Debug & Development Tools**
- **Real-time API communication display**
- **Speech-to-text transcription monitoring**
- **System prompt and GPT response visibility**
- **Voice generation details and statistics**
- **Enhanced audio level monitoring** with quality indicators

### 🧪 **Advanced Testing System**
- **Mock vs Real API Testing** - Switch between simulated and actual OpenAI API calls
- **Test Mode Selector** - Visual toggle for development vs production testing
- **Comprehensive Test Suites** - Agent routing, security boundaries, streaming compatibility, semantic matching
- **Performance Validation** - Token usage tracking and response time monitoring
- **Security Testing** - Data access boundary validation and audit logging
- **AI Routing Tests** - Contextual conversation flow and semantic understanding validation

### 🔧 **Professional Admin Interface**
- **Visual Notification System** - Toast notifications for all user actions with auto-dismiss
- **Bulk Agent Operations** - Enable/disable all agents with proper async handling
- **Configuration Validation** - Smart validation supporting both full and partial updates
- **Real-time Status Updates** - Live feedback for all administrative operations
- **Error Recovery** - Graceful degradation and comprehensive error handling

## 🎯 Supported Use Cases

### **Financial Services Scenarios:**
- **Lost Card Reporting** - "I've lost my credit card"
- **Account Balance Inquiries** - "What's my account balance?"
- **Transaction History** - "Tell me about my recent transactions"
- **Transaction Disputes** - "I need to dispute a charge"
- **Money Transfers** - "How do I transfer money?"
- **Account Information** - "What type of account do I have?"
- **General Banking Support** - Various customer service scenarios

## 🛠️ Technical Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Architecture**: Modular design with separated concerns
  - `api-client.js` - OpenAI API interactions (Whisper, GPT, TTS)
  - `token-tracker.js` - Usage tracking and cost calculation
  - `streaming-manager.js` - Real-time WebSocket streaming
  - `persona-manager.js` - Customer persona management
  - `system-prompts-manager.js` - AI system prompts configuration
  - `script.js` - Main application logic and UI coordination
- **Agent System**: Domain-specific intelligent routing with AI-powered semantic matching
  - `agents/agent-router.js` - Central routing with contextual conversation support
  - `agents/base-agent.js` - Abstract base class for all agents
  - `agents/banking-info-agent.js` - Account information specialist
  - `agents/payments-agent.js` - Payment processing specialist
  - `agents/fraud-agent.js` - Security and fraud prevention
  - `agents/idv-agent.js` - Identity verification specialist
  - `agents/llm-manager.js` - Advanced configuration management system
  - `agents/guardrails-manager.js` - Security and compliance management
  - `agents/voice-config-manager.js` - Voice and audio configuration
  - `agents/config-update-manager.js` - Real-time configuration updates
- **Testing Framework**: Comprehensive test mode system with advanced features testing
  - `test-api-factory.js` - Mock vs Real API client factory
  - `test-mode-selector.js` - Visual test mode switching UI
  - `debug-manager.js` - Enhanced debugging with test mode support
  - `llm-manager-advanced-ui.js` - Advanced features UI controller
  - **Test Suites**: 
    - `test-llm-manager-advanced-features.html` - Advanced features comprehensive testing
    - `test-ai-agent-routing.html` - AI routing and semantic matching tests
    - `test-agent-configuration.html` - Agent configuration management tests
    - `test-script-loading.html` - Dependency loading verification
- **APIs**: OpenAI (Whisper, GPT-3.5-turbo, TTS, Realtime API)
- **Audio**: Web Audio API, MediaRecorder API
- **Storage**: LocalStorage for settings persistence

## 📋 Setup Instructions

### 1. **Clone the Repository**
```bash
git clone https://github.com/Ready2k/Project2.git
cd Project2
```

### 2. **Get OpenAI API Key**
- Visit [OpenAI Platform](https://platform.openai.com/api-keys)
- Create a new API key
- Ensure you have credits for Whisper, GPT-3.5-turbo, and TTS usage

### 3. **Configure the Application**
- Open the application in your browser
- When you first use a feature requiring OpenAI (recording, TTS, streaming), you'll be prompted to enter your API key
- The key is stored in memory for the session only (not saved to disk)
- Configure voice and speech recognition settings in the **Settings** tab
- Test the modules with `test-modules.html` (optional)

### 4. **Test the System**

#### **Batch Mode (Traditional):**
- Select a customer persona (John Doe, Sarah Smith, or Mike Johnson)
- Click "🎤 Start Speaking"
- Grant microphone permissions (only once - permissions persist)
- Say something like "What's my account balance?"
- Listen to the AI response

#### **Streaming Mode (Real-time):**
- Toggle "Streaming Mode" switch
- Click "📞 Connect" to establish real-time connection
- Grant microphone permissions
- Have a natural conversation - AI responds automatically when you stop speaking
- See responses in chat AND hear them spoken simultaneously

#### **Testing Modes:**
- **Mock Mode (Default)**: Free testing with simulated API responses - no API key required
- **Real Mode**: Actual OpenAI API calls for production validation - requires API key and costs money
- Use the test mode selector in any test page to switch between modes
- Access comprehensive test suites at:
  - `test-agent-system-comprehensive.html` - Complete agent system testing
  - `test-ai-agent-routing.html` - AI-powered semantic routing tests
  - `test-llm-manager-advanced-features.html` - Advanced LLM Manager features testing
  - `test-agent-configuration.html` - Agent configuration management testing
  - `test-script-loading.html` - Script loading and dependency verification
  - `test-mode-example.html` - Simple test mode demonstration

## 🧪 Test Mode System

The application includes a comprehensive testing framework that supports both **Mock** and **Real** API testing modes:

### **Mock Mode (Default)**
- ✅ **Free testing** - No API costs or key required
- ✅ **Realistic responses** - Simulated banking scenarios with proper delays
- ✅ **Token tracking simulation** - Practice cost monitoring without charges
- ✅ **Full functionality** - All features work with mock data
- ✅ **Development friendly** - Perfect for development and demonstration

### **Real Mode**
- 🌐 **Production validation** - Actual OpenAI API calls
- 🌐 **Real cost tracking** - Accurate token usage and billing
- 🌐 **Live API testing** - Validate against actual OpenAI services
- ⚠️ **Requires API key** - OpenAI API key needed
- ⚠️ **Costs money** - Real API usage charges apply

### **Test Mode Controls**
```javascript
// Console commands for test mode management
getTestMode()        // Check current mode ('mock' or 'real')
setTestMode('real')  // Switch to real API mode
setTestMode('mock')  // Switch to mock mode
toggleTestMode()     // Toggle between modes
```

### **Using Test Mode in Development**
```javascript
// Create API client respecting current test mode
const apiClient = TestAPIFactory.createAPIClient();

// Create complete test context
const testContext = TestAPIFactory.createTestContext();

// The system automatically uses mock or real APIs based on current mode
const result = await agentRouter.route(userInput, testContext);
```

## 🏗️ JSON-Driven Architecture

### **Modular Configuration System**
The application uses a fully modular, JSON-driven architecture that separates data from code:

#### **Customer Personas** (`personas.json`)
```json
{
  "john_doe": {
    "name": "John Doe",
    "balance": 2450.75,
    "currency": "GBP",
    "cardLast4": "1234",
    "accountType": "checking",
    "recentTransactions": [...]
  }
}
```

#### **AI System Prompts** (`system-prompts.json`)
```json
{
  "basePersonality": "You are a helpful, professional AI assistant...",
  "financialContext": "When handling financial services requests...",
  "responseInstructions": "Response Guidelines...",
  "customPrompts": [...]
}
```

### **Benefits of JSON-Driven Design**
- ✅ **No code changes needed** - modify behavior by editing JSON files
- ✅ **Easy deployment** - update personas/prompts without redeployment
- ✅ **Version control friendly** - track changes to AI behavior
- ✅ **Team collaboration** - non-developers can modify AI behavior
- ✅ **A/B testing ready** - swap configurations easily

## ⚙️ Configuration Options

### **Speech Recognition Settings**
- **Audio Quality**: Standard (16kHz) vs High (48kHz)
- **Noise Reduction**: Off/Low/Medium/High
- **Language Model**: English variants for accent optimization
- **Recognition Mode**: Financial context vs Precise vs Standard
- **Keep Microphone Active**: Prevents permission popups between recordings

### **Voice Response Settings**
- **TTS Model**: TTS-1 (fast) vs TTS-1-HD (high quality)
- **Voice Selection**: 6 professional voices available
- **Speech Speed**: 0.25x to 4.0x speed control

## 📊 Cost Estimation

Based on typical usage patterns:
- **Whisper**: ~$0.006 per minute of audio
- **GPT-3.5-turbo**: ~$0.002 per conversation
- **TTS**: ~$0.015-0.030 per 1K characters

A 5-minute conversation typically costs **$0.05-0.10** total.

## 🔒 Security & Privacy

- **API keys stored in memory only** - not persisted to disk or localStorage
- **Session-based key storage** - key is requested when needed and cleared on page refresh
- **No audio data persistence** - processed in real-time
- **OpenAI API compliance** with their data usage policies
- **Client-side processing** for maximum privacy

⚠️ **Security Notice**: This project is a prototype and not intended for production use. No data is stored, and no encryption is enforced. Do not use real customer data.

## 🆕 Recent Major Updates

### **Advanced LLM Manager Features (v2.1.0)**
- ✅ **Configuration Templates**: 4 pre-built agent templates for quick setup
- ✅ **Performance Metrics**: Real-time monitoring dashboard with charts and analytics
- ✅ **Configuration Comparison**: Side-by-side agent comparison with diff tools
- ✅ **Scheduled Changes**: Time-based configuration updates with rollback support
- ✅ **Multi-Environment Management**: Development, staging, production workflows

### **Critical Bug Fixes & Improvements**
- ✅ **Script Loading Fix**: Resolved GuardrailsManager dependency issues
- ✅ **Async/Sync Routing Fix**: Fixed agent.onActivate function errors in tests
- ✅ **Semantic Matching Enhancement**: Improved AI contextual understanding for ambiguous responses
- ✅ **Admin Interface Fix**: Added professional notification system and fixed bulk operations
- ✅ **Partial Configuration Updates**: Enhanced validation for partial agent configuration updates

### **Enhanced Testing Infrastructure**
- ✅ **5 New Test Suites**: Comprehensive testing for all new features
- ✅ **Automated Verification**: Script-based testing with detailed reporting
- ✅ **Semantic Understanding Tests**: Contextual conversation flow validation
- ✅ **Performance Testing**: Metrics accuracy and system reliability validation

See `RECENT_FIXES_SUMMARY.md` for complete details on all improvements.

## 🚀 Deployment Options

### **Local Development**
```bash
python3 -m http.server 8000
```

### **Static Hosting**
Deploy to any static hosting service:
- GitHub Pages
- Netlify
- Vercel
- AWS S3 + CloudFront

### **Production Considerations**
- Implement API key management (environment variables)
- Add rate limiting and usage quotas
- Consider WebSocket connections for real-time features
- Add user authentication for multi-tenant usage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

**Built with ❤️ for the future of voice-enabled financial services**
