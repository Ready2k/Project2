# 🎤 Voice-to-Voice Financial Services Assistant

An advanced AI-powered voice assistant for financial services customer support with **intelligent agent routing**, **dual-mode operation** (Batch & Streaming), real-time speech recognition, natural voice responses, and comprehensive management interfaces.

## 🚀 Quick Start

Simply open `index.html` in your browser or run a local server:
```bash
python3 -m http.server 8000
# Then visit http://localhost:8000
```

## ✨ Key Features

### 🤖 **Intelligent Agent System**
- **Domain-Specific Agents**: Banking Info, Payments, Fraud Detection, Identity Verification
- **AI-Powered Routing**: Automatic request routing to appropriate specialist agents
- **Security Boundaries**: Each agent restricted to its domain with audit logging
- **Guardrails Management**: Configurable capability restrictions per agent
- **Performance Monitoring**: Real-time metrics and success rate tracking

### 🔄 **Dual-Mode Operation**
- **Batch Mode**: Traditional record → process → respond workflow
- **Streaming Mode**: Real-time conversation using OpenAI Realtime API
- **Seamless switching** between modes with visual toggle
- **Agent integration** in both modes for consistent experience

### 🎙️ **Advanced Voice Processing**
- **OpenAI Whisper**: High-accuracy speech-to-text with financial terminology
- **OpenAI TTS**: 6 professional voices with customizable speed and quality
- **Real-time streaming**: Full-duplex audio with voice activity detection
- **Persistent microphone**: Eliminates repeated permission requests

### 👥 **Customer Persona Management**
- **JSON-driven personas**: Modular customer profiles with UK banking data
- **Transaction management**: Real-time balance updates and transaction history
- **Admin interface**: Visual persona and transaction management
- **GBP currency formatting**: Proper UK Sterling display (£1,234.56)

### 🛡️ **Enterprise-Grade Robustness**
- **Error Recovery**: Automatic retry with exponential backoff
- **Resource Management**: Proper cleanup of audio streams and connections
- **Rate Limiting**: API abuse prevention with configurable limits
- **Audit Logging**: Comprehensive security event tracking
- **Graceful Degradation**: Fallback mechanisms for component failures

### 🧪 **Comprehensive Testing Framework**
- **Mock vs Real API**: Switch between simulated and actual OpenAI calls
- **100+ Test Suites**: Agent routing, security boundaries, performance validation
- **Failure Simulation**: Network failures, resource constraints, edge cases
- **Security Testing**: Data access validation and penetration testing

### 🔧 **Advanced Management Interface**
- **LLM Manager**: Configuration templates, performance dashboards, comparison tools
- **Voice Configuration**: Per-agent voice settings with real-time preview
- **System Prompts**: No-code AI behavior customization
- **Real-time Updates**: Hot-reload configurations without restart

## 🎯 Supported Use Cases

- **Lost Card Reporting**: "I've lost my credit card" → Fraud Agent
- **Account Inquiries**: "What's my balance?" → Banking Info Agent  
- **Money Transfers**: "Send £50 to Alice" → Payments Agent
- **Identity Verification**: "I forgot my password" → IDV Agent
- **Transaction Disputes**: "I need to dispute a charge" → Fraud Agent
- **General Banking**: Various customer service scenarios with intelligent routing

## 🛠️ Technical Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Architecture**: Modular ES6 classes with dependency injection
- **APIs**: OpenAI (Whisper, GPT-3.5/4, TTS, Realtime API)
- **Audio**: Web Audio API, MediaRecorder API
- **Storage**: LocalStorage for settings and configuration persistence

### Core Components
- **Agent System**: 4 domain-specific agents with AI-powered routing
- **Robustness Layer**: Error recovery, rate limiting, resource management
- **Management Interface**: LLM Manager with guardrails and voice configuration
- **Testing Framework**: 100+ test suites with mock/real API switching

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

#### **Basic Usage:**
- Select a customer persona and click "🎤 Start Speaking"
- Try: "What's my balance?", "I lost my card", "Send money to Alice"
- Watch intelligent agent routing in action

#### **Streaming Mode:**
- Toggle "Streaming Mode" for real-time conversation
- Click "📞 Connect" and have natural conversations

#### **Testing Modes:**
- **Mock Mode**: Free testing with simulated responses (no API key needed)
- **Real Mode**: Actual OpenAI API calls (requires API key and costs money)
- Access 100+ test suites in `/test/` directory

## 🧪 Testing Framework

### **Dual Testing Modes**
- **Mock Mode**: Free testing with simulated responses (no API key needed)
- **Real Mode**: Actual OpenAI API calls for production validation

### **Test Suites**
- **Agent Routing**: AI-powered semantic matching and contextual understanding
- **Security Boundaries**: Data access validation and audit logging  
- **Performance**: Token tracking accuracy and response time monitoring
- **Robustness**: Network failures, resource constraints, edge cases
- **Integration**: End-to-end voice-to-agent-to-response workflows

## 🏗️ Architecture

### **JSON-Driven Configuration**
- **Customer Personas**: Modular profiles in `personas.json`
- **System Prompts**: AI behavior configuration in `system-prompts.json`
- **Agent Settings**: Guardrails, voice settings, and capabilities
- **No-code customization**: Modify behavior without touching code

### **Agent-Based System**
- **BaseAgent**: Abstract class for all domain agents
- **AgentRouter**: AI-powered routing with fallback mechanisms
- **Security Manager**: Domain boundaries and audit logging
- **LLM Manager**: Configuration templates and performance monitoring

## ⚙️ Configuration

### **Voice Settings**
- **6 Professional Voices**: Nova, Shimmer, Onyx, Alloy, Echo, Fable
- **Quality Options**: TTS-1 (fast) vs TTS-1-HD (high quality)
- **Speed Control**: 0.25x to 4.0x speech rate
- **Per-Agent Configuration**: Different voices for different agents

### **Agent Configuration**
- **Guardrails**: Configurable capability restrictions per agent
- **System Prompts**: Customizable AI behavior and personality
- **Performance Monitoring**: Success rates, token usage, response times
- **Security Boundaries**: Domain-specific data access controls

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

## 🆕 Recent Updates

### **Intelligent Agent System**
- ✅ **4 Domain Agents**: Banking, Payments, Fraud, Identity Verification
- ✅ **AI-Powered Routing**: Semantic understanding with fallback mechanisms
- ✅ **Security Boundaries**: Domain-restricted data access with audit logging
- ✅ **LLM Manager**: Configuration templates, performance dashboards, comparison tools

### **Enterprise Robustness**
- ✅ **Error Recovery**: Automatic retry with exponential backoff
- ✅ **Resource Management**: Proper cleanup of audio streams and connections
- ✅ **Rate Limiting**: API abuse prevention with configurable limits
- ✅ **Comprehensive Testing**: 100+ test suites with mock/real API switching

## 🚀 Deployment

### **Local Development**
```bash
python3 -m http.server 8000
```

### **Static Hosting**
Deploy to GitHub Pages, Netlify, Vercel, or any static host - no build step required.

### **Production Considerations**
- API key management and rate limiting
- User authentication for multi-tenant usage
- WebSocket scaling for real-time features

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
