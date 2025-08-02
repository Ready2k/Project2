# Test Pages Documentation

## Overview
This directory contains comprehensive test pages for validating all the fixes implemented in the error-fixes-and-robustness-improvements branch. Each test page is designed to validate specific functionality and provide detailed debugging information.

## Test Page Categories

### 🔧 Core System Fixes
These test pages validate the fundamental system fixes that were preventing the voice banking system from functioning.

#### `test-debug-fix.html`
**Purpose**: Tests the debug manager fixes that were causing "debug is not a function" errors
**What it tests**:
- Debug manager initialization
- Module logger creation with all required methods
- Fallback logger functionality
- Components that use debug.debug() calls

**How to use**:
1. Open the page in a browser
2. Click "Run Tests" to validate debug functionality
3. Check that all tests pass (green checkmarks)
4. Review console output for detailed debug messages

#### `test-token-tracking-fix.html`
**Purpose**: Tests the token tracking fixes that were causing "trackTokens is not a function" errors
**What it tests**:
- Token tracker initialization
- Correct method calls (trackWhisperUsage, trackGptUsage, trackTtsUsage)
- API client integration with token tracking
- Usage statistics accuracy

**How to use**:
1. Enter your OpenAI API key in the configuration section
2. Run basic tests to validate token tracker setup
3. Test individual API methods (Whisper, GPT, TTS)
4. Verify usage statistics are properly updated

### 🌐 API Client Fixes
These test pages validate the API client enhancements and error handling improvements.

#### `test-api-client-debug.html`
**Purpose**: Comprehensive testing of API client functionality and error handling
**What it tests**:
- API client initialization and configuration
- Speech-to-text processing with real audio
- Error handling for various failure scenarios
- Token tracking integration

**How to use**:
1. Configure your OpenAI API key
2. Record audio using the built-in recorder
3. Test speech-to-text conversion
4. Review detailed error logs and debugging information

#### `test-simple-api-call.html`
**Purpose**: Basic API connectivity testing to isolate network and authentication issues
**What it tests**:
- Basic fetch calls to OpenAI API
- FormData creation and handling
- Network error scenarios
- Authentication validation

**How to use**:
1. Enter your OpenAI API key
2. Test basic API connectivity
3. Test FormData handling
4. Review error handling for different scenarios

### 🤖 Agent System Fixes
These test pages validate the agent routing and processing fixes.

#### `test-agent-routing-fix.html`
**Purpose**: Tests the agent routing system and response property fixes
**What it tests**:
- Agent router initialization
- Agent registration and configuration
- AI-powered agent selection
- Response property handling (response.text vs response.content)

**How to use**:
1. Configure your OpenAI API key
2. Run basic tests to validate agent setup
3. Test agent routing with different input types
4. Test individual agent functionality

#### `test-agent-count-debug.html`
**Purpose**: Debug agent count discrepancies between main page and admin UI
**What it tests**:
- LLM Manager agent configuration
- Agent Router agent registration
- localStorage data validation
- Agent count consistency

**How to use**:
1. Run tests to compare agent counts
2. Check localStorage for corrupted data
3. Use cleanup functions to remove invalid agents
4. Verify consistent agent counts across interfaces

### 🔒 Security System Fixes
These test pages validate the security manager and permission fixes.

#### `test-security-manager-fix.html`
**Purpose**: Tests the security manager method implementations
**What it tests**:
- Security manager initialization
- createSandboxedApiClient method
- Agent router integration with security
- Security statistics and monitoring

**How to use**:
1. Run basic tests to validate security manager setup
2. Test sandboxed client creation
3. Test agent router integration
4. Review security statistics and logs

#### `test-security-methods-fix.html`
**Purpose**: Comprehensive testing of all security manager methods
**What it tests**:
- validateDataAccess method
- validateApiAccess method
- getAuditLog method
- Agent integration with security validation

**How to use**:
1. Run all tests to validate security methods
2. Test data access validation scenarios
3. Test API access validation
4. Review audit log functionality

#### `test-agent-permissions-fix.html`
**Purpose**: Tests agent data access permissions that were causing processing failures
**What it tests**:
- Specific data type permissions for each agent
- Agent validation methods
- Permission matrix accuracy
- Security logging for access attempts

**How to use**:
1. Run tests to validate agent permissions
2. Review permission matrices for each agent
3. Test specific data types that were causing errors
4. Verify all agents can access required data

## Test Execution Guidelines

### Prerequisites
1. **OpenAI API Key**: Most tests require a valid OpenAI API key for full functionality
2. **Modern Browser**: Tests use modern JavaScript features and require a recent browser
3. **Network Access**: Some tests require internet connectivity to reach OpenAI APIs

### Test Execution Order
For comprehensive validation, run tests in this order:

1. **`test-debug-fix.html`** - Validate core debug functionality
2. **`test-token-tracking-fix.html`** - Validate token tracking
3. **`test-api-client-debug.html`** - Validate API client functionality
4. **`test-security-manager-fix.html`** - Validate security framework
5. **`test-agent-routing-fix.html`** - Validate agent routing
6. **`test-agent-permissions-fix.html`** - Validate agent permissions

### Expected Results
All tests should pass with green checkmarks (✅). Any red X marks (❌) indicate issues that need investigation.

### Troubleshooting
- **API Key Issues**: Ensure your OpenAI API key is valid and has sufficient credits
- **Network Issues**: Check internet connectivity and firewall settings
- **Browser Issues**: Try a different browser or clear cache/cookies
- **Permission Issues**: Check browser permissions for microphone access

## Test Page Features

### Common Features
All test pages include:
- **Detailed Logging**: Comprehensive logs for debugging
- **Error Reporting**: Specific error messages and stack traces
- **Status Indicators**: Clear success/failure indicators
- **Interactive Testing**: Buttons to run specific test scenarios

### Advanced Features
Some test pages include:
- **Audio Recording**: Built-in audio recording for speech-to-text testing
- **API Key Management**: Secure storage and management of API keys
- **Real-time Monitoring**: Live updates of system status and metrics
- **Export Functionality**: Ability to export logs and test results

## Integration with Main System

### Validation Workflow
1. Run test pages to validate fixes
2. Test main voice banking interface
3. Verify end-to-end functionality
4. Check usage statistics and logs

### Debugging Workflow
1. Identify issue in main system
2. Run relevant test page to isolate problem
3. Review detailed logs and error messages
4. Apply fixes and re-test

## Maintenance

### Updating Tests
When making changes to the main system:
1. Update relevant test pages to match new functionality
2. Add new test cases for new features
3. Ensure all tests still pass after changes

### Adding New Tests
When adding new functionality:
1. Create dedicated test page following existing patterns
2. Include comprehensive error handling and logging
3. Document test purpose and usage in this README

---

These test pages provide comprehensive validation of all system fixes and serve as both testing tools and debugging aids for ongoing development.