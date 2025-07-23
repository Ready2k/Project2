/**
 * SecurityManager - Manages security boundaries and domain access controls for agents
 * Implements data access validation, API sandboxing, and security audit logging
 */
class SecurityManager {
    constructor() {
        this.debug = window.debugManager.createModuleLogger('SecurityManager');
        this.auditLog = [];
        this.maxAuditLogSize = 1000;
        
        // Define domain access permissions for each agent type
        this.domainPermissions = {
            'IDVAgent': {
                allowedDataTypes: ['identity', 'verification', 'security_questions', 'authentication'],
                allowedApiCalls: ['verify_identity', 'reset_password', 'security_questions', 'authentication_status'],
                restrictedDataTypes: ['balance', 'transactions', 'payments', 'transfers', 'fraud_actions'],
                restrictedApiCalls: ['get_balance', 'get_transactions', 'process_payment', 'transfer_money', 'block_card']
            },
            'BankingInfoAgent': {
                allowedDataTypes: ['balance', 'transactions', 'account_info', 'statements'],
                allowedApiCalls: ['get_balance', 'get_transactions', 'get_account_info', 'get_statements'],
                restrictedDataTypes: ['identity_verification', 'payments', 'transfers', 'fraud_actions'],
                restrictedApiCalls: ['verify_identity', 'process_payment', 'transfer_money', 'block_card', 'reset_password']
            },
            'FraudAgent': {
                allowedDataTypes: ['fraud_alerts', 'security_actions', 'card_status', 'suspicious_activity'],
                allowedApiCalls: ['block_card', 'report_fraud', 'get_security_alerts', 'freeze_account'],
                restrictedDataTypes: ['balance', 'payments', 'transfers', 'identity_verification'],
                restrictedApiCalls: ['get_balance', 'process_payment', 'transfer_money', 'verify_identity', 'reset_password']
            },
            'PaymentsAgent': {
                allowedDataTypes: ['payments', 'transfers', 'payment_history', 'beneficiaries'],
                allowedApiCalls: ['process_payment', 'transfer_money', 'get_payment_history', 'validate_beneficiary'],
                restrictedDataTypes: ['identity_verification', 'fraud_actions', 'detailed_balance'],
                restrictedApiCalls: ['verify_identity', 'block_card', 'report_fraud', 'reset_password']
            }
        };
        
        this.debug.info('SecurityManager initialized with domain permissions', {
            agentTypes: Object.keys(this.domainPermissions)
        });
    }
    
    /**
     * Validates if an agent has permission to access specific data types
     * @param {string} agentName - Name of the agent requesting access
     * @param {Array<string>} requestedDataTypes - Data types the agent wants to access
     * @returns {Object} - Validation result with allowed/denied data types
     */
    validateDataAccess(agentName, requestedDataTypes) {
        const startTime = Date.now();
        
        try {
            const permissions = this.domainPermissions[agentName];
            if (!permissions) {
                this.logSecurityEvent('UNKNOWN_AGENT', agentName, 'data_access', requestedDataTypes, false);
                return {
                    success: false,
                    error: `Unknown agent type: ${agentName}`,
                    allowedDataTypes: [],
                    deniedDataTypes: requestedDataTypes
                };
            }
            
            const allowedDataTypes = [];
            const deniedDataTypes = [];
            
            for (const dataType of requestedDataTypes) {
                if (permissions.allowedDataTypes.includes(dataType)) {
                    allowedDataTypes.push(dataType);
                } else if (permissions.restrictedDataTypes.includes(dataType)) {
                    deniedDataTypes.push(dataType);
                    this.logSecurityEvent('RESTRICTED_DATA_ACCESS', agentName, 'data_access', [dataType], false);
                } else {
                    // Data type not explicitly defined - default to deny for security
                    deniedDataTypes.push(dataType);
                    this.logSecurityEvent('UNDEFINED_DATA_ACCESS', agentName, 'data_access', [dataType], false);
                }
            }
            
            const success = deniedDataTypes.length === 0;
            const processingTime = Date.now() - startTime;
            
            this.debug.info('Data access validation completed', {
                agentName,
                requestedDataTypes,
                allowedDataTypes,
                deniedDataTypes,
                success,
                processingTime
            });
            
            if (success) {
                this.logSecurityEvent('DATA_ACCESS_GRANTED', agentName, 'data_access', allowedDataTypes, true);
            }
            
            return {
                success,
                allowedDataTypes,
                deniedDataTypes,
                processingTime
            };
            
        } catch (error) {
            this.debug.error('Data access validation failed', {
                agentName,
                requestedDataTypes,
                error: error.message
            });
            
            this.logSecurityEvent('DATA_ACCESS_ERROR', agentName, 'data_access', requestedDataTypes, false, error.message);
            
            return {
                success: false,
                error: error.message,
                allowedDataTypes: [],
                deniedDataTypes: requestedDataTypes
            };
        }
    }
    
    /**
     * Validates if an agent has permission to make specific API calls
     * @param {string} agentName - Name of the agent requesting API access
     * @param {Array<string>} requestedApiCalls - API calls the agent wants to make
     * @returns {Object} - Validation result with allowed/denied API calls
     */
    validateApiAccess(agentName, requestedApiCalls) {
        const startTime = Date.now();
        
        try {
            const permissions = this.domainPermissions[agentName];
            if (!permissions) {
                this.logSecurityEvent('UNKNOWN_AGENT', agentName, 'api_access', requestedApiCalls, false);
                return {
                    success: false,
                    error: `Unknown agent type: ${agentName}`,
                    allowedApiCalls: [],
                    deniedApiCalls: requestedApiCalls
                };
            }
            
            const allowedApiCalls = [];
            const deniedApiCalls = [];
            
            for (const apiCall of requestedApiCalls) {
                if (permissions.allowedApiCalls.includes(apiCall)) {
                    allowedApiCalls.push(apiCall);
                } else if (permissions.restrictedApiCalls.includes(apiCall)) {
                    deniedApiCalls.push(apiCall);
                    this.logSecurityEvent('RESTRICTED_API_ACCESS', agentName, 'api_access', [apiCall], false);
                } else {
                    // API call not explicitly defined - default to deny for security
                    deniedApiCalls.push(apiCall);
                    this.logSecurityEvent('UNDEFINED_API_ACCESS', agentName, 'api_access', [apiCall], false);
                }
            }
            
            const success = deniedApiCalls.length === 0;
            const processingTime = Date.now() - startTime;
            
            this.debug.info('API access validation completed', {
                agentName,
                requestedApiCalls,
                allowedApiCalls,
                deniedApiCalls,
                success,
                processingTime
            });
            
            if (success) {
                this.logSecurityEvent('API_ACCESS_GRANTED', agentName, 'api_access', allowedApiCalls, true);
            }
            
            return {
                success,
                allowedApiCalls,
                deniedApiCalls,
                processingTime
            };
            
        } catch (error) {
            this.debug.error('API access validation failed', {
                agentName,
                requestedApiCalls,
                error: error.message
            });
            
            this.logSecurityEvent('API_ACCESS_ERROR', agentName, 'api_access', requestedApiCalls, false, error.message);
            
            return {
                success: false,
                error: error.message,
                allowedApiCalls: [],
                deniedApiCalls: requestedApiCalls
            };
        }
    }
    
    /**
     * Creates a sandboxed API client for an agent with restricted access
     * @param {string} agentName - Name of the agent
     * @param {Object} baseApiClient - Base API client to sandbox
     * @returns {Object} - Sandboxed API client with access controls
     */
    createSandboxedApiClient(agentName, baseApiClient) {
        const permissions = this.domainPermissions[agentName];
        if (!permissions) {
            throw new Error(`Cannot create sandboxed API client for unknown agent: ${agentName}`);
        }
        
        const sandboxedClient = {
            // Wrap the original generateChatCompletion method
            generateChatCompletion: async (messages, options) => {
                // Log API usage for audit
                this.logSecurityEvent('API_CALL', agentName, 'llm_api', ['generateChatCompletion'], true);
                
                // Call original method
                return await baseApiClient.generateChatCompletion(messages, options);
            },
            
            // Add domain-specific API methods with validation
            callDomainApi: async (apiCall, parameters) => {
                const validation = this.validateApiAccess(agentName, [apiCall]);
                
                if (!validation.success) {
                    throw new Error(`Agent ${agentName} is not authorized to call API: ${apiCall}`);
                }
                
                // Simulate domain-specific API calls (in real implementation, these would call actual APIs)
                return this.simulateDomainApiCall(agentName, apiCall, parameters);
            },
            
            // Add data access method with validation
            accessData: async (dataTypes) => {
                const validation = this.validateDataAccess(agentName, dataTypes);
                
                if (!validation.success) {
                    throw new Error(`Agent ${agentName} is not authorized to access data types: ${validation.deniedDataTypes.join(', ')}`);
                }
                
                // Return only allowed data
                return this.simulateDataAccess(agentName, validation.allowedDataTypes);
            }
        };
        
        this.debug.info('Created sandboxed API client', {
            agentName,
            allowedApiCalls: permissions.allowedApiCalls,
            allowedDataTypes: permissions.allowedDataTypes
        });
        
        return sandboxedClient;
    }
    
    /**
     * Simulates domain-specific API calls for testing purposes
     * @param {string} agentName - Name of the agent making the call
     * @param {string} apiCall - API call being made
     * @param {Object} parameters - Parameters for the API call
     * @returns {Object} - Simulated API response
     */
    simulateDomainApiCall(agentName, apiCall, parameters) {
        this.debug.info('Simulating domain API call', { agentName, apiCall, parameters });
        
        // Simulate different API responses based on the call
        switch (apiCall) {
            case 'verify_identity':
                return { success: true, verified: true, method: 'security_questions' };
            case 'get_balance':
                return { success: true, balance: 1250.75, currency: 'GBP' };
            case 'get_transactions':
                return { 
                    success: true, 
                    transactions: [
                        { date: '2025-01-20', amount: -45.50, description: 'Grocery Store' },
                        { date: '2025-01-19', amount: 2500.00, description: 'Salary Deposit' }
                    ]
                };
            case 'block_card':
                return { success: true, cardBlocked: true, reference: 'BLK-' + Date.now() };
            case 'process_payment':
                return { success: true, transactionId: 'TXN-' + Date.now(), status: 'processed' };
            default:
                return { success: false, error: 'Unknown API call' };
        }
    }
    
    /**
     * Simulates data access for testing purposes
     * @param {string} agentName - Name of the agent accessing data
     * @param {Array<string>} dataTypes - Data types being accessed
     * @returns {Object} - Simulated data response
     */
    simulateDataAccess(agentName, dataTypes) {
        this.debug.info('Simulating data access', { agentName, dataTypes });
        
        const data = {};
        
        for (const dataType of dataTypes) {
            switch (dataType) {
                case 'balance':
                    data.balance = { amount: 1250.75, currency: 'GBP' };
                    break;
                case 'transactions':
                    data.transactions = [
                        { date: '2025-01-20', amount: -45.50, description: 'Grocery Store' },
                        { date: '2025-01-19', amount: 2500.00, description: 'Salary Deposit' }
                    ];
                    break;
                case 'identity':
                    data.identity = { verified: true, lastVerification: '2025-01-15' };
                    break;
                case 'fraud_alerts':
                    data.fraudAlerts = [
                        { date: '2025-01-18', type: 'suspicious_login', resolved: true }
                    ];
                    break;
                default:
                    data[dataType] = { available: true, restricted: false };
            }
        }
        
        return { success: true, data };
    }
    
    /**
     * Logs security events for audit purposes
     * @param {string} eventType - Type of security event
     * @param {string} agentName - Name of the agent involved
     * @param {string} accessType - Type of access (data_access, api_access, etc.)
     * @param {Array<string>} resources - Resources being accessed
     * @param {boolean} success - Whether the access was successful
     * @param {string} error - Error message if any
     */
    logSecurityEvent(eventType, agentName, accessType, resources, success, error = null) {
        const event = {
            timestamp: new Date().toISOString(),
            eventType,
            agentName,
            accessType,
            resources,
            success,
            error,
            sessionId: this.generateSessionId()
        };
        
        this.auditLog.push(event);
        
        // Maintain audit log size
        if (this.auditLog.length > this.maxAuditLogSize) {
            this.auditLog.shift();
        }
        
        // Log to debug system
        if (success) {
            this.debug.info('Security event logged', event);
        } else {
            this.debug.warn('Security violation logged', event);
        }
        
        // In production, this would also send to external security monitoring
        this.notifySecurityMonitoring(event);
    }
    
    /**
     * Generates a session ID for tracking related security events
     * @returns {string} - Session ID
     */
    generateSessionId() {
        return 'SEC-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Notifies external security monitoring systems (simulated)
     * @param {Object} event - Security event to report
     */
    notifySecurityMonitoring(event) {
        // In production, this would send to external security systems
        if (!event.success) {
            this.debug.warn('Security violation detected - would notify monitoring systems', {
                eventType: event.eventType,
                agentName: event.agentName,
                resources: event.resources
            });
        }
    }
    
    /**
     * Gets security audit log entries
     * @param {Object} filters - Optional filters for the audit log
     * @returns {Array<Object>} - Filtered audit log entries
     */
    getAuditLog(filters = {}) {
        let filteredLog = [...this.auditLog];
        
        if (filters.agentName) {
            filteredLog = filteredLog.filter(event => event.agentName === filters.agentName);
        }
        
        if (filters.eventType) {
            filteredLog = filteredLog.filter(event => event.eventType === filters.eventType);
        }
        
        if (filters.success !== undefined) {
            filteredLog = filteredLog.filter(event => event.success === filters.success);
        }
        
        if (filters.since) {
            const sinceDate = new Date(filters.since);
            filteredLog = filteredLog.filter(event => new Date(event.timestamp) >= sinceDate);
        }
        
        return filteredLog.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    
    /**
     * Gets security statistics
     * @returns {Object} - Security statistics
     */
    getSecurityStats() {
        const totalEvents = this.auditLog.length;
        const violations = this.auditLog.filter(event => !event.success).length;
        const agentStats = {};
        
        for (const event of this.auditLog) {
            if (!agentStats[event.agentName]) {
                agentStats[event.agentName] = { total: 0, violations: 0 };
            }
            agentStats[event.agentName].total++;
            if (!event.success) {
                agentStats[event.agentName].violations++;
            }
        }
        
        return {
            totalEvents,
            violations,
            violationRate: totalEvents > 0 ? (violations / totalEvents * 100).toFixed(2) + '%' : '0%',
            agentStats,
            lastEvent: this.auditLog.length > 0 ? this.auditLog[this.auditLog.length - 1].timestamp : null
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityManager;
} else {
    window.SecurityManager = SecurityManager;
}