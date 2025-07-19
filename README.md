# 🎤 Voice-to-Voice Financial Services Bot

An advanced AI-powered voice assistant for financial services customer support, featuring **dual-mode operation** (Batch & Streaming), real-time speech recognition, natural voice responses, comprehensive customer persona management, and **configurable AI system prompts** - all without touching code!

## 🚀 Live Demo

Simply open `index.html` in your browser or run a local server:
```bash
python3 -m http.server 8000
# Then visit http://localhost:8000
```

## ✨ Key Features

### 🔄 **Dual-Mode Operation** (NEW!)
- **Batch Mode**: Traditional record → process → respond workflow
- **Streaming Mode**: Real-time conversation like a phone call (UI ready, WebSocket integration in development)
- **Seamless switching** between modes with visual toggle
- **Mode-specific settings** and optimizations

### 🎙️ **Advanced Speech Recognition**
- **OpenAI Whisper** integration for high-accuracy speech-to-text
- **Real-time audio monitoring** with visual feedback
- **Financial context optimization** for banking terminology
- **Multi-language support** (English variants: US, UK, AU)
- **Noise reduction** and audio quality enhancement
- **Smart recording quality indicators**

### 🗣️ **Natural Voice Responses**
- **OpenAI TTS** with 6 professional voices (Nova, Shimmer, Onyx, etc.)
- **High-quality audio** (TTS-1 and TTS-1-HD models)
- **Customizable speech speed** and voice selection
- **Natural conversation flow** with proper pauses

### 👥 **Customer Persona Management**
- **Pre-loaded customer profiles** with realistic financial data
- **Admin panel** for adding/managing customer personas
- **Account balances, transaction history, card details**
- **Dynamic persona switching** for testing scenarios

### 💰 **Comprehensive Cost Tracking**
- **Real-time token usage monitoring** for all OpenAI services
- **Cost breakdown** by service (Whisper, GPT, TTS)
- **Usage analytics** with detailed pricing information
- **Reset functionality** for cost tracking

### 🤖 **Configurable AI System Prompts** (NEW!)
- **No-code AI customization** - modify AI behavior without touching code
- **Base personality configuration** - set tone, empathy, professionalism
- **Financial context prompts** - customize banking procedures and responses
- **Response instruction templates** - optimize for voice, length, clarity
- **Custom scenario prompts** - add industry-specific knowledge (loans, investments, etc.)
- **Real-time prompt testing** - preview generated prompts before use
- **Import/export ready** - backup and share AI configurations

### 📞 **Full-Duplex Streaming Mode** (✅ FULLY IMPLEMENTED)
- **Real-time conversation** - Continuous bidirectional audio like a phone call
- **OpenAI Realtime API** - Direct WebSocket connection to GPT-4o Realtime (2024-12-17)
- **Voice Activity Detection** - Server-side VAD with configurable sensitivity
- **Persona integration** - AI knows customer details (balance, transactions, card info)
- **Real-time audio streaming** - PCM16 audio processing with proper buffering
- **Text + Audio responses** - See responses in chat AND hear them spoken
- **Audio level monitoring** - Visual feedback during conversation
- **Robust error handling** - Graceful recovery from connection issues
- **Modular architecture** - Clean separation with StreamingManager module

### 🔍 **Debug & Development Tools**
- **Real-time API communication display**
- **Speech-to-text transcription monitoring**
- **System prompt and GPT response visibility**
- **Voice generation details and statistics**
- **Enhanced audio level monitoring** with quality indicators

## 🎯 Supported Use Cases

### **Financial Services Scenarios:**
- **Lost Card Reporting** - "I've lost my credit card"
- **Account Balance Inquiries** - "What's my account balance?"
- **Transaction History** - "Tell me about my recent transactions"
- **Transaction Disputes** - "I need to dispute a charge"
- **Money Transfers** - "How do I transfer money?"
- **Account Information** - "What type of account do I have?"
- **General Banking Support** - Various customer service scenarios

### **Conversation Modes:**
- **Batch Mode**: Traditional record → process → respond workflow
- **Streaming Mode**: Real-time conversation with immediate responses
- **Persona-aware**: AI knows specific customer details and account information

## 🛠️ Technical Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Architecture**: Modular design with separated concerns
  - `api-client.js` - OpenAI API interactions (Whisper, GPT, TTS)
  - `token-tracker.js` - Usage tracking and cost calculation
  - `streaming-manager.js` - Real-time WebSocket streaming (NEW!)
  - `script.js` - Main application logic and UI
- **APIs**: OpenAI (Whisper, GPT-3.5-turbo, TTS)
- **Audio**: Web Audio API, MediaRecorder API
- **Storage**: LocalStorage for settings persistence
- **Design**: Responsive CSS Grid/Flexbox layout

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
- Go to **Settings** tab
- Enter your OpenAI API key
- Configure voice and speech recognition settings
- Test the modules with `test-modules.html` (optional)

### 4. **Test the System**

#### **Batch Mode (Traditional):**
- Select a customer persona (John Doe, Sarah Smith, or Mike Johnson)
- Click "🎤 Start Speaking"
- Grant microphone permissions
- Say something like "What's my account balance?"
- Listen to the AI response

#### **Streaming Mode (Real-time):**
- Toggle "Streaming Mode" switch
- Click "📞 Connect" to establish real-time connection
- Grant microphone permissions
- Have a natural conversation - AI responds automatically when you stop speaking
- See responses in chat AND hear them spoken simultaneously

## ⚙️ Configuration Options

### **Speech Recognition Settings**
- **Audio Quality**: Standard (16kHz) vs High (48kHz)
- **Noise Reduction**: Off/Low/Medium/High
- **Language Model**: English variants for accent optimization
- **Recognition Mode**: Financial context vs Precise vs Standard

### **Voice Response Settings**
- **TTS Model**: TTS-1 (fast) vs TTS-1-HD (high quality)
- **Voice Selection**: 6 professional voices available
- **Speech Speed**: 0.25x to 4.0x speed control

### **Customer Personas**
- **Default Personas**: 3 pre-configured customers with realistic data
- **Custom Personas**: Add unlimited customer profiles
- **Account Details**: Balance, card numbers, transaction history

## 💡 Usage Tips

### **For Best Speech Recognition**
- Speak clearly at normal pace
- Use quiet environment when possible
- Watch the audio level indicator (aim for green/yellow)
- Use natural financial terminology

### **Recommended Settings**
- **Audio Quality**: High (48kHz)
- **Noise Reduction**: Medium
- **TTS Voice**: Nova or Shimmer for customer service
- **Recognition Mode**: Financial Context

## 📊 Cost Estimation

Based on typical usage patterns:
- **Whisper**: ~$0.006 per minute of audio
- **GPT-3.5-turbo**: ~$0.002 per conversation
- **TTS**: ~$0.015-0.030 per 1K characters

A 5-minute conversation typically costs **$0.05-0.10** total.

**Streaming Mode**: Costs are similar but provide real-time interaction with immediate responses.

## 🔒 Security & Privacy

- **API keys stored locally** in browser localStorage
- **No audio data persistence** - processed in real-time
- **OpenAI API compliance** with their data usage policies
- **Client-side processing** for maximum privacy

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

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenAI** for providing excellent AI APIs
- **Web Audio API** for real-time audio processing capabilities
- **Modern browser standards** for MediaRecorder and speech APIs

## 📞 Support

For questions or support, please open an issue in the GitHub repository.

---

**Built with ❤️ for the future of voice-enabled financial services**
##
 🔧 Development Notes

### **Module Structure**
```
📁 Project Root
├── 📄 index.html              # Main application interface
├── 📄 script.js               # Main app logic and UI coordination
├── 📄 api-client.js           # OpenAI API client (Whisper, GPT, TTS)
├── 📄 token-tracker.js        # Usage tracking and cost calculation
├── 📄 streaming-manager.js    # Real-time WebSocket streaming
├── 📄 styles.css              # Application styling
└── 📄 test-modules.html       # Module testing utility
```

### **Streaming Mode Implementation**
- **WebSocket Connection**: Direct connection to OpenAI Realtime API
- **Authentication**: Uses `openai-insecure-api-key` subprotocol for browser compatibility
- **Audio Format**: PCM16 at 24kHz sample rate
- **Voice Activity Detection**: Server-side VAD with configurable thresholds
- **Real-time Processing**: Immediate audio chunk processing and playback
- **Persona Context**: Dynamic customer information injection into AI instructions

### **Key Technical Achievements**
1. **Modular Refactoring**: Reduced main script from 1,513 to 1,405 lines
2. **Real-time Streaming**: Full bidirectional audio conversation
3. **Robust Error Handling**: Graceful recovery from connection issues
4. **Performance Optimization**: Efficient audio buffering and playback
5. **Developer Experience**: Comprehensive debugging and logging

---

**Built with ❤️ for the future of voice-enabled financial services**