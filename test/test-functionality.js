// Quick functionality test for the new interface
console.log('🧪 Testing New Interface Functionality...\n');

// Test 1: Check if all required elements exist
function testElementsExist() {
    console.log('1. Testing element existence...');
    const requiredElements = [
        'settingsBtn', 'adminBtn', 'debugBtn', 'helpBtn',
        'conversation', 'startBtn', 'clearConversationBtn',
        'connectionStatus', 'currentAgent', 'status'
    ];
    
    let allExist = true;
    requiredElements.forEach(id => {
        const element = document.getElementById(id);
        if (!element) {
            console.log(`   ❌ Missing element: ${id}`);
            allExist = false;
        }
    });
    
    if (allExist) {
        console.log('   ✅ All required elements found');
    }
    return allExist;
}

// Test 2: Check if MainInterfaceController is initialized
function testControllerInit() {
    console.log('2. Testing controller initialization...');
    if (window.mainInterface && typeof window.mainInterface.openPanel === 'function') {
        console.log('   ✅ MainInterfaceController initialized correctly');
        return true;
    } else {
        console.log('   ❌ MainInterfaceController not properly initialized');
        return false;
    }
}

// Test 3: Test panel functionality
function testPanelFunctionality() {
    console.log('3. Testing panel functionality...');
    if (!window.mainInterface) return false;
    
    try {
        // Test opening settings panel
        window.mainInterface.openPanel('settingsPanel');
        const settingsPanel = document.getElementById('settingsPanel');
        
        if (settingsPanel && settingsPanel.classList.contains('open')) {
            console.log('   ✅ Panel opening works');
            
            // Test closing panel
            window.mainInterface.closePanel('settingsPanel');
            if (!settingsPanel.classList.contains('open')) {
                console.log('   ✅ Panel closing works');
                return true;
            } else {
                console.log('   ❌ Panel closing failed');
                return false;
            }
        } else {
            console.log('   ❌ Panel opening failed');
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Panel test error: ${error.message}`);
        return false;
    }
}

// Test 4: Test interface update methods
function testInterfaceUpdates() {
    console.log('4. Testing interface update methods...');
    if (!window.mainInterface) return false;
    
    try {
        // Test status update
        window.mainInterface.updateStatus('Test status');
        const statusElement = document.getElementById('status');
        
        if (statusElement && statusElement.textContent === 'Test status') {
            console.log('   ✅ Status update works');
        } else {
            console.log('   ❌ Status update failed');
            return false;
        }
        
        // Test agent indicator update
        window.mainInterface.updateAgentIndicator('Test Agent');
        const agentElement = document.getElementById('currentAgent');
        
        if (agentElement && agentElement.textContent === 'Test Agent') {
            console.log('   ✅ Agent indicator update works');
        } else {
            console.log('   ❌ Agent indicator update failed');
            return false;
        }
        
        // Test connection status update
        window.mainInterface.updateConnectionStatus('connected');
        const connectionElement = document.getElementById('connectionStatus');
        
        if (connectionElement && connectionElement.classList.contains('connected')) {
            console.log('   ✅ Connection status update works');
        } else {
            console.log('   ❌ Connection status update failed');
            return false;
        }
        
        return true;
    } catch (error) {
        console.log(`   ❌ Interface update test error: ${error.message}`);
        return false;
    }
}

// Test 5: Test CSS styling
function testStyling() {
    console.log('5. Testing CSS styling...');
    const topNav = document.querySelector('.top-nav');
    
    if (topNav) {
        const computedStyle = window.getComputedStyle(topNav);
        if (computedStyle.display === 'flex') {
            console.log('   ✅ CSS styles loaded correctly');
            return true;
        } else {
            console.log('   ❌ CSS styles not properly applied');
            return false;
        }
    } else {
        console.log('   ❌ Top navigation element not found');
        return false;
    }
}

// Run all tests
function runAllTests() {
    console.log('🚀 Starting comprehensive functionality tests...\n');
    
    const tests = [
        { name: 'Element Existence', test: testElementsExist },
        { name: 'Controller Initialization', test: testControllerInit },
        { name: 'Panel Functionality', test: testPanelFunctionality },
        { name: 'Interface Updates', test: testInterfaceUpdates },
        { name: 'CSS Styling', test: testStyling }
    ];
    
    let passed = 0;
    let failed = 0;
    
    tests.forEach(({ name, test }) => {
        try {
            if (test()) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            console.log(`   💥 Test "${name}" threw error: ${error.message}`);
            failed++;
        }
        console.log(''); // Empty line for readability
    });
    
    console.log('📊 Test Results:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
    
    if (passed === tests.length) {
        console.log('\n🎉 All tests passed! The new interface is working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Please check the implementation.');
    }
}

// Auto-run tests when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(runAllTests, 500);
    });
} else {
    setTimeout(runAllTests, 500);
}

// Export for manual testing
window.testFunctionality = {
    runAllTests,
    testElementsExist,
    testControllerInit,
    testPanelFunctionality,
    testInterfaceUpdates,
    testStyling
};