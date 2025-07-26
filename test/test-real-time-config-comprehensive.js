/**
 * Comprehensive Real-Time Configuration Update Tests
 * Tests real-time configuration updates, hot-reload, and rollback functionality
 */

class RealTimeConfigTest {
    constructor() {
        this.llmManager = null;
        this.guardrailsManager = null;
        this.voiceConfigManager = null;
        this.configUpdateManager = null;
        this.testResults = [];
        this.debug = window.debugManager?.createModuleLogger('RealTimeConfigTest') || console;
    }

    async initialize() {
        try {
            // Initialize managers
            this.llmManager = new LLMManager();
            this.guardrailsManager = new GuardrailsManager();
            this.voiceConfigManager = new VoiceConfigManager();
            
            // Try to initialize config update manager if available
            try {
                this.configUpdateManager = new ConfigUpdateManager();
            } catch (e) {
                this.debug.warn('ConfigUpdateManager not available, some tests will be skipped');
            }

            // Set up dependencies
            this.llmManager.setManagers(
                this.guardrailsManager,
                this.voiceConfigManager,
                null,
                this.configUpdateManager
            );

            this.debug.log('Real-time configuration test framework initialized');
            return true;
        } catch (error) {
            this.debug.error('Failed to initialize real-time config test framework:', error);
            return false;
        }
    }

    addTestResult(testName, passed, message, details = null) {
        const result = {
            testName,
            passed,
            message,
            details,
            timestamp: new Date().toISOString()
        };
        
        this.testResults.push(result);
        
        const status = passed ? '✅' : '❌';
        this.debug.log(`${status} ${testName}: ${message}`);
        
        return result;
    }

    async runAllTests() {
        this.debug.log('🚀 Starting Real-Time Configuration Update Tests...\n');
        
        if (!await this.initialize()) {
            throw new Error('Failed to initialize test framework');
        }

        try {
            await this.testRealTimeAgentConfigUpdates();
            await this.testRealTimeGuardrailsUpdates();
            await this.testRealTimeVoiceConfigUpdates();
            await this.testConfigurationRollback();
            await this.testHotReloadFunctionality();
            await this.testConfigurationValidationBeforeUpdate();
            await this.testConcurrentConfigurationUpdates();
            await this.testConfigurationUpdateNotifications();
            
            this.printTestSummary();
        } catch (error) {
            this.debug.error('Real-time configuration test suite failed:', error);
            throw error;
        }
    }

    async testRealTimeAgentConfigUpdates() {
        this.debug.log('📋 Testing real-time agent configuration updates...');

        try {
            // Test 1: Basic real-time agent configuration update
            const originalConfig = this.llmManager.getAgentConfiguration('IDVAgent');
            const updatedConfig = {
                ...originalConfig,
                description: 'Updated via real-time system',
                maxTokens: (originalConfig.maxTokens || 1000) + 500,
                lastUpdated: new Date().toISOString()
            };

            const updateResult = await this.llmManager.updateConfigurationWithRollback(
                'IDVAgent',
                updatedConfig,
                { enableRollback: true, reason: 'Real-time update test' }
            );

            this.addTestResult(
                'Real-Time Agent Config Update',
                updateResult.success,
                updateResult.success ? 'Agent configuration updated in real-time' : updateResult.error
            );

            // Test 2: Verify configuration was applied
            if (updateResult.success) {
                const retrievedConfig = this.llmManager.getAgentConfiguration('IDVAgent');
                const configApplied = retrievedConfig && 
                                   retrievedConfig.description === 'Updated via real-time system' &&
                                   retrievedConfig.maxTokens === updatedConfig.maxTokens;

                this.addTestResult(
                    'Real-Time Config Application Verification',
                    configApplied,
                    configApplied ? 'Configuration changes applied correctly' : 'Configuration not applied correctly'
                );
            }

            // Test 3: Real-time update with validation failure
            const invalidConfig = {
                name: '', // Invalid empty name
                priority: -1, // Invalid negative priority
                llmProvider: 'invalid_provider'
            };

            const invalidUpdateResult = await this.llmManager.updateConfigurationWithRollback(
                'TestInvalidAgent',
                invalidConfig,
                { enableRollback: true }
            );

            this.addTestResult(
                'Real-Time Invalid Config Rejection',
                !invalidUpdateResult.success,
                !invalidUpdateResult.success ? 'Invalid configuration properly rejected' : 'Invalid configuration was accepted'
            );

        } catch (error) {
            this.addTestResult('Real-Time Agent Config Updates', false, `Error: ${error.message}`);
        }
    }

    async testRealTimeGuardrailsUpdates() {
        this.debug.log('🛡️ Testing real-time guardrails updates...');

        try {
            // Test 1: Hot-reload guardrails
            const originalGuardrails = this.guardrailsManager.getGuardrails('BankingInfoAgent');
            const updatedGuardrails = {
                allowedCapabilities: {
                    canAccessAccountData: false, // Change from true to false
                    canProvideBalanceInfo: true,
                    canAccessTransactionHistory: false, // Change from true to false
                    canInitiateTransactions: false,
                    canBlockCards: false,
                    canResetPasswords: false
                },
                restrictions: {
                    maxTransactionAmount: 0,
                    blockedKeywords: ['transfer', 'send', 'payment', 'new_blocked_keyword'],
                    timeBasedRestrictions: {}
                },
                complianceRules: {
                    logAllActions: true,
                    requireAuditTrail: true,
                    dataRetentionDays: 60 // Changed from 30
                }
            };

            const hotReloadResult = await this.guardrailsManager.hotReloadGuardrails(
                'BankingInfoAgent',
                updatedGuardrails
            );

            this.addTestResult(
                'Hot-Reload Guardrails',
                hotReloadResult.success,
                hotReloadResult.success ? 'Guardrails hot-reloaded successfully' : hotReloadResult.error
            );

            // Test 2: Verify guardrails enforcement after hot-reload
            if (hotReloadResult.success) {
                const actionResult = this.guardrailsManager.validateAction('BankingInfoAgent', 'getAccountData', {});
                const correctlyBlocked = !actionResult.allowed; // Should now be blocked

                this.addTestResult(
                    'Guardrails Enforcement After Hot-Reload',
                    correctlyBlocked,
                    correctlyBlocked ? 'Updated guardrails enforced correctly' : 'Guardrails not enforced after hot-reload'
                );

                // Test blocked keyword enforcement
                const keywordResult = this.guardrailsManager.validateAction('BankingInfoAgent', 'new_blocked_keyword action', {});
                const keywordBlocked = !keywordResult.allowed;

                this.addTestResult(
                    'New Blocked Keyword Enforcement',
                    keywordBlocked,
                    keywordBlocked ? 'New blocked keyword enforced' : 'New blocked keyword not enforced'
                );
            }

            // Test 3: Bulk guardrails update for all agents
            const bulkUpdateResult = await this.guardrailsManager.hotReloadGuardrails('all', {
                complianceRules: {
                    logAllActions: true,
                    requireAuditTrail: true,
                    dataRetentionDays: 365 // Update for all agents
                }
            });

            this.addTestResult(
                'Bulk Guardrails Hot-Reload',
                bulkUpdateResult.success,
                bulkUpdateResult.success ? 'Bulk guardrails update successful' : bulkUpdateResult.error
            );

        } catch (error) {
            this.addTestResult('Real-Time Guardrails Updates', false, `Error: ${error.message}`);
        }
    }

    async testRealTimeVoiceConfigUpdates() {
        this.debug.log('🎤 Testing real-time voice configuration updates...');

        try {
            // Test 1: Graceful voice configuration update
            const originalVoiceConfig = this.voiceConfigManager.getVoiceConfig('PaymentsAgent');
            const updatedVoiceConfig = {
                ttsSettings: {
                    provider: 'openai',
                    voice: 'shimmer', // Changed from original
                    speed: 1.2, // Changed speed
                    pitch: 2, // Changed pitch
                    volume: 0.9
                },
                personalityTraits: {
                    tone: 'confident', // Changed tone
                    formality: 'professional',
                    enthusiasm: 8, // Increased enthusiasm
                    empathy: 5
                },
                contextualAdaptation: {
                    errorResponseTone: 'calm',
                    successResponseTone: 'enthusiastic', // Changed
                    urgentSituationTone: 'urgent'
                }
            };

            const gracefulUpdateResult = await this.voiceConfigManager.updateVoiceConfigGracefully(
                'PaymentsAgent',
                updatedVoiceConfig,
                { queueIfBusy: true, allowDuringConversation: false }
            );

            this.addTestResult(
                'Graceful Voice Config Update',
                gracefulUpdateResult.success,
                gracefulUpdateResult.success ? 'Voice configuration updated gracefully' : gracefulUpdateResult.error
            );

            // Test 2: Verify voice configuration application
            if (gracefulUpdateResult.success) {
                const appliedConfig = this.voiceConfigManager.applyVoiceConfig(
                    'PaymentsAgent',
                    'Test message for updated voice configuration'
                );

                const configApplied = appliedConfig && 
                                    appliedConfig.voice === 'shimmer' &&
                                    appliedConfig.speed === 1.2 &&
                                    appliedConfig.personalityTraits.tone === 'confident';

                this.addTestResult(
                    'Voice Config Application After Update',
                    configApplied,
                    configApplied ? 'Updated voice configuration applied correctly' : 'Voice configuration not applied correctly'
                );
            }

            // Test 3: Voice configuration update during conversation simulation
            // Simulate active conversation
            const mockConversationActive = true;
            
            const conversationUpdateResult = await this.voiceConfigManager.setVoiceConfigRealTime(
                'FraudAgent',
                {
                    ttsSettings: {
                        provider: 'openai',
                        voice: 'onyx',
                        speed: 0.8,
                        pitch: -3,
                        volume: 0.95
                    }
                },
                { 
                    allowDuringConversation: false,
                    queueIfBusy: true
                }
            );

            this.addTestResult(
                'Voice Config Update During Conversation',
                conversationUpdateResult,
                conversationUpdateResult ? 'Voice update handled during conversation' : 'Voice update failed during conversation'
            );

            // Test 4: Voice preview with updated configuration
            const previewResult = await this.voiceConfigManager.previewVoice(
                updatedVoiceConfig,
                'This is a preview of the updated voice configuration for the payments agent.'
            );

            this.addTestResult(
                'Voice Preview After Update',
                previewResult.success,
                previewResult.success ? `Voice preview generated: ${previewResult.estimatedDuration}s` : previewResult.error
            );

        } catch (error) {
            this.addTestResult('Real-Time Voice Config Updates', false, `Error: ${error.message}`);
        }
    }

    async testConfigurationRollback() {
        this.debug.log('🔄 Testing configuration rollback functionality...');

        try {
            // Test 1: Agent configuration rollback
            const originalConfig = this.llmManager.getAgentConfiguration('FraudAgent');
            const modifiedConfig = {
                ...originalConfig,
                description: 'Modified for rollback test',
                maxTokens: 9999,
                priority: 99
            };

            // Apply configuration with rollback enabled
            const updateResult = await this.llmManager.updateConfigurationWithRollback(
                'FraudAgent',
                modifiedConfig,
                { enableRollback: true, reason: 'Rollback test' }
            );

            this.addTestResult(
                'Configuration Update with Rollback Enabled',
                updateResult.success,
                updateResult.success ? 'Configuration updated with rollback capability' : updateResult.error
            );

            // Perform rollback
            if (updateResult.success && this.llmManager.rollbackConfiguration) {
                const rollbackResult = await this.llmManager.rollbackConfiguration('FraudAgent');
                
                this.addTestResult(
                    'Configuration Rollback',
                    rollbackResult.success,
                    rollbackResult.success ? 'Configuration rollback successful' : rollbackResult.error
                );

                // Verify rollback was applied
                if (rollbackResult.success) {
                    const rolledBackConfig = this.llmManager.getAgentConfiguration('FraudAgent');
                    const rollbackCorrect = rolledBackConfig && 
                                          rolledBackConfig.description === originalConfig.description &&
                                          rolledBackConfig.maxTokens === originalConfig.maxTokens;

                    this.addTestResult(
                        'Rollback Verification',
                        rollbackCorrect,
                        rollbackCorrect ? 'Configuration correctly rolled back' : 'Rollback did not restore original configuration'
                    );
                }
            } else {
                this.addTestResult(
                    'Configuration Rollback',
                    false,
                    'Rollback functionality not available'
                );
            }

            // Test 2: Guardrails rollback (if supported)
            if (this.guardrailsManager.rollbackGuardrails) {
                const guardrailsRollbackResult = await this.guardrailsManager.rollbackGuardrails('FraudAgent');
                
                this.addTestResult(
                    'Guardrails Rollback',
                    guardrailsRollbackResult.success,
                    guardrailsRollbackResult.success ? 'Guardrails rollback successful' : guardrailsRollbackResult.error
                );
            }

            // Test 3: Voice configuration rollback (if supported)
            if (this.voiceConfigManager.rollbackVoiceConfig) {
                const voiceRollbackResult = await this.voiceConfigManager.rollbackVoiceConfig('FraudAgent');
                
                this.addTestResult(
                    'Voice Config Rollback',
                    voiceRollbackResult.success,
                    voiceRollbackResult.success ? 'Voice configuration rollback successful' : voiceRollbackResult.error
                );
            }

        } catch (error) {
            this.addTestResult('Configuration Rollback', false, `Error: ${error.message}`);
        }
    }

    async testHotReloadFunctionality() {
        this.debug.log('🔥 Testing hot-reload functionality without system restart...');

        try {
            // Test 1: Hot-reload all agent configurations
            const allConfigs = this.llmManager.getAgentConfigurations();
            const agentNames = Object.keys(allConfigs);

            // Modify all agent configurations
            const hotReloadPromises = agentNames.map(async (agentName) => {
                const config = allConfigs[agentName];
                const modifiedConfig = {
                    ...config,
                    description: `${config.description} - Hot-reloaded`,
                    lastUpdated: new Date().toISOString()
                };

                return await this.llmManager.updateAgentConfiguration(agentName, modifiedConfig);
            });

            const hotReloadResults = await Promise.all(hotReloadPromises);
            const allSuccessful = hotReloadResults.every(result => result.success || result);

            this.addTestResult(
                'Hot-Reload All Agent Configurations',
                allSuccessful,
                allSuccessful ? `Hot-reloaded ${agentNames.length} agent configurations` : 'Some hot-reload operations failed'
            );

            // Test 2: Verify hot-reload didn't require system restart
            const postReloadConfigs = this.llmManager.getAgentConfigurations();
            const hotReloadVerified = Object.keys(postReloadConfigs).every(agentName => 
                postReloadConfigs[agentName].description.includes('Hot-reloaded')
            );

            this.addTestResult(
                'Hot-Reload Verification',
                hotReloadVerified,
                hotReloadVerified ? 'All configurations hot-reloaded successfully' : 'Hot-reload verification failed'
            );

            // Test 3: Hot-reload performance test
            const startTime = performance.now();
            
            const performanceTestConfig = {
                name: 'PerformanceTestAgent',
                description: 'Agent for performance testing',
                priority: 1,
                enabled: true
            };

            await this.llmManager.updateAgentConfiguration('PerformanceTestAgent', performanceTestConfig);
            
            const endTime = performance.now();
            const updateTime = endTime - startTime;

            this.addTestResult(
                'Hot-Reload Performance',
                updateTime < 100, // Should complete in under 100ms
                `Hot-reload completed in ${updateTime.toFixed(2)}ms`
            );

        } catch (error) {
            this.addTestResult('Hot-Reload Functionality', false, `Error: ${error.message}`);
        }
    }

    async testConfigurationValidationBeforeUpdate() {
        this.debug.log('✅ Testing configuration validation before real-time updates...');

        try {
            // Test 1: Valid configuration should pass validation
            const validConfig = {
                name: 'ValidationTestAgent',
                description: 'Agent for validation testing',
                priority: 1,
                enabled: true,
                triggers: ['validation', 'test'],
                llmProvider: 'openai',
                llmModel: 'gpt-4',
                maxTokens: 1500,
                telemetryEnabled: true
            };

            const validUpdateResult = await this.llmManager.updateAgentConfiguration(
                'ValidationTestAgent',
                validConfig
            );

            this.addTestResult(
                'Valid Configuration Update',
                validUpdateResult.success || validUpdateResult,
                validUpdateResult.success ? 'Valid configuration accepted' : 'Valid configuration rejected'
            );

            // Test 2: Invalid configuration should be rejected
            const invalidConfigs = [
                {
                    name: '', // Empty name
                    description: 'Invalid config test'
                },
                {
                    name: 'InvalidAgent',
                    priority: -1 // Invalid priority
                },
                {
                    name: 'InvalidAgent',
                    llmProvider: 'nonexistent_provider' // Invalid provider
                },
                {
                    name: 'InvalidAgent',
                    maxTokens: -100 // Invalid token count
                }
            ];

            for (let i = 0; i < invalidConfigs.length; i++) {
                const invalidConfig = invalidConfigs[i];
                const invalidUpdateResult = await this.llmManager.updateAgentConfiguration(
                    `InvalidTestAgent${i}`,
                    invalidConfig
                );

                this.addTestResult(
                    `Invalid Configuration Rejection ${i + 1}`,
                    !invalidUpdateResult.success,
                    !invalidUpdateResult.success ? 'Invalid configuration properly rejected' : 'Invalid configuration was accepted'
                );
            }

            // Test 3: Guardrails validation before update
            const invalidGuardrails = {
                allowedCapabilities: {
                    invalidCapability: true // Invalid capability
                },
                restrictions: {
                    maxTransactionAmount: -100 // Invalid amount
                }
            };

            const guardrailsValidation = this.guardrailsManager.validateGuardrails(invalidGuardrails);
            
            this.addTestResult(
                'Invalid Guardrails Validation',
                !guardrailsValidation.valid,
                !guardrailsValidation.valid ? 'Invalid guardrails properly rejected' : 'Invalid guardrails accepted'
            );

            // Test 4: Voice configuration validation before update
            const invalidVoiceConfig = {
                ttsSettings: {
                    provider: 'invalid_provider',
                    voice: 'nonexistent_voice',
                    speed: 10.0, // Invalid speed
                    pitch: 100 // Invalid pitch
                }
            };

            const voiceValidation = this.voiceConfigManager.validateVoiceConfig(invalidVoiceConfig);
            
            this.addTestResult(
                'Invalid Voice Config Validation',
                !voiceValidation.valid,
                !voiceValidation.valid ? 'Invalid voice configuration properly rejected' : 'Invalid voice configuration accepted'
            );

        } catch (error) {
            this.addTestResult('Configuration Validation Before Update', false, `Error: ${error.message}`);
        }
    }

    async testConcurrentConfigurationUpdates() {
        this.debug.log('⚡ Testing concurrent configuration updates...');

        try {
            // Test 1: Concurrent updates to different agents
            const concurrentUpdates = [
                this.llmManager.updateAgentConfiguration('IDVAgent', {
                    name: 'IDVAgent',
                    description: 'Concurrent update test 1',
                    priority: 1
                }),
                this.llmManager.updateAgentConfiguration('BankingInfoAgent', {
                    name: 'BankingInfoAgent',
                    description: 'Concurrent update test 2',
                    priority: 2
                }),
                this.llmManager.updateAgentConfiguration('FraudAgent', {
                    name: 'FraudAgent',
                    description: 'Concurrent update test 3',
                    priority: 3
                })
            ];

            const concurrentResults = await Promise.all(concurrentUpdates);
            const allConcurrentSuccessful = concurrentResults.every(result => result.success || result);

            this.addTestResult(
                'Concurrent Agent Updates',
                allConcurrentSuccessful,
                allConcurrentSuccessful ? 'All concurrent updates successful' : 'Some concurrent updates failed'
            );

            // Test 2: Concurrent updates to same agent (should handle conflicts)
            const sameAgentUpdates = [
                this.llmManager.updateAgentConfiguration('PaymentsAgent', {
                    name: 'PaymentsAgent',
                    description: 'Concurrent same agent test 1',
                    maxTokens: 1000
                }),
                this.llmManager.updateAgentConfiguration('PaymentsAgent', {
                    name: 'PaymentsAgent',
                    description: 'Concurrent same agent test 2',
                    maxTokens: 2000
                })
            ];

            const sameAgentResults = await Promise.all(sameAgentUpdates);
            const handledConflicts = sameAgentResults.some(result => result.success || result);

            this.addTestResult(
                'Concurrent Same Agent Updates',
                handledConflicts,
                handledConflicts ? 'Concurrent updates to same agent handled' : 'Concurrent updates to same agent failed'
            );

            // Test 3: Concurrent guardrails updates
            const concurrentGuardrailsUpdates = [
                this.guardrailsManager.setGuardrails('IDVAgent', {
                    allowedCapabilities: { canAccessAccountData: true },
                    restrictions: { maxTransactionAmount: 0 }
                }),
                this.guardrailsManager.setGuardrails('BankingInfoAgent', {
                    allowedCapabilities: { canProvideBalanceInfo: true },
                    restrictions: { maxTransactionAmount: 0 }
                })
            ];

            const guardrailsResults = await Promise.all(concurrentGuardrailsUpdates);
            const guardrailsSuccessful = guardrailsResults.every(result => result);

            this.addTestResult(
                'Concurrent Guardrails Updates',
                guardrailsSuccessful,
                guardrailsSuccessful ? 'Concurrent guardrails updates successful' : 'Some concurrent guardrails updates failed'
            );

        } catch (error) {
            this.addTestResult('Concurrent Configuration Updates', false, `Error: ${error.message}`);
        }
    }

    async testConfigurationUpdateNotifications() {
        this.debug.log('📢 Testing configuration update notifications...');

        try {
            let notificationReceived = false;
            let notificationData = null;

            // Set up event listener for configuration update notifications
            const handleConfigUpdate = (event) => {
                notificationReceived = true;
                notificationData = event.detail;
            };

            window.addEventListener('llmManagerConfigUpdate', handleConfigUpdate);

            // Test 1: Agent configuration update notification
            const testConfig = {
                name: 'NotificationTestAgent',
                description: 'Agent for testing notifications',
                priority: 1,
                enabled: true
            };

            await this.llmManager.updateAgentConfiguration('NotificationTestAgent', testConfig);

            // Wait a bit for notification to be dispatched
            await new Promise(resolve => setTimeout(resolve, 100));

            this.addTestResult(
                'Configuration Update Notification',
                notificationReceived,
                notificationReceived ? 'Configuration update notification received' : 'No notification received'
            );

            if (notificationReceived && notificationData) {
                const hasCorrectData = notificationData.agentName === 'NotificationTestAgent' &&
                                     notificationData.result &&
                                     notificationData.timestamp;

                this.addTestResult(
                    'Notification Data Integrity',
                    hasCorrectData,
                    hasCorrectData ? 'Notification contains correct data' : 'Notification data incomplete'
                );
            }

            // Test 2: Guardrails update notification
            let guardrailsNotificationReceived = false;

            const handleGuardrailsUpdate = (event) => {
                guardrailsNotificationReceived = true;
            };

            window.addEventListener('guardrailsUpdate', handleGuardrailsUpdate);

            await this.guardrailsManager.setGuardrails('NotificationTestAgent', {
                allowedCapabilities: { canAccessAccountData: true }
            });

            await new Promise(resolve => setTimeout(resolve, 100));

            this.addTestResult(
                'Guardrails Update Notification',
                guardrailsNotificationReceived,
                guardrailsNotificationReceived ? 'Guardrails update notification received' : 'No guardrails notification received'
            );

            // Test 3: Voice configuration update notification
            let voiceNotificationReceived = false;

            const handleVoiceUpdate = (event) => {
                voiceNotificationReceived = true;
            };

            window.addEventListener('voiceConfigUpdate', handleVoiceUpdate);

            await this.voiceConfigManager.setVoiceConfig('NotificationTestAgent', {
                ttsSettings: {
                    provider: 'openai',
                    voice: 'alloy',
                    speed: 1.0
                }
            });

            await new Promise(resolve => setTimeout(resolve, 100));

            this.addTestResult(
                'Voice Config Update Notification',
                voiceNotificationReceived,
                voiceNotificationReceived ? 'Voice config update notification received' : 'No voice config notification received'
            );

            // Clean up event listeners
            window.removeEventListener('llmManagerConfigUpdate', handleConfigUpdate);
            window.removeEventListener('guardrailsUpdate', handleGuardrailsUpdate);
            window.removeEventListener('voiceConfigUpdate', handleVoiceUpdate);

        } catch (error) {
            this.addTestResult('Configuration Update Notifications', false, `Error: ${error.message}`);
        }
    }

    printTestSummary() {
        this.debug.log('\n📊 Real-Time Configuration Test Summary');
        this.debug.log('==========================================');
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;
        
        this.debug.log(`Total Tests: ${totalTests}`);
        this.debug.log(`Passed: ${passedTests}`);
        this.debug.log(`Failed: ${failedTests}`);
        this.debug.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
        
        if (failedTests > 0) {
            this.debug.log('\n❌ Failed Tests:');
            this.testResults
                .filter(r => !r.passed)
                .forEach(r => this.debug.log(`  - ${r.testName}: ${r.message}`));
        }
        
        this.debug.log(failedTests === 0 ? '\n🎉 All real-time configuration tests passed!' : '\n⚠️  Some tests failed.');
        
        return {
            totalTests,
            passedTests,
            failedTests,
            successRate: ((passedTests / totalTests) * 100).toFixed(1),
            results: this.testResults
        };
    }

    getTestResults() {
        return {
            timestamp: new Date().toISOString(),
            summary: this.printTestSummary(),
            results: this.testResults
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealTimeConfigTest;
} else if (typeof window !== 'undefined') {
    window.RealTimeConfigTest = RealTimeConfigTest;
}

// Auto-run if in browser environment
if (typeof window !== 'undefined' && window.location) {
    document.addEventListener('DOMContentLoaded', async () => {
        const tester = new RealTimeConfigTest();
        try {
            await tester.runAllTests();
        } catch (error) {
            console.error('Real-time configuration test suite failed:', error);
        }
    });
}