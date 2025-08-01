# Design Document

## Overview

This design outlines the migration of the default agent configuration from the System Prompts Configuration section in the Administrator panel to the LLM Manager page. The migration will consolidate all agent configurations in a single location, providing a consistent interface for managing AI agents while preserving all existing functionality.

## Architecture

### Current System Analysis

**Current State:**
- Default agent configuration is managed through System Prompts Configuration in the Administrator panel (`index.html`)
- Configuration includes: Base AI Personality, Financial Services Context, Response Instructions, and Custom Scenario Prompts
- Data is stored in `system-prompts.json` and managed by `SystemPromptsManager` class
- LLM Manager page (`llm-manager-admin-ui.html`) manages other specialized agents (FraudAgent, PaymentsAgent, etc.)

**Target State:**
- Default agent configuration will be integrated into the LLM Manager page
- System Prompts section will be removed from the Administrator panel
- All agent configurations will be centralized in the LLM Manager interface
- Existing functionality will be preserved through the new interface

### Migration Strategy

The migration will follow a three-phase approach:
1. **Extension Phase**: Add default agent configuration to LLM Manager
2. **Integration Phase**: Migrate existing data and functionality
3. **Cleanup Phase**: Remove System Prompts section from Administrator panel

## Components and Interfaces

### 1. LLM Manager Enhancement

**File: `llm-manager-admin-ui.html`**
- Add "Default Agent" card to the existing agents grid
- Integrate default agent configuration forms into the existing modal system
- Maintain consistency with existing agent configuration patterns

**File: `llm-manager-admin-ui.js`**
- Extend `LLMManagerAdminUI` class to handle default agent configuration
- Add methods for loading, saving, and managing default agent settings
- Integrate with existing `SystemPromptsManager` for data persistence

### 2. Default Agent Configuration Interface

**Configuration Sections:**
- **Base AI Personality**: Multi-line text area for core personality definition
- **Financial Services Context**: Multi-line text area for banking-specific instructions
- **Response Instructions**: Multi-line text area for response formatting guidelines
- **Custom Scenario Prompts**: Dynamic list management for custom prompts with add/remove functionality

**Form Structure:**
```html
<div class="agent-prompt-card">
  <div class="agent-prompt-header">
    <h3>🤖 Default Agent</h3>
    <span class="agent-status">Active</span>
  </div>
  
  <div class="prompt-field">
    <label>Base AI Personality:</label>
    <textarea id="default-personality" rows="4"></textarea>
  </div>
  
  <div class="prompt-field">
    <label>Financial Services Context:</label>
    <textarea id="default-financial-context" rows="6"></textarea>
  </div>
  
  <div class="prompt-field">
    <label>Response Instructions:</label>
    <textarea id="default-response-instructions" rows="4"></textarea>
  </div>
  
  <div class="prompt-field">
    <label>Custom Scenario Prompts:</label>
    <div id="default-custom-prompts-list"></div>
    <button onclick="addCustomPrompt('default')">Add Custom Prompt</button>
  </div>
  
  <div class="prompt-actions">
    <button onclick="saveAgentPrompts('DefaultAgent')">💾 Save</button>
    <button onclick="resetAgentPrompts('DefaultAgent')">🔄 Reset</button>
    <button onclick="testAgentPrompts('DefaultAgent')">🧪 Test</button>
  </div>
</div>
```

### 3. Data Migration Layer

**SystemPromptsManager Integration:**
- Maintain existing `SystemPromptsManager` class for backward compatibility
- Create adapter methods in `LLMManagerAdminUI` to interface with SystemPromptsManager
- Ensure data consistency between old and new interfaces during transition

**Data Flow:**
```
LLM Manager UI → LLMManagerAdminUI → SystemPromptsManager → localStorage/JSON
```

### 4. Administrator Panel Cleanup

**File: `index.html`**
- Remove System Prompts Configuration section from admin panel
- Update admin navigation to remove System Prompts tab
- Add redirect/link to LLM Manager for agent configuration

**Navigation Update:**
```html
<!-- Remove this section -->
<button class="admin-nav-btn" data-admin-section="prompts">
  <i class="fas fa-comment-dots"></i>
  System Prompts
</button>

<!-- Update LLM Console section to indicate it handles all agent config -->
<button class="admin-nav-btn" data-admin-section="llm">
  <i class="fas fa-brain"></i>
  Agent Configuration
</button>
```

## Data Models

### Default Agent Configuration Model

```javascript
{
  name: "DefaultAgent",
  type: "default",
  enabled: true,
  description: "Primary AI assistant for general banking inquiries",
  configuration: {
    basePersonality: "You are a helpful, professional, and friendly AI voice assistant...",
    financialContext: "When handling financial services requests:\n1. Be conversational...",
    responseInstructions: "Response Guidelines:\n1. Keep responses conversational...",
    customPrompts: [
      {
        id: "unique-id",
        name: "Loan Inquiries",
        prompt: "When discussing loans, always mention..."
      }
    ]
  },
  metadata: {
    createdAt: "timestamp",
    lastUpdated: "timestamp",
    version: "1.0"
  }
}
```

### Migration Data Mapping

```javascript
// Current system-prompts.json structure → New LLM Manager structure
{
  basePersonality: "..." → configuration.basePersonality
  financialContext: "..." → configuration.financialContext
  responseInstructions: "..." → configuration.responseInstructions
  customPrompts: [...] → configuration.customPrompts
}
```

## Error Handling

### Migration Error Scenarios

1. **Data Loss Prevention**: Backup existing system-prompts.json before migration
2. **Validation Errors**: Validate all migrated data before saving
3. **UI State Errors**: Handle cases where SystemPromptsManager is not available
4. **Backward Compatibility**: Maintain fallback to original system if migration fails

### Error Recovery

```javascript
try {
  // Attempt migration
  migrateDefaultAgentConfig();
} catch (error) {
  // Log error and maintain existing functionality
  console.error('Migration failed:', error);
  // Keep System Prompts section active as fallback
  showSystemPromptsSection();
}
```

## Testing Strategy

### Unit Testing

1. **Data Migration Tests**
   - Test conversion from system-prompts.json to LLM Manager format
   - Validate data integrity during migration
   - Test custom prompts array handling

2. **UI Component Tests**
   - Test default agent card rendering
   - Test form field population and validation
   - Test save/load functionality

3. **Integration Tests**
   - Test SystemPromptsManager integration
   - Test backward compatibility
   - Test error handling scenarios

### Manual Testing Scenarios

1. **Pre-Migration State**
   - Verify System Prompts section works correctly
   - Document current configuration values
   - Test all existing functionality

2. **Post-Migration State**
   - Verify default agent appears in LLM Manager
   - Test all configuration options work correctly
   - Verify System Prompts section is removed
   - Test data persistence

3. **Edge Cases**
   - Test with empty/missing system-prompts.json
   - Test with corrupted configuration data
   - Test browser compatibility

### Acceptance Testing

1. **Functional Requirements**
   - All default agent configuration options available in LLM Manager
   - System Prompts section successfully removed from admin panel
   - Data migration preserves all existing settings

2. **User Experience**
   - Consistent interface with other agents
   - Intuitive navigation and workflow
   - Clear feedback for save/error states

3. **Performance**
   - No degradation in page load times
   - Responsive UI interactions
   - Efficient data loading and saving