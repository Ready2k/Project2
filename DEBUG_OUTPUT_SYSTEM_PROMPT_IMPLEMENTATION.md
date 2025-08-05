# Debug Output System Prompt Implementation

## Overview

The debug panel now displays the actual system prompt that was sent to GPT, replacing the placeholder text "System prompt will appear here..." with the real, generated system prompt including persona data and agent-specific configurations.

## Implementation Details

### New Components

1. **DebugOutputManager Class** (`debug-output-manager.js`)
   - Manages all debug panel output updates
   - Provides methods for updating different debug sections
   - Handles formatting, timestamps, and visual feedback
   - Includes error handling and export functionality

2. **Debug Output Styles** (`debug-output-styles.css`)
   - Enhanced styling for debug outputs
   - Visual feedback for updates (green border flash)
   - Error state styling (red border)
   - Improved scrollbars and typography

3. **Integration with BaseAgent** (`agents/base-agent.js`)
   - Updated `generateSystemPrompt()` method to display system prompts in debug panel
   - Automatic debug output when system prompts are generated
   - Error handling with debug panel updates

4. **Main App Integration** (`script.js`)
   - DebugOutputManager initialization
   - Global app access for agents
   - Updated all debug output calls to use new manager

### Key Features

#### Real System Prompt Display
- Shows the actual system prompt sent to GPT
- Includes persona data (name, balance, account type, etc.)
- Shows agent-specific context and instructions
- Displays prompt statistics (length, estimated tokens)

#### Enhanced Debug Information
- **Speech-to-Text**: Shows transcription with confidence and language
- **GPT Response**: Shows response with agent name, processing time, tokens used
- **Text-to-Speech**: Shows TTS settings and audio information
- **System Logs**: Timestamped log entries with level indicators

#### Visual Feedback
- Green border flash when content updates
- Red border for errors
- Smooth animations and transitions
- Better typography and scrolling

#### Export Functionality
- Export all debug outputs for troubleshooting
- Includes timestamps and system information
- Useful for debugging and support

## Usage Examples

### For Developers

```javascript
// Manual debug output update
window.speechApp.debugOutputManager.updateSystemPrompt(
    "Your system prompt here...",
    {
        agentName: 'BankingInfoAgent',
        personaName: 'John Smith',
        promptLength: 1250,
        tokensEstimate: 312
    }
);

// Update other debug sections
window.speechApp.debugOutputManager.updateGPTResponse(
    "AI response here...",
    {
        agentName: 'BankingInfoAgent',
        processingTime: 1500,
        tokensUsed: 45,
        model: 'gpt-3.5-turbo'
    }
);
```

### For Testing

```javascript
// Run comprehensive debug output test
await testDebugOutputSystemPrompt();

// Check test results
console.log(window.debugOutputTestResult);

// Export debug data for analysis
const debugData = window.speechApp.debugOutputManager.exportDebugOutputs();
```

## How It Works

### System Prompt Flow

1. **User Input**: User speaks or types a message
2. **Agent Selection**: AgentRouter selects appropriate agent
3. **System Prompt Generation**: Agent calls `generateSystemPrompt()`
4. **Debug Update**: System prompt is automatically displayed in debug panel
5. **AI Request**: System prompt is sent to GPT along with user message
6. **Response Display**: AI response is shown in debug panel with metadata

### Debug Panel Updates

```
[Timestamp] Agent: BankingInfoAgent
Persona: John Smith

You are a helpful, professional, and friendly AI voice assistant for Barclays Bank...

Customer Information:
- Name: John Smith
- Account Type: Premium
- Current Balance: £5,000.50
- Card Last 4 Digits: 1234

You are currently operating as BankingInfoAgent: Handles account balance inquiries...

--- Prompt Stats ---
Length: 1,247 characters
Estimated Tokens: 312
```

### Automatic Updates

The debug panel automatically updates when:
- Speech is transcribed (Speech-to-Text section)
- System prompt is generated (System Prompt to GPT section)
- AI responds (GPT Response section)
- Text is converted to speech (Text-to-Speech section)

## File Structure

```
Project2/
├── debug-output-manager.js           # New debug output manager
├── debug-output-styles.css           # Enhanced debug panel styles
├── test-debug-output-system-prompt.js # Comprehensive test suite
├── agents/base-agent.js              # Updated with debug integration
├── script.js                         # Updated with debug manager
└── index.html                        # Updated with new scripts/styles
```

## Benefits

1. **Real-time Visibility**: See exactly what prompt was sent to GPT
2. **Debugging Aid**: Understand why AI responded in a certain way
3. **Development Tool**: Verify system prompt hierarchy is working
4. **Troubleshooting**: Export debug data for issue analysis
5. **Performance Monitoring**: See processing times and token usage

## Testing

The implementation includes comprehensive testing:

- DebugOutputManager functionality
- Debug panel element availability
- System prompt display accuracy
- Integration with main application
- Error handling and recovery
- Export functionality

Run tests with:
```javascript
await testDebugOutputSystemPrompt()
```

## Troubleshooting

### Common Issues

1. **Debug panel not updating**: Check if DebugOutputManager is initialized
2. **System prompt not showing**: Verify agent is calling generateSystemPrompt()
3. **Styling issues**: Ensure debug-output-styles.css is loaded
4. **Missing elements**: Check if debug panel HTML elements exist

### Debug Commands

```javascript
// Check if debug output manager is available
window.speechApp?.debugOutputManager

// Manually update system prompt
window.speechApp.updateDebugOutput('systemPrompt', 'Test prompt')

// Export debug data
window.speechApp.debugOutputManager.exportDebugOutputs()

// Run full test suite
await testDebugOutputSystemPrompt()
```

## Future Enhancements

Potential improvements:
- Syntax highlighting for system prompts
- Collapsible sections for long prompts
- Search functionality within debug outputs
- Real-time token counting
- Performance metrics visualization
- Debug output filtering and search