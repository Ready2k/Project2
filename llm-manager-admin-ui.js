/**
 * LLM Manager Admin UI - JavaScript Controller
 * Handles all UI interactions and data management for the admin interface
 */

class LLMManagerAdminUI {
    constructor() {
        this.llmManager = null;
        this.guardrailsManager = null;
        this.voiceConfigManager = null;
        this.currentAgent = null;
        this.auditLog = [];
        
        this.debug = window.debugManager?.createModuleLogger('AdminUI') || console;
        
        this.initialize();
    }
    
    /**
     * Initialize the admin UI with enhanced error handling and graceful degradation
     */
    async initialize() {
        this.debug.log('Initializing LLM Manager Admin UI with enhanced error handling');
        
        try {
            // Check if we're in the standalone LLM Manager interface
            const isStandaloneLLMInterface = document.querySelector('.llm-manager-container') || 
                                           document.querySelector('[data-section]');
            
            if (!isStandaloneLLMInterface) {
                this.debug.warn('LLM Manager Admin UI loaded in new interface - limited functionality');
                // Use graceful degradation for limited environment
                await this.initializeWithGracefulDegradation();
                return;
            }
            
            // Initialize with graceful degradation for full functionality
            const initResult = await this.initializeWithGracefulDegradation();
            
            if (initResult.success) {
                this.debug.log('Admin UI initialized successfully with enhanced error handling');
            } else {
                this.debug.error('Admin UI initialization completed with errors:', initResult.errors);
            }
            
        } catch (error) {
            this.debug.error('Critical error during Admin UI initialization:', error);
            this.showError('Failed to initialize LLM Manager Admin UI: ' + error.message);
        }
    }
    
    /**
     * Initialize manager instances
     */
    initializeManagers() {
        try {
            // Check if required classes are available
            if (typeof LLMManager === 'undefined') {
                this.debug.warn('LLMManager not available, skipping initialization');
                return;
            }
            
            if (typeof GuardrailsManager === 'undefined') {
                this.debug.warn('GuardrailsManager not available, skipping initialization');
                return;
            }
            
            if (typeof VoiceConfigManager === 'undefined') {
                this.debug.warn('VoiceConfigManager not available, skipping initialization');
                return;
            }
            
            // Initialize SystemPromptsManager for Default Agent integration
            if (typeof SystemPromptsManager !== 'undefined') {
                this.systemPromptsManager = new SystemPromptsManager();
                this.systemPromptsManager.init().then(() => {
                    this.debug.log('SystemPromptsManager initialized for Default Agent integration');
                }).catch(error => {
                    this.debug.error('Failed to initialize SystemPromptsManager:', error);
                });
            } else {
                this.debug.warn('SystemPromptsManager not available, Default Agent integration disabled');
            }
            
            this.llmManager = new LLMManager();
            this.guardrailsManager = new GuardrailsManager();
            this.voiceConfigManager = new VoiceConfigManager();
            
            // Set up dependencies
            this.llmManager.setManagers(this.guardrailsManager, this.voiceConfigManager, null);
            
            // Ensure Default Agent is properly initialized and integrated
            this.initializeDefaultAgentOnStartup();
            
            this.logAuditEvent('system', 'Managers initialized successfully');
            
        } catch (error) {
            this.debug.error('Failed to initialize managers:', error);
            this.showError('Failed to initialize system managers');
        }
    }
    
    /**
     * Initialize prompts section
     */
    initializePromptsSection() {
        try {
            // Call global initialization function
            if (typeof initializePromptsSection === 'function') {
                initializePromptsSection();
            }
        } catch (error) {
            this.debug.error('Error initializing prompts section:', error);
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Navigation - only set up if elements exist
        const navBtns = document.querySelectorAll('.nav-btn[data-section]');
        if (navBtns.length > 0) {
            navBtns.forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const section = e.target.dataset.section;
                    if (section) {
                        await this.switchSection(section);
                    }
                });
            });
        } else {
            this.debug.warn('No navigation buttons with data-section found - likely in new interface');
        }
        
        // Modal close events
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });
        
        // Tab switching
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                this.switchTab(e.target);
            }
        });

        // Auth toggle handling
        document.addEventListener('click', (e) => {
            if (e.target.dataset.authAction) {
                const detailsDiv = e.target.closest('.auth-action-config').querySelector('.auth-action-details');
                if (e.target.classList.contains('active')) {
                    detailsDiv.style.display = 'block';
                } else {
                    detailsDiv.style.display = 'none';
                }
            }
        });
        
        // Audit log filter
        const logFilter = document.getElementById('logFilter');
        if (logFilter) {
            logFilter.addEventListener('change', () => {
                this.filterAuditLog(logFilter.value);
            });
        }
    }
    
    /**
     * Load initial data
     */
    async loadInitialData() {
        // Ensure Default Agent is properly initialized and integrated
        await this.initializeDefaultAgentIntegration();
        
        // Then refresh agent data and load audit log
        this.refreshAgentData();
        this.loadAuditLog();
    }
    
    /**
     * Initialize Default Agent integration with comprehensive error handling and validation
     * This ensures Default Agent is properly loaded and integrated with SystemPromptsManager
     */
    async initializeDefaultAgentIntegration() {
        this.debug.log('Starting Default Agent integration initialization');
        
        try {
            // Step 1: Ensure LLM Manager is available and initialized
            if (!this.llmManager) {
                this.debug.error('LLM Manager not available for Default Agent integration');
                return false;
            }
            
            // Step 2: Check if Default Agent already exists in LLM Manager
            let existingDefaultAgent = this.llmManager.getAgentConfiguration('DefaultAgent');
            
            if (existingDefaultAgent) {
                this.debug.log('Default Agent found in LLM Manager, checking integration status');
                
                // Check if it has system prompts integration
                if (!existingDefaultAgent.systemPrompts && !existingDefaultAgent.lastSyncedFromSystemPrompts) {
                    this.debug.log('Default Agent exists but lacks system prompts integration, updating...');
                    await this.updateDefaultAgentWithSystemPrompts(existingDefaultAgent);
                } else {
                    this.debug.log('Default Agent already has system prompts integration');
                }
            } else {
                this.debug.log('Default Agent not found in LLM Manager, creating with system prompts integration');
                await this.createDefaultAgentWithSystemPrompts();
            }
            
            // Step 3: Verify integration is working
            const verificationResult = await this.verifyDefaultAgentIntegration();
            
            if (verificationResult.success) {
                this.debug.log('Default Agent integration initialization completed successfully');
                return true;
            } else {
                this.debug.warn('Default Agent integration verification failed:', verificationResult.error);
                
                // Try to fix empty fields if that's the issue
                if (verificationResult.error && verificationResult.error.includes('missing or empty required field')) {
                    this.debug.log('Attempting to fix empty fields in Default Agent');
                    const fixResult = await this.fixDefaultAgentEmptyFields();
                    
                    if (fixResult.success) {
                        this.debug.log('Successfully fixed empty fields, re-verifying...');
                        const reVerificationResult = await this.verifyDefaultAgentIntegration();
                        
                        if (reVerificationResult.success) {
                            this.debug.log('Default Agent integration initialization completed successfully after fixing empty fields');
                            return true;
                        } else {
                            this.debug.error('Re-verification failed after fixing empty fields:', reVerificationResult.error);
                            return false;
                        }
                    } else {
                        this.debug.error('Failed to fix empty fields:', fixResult.error);
                        return false;
                    }
                } else {
                    return false;
                }
            }
            
        } catch (error) {
            this.debug.error('Error during Default Agent integration initialization:', error);
            return false;
        }
    }
    
    /**
     * Update existing Default Agent with system prompts integration
     * @param {Object} existingConfig - Existing Default Agent configuration
     */
    async updateDefaultAgentWithSystemPrompts(existingConfig) {
        try {
            // Load system prompts data
            const systemPromptsData = await this.loadSystemPromptsData();
            
            if (systemPromptsData) {
                // Convert to LLM Manager format
                const systemPromptsConfig = this.convertSystemPromptsToLLMManagerFormat(systemPromptsData);
                
                // Merge with existing configuration
                const updatedConfig = {
                    ...existingConfig,
                    ...systemPromptsConfig,
                    // Preserve important LLM Manager fields
                    name: existingConfig.name,
                    priority: existingConfig.priority,
                    enabled: existingConfig.enabled,
                    llmProvider: existingConfig.llmProvider,
                    llmModel: existingConfig.llmModel,
                    maxTokens: existingConfig.maxTokens,
                    telemetryEnabled: existingConfig.telemetryEnabled,
                    createdAt: existingConfig.createdAt,
                    lastUpdated: new Date().toISOString(),
                    lastSyncedFromSystemPrompts: new Date().toISOString()
                };
                
                // Update in LLM Manager
                const updateResult = await this.llmManager.updateAgentConfiguration('DefaultAgent', updatedConfig, {
                    skipRealTimeUpdate: true,
                    reason: 'System prompts integration update'
                });
                
                if (updateResult.success) {
                    this.debug.log('Successfully updated Default Agent with system prompts integration');
                } else {
                    throw new Error('Failed to update Default Agent: ' + updateResult.error);
                }
            } else {
                this.debug.warn('No system prompts data available, using defaults');
                await this.updateDefaultAgentWithDefaults(existingConfig);
            }
            
        } catch (error) {
            this.debug.error('Error updating Default Agent with system prompts:', error);
            throw error;
        }
    }
    
    /**
     * Create new Default Agent with system prompts integration
     */
    async createDefaultAgentWithSystemPrompts() {
        try {
            // Load system prompts data
            const systemPromptsData = await this.loadSystemPromptsData();
            
            // Use system prompts data or fallback to defaults
            const promptsData = systemPromptsData || this.getDefaultSystemPromptsConfiguration();
            
            // Convert to LLM Manager format
            const systemPromptsConfig = this.convertSystemPromptsToLLMManagerFormat(promptsData);
            
            // Create complete Default Agent configuration
            const defaultAgentConfig = {
                name: 'DefaultAgent',
                description: 'Primary AI assistant for general banking inquiries (integrated with System Prompts)',
                priority: 0,
                enabled: true,
                triggers: [], // No specific triggers - acts as fallback
                llmProvider: 'openai',
                llmModel: 'gpt-4',
                maxTokens: 1500,
                telemetryEnabled: true,
                ...systemPromptsConfig,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                lastSyncedFromSystemPrompts: new Date().toISOString()
            };
            
            // Add to LLM Manager
            const createResult = await this.llmManager.updateAgentConfiguration('DefaultAgent', defaultAgentConfig, {
                skipRealTimeUpdate: true,
                reason: 'Default Agent creation with system prompts integration'
            });
            
            if (createResult.success) {
                this.debug.log('Successfully created Default Agent with system prompts integration');
            } else {
                throw new Error('Failed to create Default Agent: ' + createResult.error);
            }
            
        } catch (error) {
            this.debug.error('Error creating Default Agent with system prompts:', error);
            throw error;
        }
    }
    
    /**
     * Update Default Agent with default configuration when system prompts are not available
     * @param {Object} existingConfig - Existing Default Agent configuration
     */
    async updateDefaultAgentWithDefaults(existingConfig) {
        try {
            const defaultSystemPrompts = this.getDefaultSystemPromptsConfiguration();
            const systemPromptsConfig = this.convertSystemPromptsToLLMManagerFormat(defaultSystemPrompts);
            
            const updatedConfig = {
                ...existingConfig,
                ...systemPromptsConfig,
                lastUpdated: new Date().toISOString(),
                lastSyncedFromSystemPrompts: new Date().toISOString(),
                fallbackUsed: true
            };
            
            const updateResult = await this.llmManager.updateAgentConfiguration('DefaultAgent', updatedConfig, {
                skipRealTimeUpdate: true,
                reason: 'Default Agent fallback configuration update'
            });
            
            if (updateResult.success) {
                this.debug.log('Successfully updated Default Agent with default configuration');
            } else {
                throw new Error('Failed to update Default Agent with defaults: ' + updateResult.error);
            }
            
        } catch (error) {
            this.debug.error('Error updating Default Agent with defaults:', error);
            throw error;
        }
    }
    
    /**
     * Load system prompts data with comprehensive error handling
     * @returns {Object|null} System prompts data or null if not available
     */
    async loadSystemPromptsData() {
        // Try SystemPromptsManager first
        if (this.systemPromptsManager) {
            try {
                await this.systemPromptsManager.init();
                const systemPrompts = this.systemPromptsManager.getAllPrompts();
                
                // Validate the data
                const validationResult = this.validateSystemPromptsData(systemPrompts);
                if (validationResult.valid) {
                    this.debug.log('Successfully loaded system prompts from SystemPromptsManager');
                    return systemPrompts;
                } else {
                    this.debug.warn('System prompts data validation failed, attempting repair');
                    return this.repairSystemPromptsData(systemPrompts);
                }
            } catch (error) {
                this.debug.error('Error loading from SystemPromptsManager:', error);
            }
        }
        
        // Try localStorage fallback
        try {
            const systemPrompts = this.loadSystemPromptsFromLocalStorage();
            if (systemPrompts) {
                this.debug.log('Successfully loaded system prompts from localStorage');
                return systemPrompts;
            }
        } catch (error) {
            this.debug.error('Error loading from localStorage:', error);
        }
        
        // No data available
        this.debug.warn('No system prompts data available from any source');
        return null;
    }
    
    /**
     * Verify Default Agent integration is working correctly
     * @returns {Object} Verification result with success status and details
     */
    async verifyDefaultAgentIntegration() {
        const verificationResult = {
            success: false,
            error: null,
            details: []
        };
        
        try {
            // Check if Default Agent exists
            const defaultAgent = this.llmManager.getAgentConfiguration('DefaultAgent');
            if (!defaultAgent) {
                verificationResult.error = 'Default Agent not found in LLM Manager';
                return verificationResult;
            }
            verificationResult.details.push('✓ Default Agent exists in LLM Manager');
            
            // Check if it has system prompts integration
            if (!defaultAgent.systemPrompts) {
                verificationResult.error = 'Default Agent lacks system prompts integration';
                return verificationResult;
            }
            verificationResult.details.push('✓ Default Agent has system prompts integration');
            
            // Check required system prompts fields
            const requiredFields = ['basePersonality', 'financialContext', 'responseInstructions'];
            for (const field of requiredFields) {
                if (!defaultAgent.systemPrompts[field] || typeof defaultAgent.systemPrompts[field] !== 'string' || defaultAgent.systemPrompts[field].trim().length === 0) {
                    verificationResult.error = `Default Agent missing or empty required field: ${field}`;
                    return verificationResult;
                }
            }
            verificationResult.details.push('✓ All required system prompts fields present');
            
            // Check if custom prompts array exists
            if (!Array.isArray(defaultAgent.systemPrompts.customPrompts)) {
                verificationResult.error = 'Default Agent custom prompts is not an array';
                return verificationResult;
            }
            verificationResult.details.push('✓ Custom prompts array is valid');
            
            // Check sync timestamp
            if (!defaultAgent.lastSyncedFromSystemPrompts) {
                verificationResult.error = 'Default Agent missing sync timestamp';
                return verificationResult;
            }
            verificationResult.details.push('✓ Sync timestamp present');
            
            // All checks passed
            verificationResult.success = true;
            this.debug.log('Default Agent integration verification passed:', verificationResult.details);
            
        } catch (error) {
            verificationResult.error = 'Verification error: ' + error.message;
            this.debug.error('Error during Default Agent integration verification:', error);
        }
        
        return verificationResult;
    }
    
    /**
     * Fix Default Agent with empty system prompts fields
     * This method updates existing Default Agents that have empty strings with proper defaults
     * @returns {Promise<Object>} Fix result with success status and details
     */
    async fixDefaultAgentEmptyFields() {
        const fixResult = {
            success: false,
            error: null,
            details: [],
            fieldsFixed: []
        };
        
        try {
            this.debug.log('Checking Default Agent for empty system prompts fields');
            
            // Get current Default Agent configuration
            const defaultAgent = this.llmManager.getAgentConfiguration('DefaultAgent');
            if (!defaultAgent) {
                fixResult.error = 'Default Agent not found';
                return fixResult;
            }
            
            if (!defaultAgent.systemPrompts) {
                fixResult.error = 'Default Agent missing system prompts structure';
                return fixResult;
            }
            
            // Check for empty fields and prepare fixes
            const defaultConfig = this.getDefaultSystemPromptsConfiguration();
            const fieldsToFix = [];
            const requiredFields = ['basePersonality', 'financialContext', 'responseInstructions'];
            
            for (const field of requiredFields) {
                const currentValue = defaultAgent.systemPrompts[field];
                if (!currentValue || typeof currentValue !== 'string' || currentValue.trim().length === 0) {
                    fieldsToFix.push({
                        field,
                        currentValue: currentValue || '(missing)',
                        newValue: defaultConfig[field]
                    });
                }
            }
            
            if (fieldsToFix.length === 0) {
                fixResult.success = true;
                fixResult.details.push('No empty fields found - Default Agent is properly configured');
                return fixResult;
            }
            
            // Apply fixes
            const updatedSystemPrompts = {
                ...defaultAgent.systemPrompts
            };
            
            fieldsToFix.forEach(fix => {
                updatedSystemPrompts[fix.field] = fix.newValue;
                fixResult.fieldsFixed.push(fix.field);
                fixResult.details.push(`Fixed ${fix.field}: replaced "${fix.currentValue}" with proper default`);
            });
            
            // Update the Default Agent
            const updatedConfig = {
                ...defaultAgent,
                systemPrompts: updatedSystemPrompts,
                lastUpdated: new Date().toISOString(),
                lastFixedEmptyFields: new Date().toISOString(),
                lastSyncedFromSystemPrompts: new Date().toISOString()
            };
            
            const updateResult = await this.llmManager.updateAgentConfiguration('DefaultAgent', updatedConfig, {
                skipRealTimeUpdate: true,
                reason: 'Fix empty system prompts fields'
            });
            
            if (updateResult.success) {
                fixResult.success = true;
                fixResult.details.push(`Successfully fixed ${fieldsToFix.length} empty field(s)`);
                this.debug.log('Default Agent empty fields fixed successfully');
            } else {
                fixResult.error = 'Failed to update Default Agent: ' + updateResult.error;
            }
            
        } catch (error) {
            fixResult.error = 'Error fixing Default Agent: ' + error.message;
            this.debug.error('Error fixing Default Agent empty fields:', error);
        }
        
        return fixResult;
    }
    
    /**
     * Test integration with existing SystemPromptsManager functionality
     * This method verifies that the Default Agent can properly interact with SystemPromptsManager
     * @returns {Promise<Object>} Test result with success status and details
     */
    async testSystemPromptsManagerIntegration() {
        const testResult = {
            success: false,
            error: null,
            details: [],
            tests: []
        };
        
        try {
            this.debug.log('Starting SystemPromptsManager integration test');
            
            // Test 1: Check if SystemPromptsManager is available
            if (!this.systemPromptsManager) {
                testResult.tests.push({
                    name: 'SystemPromptsManager Availability',
                    success: false,
                    error: 'SystemPromptsManager not available'
                });
            } else {
                testResult.tests.push({
                    name: 'SystemPromptsManager Availability',
                    success: true,
                    details: 'SystemPromptsManager is available'
                });
                
                // Test 2: Initialize SystemPromptsManager
                try {
                    await this.systemPromptsManager.init();
                    testResult.tests.push({
                        name: 'SystemPromptsManager Initialization',
                        success: true,
                        details: 'SystemPromptsManager initialized successfully'
                    });
                    
                    // Test 3: Load system prompts data
                    const systemPrompts = this.systemPromptsManager.getAllPrompts();
                    if (systemPrompts) {
                        testResult.tests.push({
                            name: 'System Prompts Data Loading',
                            success: true,
                            details: `Loaded system prompts with ${Object.keys(systemPrompts).length} properties`
                        });
                        
                        // Test 4: Validate system prompts data
                        const validationResult = this.validateSystemPromptsData(systemPrompts);
                        testResult.tests.push({
                            name: 'System Prompts Data Validation',
                            success: validationResult.valid,
                            details: validationResult.valid ? 'System prompts data is valid' : 'Validation errors: ' + validationResult.errors.join(', ')
                        });
                        
                        // Test 5: Convert to LLM Manager format
                        try {
                            const converted = this.convertSystemPromptsToLLMManagerFormat(systemPrompts);
                            testResult.tests.push({
                                name: 'Format Conversion',
                                success: true,
                                details: 'Successfully converted system prompts to LLM Manager format'
                            });
                            
                            // Test 6: Update Default Agent with converted data
                            const updateResult = await this.llmManager.updateAgentConfiguration('DefaultAgent', converted, {
                                skipRealTimeUpdate: true,
                                reason: 'Integration test'
                            });
                            
                            testResult.tests.push({
                                name: 'Default Agent Update',
                                success: updateResult.success,
                                details: updateResult.success ? 'Default Agent updated successfully' : 'Update failed: ' + updateResult.error
                            });
                            
                        } catch (conversionError) {
                            testResult.tests.push({
                                name: 'Format Conversion',
                                success: false,
                                error: 'Conversion failed: ' + conversionError.message
                            });
                        }
                        
                    } else {
                        testResult.tests.push({
                            name: 'System Prompts Data Loading',
                            success: false,
                            error: 'No system prompts data returned'
                        });
                    }
                    
                } catch (initError) {
                    testResult.tests.push({
                        name: 'SystemPromptsManager Initialization',
                        success: false,
                        error: 'Initialization failed: ' + initError.message
                    });
                }
            }
            
            // Test 7: Verify Default Agent configuration
            const defaultAgent = this.llmManager.getAgentConfiguration('DefaultAgent');
            if (defaultAgent && defaultAgent.systemPrompts) {
                testResult.tests.push({
                    name: 'Default Agent Configuration Verification',
                    success: true,
                    details: 'Default Agent has proper system prompts configuration'
                });
            } else {
                testResult.tests.push({
                    name: 'Default Agent Configuration Verification',
                    success: false,
                    error: 'Default Agent lacks proper system prompts configuration'
                });
            }
            
            // Determine overall success
            const failedTests = testResult.tests.filter(test => !test.success);
            testResult.success = failedTests.length === 0;
            
            if (testResult.success) {
                testResult.details.push('All integration tests passed successfully');
                this.debug.log('SystemPromptsManager integration test completed successfully');
            } else {
                testResult.error = `${failedTests.length} test(s) failed`;
                testResult.details.push(`Failed tests: ${failedTests.map(t => t.name).join(', ')}`);
                this.debug.warn('SystemPromptsManager integration test completed with failures');
            }
            
        } catch (error) {
            testResult.error = 'Integration test error: ' + error.message;
            this.debug.error('Error during SystemPromptsManager integration test:', error);
        }
        
        return testResult;
    }
    
    /**
     * Initialize Default Agent on startup with proper integration
     * This method is called during manager initialization to ensure Default Agent is ready
     */
    async initializeDefaultAgentOnStartup() {
        try {
            this.debug.log('Initializing Default Agent on startup');
            
            // Check if Default Agent exists and needs integration
            const defaultAgent = this.llmManager.getAgentConfiguration('DefaultAgent');
            
            if (defaultAgent && defaultAgent.needsSystemPromptsSync) {
                this.debug.log('Default Agent needs system prompts sync, scheduling integration');
                
                // Schedule integration after a short delay to allow other components to initialize
                setTimeout(async () => {
                    try {
                        await this.initializeDefaultAgentIntegration();
                        this.debug.log('Default Agent integration completed during startup');
                    } catch (error) {
                        this.debug.error('Error during startup Default Agent integration:', error);
                    }
                }, 500);
            } else if (defaultAgent && defaultAgent.systemPrompts) {
                this.debug.log('Default Agent already has system prompts integration');
            } else {
                this.debug.log('Default Agent not found or in unexpected state during startup');
            }
            
        } catch (error) {
            this.debug.error('Error during Default Agent startup initialization:', error);
        }
    }
    
    /**
     * Load Default Agent configuration from SystemPromptsManager with migration and fallback support
     */
    async loadDefaultAgentConfiguration() {
        if (!this.systemPromptsManager) {
            this.debug.warn('SystemPromptsManager not available, attempting fallback configuration loading');
            return await this.loadDefaultAgentFallback();
        }
        
        try {
            // Attempt to migrate data with comprehensive error handling
            const migrationResult = await this.migrateDefaultAgentData();
            
            if (migrationResult.success) {
                this.debug.log('Default Agent configuration successfully migrated');
                return migrationResult;
            } else {
                this.debug.warn('Migration failed, attempting fallback:', migrationResult.error);
                return await this.loadDefaultAgentFallback();
            }
            
        } catch (error) {
            this.debug.error('Critical error during Default Agent configuration loading:', error);
            return await this.loadDefaultAgentFallback();
        }
    }
    
    /**
     * Migrate Default Agent data with comprehensive error handling and validation
     * @returns {Promise<Object>} Migration result with success status and details
     */
    async migrateDefaultAgentData() {
        const migrationResult = {
            success: false,
            error: null,
            warnings: [],
            dataSource: null,
            fallbackUsed: false
        };
        
        try {
            // Step 1: Initialize SystemPromptsManager with error handling
            let systemPromptsInitialized = false;
            try {
                await this.systemPromptsManager.init();
                systemPromptsInitialized = true;
                this.debug.log('SystemPromptsManager initialized successfully');
            } catch (initError) {
                this.debug.error('SystemPromptsManager initialization failed:', initError);
                migrationResult.warnings.push('SystemPromptsManager initialization failed: ' + initError.message);
            }
            
            // Step 2: Attempt to load system prompts data with validation
            let systemPrompts = null;
            if (systemPromptsInitialized) {
                try {
                    systemPrompts = this.systemPromptsManager.getAllPrompts();
                    
                    // Validate system prompts data structure
                    const validationResult = this.validateSystemPromptsData(systemPrompts);
                    if (!validationResult.valid) {
                        this.debug.warn('System prompts data validation failed:', validationResult.errors);
                        migrationResult.warnings.push('System prompts data validation issues: ' + validationResult.errors.join(', '));
                        
                        // Attempt to repair data
                        systemPrompts = this.repairSystemPromptsData(systemPrompts);
                        migrationResult.warnings.push('Attempted to repair corrupted system prompts data');
                    }
                    
                    migrationResult.dataSource = 'SystemPromptsManager';
                    this.debug.log('System prompts data loaded and validated');
                    
                } catch (dataError) {
                    this.debug.error('Failed to load system prompts data:', dataError);
                    migrationResult.warnings.push('Failed to load system prompts data: ' + dataError.message);
                    systemPrompts = null;
                }
            }
            
            // Step 3: Fallback to localStorage if SystemPromptsManager fails
            if (!systemPrompts) {
                try {
                    systemPrompts = this.loadSystemPromptsFromLocalStorage();
                    if (systemPrompts) {
                        migrationResult.dataSource = 'localStorage';
                        migrationResult.warnings.push('Loaded system prompts from localStorage fallback');
                        this.debug.log('Loaded system prompts from localStorage fallback');
                    }
                } catch (storageError) {
                    this.debug.error('Failed to load from localStorage:', storageError);
                    migrationResult.warnings.push('localStorage fallback failed: ' + storageError.message);
                }
            }
            
            // Step 4: Final fallback to default configuration
            if (!systemPrompts) {
                systemPrompts = this.getDefaultSystemPromptsConfiguration();
                migrationResult.dataSource = 'defaults';
                migrationResult.fallbackUsed = true;
                migrationResult.warnings.push('Using default system prompts configuration as final fallback');
                this.debug.log('Using default system prompts configuration as final fallback');
            }
            
            // Step 5: Convert to LLM Manager format with error handling
            let defaultAgentConfig;
            try {
                defaultAgentConfig = this.convertSystemPromptsToLLMManagerFormat(systemPrompts);
                this.debug.log('Successfully converted system prompts to LLM Manager format');
            } catch (conversionError) {
                this.debug.error('Failed to convert system prompts format:', conversionError);
                migrationResult.error = 'Format conversion failed: ' + conversionError.message;
                return migrationResult;
            }
            
            // Step 6: Apply configuration to LLM Manager with backup
            if (this.llmManager) {
                try {
                    // Create backup of existing configuration
                    const existingConfig = this.llmManager.getAgentConfiguration('DefaultAgent');
                    if (existingConfig) {
                        this.createConfigurationBackup('DefaultAgent', existingConfig);
                    }
                    
                    // Determine if this is an update or new configuration
                    if (existingConfig) {
                        // Merge with existing configuration, preserving LLM Manager specific settings
                        const mergedConfig = this.mergeDefaultAgentConfigurations(existingConfig, defaultAgentConfig);
                        
                        // Update the configuration
                        const updateResult = await this.llmManager.updateAgentConfiguration('DefaultAgent', mergedConfig, { 
                            skipRealTimeUpdate: true,
                            reason: 'Data migration from SystemPromptsManager'
                        });
                        
                        if (!updateResult.success) {
                            throw new Error('LLM Manager update failed: ' + updateResult.error);
                        }
                        
                        this.debug.log('Successfully updated existing Default Agent configuration');
                    } else {
                        // Create new Default Agent configuration
                        const newConfig = this.createNewDefaultAgentConfiguration(defaultAgentConfig);
                        
                        // Add to LLM Manager
                        const createResult = await this.llmManager.updateAgentConfiguration('DefaultAgent', newConfig, { 
                            skipRealTimeUpdate: true,
                            reason: 'Initial Default Agent creation from SystemPromptsManager'
                        });
                        
                        if (!createResult.success) {
                            throw new Error('LLM Manager creation failed: ' + createResult.error);
                        }
                        
                        this.debug.log('Successfully created new Default Agent configuration');
                    }
                    
                    migrationResult.success = true;
                    this.debug.log('Default Agent configuration migration completed successfully');
                    
                } catch (llmError) {
                    this.debug.error('Failed to apply configuration to LLM Manager:', llmError);
                    migrationResult.error = 'LLM Manager integration failed: ' + llmError.message;
                    
                    // Attempt to restore backup if available
                    await this.restoreConfigurationBackup('DefaultAgent');
                }
            } else {
                migrationResult.error = 'LLM Manager not available';
                this.debug.error('LLM Manager not available for configuration migration');
            }
            
        } catch (error) {
            this.debug.error('Critical error during data migration:', error);
            migrationResult.error = 'Critical migration error: ' + error.message;
        }
        
        return migrationResult;
    }
    
    /**
     * Validate system prompts data structure
     * @param {Object} systemPrompts - System prompts data to validate
     * @returns {Object} Validation result with valid flag and errors array
     */
    validateSystemPromptsData(systemPrompts) {
        const errors = [];
        
        if (!systemPrompts || typeof systemPrompts !== 'object') {
            errors.push('System prompts data is not a valid object');
            return { valid: false, errors };
        }
        
        // Check required fields
        const requiredFields = ['basePersonality', 'financialContext', 'responseInstructions'];
        requiredFields.forEach(field => {
            if (!systemPrompts[field] || typeof systemPrompts[field] !== 'string' || systemPrompts[field].trim().length === 0) {
                errors.push(`Missing, invalid, or empty ${field} field`);
            }
        });
        
        // Validate customPrompts array
        if (systemPrompts.customPrompts) {
            if (!Array.isArray(systemPrompts.customPrompts)) {
                errors.push('customPrompts must be an array');
            } else {
                systemPrompts.customPrompts.forEach((prompt, index) => {
                    if (!prompt.name || typeof prompt.name !== 'string') {
                        errors.push(`Custom prompt ${index} missing or invalid name`);
                    }
                    if (!prompt.prompt || typeof prompt.prompt !== 'string') {
                        errors.push(`Custom prompt ${index} missing or invalid prompt content`);
                    }
                });
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Repair corrupted system prompts data
     * @param {Object} systemPrompts - Potentially corrupted system prompts data
     * @returns {Object} Repaired system prompts data
     */
    repairSystemPromptsData(systemPrompts) {
        const repaired = { ...systemPrompts };
        
        // Repair missing or invalid required fields
        if (!repaired.basePersonality || typeof repaired.basePersonality !== 'string') {
            repaired.basePersonality = "You are a helpful, professional, and friendly AI voice assistant for a UK financial services company.";
        }
        
        if (!repaired.financialContext || typeof repaired.financialContext !== 'string') {
            repaired.financialContext = "When handling financial services requests, be conversational and provide helpful information about UK banking practices.";
        }
        
        if (!repaired.responseInstructions || typeof repaired.responseInstructions !== 'string') {
            repaired.responseInstructions = "Keep responses conversational and concise (suitable for voice). Use natural speech patterns and British English.";
        }
        
        // Repair customPrompts array
        if (!Array.isArray(repaired.customPrompts)) {
            repaired.customPrompts = [];
        } else {
            // Filter out invalid custom prompts
            repaired.customPrompts = repaired.customPrompts.filter(prompt => 
                prompt && 
                typeof prompt.name === 'string' && 
                typeof prompt.prompt === 'string' &&
                prompt.name.trim() !== '' &&
                prompt.prompt.trim() !== ''
            );
        }
        
        return repaired;
    }
    
    /**
     * Load system prompts from localStorage as fallback
     * @returns {Object|null} System prompts data or null if not available
     */
    loadSystemPromptsFromLocalStorage() {
        try {
            const storedPrompts = localStorage.getItem('system_prompts');
            if (storedPrompts) {
                const parsed = JSON.parse(storedPrompts);
                const validationResult = this.validateSystemPromptsData(parsed);
                
                if (validationResult.valid) {
                    return parsed;
                } else {
                    this.debug.warn('localStorage system prompts data is invalid, attempting repair');
                    return this.repairSystemPromptsData(parsed);
                }
            }
        } catch (error) {
            this.debug.error('Error loading system prompts from localStorage:', error);
        }
        
        return null;
    }
    
    /**
     * Get default system prompts configuration as final fallback
     * @returns {Object} Default system prompts configuration
     */
    getDefaultSystemPromptsConfiguration() {
        return {
            basePersonality: "You are a helpful, professional, and friendly AI voice assistant for a UK financial services company. You should be empathetic, clear in your communication, and engaging in conversation. Speak in a conversational tone while being informative and helpful.",
            financialContext: "When handling financial services requests:\n1. Be conversational and natural in your responses\n2. Provide helpful and accurate information about UK banking\n3. Ask clarifying questions when needed\n4. Be patient and understanding with customer concerns\n5. Use UK financial terminology (current account, sort code, etc.)",
            responseInstructions: "Response Guidelines:\n1. Keep responses conversational and concise (suitable for voice)\n2. Use natural speech patterns with contractions (I'll, you're, we'll)\n3. Address users in a friendly manner\n4. Sound human and empathetic, not robotic\n5. Use British English spelling and terminology",
            customPrompts: []
        };
    }
    
    /**
     * Merge existing Default Agent configuration with new system prompts data
     * @param {Object} existingConfig - Existing LLM Manager configuration
     * @param {Object} newConfig - New configuration from system prompts
     * @returns {Object} Merged configuration
     */
    mergeDefaultAgentConfigurations(existingConfig, newConfig) {
        return {
            ...existingConfig,
            ...newConfig,
            // Preserve important LLM Manager fields
            name: existingConfig.name,
            priority: existingConfig.priority,
            enabled: existingConfig.enabled,
            llmProvider: existingConfig.llmProvider,
            llmModel: existingConfig.llmModel,
            maxTokens: existingConfig.maxTokens,
            telemetryEnabled: existingConfig.telemetryEnabled,
            createdAt: existingConfig.createdAt,
            lastUpdated: new Date().toISOString(),
            lastMigrated: new Date().toISOString()
        };
    }
    
    /**
     * Create new Default Agent configuration
     * @param {Object} systemPromptsConfig - Configuration from system prompts
     * @returns {Object} New Default Agent configuration
     */
    createNewDefaultAgentConfiguration(systemPromptsConfig) {
        return {
            ...systemPromptsConfig,
            name: 'DefaultAgent',
            priority: 0,
            enabled: true,
            llmProvider: 'openai',
            llmModel: 'gpt-4',
            maxTokens: 1500,
            telemetryEnabled: true,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            lastMigrated: new Date().toISOString()
        };
    }
    
    /**
     * Create backup of existing configuration
     * @param {string} agentName - Name of the agent
     * @param {Object} config - Configuration to backup
     */
    createConfigurationBackup(agentName, config) {
        try {
            const backupKey = `llm_manager_backup_${agentName}_${Date.now()}`;
            const backupData = {
                agentName,
                config,
                timestamp: new Date().toISOString(),
                reason: 'Pre-migration backup'
            };
            
            localStorage.setItem(backupKey, JSON.stringify(backupData));
            
            // Store reference to latest backup
            localStorage.setItem(`llm_manager_latest_backup_${agentName}`, backupKey);
            
            this.debug.log(`Created configuration backup for ${agentName}:`, backupKey);
        } catch (error) {
            this.debug.error('Failed to create configuration backup:', error);
        }
    }
    
    /**
     * Restore configuration from backup
     * @param {string} agentName - Name of the agent
     * @returns {Promise<boolean>} Success status
     */
    async restoreConfigurationBackup(agentName) {
        try {
            const latestBackupKey = localStorage.getItem(`llm_manager_latest_backup_${agentName}`);
            if (!latestBackupKey) {
                this.debug.warn(`No backup found for ${agentName}`);
                return false;
            }
            
            const backupData = localStorage.getItem(latestBackupKey);
            if (!backupData) {
                this.debug.warn(`Backup data not found for key: ${latestBackupKey}`);
                return false;
            }
            
            const backup = JSON.parse(backupData);
            
            if (this.llmManager) {
                const restoreResult = await this.llmManager.updateAgentConfiguration(agentName, backup.config, {
                    skipRealTimeUpdate: true,
                    reason: 'Configuration restore from backup'
                });
                
                if (restoreResult.success) {
                    this.debug.log(`Successfully restored configuration for ${agentName} from backup`);
                    return true;
                } else {
                    this.debug.error('Failed to restore configuration:', restoreResult.error);
                }
            }
            
        } catch (error) {
            this.debug.error('Error restoring configuration backup:', error);
        }
        
        return false;
    }
    
    /**
     * Load Default Agent configuration using fallback mechanisms
     * @returns {Promise<Object>} Fallback loading result
     */
    async loadDefaultAgentFallback() {
        const fallbackResult = {
            success: false,
            error: null,
            warnings: [],
            dataSource: 'fallback',
            fallbackUsed: true
        };
        
        try {
            this.debug.log('Attempting Default Agent fallback configuration loading');
            
            // Use default configuration
            const defaultConfig = this.getDefaultSystemPromptsConfiguration();
            const defaultAgentConfig = this.convertSystemPromptsToLLMManagerFormat(defaultConfig);
            
            if (this.llmManager) {
                // Check if Default Agent already exists
                const existingConfig = this.llmManager.getAgentConfiguration('DefaultAgent');
                
                if (existingConfig) {
                    // Only update system prompts part, preserve other settings
                    const mergedConfig = {
                        ...existingConfig,
                        systemPrompts: defaultAgentConfig.systemPrompts,
                        lastUpdated: new Date().toISOString(),
                        lastFallbackUsed: new Date().toISOString()
                    };
                    
                    const updateResult = await this.llmManager.updateAgentConfiguration('DefaultAgent', mergedConfig, {
                        skipRealTimeUpdate: true,
                        reason: 'Fallback configuration loading'
                    });
                    
                    if (updateResult.success) {
                        fallbackResult.success = true;
                        this.debug.log('Successfully applied fallback configuration to existing Default Agent');
                    } else {
                        fallbackResult.error = 'Failed to apply fallback configuration: ' + updateResult.error;
                    }
                } else {
                    // Create new Default Agent with fallback configuration
                    const newConfig = this.createNewDefaultAgentConfiguration(defaultAgentConfig);
                    newConfig.lastFallbackUsed = new Date().toISOString();
                    
                    const createResult = await this.llmManager.updateAgentConfiguration('DefaultAgent', newConfig, {
                        skipRealTimeUpdate: true,
                        reason: 'Fallback Default Agent creation'
                    });
                    
                    if (createResult.success) {
                        fallbackResult.success = true;
                        this.debug.log('Successfully created Default Agent with fallback configuration');
                    } else {
                        fallbackResult.error = 'Failed to create Default Agent with fallback: ' + createResult.error;
                    }
                }
            } else {
                fallbackResult.error = 'LLM Manager not available for fallback configuration';
            }
            
        } catch (error) {
            this.debug.error('Error during fallback configuration loading:', error);
            fallbackResult.error = 'Fallback loading failed: ' + error.message;
        }
        
        return fallbackResult;
    }
    
    /**
     * Ensure Default Agent is loaded and available in LLM Manager
     * @returns {Promise<boolean>} True if Default Agent is available
     */
    async ensureDefaultAgentLoaded() {
        if (!this.llmManager) {
            this.debug.warn('LLM Manager not available');
            return false;
        }
        
        try {
            // Check if Default Agent already exists and is properly integrated
            const existingConfig = this.llmManager.getAgentConfiguration('DefaultAgent');
            
            if (existingConfig && existingConfig.systemPrompts && existingConfig.lastSyncedFromSystemPrompts) {
                this.debug.log('Default Agent already loaded and integrated');
                return true;
            }
            
            // Initialize Default Agent integration
            const initResult = await this.initializeDefaultAgentIntegration();
            
            if (initResult) {
                // Verify it was loaded and integrated properly
                const verifyConfig = this.llmManager.getAgentConfiguration('DefaultAgent');
                if (verifyConfig && verifyConfig.systemPrompts) {
                    this.debug.log('Default Agent successfully loaded and integrated');
                    return true;
                } else {
                    this.debug.warn('Default Agent failed to load with proper integration');
                    return false;
                }
            } else {
                this.debug.warn('Default Agent integration initialization failed');
                return false;
            }
            
        } catch (error) {
            this.debug.error('Error ensuring Default Agent is loaded:', error);
            return false;
        }
    }
    
    /**
     * Convert system prompts format to LLM Manager format
     * @param {Object} systemPrompts - System prompts data
     * @returns {Object} LLM Manager compatible configuration
     */
    convertSystemPromptsToLLMManagerFormat(systemPrompts) {
        return {
            description: 'Primary AI assistant for general banking inquiries (configured via System Prompts)',
            systemPrompts: {
                basePersonality: systemPrompts.basePersonality || '',
                financialContext: systemPrompts.financialContext || '',
                responseInstructions: systemPrompts.responseInstructions || '',
                customPrompts: systemPrompts.customPrompts || []
            },
            triggers: [], // Default Agent has no specific triggers - acts as fallback
            lastSyncedFromSystemPrompts: new Date().toISOString()
        };
    }
    
    /**
     * Convert LLM Manager format back to system prompts format
     * @param {Object} llmConfig - LLM Manager configuration
     * @returns {Object} System prompts compatible data
     */
    convertLLMManagerToSystemPromptsFormat(llmConfig) {
        if (!llmConfig.systemPrompts) {
            return {
                basePersonality: '',
                financialContext: '',
                responseInstructions: '',
                customPrompts: []
            };
        }
        
        return {
            basePersonality: llmConfig.systemPrompts.basePersonality || '',
            financialContext: llmConfig.systemPrompts.financialContext || '',
            responseInstructions: llmConfig.systemPrompts.responseInstructions || '',
            customPrompts: llmConfig.systemPrompts.customPrompts || []
        };
    }
    
    /**
     * Switch between main sections
     */
    async switchSection(sectionName) {
        // Check if we're in the new interface structure
        if (!document.querySelector(`[data-section="${sectionName}"]`)) {
            this.debug.warn('switchSection called but elements not found - likely in new interface');
            return;
        }
        
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const targetNavBtn = document.querySelector(`[data-section="${sectionName}"]`);
        if (targetNavBtn) {
            targetNavBtn.classList.add('active');
        }
        
        // Update content
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionName}-section`).classList.add('active');
        
        // Load section-specific content
        await this.loadSectionContent(sectionName);
    }
    
    /**
     * Load content for specific section
     */
    async loadSectionContent(sectionName) {
        switch (sectionName) {
            case 'overview':
                this.refreshAgentData();
                break;
            case 'configuration':
                await this.loadConfigurationContent();
                break;
            case 'guardrails':
                await this.loadGuardrailsContent();
                break;
            case 'voice':
                await this.loadVoiceContent();
                break;
            case 'audit':
                this.refreshAuditLog();
                break;
        }
    }
    
    /**
     * Load configuration content
     */
    async loadConfigurationContent() {
        const content = document.getElementById('configurationContent');
        if (!content) return;
        
        // Ensure Default Agent is loaded before getting configurations
        await this.ensureDefaultAgentLoaded();
        
        const agents = this.llmManager.getAgentConfigurations();
        
        // Sort agents to put Default Agent first
        const sortedAgentNames = Object.keys(agents).sort((a, b) => {
            if (a === 'DefaultAgent') return -1;
            if (b === 'DefaultAgent') return 1;
            return a.localeCompare(b);
        });
        
        content.innerHTML = `
            <div class="form-group">
                <label class="form-label">Select Agent to Configure</label>
                <select class="form-select" id="configAgentSelect" onchange="adminUI.openAgentConfiguration(this.value)">
                    <option value="">Choose an agent...</option>
                    ${sortedAgentNames.map(name => 
                        `<option value="${name}">${name}${name === 'DefaultAgent' ? ' (Primary Agent)' : ''}</option>`
                    ).join('')}
                </select>
            </div>
            
            <div class="agent-config-info">
                <h4>Configuration Management</h4>
                <ul class="feature-list">
                    <li>Modify agent settings and parameters</li>
                    <li>Configure LLM provider and model settings</li>
                    <li>Manage trigger keywords and priorities</li>
                    <li>Enable/disable agents and telemetry</li>
                    <li>View configuration history and metadata</li>
                    <li><strong>Default Agent:</strong> Primary fallback agent for general banking inquiries</li>
                </ul>
                <p style="margin-top: 15px; color: #7f8c8d;">
                    Select an agent from the dropdown above to open the configuration modal with detailed settings.
                    The Default Agent serves as the primary fallback for general banking inquiries.
                </p>
            </div>
        `;
    }
    
    /**
     * Refresh agent data and update overview
     */
    refreshAgentData() {
        if (!this.llmManager) return;
        
        try {
            // Ensure Default Agent is loaded first
            this.ensureDefaultAgentLoaded().then(() => {
                const stats = this.llmManager.getConfigurationStats();
                const agents = this.llmManager.getAgentConfigurations();
                
                // Update statistics (safely)
                const totalAgentsEl = document.getElementById('totalAgents');
                const enabledAgentsEl = document.getElementById('enabledAgents');
                const disabledAgentsEl = document.getElementById('disabledAgents');
                const lastUpdatedEl = document.getElementById('lastUpdated');
                
                if (totalAgentsEl) totalAgentsEl.textContent = stats.totalAgents;
                if (enabledAgentsEl) enabledAgentsEl.textContent = stats.enabledAgents;
                if (disabledAgentsEl) disabledAgentsEl.textContent = stats.disabledAgents;
                if (lastUpdatedEl) lastUpdatedEl.textContent = 
                    stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'Never';
                
                // Update agent grid
                this.renderAgentGrid(agents);
                
                this.logAuditEvent('system', 'Agent data refreshed');
                
            }).catch(error => {
                this.debug.error('Failed to ensure Default Agent loaded:', error);
                // Continue with refresh even if Default Agent loading fails
                const stats = this.llmManager.getConfigurationStats();
                const agents = this.llmManager.getAgentConfigurations();
                
                // Update statistics (safely)
                const totalAgentsEl = document.getElementById('totalAgents');
                const enabledAgentsEl = document.getElementById('enabledAgents');
                const disabledAgentsEl = document.getElementById('disabledAgents');
                const lastUpdatedEl = document.getElementById('lastUpdated');
                
                if (totalAgentsEl) totalAgentsEl.textContent = stats.totalAgents;
                if (enabledAgentsEl) enabledAgentsEl.textContent = stats.enabledAgents;
                if (disabledAgentsEl) disabledAgentsEl.textContent = stats.disabledAgents;
                if (lastUpdatedEl) lastUpdatedEl.textContent = 
                    stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'Never';
                
                // Update agent grid
                this.renderAgentGrid(agents);
                
                this.logAuditEvent('system', 'Agent data refreshed (with Default Agent loading error)');
            });
            
        } catch (error) {
            this.debug.error('Failed to refresh agent data:', error);
            this.showError('Failed to refresh agent data');
        }
    }
    
    /**
     * Render agent grid
     */
    renderAgentGrid(agents) {
        const grid = document.getElementById('agentsGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        Object.entries(agents).forEach(([name, config]) => {
            const card = this.createAgentCard(name, config);
            grid.appendChild(card);
        });
    }
    
    /**
     * Create agent card element
     */
    createAgentCard(name, config) {
        const card = document.createElement('div');
        card.className = 'agent-card';
        
        const statusClass = config.enabled !== false ? 'enabled' : 'disabled';
        const statusText = config.enabled !== false ? 'Enabled' : 'Disabled';
        const statusIndicator = config.enabled !== false ? 'online' : 'offline';
        
        // Special handling for Default Agent
        const isDefaultAgent = name === 'DefaultAgent';
        const agentIcon = isDefaultAgent ? '🤖' : this.getAgentIcon(name);
        
        // Show additional info for Default Agent
        let additionalDetails = '';
        if (isDefaultAgent && config.systemPrompts) {
            const customPromptsCount = config.systemPrompts.customPrompts ? config.systemPrompts.customPrompts.length : 0;
            additionalDetails = `
                <div class="detail-item">
                    <span class="detail-label">Custom Prompts:</span>
                    <span class="detail-value">${customPromptsCount}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Last Synced:</span>
                    <span class="detail-value">${config.lastSyncedFromSystemPrompts ? 
                        new Date(config.lastSyncedFromSystemPrompts).toLocaleString() : 'Never'}</span>
                </div>
            `;
        }
        
        card.innerHTML = `
            <div class="agent-header">
                <div class="agent-name">
                    <span class="status-indicator ${statusIndicator}"></span>
                    ${agentIcon} ${name}
                </div>
                <div class="agent-status ${statusClass}">${statusText}</div>
            </div>
            
            <div class="agent-description">
                ${config.description || 'No description available'}
            </div>
            
            <div class="agent-details">
                <div class="detail-item">
                    <span class="detail-label">Provider:</span>
                    <span class="detail-value">${config.llmProvider || 'openai'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Model:</span>
                    <span class="detail-value">${config.llmModel || 'gpt-4'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Priority:</span>
                    <span class="detail-value">${config.priority !== undefined ? config.priority : 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Max Tokens:</span>
                    <span class="detail-value">${config.maxTokens || 'N/A'}</span>
                </div>
                ${additionalDetails}
            </div>
            
            <div class="agent-actions">
                <button class="btn btn-primary" onclick="openAgentConfiguration('${name}')">
                    ⚙️ Configure
                </button>
                <button class="btn btn-secondary" onclick="openGuardrailsEditor('${name}')">
                    🛡️ Guardrails
                </button>
                <button class="btn btn-warning" onclick="openVoiceConfig('${name}')">
                    🎤 Voice
                </button>
                <button class="btn ${statusClass === 'enabled' ? 'btn-danger' : 'btn-success'}" 
                        onclick="toggleAgent('${name}')">
                    ${statusClass === 'enabled' ? '⏸️ Disable' : '▶️ Enable'}
                </button>
                ${isDefaultAgent ? `
                <button class="btn btn-info" onclick="syncDefaultAgentFromSystemPrompts()">
                    🔄 Sync from System Prompts
                </button>
                ` : ''}
            </div>
        `;
        
        return card;
    }
    
    /**
     * Get appropriate icon for agent type
     * @param {string} agentName - Name of the agent
     * @returns {string} Icon emoji
     */
    getAgentIcon(agentName) {
        const iconMap = {
            'DefaultAgent': '🤖',
            'IDVAgent': '🔐',
            'BankingInfoAgent': '🏦',
            'FraudAgent': '🛡️',
            'PaymentsAgent': '💳'
        };
        
        return iconMap[agentName] || '⚙️';
    }
    
    /**
     * Render custom prompts list for Default Agent
     * @param {Array} customPrompts - Array of custom prompts
     * @returns {string} HTML string for custom prompts
     */
    renderCustomPromptsList(customPrompts) {
        if (!customPrompts || customPrompts.length === 0) {
            return '<p style="color: #7f8c8d; font-style: italic;">No custom prompts configured</p>';
        }
        
        return customPrompts.map((prompt, index) => `
            <div class="custom-prompt-item" style="border: 1px solid #e1e8ed; border-radius: 6px; padding: 15px; margin-bottom: 10px;">
                <div class="form-group">
                    <label class="form-label">Prompt Name <span style="color: #e74c3c;">*</span></label>
                    <input type="text" class="form-input" value="${this.escapeHtml(prompt.name || '')}" 
                           data-custom-prompt-index="${index}" data-field="name" maxlength="100" required
                           placeholder="Enter prompt name (max 100 characters)...">
                    <div class="validation-message" style="color: #e74c3c; font-size: 0.8em; margin-top: 5px; display: none;"></div>
                </div>
                <div class="form-group">
                    <label class="form-label">Prompt Content <span style="color: #e74c3c;">*</span></label>
                    <textarea class="form-textarea" rows="3" 
                              data-custom-prompt-index="${index}" data-field="prompt" maxlength="1000" required
                              placeholder="Enter prompt content (max 1000 characters)...">${this.escapeHtml(prompt.prompt || '')}</textarea>
                    <div class="char-counter" style="color: #7f8c8d; font-size: 0.8em; text-align: right; margin-top: 5px;">${(prompt.prompt || '').length}/1000</div>
                    <div class="validation-message" style="color: #e74c3c; font-size: 0.8em; margin-top: 5px; display: none;"></div>
                </div>
                <button type="button" class="btn btn-danger btn-sm" onclick="removeDefaultAgentCustomPrompt(this)">
                    🗑️ Remove
                </button>
            </div>
        `).join('');
    }
    
    /**
     * Escape HTML characters to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Sync Default Agent configuration from SystemPromptsManager
     */
    async syncDefaultAgentFromSystemPrompts() {
        if (!this.systemPromptsManager) {
            this.showError('SystemPromptsManager not available');
            return;
        }
        
        try {
            // Reload system prompts
            await this.systemPromptsManager.init();
            
            // Get fresh system prompts data
            const systemPrompts = this.systemPromptsManager.getAllPrompts();
            
            // Convert to LLM Manager format
            const defaultAgentConfig = this.convertSystemPromptsToLLMManagerFormat(systemPrompts);
            
            // Get current Default Agent configuration
            const currentConfig = this.llmManager.getAgentConfiguration('DefaultAgent');
            
            if (currentConfig) {
                // Merge with current configuration
                const updatedConfig = {
                    ...currentConfig,
                    ...defaultAgentConfig,
                    lastSyncedFromSystemPrompts: new Date().toISOString()
                };
                
                // Update the configuration
                await this.llmManager.updateAgentConfiguration('DefaultAgent', updatedConfig, { skipRealTimeUpdate: true });
                
                // If configuration modal is open for Default Agent, reload the forms
                if (this.currentAgent === 'DefaultAgent') {
                    this.loadConfigurationForms(updatedConfig);
                }
                
                // Refresh the agent grid
                this.refreshAgentData();
                
                this.showSuccess('Default Agent configuration synced from System Prompts Manager');
                this.logAuditEvent('config', 'Synced Default Agent from System Prompts Manager');
            }
            
        } catch (error) {
            this.debug.error('Error syncing Default Agent from System Prompts:', error);
            this.showError('Failed to sync Default Agent configuration: ' + error.message);
        }
    }
    
    /**
     * Open agent configuration modal
     */
    /**
     * Open agent configuration with enhanced error handling
     * @param {string} agentName - Name of the agent to configure
     */
    async openAgentConfiguration(agentName) {
        try {
            this.currentAgent = agentName;
            
            // Use enhanced loading method
            const loadSuccess = await this.loadAgentConfigurationEnhanced(agentName);
            
            if (!loadSuccess) {
                this.debug.error(`Failed to load configuration for agent: ${agentName}`);
                return;
            }
            
            // Update modal title
            const modalTitle = document.querySelector('#configModal .modal-title');
            if (modalTitle) {
                modalTitle.textContent = `Configure ${agentName}`;
            }
            
            // Show modal
            this.showModal('configModal');
            
            this.logAuditEvent('config', `Opened configuration for ${agentName}`);
            
        } catch (error) {
            this.debug.error('Error opening agent configuration:', error);
            this.showError('Failed to open agent configuration: ' + error.message);
        }
    }
    
    /**
     * Load configuration forms
     */
    loadConfigurationForms(config) {
        const isDefaultAgent = config.name === 'DefaultAgent';
        
        // Basic Settings Tab - add system prompts fields for Default Agent
        let basicTabContent = `
            <div class="form-group">
                <label class="form-label">Agent Name</label>
                <input type="text" class="form-input" id="agentName" value="${config.name || ''}" readonly>
            </div>
            
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-textarea" id="agentDescription" rows="3">${config.description || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label class="form-label">Priority</label>
                <input type="number" class="form-input" id="agentPriority" value="${config.priority !== undefined ? config.priority : 1}" min="0" max="10">
            </div>
            
            <div class="form-group">
                <label class="form-label">Status</label>
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Agent Enabled</div>
                        <div class="toggle-description">Enable or disable this agent</div>
                    </div>
                    <div class="toggle-switch ${config.enabled !== false ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-field="enabled"></div>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Telemetry</label>
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Telemetry Enabled</div>
                        <div class="toggle-description">Enable telemetry and logging</div>
                    </div>
                    <div class="toggle-switch ${config.telemetryEnabled !== false ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-field="telemetryEnabled"></div>
                </div>
            </div>
        `;
        
        // Add system prompts fields for Default Agent
        if (isDefaultAgent && config.systemPrompts) {
            basicTabContent += `
                <hr style="margin: 20px 0; border: 1px solid #e1e8ed;">
                <h4 style="color: #2c3e50; margin-bottom: 15px;">🤖 System Prompts Configuration</h4>
                
                <div class="form-group">
                    <label class="form-label">Base AI Personality</label>
                    <textarea class="form-textarea" id="defaultBasePersonality" rows="4" 
                              placeholder="Define the default agent's core personality...">${config.systemPrompts.basePersonality || ''}</textarea>
                    <small style="color: #7f8c8d;">Core personality traits and behavior patterns for the AI assistant</small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Financial Services Context</label>
                    <textarea class="form-textarea" id="defaultFinancialContext" rows="6" 
                              placeholder="Context for financial operations...">${config.systemPrompts.financialContext || ''}</textarea>
                    <small style="color: #7f8c8d;">Banking-specific instructions and UK financial services context</small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Response Instructions</label>
                    <textarea class="form-textarea" id="defaultResponseInstructions" rows="4" 
                              placeholder="Guidelines for response formatting...">${config.systemPrompts.responseInstructions || ''}</textarea>
                    <small style="color: #7f8c8d;">Instructions for response format, tone, and conversation flow</small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Custom Scenario Prompts</label>
                    <div id="defaultCustomPromptsList">
                        ${this.renderCustomPromptsList(config.systemPrompts.customPrompts || [])}
                    </div>
                    <button type="button" class="btn btn-success btn-sm" onclick="addDefaultAgentCustomPrompt()">
                        ➕ Add Custom Prompt
                    </button>
                    <small style="color: #7f8c8d; display: block; margin-top: 5px;">
                        Scenario-specific prompts for handling particular types of inquiries
                    </small>
                </div>
                
                <div class="form-group">
                    <button type="button" class="btn btn-info" onclick="syncDefaultAgentFromSystemPrompts()">
                        🔄 Sync from System Prompts Manager
                    </button>
                    <small style="color: #7f8c8d; display: block; margin-top: 5px;">
                        Load latest configuration from the System Prompts Manager
                    </small>
                </div>
            `;
        }
        
        document.getElementById('basic-tab').innerHTML = basicTabContent;
        
        // LLM Configuration Tab
        document.getElementById('llm-tab').innerHTML = `
            <div class="form-group">
                <label class="form-label">LLM Provider</label>
                <select class="form-select" id="llmProvider">
                    <option value="openai" ${config.llmProvider === 'openai' ? 'selected' : ''}>OpenAI</option>
                    <option value="claude" ${config.llmProvider === 'claude' ? 'selected' : ''}>Claude</option>
                    <option value="bedrock" ${config.llmProvider === 'bedrock' ? 'selected' : ''}>AWS Bedrock</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Model</label>
                <input type="text" class="form-input" id="llmModel" value="${config.llmModel || 'gpt-4'}">
            </div>
            
            <div class="form-group">
                <label class="form-label">Max Tokens</label>
                <input type="number" class="form-input" id="maxTokens" value="${config.maxTokens || 1000}" min="100" max="4000">
            </div>
            
            <div class="form-group">
                <label class="form-label">Temperature</label>
                <input type="range" class="form-input" id="temperature" value="${config.temperature || 0.7}" 
                       min="0" max="2" step="0.1" oninput="document.getElementById('tempValue').textContent = this.value">
                <span id="tempValue">${config.temperature || 0.7}</span>
            </div>
        `;
        
        // Triggers Tab
        const triggers = config.triggers || [];
        document.getElementById('triggers-tab').innerHTML = `
            <div class="form-group">
                <label class="form-label">Trigger Keywords</label>
                <div id="triggersList">
                    ${triggers.map((trigger, index) => `
                        <div class="trigger-item" style="display: flex; gap: 10px; margin-bottom: 10px;">
                            <input type="text" class="form-input" value="${trigger}" data-trigger-index="${index}">
                            <button class="btn btn-danger" onclick="this.parentElement.remove()">Remove</button>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-success" onclick="addTrigger()">Add Trigger</button>
            </div>
            
            <div class="form-group">
                <label class="form-label">Trigger Description</label>
                <p style="color: #7f8c8d; font-size: 0.9em;">
                    Keywords that will activate this agent when detected in user input.
                </p>
            </div>
        `;
        
        // Advanced Tab
        document.getElementById('advanced-tab').innerHTML = `
            <div class="form-group">
                <label class="form-label">Created At</label>
                <input type="text" class="form-input" value="${config.createdAt ? new Date(config.createdAt).toLocaleString() : 'Unknown'}" readonly>
            </div>
            
            <div class="form-group">
                <label class="form-label">Last Updated</label>
                <input type="text" class="form-input" value="${config.lastUpdated ? new Date(config.lastUpdated).toLocaleString() : 'Never'}" readonly>
            </div>
            
            <div class="form-group">
                <label class="form-label">Configuration JSON</label>
                <textarea class="form-textarea" rows="10" readonly>${JSON.stringify(config, null, 2)}</textarea>
            </div>
        `;
        
        // Initialize validation for custom prompts if this is the Default Agent
        if (isDefaultAgent) {
            // Use setTimeout to ensure DOM is fully updated
            setTimeout(() => {
                this.initializeCustomPromptsValidation();
            }, 100);
        }
    }
    
    /**
     * Initialize validation for all existing custom prompts
     */
    initializeCustomPromptsValidation() {
        const customPromptsContainer = document.getElementById('defaultCustomPromptsList');
        if (!customPromptsContainer) return;
        
        const promptItems = customPromptsContainer.querySelectorAll('.custom-prompt-item');
        promptItems.forEach(promptItem => {
            this.addCustomPromptValidation(promptItem);
        });
    }
    
    /**
     * Add trigger input field
     */
    addTrigger() {
        const triggersList = document.getElementById('triggersList');
        const triggerCount = triggersList.children.length;
        
        const triggerItem = document.createElement('div');
        triggerItem.className = 'trigger-item';
        triggerItem.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px;';
        triggerItem.innerHTML = `
            <input type="text" class="form-input" placeholder="Enter trigger keyword" data-trigger-index="${triggerCount}">
            <button class="btn btn-danger" onclick="this.parentElement.remove()">Remove</button>
        `;
        
        triggersList.appendChild(triggerItem);
    }
    
    /**
     * Save agent configuration with enhanced error handling and validation
     */
    async saveAgentConfiguration() {
        if (!this.currentAgent) {
            this.showError('No agent selected for configuration save');
            return false;
        }
        
        // Use the enhanced save method with comprehensive error handling
        return await this.saveAgentConfigurationEnhanced(this.currentAgent);
    }
    
    /**
     * Collect custom prompts from Default Agent configuration form
     * @returns {Array} Array of custom prompts
     */
    collectDefaultAgentCustomPrompts() {
        const customPrompts = [];
        const promptItems = document.querySelectorAll('.custom-prompt-item');
        
        promptItems.forEach((item, index) => {
            const nameInput = item.querySelector('[data-field="name"]');
            const promptTextarea = item.querySelector('[data-field="prompt"]');
            
            if (nameInput && promptTextarea && nameInput.value.trim() && promptTextarea.value.trim()) {
                customPrompts.push({
                    id: Date.now() + index, // Simple unique ID
                    name: nameInput.value.trim(),
                    prompt: promptTextarea.value.trim()
                });
            }
        });
        
        return customPrompts;
    }
    
    /**
     * Validate agent configuration form data
     * @returns {Object} Validation result with isValid flag and errors array
     */
    validateAgentConfiguration() {
        const errors = [];
        
        try {
            // Validate basic fields
            const name = document.getElementById('agentName')?.value?.trim();
            const description = document.getElementById('agentDescription')?.value?.trim();
            const priority = document.getElementById('agentPriority')?.value;
            const llmProvider = document.getElementById('llmProvider')?.value;
            const llmModel = document.getElementById('llmModel')?.value;
            const maxTokens = document.getElementById('maxTokens')?.value;
            const temperature = document.getElementById('temperature')?.value;
            
            // Required field validation
            if (!name) {
                errors.push('Agent name is required');
            } else if (name.length < 2) {
                errors.push('Agent name must be at least 2 characters long');
            } else if (name.length > 50) {
                errors.push('Agent name must be less than 50 characters');
            }
            
            if (!description) {
                errors.push('Agent description is required');
            } else if (description.length < 10) {
                errors.push('Agent description must be at least 10 characters long');
            } else if (description.length > 500) {
                errors.push('Agent description must be less than 500 characters');
            }
            
            // Numeric field validation
            if (priority === '' || priority === null || priority === undefined) {
                errors.push('Priority is required');
            } else {
                const priorityNum = parseInt(priority);
                if (isNaN(priorityNum) || priorityNum < 0 || priorityNum > 10) {
                    errors.push('Priority must be a number between 0 and 10');
                }
            }
            
            if (!llmProvider) {
                errors.push('LLM Provider is required');
            }
            
            if (!llmModel) {
                errors.push('LLM Model is required');
            }
            
            if (maxTokens === '' || maxTokens === null || maxTokens === undefined) {
                errors.push('Max Tokens is required');
            } else {
                const maxTokensNum = parseInt(maxTokens);
                if (isNaN(maxTokensNum) || maxTokensNum < 1 || maxTokensNum > 8000) {
                    errors.push('Max Tokens must be a number between 1 and 8000');
                }
            }
            
            if (temperature === '' || temperature === null || temperature === undefined) {
                errors.push('Temperature is required');
            } else {
                const temperatureNum = parseFloat(temperature);
                if (isNaN(temperatureNum) || temperatureNum < 0 || temperatureNum > 2) {
                    errors.push('Temperature must be a number between 0 and 2');
                }
            }
            
        } catch (error) {
            this.debug.error('Error during validation:', error);
            errors.push('Validation error: ' + error.message);
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Validate Default Agent system prompts configuration
     * @param {Object} systemPrompts - System prompts configuration
     * @returns {Object} Validation result with isValid flag and errors array
     */
    validateDefaultAgentSystemPrompts(systemPrompts) {
        const errors = [];
        
        try {
            // Validate base personality
            if (!systemPrompts.basePersonality || systemPrompts.basePersonality.trim().length === 0) {
                errors.push('Base AI Personality is required');
            } else if (systemPrompts.basePersonality.trim().length < 20) {
                errors.push('Base AI Personality must be at least 20 characters long');
            } else if (systemPrompts.basePersonality.trim().length > 2000) {
                errors.push('Base AI Personality must be less than 2000 characters');
            }
            
            // Validate financial context
            if (!systemPrompts.financialContext || systemPrompts.financialContext.trim().length === 0) {
                errors.push('Financial Services Context is required');
            } else if (systemPrompts.financialContext.trim().length < 20) {
                errors.push('Financial Services Context must be at least 20 characters long');
            } else if (systemPrompts.financialContext.trim().length > 3000) {
                errors.push('Financial Services Context must be less than 3000 characters');
            }
            
            // Validate response instructions
            if (!systemPrompts.responseInstructions || systemPrompts.responseInstructions.trim().length === 0) {
                errors.push('Response Instructions are required');
            } else if (systemPrompts.responseInstructions.trim().length < 10) {
                errors.push('Response Instructions must be at least 10 characters long');
            } else if (systemPrompts.responseInstructions.trim().length > 1500) {
                errors.push('Response Instructions must be less than 1500 characters');
            }
            
            // Validate custom prompts
            if (systemPrompts.customPrompts && Array.isArray(systemPrompts.customPrompts)) {
                if (systemPrompts.customPrompts.length > 20) {
                    errors.push('Maximum of 20 custom prompts allowed');
                }
                
                systemPrompts.customPrompts.forEach((prompt, index) => {
                    if (!prompt.name || prompt.name.trim().length === 0) {
                        errors.push(`Custom prompt ${index + 1}: Name is required`);
                    } else if (prompt.name.trim().length > 100) {
                        errors.push(`Custom prompt ${index + 1}: Name must be less than 100 characters`);
                    }
                    
                    if (!prompt.prompt || prompt.prompt.trim().length === 0) {
                        errors.push(`Custom prompt ${index + 1}: Content is required`);
                    } else if (prompt.prompt.trim().length < 5) {
                        errors.push(`Custom prompt ${index + 1}: Content must be at least 5 characters long`);
                    } else if (prompt.prompt.trim().length > 1000) {
                        errors.push(`Custom prompt ${index + 1}: Content must be less than 1000 characters`);
                    }
                });
                
                // Check for duplicate custom prompt names
                const promptNames = systemPrompts.customPrompts.map(p => p.name.trim().toLowerCase());
                const duplicateNames = promptNames.filter((name, index) => promptNames.indexOf(name) !== index);
                if (duplicateNames.length > 0) {
                    errors.push('Custom prompt names must be unique');
                }
            }
            
        } catch (error) {
            this.debug.error('Error during system prompts validation:', error);
            errors.push('System prompts validation error: ' + error.message);
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Update SystemPromptsManager with new configuration
     * @param {Object} systemPrompts - System prompts configuration
     */
    async updateSystemPromptsManager(systemPrompts) {
        if (!this.systemPromptsManager) {
            throw new Error('SystemPromptsManager not available');
        }
        
        try {
            // Ensure SystemPromptsManager is initialized
            await this.systemPromptsManager.init();
            
            // Update each field
            this.systemPromptsManager.updateBasePersonality(systemPrompts.basePersonality);
            this.systemPromptsManager.updateFinancialContext(systemPrompts.financialContext);
            this.systemPromptsManager.updateResponseInstructions(systemPrompts.responseInstructions);
            this.systemPromptsManager.updateCustomPrompts(systemPrompts.customPrompts);
            
            this.debug.log('Successfully updated SystemPromptsManager');
            
        } catch (error) {
            this.debug.error('Failed to update SystemPromptsManager:', error);
            throw new Error('Failed to sync with System Prompts Manager: ' + error.message);
        }
    }
    
    /**
     * Add a new custom prompt to Default Agent configuration
     */
    addDefaultAgentCustomPrompt() {
        const customPromptsContainer = document.getElementById('defaultCustomPromptsList');
        if (!customPromptsContainer) {
            this.debug.warn('Custom prompts container not found');
            return;
        }
        
        // Check maximum limit
        const currentPrompts = customPromptsContainer.querySelectorAll('.custom-prompt-item').length;
        if (currentPrompts >= 20) {
            this.showError('Maximum of 20 custom prompts allowed');
            return;
        }
        
        // Remove "no prompts" message if it exists
        const noPromptsMessage = customPromptsContainer.querySelector('p[style*="italic"]');
        if (noPromptsMessage) {
            noPromptsMessage.remove();
        }
        
        const promptIndex = customPromptsContainer.children.length;
        const promptItem = document.createElement('div');
        promptItem.className = 'custom-prompt-item';
        promptItem.style.cssText = 'border: 1px solid #e1e8ed; border-radius: 6px; padding: 15px; margin-bottom: 10px;';
        
        promptItem.innerHTML = `
            <div class="form-group">
                <label class="form-label">Prompt Name <span style="color: #e74c3c;">*</span></label>
                <input type="text" class="form-input" placeholder="Enter prompt name (max 100 characters)..." 
                       data-custom-prompt-index="${promptIndex}" data-field="name" maxlength="100" required>
                <div class="validation-message" style="color: #e74c3c; font-size: 0.8em; margin-top: 5px; display: none;"></div>
            </div>
            <div class="form-group">
                <label class="form-label">Prompt Content <span style="color: #e74c3c;">*</span></label>
                <textarea class="form-textarea" rows="3" placeholder="Enter prompt content (max 1000 characters)..."
                          data-custom-prompt-index="${promptIndex}" data-field="prompt" maxlength="1000" required></textarea>
                <div class="char-counter" style="color: #7f8c8d; font-size: 0.8em; text-align: right; margin-top: 5px;">0/1000</div>
                <div class="validation-message" style="color: #e74c3c; font-size: 0.8em; margin-top: 5px; display: none;"></div>
            </div>
            <button type="button" class="btn btn-danger btn-sm" onclick="adminUI.removeDefaultAgentCustomPrompt(this)">
                🗑️ Remove
            </button>
        `;
        
        customPromptsContainer.appendChild(promptItem);
        
        // Add validation event listeners
        this.addCustomPromptValidation(promptItem);
        
        // Focus on the name input
        const nameInput = promptItem.querySelector('[data-field="name"]');
        if (nameInput) {
            nameInput.focus();
        }
        
        this.debug.log('Added new custom prompt field');
    }
    
    /**
     * Remove a custom prompt from Default Agent configuration
     * @param {HTMLElement} buttonElement - The remove button that was clicked
     */
    removeDefaultAgentCustomPrompt(buttonElement) {
        const promptItem = buttonElement.closest('.custom-prompt-item');
        if (promptItem) {
            promptItem.remove();
            this.debug.log('Removed custom prompt field');
            
            // Show "no prompts" message if no prompts left
            const customPromptsContainer = document.getElementById('defaultCustomPromptsList');
            if (customPromptsContainer && customPromptsContainer.querySelectorAll('.custom-prompt-item').length === 0) {
                customPromptsContainer.innerHTML = '<p style="color: #7f8c8d; font-style: italic;">No custom prompts configured</p>';
            }
        }
    }
    
    /**
     * Add validation to custom prompt fields
     * @param {HTMLElement} promptItem - The prompt item element
     */
    addCustomPromptValidation(promptItem) {
        const nameInput = promptItem.querySelector('[data-field="name"]');
        const promptTextarea = promptItem.querySelector('[data-field="prompt"]');
        const charCounter = promptItem.querySelector('.char-counter');
        
        if (nameInput) {
            // Name validation
            nameInput.addEventListener('input', (e) => {
                this.validateCustomPromptName(e.target);
            });
            
            nameInput.addEventListener('blur', (e) => {
                this.validateCustomPromptName(e.target);
            });
        }
        
        if (promptTextarea) {
            // Content validation and character counter
            promptTextarea.addEventListener('input', (e) => {
                this.validateCustomPromptContent(e.target);
                this.updateCharCounter(e.target, charCounter);
            });
            
            promptTextarea.addEventListener('blur', (e) => {
                this.validateCustomPromptContent(e.target);
            });
        }
    }
    
    /**
     * Validate custom prompt name
     * @param {HTMLInputElement} input - The name input element
     */
    validateCustomPromptName(input) {
        const validationMessage = input.parentElement.querySelector('.validation-message');
        const value = input.value.trim();
        
        // Clear previous validation
        input.style.borderColor = '';
        validationMessage.style.display = 'none';
        validationMessage.textContent = '';
        
        if (!value) {
            this.showValidationError(input, validationMessage, 'Prompt name is required');
            return false;
        }
        
        if (value.length > 100) {
            this.showValidationError(input, validationMessage, 'Prompt name must be 100 characters or less');
            return false;
        }
        
        // Check for duplicate names
        const container = document.getElementById('defaultCustomPromptsList');
        if (container) {
            const allNameInputs = container.querySelectorAll('[data-field="name"]');
            const duplicates = Array.from(allNameInputs).filter(inp => 
                inp !== input && inp.value.trim().toLowerCase() === value.toLowerCase()
            );
            
            if (duplicates.length > 0) {
                this.showValidationError(input, validationMessage, 'Prompt name must be unique');
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Validate custom prompt content
     * @param {HTMLTextAreaElement} textarea - The content textarea element
     */
    validateCustomPromptContent(textarea) {
        const validationMessage = textarea.parentElement.querySelector('.validation-message');
        const value = textarea.value.trim();
        
        // Clear previous validation
        textarea.style.borderColor = '';
        validationMessage.style.display = 'none';
        validationMessage.textContent = '';
        
        if (!value) {
            this.showValidationError(textarea, validationMessage, 'Prompt content is required');
            return false;
        }
        
        if (value.length < 5) {
            this.showValidationError(textarea, validationMessage, 'Prompt content must be at least 5 characters long');
            return false;
        }
        
        if (value.length > 1000) {
            this.showValidationError(textarea, validationMessage, 'Prompt content must be 1000 characters or less');
            return false;
        }
        
        return true;
    }
    
    /**
     * Show validation error for a field
     * @param {HTMLElement} field - The form field element
     * @param {HTMLElement} messageElement - The validation message element
     * @param {string} message - The error message
     */
    showValidationError(field, messageElement, message) {
        field.style.borderColor = '#e74c3c';
        messageElement.textContent = message;
        messageElement.style.display = 'block';
    }
    
    /**
     * Update character counter for textarea
     * @param {HTMLTextAreaElement} textarea - The textarea element
     * @param {HTMLElement} counter - The character counter element
     */
    updateCharCounter(textarea, counter) {
        if (counter) {
            const currentLength = textarea.value.length;
            const maxLength = textarea.getAttribute('maxlength') || 1000;
            counter.textContent = `${currentLength}/${maxLength}`;
            
            // Change color based on usage
            if (currentLength > maxLength * 0.9) {
                counter.style.color = '#e74c3c';
            } else if (currentLength > maxLength * 0.7) {
                counter.style.color = '#f39c12';
            } else {
                counter.style.color = '#7f8c8d';
            }
        }
    }
    
    /**
     * Comprehensive validation for Default Agent system prompts fields
     * @param {Object} systemPrompts - System prompts configuration object
     * @returns {Object} Validation result with detailed error information
     */
    validateDefaultAgentSystemPromptsComprehensive(systemPrompts) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            fieldErrors: {}
        };
        
        try {
            // Validate base personality with enhanced checks
            if (!systemPrompts.basePersonality) {
                result.errors.push('Base AI Personality is required');
                result.fieldErrors.basePersonality = 'This field is required';
                result.isValid = false;
            } else {
                const basePersonality = systemPrompts.basePersonality.trim();
                if (basePersonality.length === 0) {
                    result.errors.push('Base AI Personality cannot be empty');
                    result.fieldErrors.basePersonality = 'This field cannot be empty';
                    result.isValid = false;
                } else if (basePersonality.length < 20) {
                    result.errors.push('Base AI Personality must be at least 20 characters long');
                    result.fieldErrors.basePersonality = 'Must be at least 20 characters long';
                    result.isValid = false;
                } else if (basePersonality.length > 2000) {
                    result.errors.push('Base AI Personality must be less than 2000 characters');
                    result.fieldErrors.basePersonality = 'Must be less than 2000 characters';
                    result.isValid = false;
                } else if (basePersonality.length < 50) {
                    result.warnings.push('Base AI Personality is quite short - consider adding more detail');
                }
                
                // Check for potentially problematic content
                if (this.containsProblematicContent(basePersonality)) {
                    result.warnings.push('Base AI Personality may contain content that could affect AI behavior');
                }
            }
            
            // Validate financial context with enhanced checks
            if (!systemPrompts.financialContext) {
                result.errors.push('Financial Services Context is required');
                result.fieldErrors.financialContext = 'This field is required';
                result.isValid = false;
            } else {
                const financialContext = systemPrompts.financialContext.trim();
                if (financialContext.length === 0) {
                    result.errors.push('Financial Services Context cannot be empty');
                    result.fieldErrors.financialContext = 'This field cannot be empty';
                    result.isValid = false;
                } else if (financialContext.length < 20) {
                    result.errors.push('Financial Services Context must be at least 20 characters long');
                    result.fieldErrors.financialContext = 'Must be at least 20 characters long';
                    result.isValid = false;
                } else if (financialContext.length > 3000) {
                    result.errors.push('Financial Services Context must be less than 3000 characters');
                    result.fieldErrors.financialContext = 'Must be less than 3000 characters';
                    result.isValid = false;
                } else if (financialContext.length < 100) {
                    result.warnings.push('Financial Services Context is quite short - consider adding more banking-specific guidance');
                }
            }
            
            // Validate response instructions with enhanced checks
            if (!systemPrompts.responseInstructions) {
                result.errors.push('Response Instructions are required');
                result.fieldErrors.responseInstructions = 'This field is required';
                result.isValid = false;
            } else {
                const responseInstructions = systemPrompts.responseInstructions.trim();
                if (responseInstructions.length === 0) {
                    result.errors.push('Response Instructions cannot be empty');
                    result.fieldErrors.responseInstructions = 'This field cannot be empty';
                    result.isValid = false;
                } else if (responseInstructions.length < 10) {
                    result.errors.push('Response Instructions must be at least 10 characters long');
                    result.fieldErrors.responseInstructions = 'Must be at least 10 characters long';
                    result.isValid = false;
                } else if (responseInstructions.length > 1500) {
                    result.errors.push('Response Instructions must be less than 1500 characters');
                    result.fieldErrors.responseInstructions = 'Must be less than 1500 characters';
                    result.isValid = false;
                }
            }
            
            // Validate custom prompts with comprehensive checks
            if (systemPrompts.customPrompts) {
                if (!Array.isArray(systemPrompts.customPrompts)) {
                    result.errors.push('Custom prompts must be an array');
                    result.fieldErrors.customPrompts = 'Invalid data structure';
                    result.isValid = false;
                } else {
                    if (systemPrompts.customPrompts.length > 20) {
                        result.errors.push('Maximum of 20 custom prompts allowed');
                        result.fieldErrors.customPrompts = 'Too many custom prompts';
                        result.isValid = false;
                    }
                    
                    const promptNames = [];
                    systemPrompts.customPrompts.forEach((prompt, index) => {
                        const promptFieldKey = `customPrompt_${index}`;
                        
                        if (!prompt || typeof prompt !== 'object') {
                            result.errors.push(`Custom prompt ${index + 1}: Invalid prompt structure`);
                            result.fieldErrors[promptFieldKey] = 'Invalid prompt structure';
                            result.isValid = false;
                            return;
                        }
                        
                        // Validate prompt name
                        if (!prompt.name) {
                            result.errors.push(`Custom prompt ${index + 1}: Name is required`);
                            result.fieldErrors[`${promptFieldKey}_name`] = 'Name is required';
                            result.isValid = false;
                        } else {
                            const name = prompt.name.trim();
                            if (name.length === 0) {
                                result.errors.push(`Custom prompt ${index + 1}: Name cannot be empty`);
                                result.fieldErrors[`${promptFieldKey}_name`] = 'Name cannot be empty';
                                result.isValid = false;
                            } else if (name.length > 100) {
                                result.errors.push(`Custom prompt ${index + 1}: Name must be less than 100 characters`);
                                result.fieldErrors[`${promptFieldKey}_name`] = 'Must be less than 100 characters';
                                result.isValid = false;
                            } else {
                                // Check for duplicate names
                                const lowerName = name.toLowerCase();
                                if (promptNames.includes(lowerName)) {
                                    result.errors.push(`Custom prompt ${index + 1}: Duplicate name "${name}"`);
                                    result.fieldErrors[`${promptFieldKey}_name`] = 'Name must be unique';
                                    result.isValid = false;
                                } else {
                                    promptNames.push(lowerName);
                                }
                            }
                        }
                        
                        // Validate prompt content
                        if (!prompt.prompt) {
                            result.errors.push(`Custom prompt ${index + 1}: Content is required`);
                            result.fieldErrors[`${promptFieldKey}_content`] = 'Content is required';
                            result.isValid = false;
                        } else {
                            const content = prompt.prompt.trim();
                            if (content.length === 0) {
                                result.errors.push(`Custom prompt ${index + 1}: Content cannot be empty`);
                                result.fieldErrors[`${promptFieldKey}_content`] = 'Content cannot be empty';
                                result.isValid = false;
                            } else if (content.length < 5) {
                                result.errors.push(`Custom prompt ${index + 1}: Content must be at least 5 characters long`);
                                result.fieldErrors[`${promptFieldKey}_content`] = 'Must be at least 5 characters long';
                                result.isValid = false;
                            } else if (content.length > 1000) {
                                result.errors.push(`Custom prompt ${index + 1}: Content must be less than 1000 characters`);
                                result.fieldErrors[`${promptFieldKey}_content`] = 'Must be less than 1000 characters';
                                result.isValid = false;
                            }
                            
                            // Check for potentially problematic content
                            if (this.containsProblematicContent(content)) {
                                result.warnings.push(`Custom prompt ${index + 1}: May contain content that could affect AI behavior`);
                            }
                        }
                    });
                }
            }
            
        } catch (error) {
            this.debug.error('Error during comprehensive system prompts validation:', error);
            result.errors.push('Validation error: ' + error.message);
            result.isValid = false;
        }
        
        return result;
    }
    
    /**
     * Check if content contains potentially problematic patterns
     * @param {string} content - Content to check
     * @returns {boolean} True if potentially problematic content is found
     */
    containsProblematicContent(content) {
        const problematicPatterns = [
            /ignore\s+previous\s+instructions/i,
            /forget\s+everything/i,
            /act\s+as\s+if/i,
            /pretend\s+to\s+be/i,
            /jailbreak/i,
            /system\s+override/i
        ];
        
        return problematicPatterns.some(pattern => pattern.test(content));
    }
    
    /**
     * Enhanced save operation with comprehensive error handling and validation
     * @param {string} agentName - Name of the agent to save
     * @returns {Promise<boolean>} Success status
     */
    async saveAgentConfigurationEnhanced(agentName) {
        const saveResult = {
            success: false,
            errors: [],
            warnings: [],
            validationErrors: {},
            systemErrors: []
        };
        
        try {
            this.debug.log(`Starting enhanced save operation for agent: ${agentName}`);
            
            // Step 1: Pre-save validation
            const preValidationResult = await this.performPreSaveValidation(agentName);
            if (!preValidationResult.success) {
                saveResult.errors.push(...preValidationResult.errors);
                saveResult.validationErrors = preValidationResult.validationErrors;
                this.displayComprehensiveErrors(saveResult);
                return false;
            }
            
            // Step 2: Collect configuration data with error handling
            let config;
            try {
                config = this.collectAgentConfiguration(agentName);
            } catch (configError) {
                this.debug.error('Error collecting agent configuration:', configError);
                saveResult.systemErrors.push('Failed to collect configuration data: ' + configError.message);
                this.displayComprehensiveErrors(saveResult);
                return false;
            }
            
            // Step 3: Perform comprehensive validation
            const validationResult = this.validateAgentConfigurationComprehensive(config, agentName);
            if (!validationResult.isValid) {
                saveResult.errors.push(...validationResult.errors);
                saveResult.warnings.push(...validationResult.warnings);
                saveResult.validationErrors = validationResult.fieldErrors;
                this.displayComprehensiveErrors(saveResult);
                return false;
            }
            
            // Step 4: Handle Default Agent specific validation and system prompts sync
            if (agentName === 'DefaultAgent' && config.systemPrompts) {
                const systemPromptsValidation = this.validateDefaultAgentSystemPromptsComprehensive(config.systemPrompts);
                if (!systemPromptsValidation.isValid) {
                    saveResult.errors.push(...systemPromptsValidation.errors);
                    saveResult.warnings.push(...systemPromptsValidation.warnings);
                    saveResult.validationErrors = { ...saveResult.validationErrors, ...systemPromptsValidation.fieldErrors };
                    this.displayComprehensiveErrors(saveResult);
                    return false;
                }
                
                // Attempt to sync with SystemPromptsManager
                try {
                    if (this.systemPromptsManager) {
                        await this.updateSystemPromptsManager(config.systemPrompts);
                        this.debug.log('Successfully synced with SystemPromptsManager');
                    } else {
                        saveResult.warnings.push('SystemPromptsManager not available - configuration saved to LLM Manager only');
                    }
                } catch (systemPromptsError) {
                    this.debug.error('Failed to sync with SystemPromptsManager:', systemPromptsError);
                    saveResult.warnings.push('Failed to sync with System Prompts Manager: ' + systemPromptsError.message);
                    // Continue with save operation even if sync fails
                }
            }
            
            // Step 5: Attempt to save configuration
            let saveAttemptResult;
            try {
                saveAttemptResult = await this.llmManager.updateAgentConfiguration(agentName, config);
            } catch (saveError) {
                this.debug.error('Error during save operation:', saveError);
                saveResult.systemErrors.push('Save operation failed: ' + saveError.message);
                this.displayComprehensiveErrors(saveResult);
                return false;
            }
            
            // Step 6: Handle save result
            if (saveAttemptResult && saveAttemptResult.success !== false) {
                saveResult.success = true;
                
                // Display success with any warnings
                if (saveResult.warnings.length > 0) {
                    this.showSuccess('Configuration saved successfully (with warnings)');
                    this.displayWarnings(saveResult.warnings);
                } else {
                    this.showSuccess('Configuration saved successfully');
                }
                
                // Clean up and refresh
                this.closeModal('configModal');
                this.refreshAgentData();
                this.logAuditEvent('config', `Updated configuration for ${agentName}`, config);
                
                return true;
            } else {
                saveResult.systemErrors.push('Save operation returned failure: ' + (saveAttemptResult?.error || 'Unknown error'));
                this.displayComprehensiveErrors(saveResult);
                return false;
            }
            
        } catch (error) {
            this.debug.error('Critical error during enhanced save operation:', error);
            saveResult.systemErrors.push('Critical save error: ' + error.message);
            this.displayComprehensiveErrors(saveResult);
            return false;
        }
    }
    
    /**
     * Perform pre-save validation checks
     * @param {string} agentName - Name of the agent
     * @returns {Promise<Object>} Validation result
     */
    async performPreSaveValidation(agentName) {
        const result = {
            success: true,
            errors: [],
            validationErrors: {}
        };
        
        try {
            // Check if LLM Manager is available
            if (!this.llmManager) {
                result.errors.push('LLM Manager is not available');
                result.success = false;
                return result;
            }
            
            // Check if agent name is valid
            if (!agentName || typeof agentName !== 'string' || agentName.trim().length === 0) {
                result.errors.push('Invalid agent name');
                result.success = false;
                return result;
            }
            
            // Check if required DOM elements exist
            const requiredElements = ['agentName', 'agentDescription', 'agentPriority', 'llmProvider', 'llmModel'];
            for (const elementId of requiredElements) {
                const element = document.getElementById(elementId);
                if (!element) {
                    result.errors.push(`Required form element '${elementId}' not found`);
                    result.validationErrors[elementId] = 'Form element not found';
                    result.success = false;
                }
            }
            
            // For Default Agent, check system prompts elements
            if (agentName === 'DefaultAgent') {
                const systemPromptsElements = ['defaultPersonality', 'defaultFinancialContext', 'defaultResponseInstructions'];
                for (const elementId of systemPromptsElements) {
                    const element = document.getElementById(elementId);
                    if (!element) {
                        result.errors.push(`Required Default Agent element '${elementId}' not found`);
                        result.validationErrors[elementId] = 'Form element not found';
                        result.success = false;
                    }
                }
            }
            
        } catch (error) {
            this.debug.error('Error during pre-save validation:', error);
            result.errors.push('Pre-save validation error: ' + error.message);
            result.success = false;
        }
        
        return result;
    }
    
    /**
     * Collect agent configuration from form with error handling
     * @param {string} agentName - Name of the agent
     * @returns {Object} Agent configuration object
     */
    collectAgentConfiguration(agentName) {
        try {
            const config = {
                name: this.getElementValue('agentName', '').trim(),
                description: this.getElementValue('agentDescription', '').trim(),
                priority: parseInt(this.getElementValue('agentPriority', '0')),
                enabled: this.getElementChecked('agentEnabled', true),
                llmProvider: this.getElementValue('llmProvider', 'openai'),
                llmModel: this.getElementValue('llmModel', 'gpt-4'),
                maxTokens: parseInt(this.getElementValue('maxTokens', '1500')),
                temperature: parseFloat(this.getElementValue('temperature', '0.7')),
                telemetryEnabled: this.getElementChecked('telemetryEnabled', true)
            };
            
            // Collect triggers
            const triggersContainer = document.getElementById('triggersList');
            if (triggersContainer) {
                config.triggers = Array.from(triggersContainer.querySelectorAll('.trigger-item input'))
                    .map(input => input.value.trim())
                    .filter(trigger => trigger.length > 0);
            } else {
                config.triggers = [];
            }
            
            // For Default Agent, collect system prompts
            if (agentName === 'DefaultAgent') {
                config.systemPrompts = {
                    basePersonality: this.getElementValue('defaultPersonality', '').trim(),
                    financialContext: this.getElementValue('defaultFinancialContext', '').trim(),
                    responseInstructions: this.getElementValue('defaultResponseInstructions', '').trim(),
                    customPrompts: this.collectCustomPrompts()
                };
            }
            
            return config;
            
        } catch (error) {
            this.debug.error('Error collecting agent configuration:', error);
            throw new Error('Failed to collect configuration data: ' + error.message);
        }
    }
    
    /**
     * Safely get element value with fallback
     * @param {string} elementId - Element ID
     * @param {string} fallback - Fallback value
     * @returns {string} Element value or fallback
     */
    getElementValue(elementId, fallback = '') {
        try {
            const element = document.getElementById(elementId);
            return element ? element.value : fallback;
        } catch (error) {
            this.debug.warn(`Error getting value for element ${elementId}:`, error);
            return fallback;
        }
    }
    
    /**
     * Safely get element checked status with fallback
     * @param {string} elementId - Element ID
     * @param {boolean} fallback - Fallback value
     * @returns {boolean} Element checked status or fallback
     */
    getElementChecked(elementId, fallback = false) {
        try {
            const element = document.getElementById(elementId);
            return element ? element.checked : fallback;
        } catch (error) {
            this.debug.warn(`Error getting checked status for element ${elementId}:`, error);
            return fallback;
        }
    }
    
    /**
     * Collect custom prompts with error handling
     * @returns {Array} Array of custom prompts
     */
    collectCustomPrompts() {
        const customPrompts = [];
        
        try {
            const customPromptsContainer = document.getElementById('defaultCustomPromptsList');
            if (!customPromptsContainer) {
                this.debug.warn('Custom prompts container not found');
                return customPrompts;
            }
            
            const promptItems = customPromptsContainer.querySelectorAll('.custom-prompt-item');
            promptItems.forEach((item, index) => {
                try {
                    const nameInput = item.querySelector('[data-field="name"]');
                    const promptTextarea = item.querySelector('[data-field="prompt"]');
                    
                    if (nameInput && promptTextarea) {
                        const name = nameInput.value.trim();
                        const prompt = promptTextarea.value.trim();
                        
                        if (name && prompt) {
                            customPrompts.push({
                                id: `custom_${Date.now()}_${index}`,
                                name: name,
                                prompt: prompt
                            });
                        }
                    }
                } catch (itemError) {
                    this.debug.warn(`Error collecting custom prompt ${index}:`, itemError);
                }
            });
            
        } catch (error) {
            this.debug.error('Error collecting custom prompts:', error);
        }
        
        return customPrompts;
    }
    
    /**
     * Comprehensive validation for agent configuration
     * @param {Object} config - Agent configuration
     * @param {string} agentName - Agent name
     * @returns {Object} Validation result
     */
    validateAgentConfigurationComprehensive(config, agentName) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            fieldErrors: {}
        };
        
        try {
            // Basic field validation
            const basicValidation = this.validateAgentConfiguration();
            if (!basicValidation.isValid) {
                result.errors.push(...basicValidation.errors);
                result.isValid = false;
            }
            
            // Additional comprehensive checks
            if (config.name && config.name !== agentName) {
                result.warnings.push('Agent name in form differs from expected agent name');
            }
            
            if (config.maxTokens > 4000) {
                result.warnings.push('High token limit may result in increased API costs');
            }
            
            if (config.temperature > 1.5) {
                result.warnings.push('High temperature setting may result in unpredictable responses');
            }
            
            if (config.triggers && config.triggers.length === 0 && agentName !== 'DefaultAgent') {
                result.warnings.push('Agent has no triggers defined - it may not be activated');
            }
            
        } catch (error) {
            this.debug.error('Error during comprehensive validation:', error);
            result.errors.push('Validation error: ' + error.message);
            result.isValid = false;
        }
        
        return result;
    }
    
    /**
     * Display comprehensive error information to user
     * @param {Object} errorResult - Error result object
     */
    displayComprehensiveErrors(errorResult) {
        let errorMessage = 'Configuration save failed:\n\n';
        
        if (errorResult.errors.length > 0) {
            errorMessage += 'Errors:\n';
            errorResult.errors.forEach(error => {
                errorMessage += `• ${error}\n`;
            });
        }
        
        if (errorResult.systemErrors.length > 0) {
            errorMessage += '\nSystem Errors:\n';
            errorResult.systemErrors.forEach(error => {
                errorMessage += `• ${error}\n`;
            });
        }
        
        if (errorResult.warnings.length > 0) {
            errorMessage += '\nWarnings:\n';
            errorResult.warnings.forEach(warning => {
                errorMessage += `• ${warning}\n`;
            });
        }
        
        this.showError(errorMessage);
        
        // Also highlight specific field errors in the UI
        this.highlightFieldErrors(errorResult.validationErrors);
    }
    
    /**
     * Display warnings to user
     * @param {Array} warnings - Array of warning messages
     */
    displayWarnings(warnings) {
        if (warnings.length > 0) {
            let warningMessage = 'Configuration saved with warnings:\n\n';
            warnings.forEach(warning => {
                warningMessage += `• ${warning}\n`;
            });
            this.showNotification(warningMessage, 'warning');
        }
    }
    
    /**
     * Highlight field errors in the UI
     * @param {Object} fieldErrors - Object mapping field names to error messages
     */
    highlightFieldErrors(fieldErrors) {
        // Clear previous error highlights
        document.querySelectorAll('.form-input, .form-textarea').forEach(element => {
            element.style.borderColor = '';
        });
        
        document.querySelectorAll('.validation-message').forEach(element => {
            element.style.display = 'none';
            element.textContent = '';
        });
        
        // Apply new error highlights
        Object.keys(fieldErrors).forEach(fieldName => {
            const element = document.getElementById(fieldName);
            if (element) {
                element.style.borderColor = '#e74c3c';
                
                // Find associated validation message element
                const validationMessage = element.parentElement?.querySelector('.validation-message');
                if (validationMessage) {
                    validationMessage.textContent = fieldErrors[fieldName];
                    validationMessage.style.display = 'block';
                }
            }
        });
    }
    
    /**
     * Enhanced load operation with comprehensive error handling
     * @param {string} agentName - Name of the agent to load
     * @returns {Promise<boolean>} Success status
     */
    async loadAgentConfigurationEnhanced(agentName) {
        try {
            this.debug.log(`Starting enhanced load operation for agent: ${agentName}`);
            
            // Step 1: Validate prerequisites
            if (!this.llmManager) {
                this.showError('LLM Manager is not available');
                return false;
            }
            
            if (!agentName || typeof agentName !== 'string') {
                this.showError('Invalid agent name provided');
                return false;
            }
            
            // Step 2: Attempt to load configuration
            let config;
            try {
                config = this.llmManager.getAgentConfiguration(agentName);
            } catch (loadError) {
                this.debug.error('Error loading agent configuration:', loadError);
                this.showError('Failed to load agent configuration: ' + loadError.message);
                return false;
            }
            
            if (!config) {
                this.showError(`Agent ${agentName} not found`);
                return false;
            }
            
            // Step 3: Validate loaded configuration
            const configValidation = this.validateLoadedConfiguration(config, agentName);
            if (!configValidation.isValid) {
                this.debug.warn('Loaded configuration has validation issues:', configValidation.errors);
                // Show warning but continue with load
                this.showNotification('Configuration loaded with warnings: ' + configValidation.errors.join(', '), 'warning');
            }
            
            // Step 4: Populate form with error handling
            try {
                await this.populateFormWithConfiguration(config, agentName);
            } catch (populateError) {
                this.debug.error('Error populating form:', populateError);
                this.showError('Failed to populate form: ' + populateError.message);
                return false;
            }
            
            // Step 5: For Default Agent, handle system prompts integration
            if (agentName === 'DefaultAgent') {
                try {
                    await this.handleDefaultAgentSystemPromptsLoad(config);
                } catch (systemPromptsError) {
                    this.debug.error('Error handling Default Agent system prompts:', systemPromptsError);
                    this.showNotification('Default Agent loaded but system prompts integration had issues: ' + systemPromptsError.message, 'warning');
                }
            }
            
            this.debug.log(`Successfully loaded configuration for agent: ${agentName}`);
            return true;
            
        } catch (error) {
            this.debug.error('Critical error during enhanced load operation:', error);
            this.showError('Critical error loading configuration: ' + error.message);
            return false;
        }
    }
    
    /**
     * Validate loaded configuration for integrity
     * @param {Object} config - Loaded configuration
     * @param {string} agentName - Expected agent name
     * @returns {Object} Validation result
     */
    validateLoadedConfiguration(config, agentName) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        try {
            // Check basic structure
            if (!config || typeof config !== 'object') {
                result.errors.push('Configuration is not a valid object');
                result.isValid = false;
                return result;
            }
            
            // Check required fields
            const requiredFields = ['name', 'description', 'priority', 'enabled', 'llmProvider', 'llmModel'];
            requiredFields.forEach(field => {
                if (config[field] === undefined || config[field] === null) {
                    result.warnings.push(`Missing field: ${field}`);
                }
            });
            
            // Check data types
            if (typeof config.priority !== 'number' || isNaN(config.priority)) {
                result.warnings.push('Priority is not a valid number');
            }
            
            if (typeof config.enabled !== 'boolean') {
                result.warnings.push('Enabled status is not a boolean');
            }
            
            if (typeof config.maxTokens !== 'number' || isNaN(config.maxTokens)) {
                result.warnings.push('Max tokens is not a valid number');
            }
            
            // For Default Agent, check system prompts
            if (agentName === 'DefaultAgent' && config.systemPrompts) {
                const systemPromptsValidation = this.validateSystemPromptsData(config.systemPrompts);
                if (!systemPromptsValidation.valid) {
                    result.warnings.push('System prompts data has validation issues');
                }
            }
            
        } catch (error) {
            this.debug.error('Error validating loaded configuration:', error);
            result.errors.push('Configuration validation error: ' + error.message);
            result.isValid = false;
        }
        
        return result;
    }
    
    /**
     * Populate form with configuration data with error handling
     * @param {Object} config - Configuration data
     * @param {string} agentName - Agent name
     */
    async populateFormWithConfiguration(config, agentName) {
        try {
            // Use the existing loadConfigurationForms method which handles all form population
            this.loadConfigurationForms(config);
            
        } catch (error) {
            this.debug.error('Error populating form with configuration:', error);
            throw new Error('Form population failed: ' + error.message);
        }
    }
    
    /**
     * Safely set element value with error handling
     * @param {string} elementId - Element ID
     * @param {any} value - Value to set
     */
    setElementValue(elementId, value) {
        try {
            const element = document.getElementById(elementId);
            if (element) {
                element.value = value;
            } else {
                this.debug.warn(`Element ${elementId} not found when setting value`);
            }
        } catch (error) {
            this.debug.warn(`Error setting value for element ${elementId}:`, error);
        }
    }
    
    /**
     * Safely set element checked status with error handling
     * @param {string} elementId - Element ID
     * @param {boolean} checked - Checked status
     */
    setElementChecked(elementId, checked) {
        try {
            const element = document.getElementById(elementId);
            if (element) {
                element.checked = checked;
            } else {
                this.debug.warn(`Element ${elementId} not found when setting checked status`);
            }
        } catch (error) {
            this.debug.warn(`Error setting checked status for element ${elementId}:`, error);
        }
    }
    
    /**
     * Populate triggers with error handling
     * @param {Array} triggers - Array of trigger strings
     */
    async populateTriggersWithErrorHandling(triggers) {
        try {
            const triggersContainer = document.getElementById('triggersList');
            if (!triggersContainer) {
                this.debug.warn('Triggers container not found');
                return;
            }
            
            // Clear existing triggers
            triggersContainer.innerHTML = '';
            
            // Add each trigger with error handling
            triggers.forEach((trigger, index) => {
                try {
                    if (trigger && typeof trigger === 'string' && trigger.trim().length > 0) {
                        this.addTriggerToList(trigger.trim());
                    }
                } catch (triggerError) {
                    this.debug.warn(`Error adding trigger ${index}:`, triggerError);
                }
            });
            
        } catch (error) {
            this.debug.error('Error populating triggers:', error);
            throw new Error('Triggers population failed: ' + error.message);
        }
    }
    
    /**
     * Handle Default Agent system prompts loading with comprehensive error handling
     * @param {Object} config - Agent configuration
     */
    async handleDefaultAgentSystemPromptsLoad(config) {
        try {
            if (!config.systemPrompts) {
                this.debug.warn('No system prompts found in Default Agent configuration');
                
                // Attempt to load from SystemPromptsManager as fallback
                if (this.systemPromptsManager) {
                    try {
                        await this.systemPromptsManager.init();
                        const systemPrompts = this.systemPromptsManager.getAllPrompts();
                        if (systemPrompts) {
                            this.populateDefaultAgentSystemPrompts(systemPrompts);
                            this.debug.log('Loaded Default Agent system prompts from SystemPromptsManager fallback');
                            return;
                        }
                    } catch (fallbackError) {
                        this.debug.warn('SystemPromptsManager fallback failed:', fallbackError);
                    }
                }
                
                // Use default values if no system prompts available
                this.populateDefaultAgentSystemPrompts(this.getDefaultSystemPromptsConfiguration());
                return;
            }
            
            // Populate with existing system prompts
            this.populateDefaultAgentSystemPrompts(config.systemPrompts);
            
        } catch (error) {
            this.debug.error('Error handling Default Agent system prompts load:', error);
            throw new Error('System prompts loading failed: ' + error.message);
        }
    }
    
    /**
     * Populate Default Agent system prompts fields with error handling
     * @param {Object} systemPrompts - System prompts data
     */
    populateDefaultAgentSystemPrompts(systemPrompts) {
        try {
            // Populate main system prompts fields
            this.setElementValue('defaultPersonality', systemPrompts.basePersonality || '');
            this.setElementValue('defaultFinancialContext', systemPrompts.financialContext || '');
            this.setElementValue('defaultResponseInstructions', systemPrompts.responseInstructions || '');
            
            // Populate custom prompts with error handling
            if (systemPrompts.customPrompts && Array.isArray(systemPrompts.customPrompts)) {
                this.populateDefaultAgentCustomPrompts(systemPrompts.customPrompts);
            } else {
                // Clear custom prompts container
                const customPromptsContainer = document.getElementById('defaultCustomPromptsList');
                if (customPromptsContainer) {
                    customPromptsContainer.innerHTML = '<p style="color: #7f8c8d; font-style: italic;">No custom prompts configured</p>';
                }
            }
            
        } catch (error) {
            this.debug.error('Error populating Default Agent system prompts:', error);
            throw new Error('System prompts population failed: ' + error.message);
        }
    }
    
    /**
     * Populate Default Agent custom prompts with error handling
     * @param {Array} customPrompts - Array of custom prompts
     */
    populateDefaultAgentCustomPrompts(customPrompts) {
        try {
            const customPromptsContainer = document.getElementById('defaultCustomPromptsList');
            if (!customPromptsContainer) {
                this.debug.warn('Custom prompts container not found');
                return;
            }
            
            // Clear existing content
            customPromptsContainer.innerHTML = '';
            
            if (!customPrompts || customPrompts.length === 0) {
                customPromptsContainer.innerHTML = '<p style="color: #7f8c8d; font-style: italic;">No custom prompts configured</p>';
                return;
            }
            
            // Add each custom prompt with error handling
            customPrompts.forEach((prompt, index) => {
                try {
                    if (prompt && typeof prompt === 'object' && prompt.name && prompt.prompt) {
                        this.addCustomPromptToContainer(prompt, index);
                    } else {
                        this.debug.warn(`Invalid custom prompt at index ${index}:`, prompt);
                    }
                } catch (promptError) {
                    this.debug.warn(`Error adding custom prompt ${index}:`, promptError);
                }
            });
            
            // Initialize validation for all custom prompts
            setTimeout(() => {
                this.initializeCustomPromptsValidation();
            }, 100);
            
        } catch (error) {
            this.debug.error('Error populating custom prompts:', error);
            throw new Error('Custom prompts population failed: ' + error.message);
        }
    }
    
    /**
     * Add custom prompt to container with error handling
     * @param {Object} prompt - Prompt object with name and prompt properties
     * @param {number} index - Index of the prompt
     */
    addCustomPromptToContainer(prompt, index) {
        try {
            const customPromptsContainer = document.getElementById('defaultCustomPromptsList');
            if (!customPromptsContainer) {
                throw new Error('Custom prompts container not found');
            }
            
            const promptItem = document.createElement('div');
            promptItem.className = 'custom-prompt-item';
            promptItem.style.cssText = 'border: 1px solid #e1e8ed; border-radius: 6px; padding: 15px; margin-bottom: 10px;';
            
            promptItem.innerHTML = `
                <div class="form-group">
                    <label class="form-label">Prompt Name <span style="color: #e74c3c;">*</span></label>
                    <input type="text" class="form-input" value="${this.escapeHtml(prompt.name)}" 
                           data-custom-prompt-index="${index}" data-field="name" maxlength="100" required
                           placeholder="Enter prompt name (max 100 characters)...">
                    <div class="validation-message" style="color: #e74c3c; font-size: 0.8em; margin-top: 5px; display: none;"></div>
                </div>
                <div class="form-group">
                    <label class="form-label">Prompt Content <span style="color: #e74c3c;">*</span></label>
                    <textarea class="form-textarea" rows="3" data-custom-prompt-index="${index}" data-field="prompt" 
                              maxlength="1000" required
                              placeholder="Enter prompt content (max 1000 characters)...">${this.escapeHtml(prompt.prompt || '')}</textarea>
                    <div class="char-counter" style="color: #7f8c8d; font-size: 0.8em; text-align: right; margin-top: 5px;">${(prompt.prompt || '').length}/1000</div>
                    <div class="validation-message" style="color: #e74c3c; font-size: 0.8em; margin-top: 5px; display: none;"></div>
                </div>
                <button type="button" class="btn btn-danger btn-sm" onclick="adminUI.removeDefaultAgentCustomPrompt(this)">
                    🗑️ Remove
                </button>
            `;
            
            customPromptsContainer.appendChild(promptItem);
            
        } catch (error) {
            this.debug.error('Error adding custom prompt to container:', error);
            throw new Error('Failed to add custom prompt: ' + error.message);
        }
    }
    
    /**
     * Enhanced initialization with graceful degradation for missing dependencies
     */
    async initializeWithGracefulDegradation() {
        const initializationResult = {
            success: false,
            errors: [],
            warnings: [],
            availableFeatures: [],
            unavailableFeatures: []
        };
        
        try {
            this.debug.log('Starting initialization with graceful degradation');
            
            // Check core dependencies
            const coreChecks = await this.checkCoreDependencies();
            initializationResult.errors.push(...coreChecks.errors);
            initializationResult.warnings.push(...coreChecks.warnings);
            
            // Initialize available managers
            const managerInitResults = await this.initializeAvailableManagers();
            initializationResult.availableFeatures.push(...managerInitResults.available);
            initializationResult.unavailableFeatures.push(...managerInitResults.unavailable);
            initializationResult.warnings.push(...managerInitResults.warnings);
            
            // Set up UI with available features
            await this.setupUIWithAvailableFeatures(initializationResult.availableFeatures);
            
            // Determine overall success
            initializationResult.success = initializationResult.errors.length === 0;
            
            // Report initialization status
            if (initializationResult.success) {
                this.debug.log('Initialization completed successfully with graceful degradation');
                if (initializationResult.warnings.length > 0) {
                    this.showNotification('System initialized with some features unavailable', 'warning');
                }
            } else {
                this.debug.error('Initialization failed:', initializationResult.errors);
                this.showError('System initialization failed: ' + initializationResult.errors.join(', '));
            }
            
            return initializationResult;
            
        } catch (error) {
            this.debug.error('Critical error during initialization with graceful degradation:', error);
            initializationResult.errors.push('Critical initialization error: ' + error.message);
            initializationResult.success = false;
            return initializationResult;
        }
    }
    
    /**
     * Check core dependencies
     * @returns {Promise<Object>} Check results
     */
    async checkCoreDependencies() {
        const result = {
            errors: [],
            warnings: []
        };
        
        try {
            // Check if we're in the right environment
            if (typeof window === 'undefined') {
                result.errors.push('Window object not available - not in browser environment');
                return result;
            }
            
            // Check for debug manager
            if (!window.debugManager) {
                result.warnings.push('Debug manager not available - using console fallback');
                this.setupDebugFallback();
            }
            
            // Check for required DOM elements
            const requiredElements = ['.llm-manager-container', '[data-section]'];
            let hasRequiredElements = false;
            
            for (const selector of requiredElements) {
                if (document.querySelector(selector)) {
                    hasRequiredElements = true;
                    break;
                }
            }
            
            if (!hasRequiredElements) {
                result.warnings.push('LLM Manager interface elements not found - limited functionality');
            }
            
        } catch (error) {
            result.errors.push('Core dependency check failed: ' + error.message);
        }
        
        return result;
    }
    
    /**
     * Initialize available managers with graceful degradation
     * @returns {Promise<Object>} Initialization results
     */
    async initializeAvailableManagers() {
        const result = {
            available: [],
            unavailable: [],
            warnings: []
        };
        
        // Try to initialize LLMManager
        try {
            if (typeof LLMManager !== 'undefined') {
                this.llmManager = new LLMManager();
                result.available.push('LLMManager');
            } else {
                result.unavailable.push('LLMManager');
                result.warnings.push('LLMManager not available - core functionality disabled');
            }
        } catch (error) {
            result.unavailable.push('LLMManager');
            result.warnings.push('LLMManager initialization failed: ' + error.message);
        }
        
        // Try to initialize GuardrailsManager
        try {
            if (typeof GuardrailsManager !== 'undefined') {
                this.guardrailsManager = new GuardrailsManager();
                result.available.push('GuardrailsManager');
            } else {
                result.unavailable.push('GuardrailsManager');
                result.warnings.push('GuardrailsManager not available - security features disabled');
            }
        } catch (error) {
            result.unavailable.push('GuardrailsManager');
            result.warnings.push('GuardrailsManager initialization failed: ' + error.message);
        }
        
        // Try to initialize VoiceConfigManager
        try {
            if (typeof VoiceConfigManager !== 'undefined') {
                this.voiceConfigManager = new VoiceConfigManager();
                result.available.push('VoiceConfigManager');
            } else {
                result.unavailable.push('VoiceConfigManager');
                result.warnings.push('VoiceConfigManager not available - voice features disabled');
            }
        } catch (error) {
            result.unavailable.push('VoiceConfigManager');
            result.warnings.push('VoiceConfigManager initialization failed: ' + error.message);
        }
        
        // Try to initialize SystemPromptsManager for Default Agent integration
        try {
            if (typeof SystemPromptsManager !== 'undefined') {
                this.systemPromptsManager = new SystemPromptsManager();
                await this.systemPromptsManager.init();
                result.available.push('SystemPromptsManager');
            } else {
                result.unavailable.push('SystemPromptsManager');
                result.warnings.push('SystemPromptsManager not available - Default Agent integration limited');
            }
        } catch (error) {
            result.unavailable.push('SystemPromptsManager');
            result.warnings.push('SystemPromptsManager initialization failed: ' + error.message);
        }
        
        return result;
    }
    
    /**
     * Setup debug fallback when debug manager is not available
     */
    setupDebugFallback() {
        if (!window.debugManager) {
            window.debugManager = {
                createModuleLogger: (module) => ({
                    log: (...args) => console.log(`[${module}]`, ...args),
                    debug: (...args) => console.debug(`[${module}]`, ...args),
                    info: (...args) => console.info(`[${module}]`, ...args),
                    warn: (...args) => console.warn(`[${module}]`, ...args),
                    error: (...args) => console.error(`[${module}]`, ...args)
                })
            };
            
            this.debug = window.debugManager.createModuleLogger('AdminUI');
        }
    }
    
    /**
     * Setup UI with available features
     * @param {Array} availableFeatures - List of available features
     */
    async setupUIWithAvailableFeatures(availableFeatures) {
        try {
            // Always try to set up basic event listeners
            this.setupEventListeners();
            
            // Set up real-time validation
            this.setupRealTimeValidation();
            
            // Set up prompts section if possible
            if (availableFeatures.includes('SystemPromptsManager')) {
                try {
                    this.initializePromptsSection();
                } catch (error) {
                    this.debug.warn('Error initializing prompts section:', error);
                }
            }
            
            // Load initial data if LLMManager is available
            if (availableFeatures.includes('LLMManager')) {
                try {
                    await this.loadInitialData();
                } catch (error) {
                    this.debug.warn('Error loading initial data:', error);
                }
            }
            
        } catch (error) {
            this.debug.error('Error setting up UI with available features:', error);
            throw new Error('UI setup failed: ' + error.message);
        }
    }
    
    /**
     * Setup real-time validation for form fields
     */
    setupRealTimeValidation() {
        try {
            // Set up validation for configuration modal when it opens
            document.addEventListener('DOMContentLoaded', () => {
                this.setupConfigurationModalValidation();
            });
            
            // Also set up validation when modal is shown
            const configModal = document.getElementById('configModal');
            if (configModal) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                            const modal = mutation.target;
                            if (modal.style.display !== 'none' && modal.style.display !== '') {
                                // Modal is being shown
                                setTimeout(() => {
                                    this.setupConfigurationModalValidation();
                                }, 100);
                            }
                        }
                    });
                });
                
                observer.observe(configModal, { attributes: true });
            }
            
        } catch (error) {
            this.debug.warn('Error setting up real-time validation:', error);
        }
    }
    
    /**
     * Setup validation for configuration modal fields
     */
    setupConfigurationModalValidation() {
        try {
            // Basic field validation
            const basicFields = [
                { id: 'agentName', validator: this.validateAgentName.bind(this) },
                { id: 'agentDescription', validator: this.validateAgentDescription.bind(this) },
                { id: 'agentPriority', validator: this.validateAgentPriority.bind(this) },
                { id: 'maxTokens', validator: this.validateMaxTokens.bind(this) },
                { id: 'temperature', validator: this.validateTemperature.bind(this) }
            ];
            
            basicFields.forEach(({ id, validator }) => {
                const element = document.getElementById(id);
                if (element) {
                    // Remove existing listeners to avoid duplicates
                    element.removeEventListener('input', validator);
                    element.removeEventListener('blur', validator);
                    
                    // Add new listeners
                    element.addEventListener('input', validator);
                    element.addEventListener('blur', validator);
                }
            });
            
            // Default Agent system prompts validation
            const systemPromptsFields = [
                { id: 'defaultBasePersonality', validator: this.validateBasePersonality.bind(this) },
                { id: 'defaultFinancialContext', validator: this.validateFinancialContext.bind(this) },
                { id: 'defaultResponseInstructions', validator: this.validateResponseInstructions.bind(this) }
            ];
            
            systemPromptsFields.forEach(({ id, validator }) => {
                const element = document.getElementById(id);
                if (element) {
                    // Remove existing listeners to avoid duplicates
                    element.removeEventListener('input', validator);
                    element.removeEventListener('blur', validator);
                    
                    // Add new listeners
                    element.addEventListener('input', validator);
                    element.addEventListener('blur', validator);
                }
            });
            
            this.debug.log('Configuration modal validation setup completed');
            
        } catch (error) {
            this.debug.warn('Error setting up configuration modal validation:', error);
        }
    }
    
    /**
     * Validate agent name field
     * @param {Event} event - Input event
     */
    validateAgentName(event) {
        const input = event.target;
        const value = input.value.trim();
        const validationMessage = this.getOrCreateValidationMessage(input);
        
        this.clearFieldValidation(input, validationMessage);
        
        if (!value) {
            this.showFieldValidationError(input, validationMessage, 'Agent name is required');
            return false;
        }
        
        if (value.length < 2) {
            this.showFieldValidationError(input, validationMessage, 'Agent name must be at least 2 characters long');
            return false;
        }
        
        if (value.length > 50) {
            this.showFieldValidationError(input, validationMessage, 'Agent name must be less than 50 characters');
            return false;
        }
        
        return true;
    }
    
    /**
     * Validate agent description field
     * @param {Event} event - Input event
     */
    validateAgentDescription(event) {
        const input = event.target;
        const value = input.value.trim();
        const validationMessage = this.getOrCreateValidationMessage(input);
        
        this.clearFieldValidation(input, validationMessage);
        
        if (!value) {
            this.showFieldValidationError(input, validationMessage, 'Agent description is required');
            return false;
        }
        
        if (value.length < 10) {
            this.showFieldValidationError(input, validationMessage, 'Agent description must be at least 10 characters long');
            return false;
        }
        
        if (value.length > 500) {
            this.showFieldValidationError(input, validationMessage, 'Agent description must be less than 500 characters');
            return false;
        }
        
        return true;
    }
    
    /**
     * Validate agent priority field
     * @param {Event} event - Input event
     */
    validateAgentPriority(event) {
        const input = event.target;
        const value = input.value;
        const validationMessage = this.getOrCreateValidationMessage(input);
        
        this.clearFieldValidation(input, validationMessage);
        
        if (value === '' || value === null || value === undefined) {
            this.showFieldValidationError(input, validationMessage, 'Priority is required');
            return false;
        }
        
        const priorityNum = parseInt(value);
        if (isNaN(priorityNum) || priorityNum < 0 || priorityNum > 10) {
            this.showFieldValidationError(input, validationMessage, 'Priority must be a number between 0 and 10');
            return false;
        }
        
        return true;
    }
    
    /**
     * Validate max tokens field
     * @param {Event} event - Input event
     */
    validateMaxTokens(event) {
        const input = event.target;
        const value = input.value;
        const validationMessage = this.getOrCreateValidationMessage(input);
        
        this.clearFieldValidation(input, validationMessage);
        
        if (value === '' || value === null || value === undefined) {
            this.showFieldValidationError(input, validationMessage, 'Max Tokens is required');
            return false;
        }
        
        const maxTokensNum = parseInt(value);
        if (isNaN(maxTokensNum) || maxTokensNum < 1 || maxTokensNum > 8000) {
            this.showFieldValidationError(input, validationMessage, 'Max Tokens must be a number between 1 and 8000');
            return false;
        }
        
        if (maxTokensNum > 4000) {
            this.showFieldValidationWarning(input, validationMessage, 'High token limit may result in increased API costs');
        }
        
        return true;
    }
    
    /**
     * Validate temperature field
     * @param {Event} event - Input event
     */
    validateTemperature(event) {
        const input = event.target;
        const value = input.value;
        const validationMessage = this.getOrCreateValidationMessage(input);
        
        this.clearFieldValidation(input, validationMessage);
        
        if (value === '' || value === null || value === undefined) {
            this.showFieldValidationError(input, validationMessage, 'Temperature is required');
            return false;
        }
        
        const temperatureNum = parseFloat(value);
        if (isNaN(temperatureNum) || temperatureNum < 0 || temperatureNum > 2) {
            this.showFieldValidationError(input, validationMessage, 'Temperature must be a number between 0 and 2');
            return false;
        }
        
        if (temperatureNum > 1.5) {
            this.showFieldValidationWarning(input, validationMessage, 'High temperature may result in unpredictable responses');
        }
        
        return true;
    }
    
    /**
     * Validate base personality field
     * @param {Event} event - Input event
     */
    validateBasePersonality(event) {
        const input = event.target;
        const value = input.value.trim();
        const validationMessage = this.getOrCreateValidationMessage(input);
        
        this.clearFieldValidation(input, validationMessage);
        
        if (!value) {
            this.showFieldValidationError(input, validationMessage, 'Base AI Personality is required');
            return false;
        }
        
        if (value.length < 20) {
            this.showFieldValidationError(input, validationMessage, 'Base AI Personality must be at least 20 characters long');
            return false;
        }
        
        if (value.length > 2000) {
            this.showFieldValidationError(input, validationMessage, 'Base AI Personality must be less than 2000 characters');
            return false;
        }
        
        if (value.length < 50) {
            this.showFieldValidationWarning(input, validationMessage, 'Consider adding more detail to the personality description');
        }
        
        if (this.containsProblematicContent(value)) {
            this.showFieldValidationWarning(input, validationMessage, 'Content may contain patterns that could affect AI behavior');
        }
        
        return true;
    }
    
    /**
     * Validate financial context field
     * @param {Event} event - Input event
     */
    validateFinancialContext(event) {
        const input = event.target;
        const value = input.value.trim();
        const validationMessage = this.getOrCreateValidationMessage(input);
        
        this.clearFieldValidation(input, validationMessage);
        
        if (!value) {
            this.showFieldValidationError(input, validationMessage, 'Financial Services Context is required');
            return false;
        }
        
        if (value.length < 20) {
            this.showFieldValidationError(input, validationMessage, 'Financial Services Context must be at least 20 characters long');
            return false;
        }
        
        if (value.length > 3000) {
            this.showFieldValidationError(input, validationMessage, 'Financial Services Context must be less than 3000 characters');
            return false;
        }
        
        if (value.length < 100) {
            this.showFieldValidationWarning(input, validationMessage, 'Consider adding more banking-specific guidance');
        }
        
        return true;
    }
    
    /**
     * Validate response instructions field
     * @param {Event} event - Input event
     */
    validateResponseInstructions(event) {
        const input = event.target;
        const value = input.value.trim();
        const validationMessage = this.getOrCreateValidationMessage(input);
        
        this.clearFieldValidation(input, validationMessage);
        
        if (!value) {
            this.showFieldValidationError(input, validationMessage, 'Response Instructions are required');
            return false;
        }
        
        if (value.length < 10) {
            this.showFieldValidationError(input, validationMessage, 'Response Instructions must be at least 10 characters long');
            return false;
        }
        
        if (value.length > 1500) {
            this.showFieldValidationError(input, validationMessage, 'Response Instructions must be less than 1500 characters');
            return false;
        }
        
        return true;
    }
    
    /**
     * Get or create validation message element for a field
     * @param {HTMLElement} field - The form field
     * @returns {HTMLElement} Validation message element
     */
    getOrCreateValidationMessage(field) {
        let validationMessage = field.parentElement?.querySelector('.validation-message');
        
        if (!validationMessage) {
            validationMessage = document.createElement('div');
            validationMessage.className = 'validation-message';
            validationMessage.style.cssText = 'color: #e74c3c; font-size: 0.8em; margin-top: 5px; display: none;';
            field.parentElement?.appendChild(validationMessage);
        }
        
        return validationMessage;
    }
    
    /**
     * Clear field validation styling and message
     * @param {HTMLElement} field - The form field
     * @param {HTMLElement} validationMessage - The validation message element
     */
    clearFieldValidation(field, validationMessage) {
        field.style.borderColor = '';
        validationMessage.style.display = 'none';
        validationMessage.textContent = '';
        validationMessage.style.color = '#e74c3c';
    }
    
    /**
     * Show field validation error
     * @param {HTMLElement} field - The form field
     * @param {HTMLElement} validationMessage - The validation message element
     * @param {string} message - Error message
     */
    showFieldValidationError(field, validationMessage, message) {
        field.style.borderColor = '#e74c3c';
        validationMessage.textContent = message;
        validationMessage.style.color = '#e74c3c';
        validationMessage.style.display = 'block';
    }
    
    /**
     * Show field validation warning
     * @param {HTMLElement} field - The form field
     * @param {HTMLElement} validationMessage - The validation message element
     * @param {string} message - Warning message
     */
    showFieldValidationWarning(field, validationMessage, message) {
        field.style.borderColor = '#f39c12';
        validationMessage.textContent = message;
        validationMessage.style.color = '#f39c12';
        validationMessage.style.display = 'block';
    }
    
    /**
     * Validate prompt content
     * @param {HTMLTextAreaElement} textarea - The textarea element
     * @param {HTMLElement} validationMessage - The validation message element
     * @param {string} value - The value to validate
     * @returns {boolean} True if valid, false otherwise
     */
    validatePromptContent(textarea, validationMessage, value) {
        // Clear previous validation
        textarea.style.borderColor = '';
        validationMessage.style.display = 'none';
        validationMessage.textContent = '';
        
        if (!value) {
            this.showValidationError(textarea, validationMessage, 'Prompt content is required');
            return false;
        }
        
        if (value.length > 1000) {
            this.showValidationError(textarea, validationMessage, 'Prompt content must be 1000 characters or less');
            return false;
        }
        
        return true;
    }
    
    /**
     * Show validation error
     * @param {HTMLElement} input - The input element
     * @param {HTMLElement} messageElement - The validation message element
     * @param {string} message - The error message
     */
    showValidationError(input, messageElement, message) {
        input.style.borderColor = '#e74c3c';
        messageElement.textContent = message;
        messageElement.style.display = 'block';
    }
    
    /**
     * Update character counter
     * @param {HTMLTextAreaElement} textarea - The textarea element
     * @param {HTMLElement} counter - The counter element
     */
    updateCharCounter(textarea, counter) {
        if (counter) {
            const length = textarea.value.length;
            counter.textContent = `${length}/1000`;
            
            if (length > 900) {
                counter.style.color = '#e74c3c';
            } else if (length > 800) {
                counter.style.color = '#f39c12';
            } else {
                counter.style.color = '#7f8c8d';
            }
        }
    }
    
    /**
     * Open guardrails editor
     */
    openGuardrailsEditor(agentName) {
        this.currentAgent = agentName;
        this.switchSection('guardrails');
        this.loadGuardrailsEditor(agentName);
    }
    
    /**
     * Load guardrails content
     */
    async loadGuardrailsContent() {
        const content = document.getElementById('guardrailsContent');
        if (!content) return;
        
        // Ensure Default Agent is loaded before getting configurations
        await this.ensureDefaultAgentLoaded();
        
        const agents = this.llmManager.getAgentConfigurations();
        
        // Sort agents to put Default Agent first
        const sortedAgentNames = Object.keys(agents).sort((a, b) => {
            if (a === 'DefaultAgent') return -1;
            if (b === 'DefaultAgent') return 1;
            return a.localeCompare(b);
        });
        
        content.innerHTML = `
            <div class="form-group">
                <label class="form-label">Select Agent</label>
                <select class="form-select" id="guardrailsAgentSelect" onchange="loadGuardrailsEditor(this.value)">
                    <option value="">Choose an agent...</option>
                    ${sortedAgentNames.map(name => 
                        `<option value="${name}">${name}${name === 'DefaultAgent' ? ' (Primary Agent)' : ''}</option>`
                    ).join('')}
                </select>
            </div>
            
            <div id="guardrailsEditor" style="display: none;">
                <!-- Guardrails editor will be loaded here -->
            </div>
        `;
        
        // Auto-select current agent if set
        if (this.currentAgent) {
            document.getElementById('guardrailsAgentSelect').value = this.currentAgent;
            this.loadGuardrailsEditor(this.currentAgent);
        }
    }
    
    /**
     * Load guardrails editor for specific agent
     */
    loadGuardrailsEditor(agentName) {
        if (!agentName) {
            document.getElementById('guardrailsEditor').style.display = 'none';
            return;
        }
        
        const guardrails = this.guardrailsManager.getGuardrails(agentName) || {};
        const editor = document.getElementById('guardrailsEditor');
        
        editor.style.display = 'block';
        editor.innerHTML = `
            <h3>Guardrails for ${agentName}</h3>
            
            <h4>Allowed Capabilities</h4>
            <div class="toggle-group">
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Access Account Data</div>
                        <div class="toggle-description">Allow access to customer account information</div>
                    </div>
                    <div class="toggle-switch ${guardrails.allowedCapabilities?.canAccessAccountData ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-capability="canAccessAccountData"></div>
                </div>
                
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Initiate Transactions</div>
                        <div class="toggle-description">Allow initiating money transfers and payments</div>
                    </div>
                    <div class="toggle-switch ${guardrails.allowedCapabilities?.canInitiateTransactions ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-capability="canInitiateTransactions"></div>
                </div>
                
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Block Cards</div>
                        <div class="toggle-description">Allow blocking/freezing customer cards</div>
                    </div>
                    <div class="toggle-switch ${guardrails.allowedCapabilities?.canBlockCards ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-capability="canBlockCards"></div>
                </div>
                
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Reset Passwords</div>
                        <div class="toggle-description">Allow password reset operations</div>
                    </div>
                    <div class="toggle-switch ${guardrails.allowedCapabilities?.canResetPasswords ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-capability="canResetPasswords"></div>
                </div>
                
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Access Transaction History</div>
                        <div class="toggle-description">Allow viewing transaction history</div>
                    </div>
                    <div class="toggle-switch ${guardrails.allowedCapabilities?.canAccessTransactionHistory ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-capability="canAccessTransactionHistory"></div>
                </div>
                
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Provide Balance Info</div>
                        <div class="toggle-description">Allow providing account balance information</div>
                    </div>
                    <div class="toggle-switch ${guardrails.allowedCapabilities?.canProvideBalanceInfo ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-capability="canProvideBalanceInfo"></div>
                </div>
            </div>
            
            <h4>Restrictions</h4>
            <div class="form-group">
                <label class="form-label">Max Transaction Amount (£)</label>
                <input type="number" class="form-input" id="maxTransactionAmount" 
                       value="${guardrails.restrictions?.maxTransactionAmount || 0}" min="0" step="0.01">
            </div>
            
            <div class="form-group">
                <label class="form-label">Blocked Keywords</label>
                <textarea class="form-textarea" id="blockedKeywords" rows="3" 
                          placeholder="Enter blocked keywords, one per line">${(guardrails.restrictions?.blockedKeywords || []).join('\n')}</textarea>
            </div>
            
            <h4>Secondary Authentication</h4>
            <div id="secondaryAuthConfig">
                ${this.renderSecondaryAuthConfig(agentName, guardrails)}
            </div>
            
            <h4>Custom Prompts</h4>
            <div id="customPromptsConfig">
                ${this.renderCustomPromptsConfig(agentName, guardrails)}
            </div>
            
            <h4>Compliance Rules</h4>
            <div class="toggle-group">
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Log All Actions</div>
                        <div class="toggle-description">Log every action performed by this agent</div>
                    </div>
                    <div class="toggle-switch ${guardrails.complianceRules?.logAllActions ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-compliance="logAllActions"></div>
                </div>
                
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Require Audit Trail</div>
                        <div class="toggle-description">Maintain detailed audit trail</div>
                    </div>
                    <div class="toggle-switch ${guardrails.complianceRules?.requireAuditTrail ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-compliance="requireAuditTrail"></div>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Data Retention Days</label>
                <input type="number" class="form-input" id="dataRetentionDays" 
                       value="${guardrails.complianceRules?.dataRetentionDays || 90}" min="1">
            </div>
            
            <div style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="saveGuardrails('${agentName}')">
                    Save Guardrails
                </button>
                <button class="btn btn-secondary" onclick="testGuardrails('${agentName}')">
                    Test Guardrails
                </button>
            </div>
        `;
        
        this.logAuditEvent('guardrails', `Opened guardrails editor for ${agentName}`);
    }
    
    /**
     * Save guardrails configuration
     */
    saveGuardrails(agentName) {
        try {
            // Collect capabilities
            const capabilities = {};
            document.querySelectorAll('[data-capability]').forEach(toggle => {
                const capability = toggle.dataset.capability;
                capabilities[capability] = toggle.classList.contains('active');
            });
            
            // Collect compliance rules
            const complianceRules = {};
            document.querySelectorAll('[data-compliance]').forEach(toggle => {
                const rule = toggle.dataset.compliance;
                complianceRules[rule] = toggle.classList.contains('active');
            });
            
            // Collect secondary auth configuration
            const requiresSecondaryAuth = {};
            document.querySelectorAll('[data-auth-action]').forEach(toggle => {
                const action = toggle.dataset.authAction;
                const enabled = toggle.classList.contains('active');
                
                if (enabled) {
                    const authTypeSelect = document.querySelector(`[data-auth-type="${action}"]`);
                    requiresSecondaryAuth[action] = {
                        enabled: true,
                        authType: authTypeSelect ? authTypeSelect.value : 'sms',
                        prompt: 'default'
                    };
                }
            });
            
            // Collect custom prompts
            const prompts = {
                secondaryAuth: {},
                restrictionBlocked: {},
                compliance: {}
            };
            
            document.querySelectorAll('.prompt-textarea').forEach(textarea => {
                const category = textarea.dataset.promptCategory;
                const key = textarea.dataset.promptKey;
                const value = textarea.value.trim();
                
                if (value && prompts[category]) {
                    prompts[category][key] = value;
                }
            });
            
            // Collect other restrictions
            const blockedKeywords = document.getElementById('blockedKeywords').value
                .split('\n')
                .map(keyword => keyword.trim())
                .filter(keyword => keyword.length > 0);
            
            const guardrails = {
                allowedCapabilities: capabilities,
                restrictions: {
                    maxTransactionAmount: parseFloat(document.getElementById('maxTransactionAmount').value) || 0,
                    requiresSecondaryAuth: requiresSecondaryAuth,
                    blockedKeywords: blockedKeywords,
                    timeBasedRestrictions: {}
                },
                prompts: prompts,
                complianceRules: {
                    ...complianceRules,
                    dataRetentionDays: parseInt(document.getElementById('dataRetentionDays').value) || 90
                }
            };
            
            const success = this.guardrailsManager.setGuardrails(agentName, guardrails);
            
            if (success) {
                this.showSuccess('Guardrails saved successfully');
                this.logAuditEvent('guardrails', `Updated guardrails for ${agentName}`, guardrails);
            } else {
                this.showError('Failed to save guardrails');
            }
            
        } catch (error) {
            this.debug.error('Error saving guardrails:', error);
            this.showError('Error saving guardrails: ' + error.message);
        }
    }
    
    /**
     * Render secondary authentication configuration
     */
    renderSecondaryAuthConfig(agentName, guardrails) {
        const availableActions = this.guardrailsManager.getAvailableAuthActions(agentName);
        const authTypes = this.guardrailsManager.getAuthenticationTypes();
        const currentAuth = guardrails.restrictions?.requiresSecondaryAuth || {};
        
        return `
            <div class="auth-config-container">
                ${availableActions.map(action => {
                    const config = currentAuth[action.action] || { enabled: false, authType: 'sms', prompt: 'default' };
                    return `
                        <div class="auth-action-config">
                            <div class="auth-action-header">
                                <div class="toggle-switch ${config.enabled ? 'active' : ''}" 
                                     onclick="this.classList.toggle('active'); toggleAuthAction(this);" 
                                     data-auth-action="${action.action}"></div>
                                <span class="auth-action-label">${action.label}</span>
                            </div>
                            <div class="auth-action-details" style="display: ${config.enabled ? 'block' : 'none'}">
                                <div class="form-group">
                                    <label class="form-label">Authentication Type</label>
                                    <select class="form-select" data-auth-type="${action.action}">
                                        ${Object.entries(authTypes).map(([key, label]) => 
                                            `<option value="${key}" ${config.authType === key ? 'selected' : ''}>${label}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Render custom prompts configuration
     */
    renderCustomPromptsConfig(agentName, guardrails) {
        const promptTemplates = this.guardrailsManager.getPromptTemplates();
        const currentPrompts = guardrails.prompts || {};
        
        return `
            <div class="prompts-config-container">
                <div class="prompt-section">
                    <h5>Secondary Authentication Prompts</h5>
                    ${this.renderPromptCategory('secondaryAuth', promptTemplates.secondaryAuth, currentPrompts.secondaryAuth || {}, agentName)}
                </div>
                
                <div class="prompt-section">
                    <h5>Restriction Blocked Prompts</h5>
                    ${this.renderPromptCategory('restrictionBlocked', promptTemplates.restrictionBlocked, currentPrompts.restrictionBlocked || {}, agentName)}
                </div>
                
                <div class="prompt-section">
                    <h5>Compliance Prompts</h5>
                    ${this.renderPromptCategory('compliance', promptTemplates.compliance, currentPrompts.compliance || {}, agentName)}
                </div>
            </div>
        `;
    }

    /**
     * Render prompt category
     */
    renderPromptCategory(category, templates, currentPrompts, agentName) {
        return Object.entries(templates).map(([key, defaultPrompt]) => `
            <div class="prompt-config-item">
                <label class="form-label">${this.formatPromptLabel(key)}</label>
                <div class="prompt-input-group">
                    <textarea class="form-textarea prompt-textarea" 
                              data-prompt-category="${category}" 
                              data-prompt-key="${key}"
                              rows="2" 
                              placeholder="${defaultPrompt}">${currentPrompts[key] || ''}</textarea>
                    <button class="btn btn-small btn-secondary" 
                            onclick="usePromptTemplate(this);"
                            data-template="${defaultPrompt.replace(/"/g, '&quot;')}">
                        Use Template
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * Format prompt label for display
     */
    formatPromptLabel(key) {
        return key.replace(/([A-Z])/g, ' $1')
                  .replace(/^./, str => str.toUpperCase())
                  .replace(/([a-z])([A-Z])/g, '$1 $2');
    }

    /**
     * Test guardrails
     */
    testGuardrails(agentName) {
        const testActions = [
            { action: 'getAccountData', context: {} },
            { action: 'initiateTransfer', context: { amount: 500 } },
            { action: 'blockCard', context: {} },
            { action: 'transfer money', context: {} } // Should be blocked by keyword
        ];
        
        let results = `Guardrails Test Results for ${agentName}:\n\n`;
        
        testActions.forEach(test => {
            const result = this.guardrailsManager.validateAction(agentName, test.action, test.context);
            const status = result.allowed ? '✅ ALLOWED' : '❌ BLOCKED';
            results += `${status}: "${test.action}" - ${result.reason}\n`;
            if (result.prompt) {
                results += `   Prompt: "${result.prompt}"\n`;
            }
            if (result.authType) {
                results += `   Auth Type: ${result.authType}\n`;
            }
        });
        
        alert(results);
        this.logAuditEvent('guardrails', `Tested guardrails for ${agentName}`);
    }
    
    /**
     * Open voice configuration
     */
    openVoiceConfig(agentName) {
        this.currentAgent = agentName;
        this.switchSection('voice');
        this.loadVoiceEditor(agentName);
    }
    
    /**
     * Load voice content
     */
    async loadVoiceContent() {
        const content = document.getElementById('voiceContent');
        if (!content) return;
        
        // Ensure Default Agent is loaded before getting configurations
        await this.ensureDefaultAgentLoaded();
        
        const agents = this.llmManager.getAgentConfigurations();
        
        // Sort agents to put Default Agent first
        const sortedAgentNames = Object.keys(agents).sort((a, b) => {
            if (a === 'DefaultAgent') return -1;
            if (b === 'DefaultAgent') return 1;
            return a.localeCompare(b);
        });
        
        content.innerHTML = `
            <div class="form-group">
                <label class="form-label">Select Agent</label>
                <select class="form-select" id="voiceAgentSelect" onchange="loadVoiceEditor(this.value)">
                    <option value="">Choose an agent...</option>
                    ${sortedAgentNames.map(name => 
                        `<option value="${name}">${name}${name === 'DefaultAgent' ? ' (Primary Agent)' : ''}</option>`
                    ).join('')}
                </select>
            </div>
            
            <div id="voiceEditor" style="display: none;">
                <!-- Voice editor will be loaded here -->
            </div>
        `;
        
        // Auto-select current agent if set
        if (this.currentAgent) {
            document.getElementById('voiceAgentSelect').value = this.currentAgent;
            this.loadVoiceEditor(this.currentAgent);
        }
    }
    
    /**
     * Load voice editor for specific agent
     */
    loadVoiceEditor(agentName) {
        if (!agentName) {
            document.getElementById('voiceEditor').style.display = 'none';
            return;
        }
        
        const voiceConfig = this.voiceConfigManager.getVoiceConfig(agentName) || {};
        const ttsSettings = voiceConfig.ttsSettings || {};
        const personalityTraits = voiceConfig.personalityTraits || {};
        const contextualAdaptation = voiceConfig.contextualAdaptation || {};
        
        const editor = document.getElementById('voiceEditor');
        editor.style.display = 'block';
        
        const availableVoices = {
            openai: this.voiceConfigManager.getAvailableVoices('openai'),
            elevenlabs: this.voiceConfigManager.getAvailableVoices('elevenlabs'),
            azure: this.voiceConfigManager.getAvailableVoices('azure')
        };
        
        editor.innerHTML = `
            <h3>Voice Configuration for ${agentName}</h3>
            
            <h4>TTS Settings</h4>
            <div class="form-group">
                <label class="form-label">TTS Provider</label>
                <select class="form-select" id="ttsProvider" onchange="updateVoiceOptions()">
                    <option value="openai" ${ttsSettings.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                    <option value="elevenlabs" ${ttsSettings.provider === 'elevenlabs' ? 'selected' : ''}>ElevenLabs</option>
                    <option value="azure" ${ttsSettings.provider === 'azure' ? 'selected' : ''}>Azure</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Voice</label>
                <select class="form-select" id="voiceSelect">
                    ${this.generateVoiceOptions(ttsSettings.provider || 'openai', ttsSettings.voice, availableVoices)}
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Speed</label>
                <input type="range" class="form-input" id="voiceSpeed" value="${ttsSettings.speed || 1.0}" 
                       min="0.25" max="4.0" step="0.1" oninput="document.getElementById('speedValue').textContent = this.value">
                <span id="speedValue">${ttsSettings.speed || 1.0}</span>
            </div>
            
            <div class="form-group">
                <label class="form-label">Pitch</label>
                <input type="range" class="form-input" id="voicePitch" value="${ttsSettings.pitch || 0}" 
                       min="-20" max="20" step="1" oninput="document.getElementById('pitchValue').textContent = this.value">
                <span id="pitchValue">${ttsSettings.pitch || 0}</span>
            </div>
            
            <div class="form-group">
                <label class="form-label">Volume</label>
                <input type="range" class="form-input" id="voiceVolume" value="${ttsSettings.volume || 0.8}" 
                       min="0" max="1" step="0.1" oninput="document.getElementById('volumeValue').textContent = this.value">
                <span id="volumeValue">${ttsSettings.volume || 0.8}</span>
            </div>
            
            <h4>Personality Traits</h4>
            <div class="form-group">
                <label class="form-label">Tone</label>
                <select class="form-select" id="personalityTone">
                    <option value="professional" ${personalityTraits.tone === 'professional' ? 'selected' : ''}>Professional</option>
                    <option value="friendly" ${personalityTraits.tone === 'friendly' ? 'selected' : ''}>Friendly</option>
                    <option value="authoritative" ${personalityTraits.tone === 'authoritative' ? 'selected' : ''}>Authoritative</option>
                    <option value="empathetic" ${personalityTraits.tone === 'empathetic' ? 'selected' : ''}>Empathetic</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Formality</label>
                <select class="form-select" id="personalityFormality">
                    <option value="casual" ${personalityTraits.formality === 'casual' ? 'selected' : ''}>Casual</option>
                    <option value="professional" ${personalityTraits.formality === 'professional' ? 'selected' : ''}>Professional</option>
                    <option value="formal" ${personalityTraits.formality === 'formal' ? 'selected' : ''}>Formal</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Enthusiasm (1-10)</label>
                <input type="range" class="form-input" id="personalityEnthusiasm" value="${personalityTraits.enthusiasm || 5}" 
                       min="1" max="10" step="1" oninput="document.getElementById('enthusiasmValue').textContent = this.value">
                <span id="enthusiasmValue">${personalityTraits.enthusiasm || 5}</span>
            </div>
            
            <div class="form-group">
                <label class="form-label">Empathy (1-10)</label>
                <input type="range" class="form-input" id="personalityEmpathy" value="${personalityTraits.empathy || 6}" 
                       min="1" max="10" step="1" oninput="document.getElementById('empathyValue').textContent = this.value">
                <span id="empathyValue">${personalityTraits.empathy || 6}</span>
            </div>
            
            <h4>Contextual Adaptation</h4>
            <div class="form-group">
                <label class="form-label">Error Response Tone</label>
                <select class="form-select" id="errorResponseTone">
                    <option value="apologetic" ${contextualAdaptation.errorResponseTone === 'apologetic' ? 'selected' : ''}>Apologetic</option>
                    <option value="calm" ${contextualAdaptation.errorResponseTone === 'calm' ? 'selected' : ''}>Calm</option>
                    <option value="neutral" ${contextualAdaptation.errorResponseTone === 'neutral' ? 'selected' : ''}>Neutral</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Success Response Tone</label>
                <select class="form-select" id="successResponseTone">
                    <option value="confident" ${contextualAdaptation.successResponseTone === 'confident' ? 'selected' : ''}>Confident</option>
                    <option value="friendly" ${contextualAdaptation.successResponseTone === 'friendly' ? 'selected' : ''}>Friendly</option>
                    <option value="neutral" ${contextualAdaptation.successResponseTone === 'neutral' ? 'selected' : ''}>Neutral</option>
                </select>
            </div>
            
            <div class="voice-preview">
                <h4>Voice Preview</h4>
                <div class="preview-controls">
                    <input type="text" class="preview-text" id="previewText" 
                           value="Hello, this is a voice preview for the ${agentName} banking assistant." 
                           placeholder="Enter text to preview...">
                    <button class="btn btn-primary" onclick="previewVoice('${agentName}')">
                        🎤 Preview
                    </button>
                </div>
                <div id="previewResult" style="margin-top: 10px;"></div>
            </div>
            
            <div style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="saveVoiceConfig('${agentName}')">
                    Save Voice Configuration
                </button>
                <button class="btn btn-secondary" onclick="resetVoiceConfig('${agentName}')">
                    Reset to Default
                </button>
            </div>
        `;
        
        this.logAuditEvent('voice', `Opened voice configuration for ${agentName}`);
    }
    
    /**
     * Generate voice options for select dropdown
     */
    generateVoiceOptions(provider, selectedVoice, availableVoices) {
        const voices = availableVoices[provider] || [];
        return voices.map(voice => 
            `<option value="${voice}" ${voice === selectedVoice ? 'selected' : ''}>${voice}</option>`
        ).join('');
    }
    
    /**
     * Update voice options when provider changes
     */
    updateVoiceOptions() {
        const provider = document.getElementById('ttsProvider').value;
        const voiceSelect = document.getElementById('voiceSelect');
        const availableVoices = {
            openai: this.voiceConfigManager.getAvailableVoices('openai'),
            elevenlabs: this.voiceConfigManager.getAvailableVoices('elevenlabs'),
            azure: this.voiceConfigManager.getAvailableVoices('azure')
        };
        
        voiceSelect.innerHTML = this.generateVoiceOptions(provider, '', availableVoices);
    }
    
    /**
     * Preview voice configuration
     */
    async previewVoice(agentName) {
        const previewText = document.getElementById('previewText').value;
        const resultDiv = document.getElementById('previewResult');
        
        if (!previewText.trim()) {
            this.showError('Please enter text to preview');
            return;
        }
        
        // Collect current voice configuration
        const config = {
            ttsSettings: {
                provider: document.getElementById('ttsProvider').value,
                voice: document.getElementById('voiceSelect').value,
                speed: parseFloat(document.getElementById('voiceSpeed').value),
                pitch: parseFloat(document.getElementById('voicePitch').value),
                volume: parseFloat(document.getElementById('voiceVolume').value)
            },
            personalityTraits: {
                tone: document.getElementById('personalityTone').value,
                formality: document.getElementById('personalityFormality').value,
                enthusiasm: parseInt(document.getElementById('personalityEnthusiasm').value),
                empathy: parseInt(document.getElementById('personalityEmpathy').value)
            },
            contextualAdaptation: {
                errorResponseTone: document.getElementById('errorResponseTone').value,
                successResponseTone: document.getElementById('successResponseTone').value
            }
        };
        
        try {
            resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div>Generating preview...</div>';
            
            const preview = await this.voiceConfigManager.previewVoice(config, previewText);
            
            if (preview.success) {
                resultDiv.innerHTML = `
                    <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; padding: 10px; color: #155724;">
                        <strong>Preview Generated Successfully</strong><br>
                        Estimated Duration: ${preview.estimatedDuration} seconds<br>
                        <small>Note: This is a mock preview. In production, actual audio would be generated.</small>
                    </div>
                `;
            } else {
                resultDiv.innerHTML = `
                    <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 10px; color: #721c24;">
                        <strong>Preview Failed:</strong> ${preview.error}
                    </div>
                `;
            }
            
            this.logAuditEvent('voice', `Generated voice preview for ${agentName}`);
            
        } catch (error) {
            this.debug.error('Voice preview error:', error);
            resultDiv.innerHTML = `
                <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 10px; color: #721c24;">
                    <strong>Error:</strong> ${error.message}
                </div>
            `;
        }
    }
    
    /**
     * Save voice configuration
     */
    saveVoiceConfig(agentName) {
        try {
            const config = {
                ttsSettings: {
                    provider: document.getElementById('ttsProvider').value,
                    voice: document.getElementById('voiceSelect').value,
                    speed: parseFloat(document.getElementById('voiceSpeed').value),
                    pitch: parseFloat(document.getElementById('voicePitch').value),
                    volume: parseFloat(document.getElementById('voiceVolume').value)
                },
                personalityTraits: {
                    tone: document.getElementById('personalityTone').value,
                    formality: document.getElementById('personalityFormality').value,
                    enthusiasm: parseInt(document.getElementById('personalityEnthusiasm').value),
                    empathy: parseInt(document.getElementById('personalityEmpathy').value)
                },
                contextualAdaptation: {
                    errorResponseTone: document.getElementById('errorResponseTone').value,
                    successResponseTone: document.getElementById('successResponseTone').value
                }
            };
            
            const success = this.voiceConfigManager.setVoiceConfig(agentName, config);
            
            if (success) {
                this.showSuccess('Voice configuration saved successfully');
                this.logAuditEvent('voice', `Updated voice configuration for ${agentName}`, config);
            } else {
                this.showError('Failed to save voice configuration');
            }
            
        } catch (error) {
            this.debug.error('Error saving voice configuration:', error);
            this.showError('Error saving voice configuration: ' + error.message);
        }
    }
    
    /**
     * Reset voice configuration to default
     */
    resetVoiceConfig(agentName) {
        if (confirm(`Reset voice configuration for ${agentName} to default settings?`)) {
            // This would reset to the default configuration
            this.voiceConfigManager.resetToDefaults();
            this.loadVoiceEditor(agentName);
            this.showSuccess('Voice configuration reset to defaults');
            this.logAuditEvent('voice', `Reset voice configuration for ${agentName} to defaults`);
        }
    }
    
    /**
     * Toggle agent enabled/disabled status
     */
    toggleAgent(agentName) {
        const config = this.llmManager.getAgentConfiguration(agentName);
        if (!config) return;
        
        const newStatus = !config.enabled;
        const success = this.llmManager.updateAgentConfiguration(agentName, { enabled: newStatus });
        
        if (success) {
            this.refreshAgentData();
            this.showSuccess(`Agent ${agentName} ${newStatus ? 'enabled' : 'disabled'}`);
            this.logAuditEvent('config', `${newStatus ? 'Enabled' : 'Disabled'} agent ${agentName}`);
        } else {
            this.showError(`Failed to ${newStatus ? 'enable' : 'disable'} agent`);
        }
    }
    
    /**
     * Export configuration
     */
    exportConfiguration() {
        try {
            const config = this.llmManager.exportConfiguration();
            const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `llm-manager-config-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showSuccess('Configuration exported successfully');
            this.logAuditEvent('system', 'Exported configuration');
            
        } catch (error) {
            this.debug.error('Export error:', error);
            this.showError('Failed to export configuration');
        }
    }
    
    /**
     * Import configuration
     */
    importConfiguration() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    const success = this.llmManager.importConfiguration(config);
                    
                    if (success) {
                        this.refreshAgentData();
                        this.showSuccess('Configuration imported successfully');
                        this.logAuditEvent('system', 'Imported configuration');
                    } else {
                        this.showError('Failed to import configuration');
                    }
                    
                } catch (error) {
                    this.debug.error('Import error:', error);
                    this.showError('Invalid configuration file');
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    /**
     * Reset to defaults
     */
    resetToDefaults() {
        if (confirm('Reset all configurations to defaults? This cannot be undone.')) {
            this.llmManager.resetToDefaults();
            this.refreshAgentData();
            this.showSuccess('All configurations reset to defaults');
            this.logAuditEvent('system', 'Reset all configurations to defaults');
        }
    }
    
    /**
     * Clean up invalid agent configurations
     */
    cleanupInvalidAgents() {
        try {
            if (this.llmManager) {
                const cleaned = this.llmManager.cleanupInvalidAgents();
                if (cleaned) {
                    this.refreshAgentData();
                    this.showSuccess('Invalid agent configurations cleaned up');
                    this.logAuditEvent('system', 'Cleaned up invalid agent configurations');
                } else {
                    this.showSuccess('No invalid agents found - all configurations are valid');
                }
            } else {
                this.showError('LLM Manager not available');
            }
        } catch (error) {
            this.debug.error('Error cleaning up invalid agents:', error);
            this.showError('Failed to cleanup invalid agents');
        }
    }
    
    /**
     * Load audit log
     */
    loadAuditLog() {
        // Load from localStorage or initialize empty
        const stored = localStorage.getItem('llm_manager_audit_log');
        this.auditLog = stored ? JSON.parse(stored) : [];
        this.renderAuditLog();
    }
    
    /**
     * Log audit event
     */
    logAuditEvent(category, action, details = null) {
        const event = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            category,
            action,
            details,
            user: 'admin' // In real implementation, this would be the actual user
        };
        
        this.auditLog.unshift(event);
        
        // Keep only last 1000 events
        if (this.auditLog.length > 1000) {
            this.auditLog = this.auditLog.slice(0, 1000);
        }
        
        // Save to localStorage
        localStorage.setItem('llm_manager_audit_log', JSON.stringify(this.auditLog));
        
        // Update UI if audit section is visible
        const auditSection = document.getElementById('audit-section');
        if (auditSection && auditSection.classList.contains('active')) {
            this.renderAuditLog();
        }
    }
    
    /**
     * Render audit log
     */
    renderAuditLog() {
        const container = document.getElementById('auditLogEntries');
        if (!container) return;
        
        const filter = document.getElementById('logFilter')?.value || 'all';
        const filteredLog = filter === 'all' ? 
            this.auditLog : 
            this.auditLog.filter(event => event.category === filter);
        
        if (filteredLog.length === 0) {
            container.innerHTML = '<div class="loading">No audit events found</div>';
            return;
        }
        
        container.innerHTML = filteredLog.map(event => `
            <div class="log-entry">
                <div class="log-info">
                    <div class="log-action">${event.action}</div>
                    <div class="log-details">
                        Category: ${event.category} | User: ${event.user}
                        ${event.details ? ` | Details: ${typeof event.details === 'object' ? JSON.stringify(event.details).substring(0, 100) + '...' : event.details}` : ''}
                    </div>
                </div>
                <div class="log-timestamp">${new Date(event.timestamp).toLocaleString()}</div>
            </div>
        `).join('');
    }
    
    /**
     * Filter audit log
     */
    filterAuditLog(filter) {
        this.renderAuditLog();
    }
    
    /**
     * Clear audit log
     */
    clearAuditLog() {
        if (confirm('Clear all audit log entries? This cannot be undone.')) {
            this.auditLog = [];
            localStorage.removeItem('llm_manager_audit_log');
            this.renderAuditLog();
            this.showSuccess('Audit log cleared');
        }
    }
    
    /**
     * Refresh audit log
     */
    refreshAuditLog() {
        this.renderAuditLog();
    }
    
    /**
     * Switch tabs in modal
     */
    switchTab(tabBtn) {
        const tabContainer = tabBtn.closest('.modal-body') || tabBtn.closest('.content-section');
        
        // Update tab buttons
        tabContainer.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        tabBtn.classList.add('active');
        
        // Update tab content
        const tabName = tabBtn.dataset.tab;
        tabContainer.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        tabContainer.querySelector(`#${tabName}-tab`).classList.add('active');
    }
    
    /**
     * Show modal
     */
    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }
    
    /**
     * Close modal
     */
    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        this.currentAgent = null;
    }
    
    /**
     * Show success message
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    /**
     * Show error message
     */
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 6px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        `;
        
        // Set background color based on type
        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            warning: '#f39c12',
            info: '#3498db'
        };
        
        notification.style.background = colors[type] || colors.info;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
        
        // Add CSS animations if not already present
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// Export to global scope for browser usage
if (typeof window !== 'undefined') {
    window.LLMManagerAdminUI = LLMManagerAdminUI;
}

// Global functions for HTML onclick handlers
window.adminUI = null;

// System Prompts Management Functions
async function saveAgentPrompts(agentName) {
    console.log(`Saving prompts for ${agentName}...`);
    
    try {
        // Get current agent configuration
        const agentConfig = window.agentConfigManager?.getAgentConfig(agentName);
        if (!agentConfig) {
            showNotification(`Agent configuration not found for ${agentName}`, 'error');
            return;
        }
        
        // Collect prompt data from form fields
        const agentPrefix = agentName.toLowerCase().replace('agent', '');
        const promptData = {
            basePersonality: document.getElementById(`${agentPrefix}-personality`)?.value || '',
            financialContext: document.getElementById(`${agentPrefix}-context`)?.value || '',
            responseInstructions: document.getElementById(`${agentPrefix}-instructions`)?.value || ''
        };
        
        // Preserve existing custom prompts if they exist
        if (agentConfig.systemPrompts && agentConfig.systemPrompts.customPrompts) {
            promptData.customPrompts = agentConfig.systemPrompts.customPrompts;
        }
        
        // Update the agent configuration
        const updatedConfig = {
            ...agentConfig,
            systemPrompts: promptData,
            lastUpdated: new Date().toISOString()
        };
        
        // Save to agent configuration manager
        const success = await window.agentConfigManager.setAgentConfig(agentName, updatedConfig);
        
        if (success) {
            showNotification(`${agentName} prompts saved successfully!`, 'success');
            console.log(`Successfully saved prompts for ${agentName} to config file`);
            
            // Log audit event if available
            if (typeof logAuditEvent === 'function') {
                logAuditEvent('prompts', `Updated system prompts for ${agentName}`);
            }
        } else {
            showNotification(`Failed to save ${agentName} prompts`, 'error');
        }
        
    } catch (error) {
        console.error('Error saving agent prompts:', error);
        showNotification(`Error saving ${agentName} prompts: ${error.message}`, 'error');
    }
}

async function resetAgentPrompts(agentName) {
    if (confirm(`Reset ${agentName} prompts to defaults? This will lose any custom changes.`)) {
        console.log(`Resetting ${agentName} to defaults...`);
        
        try {
            // Reload the original configuration from the config file
            await window.agentConfigManager.loadAgentConfiguration(
                agentName, 
                window.agentConfigManager.getAgentConfigFilePath(agentName)
            );
            
            // Get the fresh configuration
            const agentConfig = window.agentConfigManager.getAgentConfig(agentName);
            if (!agentConfig || !agentConfig.systemPrompts) {
                throw new Error(`No default configuration available for ${agentName}`);
            }
            
            const defaults = agentConfig.systemPrompts;
            
            // Update form fields with defaults
            const agentPrefix = agentName.toLowerCase().replace('agent', '');
            
            if (document.getElementById(`${agentPrefix}-personality`)) {
                document.getElementById(`${agentPrefix}-personality`).value = defaults.basePersonality || '';
            }
            if (document.getElementById(`${agentPrefix}-context`)) {
                document.getElementById(`${agentPrefix}-context`).value = defaults.financialContext || '';
            }
            if (document.getElementById(`${agentPrefix}-instructions`)) {
                document.getElementById(`${agentPrefix}-instructions`).value = defaults.responseInstructions || '';
            }
            
            showNotification(`${agentName} prompts reset to defaults successfully`, 'success');
            console.log(`Successfully reset ${agentName} prompts to config file defaults`);
            
            // Log audit event if available
            if (typeof logAuditEvent === 'function') {
                logAuditEvent('prompts', `Reset system prompts for ${agentName} to defaults`);
            }
            
        } catch (error) {
            console.error('Error resetting agent prompts:', error);
            showNotification(`Error resetting ${agentName} prompts: ${error.message}`, 'error');
        }
    }
}

/**
 * Get built-in default configurations for agents
 * @param {string} agentName - Name of the agent
 * @returns {Object|null} Default configuration or null if not found
 */
function getBuiltInDefaults(agentName) {
    const defaults = {
        'DefaultAgent': {
            basePersonality: "You are a helpful, professional, and friendly AI voice assistant for a UK financial services company. You should be empathetic, clear in your communication, and engaging in conversation. Speak in a conversational tone while being informative and helpful.",
            financialContext: "When handling financial services requests:\n1. Be conversational and natural in your responses\n2. Provide helpful and accurate information about UK banking\n3. Ask clarifying questions when needed\n4. Be patient and understanding with customer concerns\n5. Use UK financial terminology (current account, sort code, etc.)",
            responseInstructions: "Response Guidelines:\n1. Keep responses conversational and concise (suitable for voice)\n2. Use natural speech patterns with contractions (I'll, you're, we'll)\n3. Address users in a friendly manner\n4. Sound human and empathetic, not robotic\n5. Use British English spelling and terminology",
            customPrompts: []
        },
        'FraudAgent': {
            basePersonality: "You are a security-focused AI assistant specializing in fraud detection and prevention for UK financial services. You are vigilant, thorough, and protective while remaining helpful and professional.",
            responseInstructions: "Security Response Guidelines:\n1. Always prioritize customer security and account protection\n2. Be thorough in gathering security-related information\n3. Explain security measures clearly and patiently\n4. Escalate suspicious activities immediately\n5. Maintain confidentiality and follow data protection protocols"
        },
        'PaymentsAgent': {
            basePersonality: "You are a payments specialist AI assistant for UK financial services. You are knowledgeable about payment systems, transfers, and transaction processing while being helpful and efficient.",
            responseInstructions: "Payment Response Guidelines:\n1. Provide clear guidance on payment processes\n2. Explain fees and processing times accurately\n3. Verify payment details carefully\n4. Assist with payment troubleshooting\n5. Ensure compliance with payment regulations"
        },
        'IDVAgent': {
            responseInstructions: "Identity Verification Guidelines:\n1. Follow strict verification protocols\n2. Request appropriate identification documents\n3. Verify information thoroughly and securely\n4. Protect customer privacy throughout the process\n5. Escalate complex verification cases appropriately",
            financialContext: "Identity verification for UK financial services:\n1. Comply with KYC (Know Your Customer) requirements\n2. Use approved verification methods\n3. Maintain audit trails for all verification activities\n4. Follow FCA guidelines for customer identification\n5. Ensure data protection compliance"
        },
        'BankingInfoAgent': {
            responseInstructions: "Banking Information Guidelines:\n1. Provide accurate account and transaction information\n2. Explain banking products and services clearly\n3. Help customers understand their account features\n4. Assist with account management tasks\n5. Maintain customer confidentiality",
            financialContext: "UK Banking Information Context:\n1. Use correct UK banking terminology\n2. Explain account types and features accurately\n3. Provide information about banking hours and holidays\n4. Assist with online and mobile banking queries\n5. Help customers understand fees and charges"
        }
    };
    
    return defaults[agentName] || null;
}

function previewAgentPrompts(agentName) {
    console.log(`Previewing prompts for ${agentName}...`);
    
    try {
        // Collect current configuration
        const currentConfig = collectAgentConfiguration(agentName);
        
        if (!currentConfig) {
            showNotification(`Unable to collect configuration for ${agentName} preview`, 'error');
            return;
        }
        
        // Generate preview content
        const previewContent = generatePromptPreview(agentName, currentConfig);
        
        // Show preview in modal or switch to preview tab
        const previewTab = document.querySelector('[data-tab="prompt-preview"]');
        const agentSelect = document.getElementById('preview-agent-select');
        
        if (previewTab && agentSelect) {
            // Switch to preview tab
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            previewTab.classList.add('active');
            document.getElementById('prompt-preview-tab').classList.add('active');
            
            // Set agent selection and update preview
            agentSelect.value = agentName;
            updatePromptPreview();
        } else {
            // Fallback: show preview in a modal
            showPreviewModal(agentName, previewContent);
        }
        
        // Log audit event
        logAuditEvent('prompts', `Previewed ${agentName} prompt configuration`);
        
    } catch (error) {
        console.error(`Error previewing ${agentName} prompts:`, error);
        showNotification(`Error previewing ${agentName} prompts: ${error.message}`, 'error');
    }
}

/**
 * Generate preview content for agent prompts
 * @param {string} agentName - Name of the agent
 * @param {Object} config - Configuration to preview
 * @returns {string} Formatted preview content
 */
function generatePromptPreview(agentName, config) {
    let preview = `=== ${agentName} Prompt Configuration Preview ===\n\n`;
    
    try {
        // Add configuration sections
        if (config.basePersonality) {
            preview += `🤖 BASE AI PERSONALITY:\n${config.basePersonality}\n\n`;
        }
        
        if (config.financialContext) {
            preview += `🏦 FINANCIAL SERVICES CONTEXT:\n${config.financialContext}\n\n`;
        }
        
        if (config.responseInstructions) {
            preview += `📋 RESPONSE INSTRUCTIONS:\n${config.responseInstructions}\n\n`;
        }
        
        // Add custom prompts for Default Agent
        if (agentName === 'DefaultAgent' && config.customPrompts && config.customPrompts.length > 0) {
            preview += `🎯 CUSTOM SCENARIO PROMPTS:\n`;
            config.customPrompts.forEach((prompt, index) => {
                preview += `${index + 1}. ${prompt.name}:\n   ${prompt.prompt}\n\n`;
            });
        }
        
        // Add metadata
        preview += `📊 CONFIGURATION SUMMARY:\n`;
        preview += `- Agent: ${agentName}\n`;
        preview += `- Total sections: ${Object.keys(config).length}\n`;
        
        if (config.customPrompts) {
            preview += `- Custom prompts: ${config.customPrompts.length}\n`;
        }
        
        const totalLength = JSON.stringify(config).length;
        preview += `- Total size: ${totalLength} characters\n`;
        preview += `- Generated: ${new Date().toLocaleString()}\n`;
        
    } catch (error) {
        preview += `\n❌ Error generating preview: ${error.message}`;
    }
    
    return preview;
}

/**
 * Show preview in a modal dialog
 * @param {string} agentName - Name of the agent
 * @param {string} content - Preview content to display
 */
function showPreviewModal(agentName, content) {
    try {
        // Create modal HTML
        const modalHtml = `
            <div class="modal active" id="previewModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">🔍 ${agentName} Configuration Preview</h3>
                        <button class="close-btn" onclick="closePreviewModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 15px;">
                            <button class="btn btn-secondary btn-sm" onclick="copyPreviewToClipboard()">📋 Copy to Clipboard</button>
                            <button class="btn btn-primary btn-sm" onclick="downloadPreview('${agentName}')">💾 Download</button>
                        </div>
                        <pre id="previewContent" style="background: #f8f9fa; padding: 15px; border-radius: 6px; max-height: 500px; overflow-y: auto; white-space: pre-wrap; font-size: 13px; line-height: 1.4;">${content}</pre>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if present
        const existingModal = document.getElementById('previewModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Store content for clipboard/download functions
        window.currentPreviewContent = content;
        window.currentPreviewAgent = agentName;
        
    } catch (error) {
        console.error('Error showing preview modal:', error);
        // Fallback: show in alert
        alert(`${agentName} Preview:\n\n${content.substring(0, 1000)}${content.length > 1000 ? '...\n\n(Content truncated - see console for full preview)' : ''}`);
        console.log('Full Preview Content:', content);
    }
}

/**
 * Close the preview modal
 */
function closePreviewModal() {
    const modal = document.getElementById('previewModal');
    if (modal) {
        modal.remove();
    }
    
    // Clean up global variables
    delete window.currentPreviewContent;
    delete window.currentPreviewAgent;
}

/**
 * Copy preview content to clipboard
 */
function copyPreviewToClipboard() {
    if (window.currentPreviewContent) {
        navigator.clipboard.writeText(window.currentPreviewContent).then(() => {
            showNotification('Preview content copied to clipboard', 'success');
        }).catch(error => {
            console.error('Failed to copy to clipboard:', error);
            showNotification('Failed to copy to clipboard', 'error');
        });
    }
}

/**
 * Download preview content as a text file
 * @param {string} agentName - Name of the agent
 */
function downloadPreview(agentName) {
    if (window.currentPreviewContent) {
        try {
            const blob = new Blob([window.currentPreviewContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${agentName}_prompt_preview_${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showNotification(`Preview downloaded as ${a.download}`, 'success');
        } catch (error) {
            console.error('Failed to download preview:', error);
            showNotification('Failed to download preview', 'error');
        }
    }
}

function testAgentPrompts(agentName) {
    console.log(`Testing prompts for ${agentName}...`);
    
    try {
        // Collect current configuration from form fields
        const currentConfig = collectAgentConfiguration(agentName);
        
        if (!currentConfig) {
            showNotification(`Unable to collect configuration for ${agentName}`, 'error');
            return;
        }
        
        // Validate configuration
        const validationResult = validateAgentConfiguration(agentName, currentConfig);
        
        if (!validationResult.isValid) {
            showTestResults(agentName, {
                success: false,
                errors: validationResult.errors,
                warnings: validationResult.warnings
            });
            return;
        }
        
        // Run comprehensive tests
        const testResults = runAgentPromptTests(agentName, currentConfig);
        
        // Show results
        showTestResults(agentName, testResults);
        
        // Log audit event
        logAuditEvent('prompts', `Tested ${agentName} prompt configuration - ${testResults.success ? 'PASSED' : 'FAILED'}`);
        
    } catch (error) {
        console.error(`Error testing ${agentName} prompts:`, error);
        showNotification(`Error testing ${agentName} prompts: ${error.message}`, 'error');
    }
}

/**
 * Collect current agent configuration from form fields
 * @param {string} agentName - Name of the agent
 * @returns {Object|null} Current configuration or null if unable to collect
 */
function collectAgentConfiguration(agentName) {
    try {
        switch (agentName) {
            case 'DefaultAgent':
                return {
                    basePersonality: document.getElementById('default-personality')?.value?.trim() || '',
                    financialContext: document.getElementById('default-context')?.value?.trim() || '',
                    responseInstructions: document.getElementById('default-instructions')?.value?.trim() || '',
                    customPrompts: collectCustomPrompts('default-custom-prompts') || []
                };
            case 'FraudAgent':
                return {
                    basePersonality: document.getElementById('fraud-personality')?.value?.trim() || '',
                    responseInstructions: document.getElementById('fraud-instructions')?.value?.trim() || ''
                };
            case 'PaymentsAgent':
                return {
                    basePersonality: document.getElementById('payments-personality')?.value?.trim() || '',
                    responseInstructions: document.getElementById('payments-instructions')?.value?.trim() || ''
                };
            case 'IDVAgent':
                return {
                    responseInstructions: document.getElementById('idv-instructions')?.value?.trim() || '',
                    financialContext: document.getElementById('idv-context')?.value?.trim() || ''
                };
            case 'BankingInfoAgent':
                return {
                    responseInstructions: document.getElementById('banking-instructions')?.value?.trim() || '',
                    financialContext: document.getElementById('banking-context')?.value?.trim() || ''
                };
            default:
                console.warn(`Unknown agent: ${agentName}`);
                return null;
        }
    } catch (error) {
        console.error(`Error collecting configuration for ${agentName}:`, error);
        return null;
    }
}

/**
 * Validate agent configuration
 * @param {string} agentName - Name of the agent
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validation result with isValid, errors, and warnings
 */
function validateAgentConfiguration(agentName, config) {
    const result = {
        isValid: true,
        errors: [],
        warnings: []
    };
    
    try {
        // Common validation rules
        if (config.basePersonality !== undefined) {
            if (!config.basePersonality) {
                result.errors.push('Base AI Personality is required');
                result.isValid = false;
            } else if (config.basePersonality.length < 10) {
                result.warnings.push('Base AI Personality is very short - consider adding more detail');
            } else if (config.basePersonality.length > 2000) {
                result.errors.push('Base AI Personality is too long (max 2000 characters)');
                result.isValid = false;
            }
        }
        
        if (config.financialContext !== undefined) {
            if (!config.financialContext) {
                result.errors.push('Financial Services Context is required');
                result.isValid = false;
            } else if (config.financialContext.length > 3000) {
                result.errors.push('Financial Services Context is too long (max 3000 characters)');
                result.isValid = false;
            }
        }
        
        if (config.responseInstructions !== undefined) {
            if (!config.responseInstructions) {
                result.errors.push('Response Instructions are required');
                result.isValid = false;
            } else if (config.responseInstructions.length > 2000) {
                result.errors.push('Response Instructions are too long (max 2000 characters)');
                result.isValid = false;
            }
        }
        
        // Validate custom prompts for Default Agent
        if (agentName === 'DefaultAgent' && config.customPrompts) {
            if (config.customPrompts.length > 20) {
                result.errors.push('Too many custom prompts (max 20 allowed)');
                result.isValid = false;
            }
            
            config.customPrompts.forEach((prompt, index) => {
                if (!prompt.name || !prompt.name.trim()) {
                    result.errors.push(`Custom prompt ${index + 1} is missing a name`);
                    result.isValid = false;
                } else if (prompt.name.length > 100) {
                    result.errors.push(`Custom prompt ${index + 1} name is too long (max 100 characters)`);
                    result.isValid = false;
                }
                
                if (!prompt.prompt || !prompt.prompt.trim()) {
                    result.errors.push(`Custom prompt ${index + 1} is missing content`);
                    result.isValid = false;
                } else if (prompt.prompt.length > 1000) {
                    result.errors.push(`Custom prompt ${index + 1} content is too long (max 1000 characters)`);
                    result.isValid = false;
                }
            });
            
            // Check for duplicate names
            const names = config.customPrompts.map(p => p.name.toLowerCase().trim());
            const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
            if (duplicates.length > 0) {
                result.errors.push(`Duplicate custom prompt names found: ${[...new Set(duplicates)].join(', ')}`);
                result.isValid = false;
            }
        }
        
        // Agent-specific validation
        switch (agentName) {
            case 'DefaultAgent':
                if (!config.basePersonality || !config.financialContext || !config.responseInstructions) {
                    result.errors.push('Default Agent requires Base AI Personality, Financial Context, and Response Instructions');
                    result.isValid = false;
                }
                break;
            case 'FraudAgent':
                if (!config.basePersonality || !config.responseInstructions) {
                    result.errors.push('Fraud Agent requires Base AI Personality and Response Instructions');
                    result.isValid = false;
                }
                break;
            case 'PaymentsAgent':
                if (!config.basePersonality || !config.responseInstructions) {
                    result.errors.push('Payments Agent requires Base AI Personality and Response Instructions');
                    result.isValid = false;
                }
                break;
            case 'IDVAgent':
                if (!config.responseInstructions || !config.financialContext) {
                    result.errors.push('IDV Agent requires Response Instructions and Financial Context');
                    result.isValid = false;
                }
                break;
            case 'BankingInfoAgent':
                if (!config.responseInstructions || !config.financialContext) {
                    result.errors.push('Banking Info Agent requires Response Instructions and Financial Context');
                    result.isValid = false;
                }
                break;
        }
        
    } catch (error) {
        console.error(`Error validating ${agentName} configuration:`, error);
        result.errors.push(`Validation error: ${error.message}`);
        result.isValid = false;
    }
    
    return result;
}

/**
 * Run comprehensive tests on agent prompt configuration
 * @param {string} agentName - Name of the agent
 * @param {Object} config - Configuration to test
 * @returns {Object} Test results
 */
function runAgentPromptTests(agentName, config) {
    const results = {
        success: true,
        tests: [],
        errors: [],
        warnings: [],
        summary: {}
    };
    
    try {
        // Test 1: Content Quality Analysis
        const contentTest = analyzeContentQuality(agentName, config);
        results.tests.push(contentTest);
        if (!contentTest.passed) results.success = false;
        
        // Test 2: Consistency Check
        const consistencyTest = checkPromptConsistency(agentName, config);
        results.tests.push(consistencyTest);
        if (!consistencyTest.passed) results.success = false;
        
        // Test 3: Integration Test
        const integrationTest = testSystemIntegration(agentName, config);
        results.tests.push(integrationTest);
        if (!integrationTest.passed) results.success = false;
        
        // Test 4: Performance Analysis
        const performanceTest = analyzePerformanceImpact(agentName, config);
        results.tests.push(performanceTest);
        if (!performanceTest.passed) results.success = false;
        
        // Generate summary
        results.summary = {
            totalTests: results.tests.length,
            passed: results.tests.filter(t => t.passed).length,
            failed: results.tests.filter(t => !t.passed).length,
            warnings: results.tests.reduce((acc, t) => acc + (t.warnings || []).length, 0)
        };
        
    } catch (error) {
        console.error(`Error running tests for ${agentName}:`, error);
        results.success = false;
        results.errors.push(`Test execution error: ${error.message}`);
    }
    
    return results;
}

/**
 * Analyze content quality of prompts
 * @param {string} agentName - Name of the agent
 * @param {Object} config - Configuration to analyze
 * @returns {Object} Content quality test result
 */
function analyzeContentQuality(agentName, config) {
    const test = {
        name: 'Content Quality Analysis',
        passed: true,
        details: [],
        warnings: []
    };
    
    try {
        // Check for common issues
        const allText = Object.values(config).filter(v => typeof v === 'string').join(' ').toLowerCase();
        
        // Check for placeholder text
        const placeholders = ['lorem ipsum', 'placeholder', 'todo', 'tbd', 'xxx', 'test test'];
        placeholders.forEach(placeholder => {
            if (allText.includes(placeholder)) {
                test.warnings.push(`Possible placeholder text detected: "${placeholder}"`);
            }
        });
        
        // Check for appropriate tone
        const professionalWords = ['professional', 'helpful', 'courteous', 'respectful', 'clear'];
        const hasProfessionalTone = professionalWords.some(word => allText.includes(word));
        if (!hasProfessionalTone) {
            test.warnings.push('Consider adding more professional tone indicators');
        }
        
        // Check for UK-specific terminology (for financial context)
        if (config.financialContext) {
            const ukTerms = ['current account', 'sort code', 'standing order', 'direct debit', 'bacs'];
            const hasUkTerms = ukTerms.some(term => config.financialContext.toLowerCase().includes(term));
            if (!hasUkTerms) {
                test.warnings.push('Consider adding UK-specific banking terminology');
            }
        }
        
        // Check for voice-appropriate language
        if (config.responseInstructions) {
            const voiceIndicators = ['conversational', 'natural', 'voice', 'spoken', 'speech'];
            const hasVoiceGuidance = voiceIndicators.some(indicator => 
                config.responseInstructions.toLowerCase().includes(indicator)
            );
            if (!hasVoiceGuidance) {
                test.warnings.push('Consider adding voice-specific response guidance');
            }
        }
        
        test.details.push(`Analyzed ${Object.keys(config).length} configuration fields`);
        test.details.push(`Found ${test.warnings.length} potential improvements`);
        
    } catch (error) {
        test.passed = false;
        test.details.push(`Content analysis failed: ${error.message}`);
    }
    
    return test;
}

/**
 * Check consistency between different prompt sections
 * @param {string} agentName - Name of the agent
 * @param {Object} config - Configuration to check
 * @returns {Object} Consistency test result
 */
function checkPromptConsistency(agentName, config) {
    const test = {
        name: 'Prompt Consistency Check',
        passed: true,
        details: [],
        warnings: []
    };
    
    try {
        // Check for conflicting instructions
        const allInstructions = [];
        if (config.basePersonality) allInstructions.push(config.basePersonality.toLowerCase());
        if (config.financialContext) allInstructions.push(config.financialContext.toLowerCase());
        if (config.responseInstructions) allInstructions.push(config.responseInstructions.toLowerCase());
        
        // Check for tone consistency
        const formalWords = ['formal', 'professional', 'official'];
        const informalWords = ['casual', 'friendly', 'relaxed', 'conversational'];
        
        const hasFormal = allInstructions.some(text => formalWords.some(word => text.includes(word)));
        const hasInformal = allInstructions.some(text => informalWords.some(word => text.includes(word)));
        
        if (hasFormal && hasInformal) {
            test.warnings.push('Mixed formal and informal tone detected - ensure consistency');
        }
        
        // Check for contradictory length instructions
        const hasShort = allInstructions.some(text => text.includes('short') || text.includes('brief') || text.includes('concise'));
        const hasLong = allInstructions.some(text => text.includes('detailed') || text.includes('comprehensive') || text.includes('thorough'));
        
        if (hasShort && hasLong) {
            test.warnings.push('Contradictory length instructions detected');
        }
        
        test.details.push('Checked tone and instruction consistency');
        test.details.push(`Found ${test.warnings.length} consistency issues`);
        
    } catch (error) {
        test.passed = false;
        test.details.push(`Consistency check failed: ${error.message}`);
    }
    
    return test;
}

/**
 * Test system integration compatibility
 * @param {string} agentName - Name of the agent
 * @param {Object} config - Configuration to test
 * @returns {Object} Integration test result
 */
function testSystemIntegration(agentName, config) {
    const test = {
        name: 'System Integration Test',
        passed: true,
        details: [],
        warnings: []
    };
    
    try {
        // Test SystemPromptsManager compatibility
        if (window.adminUI?.systemPromptsManager) {
            try {
                // Test if configuration can be saved
                const testSave = window.adminUI.systemPromptsManager.validatePromptData(config);
                if (testSave) {
                    test.details.push('✓ SystemPromptsManager compatibility confirmed');
                } else {
                    test.warnings.push('Configuration may not be compatible with SystemPromptsManager');
                }
            } catch (saveError) {
                test.warnings.push(`SystemPromptsManager integration issue: ${saveError.message}`);
            }
        } else {
            test.warnings.push('SystemPromptsManager not available for integration testing');
        }
        
        // Test LLM Manager compatibility
        if (window.adminUI?.llmManager) {
            try {
                // Test if configuration structure is compatible
                const llmConfig = window.adminUI.convertSystemPromptsToLLMManagerFormat(config);
                if (llmConfig) {
                    test.details.push('✓ LLM Manager format conversion successful');
                } else {
                    test.warnings.push('Configuration may not convert properly to LLM Manager format');
                }
            } catch (conversionError) {
                test.warnings.push(`LLM Manager conversion issue: ${conversionError.message}`);
            }
        } else {
            test.warnings.push('LLM Manager not available for integration testing');
        }
        
        // Test JSON serialization
        try {
            const serialized = JSON.stringify(config);
            const deserialized = JSON.parse(serialized);
            if (JSON.stringify(deserialized) === serialized) {
                test.details.push('✓ JSON serialization test passed');
            } else {
                test.passed = false;
                test.details.push('✗ JSON serialization test failed');
            }
        } catch (jsonError) {
            test.passed = false;
            test.details.push(`✗ JSON serialization failed: ${jsonError.message}`);
        }
        
    } catch (error) {
        test.passed = false;
        test.details.push(`Integration test failed: ${error.message}`);
    }
    
    return test;
}

/**
 * Analyze performance impact of configuration
 * @param {string} agentName - Name of the agent
 * @param {Object} config - Configuration to analyze
 * @returns {Object} Performance test result
 */
function analyzePerformanceImpact(agentName, config) {
    const test = {
        name: 'Performance Impact Analysis',
        passed: true,
        details: [],
        warnings: []
    };
    
    try {
        // Calculate total content size
        let totalSize = 0;
        Object.values(config).forEach(value => {
            if (typeof value === 'string') {
                totalSize += value.length;
            } else if (Array.isArray(value)) {
                value.forEach(item => {
                    if (typeof item === 'object') {
                        totalSize += JSON.stringify(item).length;
                    }
                });
            }
        });
        
        // Size analysis
        if (totalSize > 10000) {
            test.warnings.push(`Large configuration size (${totalSize} characters) may impact performance`);
        } else if (totalSize > 5000) {
            test.warnings.push(`Moderate configuration size (${totalSize} characters)`);
        } else {
            test.details.push(`✓ Optimal configuration size (${totalSize} characters)`);
        }
        
        // Custom prompts analysis for Default Agent
        if (agentName === 'DefaultAgent' && config.customPrompts) {
            const customPromptsCount = config.customPrompts.length;
            if (customPromptsCount > 15) {
                test.warnings.push(`High number of custom prompts (${customPromptsCount}) may slow processing`);
            } else if (customPromptsCount > 10) {
                test.warnings.push(`Moderate number of custom prompts (${customPromptsCount})`);
            } else {
                test.details.push(`✓ Reasonable number of custom prompts (${customPromptsCount})`);
            }
        }
        
        // Complexity analysis
        const complexityScore = calculateComplexityScore(config);
        if (complexityScore > 80) {
            test.warnings.push(`High complexity score (${complexityScore}) may require more processing time`);
        } else if (complexityScore > 60) {
            test.warnings.push(`Moderate complexity score (${complexityScore})`);
        } else {
            test.details.push(`✓ Low complexity score (${complexityScore})`);
        }
        
    } catch (error) {
        test.passed = false;
        test.details.push(`Performance analysis failed: ${error.message}`);
    }
    
    return test;
}

/**
 * Calculate complexity score for configuration
 * @param {Object} config - Configuration to analyze
 * @returns {number} Complexity score (0-100)
 */
function calculateComplexityScore(config) {
    let score = 0;
    
    // Base score for each field
    Object.values(config).forEach(value => {
        if (typeof value === 'string') {
            score += Math.min(value.length / 100, 20); // Max 20 points per string field
        } else if (Array.isArray(value)) {
            score += value.length * 5; // 5 points per array item
        }
    });
    
    // Additional complexity for nested structures
    if (config.customPrompts && Array.isArray(config.customPrompts)) {
        config.customPrompts.forEach(prompt => {
            if (prompt.prompt && prompt.prompt.length > 500) {
                score += 10; // Extra points for long custom prompts
            }
        });
    }
    
    return Math.min(Math.round(score), 100);
}

/**
 * Show test results in a modal or notification
 * @param {string} agentName - Name of the agent
 * @param {Object} results - Test results to display
 */
function showTestResults(agentName, results) {
    try {
        if (results.success) {
            // Show success notification with summary
            const summary = results.summary ? 
                `${results.summary.passed}/${results.summary.totalTests} tests passed` : 
                'All tests passed';
            
            showNotification(`${agentName} configuration test completed successfully! ${summary}`, 'success');
            
            // Log detailed results to console for debugging
            console.log(`Test Results for ${agentName}:`, results);
            
        } else {
            // Show error notification
            const errorCount = results.errors ? results.errors.length : 0;
            const testFailures = results.summary ? results.summary.failed : 0;
            
            showNotification(
                `${agentName} configuration test failed! ${errorCount} errors, ${testFailures} test failures`, 
                'error'
            );
            
            // Show detailed errors in console
            console.error(`Test Failures for ${agentName}:`, results);
            
            // Optionally show detailed error modal
            if (results.errors && results.errors.length > 0) {
                const errorDetails = results.errors.join('\n• ');
                if (confirm(`${agentName} Test Failures:\n\n• ${errorDetails}\n\nWould you like to see detailed test results in the console?`)) {
                    console.table(results.tests);
                }
            }
        }
        
        // Show warnings if any
        const allWarnings = [];
        if (results.warnings) allWarnings.push(...results.warnings);
        if (results.tests) {
            results.tests.forEach(test => {
                if (test.warnings) allWarnings.push(...test.warnings);
            });
        }
        
        if (allWarnings.length > 0) {
            console.warn(`Warnings for ${agentName}:`, allWarnings);
            showNotification(`${agentName} test completed with ${allWarnings.length} warnings (see console)`, 'warning');
        }
        
    } catch (error) {
        console.error('Error displaying test results:', error);
        showNotification(`Error displaying test results: ${error.message}`, 'error');
    }
}

function saveTemplate() {
    const name = document.getElementById('template-name')?.value?.trim();
    const personality = document.getElementById('template-personality')?.value?.trim();
    const instructions = document.getElementById('template-instructions')?.value?.trim();
    
    if (!name) {
        showNotification('Template name is required.', 'error');
        return;
    }
    
    try {
        const templateData = {
            name,
            basePersonality: personality,
            responseInstructions: instructions,
            created: new Date().toISOString()
        };
        
        // Save template (in real implementation, this would go to guardrails manager)
        const existingTemplates = JSON.parse(localStorage.getItem('promptTemplates') || '[]');
        existingTemplates.push(templateData);
        localStorage.setItem('promptTemplates', JSON.stringify(existingTemplates));
        
        // Clear form
        document.getElementById('template-name').value = '';
        document.getElementById('template-personality').value = '';
        document.getElementById('template-instructions').value = '';
        
        showNotification(`Template "${name}" saved successfully!`, 'success');
        logAuditEvent('prompts', `Created prompt template: ${name}`);
        
        // Refresh templates list
        loadTemplatesList();
        
    } catch (error) {
        console.error('Error saving template:', error);
        showNotification(`Error saving template: ${error.message}`, 'error');
    }
}

function editTemplate(templateName) {
    console.log(`Editing template: ${templateName}`);
    // Implementation for editing templates
    showNotification(`Template editing for "${templateName}" - feature coming soon!`, 'info');
}

function deleteTemplate(templateName) {
    if (confirm(`Delete template "${templateName}"? This action cannot be undone.`)) {
        console.log(`Deleting template: ${templateName}`);
        
        try {
            const existingTemplates = JSON.parse(localStorage.getItem('promptTemplates') || '[]');
            const updatedTemplates = existingTemplates.filter(t => t.name !== templateName);
            localStorage.setItem('promptTemplates', JSON.stringify(updatedTemplates));
            
            showNotification(`Template "${templateName}" deleted successfully!`, 'success');
            logAuditEvent('prompts', `Deleted prompt template: ${templateName}`);
            
            // Refresh templates list
            loadTemplatesList();
            
        } catch (error) {
            console.error('Error deleting template:', error);
            showNotification(`Error deleting template: ${error.message}`, 'error');
        }
    }
}

function updatePromptPreview() {
    const agentName = document.getElementById('preview-agent-select')?.value;
    const previewContent = document.getElementById('prompt-preview-content');
    
    if (!agentName || !previewContent) return;
    
    try {
        // Get current prompt configuration from form fields
        const agentPrefix = agentName.toLowerCase().replace('agent', '');
        const promptConfig = {
            basePersonality: document.getElementById(`${agentPrefix}-personality`)?.value || '',
            financialContext: document.getElementById(`${agentPrefix}-context`)?.value || '',
            responseInstructions: document.getElementById(`${agentPrefix}-instructions`)?.value || ''
        };
        
        // Generate preview
        let preview = `System Prompt for ${agentName}:\n\n`;
        
        if (promptConfig.basePersonality) {
            preview += `Base Personality:\n${promptConfig.basePersonality}\n\n`;
        }
        
        if (promptConfig.financialContext) {
            preview += `Financial Context:\n${promptConfig.financialContext}\n\n`;
        }
        
        if (promptConfig.responseInstructions) {
            preview += `Response Instructions:\n${promptConfig.responseInstructions}\n\n`;
        }
        
        if (promptConfig.customPrompts && promptConfig.customPrompts.length > 0) {
            preview += `Custom Scenario Prompts:\n`;
            promptConfig.customPrompts.forEach(customPrompt => {
                preview += `- ${customPrompt.name}: ${customPrompt.prompt}\n`;
            });
            preview += `\n`;
        }
        
        preview += `This preview shows how the configured prompts will be combined into the final system prompt sent to the LLM.`;
        
        previewContent.textContent = preview;
        
    } catch (error) {
        console.error('Error updating prompt preview:', error);
        previewContent.textContent = `Error generating preview: ${error.message}`;
    }
}

function loadTemplatesList() {
    const templatesList = document.getElementById('templates-list');
    if (!templatesList) return;
    
    try {
        const templates = JSON.parse(localStorage.getItem('promptTemplates') || '[]');
        
        if (templates.length === 0) {
            templatesList.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">No templates created yet.</p>';
            return;
        }
        
        templatesList.innerHTML = templates.map(template => `
            <div class="template-item">
                <div class="template-info">
                    <strong>${template.name}</strong>
                    <p>${template.basePersonality ? template.basePersonality.substring(0, 100) + '...' : 'No description'}</p>
                </div>
                <div class="template-actions">
                    <button class="btn btn-info btn-sm" onclick="editTemplate('${template.name}')">✏️ Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteTemplate('${template.name}')">🗑️ Delete</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading templates list:', error);
        templatesList.innerHTML = '<p style="color: #e74c3c;">Error loading templates</p>';
    }
}

// Initialize prompts section when DOM is ready
async function initializePromptsSection() {
    // Load existing prompt configurations and generate cards
    await loadAgentPrompts();
    
    // Load templates list
    loadTemplatesList();
    
    // Initialize preview
    updatePromptPreview();
}

async function loadAgentPrompts() {
    try {
        // Initialize AgentConfigManager if not already available
        if (!window.agentConfigManager) {
            if (typeof AgentConfigManager === 'undefined') {
                console.error('AgentConfigManager class not found. Make sure agent-config-manager.js is loaded.');
                showNotification('AgentConfigManager not available. Please check console for errors.', 'error');
                return;
            }
            
            window.agentConfigManager = new AgentConfigManager();
            await new Promise(resolve => setTimeout(resolve, 200)); // Allow initialization
        }
        
        // Generate the agent prompt cards dynamically
        await generateAgentPromptCards();
        
    } catch (error) {
        console.error('Error in loadAgentPrompts:', error);
        showNotification(`Error loading agent prompts: ${error.message}`, 'error');
    }
}

/**
 * Show notification to user
 */
function showNotification(message, type = 'info') {
    // Try to use existing admin UI notification system
    if (window.adminUI && typeof window.adminUI.showSuccess === 'function' && type === 'success') {
        window.adminUI.showSuccess(message);
        return;
    }
    if (window.adminUI && typeof window.adminUI.showError === 'function' && type === 'error') {
        window.adminUI.showError(message);
        return;
    }
    
    // Fallback to console and alert
    console.log(`[${type.toUpperCase()}] ${message}`);
    if (type === 'error') {
        alert(`Error: ${message}`);
    } else if (type === 'success') {
        alert(`Success: ${message}`);
    }
}

/**
 * Generate agent prompt cards dynamically from configuration files
 */
async function generateAgentPromptCards() {
    const agentsGrid = document.getElementById('agents-prompts-grid');
    if (!agentsGrid) {
        console.error('Agents prompts grid not found');
        showNotification('Could not find agents prompts grid container', 'error');
        return;
    }
    
    if (!window.agentConfigManager) {
        console.error('AgentConfigManager not initialized');
        showNotification('AgentConfigManager not initialized', 'error');
        return;
    }
    
    // Clear existing content
    agentsGrid.innerHTML = '<p style="text-align: center; color: #666;">Loading agent configurations...</p>';
    
    const agents = ['DefaultAgent', 'FraudAgent', 'PaymentsAgent', 'IDVAgent', 'BankingInfoAgent'];
    const agentIcons = {
        'DefaultAgent': '🤖',
        'FraudAgent': '🛡️',
        'PaymentsAgent': '💳',
        'IDVAgent': '🔐',
        'BankingInfoAgent': '🏦'
    };
    
    let generatedCards = 0;
    let cardHtml = '';
    
    for (const agentName of agents) {
        try {
            // Load configuration from agent config files
            const agentConfig = window.agentConfigManager.getAgentConfig(agentName);
            
            if (agentConfig) {
                const promptConfig = agentConfig.systemPrompts || {};
                const isEnabled = agentConfig.enabled !== false;
                
                // Create agent prompt card
                cardHtml += `
                    <div class="agent-prompt-card">
                        <div class="agent-prompt-header">
                            <h3>${agentIcons[agentName] || '🤖'} ${agentName}</h3>
                            <span class="agent-status ${isEnabled ? 'enabled' : 'disabled'}">
                                ${isEnabled ? 'Active' : 'Disabled'}
                            </span>
                        </div>
                        
                        <div class="prompt-field">
                            <label>Base AI Personality:</label>
                            <textarea id="${agentName.toLowerCase()}-personality" rows="3" 
                                placeholder="Define the ${agentName}'s core personality...">${(promptConfig.basePersonality || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                        </div>
                        
                        <div class="prompt-field">
                            <label>Financial Services Context:</label>
                            <textarea id="${agentName.toLowerCase()}-context" rows="3" 
                                placeholder="Context for financial operations...">${(promptConfig.financialContext || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                        </div>
                        
                        <div class="prompt-field">
                            <label>Response Instructions:</label>
                            <textarea id="${agentName.toLowerCase()}-instructions" rows="4" 
                                placeholder="Instructions for response formatting...">${(promptConfig.responseInstructions || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                        </div>
                        
                        ${promptConfig.customPrompts && promptConfig.customPrompts.length > 0 ? `
                        <div class="prompt-field">
                            <label>Custom Prompts:</label>
                            <div class="custom-prompts-list">
                                ${promptConfig.customPrompts.map((prompt, index) => `
                                    <div class="custom-prompt-item" style="margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                                        <strong>${(prompt.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}:</strong>
                                        <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">${(prompt.prompt || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}
                        
                        <div class="prompt-actions">
                            <button class="btn btn-success btn-sm" onclick="saveAgentPrompts('${agentName}')">💾 Save</button>
                            <button class="btn btn-secondary btn-sm" onclick="resetAgentPrompts('${agentName}')">🔄 Reset</button>
                            <button class="btn btn-info btn-sm" onclick="previewAgentPrompts('${agentName}')">👁️ Preview</button>
                        </div>
                    </div>
                `;
                
                generatedCards++;
                console.log(`Generated prompt card for ${agentName} from config file`);
            } else {
                console.warn(`No configuration found for ${agentName}`);
                cardHtml += `
                    <div class="agent-prompt-card" style="opacity: 0.6;">
                        <div class="agent-prompt-header">
                            <h3>${agentIcons[agentName] || '🤖'} ${agentName}</h3>
                            <span class="agent-status disabled">Configuration Missing</span>
                        </div>
                        <p style="color: #666; text-align: center; padding: 20px;">
                            Configuration file not found or failed to load.
                        </p>
                    </div>
                `;
            }
            
        } catch (error) {
            console.error(`Error generating prompt card for ${agentName}:`, error);
            cardHtml += `
                <div class="agent-prompt-card" style="opacity: 0.6; border-color: #dc3545;">
                    <div class="agent-prompt-header">
                        <h3>${agentIcons[agentName] || '🤖'} ${agentName}</h3>
                        <span class="agent-status disabled">Error</span>
                    </div>
                    <p style="color: #dc3545; text-align: center; padding: 20px;">
                        Error loading configuration: ${error.message}
                    </p>
                </div>
            `;
        }
    }
    
    // Update the grid with all cards
    agentsGrid.innerHTML = cardHtml;
    
    if (generatedCards > 0) {
        console.log(`Successfully generated ${generatedCards} agent prompt cards`);
        showNotification(`Loaded ${generatedCards} agent configurations from config files`, 'success');
    } else {
        console.warn('No agent prompt cards were generated');
        showNotification('No agent configurations could be loaded', 'error');
    }
}

// Global functions
window.refreshAgentData = () => adminUI?.refreshAgentData();
window.exportConfiguration = () => adminUI?.exportConfiguration();
window.importConfiguration = () => adminUI?.importConfiguration();
window.resetToDefaults = () => adminUI?.resetToDefaults();
window.cleanupInvalidAgents = () => adminUI?.cleanupInvalidAgents();
window.clearAuditLog = () => adminUI?.clearAuditLog();
window.closeModal = (modalId) => adminUI?.closeModal(modalId);
window.saveAgentConfiguration = () => adminUI?.saveAgentConfiguration();
window.addTrigger = () => adminUI?.addTrigger();
window.updateVoiceOptions = () => adminUI?.updateVoiceOptions();

// Agent management functions
window.openAgentConfiguration = (agentName) => adminUI?.openAgentConfiguration(agentName);
window.openGuardrailsEditor = (agentName) => adminUI?.openGuardrailsEditor(agentName);
window.openVoiceConfig = (agentName) => adminUI?.openVoiceConfig(agentName);
window.toggleAgent = (agentName) => adminUI?.toggleAgent(agentName);

// Guardrails functions
window.saveGuardrails = (agentName) => adminUI?.saveGuardrails(agentName);
window.testGuardrails = (agentName) => adminUI?.testGuardrails(agentName);

// Voice configuration functions
window.saveVoiceConfig = (agentName) => adminUI?.saveVoiceConfig(agentName);
window.resetVoiceConfig = (agentName) => adminUI?.resetVoiceConfig(agentName);
window.previewVoice = (agentName) => adminUI?.previewVoice(agentName);

// Content loading functions
window.loadGuardrailsEditor = (agentName) => adminUI?.loadGuardrailsEditor(agentName);
window.loadVoiceEditor = (agentName) => adminUI?.loadVoiceEditor(agentName);

// Enhanced guardrails functions
window.toggleAuthAction = (element) => {
    const detailsDiv = element.closest('.auth-action-config').querySelector('.auth-action-details');
    if (element.classList.contains('active')) {
        detailsDiv.style.display = 'block';
    } else {
        detailsDiv.style.display = 'none';
    }
};

window.usePromptTemplate = (button) => {
    const textarea = button.previousElementSibling;
    const template = button.dataset.template;
    if (template) {
        textarea.value = template;
        textarea.placeholder = '';
    }
};

// Helper functions for custom prompts management

/**
 * Validate all custom prompts before saving
 * @returns {boolean} True if all prompts are valid
 */
function validateAllCustomPrompts() {
    const container = document.getElementById('defaultCustomPromptsList');
    if (!container) return true;
    
    const promptItems = container.querySelectorAll('.custom-prompt-item');
    let allValid = true;
    
    promptItems.forEach(item => {
        const nameInput = item.querySelector('[data-field="name"]');
        const promptTextarea = item.querySelector('[data-field="prompt"]');
        
        if (nameInput && !window.adminUI.validateCustomPromptName(nameInput)) {
            allValid = false;
        }
        
        if (promptTextarea && !window.adminUI.validateCustomPromptContent(promptTextarea)) {
            allValid = false;
        }
    });
    
    return allValid;
}

function collectCustomPrompts(containerId) {
    // Handle both old and new container structures
    let container = document.getElementById(containerId);
    if (!container && containerId === 'default-custom-prompts') {
        // Fallback to new container ID
        container = document.getElementById('defaultCustomPromptsList');
    }
    if (!container) return [];
    
    const prompts = [];
    
    // Handle new structure with .custom-prompt-item
    const customPromptItems = container.querySelectorAll('.custom-prompt-item');
    if (customPromptItems.length > 0) {
        customPromptItems.forEach(item => {
            const nameInput = item.querySelector('[data-field="name"]');
            const promptTextarea = item.querySelector('[data-field="prompt"]');
            
            if (nameInput && promptTextarea) {
                const name = nameInput.value.trim();
                const prompt = promptTextarea.value.trim();
                
                // Validate inputs
                if (name && prompt) {
                    if (name.length > 100) {
                        throw new Error(`Prompt name "${name}" exceeds maximum length of 100 characters`);
                    }
                    if (prompt.length > 1000) {
                        throw new Error(`Prompt content for "${name}" exceeds maximum length of 1000 characters`);
                    }
                    
                    prompts.push({
                        name: name,
                        prompt: prompt,
                        id: Date.now() + Math.random()
                    });
                }
            }
        });
    } else {
        // Handle old structure with .prompt-input-group (for backward compatibility)
        const promptGroups = container.querySelectorAll('.prompt-input-group');
        promptGroups.forEach(group => {
            const nameInput = group.querySelector('input[type="text"]');
            const promptTextarea = group.querySelector('textarea');
            
            if (nameInput && promptTextarea) {
                const name = nameInput.value.trim();
                const prompt = promptTextarea.value.trim();
                
                if (name && prompt) {
                    if (name.length > 100) {
                        throw new Error(`Prompt name "${name}" exceeds maximum length of 100 characters`);
                    }
                    if (prompt.length > 1000) {
                        throw new Error(`Prompt content for "${name}" exceeds maximum length of 1000 characters`);
                    }
                    
                    prompts.push({
                        name: name,
                        prompt: prompt,
                        id: Date.now() + Math.random()
                    });
                }
            }
        });
    }
    
    return prompts;
}

function resetCustomPrompts(containerId, defaultPrompts = []) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Clear existing prompts
    container.innerHTML = '';
    
    // Add default prompts
    defaultPrompts.forEach(prompt => {
        addCustomPromptElement(containerId, prompt.name, prompt.prompt);
    });
    
    // Add empty prompt if no defaults
    if (defaultPrompts.length === 0) {
        addCustomPromptElement(containerId);
    }
}

function addCustomPrompt(containerId) {
    addCustomPromptElement(containerId);
}

function addCustomPromptElement(containerId, name = '', prompt = '') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const promptGroup = document.createElement('div');
    promptGroup.className = 'prompt-input-group';
    promptGroup.innerHTML = `
        <input type="text" placeholder="Scenario name (e.g., Loan Inquiries)" class="form-input" style="flex: 0 0 200px;" value="${name}" />
        <textarea placeholder="Custom prompt for this scenario..." class="prompt-textarea">${prompt}</textarea>
        <button class="btn btn-danger btn-small" onclick="removeCustomPrompt(this)">Remove</button>
    `;
    
    container.appendChild(promptGroup);
}

function removeCustomPrompt(button) {
    const promptGroup = button.closest('.prompt-input-group');
    if (promptGroup) {
        promptGroup.remove();
    }
}

// Default Agent specific functions
window.syncDefaultAgentFromSystemPrompts = () => adminUI?.syncDefaultAgentFromSystemPrompts();
window.addDefaultAgentCustomPrompt = () => {
    if (window.adminUI) {
        window.adminUI.addDefaultAgentCustomPrompt();
    } else {
        // Fallback implementation
        const container = document.getElementById('defaultCustomPromptsList');
        if (!container) return;
        
        const currentPrompts = container.querySelectorAll('.custom-prompt-item').length;
        
        // Check maximum limit
        if (currentPrompts >= 20) {
            alert('Maximum of 20 custom prompts allowed');
            return;
        }
        
        const newPromptHtml = `
            <div class="custom-prompt-item" style="border: 1px solid #e1e8ed; border-radius: 6px; padding: 15px; margin-bottom: 10px;">
                <div class="form-group">
                    <label class="form-label">Prompt Name</label>
                    <input type="text" class="form-input" placeholder="Enter prompt name..." 
                           data-custom-prompt-index="${currentPrompts}" data-field="name" maxlength="100">
                </div>
                <div class="form-group">
                    <label class="form-label">Prompt Content</label>
                    <textarea class="form-textarea" rows="3" placeholder="Enter prompt content..."
                              data-custom-prompt-index="${currentPrompts}" data-field="prompt" maxlength="1000"></textarea>
                </div>
                <button type="button" class="btn btn-danger btn-sm" onclick="removeDefaultAgentCustomPrompt(this)">
                    🗑️ Remove
                </button>
            </div>
        `;
        
        // Remove "no prompts" message if it exists
        const noPromptsMsg = container.querySelector('p[style*="font-style: italic"]');
        if (noPromptsMsg) {
            noPromptsMsg.remove();
        }
        
        container.insertAdjacentHTML('beforeend', newPromptHtml);
    }
};

window.removeDefaultAgentCustomPrompt = (element) => {
    if (window.adminUI && typeof element === 'object') {
        window.adminUI.removeDefaultAgentCustomPrompt(element);
    } else {
        // Fallback implementation for backward compatibility with index-based removal
        const container = document.getElementById('defaultCustomPromptsList');
        if (!container) return;
        
        let promptItem;
        if (typeof element === 'number') {
            // Old index-based removal
            const promptItems = container.querySelectorAll('.custom-prompt-item');
            promptItem = promptItems[element];
        } else {
            // New element-based removal
            promptItem = element.closest('.custom-prompt-item');
        }
        
        if (promptItem) {
            promptItem.remove();
            
            // If no prompts left, show message
            if (container.querySelectorAll('.custom-prompt-item').length === 0) {
                container.innerHTML = '<p style="color: #7f8c8d; font-style: italic;">No custom prompts configured</p>';
            }
        }
    }
};

// Global functions for HTML event handlers
function refreshAgentData() {
    if (window.adminUI) {
        window.adminUI.refreshAgentData();
    }
}

function exportConfiguration() {
    if (window.adminUI && window.adminUI.llmManager) {
        const config = window.adminUI.llmManager.exportConfiguration();
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `llm-manager-config-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        if (window.adminUI.showSuccess) {
            window.adminUI.showSuccess('Configuration exported successfully');
        }
    }
}

function importConfiguration() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    if (window.adminUI && window.adminUI.llmManager) {
                        const success = window.adminUI.llmManager.importConfiguration(config);
                        if (success) {
                            window.adminUI.showSuccess('Configuration imported successfully');
                            window.adminUI.refreshAgentData();
                        } else {
                            window.adminUI.showError('Failed to import configuration');
                        }
                    }
                } catch (error) {
                    if (window.adminUI && window.adminUI.showError) {
                        window.adminUI.showError('Invalid configuration file: ' + error.message);
                    }
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function cleanupInvalidAgents() {
    if (window.adminUI && window.adminUI.llmManager) {
        const cleaned = window.adminUI.llmManager.cleanupInvalidAgents();
        if (cleaned) {
            window.adminUI.showSuccess('Invalid agents cleaned up successfully');
            window.adminUI.refreshAgentData();
        } else {
            window.adminUI.showSuccess('No invalid agents found');
        }
    }
}

function resetToDefaults() {
    if (confirm('Are you sure you want to reset all configurations to defaults? This cannot be undone.')) {
        if (window.adminUI && window.adminUI.llmManager) {
            window.adminUI.llmManager.resetToDefaults();
            window.adminUI.showSuccess('All configurations reset to defaults');
            window.adminUI.refreshAgentData();
        }
    }
}

function openAgentConfiguration(agentName) {
    if (window.adminUI) {
        window.adminUI.openAgentConfiguration(agentName);
    }
}

function openGuardrailsEditor(agentName) {
    if (window.adminUI) {
        // Switch to guardrails section and select the agent
        window.adminUI.switchSection('guardrails').then(() => {
            const select = document.getElementById('guardrailsAgentSelect');
            if (select) {
                select.value = agentName;
                if (window.loadGuardrailsEditor) {
                    window.loadGuardrailsEditor(agentName);
                }
            }
        });
    }
}

function openVoiceConfig(agentName) {
    if (window.adminUI) {
        // Switch to voice section and select the agent
        window.adminUI.switchSection('voice').then(() => {
            const select = document.getElementById('voiceAgentSelect');
            if (select) {
                select.value = agentName;
                if (window.loadVoiceEditor) {
                    window.loadVoiceEditor(agentName);
                }
            }
        });
    }
}

function toggleAgent(agentName) {
    if (window.adminUI && window.adminUI.llmManager) {
        const config = window.adminUI.llmManager.getAgentConfiguration(agentName);
        if (config) {
            const newEnabled = !config.enabled;
            window.adminUI.llmManager.updateAgentConfiguration(agentName, { enabled: newEnabled })
                .then(result => {
                    if (result.success) {
                        window.adminUI.showSuccess(`${agentName} ${newEnabled ? 'enabled' : 'disabled'} successfully`);
                        window.adminUI.refreshAgentData();
                    } else {
                        window.adminUI.showError(`Failed to ${newEnabled ? 'enable' : 'disable'} ${agentName}: ${result.error}`);
                    }
                });
        }
    }
}

function syncDefaultAgentFromSystemPrompts() {
    if (window.adminUI) {
        window.adminUI.syncDefaultAgentFromSystemPrompts();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminUI = new LLMManagerAdminUI();
});