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
                this.logViolation(agentName, action, 'Capability not allowed');
                return { allowed: false, reason: `Capability '${capability}' not allowed` };
            }
        }
        
        // Check restrictions
        if (guardrails.restrictions) {
            const restrictionCheck = this.checkRestrictions(action, context, guardrails.restrictions);
            if (!restrictionCheck.allowed) {
                this.logViolation(agentName, action, restrictionCheck.reason);
                return restrictionCheck;
            }
        }
        
        // Check blocked keywords
        if (guardrails.restrictions?.blockedKeywords) {
            const keywordCheck = this.checkBlockedKeywords(action, guardrails.restrictions.blockedKeywords);
            if (!keywordCheck.allowed) {
                this.logViolation(agentName, action, keywordCheck.reason);
                return keywordCheck;
            }
        }
        
        // Check time-based restrictions
        if (guardrails.restrictions?.timeBasedRestrictions) {
            const timeCheck = this.checkTimeRestrictions(guardrails.restrictions.timeBasedRestrictions);
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
                
                if (restrictions.requiresSecondaryAuth && !Array.isArray(restrictions.requiresSecondaryAuth)) {
                    errors.push('requiresSecondaryAuth must be an array');
                }
                
                if (restrictions.blockedKeywords && !Array.isArray(restrictions.blockedKeywords)) {
                    errors.push('blockedKeywords must be an array');
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
     * @returns {Object} Check result
     */
    checkRestrictions(action, context, restrictions) {
        // Check transaction amount limits
        if (action === 'initiateTransfer' && context.amount && restrictions.maxTransactionAmount) {
            if (context.amount > restrictions.maxTransactionAmount) {
                return {
                    allowed: false,
                    reason: `Transaction amount ${context.amount} exceeds limit ${restrictions.maxTransactionAmount}`
                };
            }
        }
        
        // Check if secondary auth is required
        if (restrictions.requiresSecondaryAuth && restrictions.requiresSecondaryAuth.includes(action)) {
            if (!context.secondaryAuthCompleted) {
                return {
                    allowed: false,
                    reason: `Action ${action} requires secondary authentication`
                };
            }
        }
        
        return { allowed: true, reason: 'Restrictions passed' };
    }
    
    /**
     * Check blocked keywords
     * @param {string} action - Action to check
     * @param {Array} blockedKeywords - List of blocked keywords
     * @returns {Object} Check result
     */
    checkBlockedKeywords(action, blockedKeywords) {
        const actionLower = action.toLowerCase();
        
        for (const keyword of blockedKeywords) {
            if (actionLower.includes(keyword.toLowerCase())) {
                return {
                    allowed: false,
                    reason: `Action contains blocked keyword: ${keyword}`
                };
            }
        }
        
        return { allowed: true, reason: 'No blocked keywords found' };
    }
    
    /**
     * Check time-based restrictions
     * @param {Object} timeRestrictions - Time-based restriction rules
     * @returns {Object} Check result
     */
    checkTimeRestrictions(timeRestrictions) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        // Check allowed hours
        if (timeRestrictions.allowedHours) {
            const [startHour, endHour] = timeRestrictions.allowedHours;
            if (currentHour < startHour || currentHour >= endHour) {
                return {
                    allowed: false,
                    reason: `Action not allowed outside hours ${startHour}:00-${endHour}:00`
                };
            }
        }
        
        // Check allowed days
        if (timeRestrictions.allowedDays) {
            if (!timeRestrictions.allowedDays.includes(currentDay)) {
                return {
                    allowed: false,
                    reason: 'Action not allowed on this day of the week'
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
                    requiresSecondaryAuth: ['resetPassword'],
                    blockedKeywords: ['transfer', 'payment', 'send money'],
                    timeBasedRestrictions: {}
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
                    requiresSecondaryAuth: [],
                    blockedKeywords: ['transfer', 'send', 'pay'],
                    timeBasedRestrictions: {}
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
                    requiresSecondaryAuth: ['blockCard'],
                    blockedKeywords: ['send money', 'transfer'],
                    timeBasedRestrictions: {}
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
                    requiresSecondaryAuth: ['initiateTransfer'],
                    blockedKeywords: [],
                    timeBasedRestrictions: {
                        allowedHours: [6, 22], // 6 AM to 10 PM
                        allowedDays: [1, 2, 3, 4, 5] // Monday to Friday
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GuardrailsManager;
} else if (typeof window !== 'undefined') {
    window.GuardrailsManager = GuardrailsManager;
}