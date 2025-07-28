/**
 * Security Enhancement Layer for Voice Banking AI Assistant
 * Integrates rate limiting, request validation, and audit logging
 */

// Helper function to get classes from appropriate environment
function getSecurityClasses() {
    if (typeof module !== 'undefined' && module.exports) {
        // Node.js environment
        const { RateLimiter, RateLimitError } = require('./rate-limiter');
        const { RequestValidator, ValidationError } = require('./request-validator');
        const { AuditLogger } = require('./audit-logger');
        return { RateLimiter, RateLimitError, RequestValidator, ValidationError, AuditLogger };
    } else {
        // Browser environment
        return {
            RateLimiter: window.RateLimiter,
            RateLimitError: window.RateLimitError,
            RequestValidator: window.RequestValidator,
            ValidationError: window.ValidationError,
            AuditLogger: window.AuditLogger
        };
    }
}

class SecurityEnhancementLayer {
    constructor(options = {}) {
        this.config = {
            // Enable/disable security features
            rateLimiting: options.rateLimiting !== false,
            requestValidation: options.requestValidation !== false,
            auditLogging: options.auditLogging !== false,
            
            // Security policies
            strictMode: options.strictMode || false,
            blockSuspiciousRequests: options.blockSuspiciousRequests !== false,
            
            // Rate limiting configuration
            rateLimits: {
                api: { requests: 100, window: 60000 }, // 100 requests per minute
                user: { requests: 50, window: 60000 },  // 50 requests per minute per user
                ip: { requests: 200, window: 60000 },   // 200 requests per minute per IP
                agent: { requests: 30, window: 60000 }  // 30 agent requests per minute
            },
            
            // Validation schemas
            validationSchemas: options.validationSchemas || {},
            
            // Audit logging configuration
            auditConfig: options.auditConfig || {}
        };

        // Initialize security components
        const classes = getSecurityClasses();
        const { RateLimiter: RateLimiterClass, RequestValidator: RequestValidatorClass, AuditLogger: AuditLoggerClass } = classes;
        
        this.rateLimiter = new RateLimiterClass({
            limits: this.config.rateLimits,
            enabled: this.config.rateLimiting
        });

        this.requestValidator = new RequestValidatorClass({
            ...options.validationConfig
        });

        this.auditLogger = new AuditLoggerClass({
            ...this.config.auditConfig,
            enabled: this.config.auditLogging
        });

        // Security metrics
        this.metrics = {
            totalRequests: 0,
            blockedRequests: 0,
            rateLimitViolations: 0,
            validationFailures: 0,
            securityEvents: 0,
            startTime: Date.now()
        };

        // Suspicious activity tracking
        this.suspiciousActivity = new Map();
        this.blockedIPs = new Set();
        this.trustedUsers = new Set();
    }

    /**
     * Main security wrapper method - validates and processes requests securely
     * @param {Object} request - Request object with data and metadata
     * @param {Function} processor - Function to process the validated request
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} - Processed result or error
     */
    async validateAndProcess(request, processor, options = {}) {
        const startTime = Date.now();
        const requestId = this.generateRequestId();
        
        // Add request metadata
        const enrichedRequest = {
            ...request,
            metadata: {
                requestId,
                timestamp: new Date().toISOString(),
                ipAddress: request.ipAddress || 'unknown',
                userAgent: request.userAgent || 'unknown',
                userId: request.userId,
                sessionId: request.sessionId,
                ...request.metadata
            }
        };

        this.metrics.totalRequests++;

        try {
            // Step 1: Pre-processing security checks
            await this.performPreSecurityChecks(enrichedRequest);

            // Step 2: Rate limiting
            if (this.config.rateLimiting) {
                await this.checkRateLimits(enrichedRequest);
            }

            // Step 3: Request validation
            let validatedRequest = enrichedRequest;
            if (this.config.requestValidation && options.schema) {
                validatedRequest = await this.validateRequest(enrichedRequest, options.schema);
            }

            // Step 4: Suspicious activity detection
            await this.detectSuspiciousActivity(validatedRequest);

            // Step 5: Audit logging - request received
            this.auditLogger.logUserAction({
                action: 'REQUEST_RECEIVED',
                userId: validatedRequest.userId,
                sessionId: validatedRequest.sessionId,
                ipAddress: validatedRequest.metadata.ipAddress,
                userAgent: validatedRequest.metadata.userAgent,
                success: true,
                details: {
                    requestId,
                    endpoint: options.endpoint,
                    schema: options.schema
                }
            });

            // Step 6: Process the request
            const result = await this.processWithSecurity(validatedRequest, processor, options);

            // Step 7: Post-processing security checks
            const finalResult = await this.performPostSecurityChecks(result, validatedRequest);

            // Step 8: Audit logging - request completed
            const duration = Date.now() - startTime;
            this.auditLogger.logApiCall({
                endpoint: options.endpoint || 'unknown',
                method: options.method || 'POST',
                requestId,
                userId: validatedRequest.userId,
                duration,
                statusCode: 200,
                success: true,
                ipAddress: validatedRequest.metadata.ipAddress
            });

            return {
                success: true,
                data: finalResult,
                metadata: {
                    requestId,
                    processingTime: duration,
                    securityChecks: 'passed'
                }
            };

        } catch (error) {
            return await this.handleSecurityError(error, enrichedRequest, startTime);
        }
    }

    /**
     * Perform pre-processing security checks
     */
    async performPreSecurityChecks(request) {
        // Check if IP is blocked
        if (this.blockedIPs.has(request.metadata.ipAddress)) {
            this.metrics.blockedRequests++;
            throw new SecurityError('IP address is blocked', 'BLOCKED_IP', request.metadata.ipAddress);
        }

        // Check for basic request structure
        if (!request || typeof request !== 'object') {
            throw new SecurityError('Invalid request structure', 'INVALID_REQUEST', request);
        }

        // Check for required metadata
        if (!request.metadata || !request.metadata.requestId) {
            throw new SecurityError('Missing required request metadata', 'MISSING_METADATA', request);
        }
    }

    /**
     * Check rate limits for the request
     */
    async checkRateLimits(request) {
        try {
            const checks = [];

            // Add IP-based rate limiting
            if (request.metadata.ipAddress && request.metadata.ipAddress !== 'unknown') {
                checks.push({ identifier: request.metadata.ipAddress, type: 'ip' });
            }

            // Add user-based rate limiting
            if (request.userId) {
                checks.push({ identifier: request.userId, type: 'user' });
            }

            // Add general API rate limiting
            checks.push({ identifier: 'global', type: 'api' });

            // Check all rate limits
            await this.rateLimiter.checkMultipleLimits(checks);

        } catch (error) {
            const classes = getSecurityClasses();
            const { RateLimitError: RateLimitErrorClass } = classes;
            
            if (error instanceof RateLimitErrorClass) {
                this.metrics.rateLimitViolations++;
                
                // Log security event
                this.auditLogger.logSecurityEvent({
                    eventType: 'RATE_LIMIT_EXCEEDED',
                    severity: 'HIGH',
                    userId: request.userId,
                    ipAddress: request.metadata.ipAddress,
                    userAgent: request.metadata.userAgent,
                    reason: error.message,
                    action: 'BLOCKED',
                    riskScore: 8
                });

                // Track suspicious activity
                this.trackSuspiciousActivity(request.metadata.ipAddress, 'RATE_LIMIT_EXCEEDED');
                
                throw error;
            }
            throw error;
        }
    }

    /**
     * Validate request against schema
     */
    async validateRequest(request, schemaName) {
        try {
            const validatedData = this.requestValidator.validate(request.data || request, schemaName);
            return {
                ...request,
                data: validatedData
            };
        } catch (error) {
            const classes = getSecurityClasses();
            const { ValidationError: ValidationErrorClass } = classes;
            
            if (error instanceof ValidationErrorClass) {
                this.metrics.validationFailures++;
                
                // Log security event
                this.auditLogger.logSecurityEvent({
                    eventType: 'VALIDATION_FAILED',
                    severity: 'MEDIUM',
                    userId: request.userId,
                    ipAddress: request.metadata.ipAddress,
                    userAgent: request.metadata.userAgent,
                    reason: error.message,
                    action: 'BLOCKED',
                    requestData: request.data,
                    riskScore: 5
                });

                throw error;
            }
            throw error;
        }
    }

    /**
     * Detect suspicious activity patterns
     */
    async detectSuspiciousActivity(request) {
        const ipAddress = request.metadata.ipAddress;
        const userId = request.userId;

        // Skip checks for trusted users
        if (userId && this.trustedUsers.has(userId)) {
            return;
        }

        // Check for rapid requests from same IP
        const ipActivity = this.suspiciousActivity.get(ipAddress) || { count: 0, lastSeen: 0, violations: [] };
        const now = Date.now();
        
        // Reset counter if more than 1 minute has passed
        if (now - ipActivity.lastSeen > 60000) {
            ipActivity.count = 0;
            ipActivity.violations = [];
        }

        ipActivity.count++;
        ipActivity.lastSeen = now;

        // Flag suspicious if too many requests in short time
        if (ipActivity.count > 20) { // More than 20 requests per minute
            ipActivity.violations.push({
                type: 'RAPID_REQUESTS',
                timestamp: now,
                count: ipActivity.count
            });

            this.auditLogger.logSecurityEvent({
                eventType: 'SUSPICIOUS_ACTIVITY',
                severity: 'HIGH',
                userId: request.userId,
                ipAddress: ipAddress,
                userAgent: request.metadata.userAgent,
                reason: `Rapid requests detected: ${ipActivity.count} requests in 1 minute`,
                action: 'FLAGGED',
                riskScore: 7
            });

            // Block IP if too many violations
            if (ipActivity.violations.length > 3) {
                this.blockedIPs.add(ipAddress);
                this.auditLogger.logSecurityEvent({
                    eventType: 'IP_BLOCKED',
                    severity: 'CRITICAL',
                    ipAddress: ipAddress,
                    reason: 'Multiple suspicious activity violations',
                    action: 'BLOCKED',
                    riskScore: 10
                });
            }
        }

        this.suspiciousActivity.set(ipAddress, ipActivity);
    }

    /**
     * Process request with additional security monitoring
     */
    async processWithSecurity(request, processor, options) {
        const startTime = Date.now();
        
        try {
            // Set timeout for processing
            const timeout = options.timeout || 30000; // 30 seconds default
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request processing timeout')), timeout);
            });

            // Process with timeout
            const result = await Promise.race([
                processor(request),
                timeoutPromise
            ]);

            // Log performance metrics
            const duration = Date.now() - startTime;
            this.auditLogger.logPerformance({
                operation: options.endpoint || 'unknown',
                duration,
                userId: request.userId,
                component: 'security-layer',
                threshold: 5000, // 5 second threshold
                exceeded: duration > 5000
            });

            return result;

        } catch (error) {
            // Log processing error
            this.auditLogger.logError(error, {
                component: 'security-layer',
                operation: 'processWithSecurity',
                userId: request.userId,
                requestId: request.metadata.requestId
            });

            throw error;
        }
    }

    /**
     * Perform post-processing security checks
     */
    async performPostSecurityChecks(result, request) {
        // Sanitize sensitive data in response
        if (result && typeof result === 'object') {
            return this.sanitizeResponse(result);
        }
        
        return result;
    }

    /**
     * Handle security-related errors
     */
    async handleSecurityError(error, request, startTime) {
        this.metrics.blockedRequests++;
        const duration = Date.now() - startTime;

        // Log the error
        this.auditLogger.logError(error, {
            component: 'security-layer',
            operation: 'validateAndProcess',
            userId: request.userId,
            requestId: request.metadata?.requestId,
            inputData: request.data,
            recovery: 'request_blocked'
        });

        // Log API call failure
        this.auditLogger.logApiCall({
            endpoint: 'security-validation',
            requestId: request.metadata?.requestId,
            userId: request.userId,
            duration,
            statusCode: this.getErrorStatusCode(error),
            success: false,
            errorType: error.name,
            ipAddress: request.metadata?.ipAddress
        });

        // Return structured error response
        return {
            success: false,
            error: {
                message: this.getSafeErrorMessage(error),
                type: error.name,
                code: error.code || 'SECURITY_ERROR',
                timestamp: new Date().toISOString(),
                requestId: request.metadata?.requestId
            },
            metadata: {
                processingTime: duration,
                securityChecks: 'failed'
            }
        };
    }

    /**
     * Track suspicious activity
     */
    trackSuspiciousActivity(identifier, activityType) {
        const activity = this.suspiciousActivity.get(identifier) || { count: 0, lastSeen: 0, violations: [] };
        activity.violations.push({
            type: activityType,
            timestamp: Date.now()
        });
        this.suspiciousActivity.set(identifier, activity);
    }

    /**
     * Sanitize response data
     */
    sanitizeResponse(response) {
        // Remove any sensitive fields that might have leaked through
        const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'ssn', 'account'];
        
        const sanitized = JSON.parse(JSON.stringify(response));
        
        const sanitizeObject = (obj) => {
            if (!obj || typeof obj !== 'object') return obj;
            
            for (const [key, value] of Object.entries(obj)) {
                if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                    obj[key] = '[REDACTED]';
                } else if (typeof value === 'object' && value !== null) {
                    sanitizeObject(value);
                }
            }
        };
        
        sanitizeObject(sanitized);
        return sanitized;
    }

    /**
     * Get safe error message for client
     */
    getSafeErrorMessage(error) {
        // Don't expose internal error details in production
        const classes = getSecurityClasses();
        const { RateLimitError: RateLimitErrorClass, ValidationError: ValidationErrorClass } = classes;
        
        if (error instanceof RateLimitErrorClass) {
            return `Rate limit exceeded. Please try again in ${error.retryAfter} seconds.`;
        }
        
        if (error instanceof ValidationErrorClass) {
            return `Invalid request: ${error.message}`;
        }
        
        if (error instanceof SecurityError) {
            return 'Request blocked for security reasons.';
        }
        
        return 'Request could not be processed.';
    }

    /**
     * Get HTTP status code for error
     */
    getErrorStatusCode(error) {
        const classes = getSecurityClasses();
        const { RateLimitError: RateLimitErrorClass, ValidationError: ValidationErrorClass } = classes;
        
        if (error instanceof RateLimitErrorClass) return 429;
        if (error instanceof ValidationErrorClass) return 400;
        if (error instanceof SecurityError) return 403;
        return 500;
    }

    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Add trusted user
     */
    addTrustedUser(userId) {
        this.trustedUsers.add(userId);
    }

    /**
     * Remove trusted user
     */
    removeTrustedUser(userId) {
        this.trustedUsers.delete(userId);
    }

    /**
     * Block IP address
     */
    blockIP(ipAddress) {
        this.blockedIPs.add(ipAddress);
        this.auditLogger.logSecurityEvent({
            eventType: 'IP_BLOCKED',
            severity: 'HIGH',
            ipAddress: ipAddress,
            reason: 'Manually blocked',
            action: 'BLOCKED',
            riskScore: 9
        });
    }

    /**
     * Unblock IP address
     */
    unblockIP(ipAddress) {
        this.blockedIPs.delete(ipAddress);
        this.suspiciousActivity.delete(ipAddress);
    }

    /**
     * Get security metrics
     */
    getMetrics() {
        const uptime = Date.now() - this.metrics.startTime;
        return {
            ...this.metrics,
            uptime,
            rateLimiterStats: this.rateLimiter.getStats(),
            auditLoggerStats: this.auditLogger.getStats(),
            blockedIPs: Array.from(this.blockedIPs),
            trustedUsers: Array.from(this.trustedUsers),
            suspiciousActivityCount: this.suspiciousActivity.size
        };
    }

    /**
     * Get security statistics (alias for getMetrics for AgentRouter compatibility)
     */
    getSecurityStats() {
        return this.getMetrics();
    }

    /**
     * Create a sandboxed API client for an agent
     * @param {string} agentName - Name of the agent
     * @param {Object} baseApiClient - Base API client to wrap
     * @returns {Object} Sandboxed API client
     */
    createSandboxedApiClient(agentName, baseApiClient) {
        if (!baseApiClient) {
            throw new Error('Base API client is required for sandboxing');
        }

        // Create a proxy that wraps the API client with security checks
        const sandboxedClient = {
            // Wrap the speechToText method
            speechToText: async (audioBlob, options = {}) => {
                try {
                    // Log the API access attempt
                    this.auditLogger?.logSecurityEvent({
                        eventType: 'API_ACCESS',
                        agentName,
                        apiMethod: 'speechToText',
                        timestamp: new Date().toISOString(),
                        success: true
                    });

                    // Call the original method
                    return await baseApiClient.speechToText(audioBlob, options);
                } catch (error) {
                    // Log the failed attempt
                    this.auditLogger?.logSecurityEvent({
                        eventType: 'API_ACCESS_FAILED',
                        agentName,
                        apiMethod: 'speechToText',
                        error: error.message,
                        timestamp: new Date().toISOString(),
                        success: false
                    });
                    throw error;
                }
            },

            // Wrap the generateChatCompletion method
            generateChatCompletion: async (messages, options = {}) => {
                try {
                    // Log the API access attempt
                    this.auditLogger?.logSecurityEvent({
                        eventType: 'API_ACCESS',
                        agentName,
                        apiMethod: 'generateChatCompletion',
                        timestamp: new Date().toISOString(),
                        success: true
                    });

                    // Call the original method
                    return await baseApiClient.generateChatCompletion(messages, options);
                } catch (error) {
                    // Log the failed attempt
                    this.auditLogger?.logSecurityEvent({
                        eventType: 'API_ACCESS_FAILED',
                        agentName,
                        apiMethod: 'generateChatCompletion',
                        error: error.message,
                        timestamp: new Date().toISOString(),
                        success: false
                    });
                    throw error;
                }
            },

            // Wrap the textToSpeech method
            textToSpeech: async (text, options = {}) => {
                try {
                    // Log the API access attempt
                    this.auditLogger?.logSecurityEvent({
                        eventType: 'API_ACCESS',
                        agentName,
                        apiMethod: 'textToSpeech',
                        timestamp: new Date().toISOString(),
                        success: true
                    });

                    // Call the original method
                    return await baseApiClient.textToSpeech(text, options);
                } catch (error) {
                    // Log the failed attempt
                    this.auditLogger?.logSecurityEvent({
                        eventType: 'API_ACCESS_FAILED',
                        agentName,
                        apiMethod: 'textToSpeech',
                        error: error.message,
                        timestamp: new Date().toISOString(),
                        success: false
                    });
                    throw error;
                }
            },

            // Pass through other properties and methods
            setApiKey: baseApiClient.setApiKey?.bind(baseApiClient),
            setTokenTracker: baseApiClient.setTokenTracker?.bind(baseApiClient),
            apiKey: baseApiClient.apiKey,
            tokenTracker: baseApiClient.tokenTracker
        };

        // Log the sandboxed client creation
        this.auditLogger?.logSecurityEvent({
            eventType: 'SANDBOXED_CLIENT_CREATED',
            agentName,
            timestamp: new Date().toISOString(),
            success: true
        });

        return sandboxedClient;
    }

    /**
     * Validate data access permissions for an agent
     * @param {string} agentName - Name of the agent requesting access
     * @param {Array<string>} dataTypes - Types of data being requested
     * @returns {Object} Validation result with success flag and details
     */
    validateDataAccess(agentName, dataTypes) {
        if (!Array.isArray(dataTypes)) {
            dataTypes = [dataTypes];
        }

        // Define allowed data types for each agent based on their actual requests
        const agentPermissions = {
            'IDVAgent': [
                'identity', 'verification', 'authentication', 'personal', 
                'identity_verification', 'user_data'
            ],
            'BankingInfoAgent': [
                'account', 'balance', 'transaction', 'statement', 'account_data', 
                'transaction_history', 'balance_info', 'balance', 'transactions', 'account_info'
            ],
            'FraudAgent': [
                'account', 'transaction', 'security', 'fraud', 'suspicious', 
                'fraud_alerts', 'security_actions', 'card_status', 'fraud_detection'
            ],
            'PaymentsAgent': [
                'account', 'balance', 'transaction', 'payment', 'transfer', 
                'payment_data', 'transfer_info', 'recipient_data', 'payments', 'transfers', 'payment_history'
            ]
        };

        const allowedDataTypes = agentPermissions[agentName] || [];
        const deniedDataTypes = dataTypes.filter(dataType => !allowedDataTypes.includes(dataType));
        const success = deniedDataTypes.length === 0;

        // Log the access attempt
        this.auditLogger?.logSecurityEvent({
            eventType: 'DATA_ACCESS_VALIDATION',
            agentName,
            requestedDataTypes: dataTypes,
            allowedDataTypes: allowedDataTypes.filter(type => dataTypes.includes(type)),
            deniedDataTypes,
            success,
            timestamp: new Date().toISOString()
        });

        return {
            success,
            allowedDataTypes: allowedDataTypes.filter(type => dataTypes.includes(type)),
            deniedDataTypes,
            agentName,
            requestedDataTypes: dataTypes
        };
    }

    /**
     * Validate API access permissions for an agent
     * @param {string} agentName - Name of the agent requesting access
     * @param {Array<string>} apiCalls - Types of API calls being requested
     * @returns {Object} Validation result with success flag and details
     */
    validateApiAccess(agentName, apiCalls) {
        if (!Array.isArray(apiCalls)) {
            apiCalls = [apiCalls];
        }

        // Define allowed API calls for each agent
        const agentApiPermissions = {
            'IDVAgent': ['speechToText', 'generateChatCompletion', 'textToSpeech'],
            'BankingInfoAgent': ['speechToText', 'generateChatCompletion', 'textToSpeech'],
            'FraudAgent': ['speechToText', 'generateChatCompletion', 'textToSpeech'],
            'PaymentsAgent': ['speechToText', 'generateChatCompletion', 'textToSpeech']
        };

        const allowedApiCalls = agentApiPermissions[agentName] || [];
        const deniedApiCalls = apiCalls.filter(apiCall => !allowedApiCalls.includes(apiCall));
        const success = deniedApiCalls.length === 0;

        // Log the access attempt
        this.auditLogger?.logSecurityEvent({
            eventType: 'API_ACCESS_VALIDATION',
            agentName,
            requestedApiCalls: apiCalls,
            allowedApiCalls: allowedApiCalls.filter(call => apiCalls.includes(call)),
            deniedApiCalls,
            success,
            timestamp: new Date().toISOString()
        });

        return {
            success,
            allowedApiCalls: allowedApiCalls.filter(call => apiCalls.includes(call)),
            deniedApiCalls,
            agentName,
            requestedApiCalls: apiCalls
        };
    }

    /**
     * Get audit log entries
     * @param {Object} filters - Optional filters for the audit log
     * @returns {Array} Array of audit log entries
     */
    getAuditLog(filters = {}) {
        if (!this.auditLogger || typeof this.auditLogger.getAuditLog !== 'function') {
            // Return empty array if audit logger is not available
            return [];
        }

        try {
            return this.auditLogger.getAuditLog(filters);
        } catch (error) {
            console.warn('Failed to get audit log:', error.message);
            return [];
        }
    }

    /**
     * Update security configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // Update component configurations
        if (newConfig.rateLimits) {
            this.rateLimiter.updateConfig({ limits: newConfig.rateLimits });
        }
        
        if (newConfig.validationConfig) {
            this.requestValidator.updateConfig(newConfig.validationConfig);
        }
        
        if (newConfig.auditConfig) {
            this.auditLogger.updateConfig(newConfig.auditConfig);
        }
    }

    /**
     * Reset security state
     */
    reset() {
        this.metrics = {
            totalRequests: 0,
            blockedRequests: 0,
            rateLimitViolations: 0,
            validationFailures: 0,
            securityEvents: 0,
            startTime: Date.now()
        };
        
        this.suspiciousActivity.clear();
        this.blockedIPs.clear();
        this.auditLogger.clearLogs();
    }

    /**
     * Destroy security layer and cleanup resources
     */
    destroy() {
        if (this.rateLimiter && typeof this.rateLimiter.destroy === 'function') {
            this.rateLimiter.destroy();
        }
        
        this.suspiciousActivity.clear();
        this.blockedIPs.clear();
        this.trustedUsers.clear();
    }
}

/**
 * Custom Security Error class
 */
class SecurityError extends Error {
    constructor(message, code, details) {
        super(message);
        this.name = 'SecurityError';
        this.code = code;
        this.details = details;
    }
}

// Export classes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SecurityEnhancementLayer, SecurityError };
} else if (typeof window !== 'undefined') {
    window.SecurityEnhancementLayer = SecurityEnhancementLayer;
    window.SecurityError = SecurityError;
    // Alias for backward compatibility
    window.SecurityManager = SecurityEnhancementLayer;
}