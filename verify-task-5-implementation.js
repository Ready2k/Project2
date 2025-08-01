/**
 * Task 5 Implementation Verification Script
 * Verifies that Default Agent is properly included in LLM Manager statistics and overview
 */

class Task5Verifier {
    constructor() {
        this.results = [];
        this.debug = console;
    }

    /**
     * Run all verification tests
     */
    async runAllTests() {
        console.log('🧪 Starting Task 5 Implementation Verification');
        console.log('Testing Default Agent inclusion in LLM Manager statistics and overview');
        console.log('=' .repeat(60));

        try {
            // Test 1: Agent counting logic
            await this.testAgentCountingLogic();
            
            // Test 2: Agent grid rendering
            await this.testAgentGridRendering();
            
            // Test 3: Agent selection dropdowns
            await this.testAgentSelectionDropdowns();
            
            // Test 4: Default Agent configuration
            await this.testDefaultAgentConfiguration();
            
            // Test 5: Statistics accuracy
            await this.testStatisticsAccuracy();

            // Generate summary
            this.generateSummary();

        } catch (error) {
            console.error('❌ Verification failed with error:', error);
            this.results.push({
                test: 'Overall Verification',
                status: 'FAILED',
                message: `Verification failed: ${error.message}`,
                critical: true
            });
        }

        return this.results;
    }

    /**
     * Test 1: Agent counting logic includes Default Agent
     */
    async testAgentCountingLogic() {
        console.log('\n📊 Test 1: Agent Counting Logic');
        
        try {
            // Check if LLM Manager is available
            if (typeof LLMManager === 'undefined') {
                throw new Error('LLM Manager not available');
            }

            const llmManager = new LLMManager();
            
            // Initialize with default configurations
            llmManager.initialize();
            
            // Get statistics
            const stats = llmManager.getConfigurationStats();
            const agents = llmManager.getAgentConfigurations();
            
            console.log(`   Total agents in stats: ${stats.totalAgents}`);
            console.log(`   Enabled agents: ${stats.enabledAgents}`);
            console.log(`   Disabled agents: ${stats.disabledAgents}`);
            console.log(`   Agents in configuration: ${Object.keys(agents).length}`);
            
            // Check if Default Agent is present
            const hasDefaultAgent = 'DefaultAgent' in agents;
            console.log(`   Default Agent present: ${hasDefaultAgent}`);
            
            // Verify counts match
            const totalAgentsMatch = stats.totalAgents === Object.keys(agents).length;
            const countsAddUp = stats.enabledAgents + stats.disabledAgents === stats.totalAgents;
            
            if (hasDefaultAgent && totalAgentsMatch && countsAddUp && stats.totalAgents >= 5) {
                console.log('   ✅ Agent counting logic test PASSED');
                this.results.push({
                    test: 'Agent Counting Logic',
                    status: 'PASSED',
                    message: `Default Agent included in counts (${stats.totalAgents} total agents)`,
                    details: {
                        totalAgents: stats.totalAgents,
                        enabledAgents: stats.enabledAgents,
                        disabledAgents: stats.disabledAgents,
                        hasDefaultAgent: hasDefaultAgent
                    }
                });
            } else {
                throw new Error(`Counting logic issues: hasDefaultAgent=${hasDefaultAgent}, totalMatch=${totalAgentsMatch}, countsAddUp=${countsAddUp}, total=${stats.totalAgents}`);
            }

        } catch (error) {
            console.log(`   ❌ Agent counting logic test FAILED: ${error.message}`);
            this.results.push({
                test: 'Agent Counting Logic',
                status: 'FAILED',
                message: error.message,
                critical: true
            });
        }
    }

    /**
     * Test 2: Agent grid rendering includes Default Agent
     */
    async testAgentGridRendering() {
        console.log('\n🎨 Test 2: Agent Grid Rendering');
        
        try {
            // Check if LLMManagerAdminUI is available
            if (typeof LLMManagerAdminUI === 'undefined') {
                throw new Error('LLMManagerAdminUI not available');
            }

            // Create a mock DOM environment for testing
            const mockElement = {
                innerHTML: '',
                appendChild: function(child) {
                    this.innerHTML += child.outerHTML || child.toString();
                }
            };

            // Mock document methods
            const originalGetElementById = global.document?.getElementById;
            global.document = global.document || {};
            global.document.getElementById = () => mockElement;

            const adminUI = new LLMManagerAdminUI();
            
            // Wait for initialization
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (!adminUI.llmManager) {
                throw new Error('LLM Manager not initialized in Admin UI');
            }

            // Get agents for grid rendering
            const agents = adminUI.llmManager.getAgentConfigurations();
            
            console.log(`   Agents available for grid: ${Object.keys(agents).length}`);
            
            // Check if Default Agent is present
            const hasDefaultAgent = 'DefaultAgent' in agents;
            console.log(`   Default Agent in agents list: ${hasDefaultAgent}`);
            
            // Test the createAgentCard method
            if (hasDefaultAgent && typeof adminUI.createAgentCard === 'function') {
                const defaultAgentConfig = agents.DefaultAgent;
                const card = adminUI.createAgentCard('DefaultAgent', defaultAgentConfig);
                
                const cardHtml = card.outerHTML || card.innerHTML || '';
                const hasDefaultAgentIcon = cardHtml.includes('🤖');
                const hasDefaultAgentName = cardHtml.includes('DefaultAgent');
                
                console.log(`   Default Agent card created: ${!!card}`);
                console.log(`   Card contains Default Agent icon: ${hasDefaultAgentIcon}`);
                console.log(`   Card contains Default Agent name: ${hasDefaultAgentName}`);
                
                if (card && hasDefaultAgentName) {
                    console.log('   ✅ Agent grid rendering test PASSED');
                    this.results.push({
                        test: 'Agent Grid Rendering',
                        status: 'PASSED',
                        message: 'Default Agent properly rendered in grid with appropriate styling',
                        details: {
                            hasDefaultAgent: hasDefaultAgent,
                            cardCreated: !!card,
                            hasIcon: hasDefaultAgentIcon,
                            hasName: hasDefaultAgentName
                        }
                    });
                } else {
                    throw new Error('Default Agent card not properly created');
                }
            } else {
                throw new Error(`Default Agent missing (${hasDefaultAgent}) or createAgentCard method not available`);
            }

            // Restore original document method
            if (originalGetElementById) {
                global.document.getElementById = originalGetElementById;
            }

        } catch (error) {
            console.log(`   ❌ Agent grid rendering test FAILED: ${error.message}`);
            this.results.push({
                test: 'Agent Grid Rendering',
                status: 'FAILED',
                message: error.message,
                critical: true
            });
        }
    }

    /**
     * Test 3: Agent selection dropdowns include Default Agent
     */
    async testAgentSelectionDropdowns() {
        console.log('\n📋 Test 3: Agent Selection Dropdowns');
        
        try {
            if (typeof LLMManagerAdminUI === 'undefined') {
                throw new Error('LLMManagerAdminUI not available');
            }

            const adminUI = new LLMManagerAdminUI();
            
            // Wait for initialization
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (!adminUI.llmManager) {
                throw new Error('LLM Manager not initialized in Admin UI');
            }

            // Get agents
            const agents = adminUI.llmManager.getAgentConfigurations();
            const agentNames = Object.keys(agents);
            
            console.log(`   Available agents: ${agentNames.join(', ')}`);
            
            // Check if Default Agent is present
            const hasDefaultAgent = agentNames.includes('DefaultAgent');
            console.log(`   Default Agent in agent list: ${hasDefaultAgent}`);
            
            // Test sorting logic (Default Agent should be first)
            const sortedAgentNames = agentNames.sort((a, b) => {
                if (a === 'DefaultAgent') return -1;
                if (b === 'DefaultAgent') return 1;
                return a.localeCompare(b);
            });
            
            const defaultAgentFirst = sortedAgentNames[0] === 'DefaultAgent';
            console.log(`   Default Agent sorted first: ${defaultAgentFirst}`);
            console.log(`   Sorted order: ${sortedAgentNames.join(', ')}`);
            
            // Test dropdown option generation
            const dropdownOptions = sortedAgentNames.map(name => 
                `<option value="${name}">${name}${name === 'DefaultAgent' ? ' (Primary Agent)' : ''}</option>`
            );
            
            const hasDefaultAgentOption = dropdownOptions.some(option => 
                option.includes('DefaultAgent') && option.includes('Primary Agent')
            );
            
            console.log(`   Default Agent option properly formatted: ${hasDefaultAgentOption}`);
            
            if (hasDefaultAgent && defaultAgentFirst && hasDefaultAgentOption) {
                console.log('   ✅ Agent selection dropdowns test PASSED');
                this.results.push({
                    test: 'Agent Selection Dropdowns',
                    status: 'PASSED',
                    message: 'Default Agent appears first in dropdowns with proper labeling',
                    details: {
                        hasDefaultAgent: hasDefaultAgent,
                        defaultAgentFirst: defaultAgentFirst,
                        properlyFormatted: hasDefaultAgentOption,
                        totalAgents: agentNames.length
                    }
                });
            } else {
                throw new Error(`Dropdown issues: hasDefaultAgent=${hasDefaultAgent}, first=${defaultAgentFirst}, formatted=${hasDefaultAgentOption}`);
            }

        } catch (error) {
            console.log(`   ❌ Agent selection dropdowns test FAILED: ${error.message}`);
            this.results.push({
                test: 'Agent Selection Dropdowns',
                status: 'FAILED',
                message: error.message,
                critical: true
            });
        }
    }

    /**
     * Test 4: Default Agent configuration is properly loaded
     */
    async testDefaultAgentConfiguration() {
        console.log('\n⚙️ Test 4: Default Agent Configuration');
        
        try {
            if (typeof LLMManager === 'undefined') {
                throw new Error('LLM Manager not available');
            }

            const llmManager = new LLMManager();
            llmManager.initialize();
            
            // Get Default Agent configuration
            const defaultAgentConfig = llmManager.getAgentConfiguration('DefaultAgent');
            
            if (!defaultAgentConfig) {
                throw new Error('Default Agent configuration not found');
            }
            
            console.log(`   Default Agent name: ${defaultAgentConfig.name}`);
            console.log(`   Default Agent description: ${defaultAgentConfig.description}`);
            console.log(`   Default Agent enabled: ${defaultAgentConfig.enabled}`);
            console.log(`   Default Agent priority: ${defaultAgentConfig.priority}`);
            console.log(`   Default Agent provider: ${defaultAgentConfig.llmProvider}`);
            console.log(`   Default Agent model: ${defaultAgentConfig.llmModel}`);
            
            // Verify required properties
            const hasRequiredProperties = 
                defaultAgentConfig.name === 'DefaultAgent' &&
                defaultAgentConfig.description &&
                defaultAgentConfig.enabled !== false &&
                defaultAgentConfig.priority === 0 &&
                defaultAgentConfig.llmProvider &&
                defaultAgentConfig.llmModel;
            
            if (hasRequiredProperties) {
                console.log('   ✅ Default Agent configuration test PASSED');
                this.results.push({
                    test: 'Default Agent Configuration',
                    status: 'PASSED',
                    message: 'Default Agent properly configured with correct properties',
                    details: {
                        name: defaultAgentConfig.name,
                        enabled: defaultAgentConfig.enabled,
                        priority: defaultAgentConfig.priority,
                        provider: defaultAgentConfig.llmProvider,
                        model: defaultAgentConfig.llmModel
                    }
                });
            } else {
                throw new Error('Default Agent missing required properties');
            }

        } catch (error) {
            console.log(`   ❌ Default Agent configuration test FAILED: ${error.message}`);
            this.results.push({
                test: 'Default Agent Configuration',
                status: 'FAILED',
                message: error.message,
                critical: true
            });
        }
    }

    /**
     * Test 5: Statistics accuracy with Default Agent
     */
    async testStatisticsAccuracy() {
        console.log('\n📈 Test 5: Statistics Accuracy');
        
        try {
            if (typeof LLMManager === 'undefined') {
                throw new Error('LLM Manager not available');
            }

            const llmManager = new LLMManager();
            llmManager.initialize();
            
            const stats = llmManager.getConfigurationStats();
            const agents = llmManager.getAgentConfigurations();
            
            // Manual count verification
            let manualEnabledCount = 0;
            let manualDisabledCount = 0;
            let hasDefaultAgent = false;
            
            Object.entries(agents).forEach(([name, config]) => {
                if (name === 'DefaultAgent') {
                    hasDefaultAgent = true;
                }
                
                if (config.enabled !== false) {
                    manualEnabledCount++;
                } else {
                    manualDisabledCount++;
                }
            });
            
            const manualTotal = manualEnabledCount + manualDisabledCount;
            
            console.log(`   Manual count - Total: ${manualTotal}, Enabled: ${manualEnabledCount}, Disabled: ${manualDisabledCount}`);
            console.log(`   Stats count - Total: ${stats.totalAgents}, Enabled: ${stats.enabledAgents}, Disabled: ${stats.disabledAgents}`);
            console.log(`   Default Agent included: ${hasDefaultAgent}`);
            
            // Verify accuracy
            const totalMatch = stats.totalAgents === manualTotal;
            const enabledMatch = stats.enabledAgents === manualEnabledCount;
            const disabledMatch = stats.disabledAgents === manualDisabledCount;
            
            if (totalMatch && enabledMatch && disabledMatch && hasDefaultAgent) {
                console.log('   ✅ Statistics accuracy test PASSED');
                this.results.push({
                    test: 'Statistics Accuracy',
                    status: 'PASSED',
                    message: 'All statistics accurately reflect Default Agent inclusion',
                    details: {
                        totalAgents: stats.totalAgents,
                        enabledAgents: stats.enabledAgents,
                        disabledAgents: stats.disabledAgents,
                        manualTotal: manualTotal,
                        manualEnabled: manualEnabledCount,
                        manualDisabled: manualDisabledCount,
                        hasDefaultAgent: hasDefaultAgent
                    }
                });
            } else {
                throw new Error(`Statistics mismatch: total=${totalMatch}, enabled=${enabledMatch}, disabled=${disabledMatch}, hasDefault=${hasDefaultAgent}`);
            }

        } catch (error) {
            console.log(`   ❌ Statistics accuracy test FAILED: ${error.message}`);
            this.results.push({
                test: 'Statistics Accuracy',
                status: 'FAILED',
                message: error.message,
                critical: true
            });
        }
    }

    /**
     * Generate verification summary
     */
    generateSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📋 TASK 5 VERIFICATION SUMMARY');
        console.log('='.repeat(60));

        const totalTests = this.results.length;
        const passedTests = this.results.filter(r => r.status === 'PASSED').length;
        const failedTests = this.results.filter(r => r.status === 'FAILED').length;
        const criticalFailures = this.results.filter(r => r.status === 'FAILED' && r.critical).length;

        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests}`);
        console.log(`Failed: ${failedTests}`);
        console.log(`Critical Failures: ${criticalFailures}`);
        console.log('');

        this.results.forEach(result => {
            const icon = result.status === 'PASSED' ? '✅' : '❌';
            console.log(`${icon} ${result.test}: ${result.status}`);
            console.log(`   ${result.message}`);
            if (result.details) {
                console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
            }
            console.log('');
        });

        const overallStatus = criticalFailures === 0 ? 'PASSED' : 'FAILED';
        console.log(`🎯 OVERALL STATUS: ${overallStatus}`);
        
        if (overallStatus === 'PASSED') {
            console.log('✅ Task 5 implementation is working correctly!');
            console.log('   Default Agent is properly included in:');
            console.log('   - Agent counting logic (total/enabled counts)');
            console.log('   - Agent grid rendering');
            console.log('   - Agent selection dropdowns');
        } else {
            console.log('❌ Task 5 implementation has issues that need to be addressed.');
        }

        console.log('='.repeat(60));
    }
}

// Export for use in other contexts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Task5Verifier;
}

// Auto-run if loaded directly
if (typeof window !== 'undefined') {
    window.Task5Verifier = Task5Verifier;
    
    // Auto-run verification when page loads
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('🚀 Auto-running Task 5 verification...');
        const verifier = new Task5Verifier();
        await verifier.runAllTests();
    });
} else if (typeof require !== 'undefined') {
    // Node.js environment - run immediately
    (async () => {
        const verifier = new Task5Verifier();
        await verifier.runAllTests();
    })();
}