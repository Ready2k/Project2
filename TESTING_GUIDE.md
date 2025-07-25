# 🧪 LLM Manager Admin UI - Testing Guide

## Agent Indicator Feature Testing

The agent indicator shows which AI agent is currently handling the user's request in the voice chat interface.

### Quick Test Files
1. **`test-agent-indicator.html`** - Tests the visual indicator functionality
2. **`test-agent-indicator-integration.html`** - Tests integration with agent routing  
3. **`index.html`** - Test in the main voice chat application

### Expected Agent Behavior
- **Default Agent** (Purple): Handles general queries when no specific agent matches
- **Fraud Agent** (Red): Handles card security, fraud reports, blocking cards  
- **Payments Agent** (Green): Handles money transfers, payments, sending money
- **IDV Agent** (Orange): Handles identity verification, password resets
- **Banking Info Agent** (Blue): Handles balance inquiries, transaction history

### Test Scenarios
1. **Fraud Detection**: "I've lost my card" → Should show "Fraud Agent" in red
2. **Payment Request**: "Send £50 to Alice" → Should show "Payments Agent" in green
3. **Balance Inquiry**: "What's my balance?" → Should show "Banking Info Agent" in blue  
4. **General Query**: "What's the weather?" → Should show "Default Agent" in purple
5. **Disabled Agents**: Disable all agents → Should always show "Default Agent"

---

## Quick Start Testing

### 1. **Basic Functionality Test**
Open `test-llm-manager-admin-ui.html` in your browser:

```bash
# Option 1: Direct file open
open test-llm-manager-admin-ui.html

# Option 2: Using a local server (recommended)
python3 -m http.server 8000
# Then visit: http://localhost:8000/test-llm-manager-admin-ui.html
```

### 2. **Main Admin UI Test**
Open the main admin interface:

```bash
# Option 1: Direct file open
open llm-manager-admin-ui.html

# Option 2: Using a local server (recommended)
python3 -m http.server 8000
# Then visit: http://localhost:8000/llm-manager-admin-ui.html
```

## 🔧 Step-by-Step Testing Process

### **Phase 1: Component Initialization**
1. Open `test-llm-manager-admin-ui.html`
2. Click **"Initialize All Components"** button
3. Verify all status indicators turn green ✅
4. Check console for any error messages

### **Phase 2: Agent Overview Testing**
1. Click **"Test Agent Overview"** button
2. Verify agent statistics are displayed
3. Click **"Test Agent Grid"** button
4. Check that agent cards are rendered properly
5. Click **"Test Agent Toggle"** to test enable/disable functionality

### **Phase 3: Configuration Modal Testing**
1. Click **"Test Configuration Modal"** button
2. Verify configuration data is loaded
3. Click **"Test Tabbed Interface"** button
4. Check that all tabs work properly
5. Click **"Test Configuration Save"** to verify persistence

### **Phase 4: Enhanced Guardrails Editor Testing**
1. Click **"Test Guardrails Editor"** button
2. Verify guardrails data is loaded
3. Click **"Test Capability Toggles"** button
4. **NEW**: Test secondary authentication configuration
   - Toggle auth requirements for different actions
   - Select authentication types (SMS, Email, Biometric, etc.)
   - Verify auth toggles show/hide configuration details
5. **NEW**: Test custom prompts configuration
   - Modify secondary auth prompts
   - Update restriction blocked prompts
   - Use "Use Template" buttons to apply predefined prompts
6. Test guardrails validation with **"Test Guardrails Validation"**
   - Verify custom prompts are displayed in validation results
   - Check authentication type information is included
7. Click **"Test Guardrails Save"** to verify persistence

### **Phase 5: Enhanced Guardrails Validation Testing**
1. Open **"test-enhanced-guardrails.html"** in browser
2. Click **"Run All Tests"** to execute comprehensive guardrails tests
3. Verify the following test results:
   - ✅ Prompt templates are loaded correctly
   - ✅ Secondary authentication validation works
   - ✅ Custom prompts can be set and retrieved
   - ✅ Authentication types are available
   - ✅ Available auth actions are returned per agent
4. Test individual components:
   - Click **"Test Prompt Templates"** - verify all template categories
   - Click **"Test Secondary Auth"** - check auth requirements and prompts
   - Click **"Test Custom Prompts"** - verify custom prompt functionality

### **Phase 6: Voice Configuration Testing**
1. Click **"Test Voice Configuration"** button
2. Verify voice settings are loaded
3. Click **"Test Voice Preview"** button
4. Check available providers with **"Test Voice Providers"**
5. Click **"Test Voice Save"** to verify persistence

### **Phase 6: Audit Log Testing**
1. Click **"Test Audit Log"** button
2. Verify audit events are created
3. Click **"Test Audit Filtering"** button
4. Test event creation with **"Test Audit Events"**
5. Click **"Test Audit Clear"** to verify clearing functionality

### **Phase 7: Integration Testing**
1. Click **"Test Data Persistence"** button
2. Verify localStorage integration
3. Click **"Test Export/Import"** button
4. Test error handling with **"Test Error Handling"**
5. Run **"Run Full Integration Test"** for comprehensive testing

## 🎯 Main Admin UI Testing

### **Testing the Live Interface**
1. Open `llm-manager-admin-ui.html`
2. Navigate through all sections:
   - **Agent Overview** - Check agent status grid
   - **Configuration** - Test agent configuration modal
   - **Guardrails** - Test capability toggles
   - **Voice Settings** - Test voice configuration
   - **Audit Log** - Check event logging

### **Key Features to Test**

#### **Agent Overview Panel:**
- ✅ Agent status indicators (online/offline)
- ✅ Statistics display (total, enabled, disabled)
- ✅ Agent cards with details
- ✅ Quick action buttons (Configure, Guardrails, Voice, Toggle)

#### **Configuration Modal:**
- ✅ Modal opens when clicking "Configure" on agent card
- ✅ All 4 tabs work (Basic, LLM, Triggers, Advanced)
- ✅ Form fields populate with current values
- ✅ Toggle switches work for boolean settings
- ✅ Save functionality persists changes

#### **Enhanced Guardrails Editor:**
- ✅ Agent selection dropdown works
- ✅ Capability toggles function properly
- ✅ **NEW**: Secondary authentication configuration
  - ✅ Auth action toggles work correctly
  - ✅ Authentication type selection functions
  - ✅ Configuration details show/hide properly
- ✅ **NEW**: Custom prompts configuration
  - ✅ Prompt text areas accept custom text
  - ✅ "Use Template" buttons populate default prompts
  - ✅ Different prompt categories (auth, blocked, compliance)
- ✅ Restrictions form accepts input
- ✅ Compliance rules toggles work
- ✅ Save and test buttons function

#### **Voice Configuration:**
- ✅ Agent selection dropdown works
- ✅ TTS provider selection updates voice options
- ✅ All sliders and controls work
- ✅ Voice preview generates mock results
- ✅ Save functionality persists settings

#### **Audit Log:**
- ✅ Events are logged for all actions
- ✅ Filtering by category works
- ✅ Timestamps are accurate
- ✅ Clear log functionality works

## 🐛 Common Issues & Solutions

### **Issue 1: "Function not defined" errors**
**Solution:** Ensure all JavaScript files are loaded in correct order:
```html
<script src="debug-manager.js"></script>
<script src="agents/llm-manager.js"></script>
<script src="agents/guardrails-manager.js"></script>
<script src="agents/voice-config-manager.js"></script>
<script src="llm-manager-admin-ui.js"></script>
```

### **Issue 2: LocalStorage not persisting**
**Solution:** Use a local server instead of file:// protocol:
```bash
python3 -m http.server 8000
```

### **Issue 3: Modal not opening**
**Solution:** Check browser console for JavaScript errors and ensure all dependencies are loaded.

### **Issue 4: Styles not loading**
**Solution:** Verify all CSS is embedded in HTML files or linked properly.

## 📊 Expected Test Results

### **Successful Test Indicators:**
- ✅ All component status indicators are green
- ✅ Agent cards display with proper information
- ✅ Configuration modal opens and saves successfully
- ✅ Enhanced guardrails system works and saves properly
  - ✅ Custom prompts are saved and retrieved correctly
  - ✅ Secondary auth configuration persists
  - ✅ Validation includes custom prompts and auth types
- ✅ Voice configuration loads and previews work
- ✅ Audit log captures all events
- ✅ Export/import functionality works
- ✅ No JavaScript errors in console

### **Performance Benchmarks:**
- ⚡ Page load time: < 2 seconds
- ⚡ Modal open time: < 500ms
- ⚡ Configuration save time: < 1 second
- ⚡ Agent grid render time: < 1 second

## 🚀 Production Readiness Checklist

- [ ] All automated tests pass
- [ ] Manual testing completed for all features
- [ ] Cross-browser compatibility verified
- [ ] Mobile responsiveness tested
- [ ] Performance benchmarks met
- [ ] Security validation completed
- [ ] Accessibility compliance verified
- [ ] Error handling tested
- [ ] Data persistence verified
- [ ] Export/import functionality working

## 📞 Support

If you encounter any issues during testing:

1. **Check the browser console** for JavaScript errors
2. **Verify file dependencies** are loaded correctly
3. **Use a local server** instead of file:// protocol
4. **Clear browser cache** and localStorage if needed
5. **Check network tab** for failed resource loads

The admin UI is designed to be robust and user-friendly. Most issues can be resolved by ensuring proper file loading order and using a local development server.