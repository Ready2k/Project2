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

### 📞 **Full-Duplex Streaming Mode** (Complete WebSocket Integration)
- **Real-time conversation** - Continuous bidirectional audio like a phone call
- **OpenAI Realtime API** - Direct WebSocket connection to GPT-4o Realtime
- **Voice Activity Detection** - Server-side VAD with configurable sensitivity
- **Response delay customization** - Adjustable silence threshold (0.5s - 3.0s)
- **Audio buffer optimization** - Low latency, balanced, or high quality modes
- **Speaking indicators** - Real-time visual feedback for conversation flow
- **Connection management** - Robust connect/disconnect with status monitoring
- **Error handling** - Graceful fallback suggestions and connection recovery

### 🔍 **Debug & Development Tools**
- **Real-time API communication display**
- **Speech-to-text transcription monitoring**
- **System prompt and GPT response visibility**
- **Voice generation details and statistics**
- **Enhanced audio level monitoring** with quality indicators

## 🎯 Supported Use Cases

- **Lost Card Reporting** - "I've lost my credit card"
- **Account Balance Inquiries** - "What's my account balance?"
- **Transaction Disputes** - "I need to dispute a charge"
- **Money Transfers** - "How do I transfer money?"
- **General Banking Support** - Various customer service scenarios

## 🛠️ Technical Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
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

### 4. **Test the System**
- Select a customer persona (John Doe, Sarah Smith, or Mike Johnson)
- Click "🎤 Start Speaking"
- Grant microphone permissions
- Say something like "What's my account balance?"
- Listen to the AI response

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