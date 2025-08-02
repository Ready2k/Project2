# Prompt Migration Tasks

## Overview
Move all hardcoded `basePersonality`, `responseInstructions`, and `additionalInstructions` from agent code to a new configurable section in the Guardrails system.

## 📋 Task List

### Phase 1: Extend Guardrails Configuration Schema

#### Task 1.1: Add Prompt Configuration Schema
- **File**: `agents/guardrails-manager.js`
- **Action**: Extend configuration schema to include `systemPrompts` section
- **Details**: Add validation for prompt templates and agent-specific overrides

#### Task 1.2: Create Default Prompt Templates
- **File**: `agents/guardrails-manager.js`
- **Action**: Extract all current hardcoded prompts and create default templates
- **Details**: Preserve existing behavior while making it configurable

### Phase 2: Update Agent Implementation

#### Task 2.1: Modify BaseAgent Prompt System
- **File**: `agents/base-agent.js`
- **Action**: Update `getSystemPromptOverrides()` to read from guardrails configuration
- **Details**: Add fallback to hardcoded defaults for backward compatibility

#### Task 2.2: Update FraudAgent
- **File**: `agents/fraud-agent.js`
- **Action**: Remove hardcoded prompts, reference guardrails configuration
- **Details**: Migrate existing prompts to configuration format

#### Task 2.3: Update PaymentsAgent
- **File**: `agents/payments-agent.js`
- **Action**: Remove hardcoded prompts, reference guardrails configuration
- **Details**: Migrate existing prompts to configuration format

#### Task 2.4: Update IDVAgent
- **File**: `agents/idv-agent.js`
- **Action**: Remove hardcoded prompts, reference guardrails configuration
- **Details**: Migrate existing prompts to configuration format

#### Task 2.5: Update BankingInfoAgent
- **File**: `agents/banking-info-agent.js`
- **Action**: Remove hardcoded prompts, reference guardrails configuration
- **Details**: Migrate existing prompts to configuration format

### Phase 3: Admin UI Integration

#### Task 3.1: Add Prompt Configuration UI
- **File**: Admin UI files
- **Action**: Create interface for editing system prompts per agent
- **Details**: Add text areas, validation, and preview functionality

#### Task 3.2: Add Prompt Templates Management
- **File**: Admin UI files
- **Action**: Allow creation and management of prompt templates
- **Details**: Template library with common patterns

### Phase 4: Testing and Validation

#### Task 4.1: Create Prompt Migration Test
- **Action**: Verify all agents use configurable prompts
- **Details**: Test prompt customization and fallback behavior

#### Task 4.2: Create Backward Compatibility Test
- **Action**: Ensure existing behavior is preserved
- **Details**: Compare before/after agent responses

#### Task 4.3: Create Admin UI Test
- **Action**: Test prompt editing interface
- **Details**: Verify changes are applied correctly

## 🚀 Implementation Plan

### Step 1: Schema Extension (30 minutes)
1. Extend guardrails schema with `systemPrompts` section
2. Add validation for prompt configuration
3. Create default templates from existing hardcoded prompts

### Step 2: Agent Updates (45 minutes)
1. Update BaseAgent to read prompts from configuration
2. Modify all 4 agents to use configurable prompts
3. Ensure backward compatibility

### Step 3: Testing (30 minutes)
1. Create comprehensive tests
2. Verify prompt customization works
3. Test admin UI integration

### Step 4: Documentation (15 minutes)
1. Update configuration documentation
2. Create prompt customization guide
3. Document migration process

## 📊 Expected Benefits

- **Full Customization**: All agent behavior configurable through UI
- **No Code Changes**: Modify agent personality without deployments
- **Template System**: Reusable prompt patterns
- **Environment-Specific**: Different prompts per deployment
- **A/B Testing**: Easy to test different prompt variations

## 🔧 Technical Details

### New Configuration Structure
```json
{
  "systemPrompts": {
    "templates": {
      "professional": {
        "basePersonality": "You are a professional, helpful assistant...",
        "responseInstructions": "Provide clear, concise responses..."
      }
    },
    "agentOverrides": {
      "FraudAgent": {
        "basePersonality": "You are an urgent fraud specialist...",
        "additionalInstructions": ["Prioritize security", "Act with urgency"]
      }
    }
  }
}
```

### Migration Strategy
1. **Phase 1**: Add configuration support (backward compatible)
2. **Phase 2**: Migrate agents to use configuration
3. **Phase 3**: Remove hardcoded prompts
4. **Phase 4**: Add UI for prompt editing

## 🎯 Success Criteria

- [ ] All agents read prompts from guardrails configuration
- [ ] No hardcoded prompts remain in agent code
- [ ] Admin UI allows prompt customization
- [ ] Existing behavior is preserved
- [ ] New deployments can customize prompts easily
- [ ] Template system supports common patterns