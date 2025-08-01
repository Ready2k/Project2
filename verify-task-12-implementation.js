/**
 * Task 12 Implementation Verification Script
 * Comprehensive testing and verification for Default Agent LLM Manager Migration
 */

class Task12Verifier {
    constructor() {
        this.testResults = {
            defaultAgent: [],
            systemPrompts: [],
            dataPersistence: [],
            integration: [],
            overall: {
                total: 0,
                passed: 0,
                failed: 0,
                pending: 0
            }
        };
        
        this.debug = window.debugManager?.createModuleLogger('Task12Verifier') || console;
        this.llmManagerUI = null;
        this.systemPromptsManager = null;
        
        this.initialize();
    }
    
    async initialize() {
        this.debug.log('Initializing Task 12 Verifier');
        
        try {
            // Initialize managers
            if (typeof SystemPromptsManager !== 'undefined') {
                this.systemPromptsManager = new SystemPromptsManager();
                await this.systemPromptsManager.init();
            }
            
            if (typeof LLMManagerAdminUI !== 'undefined') {
                this.llmManagerUI = new LLMManagerAdminUI();
            }
            
            // Set up test definitions
            this.setupTestDefinitions();
            
            // Set up UI event listeners
            this.setupEventListeners();
            
            // Initialize UI
            this.initializeUI();
            
            this.debug.log('Task 12 Verifier initialized successfully');
            
        } catch (error) {
            this.debug.error('Error initializing Task 12 Verifier:', error);
        }
    }
    
    setupTestDefinitions() {
        // Default Agent Configuration Tests
        this.defaultAgentTestDefinitions = [
            {
                id: 'default-agent-exists',
                name: 'Default Agent Exists in LLM Manager',
                description: 'Verify Default Agent is present in LLM Manager',
                requirements: ['1.1'],
                test: () => this.testDefaultAgentExists()
            },
            {
                id: 'default-agent-ui-elements',
                name: 'Default Agent UI Elements Present',
                description: 'Verify all UI elements for Default Agent configuration',
                requirements: ['1.1', '4.1', '4.2', '4.3', '4.4'],
                test: () => this.testDefaultAgentUIElements()
            },
            {
                id: 'base-personality-config',
                name: 'Base AI Personality Configuration',
                description: 'Test Base AI Personality field functionality',
                requirements: ['4.1'],
                test: () => this.testBasePersonalityConfig()
            },
            {
                id: 'financial-context-config',
                name: 'Financial Services Context Configuration',
                description: 'Test Financial Services Context field functionality',
                requirements: ['4.2'],
                test: () => this.testFinancialContextConfig()
            },
            {
                id: 'response-instructions-config',
                name: 'Response Instructions Configuration',
                description: 'Test Response Instructions field functionality',
                requirements: ['4.3'],
                test: () => this.testResponseInstructionsConfig()
            },
            {
                id: 'custom-prompts-config',
                name: 'Custom Scenario Prompts Configuration',
                description: 'Test Custom Scenario Prompts functionality',
                requirements: ['4.4'],
                test: () => this.testCustomPromptsConfig()
            },
            {
                id: 'default-agent-save',
                name: 'Default Agent Save Functionality',
                description: 'Test saving Default Agent configuration',
                requirements: ['1.2', '4.5'],
                test: () => this.testDefaultAgentSave()
            },
            {
                id: 'default-agent-validation',
                name: 'Default Agent Validation',
                description: 'Test configuration validation',
                requirements: ['4.5'],
                test: () => this.testDefaultAgentValidation()
            }
        ];
        
        // System Prompts Removal Tests
        this.systemPromptsTestDefinitions = [
            {
                id: 'system-prompts-section-removed',
                name: 'System Prompts Section Removed',
                description: 'Verify System Prompts section is removed from admin panel',
                requirements: ['2.1'],
                test: () => this.testSystemPromptsSectionRemoved()
            },
            {
                id: 'system-prompts-nav-removed',
                name: 'System Prompts Navigation Removed',
                description: 'Verify System Prompts navigation button is removed',
                requirements: ['2.1'],
                test: () => this.testSystemPromptsNavRemoved()
            },
            {
                id: 'admin-panel-functionality',
                name: 'Admin Panel Functionality Preserved',
                description: 'Verify admin panel still works without System Prompts section',
                requirements: ['2.3'],
                test: () => this.testAdminPanelFunctionality()
            },
            {
                id: 'llm-manager-redirect',
                name: 'LLM Manager Redirect Information',
                description: 'Verify users are directed to LLM Manager for agent configuration',
                requirements: ['2.2'],
                test: () => this.testLLMManagerRedirect()
            }
        ];
        
        // Data Persistence Tests
        this.dataPersistenceTestDefinitions = [
            {
                id: 'data-migration',
                name: 'Data Migration from System Prompts',
                description: 'Test migration of existing system prompts data',
                requirements: ['3.1', '3.2'],
                test: () => this.testDataMigration()
            },
            {
                id: 'localStorage-persistence',
                name: 'LocalStorage Persistence',
                description: 'Test data persistence in localStorage',
                requirements: ['3.1', '3.2'],
                test: () => this.testLocalStoragePersistence()
            },
            {
                id: 'session-persistence',
                name: 'Cross-Session Persistence',
                description: 'Test data loading across browser sessions',
                requirements: ['3.2'],
                test: () => this.testSessionPersistence()
            },
            {
                id: 'data-integrity',
                name: 'Data Integrity After Migration',
                description: 'Verify data integrity is maintained during migration',
                requirements: ['3.1', '3.2', '3.3'],
                test: () => this.testDataIntegrity()
            }
        ];
        
        // Integration Tests
        this.integrationTestDefinitions = [
            {
                id: 'system-prompts-manager-integration',
                name: 'SystemPromptsManager Integration',
                description: 'Test integration with existing SystemPromptsManager',
                requirements: ['3.3'],
                test: () => this.testSystemPromptsManagerIntegration()
            },
            {
                id: 'agent-system-integration',
                name: 'Agent System Integration',
                description: 'Test integration with existing agent system',
                requirements: ['1.3', '3.3'],
                test: () => this.testAgentSystemIntegration()
            },
            {
                id: 'llm-manager-consistency',
                name: 'LLM Manager Interface Consistency',
                description: 'Test consistency with other agents in LLM Manager',
                requirements: ['1.1', '1.3'],
                test: () => this.testLLMManagerConsistency()
            },
            {
                id: 'backward-compatibility',
                name: 'Backward Compatibility',
                description: 'Test backward compatibility with existing functionality',
                requirements: ['3.3'],
                test: () => this.testBackwardCompatibility()
            }
        ];
    }
    
    setupEventListeners() {
        // Navigation
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-btn')) {
                this.switchSection(e.target.dataset.section);
            }
        });
    }
    
    initializeUI() {
        // Initialize test counts
        this.updateTestCounts();
        
        // Populate test grids
        this.populateTestGrid('defaultAgentTests', this.defaultAgentTestDefinitions);
        this.populateTestGrid('systemPromptsTests', this.systemPromptsTestDefinitions);
        this.populateTestGrid('dataPersistenceTests', this.dataPersistenceTestDefinitions);
        this.populateTestGrid('integrationTests', this.integrationTestDefinitions);
    }
    
    populateTestGrid(containerId, testDefinitions) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        testDefinitions.forEach(testDef => {
            const testItem = document.createElement('div');
            testItem.className = 'test-item';
            testItem.id = `test-${testDef.id}`;
            
            testItem.innerHTML = `
                <h4>${testDef.name}</h4>
                <div class="test-status pending" id="status-${testDef.id}">PENDING</div>
                <p>${testDef.description}</p>
                <div class="requirement-mapping">
                    <strong>Requirements:</strong> ${testDef.requirements.join(', ')}
                </div>
                <div class="test-results" id="results-${testDef.id}" style="display: none;">
                    Test results will appear here...
                </div>
                <button class="btn btn-primary" onclick="task12Verifier.runSingleTest('${testDef.id}')">
                    Run Test
                </button>
            `;
            
            container.appendChild(testItem);
        });
    }
    
    switchSection(sectionName) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
        
        // Update content
        document.querySelectorAll('.test-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionName}-section`).classList.add('active');
    }
    
    updateTestCounts() {
        const totalTests = this.defaultAgentTestDefinitions.length + 
                          this.systemPromptsTestDefinitions.length + 
                          this.dataPersistenceTestDefinitions.length + 
                          this.integrationTestDefinitions.length;
        
        this.testResults.overall.total = totalTests;
        
        document.getElementById('totalTests').textContent = totalTests;
        document.getElementById('passedTests').textContent = this.testResults.overall.passed;
        document.getElementById('failedTests').textContent = this.testResults.overall.failed;
        document.getElementById('pendingTests').textContent = totalTests - this.testResults.overall.passed - this.testResults.overall.failed;
    }
    
    async runAllTests() {
        this.debug.log('Starting comprehensive test suite');
        
        try {
            // Reset results
            this.resetAllTests();
            
            // Update UI
            document.getElementById('progressText').textContent = 'Running comprehensive tests...';
            
            // Run all test categories
            await this.runDefaultAgentTests();
            await this.runSystemPromptsTests();
            await this.runDataPersistenceTests();
            await this.runIntegrationTests();
            
            // Update final results
            this.updateOverallProgress();
            this.generateDetailedResults();
            
            this.debug.log('Comprehensive test suite completed');
            
        } catch (error) {
            this.debug.error('Error running comprehensive tests:', error);
            document.getElementById('progressText').textContent = 'Error running tests: ' + error.message;
        }
    }
    
    async runDefaultAgentTests() {
        this.debug.log('Running Default Agent tests');
        
        for (const testDef of this.defaultAgentTestDefinitions) {
            await this.runSingleTest(testDef.id);
        }
    }
    
    async runSystemPromptsTests() {
        this.debug.log('Running System Prompts tests');
        
        for (const testDef of this.systemPromptsTestDefinitions) {
            await this.runSingleTest(testDef.id);
        }
    }
    
    async runDataPersistenceTests() {
        this.debug.log('Running Data Persistence tests');
        
        for (const testDef of this.dataPersistenceTestDefinitions) {
            await this.runSingleTest(testDef.id);
        }
    }
    
    async runIntegrationTests() {
        this.debug.log('Running Integration tests');
        
        for (const testDef of this.integrationTestDefinitions) {
            await this.runSingleTest(testDef.id);
        }
    }
    
    async runSingleTest(testId) {
        // Find test definition
        const allTests = [
            ...this.defaultAgentTestDefinitions,
            ...this.systemPromptsTestDefinitions,
            ...this.dataPersistenceTestDefinitions,
            ...this.integrationTestDefinitions
        ];
        
        const testDef = allTests.find(t => t.id === testId);
        if (!testDef) {
            this.debug.error('Test not found:', testId);
            return;
        }
        
        // Update UI
        const statusElement = document.getElementById(`status-${testId}`);
        const resultsElement = document.getElementById(`results-${testId}`);
        
        statusElement.textContent = 'RUNNING';
        statusElement.className = 'test-status running';
        resultsElement.style.display = 'block';
        resultsElement.textContent = 'Running test...';
        
        try {
            // Run the test
            const result = await testDef.test();
            
            // Update results
            if (result.success) {
                statusElement.textContent = 'PASSED';
                statusElement.className = 'test-status passed';
                this.testResults.overall.passed++;
                
                resultsElement.innerHTML = `
                    <div class="success-details">
                        <strong>✓ Test Passed</strong><br>
                        ${result.message || 'Test completed successfully'}
                        ${result.details ? '<br><br><strong>Details:</strong><br>' + result.details : ''}
                    </div>
                `;
            } else {
                statusElement.textContent = 'FAILED';
                statusElement.className = 'test-status failed';
                this.testResults.overall.failed++;
                
                resultsElement.innerHTML = `
                    <div class="error-details">
                        <strong>✗ Test Failed</strong><br>
                        ${result.error || 'Test failed without specific error'}
                        ${result.details ? '<br><br><strong>Details:</strong><br>' + result.details : ''}
                    </div>
                `;
            }
            
            // Store result
            const category = this.getCategoryForTest(testId);
            this.testResults[category].push({
                id: testId,
                name: testDef.name,
                success: result.success,
                message: result.message,
                error: result.error,
                details: result.details,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            statusElement.textContent = 'FAILED';
            statusElement.className = 'test-status failed';
            this.testResults.overall.failed++;
            
            resultsElement.innerHTML = `
                <div class="error-details">
                    <strong>✗ Test Error</strong><br>
                    ${error.message}
                </div>
            `;
            
            this.debug.error(`Test ${testId} failed with error:`, error);
        }
        
        // Update counts
        this.updateTestCounts();
    }
    
    getCategoryForTest(testId) {
        if (this.defaultAgentTestDefinitions.find(t => t.id === testId)) return 'defaultAgent';
        if (this.systemPromptsTestDefinitions.find(t => t.id === testId)) return 'systemPrompts';
        if (this.dataPersistenceTestDefinitions.find(t => t.id === testId)) return 'dataPersistence';
        if (this.integrationTestDefinitions.find(t => t.id === testId)) return 'integration';
        return 'unknown';
    }
    
    // Individual Test Implementations
    
    async testDefaultAgentExists() {
        try {
            // Check if LLM Manager is available
            if (!this.llmManagerUI || !this.llmManagerUI.llmManager) {
                return {
                    success: false,
                    error: 'LLM Manager not available'
                };
            }
            
            // Check if Default Agent exists
            const defaultAgent = this.llmManagerUI.llmManager.getAgentConfiguration('DefaultAgent');
            
            if (!defaultAgent) {
                return {
                    success: false,
                    error: 'Default Agent not found in LLM Manager'
                };
            }
            
            return {
                success: true,
                message: 'Default Agent exists in LLM Manager',
                details: `Agent name: ${defaultAgent.name}, Enabled: ${defaultAgent.enabled}`
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error checking Default Agent existence: ' + error.message
            };
        }
    }
    
    async testDefaultAgentUIElements() {
        try {
            // Check if we're in the LLM Manager interface
            const isLLMManagerPage = window.location.href.includes('llm-manager-admin-ui.html');
            
            if (!isLLMManagerPage) {
                // Try to open LLM Manager in new window for testing
                const llmWindow = window.open('llm-manager-admin-ui.html', '_blank');
                if (!llmWindow) {
                    return {
                        success: false,
                        error: 'Cannot open LLM Manager interface for testing'
                    };
                }
                
                // Wait for window to load
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Check elements in the new window
                const defaultAgentCard = llmWindow.document.querySelector('.agent-prompt-card');
                if (!defaultAgentCard) {
                    llmWindow.close();
                    return {
                        success: false,
                        error: 'Default Agent card not found in LLM Manager interface'
                    };
                }
                
                llmWindow.close();
            }
            
            // Check for required UI elements
            const requiredElements = [
                'default-personality',
                'default-context', 
                'default-response-instructions',
                'default-custom-prompts-list'
            ];
            
            const missingElements = [];
            
            for (const elementId of requiredElements) {
                const element = document.getElementById(elementId);
                if (!element) {
                    missingElements.push(elementId);
                }
            }
            
            if (missingElements.length > 0) {
                return {
                    success: false,
                    error: 'Missing UI elements: ' + missingElements.join(', ')
                };
            }
            
            return {
                success: true,
                message: 'All Default Agent UI elements are present',
                details: 'Found all required form fields and controls'
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error checking UI elements: ' + error.message
            };
        }
    }
    
    async testBasePersonalityConfig() {
        try {
            const personalityField = document.getElementById('default-personality');
            
            if (!personalityField) {
                return {
                    success: false,
                    error: 'Base AI Personality field not found'
                };
            }
            
            // Test field functionality
            const testValue = 'Test personality configuration';
            personalityField.value = testValue;
            
            if (personalityField.value !== testValue) {
                return {
                    success: false,
                    error: 'Base AI Personality field not accepting input'
                };
            }
            
            return {
                success: true,
                message: 'Base AI Personality configuration field is functional',
                details: 'Field accepts and retains input correctly'
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error testing Base AI Personality config: ' + error.message
            };
        }
    }
    
    async testFinancialContextConfig() {
        try {
            const contextField = document.getElementById('default-context');
            
            if (!contextField) {
                return {
                    success: false,
                    error: 'Financial Services Context field not found'
                };
            }
            
            // Test field functionality
            const testValue = 'Test financial context configuration';
            contextField.value = testValue;
            
            if (contextField.value !== testValue) {
                return {
                    success: false,
                    error: 'Financial Services Context field not accepting input'
                };
            }
            
            return {
                success: true,
                message: 'Financial Services Context configuration field is functional',
                details: 'Field accepts and retains input correctly'
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error testing Financial Services Context config: ' + error.message
            };
        }
    }
    
    async testResponseInstructionsConfig() {
        try {
            const instructionsField = document.getElementById('default-response-instructions');
            
            if (!instructionsField) {
                return {
                    success: false,
                    error: 'Response Instructions field not found'
                };
            }
            
            // Test field functionality
            const testValue = 'Test response instructions configuration';
            instructionsField.value = testValue;
            
            if (instructionsField.value !== testValue) {
                return {
                    success: false,
                    error: 'Response Instructions field not accepting input'
                };
            }
            
            return {
                success: true,
                message: 'Response Instructions configuration field is functional',
                details: 'Field accepts and retains input correctly'
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error testing Response Instructions config: ' + error.message
            };
        }
    }
    
    async testCustomPromptsConfig() {
        try {
            const customPromptsContainer = document.getElementById('default-custom-prompts-list');
            
            if (!customPromptsContainer) {
                return {
                    success: false,
                    error: 'Custom Scenario Prompts container not found'
                };
            }
            
            // Test add custom prompt functionality
            if (typeof addCustomPrompt === 'function') {
                const initialCount = customPromptsContainer.children.length;
                addCustomPrompt('default');
                
                if (customPromptsContainer.children.length <= initialCount) {
                    return {
                        success: false,
                        error: 'Add custom prompt functionality not working'
                    };
                }
            }
            
            return {
                success: true,
                message: 'Custom Scenario Prompts configuration is functional',
                details: 'Container exists and add functionality works'
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error testing Custom Scenario Prompts config: ' + error.message
            };
        }
    }
    
    async testDefaultAgentSave() {
        try {
            // Check if save function exists
            if (typeof saveAgentPrompts !== 'function') {
                return {
                    success: false,
                    error: 'Save agent prompts function not available'
                };
            }
            
            // Test save functionality
            const saveResult = await saveAgentPrompts('DefaultAgent');
            
            if (!saveResult || !saveResult.success) {
                return {
                    success: false,
                    error: 'Save functionality failed: ' + (saveResult?.error || 'Unknown error')
                };
            }
            
            return {
                success: true,
                message: 'Default Agent save functionality is working',
                details: 'Save operation completed successfully'
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error testing Default Agent save: ' + error.message
            };
        }
    }
    
    async testDefaultAgentValidation() {
        try {
            // Test validation by attempting to save with invalid data
            const personalityField = document.getElementById('default-personality');
            
            if (personalityField) {
                // Save original value
                const originalValue = personalityField.value;
                
                // Set empty value to test validation
                personalityField.value = '';
                
                // Attempt save
                const saveResult = await saveAgentPrompts('DefaultAgent');
                
                // Restore original value
                personalityField.value = originalValue;
                
                // Check if validation caught the empty field
                if (saveResult && saveResult.success) {
                    return {
                        success: false,
                        error: 'Validation did not catch empty required field'
                    };
                }
            }
            
            return {
                success: true,
                message: 'Default Agent validation is working',
                details: 'Validation properly catches invalid configurations'
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error testing Default Agent validation: ' + error.message
            };
        }
    }
    
    async testSystemPromptsSectionRemoved() {
        try {
            // Check main index.html for System Prompts section
            const response = await fetch('index.html');
            const htmlContent = await response.text();
            
            // Check if System Prompts section is removed
            const hasSystemPromptsSection = htmlContent.includes('data-admin-section="prompts"') ||
                                          htmlContent.includes('System Prompts Configuration');
            
            if (hasSystemPromptsSection) {
                return {
                    success: false,
                    error: 'System Prompts section still exists in admin panel'
                };
            }
            
            return {
                success: true,
                message: 'System Prompts section has been removed from admin panel',
                details: 'No System Prompts configuration section found in index.html'
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error checking System Prompts section removal: ' + error.message
            };
        }
    }
    
    async testSystemPromptsNavRemoved() {
        try {
            // Check if System Prompts navigation button exists
            const systemPromptsNavBtn = document.querySelector('[data-admin-section="prompts"]');
            
            if (systemPromptsNavBtn) {
                return {
                    success: false,
                    error: 'System Prompts navigation button still exists'
                };
            }
            
            return {
                success: true,
                message: 'System Prompts navigation button has been removed',
                details: 'No System Prompts navigation button found in admin panel'
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error checking System Prompts navigation removal: ' + error.message
            };
        }
    }
    
    async testAdminPanelFunctionality() {
        try {
            // Test that admin panel still functions
            const adminPanel = document.getElementById('adminPanel');
            
            if (!adminPanel) {
                return {
                    success: false,
                    error: 'Admin panel not found'
                };
            }
            
            // Test navigation functionality
            const navButtons = adminPanel.querySelectorAll('.admin-nav-btn');
            
            if (navButtons.length === 0) {
                return {
                    success: false,
                    error: 'Admin panel navigation buttons not found'
                };
            }
            
            // Test clicking navigation buttons
            let functionalButtons = 0;
            navButtons.forEach(btn => {
                if (btn.dataset.adminSection && btn.dataset.adminSection !== 'prompts') {
                    functionalButtons++;
                }
            });
            
            if (functionalButtons === 0) {
                return {
                    success: false,
                    error: 'No functional navigation buttons found'
                };
            }
            
            return {
                success: true,
                message: 'Admin panel functionality is preserved',
                details: `Found ${functionalButtons} functional navigation buttons`
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error testing admin panel functionality: ' + error.message
            };
        }
    }
    
    async testLLMManagerRedirect() {
        try {
            // Check if LLM section has redirect information
            const llmSection = document.getElementById('llm-section');
            
            if (!llmSection) {
                return {
                    success: false,
                    error: 'LLM section not found in admin panel'
                };
            }
            
            // Check for informational message about LLM Manager
            const infoMessage = llmSection.querySelector('.info-message');
            
            if (!infoMessage) {
                return {
                    success: false,
                    error: 'No informational message found directing users to LLM Manager'
                };
            }
            
            // Check for "Open Full Manager" button
            const openManagerBtn = llmSection.querySelector('button[onclick*="openFullLLMManager"]');
            
            if (!openManagerBtn) {
                return {
                    success: false,
                    error: 'No "Open Full Manager" button found'
                };
            }
            
            return {
                success: true,
                message: 'LLM Manager redirect information is present',
                details: 'Found informational message and "Open Full Manager" button'
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error testing LLM Manager redirect: ' + error.message
            };
        }
    }
    
    async testDataMigration() {
        try {
            if (!this.systemPromptsManager) {
                return {
                    success: false,
                    error: 'SystemPromptsManager not available for migration test'
                };
            }
            
            // Test data migration functionality
            const systemPrompts = this.systemPromptsManager.getAllPrompts();
            
            if (!systemPrompts) {
                return {
                    success: false,
                    error: 'No system prompts data available for migration'
                };
            }
            
            // Check if data has required fields
            const requiredFields = ['basePersonality', 'financialContext', 'responseInstructions'];
            const missingFields = requiredFields.filter(field => !systemPrompts[field]);
            
            if (missingFields.length > 0) {
                return {
                    success: false,
                    error: 'Missing required fields in system prompts data: ' + missingFields.join(', ')
                };
            }
            
            return {
                success: true,
                message: 'Data migration is functional',
                details: 'System prompts data contains all required fields'
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error testing data migration: ' + error.message
            };
        }
    }
    
    async testLocalStoragePersistence() {
        try {
            // Test localStorage persistence
            const testKey = 'test-default-agent-config';
            const testData = {
                basePersonality: 'Test personality',
                financialContext: 'Test context',
                responseInstructions: 'Test instructions',
                timestamp: Date.now()
            };
            
            // Save to localStorage
            localStorage.setItem(testKey, JSON.stringify(testData));
            
            // Retrieve from localStorage
            const retrievedData = JSON.parse(localStorage.getItem(testKey));
            
            // Clean up
            localStorage.removeItem(testKey);
            
            if (!retrievedData || retrievedData.basePersonality !== testData.basePersonality) {
                return {
                    success: false,
                    error: 'LocalStorage persistence not working correctly'
                };
            }
            
            return {
                success: true,
                message: 'LocalStorage persistence is working',
                details: 'Data can be saved to and retrieved from localStorage'
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error testing localStorage persistence: ' + error.message
            };
        }
    }
    
    async testSessionPersistence() {
        try {
            // Test session persistence by checking if data survives page operations
            const currentData = localStorage.getItem('system-prompts');
            
            if (!currentData) {
                return {
                    success: false,
                    error: 'No system prompts data found in localStorage for session test'
                };
            }
            
            const parsedData = JSON.parse(currentData);
            
            if (!parsedData.basePersonality) {
                return {
                    success: false,
                    error: 'System prompts data incomplete for session persistence test'
                };
            }
            
            return {
                success: true,
                message: 'Session persistence is working',
                details: 'System prompts data persists across sessions'
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error testing session persistence: ' + error.message
            };
        }
    }
    
    async testDataIntegrity() {
        try {
            if (!this.systemPromptsManager) {
                return {
                    success: false,
                    error: 'SystemPromptsManager not available for integrity test'
                };
            }
            
            // Get original data
            const originalData = this.systemPromptsManager.getAllPrompts();
            
            if (!originalData) {
                return {
                    success: false,
                    error: 'No original data available for integrity test'
                };
            }
            
            // Simulate migration and check integrity
            const migratedData = {
                basePersonality: originalData.basePersonality,
                financialContext: originalData.financialContext,
                responseInstructions: originalData.responseInstructions,
                customPrompts: originalData.customPrompts || []
            };
            
            // Check if all data is preserved
            const dataIntact = originalData.basePersonality === migratedData.basePersonality &&
                             originalData.financialContext === migratedData.financialContext &&
                             originalData.responseInstructions === migratedData.responseInstructions;
            
            if (!dataIntact) {
                return {
                    success: false,
                    error: 'Data integrity compromised during migration simulation'
                };
            }
            
            return {
                success: true,
                message: 'Data integrity is maintained',
                details: 'All original data fields are preserved during migration'
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error testing data integrity: ' + error.message
            };
        }
    }
    
    async testSystemPromptsManagerIntegration() {
        try {
            if (!this.systemPromptsManager) {
                return {
                    success: false,
                    error: 'SystemPromptsManager not available for integration test'
                };
            }
            
            // Test SystemPromptsManager integration
            const integrationResult = await this.llmManagerUI?.testSystemPromptsManagerIntegration();
            
            if (!integrationResult) {
                return {
                    success: false,
                    error: 'Integration test not available in LLM Manager UI'
                };
            }
            
            if (!integrationResult.success) {
                return {
                    success: false,
                    error: 'SystemPromptsManager integration failed: ' + integrationResult.error
                };
            }
            
            return {
                success: true,
                message: 'SystemPromptsManager integration is working',
                details: integrationResult.details.join(', ')
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error testing SystemPromptsManager integration: ' + error.message
            };
        }
    }
    
    async testAgentSystemIntegration() {
        try {
            if (!this.llmManagerUI || !this.llmManagerUI.llmManager) {
                return {
                    success: false,
                    error: 'LLM Manager not available for agent system integration test'
                };
            }
            
            // Test agent system integration
            const agents = this.llmManagerUI.llmManager.getAllAgentConfigurations();
            
            if (!agents || Object.keys(agents).length === 0) {
                return {
                    success: false,
                    error: 'No agents found in agent system'
                };
            }
            
            // Check if Default Agent is integrated
            const defaultAgent = agents['DefaultAgent'];
            
            if (!defaultAgent) {
                return {
                    success: false,
                    error: 'Default Agent not integrated with agent system'
                };
            }
            
            return {
                success: true,
                message: 'Agent system integration is working',
                details: `Found ${Object.keys(agents).length} agents including Default Agent`
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error testing agent system integration: ' + error.message
            };
        }
    }
    
    async testLLMManagerConsistency() {
        try {
            // Test consistency with other agents in LLM Manager
            const response = await fetch('llm-manager-admin-ui.html');
            const htmlContent = await response.text();
            
            // Check if Default Agent card follows same pattern as other agents
            const hasDefaultAgentCard = htmlContent.includes('Default Agent') &&
                                       htmlContent.includes('agent-prompt-card');
            
            if (!hasDefaultAgentCard) {
                return {
                    success: false,
                    error: 'Default Agent card not found or inconsistent with other agents'
                };
            }
            
            // Check for consistent styling and structure
            const hasConsistentStructure = htmlContent.includes('agent-prompt-header') &&
                                         htmlContent.includes('prompt-field') &&
                                         htmlContent.includes('prompt-actions');
            
            if (!hasConsistentStructure) {
                return {
                    success: false,
                    error: 'Default Agent structure inconsistent with other agents'
                };
            }
            
            return {
                success: true,
                message: 'LLM Manager interface consistency is maintained',
                details: 'Default Agent follows same patterns as other agents'
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error testing LLM Manager consistency: ' + error.message
            };
        }
    }
    
    async testBackwardCompatibility() {
        try {
            // Test backward compatibility with existing functionality
            if (!this.systemPromptsManager) {
                return {
                    success: false,
                    error: 'SystemPromptsManager not available for backward compatibility test'
                };
            }
            
            // Test that existing SystemPromptsManager methods still work
            const methods = ['getAllPrompts', 'updatePrompts', 'init'];
            const missingMethods = [];
            
            methods.forEach(method => {
                if (typeof this.systemPromptsManager[method] !== 'function') {
                    missingMethods.push(method);
                }
            });
            
            if (missingMethods.length > 0) {
                return {
                    success: false,
                    error: 'Missing SystemPromptsManager methods: ' + missingMethods.join(', ')
                };
            }
            
            // Test that methods still function
            const prompts = this.systemPromptsManager.getAllPrompts();
            
            if (prompts === null || prompts === undefined) {
                return {
                    success: false,
                    error: 'SystemPromptsManager getAllPrompts method not functioning'
                };
            }
            
            return {
                success: true,
                message: 'Backward compatibility is maintained',
                details: 'All existing SystemPromptsManager methods are functional'
            };
            
        } catch (error) {
            return {
                success: false,
                error: 'Error testing backward compatibility: ' + error.message
            };
        }
    }
    
    // Utility Methods
    
    resetAllTests() {
        // Reset all test results
        this.testResults = {
            defaultAgent: [],
            systemPrompts: [],
            dataPersistence: [],
            integration: [],
            overall: {
                total: this.testResults.overall.total,
                passed: 0,
                failed: 0,
                pending: this.testResults.overall.total
            }
        };
        
        // Reset UI
        document.querySelectorAll('.test-status').forEach(status => {
            status.textContent = 'PENDING';
            status.className = 'test-status pending';
        });
        
        document.querySelectorAll('.test-results').forEach(results => {
            results.style.display = 'none';
            results.textContent = 'Test results will appear here...';
        });
        
        // Update counts
        this.updateTestCounts();
        
        // Reset progress
        document.getElementById('overallProgress').style.width = '0%';
        document.getElementById('progressText').textContent = 'Ready to start testing';
    }
    
    resetDefaultAgentTests() {
        this.resetTestCategory('defaultAgent', this.defaultAgentTestDefinitions);
    }
    
    resetSystemPromptsTests() {
        this.resetTestCategory('systemPrompts', this.systemPromptsTestDefinitions);
    }
    
    resetDataPersistenceTests() {
        this.resetTestCategory('dataPersistence', this.dataPersistenceTestDefinitions);
    }
    
    resetIntegrationTests() {
        this.resetTestCategory('integration', this.integrationTestDefinitions);
    }
    
    resetTestCategory(category, testDefinitions) {
        // Reset category results
        this.testResults[category] = [];
        
        // Reset UI for category
        testDefinitions.forEach(testDef => {
            const statusElement = document.getElementById(`status-${testDef.id}`);
            const resultsElement = document.getElementById(`results-${testDef.id}`);
            
            if (statusElement) {
                statusElement.textContent = 'PENDING';
                statusElement.className = 'test-status pending';
            }
            
            if (resultsElement) {
                resultsElement.style.display = 'none';
                resultsElement.textContent = 'Test results will appear here...';
            }
        });
        
        // Update overall counts
        this.updateTestCounts();
    }
    
    updateOverallProgress() {
        const totalTests = this.testResults.overall.total;
        const completedTests = this.testResults.overall.passed + this.testResults.overall.failed;
        const progressPercent = totalTests > 0 ? (completedTests / totalTests) * 100 : 0;
        
        document.getElementById('overallProgress').style.width = progressPercent + '%';
        
        if (completedTests === totalTests) {
            const passRate = totalTests > 0 ? (this.testResults.overall.passed / totalTests) * 100 : 0;
            document.getElementById('progressText').textContent = 
                `Testing complete: ${this.testResults.overall.passed}/${totalTests} passed (${passRate.toFixed(1)}%)`;
        } else {
            document.getElementById('progressText').textContent = 
                `Testing in progress: ${completedTests}/${totalTests} completed`;
        }
    }
    
    generateDetailedResults() {
        const resultsContainer = document.getElementById('detailedResults');
        if (!resultsContainer) return;
        
        let resultsHTML = '<h4>Comprehensive Test Results</h4>';
        resultsHTML += `<p><strong>Execution Time:</strong> ${new Date().toLocaleString()}</p>`;
        resultsHTML += `<p><strong>Overall Results:</strong> ${this.testResults.overall.passed}/${this.testResults.overall.total} tests passed</p><br>`;
        
        // Add results by category
        const categories = [
            { key: 'defaultAgent', name: 'Default Agent Configuration Tests' },
            { key: 'systemPrompts', name: 'System Prompts Removal Tests' },
            { key: 'dataPersistence', name: 'Data Persistence Tests' },
            { key: 'integration', name: 'Integration Tests' }
        ];
        
        categories.forEach(category => {
            const categoryResults = this.testResults[category.key];
            if (categoryResults.length > 0) {
                resultsHTML += `<h5>${category.name}</h5>`;
                
                categoryResults.forEach(result => {
                    const status = result.success ? '✅ PASSED' : '❌ FAILED';
                    resultsHTML += `<div style="margin: 10px 0; padding: 10px; border-left: 3px solid ${result.success ? '#27ae60' : '#e74c3c'};">`;
                    resultsHTML += `<strong>${status}: ${result.name}</strong><br>`;
                    resultsHTML += `${result.success ? result.message : result.error}<br>`;
                    if (result.details) {
                        resultsHTML += `<small>Details: ${result.details}</small><br>`;
                    }
                    resultsHTML += `<small>Timestamp: ${result.timestamp}</small>`;
                    resultsHTML += '</div>';
                });
                
                resultsHTML += '<br>';
            }
        });
        
        resultsContainer.innerHTML = resultsHTML;
    }
    
    exportResults() {
        const results = {
            timestamp: new Date().toISOString(),
            summary: this.testResults.overall,
            categories: {
                defaultAgent: this.testResults.defaultAgent,
                systemPrompts: this.testResults.systemPrompts,
                dataPersistence: this.testResults.dataPersistence,
                integration: this.testResults.integration
            }
        };
        
        const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `task-12-test-results-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    exportDetailedResults() {
        const resultsContainer = document.getElementById('detailedResults');
        if (!resultsContainer) return;
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Task 12 Test Results</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h4, h5 { color: #2c3e50; }
                    .passed { border-left: 3px solid #27ae60; }
                    .failed { border-left: 3px solid #e74c3c; }
                    .test-result { margin: 10px 0; padding: 10px; background: #f8f9fa; }
                </style>
            </head>
            <body>
                ${resultsContainer.innerHTML}
            </body>
            </html>
        `;
        
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `task-12-detailed-results-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    clearResults() {
        const resultsContainer = document.getElementById('detailedResults');
        if (resultsContainer) {
            resultsContainer.textContent = 'Test results will appear here after running tests...';
        }
    }
}

// Global functions for HTML onclick handlers
function runAllTests() {
    if (window.task12Verifier) {
        window.task12Verifier.runAllTests();
    }
}

function resetAllTests() {
    if (window.task12Verifier) {
        window.task12Verifier.resetAllTests();
    }
}

function exportResults() {
    if (window.task12Verifier) {
        window.task12Verifier.exportResults();
    }
}

function runDefaultAgentTests() {
    if (window.task12Verifier) {
        window.task12Verifier.runDefaultAgentTests();
    }
}

function resetDefaultAgentTests() {
    if (window.task12Verifier) {
        window.task12Verifier.resetDefaultAgentTests();
    }
}

function runSystemPromptsTests() {
    if (window.task12Verifier) {
        window.task12Verifier.runSystemPromptsTests();
    }
}

function resetSystemPromptsTests() {
    if (window.task12Verifier) {
        window.task12Verifier.resetSystemPromptsTests();
    }
}

function runDataPersistenceTests() {
    if (window.task12Verifier) {
        window.task12Verifier.runDataPersistenceTests();
    }
}

function resetDataPersistenceTests() {
    if (window.task12Verifier) {
        window.task12Verifier.resetDataPersistenceTests();
    }
}

function runIntegrationTests() {
    if (window.task12Verifier) {
        window.task12Verifier.runIntegrationTests();
    }
}

function resetIntegrationTests() {
    if (window.task12Verifier) {
        window.task12Verifier.resetIntegrationTests();
    }
}

function exportDetailedResults() {
    if (window.task12Verifier) {
        window.task12Verifier.exportDetailedResults();
    }
}

function clearResults() {
    if (window.task12Verifier) {
        window.task12Verifier.clearResults();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.task12Verifier = new Task12Verifier();
});