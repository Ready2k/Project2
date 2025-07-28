/**
 * Node.js Test for ErrorReporter
 * 
 * Tests the ErrorReporter class functionality in a server environment
 */

const ErrorReporter = require('../agents/error-reporter.js');

class TestRunner {
    constructor() {
        this.tests = [];
        this.results = [];
    }

    addTest(name, testFn) {
        this.tests.push({ name, testFn });
    }

    async runTests() {
        console.log('🧪 Running ErrorReporter Tests...\n');
        
        for (const test of this.tests) {
            try {
                console.log(`Running: ${test.name}`);
                await test.testFn();
                this.results.push({ name: test.name, success: true });
                console.log(`✅ ${test.name} - PASSED\n`);
            } catch (error) {
                this.results.push({ name: test.name, success: false, error: error.message });
                console.log(`❌ ${test.name} - FAILED: ${error.message}\n`);
            }
        }

        this.printSummary();
    }

    printSummary() {
        const passed = this.results.filter(r => r.success).length;
        const total = this.results.length;
        
        console.log('📊 Test Summary:');
        console.log(`Passed: ${passed}/${total}`);
        
        if (passed === total) {
            console.log('🎉 All tests passed!');
        } else {
            console.log('⚠️  Some tests failed:');
            this.results.filter(r => !r.success).forEach(r => {
                console.log(`  - ${r.name}: ${r.error}`);
            });
        }
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }
}

// Custom error classes for testing
class SecurityError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SecurityError';
    }
}

class NetworkError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NetworkError';
    }
}

// Initialize test runner
const testRunner = new TestRunner();

// Test 1: Basic Error Reporting
testRunner.addTest('Basic Error Reporting', async () => {
    const errorReporter = new ErrorReporter();
    const error = new Error('Test error message');
    const context = {
        component: 'test-component',
        operation: 'test-operation',
        userId: 'user123'
    };

    const report = errorReporter.report(error, context);

    testRunner.assert(report !== null, 'Report should not be null');
    testRunner.assert(report.id, 'Report should have an ID');
    testRunner.assert(report.error, 'Report should have error information');
    testRunner.assert(report.context, 'Report should have context');
    testRunner.assert(report.severity, 'Report should have severity');
    testRunner.assert(report.timestamp, 'Report should have timestamp');
});

// Test 2: Severity Classification
testRunner.addTest('Severity Classification', async () => {
    const errorReporter = new ErrorReporter();
    
    const testCases = [
        { error: new SecurityError('Security violation'), expectedSeverity: 'CRITICAL' },
        { error: new NetworkError('Network timeout'), expectedSeverity: 'HIGH' },
        { error: new Error('Invalid input'), expectedSeverity: 'MEDIUM' },
        { error: new Error('Minor issue'), expectedSeverity: 'LOW' }
    ];

    testCases.forEach((testCase, index) => {
        const report = errorReporter.report(testCase.error, { component: 'test' });
        testRunner.assert(
            report.severity === testCase.expectedSeverity,
            `Test case ${index + 1}: Expected ${testCase.expectedSeverity}, got ${report.severity}`
        );
    });
});

// Test 3: Context Sanitization
testRunner.addTest('Context Sanitization', async () => {
    const errorReporter = new ErrorReporter();
    
    const sensitiveContext = {
        password: 'secret123',
        apiKey: 'sk-1234567890abcdef',
        email: 'user@example.com',
        normalField: 'normal value',
        nested: {
            token: 'bearer-token-123',
            publicData: 'public info'
        }
    };

    const error = new Error('Test error');
    const report = errorReporter.report(error, sensitiveContext);
    const sanitizedContext = report.context;

    // Check that sensitive fields are masked
    testRunner.assert(
        sanitizedContext.password && sanitizedContext.password.includes('*'),
        'Password should be masked'
    );
    testRunner.assert(
        sanitizedContext.apiKey && sanitizedContext.apiKey.includes('*'),
        'API key should be masked'
    );
    testRunner.assert(
        sanitizedContext.nested?.token && sanitizedContext.nested.token.includes('*'),
        'Nested token should be masked'
    );
    testRunner.assert(
        sanitizedContext.normalField === 'normal value',
        'Normal field should be preserved'
    );
});

// Test 4: Alert System
testRunner.addTest('Alert System', async () => {
    const errorReporter = new ErrorReporter({ alertThreshold: 'MEDIUM' });
    let alertsReceived = [];

    // Register alert callback
    errorReporter.onAlert((alert) => {
        alertsReceived.push(alert);
    });

    // Test high-severity error that should trigger alert
    const highSeverityError = new SecurityError('Security breach detected');
    errorReporter.report(highSeverityError, { component: 'security' });

    // Test low-severity error that should not trigger alert
    const lowSeverityError = new Error('Minor issue');
    errorReporter.report(lowSeverityError, { component: 'test' });

    testRunner.assert(alertsReceived.length === 1, `Expected 1 alert, got ${alertsReceived.length}`);
    testRunner.assert(alertsReceived[0].severity === 'CRITICAL', 'Alert should be CRITICAL severity');
});

// Test 5: Error Rate Monitoring
testRunner.addTest('Error Rate Monitoring', async () => {
    const errorReporter = new ErrorReporter();
    let alertsReceived = [];

    // Register alert callback
    errorReporter.onAlert((alert) => {
        alertsReceived.push(alert);
    });

    // Clear previous error rates
    errorReporter.clearErrorRates();

    // Generate multiple high-severity errors to trigger rate alert
    for (let i = 0; i < 7; i++) {
        const error = new NetworkError(`High severity error ${i}`);
        errorReporter.report(error, { component: 'api-client' });
    }

    const stats = errorReporter.getErrorRateStats('api-client');
    const rateAlerts = alertsReceived.filter(alert => alert.type === 'ERROR_RATE_THRESHOLD');

    testRunner.assert(stats.totalErrors === 7, `Expected 7 errors, got ${stats.totalErrors}`);
    testRunner.assert(rateAlerts.length > 0, 'Should have triggered error rate alert');
});

// Test 6: Recovery Logging
testRunner.addTest('Recovery Logging', async () => {
    const errorReporter = new ErrorReporter();
    
    const error = new Error('Network connection failed');
    const context = { component: 'streaming', operation: 'connect' };
    const options = {
        recoveryAttempted: true,
        recoverySuccessful: true,
        recoveryStrategy: 'exponential-backoff'
    };

    const report = errorReporter.report(error, context, options);

    testRunner.assert(report.recovery.attempted === true, 'Recovery attempted should be true');
    testRunner.assert(report.recovery.successful === true, 'Recovery successful should be true');
    testRunner.assert(report.recovery.strategy === 'exponential-backoff', 'Recovery strategy should be logged');
});

// Test 7: Stack Trace Sanitization
testRunner.addTest('Stack Trace Sanitization', async () => {
    const errorReporter = new ErrorReporter();
    
    const error = new Error('Test error');
    // Simulate a stack trace with sensitive paths
    error.stack = `Error: Test error
    at testFunction (/home/user/sensitive/project/file.js:10:5)
    at main (/home/user/sensitive/project/main.js:20:10)`;

    const report = errorReporter.report(error, { component: 'test' });

    testRunner.assert(report.stackTrace, 'Stack trace should be present');
    testRunner.assert(
        !report.stackTrace.includes('/home/user/sensitive'),
        'Stack trace should not contain sensitive paths'
    );
});

// Test 8: Error Message Sanitization
testRunner.addTest('Error Message Sanitization', async () => {
    const errorReporter = new ErrorReporter();
    
    const error = new Error('User email user@example.com failed validation with token abc123def456ghi789');
    const report = errorReporter.report(error, { component: 'validation' });

    testRunner.assert(
        report.error.message.includes('[EMAIL]'),
        'Email should be replaced with [EMAIL]'
    );
    testRunner.assert(
        report.error.message.includes('[TOKEN]'),
        'Long token should be replaced with [TOKEN]'
    );
});

// Test 9: Callback Management
testRunner.addTest('Callback Management', async () => {
    const errorReporter = new ErrorReporter();
    let logCallbackCalled = false;
    let alertCallbackCalled = false;

    const logCallback = () => { logCallbackCalled = true; };
    const alertCallback = () => { alertCallbackCalled = true; };

    // Register callbacks
    errorReporter.onLog(logCallback);
    errorReporter.onAlert(alertCallback);

    // Trigger error that should call both callbacks
    const error = new SecurityError('Critical error');
    errorReporter.report(error, { component: 'test' });

    testRunner.assert(logCallbackCalled, 'Log callback should be called');
    testRunner.assert(alertCallbackCalled, 'Alert callback should be called');

    // Test callback removal
    errorReporter.offLog(logCallback);
    errorReporter.offAlert(alertCallback);

    logCallbackCalled = false;
    alertCallbackCalled = false;

    errorReporter.report(error, { component: 'test' });

    testRunner.assert(!logCallbackCalled, 'Log callback should not be called after removal');
    testRunner.assert(!alertCallbackCalled, 'Alert callback should not be called after removal');
});

// Test 10: Error Rate Statistics
testRunner.addTest('Error Rate Statistics', async () => {
    const errorReporter = new ErrorReporter();
    
    // Clear previous data
    errorReporter.clearErrorRates();

    // Generate errors for different components
    errorReporter.report(new Error('Error 1'), { component: 'component-a' });
    errorReporter.report(new NetworkError('Error 2'), { component: 'component-a' });
    errorReporter.report(new Error('Error 3'), { component: 'component-b' });

    const statsA = errorReporter.getErrorRateStats('component-a');
    const statsB = errorReporter.getErrorRateStats('component-b');
    const allStats = errorReporter.getAllErrorRateStats();

    testRunner.assert(statsA.totalErrors === 2, `Component A should have 2 errors, got ${statsA.totalErrors}`);
    testRunner.assert(statsB.totalErrors === 1, `Component B should have 1 error, got ${statsB.totalErrors}`);
    testRunner.assert(allStats.length === 2, `Should have stats for 2 components, got ${allStats.length}`);
});

// Run all tests
if (require.main === module) {
    testRunner.runTests().catch(console.error);
}

module.exports = TestRunner;