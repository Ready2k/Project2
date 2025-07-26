# Agent Router Dependency Fix

## Problem
The test file `test/test-agent-system-comprehensive.html` was failing with the error:
```
ReferenceError: Can't find variable: AgentConfigManager
```

## Root Cause
The `AgentRouter` class depends on `AgentConfigManager`, but the test file was not including the `agent-config-manager.js` script.

## Solution
Added the missing script includes to the test file:

### Files Modified
- `test/test-agent-system-comprehensive.html`

### Changes Made
1. Added `<script src="../agents/agent-config-manager.js"></script>` before the agent-router.js include
2. Added `<script src="../agents/guardrails-manager.js"></script>` for completeness (AgentRouter has optional GuardrailsManager support)

### Script Loading Order
The correct order for loading agent-related scripts is:
```html
<script src="../agents/security-manager.js"></script>
<script src="../agents/agent-config-manager.js"></script>
<script src="../agents/guardrails-manager.js"></script>
<script src="../agents/base-agent.js"></script>
<script src="../agents/idv-agent.js"></script>
<script src="../agents/banking-info-agent.js"></script>
<script src="../agents/fraud-agent.js"></script>
<script src="../agents/payments-agent.js"></script>
<script src="../agents/agent-router.js"></script>
```

## Dependencies
The `AgentRouter` class requires:
- `AgentConfigManager` (mandatory) - manages agent configurations
- `SecurityManager` (mandatory) - handles security boundaries
- `GuardrailsManager` (optional) - provides additional safety checks
- `FallbackHandler` (built-in) - defined in the same file as AgentRouter

## Testing
Created additional test files to verify the fix:
- `test/test-dependency-check.html` - checks all dependencies are loaded
- `test/test-router-fix.html` - specifically tests AgentRouter instantiation

## Result
The `test-agent-system-comprehensive.html` should now load without the `AgentConfigManager` error and be able to instantiate the `AgentRouter` successfully.