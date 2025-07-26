# Guardrails System Implementation Guide

## Overview

The Guardrails System provides comprehensive security boundaries and capability restrictions for domain-specific agents in the voice banking architecture. It implements multi-layered access controls, transaction limits, and audit trails to ensure secure agent operations.

## Architecture

### Core Components

1. **GuardrailsManager** - Central management of all guardrails configurations
2. **BaseAgent Integration** - Built-in validation methods for all agents
3. **Domain Agent Enforcement** - Specific restrictions per agent type
4. **Violation Logging** - Comprehensive audit trail system

## Configuration Structure

```javascript
{
  agentName: "PaymentsAgent",
  allowedCapabilities: {
    canAccessAccountData: true,
    canInitiateTransactions: true,
    canBlockCards: false,
    canResetPasswords: false,
    canAccessTransactionHistory: true,
    canProvideBalanceInfo: true
  },
  restrictions: {
    maxTransactionAmount: 1000,
    requiresSecondaryAuth: ['initiateTransfer'],
    blockedKeywords: [],
    timeBasedRestrictions: {
      allowedHours: [6, 22], // 6 AM to 10 PM
      allowedDays: [1, 2, 3, 4, 5] // Monday to Friday
    }
  },
  complianceRules: {
    logAllActions: true,
    requireAuditTrail: true,
    dataRetentionDays: 2555 // 7 years
  }
}
```

## Agent-Specific Configurations

### IDVAgent (Identity & Verification)
- **Allowed**: Account data access, password resets
- **Blocked**: Transactions, card operations, balance info
- **Secondary Auth**: Required for password resets
- **Transaction Limit**: £0 (no transactions allowed)

### BankingInfoAgent (Account Information)
- **Allowed**: Balance info, transaction history, account data
- **Blocked**: Transactions, payments, card operations
- **Secondary Auth**: None required
- **Transaction Limit**: £0 (read-only access)

### FraudAgent (Security & Fraud)
- **Allowed**: Card blocking, account data, transaction history
- **Blocked**: Transactions, payments, password resets
- **Secondary Auth**: Required for card blocking
- **Transaction Limit**: £0 (protective actions only)

### PaymentsAgent (Transactions)
- **Allowed**: All transaction capabilities, balance info
- **Blocked**: Card operations, password resets
- **Secondary Auth**: Required for transfers
- **Transaction Limit**: £1000 per transaction
- **Time Restrictions**: Monday-Friday, 6 AM - 10 PM

## Usage Examples

### Basic Validation

```javascript
// Initialize guardrails manager
const guardrailsManager = new GuardrailsManager();

// Validate an action
const validation = guardrailsManager.validateAction(
  'PaymentsAgent', 
  'initiateTransfer', 
  { 
    amount: 500, 
    secondaryAuthCompleted: true 
  }
);

if (validation.allowed) {
  // Proceed with action
  console.log('Action allowed:', validation.reason);
} else {
  // Block action and log violation
  console.log('Action blocked:', validation.reason);
}
```

### Agent Integration

```javascript
// In agent implementation
class PaymentsAgent extends BaseAgent {
  async handle(inputText, context) {
    try {
      // Validate guardrails before processing
      this.validateGuardrails('initiateTransfer', { 
        amount: extractedAmount,
        secondaryAuthCompleted: context.authCompleted 
      });
      
      // Proceed with secure processing
      return await this.processPayment(inputText, context);
    } catch (error) {
      // Guardrails violation - return error
      return this.createResponse(false, 'Action not permitted', 0, 0, error.message);
    }
  }
}
```

### Capability Checking

```javascript
// Check if agent has specific capability
if (agent.isCapabilityAllowed('canInitiateTransactions')) {
  // Agent can perform transactions
} else {
  // Redirect to appropriate agent
}

// Check secondary auth requirements
if (agent.requiresSecondaryAuth('blockCard')) {
  // Prompt for additional authentication
}

// Validate transaction amounts
try {
  agent.validateTransactionAmount(1500);
} catch (error) {
  // Amount exceeds limits
}
```

## Violation Logging

All guardrails violations are automatically logged with:

- **Timestamp**: When the violation occurred
- **Agent Name**: Which agent attempted the action
- **Action**: What action was attempted
- **Reason**: Why it was blocked
- **Context**: Additional context data

```javascript
// Retrieve violation history
const violations = guardrailsManager.getViolationHistory('PaymentsAgent', 50);

violations.forEach(violation => {
  console.log(`${violation.timestamp}: ${violation.agentName} - ${violation.reason}`);
});
```

## Testing

### Test Mode

For testing purposes, you can disable time-based restrictions:

```javascript
// Enable test mode (disables time restrictions)
guardrailsManager.enableTestMode();

// Or disable for specific agent
guardrailsManager.disableTimeRestrictionsForTesting('PaymentsAgent');
```

### Running Tests

1. **Component Tests**: `test-guardrails-system.html`
   - Tests individual guardrails components
   - Validates configuration and restrictions
   - Checks violation logging

2. **Integration Tests**: `test-guardrails-integration.html`
   - Tests end-to-end agent integration
   - Validates real-world scenarios
   - Checks cross-agent restrictions

3. **Quick Tests**: `test-guardrails-quick.html`
   - Fast validation of core functionality
   - Debugging specific issues

## Configuration Management

### Setting Custom Guardrails

```javascript
const customGuardrails = {
  allowedCapabilities: {
    canAccessAccountData: true,
    canInitiateTransactions: false
  },
  restrictions: {
    maxTransactionAmount: 500,
    requiresSecondaryAuth: ['resetPassword'],
    blockedKeywords: ['transfer', 'send'],
    timeBasedRestrictions: {
      allowedHours: [9, 17], // Business hours only
      allowedDays: [1, 2, 3, 4, 5] // Weekdays only
    }
  }
};

guardrailsManager.setGuardrails('CustomAgent', customGuardrails);
```

### Export/Import Configuration

```javascript
// Export all guardrails
const exportData = guardrailsManager.exportGuardrails();

// Import guardrails
guardrailsManager.importGuardrails(exportData);

// Reset to defaults
guardrailsManager.resetToDefaults();
```

## Security Features

### Multi-layered Validation
1. **Capability Check**: Does agent have permission for this type of action?
2. **Amount Validation**: Is transaction within allowed limits?
3. **Keyword Filtering**: Does action contain blocked terms?
4. **Time Restrictions**: Is action allowed at current time/day?
5. **Secondary Auth**: Does action require additional authentication?

### Audit Compliance
- All actions are logged with full context
- Violation history is maintained per agent
- Configurable data retention periods
- Structured audit trail for compliance reporting

### Real-time Enforcement
- Actions are validated before execution
- Immediate blocking of unauthorized operations
- Detailed error messages for debugging
- Automatic violation logging

## Best Practices

1. **Always validate actions** before execution in agent handlers
2. **Provide proper context** including amounts and auth status
3. **Handle violations gracefully** with user-friendly error messages
4. **Monitor violation logs** for security analysis
5. **Test thoroughly** with various scenarios and edge cases
6. **Use test mode** during development to avoid time restrictions
7. **Configure appropriate limits** based on business requirements
8. **Implement secondary auth** for sensitive operations

## Troubleshooting

### Common Issues

1. **Actions blocked unexpectedly**
   - Check if secondary authentication is required
   - Verify time-based restrictions
   - Ensure proper context is provided

2. **Time restrictions failing tests**
   - Enable test mode: `guardrailsManager.enableTestMode()`
   - Check current time against allowed hours/days

3. **Capability checks failing**
   - Verify agent name matches configuration
   - Check capability spelling and case sensitivity
   - Ensure guardrails are properly initialized

### Debug Information

```javascript
// Get current guardrails for agent
const config = guardrailsManager.getGuardrails('PaymentsAgent');
console.log('Current config:', config);

// Check all guardrails
const allConfigs = guardrailsManager.getAllGuardrails();
console.log('All configurations:', allConfigs);

// View recent violations
const violations = guardrailsManager.getViolationHistory('PaymentsAgent');
console.log('Recent violations:', violations);
```

## Requirements Compliance

The guardrails system satisfies all specified requirements:

- **12.1**: ✅ Capability-based access control with granular permissions
- **12.2**: ✅ Transaction amount limits with configurable thresholds  
- **12.3**: ✅ Real-time action validation with immediate blocking
- **12.4**: ✅ Comprehensive audit trail with violation logging

This implementation provides a robust, flexible, and secure foundation for agent capability management in the voice banking system.