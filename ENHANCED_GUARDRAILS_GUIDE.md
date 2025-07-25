# Enhanced Guardrails System Guide

## Overview

The Enhanced Guardrails System provides comprehensive security controls with customizable prompts and flexible authentication requirements. This system allows administrators to configure detailed security boundaries for each agent with personalized user messaging.

## Key Features

### 1. Customizable Prompts
- **Secondary Authentication Prompts**: Custom messages when additional verification is required
- **Restriction Blocked Prompts**: Custom messages when actions are blocked due to security restrictions
- **Compliance Prompts**: Custom messages for compliance-related notifications

### 2. Flexible Authentication Configuration
- **Per-Action Authentication**: Configure different auth requirements for each action
- **Multiple Authentication Types**: SMS, Email, Biometric, Security Questions, Two-Factor, Manual Verification
- **Granular Control**: Enable/disable authentication per action with specific auth types

### 3. Predefined Templates
- **Template Library**: Pre-built prompt templates for common scenarios
- **Easy Application**: One-click template application with customization options
- **Consistent Messaging**: Standardized prompts across different agents

## Configuration Structure

### Enhanced Guardrails Object
```javascript
{
  agentName: 'FraudAgent',
  allowedCapabilities: {
    canBlockCards: true,
    // ... other capabilities
  },
  restrictions: {
    maxTransactionAmount: 0,
    requiresSecondaryAuth: {
      blockCard: {
        enabled: true,
        authType: 'twoFactor',
        prompt: 'cardBlocking'
      }
    },
    blockedKeywords: ['send money', 'transfer'],
    timeBasedRestrictions: {}
  },
  prompts: {
    secondaryAuth: {
      blockCard: "For your security, I need to verify your identity before blocking your card..."
    },
    restrictionBlocked: {
      keywordBlocked: "I cannot process transaction requests for security reasons...",
      default: "I'm unable to complete this action due to security restrictions..."
    },
    compliance: {
      auditRequired: "This action will be logged for compliance purposes..."
    }
  },
  complianceRules: {
    logAllActions: true,
    requireAuditTrail: true,
    dataRetentionDays: 365
  }
}
```

## Authentication Types

| Type | Key | Description |
|------|-----|-------------|
| SMS Verification | `sms` | Send verification code via SMS |
| Email Verification | `email` | Send verification link via email |
| Biometric Authentication | `biometric` | Fingerprint, face, or voice recognition |
| Security Questions | `securityQuestions` | Challenge with predefined security questions |
| Two-Factor Authentication | `twoFactor` | Combined authentication methods |
| Manual Verification | `manualVerification` | Human agent verification |

## Prompt Templates

### Secondary Authentication Templates
- **cardBlocking**: "For your security, I need to verify your identity before blocking your card. Please provide your date of birth and the last 4 digits of your Social Security number."
- **passwordReset**: "To reset your password, I need to verify your identity. Please confirm your registered email address and answer your security question."
- **largeTransaction**: "This transaction requires additional verification. Please confirm the transaction details and provide your authentication code."
- **accountAccess**: "For security purposes, I need to verify your identity before accessing sensitive account information. Please provide your verification details."
- **default**: "Additional authentication is required for this action. Please verify your identity to proceed."

### Restriction Blocked Templates
- **capabilityDisabled**: "I'm unable to perform this action as it's not within my authorized capabilities. Please contact customer service for assistance."
- **transactionLimit**: "This transaction exceeds the maximum allowed amount of £{limit}. Please reduce the amount or contact customer service."
- **timeRestriction**: "This service is not available outside of business hours ({hours}). Please try again during our operating hours."
- **keywordBlocked**: "I cannot process requests containing certain restricted terms. Please rephrase your request or contact customer service."
- **default**: "I'm unable to complete this action due to security restrictions. Please contact customer service for assistance."

### Compliance Templates
- **auditRequired**: "This action will be logged for compliance purposes. Do you wish to continue?"
- **dataRetention**: "Your request will be retained for {days} days as per our data retention policy."
- **default**: "This action is subject to compliance monitoring."

## Agent-Specific Configurations

### FraudAgent
- **Primary Function**: Card security and fraud prevention
- **Key Authentication**: Card blocking requires two-factor authentication
- **Custom Prompts**: Security-focused messaging for card protection
- **Blocked Keywords**: Transaction-related terms to prevent misuse

### PaymentsAgent
- **Primary Function**: Money transfers and payments
- **Key Authentication**: Transfer initiation requires SMS verification
- **Custom Prompts**: Transaction-focused messaging with amount limits
- **Time Restrictions**: Business hours only (6 AM - 10 PM, Mon-Fri)

### IDVAgent
- **Primary Function**: Identity verification and password resets
- **Key Authentication**: Password reset requires security questions
- **Custom Prompts**: Identity verification focused messaging
- **Blocked Keywords**: Transaction terms to maintain focus

### BankingInfoAgent
- **Primary Function**: Account information and transaction history
- **Key Authentication**: No authentication required (read-only)
- **Custom Prompts**: Information-focused messaging
- **Restrictions**: Cannot perform any transaction-related actions

## API Methods

### Core Methods
```javascript
// Get prompt templates
const templates = guardrailsManager.getPromptTemplates();

// Get authentication types
const authTypes = guardrailsManager.getAuthenticationTypes();

// Set custom prompt
guardrailsManager.setCustomPrompt(agentName, promptType, action, prompt);

// Get custom prompt
const prompt = guardrailsManager.getCustomPrompt(agentName, promptType, action);

// Get available auth actions for agent
const actions = guardrailsManager.getAvailableAuthActions(agentName);

// Validate action with enhanced response
const result = guardrailsManager.validateAction(agentName, action, context);
// Returns: { allowed, reason, prompt, authType, requiresAuth }
```

### Enhanced Validation Response
```javascript
{
  allowed: false,
  reason: "Action blockCard requires secondary authentication",
  prompt: "For your security, I need to verify your identity before blocking your card...",
  authType: "twoFactor",
  requiresAuth: true
}
```

## UI Configuration

### Admin Interface Features
1. **Agent Selection**: Dropdown to choose which agent to configure
2. **Capability Toggles**: Enable/disable specific agent capabilities
3. **Authentication Configuration**: 
   - Toggle authentication requirements per action
   - Select authentication type for each action
   - Configure authentication-specific settings
4. **Custom Prompts Editor**:
   - Text areas for each prompt category
   - Template application buttons
   - Real-time preview of prompts
5. **Validation Testing**: Test guardrails with sample actions

### Configuration Steps
1. Select agent from dropdown
2. Configure allowed capabilities
3. Set up secondary authentication requirements
4. Customize prompts for different scenarios
5. Set compliance rules and restrictions
6. Test configuration with sample actions
7. Save configuration

## Testing

### Test Files
- **test-enhanced-guardrails.html**: Comprehensive testing interface
- **test-guardrails-quick.html**: Quick validation tests (updated)
- **llm-manager-admin-ui.html**: Full admin interface with enhanced features

### Test Scenarios
1. **Prompt Template Testing**: Verify all templates load correctly
2. **Secondary Auth Testing**: Test authentication requirements and prompts
3. **Custom Prompt Testing**: Verify custom prompts override templates
4. **Authentication Type Testing**: Confirm all auth types are available
5. **Action Availability Testing**: Check available actions per agent

## Best Practices

### Security
1. **Principle of Least Privilege**: Only enable necessary capabilities
2. **Appropriate Authentication**: Match auth type to action sensitivity
3. **Clear Messaging**: Use clear, user-friendly prompts
4. **Regular Review**: Periodically review and update configurations

### User Experience
1. **Consistent Prompts**: Use similar language across related actions
2. **Helpful Guidance**: Provide clear next steps in prompts
3. **Error Handling**: Include fallback prompts for edge cases
4. **Accessibility**: Ensure prompts are clear and accessible

### Compliance
1. **Audit Logging**: Enable comprehensive logging for sensitive actions
2. **Data Retention**: Set appropriate retention periods
3. **Documentation**: Maintain records of configuration changes
4. **Regular Testing**: Test guardrails regularly to ensure effectiveness

## Troubleshooting

### Common Issues
1. **Prompts Not Displaying**: Check prompt configuration and template fallbacks
2. **Authentication Not Required**: Verify auth configuration is enabled
3. **Templates Not Loading**: Ensure template system is initialized
4. **Configuration Not Saving**: Check validation errors and permissions

### Debug Methods
1. Use browser console to check for JavaScript errors
2. Test individual components using the test files
3. Verify guardrails configuration in localStorage
4. Check audit logs for configuration changes

## Migration from Legacy System

### Backward Compatibility
- Legacy array-based `requiresSecondaryAuth` still supported
- Existing configurations will continue to work
- Gradual migration path available

### Migration Steps
1. Backup existing configurations
2. Update to new object-based auth structure
3. Add custom prompts gradually
4. Test thoroughly before deployment
5. Update documentation and training

This enhanced guardrails system provides comprehensive security controls while maintaining flexibility and user-friendly messaging. The customizable prompts and authentication options allow for tailored security experiences that match your organization's specific needs.