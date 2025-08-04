/**
 * Basic Connectivity Test
 * Simple test to verify the test runner is working correctly
 */

class BasicConnectivityTest {
    constructor() {
        this.testResults = [];
    }

    async runAllTests() {
        console.log('Running basic connectivity tests...');
        
        await this.testBasicFunctionality();
        await this.testMockComponents();
        await this.testAsyncOperations();
        
        return this.testResults;
    }

    async testBasicFunctionality() {
        try {
            // Test basic JavaScript functionality
            this.assertTrue(true, 'Basic boolean test');
            this.assertEqual(1 + 1, 2, 'Basic arithmetic test');
            this.assertNotNull({}, 'Basic object test');
            
            this.addResult('basic_functionality', true, 'Basic JavaScript functionality working');
        } catch (error) {
            this.addResult('basic_functionality', false, `Basic functionality failed: ${error.message}`);
        }
    }

    async testMockComponents() {
        try {
            // Test that we can create mock objects
            const mockObject = {
                test: () => 'test result',
                async asyncTest() {
                    return new Promise(resolve => setTimeout(() => resolve('async result'), 10));
                }
            };
            
            this.assertEqual(mockObject.test(), 'test result', 'Mock object method call');
            
            const asyncResult = await mockObject.asyncTest();
            this.assertEqual(asyncResult, 'async result', 'Mock async method call');
            
            this.addResult('mock_components', true, 'Mock components working correctly');
        } catch (error) {
            this.addResult('mock_components', false, `Mock components failed: ${error.message}`);
        }
    }

    async testAsyncOperations() {
        try {
            // Test async/await functionality
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            
            const startTime = Date.now();
            await delay(50);
            const endTime = Date.now();
            
            const elapsed = endTime - startTime;
            this.assertTrue(elapsed >= 45, `Async delay should work (elapsed: ${elapsed}ms)`);
            
            // Test Promise.all
            const promises = [
                Promise.resolve(1),
                Promise.resolve(2),
                Promise.resolve(3)
            ];
            
            const results = await Promise.all(promises);
            this.assertEqual(results.length, 3, 'Promise.all should return all results');
            this.assertEqual(results[0], 1, 'First promise result');
            
            this.addResult('async_operations', true, 'Async operations working correctly');
        } catch (error) {
            this.addResult('async_operations', false, `Async operations failed: ${error.message}`);
        }
    }

    // Helper methods for assertions
    assertTrue(condition, message) {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    assertFalse(condition, message) {
        if (condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`Assertion failed: ${message}. Expected: ${expected}, Actual: ${actual}`);
        }
    }

    assertNotNull(value, message) {
        if (value === null || value === undefined) {
            throw new Error(`Assertion failed: ${message}. Value was null or undefined`);
        }
    }

    addResult(testName, passed, message) {
        this.testResults.push({
            test: testName,
            passed: passed,
            message: message,
            timestamp: new Date().toISOString()
        });
    }
}

// Export for use in other test files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BasicConnectivityTest;
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
    window.BasicConnectivityTest = BasicConnectivityTest;
}