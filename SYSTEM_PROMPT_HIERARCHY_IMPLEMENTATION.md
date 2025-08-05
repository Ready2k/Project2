# System Prompt Hierarchy Implementation

## Overview

The system prompt hierarchy has been implemented to provide a proper fallback mechanism where:

1. **Agent-specific systemPrompts in config** (highest priority) - Agent configs can override specific components
2. **system-prompts.json fallback defaults** (lowest priority) - Provides consistent defaults across the application

This ensures agents can customize their behavior when needed while maintaining consistent fallback defaults.

## Architecture

### SystemPromptManager Class

**Location**: `system-prompt-manager.js`

The `SystemPromptManager` class handles the proper hierarchy and merging of system prompts:

- Loads fallback prompts from `system-prompts.json`
- Merges agent-specific overrides with fallback defaults
- Generates complete system prompts with persona data
- Provides caching for performance

### Key Methods

```javascript
// Get system prompts for an agent with proper fallback hierarchy
await systemPromptManager.getSystemPromptsForAgent(agentName, agentConfig)

// Generate complete system prompt including persona data
await systemPromptManager.generateSystemPromptForAgent(agentName, agentConfig, personaData, userInput)
```

### Integration Points

1. **AgentConfigManager**: Updated to use SystemPromptManager for proper hierarchy
2. **BaseAgent**: Updated to use the new system prompt generation
3. **Main Script**: Context object includes `agentConfigManager` for agents to access

## Hierarchy Rules

### 1. No Agent Overrides
If an agent config has no `systemPrompts` property:
```javascript
{
  "name": "TestAgent",
  "description": "Test agent",
  "enabled": true
  // No systemPrompts - uses fallback entirely
}
```
**Result**: All components come from `system-prompts.json`

### 2. Partial Agent Overrides
If an agent config has some `systemPrompts` components:
```javascript
{
  "name": "TestAgent",
  "systemPrompts": {
    "basePersonality": "Custom personality...",
    // financialContext and responseInstructions come from fallback
    "customPrompts": [...]
  }
}
```
**Result**: 
- `basePersonality` from agent config
- `financialContext` from fallback
- `responseInstructions` from fallback
- `customPrompts` merged (agent prompts override fallback prompts with same name)

### 3. Complete Agent Overrides
If an agent config overrides all components:
```javascript
{
  "name": "TestAgent",
  "systemPrompts": {
    "basePersonality": "Custom personality...",
    "financialContext": "Custom financial context...",
    "responseInstructions": "Custom response instructions...",
    "customPrompts": [...]
  }
}
```
**Result**: All components from agent config

## File Structure

```
Project2/
├── system-prompts.json                    # Fallback defaults
├── system-prompt-manager.js               # New hierarchy manager
├── config/agents/
│   ├── default-agent-config.json         # Can override system prompts
│   ├── bankinginfo-agent-config.json     # Can override system prompts
│   ├── payments-agent-config.json        # Can override system prompts
│   ├── fraud-agent-config.json           # Can override system prompts
│   └── idv-agent-config.json             # Can override system prompts
└── agents/
    ├── agent-config-manager.js           # Updated to use SystemPromptManager
    └── base-agent.js                      # Updated to use new hierarchy
```

## Usage Examples

### For Agent Developers

```javascript
// In an agent config file
{
  "name": "MyCustomAgent",
  "systemPrompts": {
    // Override only what you need
    "basePersonality": "I am a specialized agent for...",
    // financialContext and responseInstructions will come from fallback
    "customPrompts": [
      {
        "name": "Special Handling",
        "prompt": "For special cases, do this..."
      }
    ]
  }
}
```

### For System Administrators

Update `system-prompts.json` to change defaults for all agents:

```json
{
  "basePersonality": "Updated default personality...",
  "financialContext": "Updated financial context...",
  "responseInstructions": "Updated response instructions...",
  "customPrompts": [
    {
      "name": "Global Rule",
      "prompt": "This applies to all agents unless overridden"
    }
  ]
}
```

## Testing

Run the hierarchy test:
```javascript
// In browser console
await testSystemPromptHierarchy()
```

The test verifies:
- Fallback prompts load correctly
- Agents without overrides use fallback entirely
- Agents with partial overrides merge correctly
- Agents with complete overrides work correctly
- Complete system prompt generation includes persona data

## Benefits

1. **Consistency**: All agents have consistent fallback behavior
2. **Flexibility**: Agents can override only what they need to customize
3. **Maintainability**: Global changes can be made in one place
4. **Performance**: Caching reduces repeated file loads
5. **Debugging**: Clear hierarchy makes troubleshooting easier

## Migration Notes

### From Old System
- Old system had prompts scattered in individual agent configs
- New system provides centralized fallbacks with selective overrides
- Existing agent configs continue to work (backward compatible)

### Key Changes
1. Added `SystemPromptManager` class
2. Updated `AgentConfigManager` to use the new hierarchy
3. Updated `BaseAgent.generateSystemPrompt()` to be async and use hierarchy
4. Added `agentConfigManager` to agent context object
5. Added comprehensive testing

## Troubleshooting

### Common Issues

1. **SystemPromptManager not found**: Ensure `system-prompt-manager.js` is loaded before agent scripts
2. **Fallback prompts not loading**: Check `system-prompts.json` exists and is valid JSON
3. **Agent overrides not working**: Verify agent config has correct `systemPrompts` structure
4. **Context missing agentConfigManager**: Ensure main script passes it in agent context

### Debug Commands

```javascript
// Check if SystemPromptManager is available
typeof SystemPromptManager

// Test system prompt loading
const spm = new SystemPromptManager();
await spm.loadSystemPrompts()

// Check agent config manager
window.speechApp.agentConfigManager.getSystemPromptsForAgent('BankingInfoAgent')

// Run full hierarchy test
await testSystemPromptHierarchy()
```