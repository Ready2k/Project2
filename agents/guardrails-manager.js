/**
 * Guardrails Manager - Manages capability restrictions and security boundaries for agents
 * Handles guardrail configuration, validation, and enforcement
 */

class GuardrailsManager {
    constructor() {
        this.guardrails = new Map();
        this.auditLogger = null; // Will be injected or created
        this.debug = window.debugManager?.createModuleLogger('GuardrailsManager') || console;
        this.storageKey = 'guardrails_config';
        
        this.initialize();
    }
    
    /**
     * Initialize the Guardrails Manager
     */
    initialize() {
        this.debug.log('Initializing Guardrails Manager');
        
        // Load existing guardrails from storage
        this.loadGuardrails();
        
        // Set up default guardrails if none exist
        if (this.guardrails.size === 0) {
            this.initializeDefaultGuardrails();
        }
        
        this.debug.log('Guardrails Manager initialized with', this.guardrails.size, 'agent guardrails');
    }
    
    /**
     * Set guardrails for a specific agent
     * @param {string} agentName - Name of the agent
     * @param {Object} rules - Guardrail rules configuration
     * @returns {boolean} Success status
     */
    setGuardrails(agentName, rules) {
        try {
            const validationResult = this.validateGuardrails(rules);
            if (!validationResult.valid) {
                this.debug.error('Invalid guardrails for', agentName, ':', validationResult.errors);
                return false;
            }
            
            const guardrailConfig = {
                agentName,
                ...rules,
                lastUpdated: new Date().toISOString()
            };
            
            this.guardrails.set(agentName, guardrailConfig);
            this.saveGuardrails();
            
            this.debug.log('Set guardrails for agent:', agentName);
            return true;
            
        } catch (error) {
            this.debug.error('Error setting guardrails for', agentName, ':', error);
            return false;
        }
    }
    
    /**
     * Set guardrails with real-time update support
     * @param {string} agentName - Name of the agent
     * @param {Object} rules - Guardrail rules configuration
     * @returns {Promise<boolean>} Success status
     */
    async setGuardrailsRealTime(agentName, rules) {
        try {
            // Store previous configuration for potential rollback
            const previousConfig = this.guardrails.get(agentName);
            
            // Apply the new guardrails
            const success = this.setGuardrails(agentName, rules);
            
            if (success) {
                // Notify active agents about the guardrails change
                await this.notifyAgentsOfGuardrailsChange(agentName, rules, previousConfig);
                
                this.debug.log('Real-time guardrails update completed for agent:', agentName);
            }
            
            return success;
            
        } catch (error) {
            this.debug.error('Error setting guardrails in real-time for', agentName, ':', error);
            return false;
        }
    }
    
    /**
     * Get guardrails for a specific agent
     * @param {string} agentName - Name of the agent
     * @returns {Object|null} Guardrail configuration or null if not found
     */
    getGuardrails(agentName) {
        return this.guardrails.get(agentName) || null;
    }
    
    /**
     * Get all guardrails
     * @returns {Object} All guardrail configurations
     */
    getAllGuardrails() {
        return Object.fromEntries(this.guardrails);
    }
    
    /**
     * Validate if an action is allowed for an agent
     * @param {string} agentName - Name of the agent
     * @param {string} action - Action to validate
     * @param {Object} context - Additional context for validation
     * @returns {Object} Validation result with allowed flag and reason
     */
    validateAction(agentName, action, context = {}) {
        const guardrails = this.guardrails.get(agentName);
        
        if (!guardrails) {
            // No guardrails defined - allow by default but log
            this.debug.warn('No guardrails defined for agent:', agentName);
            return { allowed: true, reason: 'No guardrails defined' };
        }
        
        // Check allowed capabilities
        if (guardrails.allowedCapabilities) {
            const capability = this.mapActionToCapability(action);
            if (capability && !guardrails.allowedCapabilities[capability]) {
                const customPrompt = guardrails.prompts?.restrictionBlocked?.capabilityDisabled;
                const defaultPrompt = this.getPromptTemplates().restrictionBlocked.capabilityDisabled;
                
                this.logViolation(agentName, action, 'Capability not allowed');
                return { 
                    allowed: false, 
                    reason: `Capability '${capability}' not allowed`,
                    prompt: customPrompt || defaultPrompt
                };
            }
        }
        
        // Check restrictions
        if (guardrails.restrictions) {
            const restrictionCheck = this.checkRestrictions(action, context, guardrails.restrictions, guardrails.prompts);
            if (!restrictionCheck.allowed) {
                this.logViolation(agentName, action, restrictionCheck.reason);
                return restrictionCheck;
            }
        }
        
        // Check blocked keywords
        if (guardrails.restrictions?.blockedKeywords) {
            const keywordCheck = this.checkBlockedKeywords(action, guardrails.restrictions.blockedKeywords, guardrails.prompts);
            if (!keywordCheck.allowed) {
                this.logViolation(agentName, action, keywordCheck.reason);
                return keywordCheck;
            }
        }
        
        // Check time-based restrictions
        if (guardrails.restrictions?.timeBasedRestrictions) {
            const timeCheck = this.checkTimeRestrictions(guardrails.restrictions.timeBasedRestrictions, guardrails.prompts);
            if (!timeCheck.allowed) {
                this.logViolation(agentName, action, timeCheck.reason);
                return timeCheck;
            }
        }
        
        return { allowed: true, reason: 'Action permitted' };
    }
    
    /**
     * Log a guardrail violation
     * @param {string} agentName - Name of the agent
     * @param {string} action - Action that was blocked
     * @param {string} reason - Reason for blocking
     */
    logViolation(agentName, action, reason) {
        const violation = {
            timestamp: new Date().toISOString(),
            agentName,
            action,
            reason,
            severity: 'warning'
        };
        
        // Log to debug system
        this.debug.warn('Guardrail violation:', violation);
        
        // Store violation for audit trail
        this.storeViolation(violation);
        
        // Trigger audit logger if available
        if (this.auditLogger) {
            this.auditLogger.logViolation(violation);
        }
    }
    
    /**
     * Get violation history for an agent
     * @param {string} agentName - Name of the agent
     * @param {number} limit - Maximum number of violations to return
     * @returns {Array} Array of violation records
     */
    getViolationHistory(agentName, limit = 50) {
        try {
            const stored = localStorage.getItem(`guardrail_violations_${agentName}`);
            if (stored) {
                const violations = JSON.parse(stored);
                return violations.slice(-limit);
            }
        } catch (error) {
            this.debug.error('Error retrieving violation history:', error);
        }
        
        return [];
    }
    
    /**
     * Validate guardrails configuration
     * @param {Object} guardrails - Guardrails configuration to validate
     * @returns {Object} Validation result with valid flag and errors array
     */
    validateGuardrails(guardrails) {
        const errors = [];
        
        if (!guardrails || typeof guardrails !== 'object') {
            errors.push('Guardrails must be an object');
            return { valid: false, errors };
        }
        
        // Validate allowed capabilities
        if (guardrails.allowedCapabilities) {
            if (typeof guardrails.allowedCapabilities !== 'object') {
                errors.push('allowedCapabilities must be an object');
            } else {
                const validCapabilities = [
                    'canAccessAccountData',
                    'canInitiateTransactions',
                    'canBlockCards',
                    'canResetPasswords',
                    'canAccessTransactionHistory',
                    'canProvideBalanceInfo'
                ];
                
                for (const [capability, value] of Object.entries(guardrails.allowedCapabilities)) {
                    if (!validCapabilities.includes(capability)) {
                        errors.push(`Unknown capability: ${capability}`);
                    }
                    if (typeof value !== 'boolean') {
                        errors.push(`Capability ${capability} must be a boolean`);
                    }
                }
            }
        }
        
        // Validate restrictions
        if (guardrails.restrictions) {
            if (typeof guardrails.restrictions !== 'object') {
                errors.push('restrictions must be an object');
            } else {
                const restrictions = guardrails.restrictions;
                
                if (restrictions.maxTransactionAmount !== undefined) {
                    if (typeof restrictions.maxTransactionAmount !== 'number' || restrictions.maxTransactionAmount < 0) {
                        errors.push('maxTransactionAmount must be a non-negative number');
                    }
                }
                
                // Validate new object-based requiresSecondaryAuth
                if (restrictions.requiresSecondaryAuth) {
                    if (Array.isArray(restrictions.requiresSecondaryAuth)) {
                        // Legacy array format - still supported
                    } else if (typeof restrictions.requiresSecondaryAuth === 'object') {
                        // New object format
                        const authTypes = this.getAuthenticationTypes();
                        for (const [action, config] of Object.entries(restrictions.requiresSecondaryAuth)) {
                            if (typeof config !== 'object') {
                                errors.push(`requiresSecondaryAuth.${action} must be an object`);
                            } else {
                                if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
                                    errors.push(`requiresSecondaryAuth.${action}.enabled must be a boolean`);
                                }
                                if (config.authType && !Object.keys(authTypes).includes(config.authType)) {
                                    errors.push(`requiresSecondaryAuth.${action}.authType must be one of: ${Object.keys(authTypes).join(', ')}`);
                                }
                            }
                        }
                    } else {
                        errors.push('requiresSecondaryAuth must be an array or object');
                    }
                }
                
                if (restrictions.blockedKeywords && !Array.isArray(restrictions.blockedKeywords)) {
                    errors.push('blockedKeywords must be an array');
                }
            }
        }
        
        // Validate prompts
        if (guardrails.prompts) {
            if (typeof guardrails.prompts !== 'object') {
                errors.push('prompts must be an object');
            } else {
                const validPromptTypes = ['secondaryAuth', 'restrictionBlocked', 'compliance'];
                for (const [promptType, prompts] of Object.entries(guardrails.prompts)) {
                    if (!validPromptTypes.includes(promptType)) {
                        errors.push(`Invalid prompt type: ${promptType}. Must be one of: ${validPromptTypes.join(', ')}`);
                    }
                    if (typeof prompts !== 'object') {
                        errors.push(`prompts.${promptType} must be an object`);
                    }
                }
            }
        }
        
        // Validate systemPrompts (new section for agent behavior prompts)
        if (guardrails.systemPrompts) {
            if (typeof guardrails.systemPrompts !== 'object') {
                errors.push('systemPrompts must be an object');
            } else {
                // Validate templates section
                if (guardrails.systemPrompts.templates) {
                    if (typeof guardrails.systemPrompts.templates !== 'object') {
                        errors.push('systemPrompts.templates must be an object');
                    } else {
                        for (const [templateName, template] of Object.entries(guardrails.systemPrompts.templates)) {
                            if (typeof template !== 'object') {
                                errors.push(`systemPrompts.templates.${templateName} must be an object`);
                                continue;
                            }
                            
                            // Validate template properties
                            const validTemplateProps = ['basePersonality', 'responseInstructions', 'financialContext', 'additionalInstructions'];
                            for (const prop of Object.keys(template)) {
                                if (!validTemplateProps.includes(prop)) {
                                    errors.push(`Invalid template property: systemPrompts.templates.${templateName}.${prop}`);
                                }
                            }
                            
                            // Validate string properties
                            ['basePersonality', 'responseInstructions', 'financialContext'].forEach(prop => {
                                if (template[prop] !== undefined && typeof template[prop] !== 'string') {
                                    errors.push(`systemPrompts.templates.${templateName}.${prop} must be a string`);
                                }
                            });
                            
                            // Validate additionalInstructions array
                            if (template.additionalInstructions !== undefined) {
                                if (!Array.isArray(template.additionalInstructions)) {
                                    errors.push(`systemPrompts.templates.${templateName}.additionalInstructions must be an array`);
                                } else {
                                    template.additionalInstructions.forEach((instruction, index) => {
                                        if (typeof instruction !== 'string') {
                                            errors.push(`systemPrompts.templates.${templateName}.additionalInstructions[${index}] must be a string`);
                                        }
                                    });
                                }
                            }
                        }
                    }
                }
                
                // Validate agentOverrides section
                if (guardrails.systemPrompts.agentOverrides) {
                    if (typeof guardrails.systemPrompts.agentOverrides !== 'object') {
                        errors.push('systemPrompts.agentOverrides must be an object');
                    } else {
                        const validAgents = ['FraudAgent', 'PaymentsAgent', 'IDVAgent', 'BankingInfoAgent'];
                        for (const [agentName, overrides] of Object.entries(guardrails.systemPrompts.agentOverrides)) {
                            if (!validAgents.includes(agentName)) {
                                errors.push(`Invalid agent name in systemPrompts.agentOverrides: ${agentName}`);
                                continue;
                            }
                            
                            if (typeof overrides !== 'object') {
                                errors.push(`systemPrompts.agentOverrides.${agentName} must be an object`);
                                continue;
                            }
                            
                            // Validate override properties (same as templates)
                            const validOverrideProps = ['basePersonality', 'responseInstructions', 'financialContext', 'additionalInstructions', 'templateRef'];
                            for (const prop of Object.keys(overrides)) {
                                if (!validOverrideProps.includes(prop)) {
                                    errors.push(`Invalid override property: systemPrompts.agentOverrides.${agentName}.${prop}`);
                                }
                            }
                            
                            // Validate template reference
                            if (overrides.templateRef !== undefined && typeof overrides.templateRef !== 'string') {
                                errors.push(`systemPrompts.agentOverrides.${agentName}.templateRef must be a string`);
                            }
                        }
                    }
                }
            }
        }
        
        // Validate compliance rules
        if (guardrails.complianceRules) {
            if (typeof guardrails.complianceRules !== 'object') {
                errors.push('complianceRules must be an object');
            } else {
                const compliance = guardrails.complianceRules;
                
                if (compliance.logAllActions !== undefined && typeof compliance.logAllActions !== 'boolean') {
                    errors.push('logAllActions must be a boolean');
                }
                
                if (compliance.requireAuditTrail !== undefined && typeof compliance.requireAuditTrail !== 'boolean') {
                    errors.push('requireAuditTrail must be a boolean');
                }
                
                if (compliance.dataRetentionDays !== undefined) {
                    if (typeof compliance.dataRetentionDays !== 'number' || compliance.dataRetentionDays < 1) {
                        errors.push('dataRetentionDays must be a positive number');
                    }
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Export all guardrails
     * @returns {Object} Exported guardrails data
     */
    exportGuardrails() {
        return {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            guardrails: Object.fromEntries(this.guardrails)
        };
    }
    
    /**
     * Import guardrails
     * @param {Object} guardrailsData - Guardrails data to import
     * @returns {boolean} Success status
     */
    importGuardrails(guardrailsData) {
        try {
            if (!guardrailsData.guardrails) {
                throw new Error('Invalid guardrails data structure');
            }
            
            this.guardrails.clear();
            
            for (const [agentName, guardrails] of Object.entries(guardrailsData.guardrails)) {
                const validationResult = this.validateGuardrails(guardrails);
                if (validationResult.valid) {
                    this.guardrails.set(agentName, guardrails);
                } else {
                    this.debug.warn(`Skipping invalid guardrails for ${agentName}:`, validationResult.errors);
                }
            }
            
            this.saveGuardrails();
            this.debug.log('Successfully imported guardrails');
            return true;
            
        } catch (error) {
            this.debug.error('Error importing guardrails:', error);
            return false;
        }
    }
    
    /**
     * Reset all guardrails to defaults
     */
    resetToDefaults() {
        this.guardrails.clear();
        this.initializeDefaultGuardrails();
        this.saveGuardrails();
        this.debug.log('Reset guardrails to defaults');
    }
    
    /**
     * Temporarily disable time-based restrictions for testing
     * @param {string} agentName - Name of the agent
     */
    disableTimeRestrictionsForTesting(agentName) {
        const guardrails = this.guardrails.get(agentName);
        if (guardrails && guardrails.restrictions) {
            guardrails.restrictions.timeBasedRestrictions = {};
            this.debug.log(`Disabled time restrictions for testing: ${agentName}`);
        }
    }
    
    /**
     * Enable test mode - disables time restrictions for all agents
     */
    enableTestMode() {
        for (const [agentName, guardrails] of this.guardrails) {
            if (guardrails.restrictions) {
                guardrails.restrictions.timeBasedRestrictions = {};
            }
        }
        this.debug.log('Test mode enabled - time restrictions disabled');
    }
    
    /**
     * Map action to capability
     * @param {string} action - Action to map
     * @returns {string|null} Corresponding capability or null
     */
    mapActionToCapability(action) {
        const actionMappings = {
            'getBalance': 'canProvideBalanceInfo',
            'getTransactions': 'canAccessTransactionHistory',
            'getAccountData': 'canAccessAccountData',
            'initiateTransfer': 'canInitiateTransactions',
            'blockCard': 'canBlockCards',
            'resetPassword': 'canResetPasswords'
        };
        
        return actionMappings[action] || null;
    }
    
    /**
     * Check general restrictions
     * @param {string} action - Action to check
     * @param {Object} context - Action context
     * @param {Object} restrictions - Restriction rules
     * @param {Object} prompts - Custom prompts configuration
     * @returns {Object} Check result
     */
    checkRestrictions(action, context, restrictions, prompts = {}) {
        // Check transaction amount limits
        if (action === 'initiateTransfer' && context.amount && restrictions.maxTransactionAmount) {
            if (context.amount > restrictions.maxTransactionAmount) {
                const prompt = prompts?.restrictionBlocked?.transactionLimit || 
                              this.getPromptTemplates().restrictionBlocked.transactionLimit.replace('{limit}', restrictions.maxTransactionAmount);
                return {
                    allowed: false,
                    reason: `Transaction amount ${context.amount} exceeds limit ${restrictions.maxTransactionAmount}`,
                    prompt: prompt
                };
            }
        }
        
        // Check if secondary auth is required (new structure)
        if (restrictions.requiresSecondaryAuth && typeof restrictions.requiresSecondaryAuth === 'object') {
            const authConfig = restrictions.requiresSecondaryAuth[action];
            if (authConfig && authConfig.enabled) {
                if (!context.secondaryAuthCompleted) {
                    const promptKey = authConfig.prompt || 'default';
                    const customPrompt = prompts?.secondaryAuth?.[action];
                    const templatePrompt = this.getPromptTemplates().secondaryAuth[promptKey] || 
                                         this.getPromptTemplates().secondaryAuth.default;
                    
                    return {
                        allowed: false,
                        reason: `Action ${action} requires secondary authentication`,
                        prompt: customPrompt || templatePrompt,
                        authType: authConfig.authType,
                        requiresAuth: true
                    };
                }
            }
        }
        
        // Legacy support for array-based requiresSecondaryAuth
        if (Array.isArray(restrictions.requiresSecondaryAuth) && restrictions.requiresSecondaryAuth.includes(action)) {
            if (!context.secondaryAuthCompleted) {
                const customPrompt = prompts?.secondaryAuth?.[action];
                const defaultPrompt = this.getPromptTemplates().secondaryAuth.default;
                
                return {
                    allowed: false,
                    reason: `Action ${action} requires secondary authentication`,
                    prompt: customPrompt || defaultPrompt,
                    requiresAuth: true
                };
            }
        }
        
        return { allowed: true, reason: 'Restrictions passed' };
    }
    
    /**
     * Check blocked keywords
     * @param {string} action - Action to check
     * @param {Array} blockedKeywords - List of blocked keywords
     * @param {Object} prompts - Custom prompts configuration
     * @returns {Object} Check result
     */
    checkBlockedKeywords(action, blockedKeywords, prompts = {}) {
        const actionLower = action.toLowerCase();
        
        for (const keyword of blockedKeywords) {
            if (actionLower.includes(keyword.toLowerCase())) {
                const customPrompt = prompts?.restrictionBlocked?.keywordBlocked;
                const defaultPrompt = this.getPromptTemplates().restrictionBlocked.keywordBlocked;
                
                return {
                    allowed: false,
                    reason: `Action contains blocked keyword: ${keyword}`,
                    prompt: customPrompt || defaultPrompt
                };
            }
        }
        
        return { allowed: true, reason: 'No blocked keywords found' };
    }
    
    /**
     * Check time-based restrictions
     * @param {Object} timeRestrictions - Time-based restriction rules
     * @param {Object} prompts - Custom prompts configuration
     * @returns {Object} Check result
     */
    checkTimeRestrictions(timeRestrictions, prompts = {}) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        // Check allowed hours
        if (timeRestrictions.allowedHours) {
            const [startHour, endHour] = timeRestrictions.allowedHours;
            if (currentHour < startHour || currentHour >= endHour) {
                const customPrompt = prompts?.restrictionBlocked?.timeRestriction;
                const defaultPrompt = this.getPromptTemplates().restrictionBlocked.timeRestriction.replace('{hours}', `${startHour}:00-${endHour}:00`);
                
                return {
                    allowed: false,
                    reason: `Action not allowed outside hours ${startHour}:00-${endHour}:00`,
                    prompt: customPrompt || defaultPrompt
                };
            }
        }
        
        // Check allowed days
        if (timeRestrictions.allowedDays) {
            if (!timeRestrictions.allowedDays.includes(currentDay)) {
                const customPrompt = prompts?.restrictionBlocked?.timeRestriction;
                const defaultPrompt = this.getPromptTemplates().restrictionBlocked.timeRestriction.replace('{hours}', 'business days');
                
                return {
                    allowed: false,
                    reason: 'Action not allowed on this day of the week',
                    prompt: customPrompt || defaultPrompt
                };
            }
        }
        
        return { allowed: true, reason: 'Time restrictions passed' };
    }
    
    /**
     * Store violation for audit trail
     * @param {Object} violation - Violation record
     */
    storeViolation(violation) {
        try {
            const key = `guardrail_violations_${violation.agentName}`;
            const stored = localStorage.getItem(key);
            const violations = stored ? JSON.parse(stored) : [];
            
            violations.push(violation);
            
            // Keep only last 100 violations per agent
            if (violations.length > 100) {
                violations.splice(0, violations.length - 100);
            }
            
            localStorage.setItem(key, JSON.stringify(violations));
        } catch (error) {
            this.debug.error('Error storing violation:', error);
        }
    }
    
    /**
     * Get predefined prompt templates
     */
    getPromptTemplates() {
        return {
            secondaryAuth: {
                cardBlocking: "For your security, I need to verify your identity before blocking your card. Please provide your date of birth and the last 4 digits of your Social Security number.",
                passwordReset: "To reset your password, I need to verify your identity. Please confirm your registered email address and answer your security question.",
                largeTransaction: "This transaction requires additional verification. Please confirm the transaction details and provide your authentication code.",
                accountAccess: "For security purposes, I need to verify your identity before accessing sensitive account information. Please provide your verification details.",
                default: "Additional authentication is required for this action. Please verify your identity to proceed."
            },
            restrictionBlocked: {
                capabilityDisabled: "I'm unable to perform this action as it's not within my authorized capabilities. Please contact customer service for assistance.",
                transactionLimit: "This transaction exceeds the maximum allowed amount of £{limit}. Please reduce the amount or contact customer service.",
                timeRestriction: "This service is not available outside of business hours ({hours}). Please try again during our operating hours.",
                keywordBlocked: "I cannot process requests containing certain restricted terms. Please rephrase your request or contact customer service.",
                default: "I'm unable to complete this action due to security restrictions. Please contact customer service for assistance."
            },
            compliance: {
                auditRequired: "This action will be logged for compliance purposes. Do you wish to continue?",
                dataRetention: "Your request will be retained for {days} days as per our data retention policy.",
                default: "This action is subject to compliance monitoring."
            }
        };
    }

    /**
     * Get available authentication types
     */
    getAuthenticationTypes() {
        return {
            sms: "SMS Verification",
            email: "Email Verification", 
            biometric: "Biometric Authentication",
            securityQuestions: "Security Questions",
            twoFactor: "Two-Factor Authentication",
            manualVerification: "Manual Verification"
        };
    }

    /**
     * Initialize default guardrails for known agents
     */
    initializeDefaultGuardrails() {
        const defaultGuardrails = {
            IDVAgent: {
                agentName: 'IDVAgent',
                allowedCapabilities: {
                    canAccessAccountData: true,
                    canInitiateTransactions: false,
                    canBlockCards: false,
                    canResetPasswords: true,
                    canAccessTransactionHistory: false,
                    canProvideBalanceInfo: false
                },
                restrictions: {
                    maxTransactionAmount: 0,
                    requiresSecondaryAuth: {
                        resetPassword: {
                            enabled: true,
                            authType: 'securityQuestions',
                            prompt: 'passwordReset'
                        }
                    },
                    blockedKeywords: ['transfer', 'payment', 'send money'],
                    timeBasedRestrictions: {}
                },
                prompts: {
                    secondaryAuth: {
                        resetPassword: "To reset your password, I need to verify your identity. Please confirm your registered email address and answer your security question."
                    },
                    restrictionBlocked: {
                        capabilityDisabled: "I'm unable to perform password resets outside of my authorized capabilities. Please contact customer service for assistance.",
                        default: "I'm unable to complete this action due to security restrictions. Please contact customer service for assistance."
                    }
                },
                complianceRules: {
                    logAllActions: true,
                    requireAuditTrail: true,
                    dataRetentionDays: 90
                }
            },
            BankingInfoAgent: {
                agentName: 'BankingInfoAgent',
                allowedCapabilities: {
                    canAccessAccountData: true,
                    canInitiateTransactions: false,
                    canBlockCards: false,
                    canResetPasswords: false,
                    canAccessTransactionHistory: true,
                    canProvideBalanceInfo: true
                },
                restrictions: {
                    maxTransactionAmount: 0,
                    requiresSecondaryAuth: {},
                    blockedKeywords: ['transfer', 'send', 'pay'],
                    timeBasedRestrictions: {}
                },
                prompts: {
                    secondaryAuth: {},
                    restrictionBlocked: {
                        capabilityDisabled: "I can only provide account information and transaction history. For other services, please contact customer service.",
                        keywordBlocked: "I cannot process transaction-related requests. Please contact our payments team for assistance.",
                        default: "I'm unable to complete this action. Please contact customer service for assistance."
                    }
                },
                complianceRules: {
                    logAllActions: true,
                    requireAuditTrail: false,
                    dataRetentionDays: 30
                }
            },
            FraudAgent: {
                agentName: 'FraudAgent',
                allowedCapabilities: {
                    canAccessAccountData: true,
                    canInitiateTransactions: false,
                    canBlockCards: true,
                    canResetPasswords: false,
                    canAccessTransactionHistory: true,
                    canProvideBalanceInfo: false
                },
                restrictions: {
                    maxTransactionAmount: 0,
                    requiresSecondaryAuth: {
                        blockCard: {
                            enabled: true,
                            authType: 'twoFactor',
                            prompt: 'cardBlocking'
                        }
                    },
                    blockedKeywords: ['send money', 'transfer'],
                    timeBasedRestrictions: {}
                },
                prompts: {
                    secondaryAuth: {
                        blockCard: "For your security, I need to verify your identity before blocking your card. Please provide your date of birth and the last 4 digits of your Social Security number."
                    },
                    restrictionBlocked: {
                        keywordBlocked: "I cannot process transaction requests for security reasons. I can help you block cards or report fraud instead.",
                        default: "I'm unable to complete this action due to security restrictions. Please contact customer service for assistance."
                    }
                },
                complianceRules: {
                    logAllActions: true,
                    requireAuditTrail: true,
                    dataRetentionDays: 365
                }
            },
            PaymentsAgent: {
                agentName: 'PaymentsAgent',
                allowedCapabilities: {
                    canAccessAccountData: true,
                    canInitiateTransactions: true,
                    canBlockCards: false,
                    canResetPasswords: false,
                    canAccessTransactionHistory: true,
                    canProvideBalanceInfo: true
                },
                restrictions: {
                    maxTransactionAmount: 1000,
                    requiresSecondaryAuth: {
                        initiateTransfer: {
                            enabled: true,
                            authType: 'sms',
                            prompt: 'largeTransaction'
                        }
                    },
                    blockedKeywords: [],
                    timeBasedRestrictions: {
                        allowedHours: [6, 22], // 6 AM to 10 PM
                        allowedDays: [1, 2, 3, 4, 5] // Monday to Friday
                    }
                },
                prompts: {
                    secondaryAuth: {
                        initiateTransfer: "This transaction requires additional verification. Please confirm the transaction details and provide your SMS authentication code."
                    },
                    restrictionBlocked: {
                        transactionLimit: "This transaction exceeds the maximum allowed amount of £1000. Please reduce the amount or contact customer service.",
                        timeRestriction: "Payment services are only available Monday-Friday, 6 AM to 10 PM. Please try again during business hours.",
                        default: "I'm unable to complete this transaction due to security restrictions. Please contact customer service for assistance."
                    }
                },
                complianceRules: {
                    logAllActions: true,
                    requireAuditTrail: true,
                    dataRetentionDays: 2555 // 7 years
                }
            }
        };
        
        for (const [agentName, guardrails] of Object.entries(defaultGuardrails)) {
            guardrails.createdAt = new Date().toISOString();
            guardrails.lastUpdated = new Date().toISOString();
            this.guardrails.set(agentName, guardrails);
        }
        
        this.debug.log('Initialized default guardrails for', Object.keys(defaultGuardrails).length, 'agents');
    }
    
    /**
     * Load guardrails from storage
     */
    loadGuardrails() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                if (data.guardrails) {
                    this.guardrails = new Map(Object.entries(data.guardrails));
                    this.debug.log('Loaded guardrails from storage');
                }
            }
        } catch (error) {
            this.debug.error('Error loading guardrails from storage:', error);
        }
    }
    
    /**
     * Save guardrails to storage
     */
    saveGuardrails() {
        try {
            const data = {
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                guardrails: Object.fromEntries(this.guardrails)
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            this.debug.log('Saved guardrails to storage');
        } catch (error) {
            this.debug.error('Error saving guardrails to storage:', error);
        }
    }
    
    /**
     * Handle real-time guardrails update
     * @param {Object} updateData - Update data from ConfigUpdateManager
     * @returns {Promise<Object>} Update result
     */
    async handleRealTimeUpdate(updateData) {
        try {
            const { agentName, configUpdate } = updateData;
            
            this.debug.log(`Handling real-time guardrails update for ${agentName}`);
            
            // Apply the guardrails update
            const success = await this.setGuardrailsRealTime(agentName, configUpdate.data);
            
            return {
                success,
                agentName,
                updateType: 'guardrails',
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            this.debug.error('Error handling real-time guardrails update:', error);
            return {
                success: false,
                error: 'Failed to handle real-time guardrails update',
                details: error.message
            };
        }
    }
    
    /**
     * Notify active agents about guardrails changes
     * @param {string} agentName - Name of the agent
     * @param {Object} newGuardrails - New guardrails configuration
     * @param {Object} previousGuardrails - Previous guardrails configuration
     * @returns {Promise<void>}
     */
    async notifyAgentsOfGuardrailsChange(agentName, newGuardrails, previousGuardrails) {
        try {
            // Get reference to active agents (would need integration with agent router)
            const activeAgents = this.getActiveAgents();
            
            // Notify the specific agent if it's active
            const targetAgent = activeAgents.find(agent => agent.name === agentName);
            if (targetAgent && typeof targetAgent.onGuardrailsUpdate === 'function') {
                await targetAgent.onGuardrailsUpdate(newGuardrails, previousGuardrails);
                this.debug.log(`Notified active agent ${agentName} of guardrails change`);
            }
            
            // Emit custom event for UI components
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                const event = new CustomEvent('guardrailsUpdate', {
                    detail: {
                        agentName,
                        newGuardrails,
                        previousGuardrails,
                        timestamp: new Date().toISOString()
                    }
                });
                window.dispatchEvent(event);
            }
            
        } catch (error) {
            this.debug.error('Error notifying agents of guardrails change:', error);
        }
    }
    
    /**
     * Get custom prompt for agent and action
     * @param {string} agentName - Name of the agent
     * @param {string} promptType - Type of prompt (secondaryAuth, restrictionBlocked, compliance)
     * @param {string} action - Specific action or scenario
     * @returns {string|null} Custom prompt or null if not found
     */
    getCustomPrompt(agentName, promptType, action) {
        const guardrails = this.guardrails.get(agentName);
        if (!guardrails || !guardrails.prompts) {
            return null;
        }
        
        return guardrails.prompts[promptType]?.[action] || guardrails.prompts[promptType]?.default || null;
    }

    /**
     * Set custom prompt for agent
     * @param {string} agentName - Name of the agent
     * @param {string} promptType - Type of prompt
     * @param {string} action - Specific action or scenario
     * @param {string} prompt - Custom prompt text
     * @returns {boolean} Success status
     */
    setCustomPrompt(agentName, promptType, action, prompt) {
        try {
            const guardrails = this.guardrails.get(agentName);
            if (!guardrails) {
                this.debug.error(`No guardrails found for agent: ${agentName}`);
                return false;
            }
            
            if (!guardrails.prompts) {
                guardrails.prompts = {};
            }
            
            if (!guardrails.prompts[promptType]) {
                guardrails.prompts[promptType] = {};
            }
            
            guardrails.prompts[promptType][action] = prompt;
            guardrails.lastUpdated = new Date().toISOString();
            
            this.saveGuardrails();
            this.debug.log(`Set custom prompt for ${agentName}.${promptType}.${action}`);
            
            return true;
            
        } catch (error) {
            this.debug.error('Error setting custom prompt:', error);
            return false;
        }
    }

    /**
     * Get available secondary auth actions for an agent
     * @param {string} agentName - Name of the agent
     * @returns {Array} Array of actions that can require secondary auth
     */
    getAvailableAuthActions(agentName) {
        const capabilities = [
            { action: 'getAccountData', label: 'Access Account Data', capability: 'canAccessAccountData' },
            { action: 'initiateTransfer', label: 'Initiate Transfer', capability: 'canInitiateTransactions' },
            { action: 'blockCard', label: 'Block Card', capability: 'canBlockCards' },
            { action: 'resetPassword', label: 'Reset Password', capability: 'canResetPasswords' },
            { action: 'getTransactions', label: 'Access Transaction History', capability: 'canAccessTransactionHistory' },
            { action: 'getBalance', label: 'Provide Balance Info', capability: 'canProvideBalanceInfo' }
        ];
        
        const guardrails = this.guardrails.get(agentName);
        if (!guardrails || !guardrails.allowedCapabilities) {
            return capabilities;
        }
        
        // Only return actions for capabilities that are enabled
        return capabilities.filter(cap => guardrails.allowedCapabilities[cap.capability]);
    }

    /**
     * Get active agents (placeholder - would integrate with agent router)
     * @returns {Array} Array of active agent instances
     */
    getActiveAgents() {
        // This would integrate with the AgentRouter to get currently active agents
        // For now, return empty array as placeholder
        if (window.agentRouter && typeof window.agentRouter.getActiveAgents === 'function') {
            return window.agentRouter.getActiveAgents();
        }
        return [];
    }
    
    /**
     * Hot-reload guardrails without system restart
     * @param {string} agentName - Name of the agent (or 'all' for all agents)
     * @param {Object} newGuardrails - New guardrails configuration
     * @returns {Promise<Object>} Hot-reload result
     */
    async hotReloadGuardrails(agentName, newGuardrails) {
        try {
            this.debug.log(`Hot-reloading guardrails for ${agentName}`);
            
            if (agentName === 'all') {
                // Hot-reload all agent guardrails
                const results = [];
                for (const [name, _] of this.guardrails) {
                    const result = await this.setGuardrailsRealTime(name, newGuardrails);
                    results.push({ agentName: name, success: result });
                }
                
                return {
                    success: true,
                    message: 'Hot-reloaded guardrails for all agents',
                    results
                };
            } else {
                // Hot-reload specific agent guardrails
                const success = await this.setGuardrailsRealTime(agentName, newGuardrails);
                
                return {
                    success,
                    message: success ? 
                        `Hot-reloaded guardrails for ${agentName}` : 
                        `Failed to hot-reload guardrails for ${agentName}`,
                    agentName
                };
            }
            
        } catch (error) {
            this.debug.error('Error hot-reloading guardrails:', error);
            return {
                success: false,
                error: 'Failed to hot-reload guardrails',
                details: error.message
            };
        }
    }
    
    /**
     * Validate guardrails change impact
     * @param {string} agentName - Name of the agent
     * @param {Object} newGuardrails - New guardrails configuration
     * @returns {Object} Impact analysis
     */
    validateGuardrailsChangeImpact(agentName, newGuardrails) {
        try {
            const currentGuardrails = this.guardrails.get(agentName);
            const impact = {
                hasChanges: false,
                restrictionsAdded: [],
                restrictionsRemoved: [],
                capabilitiesChanged: [],
                riskLevel: 'low' // low, medium, high
            };
            
            if (!currentGuardrails) {
                impact.hasChanges = true;
                impact.riskLevel = 'medium';
                return impact;
            }
            
            // Check capability changes
            if (currentGuardrails.allowedCapabilities && newGuardrails.allowedCapabilities) {
                for (const [capability, allowed] of Object.entries(newGuardrails.allowedCapabilities)) {
                    const currentAllowed = currentGuardrails.allowedCapabilities[capability];
                    if (currentAllowed !== allowed) {
                        impact.hasChanges = true;
                        impact.capabilitiesChanged.push({
                            capability,
                            from: currentAllowed,
                            to: allowed
                        });
                        
                        // Enabling new capabilities is higher risk
                        if (!currentAllowed && allowed) {
                            impact.riskLevel = 'high';
                        }
                    }
                }
            }
            
            // Check restriction changes
            if (currentGuardrails.restrictions && newGuardrails.restrictions) {
                const currentMax = currentGuardrails.restrictions.maxTransactionAmount;
                const newMax = newGuardrails.restrictions.maxTransactionAmount;
                
                if (currentMax !== newMax) {
                    impact.hasChanges = true;
                    if (newMax > currentMax) {
                        impact.restrictionsRemoved.push(`Transaction limit increased from ${currentMax} to ${newMax}`);
                        impact.riskLevel = 'high';
                    } else {
                        impact.restrictionsAdded.push(`Transaction limit decreased from ${currentMax} to ${newMax}`);
                    }
                }
            }
            
            return impact;
            
        } catch (error) {
            this.debug.error('Error validating guardrails change impact:', error);
            return {
                hasChanges: true,
                error: error.message,
                riskLevel: 'high'
            };
        }
    }
    
    /**
     * Get system prompts for an agent
     * @param {string} agentName - Name of the agent
     * @returns {Object} System prompt configuration
     */
    getSystemPrompts(agentName) {
        try {
            const guardrails = this.guardrails.get(agentName);
            if (!guardrails || !guardrails.systemPrompts) {
                // Return default prompts if no configuration exists
                return this.getDefaultSystemPrompts(agentName);
            }
            
            const systemPrompts = guardrails.systemPrompts;
            let prompts = {};
            
            // Start with template if referenced
            if (systemPrompts.templateRef && guardrails.systemPrompts.templates) {
                const template = guardrails.systemPrompts.templates[systemPrompts.templateRef];
                if (template) {
                    prompts = { ...template };
                }
            }
            
            // Apply agent-specific overrides
            if (systemPrompts.agentOverrides && systemPrompts.agentOverrides[agentName]) {
                const overrides = systemPrompts.agentOverrides[agentName];
                prompts = { ...prompts, ...overrides };
            }
            
            // Apply direct properties
            ['basePersonality', 'responseInstructions', 'financialContext', 'additionalInstructions'].forEach(prop => {
                if (systemPrompts[prop] !== undefined) {
                    prompts[prop] = systemPrompts[prop];
                }
            });
            
            return prompts;
            
        } catch (error) {
            this.debug.error('Error getting system prompts:', error);
            return this.getDefaultSystemPrompts(agentName);
        }
    }
    
    /**
     * Set system prompts for an agent
     * @param {string} agentName - Name of the agent
     * @param {Object} prompts - System prompt configuration
     * @returns {boolean} Success status
     */
    setSystemPrompts(agentName, prompts) {
        try {
            let guardrails = this.guardrails.get(agentName);
            if (!guardrails) {
                guardrails = this.getDefaultGuardrails(agentName);
                this.guardrails.set(agentName, guardrails);
            }
            
            if (!guardrails.systemPrompts) {
                guardrails.systemPrompts = {};
            }
            
            // Validate prompts structure
            const validProps = ['basePersonality', 'responseInstructions', 'financialContext', 'additionalInstructions', 'templateRef'];
            for (const prop of Object.keys(prompts)) {
                if (!validProps.includes(prop)) {
                    this.debug.warn(`Invalid system prompt property: ${prop}`);
                    continue;
                }
                guardrails.systemPrompts[prop] = prompts[prop];
            }
            
            guardrails.lastUpdated = new Date().toISOString();
            this.saveGuardrails();
            
            this.debug.log(`Updated system prompts for ${agentName}`);
            return true;
            
        } catch (error) {
            this.debug.error('Error setting system prompts:', error);
            return false;
        }
    }
    
    /**
     * Get default system prompts for an agent (migrated from hardcoded values)
     * @param {string} agentName - Name of the agent
     * @returns {Object} Default system prompt configuration
     */
    getDefaultSystemPrompts(agentName) {
        const defaults = {
            FraudAgent: {
                basePersonality: "You are an urgent, professional fraud detection and security specialist. You prioritize immediate protective actions and clear guidance. You are reassuring but maintain appropriate urgency for security threats.",
                financialContext: "When handling fraud and security requests, prioritize immediate protective actions. Focus on card blocking, fraud reporting, and security guidance. Always emphasize the time-sensitive nature of fraud response.",
                responseInstructions: "Provide immediate, clear guidance for security threats. Be urgent but reassuring. Give step-by-step instructions for protective actions. Always provide emergency contact information when relevant.",
                additionalInstructions: [
                    "You are specialized in fraud detection, card blocking, and security threat responses",
                    "Treat all fraud reports with HIGH PRIORITY and urgency",
                    "You can perform PROTECTIVE actions like card blocking and fraud reporting",
                    "You CANNOT access payment processing, money transfers, or account balances",
                    "Provide immediate protective actions when requested",
                    "Never ask for sensitive information like card numbers or PINs",
                    "Always emphasize time-sensitive nature of fraud response",
                    "If asked about payments or transfers, redirect to appropriate agents"
                ]
            },
            PaymentsAgent: {
                basePersonality: "You are a highly secure, professional payment processing assistant. You prioritize security, accuracy, and clear communication in all financial transactions. You are thorough, careful, and always confirm details before processing.",
                financialContext: "When handling payment requests, apply the highest security standards. Always validate transaction details, confirm amounts, and ensure secure processing. Never process transactions without explicit confirmation.",
                responseInstructions: "Provide clear, step-by-step guidance for payment processing. Always confirm transaction details before proceeding. Be precise about amounts, fees, and processing times. Use secure language and maintain professional tone.",
                additionalInstructions: [
                    "You are specialized in money transfers, payments, and secure transaction processing",
                    "Apply HIGHEST SECURITY LEVEL to all payment requests",
                    "ALWAYS validate transaction amounts against available balance",
                    "NEVER process payments exceeding account balance",
                    "ALWAYS require explicit confirmation for payment amounts and recipient details",
                    "Provide transaction reference numbers and confirmations",
                    "If asked about balances, fraud, or identity verification, redirect to appropriate agents"
                ]
            },
            IDVAgent: {
                basePersonality: null, // Use default
                financialContext: "When handling identity verification requests, prioritize security and privacy above all else. Guide users through secure verification processes while maintaining strict security boundaries.",
                responseInstructions: "Keep responses security-focused and provide clear, step-by-step guidance. Never request sensitive information in conversation. Always direct users to secure channels for sensitive operations.",
                additionalInstructions: [
                    "You are specialized in identity verification, password resets, and account security",
                    "You can ONLY access identity verification functions - no payments, transactions, or balances",
                    "Always prioritize security and user privacy in all interactions",
                    "Provide clear instructions but never ask for passwords or PINs in conversation",
                    "If asked about payments, transfers, or fraud reporting, politely redirect as these are outside your domain"
                ]
            },
            BankingInfoAgent: {
                basePersonality: null, // Use default
                financialContext: "When providing banking information, be accurate, helpful, and informative. Focus on read-only account data and transaction history. Always use the customer's actual account information.",
                responseInstructions: "Present financial information clearly and accurately. Format currency amounts properly. Provide helpful context about transactions and account activity. Keep responses informative but concise.",
                additionalInstructions: [
                    "You are specialized in providing account balance, transaction history, and account information",
                    "You can ONLY provide READ-ONLY access to banking information",
                    "You CANNOT perform transactions, transfers, payments, or account modifications",
                    "Always use the customer's actual account data when responding",
                    "Format currency amounts clearly using GBP (£) symbol",
                    "If asked about payments, transfers, or account modifications, redirect to appropriate services"
                ]
            }
        };
        
        return defaults[agentName] || {};
    }
    
    /**
     * Get all available system prompt templates
     * @returns {Object} Available templates
     */
    getSystemPromptTemplates() {
        return {
            professional: {
                basePersonality: "You are a professional, helpful, and courteous assistant. You maintain a formal but friendly tone in all interactions.",
                responseInstructions: "Provide clear, accurate, and helpful responses. Be concise but thorough. Always maintain professionalism.",
                additionalInstructions: [
                    "Maintain professional tone at all times",
                    "Provide accurate and helpful information",
                    "Be respectful and courteous"
                ]
            },
            urgent: {
                basePersonality: "You are an urgent, action-oriented assistant. You prioritize immediate responses and clear guidance for time-sensitive situations.",
                responseInstructions: "Provide immediate, clear guidance. Be direct and actionable. Emphasize urgency when appropriate.",
                additionalInstructions: [
                    "Prioritize immediate action",
                    "Be direct and clear",
                    "Emphasize time-sensitive nature when relevant"
                ]
            },
            security_focused: {
                basePersonality: "You are a security-focused assistant who prioritizes safety, privacy, and secure practices in all interactions.",
                responseInstructions: "Always prioritize security and privacy. Provide secure guidance and never request sensitive information directly.",
                additionalInstructions: [
                    "Prioritize security and privacy",
                    "Never request sensitive information",
                    "Guide users to secure channels for sensitive operations"
                ]
            }
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GuardrailsManager;
} else if (typeof window !== 'undefined') {
    window.GuardrailsManager = GuardrailsManager;
}