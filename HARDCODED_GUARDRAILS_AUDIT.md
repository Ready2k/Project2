# Hardcoded Guardrails and Prompts Audit

## Summary
This audit identifies all hardcoded guardrails validations and system prompts across all agents that should be configurable through the admin UI.

## 🚨 Critical Issues Found

### 1. **FraudAgent** - `agents/fraud-agent.js`

**Hardcoded Guardrails:**
```javascript
// Line 128: Hardcoded requiresSecondaryAuth: false
this.validateGuardrails('blockCard', { 
    action: 'card_blocking', 
    requiresSecondaryAuth: false  // ❌ HARDCODED
});
```

**Hardcoded System Prompts:**
```javascript
// Lines 272-284: Extensive hardcoded personality and instructions
basePersonality: "You are an urgent, professional fraud detection and security specialist..."
additionalInstructions: [
    "You are specialized in fraud detection, card blocking, and security threat responses",
    "Treat all fraud reports with HIGH PRIORITY and urgency",
    "You can perform PROTECTIVE actions like card blocking and fraud reporting",
    // ... more hardcoded instructions
]
```

### 2. **IDVAgent** - `agents/idv-agent.js`

**Hardcoded Guardrails:**
```javascript
// Lines 130-134: Hardcoded requiresSecondaryAuth: true for password reset
this.validateGuardrails('resetPassword', { 
    requiresSecondaryAuth: true,  // ❌ HARDCODED
    action: 'password_reset'
});
```

**Hardcoded System Prompts:**
```javascript
// Lines 208-216: Hardcoded security instructions
responseInstructions: "Keep responses security-focused and provide clear, step-by-step guidance..."
additionalInstructions: [
    "You are specialized in identity verification, password resets, and account security",
    "You can ONLY access identity verification functions - no payments, transactions, or balances",
    // ... more hardcoded instructions
]
```

### 3. **PaymentsAgent** - `agents/payments-agent.js`

**Fixed Guardrails:** ✅ 
```javascript
// Lines 148-152: Now properly checks configuration
const requiresSecondaryAuth = this.checkSecondaryAuthRequired('initiateTransfer', context);
this.validateGuardrails('initiateTransfer', { 
    requiresSecondaryAuth  // ✅ USES CONFIG
});
```

**Hardcoded System Prompts:**
```javascript
// Lines 364-376: Extensive hardcoded payment instructions
basePersonality: "You are a highly secure, professional payment processing assistant..."
additionalInstructions: [
    "You are specialized in money transfers, payments, and secure transaction processing",
    "Apply HIGHEST SECURITY LEVEL to all payment requests",
    "ALWAYS validate transaction amounts against available balance",
    // ... more hardcoded instructions
]
```

### 4. **BankingInfoAgent** - `agents/banking-info-agent.js`

**Hardcoded Guardrails:**
```javascript
// Lines 92-93: Hardcoded action parameters
this.validateGuardrails('getBalance', { action: 'balance_inquiry' });
this.validateGuardrails('getTransactions', { action: 'transaction_history' });
```

**Hardcoded System Prompts:**
```javascript
// Lines 267-277: Hardcoded banking instructions
additionalInstructions: [
    "You are specialized in providing account balance, transaction history, and account information",
    "You can ONLY provide READ-ONLY access to banking information",
    "You CANNOT perform transactions, transfers, payments, or account modifications",
    // ... more hardcoded instructions
]
```

## 🔧 Recommended Fixes

### Priority 1: Fix Hardcoded Guardrails

1. **FraudAgent**: Replace hardcoded `requiresSecondaryAuth: false` with config check
2. **IDVAgent**: Replace hardcoded `requiresSecondaryAuth: true` with config check
3. **BankingInfoAgent**: Make action parameters configurable

### Priority 2: Make System Prompts Configurable

All agents have extensive hardcoded system prompts that should be:
- Moved to the guardrails configuration
- Made editable through the admin UI
- Allow per-agent customization

### Priority 3: Create Prompt Templates

The current hardcoded prompts should become default templates that can be:
- Overridden per agent
- Customized per deployment
- Modified without code changes

## 🎯 Implementation Plan

### Step 1: Fix Remaining Hardcoded Guardrails
```javascript
// Replace in FraudAgent
const requiresSecondaryAuth = this.checkSecondaryAuthRequired('blockCard', context);
this.validateGuardrails('blockCard', { 
    action: 'card_blocking', 
    requiresSecondaryAuth 
});

// Replace in IDVAgent  
const requiresSecondaryAuth = this.checkSecondaryAuthRequired('resetPassword', context);
this.validateGuardrails('resetPassword', { 
    requiresSecondaryAuth,
    action: 'password_reset'
});
```

### Step 2: Create Configurable Prompt System
```javascript
// Add to guardrails configuration
"prompts": {
    "systemPrompts": {
        "FraudAgent": {
            "basePersonality": "You are an urgent, professional fraud detection...",
            "additionalInstructions": [...]
        }
    }
}
```

### Step 3: Update Admin UI
- Add system prompt editing interface
- Allow per-agent prompt customization
- Provide prompt templates and examples

## 🚨 Impact Assessment

**Current State:**
- Agents have inconsistent guardrails handling
- System prompts cannot be modified without code changes
- Configuration UI doesn't reflect actual agent behavior

**After Fixes:**
- All guardrails will respect admin UI settings
- System prompts will be fully configurable
- True separation between code and configuration
- Easier customization and deployment flexibility

## Files Requiring Changes

1. `agents/fraud-agent.js` - Fix hardcoded guardrails and prompts
2. `agents/idv-agent.js` - Fix hardcoded guardrails and prompts  
3. `agents/banking-info-agent.js` - Fix hardcoded guardrails and prompts
4. `agents/guardrails-manager.js` - Add prompt configuration support
5. Admin UI files - Add prompt editing interface

## Testing Required

- Verify all guardrails respect UI configuration
- Test prompt customization through admin UI
- Ensure backward compatibility
- Validate security constraints are maintained