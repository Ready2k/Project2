# 💰 Token Tracking Guide

## How Token Tracking Works

The token tracker automatically monitors your OpenAI API usage and calculates costs in real-time.

### 🔄 Automatic Tracking
Token usage is tracked automatically in both **Batch Mode** and **Streaming Mode**:

### Batch Mode (Traditional API calls)
1. **🎤 Record Voice** → Whisper API call → Increments requests & cost
2. **🤖 Get AI Response** → GPT API call → Tracks input/output tokens & cost  
3. **🔊 Hear Voice Response** → TTS API call → Tracks characters & cost

### Streaming Mode (Real-time conversation)
1. **🎤 Live Audio Input** → Estimated based on audio duration → Whisper cost
2. **💬 Real-time Transcription** → Estimated tokens from text length → GPT input cost
3. **🤖 AI Response Generation** → Estimated tokens from response text → GPT output cost
4. **🔊 Streaming Audio Output** → Estimated from audio chunks → TTS cost

> **Note**: Streaming mode uses **estimated costs** since the OpenAI Realtime API doesn't provide exact usage statistics. Estimates are based on audio duration and text length.

### 🎛️ New Control Buttons

#### **Update Button** 🔄
- **Purpose**: Manually refresh the token display
- **When to use**: If numbers seem stuck or outdated
- **What it does**: Reloads usage from storage and updates display

#### **Test Button** 🧪  
- **Purpose**: Add sample usage data to test the system
- **What it adds**:
  - +1 Whisper request (~$0.0015)
  - +75 GPT tokens (~$0.0001) 
  - +100 TTS characters (~$0.0015)
- **Use case**: Verify tracking is working without making real API calls

#### **Reset Button** 🔄
- **Purpose**: Clear all usage statistics
- **What it does**: Sets all counters back to 0 and $0.00

### 🗑️ Clear Conversation Feature

#### **Clear Chat Button** 🗑️
- **Purpose**: Reset conversation history while preserving token tracking
- **What it does**:
  - Clears all chat messages (keeps initial greeting)
  - Resets conversation state in both batch and streaming modes
  - Stops any playing audio
  - **Preserves token usage statistics** (doesn't reset costs)
- **When to use**: Start fresh conversations without losing cost tracking data

## 🔍 Troubleshooting

### If Token Tracking Isn't Working:

#### For Batch Mode:
1. **Check Console Logs** (F12 → Console):
   - Look for "Tracking Whisper usage..." messages
   - Look for "Token tracker not available" warnings

2. **Try the Test Button**:
   - Click "Test" to add sample data
   - If this works, the tracker is functional

3. **Check API Key**:
   - Ensure your OpenAI API key is set in Settings
   - Token tracking only works with real API calls

#### For Streaming Mode:
1. **Check Console Logs** for streaming messages:
   - Look for "Tracked input text:" messages
   - Look for "Tracked output text:" messages
   - Look for "Audio tracking:" messages
   - Look for "Streaming session completed" messages

2. **Verify Streaming Connection**:
   - Ensure you're connected to streaming mode
   - Check that conversations are happening in real-time

3. **Test Streaming Tracking**:
   - Use `test-streaming-token-tracking.html` to verify functionality
   - Check if estimated costs appear after streaming sessions

4. **Try the Update Button**:
   - Click "Update" to refresh from storage
   - Check if usage appears after refresh

### Expected Behavior:

✅ **Working Correctly**:

**Batch Mode:**
- Numbers increment after each voice interaction
- Console shows tracking messages
- Test button adds sample data
- Update button shows current totals

**Streaming Mode:**
- Numbers increment after streaming conversations
- Console shows "Tracked input/output text" messages
- Console shows "Audio tracking" messages
- Session completion triggers cost calculation

❌ **Not Working**:

**Batch Mode:**
- Numbers stay at 0 after API calls
- Console shows "Token tracker not available" 
- Test button doesn't change numbers
- No tracking messages in console

**Streaming Mode:**
- No tracking messages during streaming sessions
- Numbers don't update after streaming conversations
- Console shows "No token tracker available" warnings
- Missing "Streaming session completed" messages

## 💡 Usage Tips

- **Monitor Costs**: Keep an eye on the total to manage API spending
- **Test First**: Use the Test button to verify tracking before real usage
- **Debug Mode**: Enable debug logging in Settings for detailed tracking info
- **Regular Updates**: Click Update if you suspect numbers are outdated
- **Clear vs Reset**: Use "Clear Chat" to start new conversations, "Reset" to clear cost tracking
- **Microphone Persistence**: In batch mode, microphone permissions persist between recordings to avoid popups

## 📊 Cost Breakdown

### Batch Mode (Exact costs from API)
- **Whisper**: ~$0.006 per minute of audio
- **GPT-3.5-turbo**: ~$0.0005-0.0015 per 1K tokens  
- **TTS**: ~$0.015-0.030 per 1K characters

### Streaming Mode (Estimated costs)
- **Audio Input**: ~$0.006 per minute (Whisper equivalent)
- **Text Processing**: ~4 chars = 1 token for estimation
- **Audio Output**: Uses TTS-1-HD pricing (~$0.030 per 1K chars)

### Typical Costs
- **Batch Mode**: 30-second interaction ≈ **$0.01-0.03**
- **Streaming Mode**: 30-second conversation ≈ **$0.02-0.05** (higher due to real-time processing)

## 🧪 Testing

Use `test-streaming-token-tracking.html` to test streaming token tracking without making real API calls. This test file simulates:
- Input text tracking
- Output text tracking  
- Audio input/output tracking
- Complete streaming session simulation