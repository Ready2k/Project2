# Debug Output System Prompt Fix

## Issue Identified

The system prompt was not updating in the debug panel during real conversations because:

1. **Missing fallback method**: The `generateSystemPrompt` method was missing from `script.js`, causing errors in the fallback path
2. **Inconsistent debug output**: Agent routing path and fallback path were using different debug output methods
3. **Parameter mismatch**: BaseAgent's `generateSystemPrompt` method signature didn't match how agents were calling it

## Fixes Implemented

### 1. Added Missing generateSystemPrompt Method (`script.js`)

```javascript
generateSystemPrompt(persona, userMessage) {
    // Uses SystemPromptsManager if available
    // Falls back to basic system prompt generation
    // Updates debug output with DebugOutputManager
    // Handles errors gracefully
}

generateBasicSystemPrompt(personaData) {
    // Generates basic system prompt with persona data
    // Used when SystemPromptsManager is not available
}
```

### 2. Fixed BaseAgent Method Signature (`agents/base-agent.js`)

```javascript
async generateSystemPrompt(context, userInput, personaDataOverride = null) {
    // Now accepts optional third parameter for backward compatibility
    // Added debug logging to track method calls
    // Enhanced error handling with debug output
}
```

### 3. Enhanced Debug Logging

Added comprehensive logging to track:
- When agent routing is attempted vs fallback
- When system prompt generation is called
- Debug output manager availability
- Method call parameters and results

### 4. Live Debug Testing (`test-debug-output-live.js`)

Created comprehensive testing functions:
- `testDebugOutputLive()` - Manual debug output testing
- `monitorAgentRouting()` - Monitor agent routing calls
- `monitorSystemPromptGeneration()` - Monitor system prompt generation
- `checkDebugOutputStatus()` - Check debug system status
- `simulateConversationWithDebugMonitoring()` - Full conversation simulation

## Testing Instructions

### 1. Check Debug System Status

Open browser console and run:
```javascript
checkDebugOutputStatus()
```

This will show:
- Whether debug output manager is available
- Status of debug panel elements
- Current content in debug sections

### 2. Enable Live Monitoring

```javascript
// Monitor agent routing
monitorAgentRouting()

// Monitor system prompt generation
monitorSystemPromptGeneration()
```

### 3. Test Manual Debug Output

```javascript
testDebugOutputLive()
```

This will manually update all debug sections to verify they're working.

### 4. Simulate Full Conversation

```javascript
simulateConversationWithDebugMonitoring()
```

This will simulate a banking question and monitor all debug updates.

### 5. Test Real Conversation

1. Enable monitoring functions first
2. Use the voice interface to ask a banking question like "What is my balance?"
3. Watch the console for debug logs
4. Check if the system prompt updates in the debug panel

## Expected Behavior

### When Agent Routing Works:
1. User asks question → Agent routing called
2. Agent selected → `BaseAgent.generateSystemPrompt()` called
3. System prompt generated → Debug panel updated with agent-specific prompt
4. AI responds → GPT response section updated

### When Fallback is Used:
1. User asks question → Agent routing fails
2. Fallback method called → `script.generateSystemPrompt()` called
3. Basic system prompt generated → Debug panel updated with fallback prompt
4. AI responds → GPT response section updated

## Debug Console Output

You should see logs like:
```
🤖 Agent routing called: {input: "What is my balance?", hasContext: true}
📝 BaseAgent.generateSystemPrompt called: {agentName: "BankingInfoAgent", userInputLength: 21}
📝 BaseAgent.generateSystemPrompt result: {agentName: "BankingInfoAgent", promptLength: 1247}
🤖 Agent routing result: {success: true, agentName: "BankingInfoAgent"}
```

Or for fallback:
```
🤖 Agent routing called: {input: "Hello", hasContext: true}
🤖 Agent routing result: {success: false}
📝 Fallback generateSystemPrompt called: {persona: "default", userMessageLength: 5}
📝 Fallback generateSystemPrompt result: {promptLength: 456}
```

## Troubleshooting

### If System Prompt Still Not Updating:

1. **Check Console for Errors**:
   ```javascript
   // Look for any JavaScript errors
   console.error
   ```

2. **Verify Debug Output Manager**:
   ```javascript
   window.speechApp?.debugOutputManager
   ```

3. **Check Agent Router**:
   ```javascript
   window.speechApp?.agentRouter
   ```

4. **Test Manual Update**:
   ```javascript
   window.speechApp.debugOutputManager.updateSystemPrompt("Test prompt", {agentName: "Test"})
   ```

### Common Issues:

1. **DebugOutputManager not initialized**: Check if script loaded correctly
2. **Agent routing failing**: Check if agents are properly registered
3. **System prompt generation errors**: Check console for error messages
4. **Debug elements missing**: Check if HTML elements exist

## Files Modified

- `script.js` - Added missing generateSystemPrompt methods
- `agents/base-agent.js` - Fixed method signature and added logging
- `index.html` - Added test script
- `test-debug-output-live.js` - New comprehensive testing suite

## Next Steps

1. Load the updated files
2. Open browser console
3. Run `checkDebugOutputStatus()` to verify setup
4. Enable monitoring with `monitorAgentRouting()` and `monitorSystemPromptGeneration()`
5. Test with real voice interactions
6. Check console logs and debug panel updates

The system prompt should now update correctly in the debug panel during both agent routing and fallback scenarios!