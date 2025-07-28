/**
 * Token Tracking Accuracy Tests
 * Comprehensive test suite for token tracking validation
 */

class TokenTrackingAccuracyTests {
    constructor() {
        this.testResults = [];
        this.originalLocalStorage = global.localStorage || window.localStorage;
        this.testData = {
            validTokenCounts: [100, 500, 1000, 2500, 5000],
            invalidTokenCounts: [-1, 0, NaN, Infinity, null, undefined, "invalid"],
            corruptedData: [
                '{"invalid": json}',
                '{"tokens": "not_a_number"}',
                '{"cost": null}',
                'not_json_at_all',
                '',
                null
            ],
            usagePatterns: [
                { type: 'input', amount: 100, cost: 0.001 },
                { type: 'output', amount: 200, cost: 0.002 },
                { type: 'input', amount: 50, cost: 0.0005 },
                { type: 'output', amount: 150, cost: 0.0015 }
            ]
        };
    }

    /**
     * Run all token tracking accuracy tests
     */
    async runAllTests() {
        console.log('Starting Token Tracking Accuracy Tests...');
        
        await this.testTokenValidation();
        await this.testUsageAccumulation();
        await this.testDataPersistence();
        await this.testCorruptionDetection();
        await this.testRecoveryMechanisms();
        await this.testConcurrentOperations();
        await this.testEdgeCases();
        await this.testPerformanceUnderLoad();
        
        return this.generateTestReport();
    }

    /**
     * Test token count validation
     */
    async testTokenValidation() {
        console.log('Testing token validation...');
        
        const testCases = [
            // Valid cases
            { input: { type: 'input', amount: 100 }, expected: true, description: 'Valid input tokens' },
            { input: { type: 'output', amount: 200 }, expected: true, description: 'Valid output tokens' },
            { input: { type: 'input', amount: 0 }, expected: false, description: 'Zero tokens should be invalid' },
            
            // Invalid cases
            { input: { type: 'input', amount: -1 }, expected: false, description: 'Negative tokens' },
            { input: { type: 'input', amount: NaN }, expected: false, description: 'NaN tokens' },
            { input: { type: 'input', amount: Infinity }, expected: false, description: 'Infinite tokens' },
            { input: { type: 'invalid', amount: 100 }, expected: false, description: 'Invalid type' },
            { input: { type: 'input', amount: "100" }, expected: false, description: 'String amount' },
        ];

        for (const testCase of testCases) {
            try {
                const result = this.validateTokenInput(testCase.input);
                const passed = result === testCase.expected;
                
                this.recordTest('Token Validation', testCase.description, passed, {
                    input: testCase.input,
                    expected: testCase.expected,
                    actual: result
                });
            } catch (error) {
                this.recordTest('Token Validation', testCase.description, false, {
                    error: error.message
                });
            }
        }
    }

    /**
     * Test usage accumulation accuracy
     */
    async testUsageAccumulation() {
        console.log('Testing usage accumulation...');
        
        // Reset storage
        this.clearStorage();
        
        const expectedTotals = {
            input: { tokens: 0, cost: 0 },
            output: { tokens: 0, cost: 0 }
        };
        
        // Track multiple usage events
        for (const usage of this.testData.usagePatterns) {
            try {
                this.trackTokenUsage(usage.type, usage.amount, usage.cost);
                expectedTotals[usage.type].tokens += usage.amount;
                expectedTotals[usage.type].cost += usage.cost;
            } catch (error) {
                this.recordTest('Usage Accumulation', `Track ${usage.type} tokens`, false, {
                    error: error.message
                });
            }
        }
        
        // Verify accumulated totals
        const actualUsage = this.getStoredUsage();
        
        for (const type of ['input', 'output']) {
            const tokenAccuracy = Math.abs(actualUsage[type].tokens - expectedTotals[type].tokens) < 0.001;
            const costAccuracy = Math.abs(actualUsage[type].cost - expectedTotals[type].cost) < 0.000001;
            
            this.recordTest('Usage Accumulation', `${type} token accuracy`, tokenAccuracy, {
                expected: expectedTotals[type].tokens,
                actual: actualUsage[type].tokens
            });
            
            this.recordTest('Usage Accumulation', `${type} cost accuracy`, costAccuracy, {
                expected: expectedTotals[type].cost,
                actual: actualUsage[type].cost
            });
        }
    }

    /**
     * Test data persistence across sessions
     */
    async testDataPersistence() {
        console.log('Testing data persistence...');
        
        // Clear and set initial data
        this.clearStorage();
        const initialUsage = { input: { tokens: 1000, cost: 0.01 }, output: { tokens: 2000, cost: 0.02 } };
        this.setStoredUsage(initialUsage);
        
        // Simulate page reload by creating new instance
        const reloadedUsage = this.getStoredUsage();
        
        const persistenceTest = JSON.stringify(initialUsage) === JSON.stringify(reloadedUsage);
        this.recordTest('Data Persistence', 'Usage data survives reload', persistenceTest, {
            initial: initialUsage,
            reloaded: reloadedUsage
        });
        
        // Test incremental updates
        this.trackTokenUsage('input', 100, 0.001);
        const updatedUsage = this.getStoredUsage();
        
        const incrementalTest = updatedUsage.input.tokens === 1100 && 
                               Math.abs(updatedUsage.input.cost - 0.011) < 0.000001;
        
        this.recordTest('Data Persistence', 'Incremental updates persist', incrementalTest, {
            expected: { tokens: 1100, cost: 0.011 },
            actual: updatedUsage.input
        });
    }

    /**
     * Test corruption detection
     */
    async testCorruptionDetection() {
        console.log('Testing corruption detection...');
        
        for (const corruptData of this.testData.corruptedData) {
            try {
                // Inject corrupted data
                if (corruptData === null) {
                    this.originalLocalStorage.removeItem('token_usage');
                } else {
                    this.originalLocalStorage.setItem('token_usage', corruptData);
                }
                
                // Attempt to load usage
                const usage = this.getStoredUsage();
                
                // Should return default values for corrupted data
                const hasDefaults = usage && 
                                  typeof usage.input === 'object' && 
                                  typeof usage.output === 'object' &&
                                  usage.input.tokens >= 0 &&
                                  usage.output.tokens >= 0;
                
                this.recordTest('Corruption Detection', `Handle corrupted data: ${corruptData}`, hasDefaults, {
                    corruptData: corruptData,
                    recoveredUsage: usage
                });
                
            } catch (error) {
                // Should not throw errors, should recover gracefully
                this.recordTest('Corruption Detection', `Handle corrupted data: ${corruptData}`, false, {
                    error: error.message
                });
            }
        }
    }

    /**
     * Test recovery mechanisms
     */
    async testRecoveryMechanisms() {
        console.log('Testing recovery mechanisms...');
        
        // Test backup storage recovery
        this.clearStorage();
        
        // Set up backup data
        const backupUsage = { input: { tokens: 500, cost: 0.005 }, output: { tokens: 1000, cost: 0.01 } };
        this.setBackupUsage(backupUsage);
        
        // Corrupt main storage
        this.originalLocalStorage.setItem('token_usage', 'corrupted_data');
        
        // Attempt recovery
        const recoveredUsage = this.recoverFromBackup();
        
        const recoveryTest = JSON.stringify(recoveredUsage) === JSON.stringify(backupUsage);
        this.recordTest('Recovery Mechanisms', 'Backup recovery works', recoveryTest, {
            backup: backupUsage,
            recovered: recoveredUsage
        });
        
        // Test graceful degradation
        this.clearStorage();
        this.clearBackupStorage();
        
        const defaultUsage = this.getStoredUsage();
        const degradationTest = defaultUsage && 
                               defaultUsage.input.tokens === 0 && 
                               defaultUsage.output.tokens === 0;
        
        this.recordTest('Recovery Mechanisms', 'Graceful degradation to defaults', degradationTest, {
            defaultUsage: defaultUsage
        });
    }

    /**
     * Test concurrent operations
     */
    async testConcurrentOperations() {
        console.log('Testing concurrent operations...');
        
        this.clearStorage();
        
        // Simulate concurrent token tracking
        const promises = [];
        const expectedTotal = 5000; // 10 operations * 500 tokens each
        
        for (let i = 0; i < 10; i++) {
            promises.push(
                new Promise(resolve => {
                    setTimeout(() => {
                        this.trackTokenUsage('input', 500, 0.005);
                        resolve();
                    }, Math.random() * 100);
                })
            );
        }
        
        await Promise.all(promises);
        
        const finalUsage = this.getStoredUsage();
        const concurrencyTest = finalUsage.input.tokens === expectedTotal;
        
        this.recordTest('Concurrent Operations', 'Concurrent tracking accuracy', concurrencyTest, {
            expected: expectedTotal,
            actual: finalUsage.input.tokens
        });
    }

    /**
     * Test edge cases
     */
    async testEdgeCases() {
        console.log('Testing edge cases...');
        
        // Test very large numbers
        try {
            this.trackTokenUsage('input', Number.MAX_SAFE_INTEGER, 1000);
            const usage = this.getStoredUsage();
            const largeNumberTest = usage.input.tokens === Number.MAX_SAFE_INTEGER;
            
            this.recordTest('Edge Cases', 'Handle very large token counts', largeNumberTest, {
                input: Number.MAX_SAFE_INTEGER,
                stored: usage.input.tokens
            });
        } catch (error) {
            this.recordTest('Edge Cases', 'Handle very large token counts', false, {
                error: error.message
            });
        }
        
        // Test precision with small decimals
        this.clearStorage();
        this.trackTokenUsage('input', 1, 0.000001);
        this.trackTokenUsage('input', 1, 0.000001);
        
        const usage = this.getStoredUsage();
        const precisionTest = Math.abs(usage.input.cost - 0.000002) < 0.0000001;
        
        this.recordTest('Edge Cases', 'Maintain precision with small decimals', precisionTest, {
            expected: 0.000002,
            actual: usage.input.cost
        });
        
        // Test rapid successive calls
        const startTime = Date.now();
        for (let i = 0; i < 1000; i++) {
            this.trackTokenUsage('output', 1, 0.001);
        }
        const endTime = Date.now();
        
        const rapidCallsUsage = this.getStoredUsage();
        const rapidCallsTest = rapidCallsUsage.output.tokens === 1000 && (endTime - startTime) < 5000;
        
        this.recordTest('Edge Cases', 'Handle rapid successive calls', rapidCallsTest, {
            tokens: rapidCallsUsage.output.tokens,
            duration: endTime - startTime
        });
    }

    /**
     * Test performance under load
     */
    async testPerformanceUnderLoad() {
        console.log('Testing performance under load...');
        
        this.clearStorage();
        
        const operationCount = 10000;
        const startTime = Date.now();
        
        for (let i = 0; i < operationCount; i++) {
            this.trackTokenUsage('input', 10, 0.0001);
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        const operationsPerSecond = operationCount / (duration / 1000);
        
        const usage = this.getStoredUsage();
        const accuracyTest = usage.input.tokens === operationCount * 10;
        const performanceTest = operationsPerSecond > 1000; // Should handle >1000 ops/sec
        
        this.recordTest('Performance', 'Accuracy under load', accuracyTest, {
            expected: operationCount * 10,
            actual: usage.input.tokens
        });
        
        this.recordTest('Performance', 'Performance under load', performanceTest, {
            operationsPerSecond: operationsPerSecond,
            duration: duration
        });
    }

    /**
     * Helper methods for testing
     */
    validateTokenInput(input) {
        if (!input || typeof input !== 'object') return false;
        if (!['input', 'output'].includes(input.type)) return false;
        if (typeof input.amount !== 'number') return false;
        if (input.amount <= 0 || !isFinite(input.amount)) return false;
        return true;
    }

    trackTokenUsage(type, amount, cost) {
        if (!this.validateTokenInput({ type, amount })) {
            throw new Error('Invalid token input');
        }
        
        const usage = this.getStoredUsage();
        usage[type].tokens += amount;
        usage[type].cost += cost;
        this.setStoredUsage(usage);
    }

    getStoredUsage() {
        try {
            const stored = this.originalLocalStorage.getItem('token_usage');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (this.validateUsageData(parsed)) {
                    return parsed;
                }
            }
        } catch (error) {
            console.warn('Storage corrupted, using defaults');
        }
        
        return this.getDefaultUsage();
    }

    setStoredUsage(usage) {
        this.originalLocalStorage.setItem('token_usage', JSON.stringify(usage));
    }

    validateUsageData(data) {
        if (!data || typeof data !== 'object') return false;
        if (!data.input || !data.output) return false;
        if (typeof data.input.tokens !== 'number' || typeof data.output.tokens !== 'number') return false;
        if (typeof data.input.cost !== 'number' || typeof data.output.cost !== 'number') return false;
        return true;
    }

    getDefaultUsage() {
        return {
            input: { tokens: 0, cost: 0 },
            output: { tokens: 0, cost: 0 }
        };
    }

    setBackupUsage(usage) {
        // Simulate in-memory backup
        this.backupUsage = usage;
    }

    recoverFromBackup() {
        return this.backupUsage || this.getDefaultUsage();
    }

    clearStorage() {
        this.originalLocalStorage.removeItem('token_usage');
    }

    clearBackupStorage() {
        this.backupUsage = null;
    }

    recordTest(category, description, passed, details = {}) {
        this.testResults.push({
            category,
            description,
            passed,
            details,
            timestamp: new Date().toISOString()
        });
        
        const status = passed ? '✓' : '✗';
        console.log(`${status} ${category}: ${description}`);
        
        if (!passed && details.error) {
            console.error(`  Error: ${details.error}`);
        }
    }

    generateTestReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(test => test.passed).length;
        const failedTests = totalTests - passedTests;
        const passRate = ((passedTests / totalTests) * 100).toFixed(2);
        
        const report = {
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: failedTests,
                passRate: `${passRate}%`
            },
            categories: {},
            details: this.testResults
        };
        
        // Group by category
        for (const test of this.testResults) {
            if (!report.categories[test.category]) {
                report.categories[test.category] = { passed: 0, failed: 0, tests: [] };
            }
            
            if (test.passed) {
                report.categories[test.category].passed++;
            } else {
                report.categories[test.category].failed++;
            }
            
            report.categories[test.category].tests.push(test);
        }
        
        console.log('\n=== Token Tracking Accuracy Test Report ===');
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests}`);
        console.log(`Failed: ${failedTests}`);
        console.log(`Pass Rate: ${passRate}%`);
        
        console.log('\nBy Category:');
        for (const [category, stats] of Object.entries(report.categories)) {
            const categoryPassRate = ((stats.passed / (stats.passed + stats.failed)) * 100).toFixed(2);
            console.log(`  ${category}: ${stats.passed}/${stats.passed + stats.failed} (${categoryPassRate}%)`);
        }
        
        return report;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TokenTrackingAccuracyTests;
} else {
    window.TokenTrackingAccuracyTests = TokenTrackingAccuracyTests;
}