/**
 * Telemetry Hooks System - External telemetry integration framework
 * Allows external systems to hook into agent telemetry events
 */
class TelemetryHooksManager {
    constructor() {
        this.debug = window.debugManager?.createModuleLogger('TelemetryHooks') || console;
        this.hooks = new Map();
        this.globalHooks = [];
        this.enabled = true;
        
        // Event types that can be hooked
        this.eventTypes = [
            'agent.activated',
            'agent.completed',
            'agent.error',
            'agent.registered',
            'agent.unregistered',
            'llm.request',
            'llm.response',
            'llm.error',
            'routing.decision',
            'security.violation',
            'performance.threshold'
        ];
        
        this.debug.info('Telemetry Hooks Manager initialized', {
            supportedEvents: this.eventTypes
        });
    }
    
    /**
     * Register a telemetry hook for specific events
     * @param {string|Array<string>} events - Event type(s) to hook
     * @param {Function} callback - Callback function to execute
     * @param {Object} options - Hook options
     * @returns {string} - Hook ID for later removal
     */
    registerHook(events, callback, options = {}) {
        try {
            if (typeof callback !== 'function') {
                throw new Error('Callback must be a function');
            }
            
            const hookId = this.generateHookId();
            const eventArray = Array.isArray(events) ? events : [events];
            
            // Validate event types
            for (const event of eventArray) {
                if (!this.eventTypes.includes(event)) {
                    throw new Error(`Unsupported event type: ${event}`);
                }
            }
            
            const hook = {
                id: hookId,
                events: eventArray,
                callback,
                options: {
                    priority: options.priority || 100,
                    async: options.async || false,
                    filter: options.filter || null,
                    metadata: options.metadata || {},
                    enabled: options.enabled !== false
                },
                registeredAt: new Date().toISOString(),
                callCount: 0,
                lastCalled: null,
                errors: 0
            };
            
            this.hooks.set(hookId, hook);
            
            this.debug.info('Telemetry hook registered', {
                hookId,
                events: eventArray,
                priority: hook.options.priority
            });
            
            return hookId;
        } catch (error) {
            this.debug.error('Failed to register telemetry hook', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Register a global hook that receives all events
     * @param {Function} callback - Callback function to execute
     * @param {Object} options - Hook options
     * @returns {string} - Hook ID for later removal
     */
    registerGlobalHook(callback, options = {}) {
        const hookId = this.registerHook(this.eventTypes, callback, {
            ...options,
            global: true
        });
        
        this.globalHooks.push(hookId);
        
        this.debug.info('Global telemetry hook registered', { hookId });
        return hookId;
    }
    
    /**
     * Unregister a telemetry hook
     * @param {string} hookId - ID of the hook to remove
     * @returns {boolean} - True if hook was found and removed
     */
    unregisterHook(hookId) {
        if (!this.hooks.has(hookId)) {
            this.debug.warn('Hook not found for removal', { hookId });
            return false;
        }
        
        this.hooks.delete(hookId);
        
        // Remove from global hooks if it was global
        const globalIndex = this.globalHooks.indexOf(hookId);
        if (globalIndex !== -1) {
            this.globalHooks.splice(globalIndex, 1);
        }
        
        this.debug.info('Telemetry hook unregistered', { hookId });
        return true;
    }
    
    /**
     * Enable or disable a specific hook
     * @param {string} hookId - ID of the hook
     * @param {boolean} enabled - Whether to enable the hook
     * @returns {boolean} - True if successful
     */
    setHookEnabled(hookId, enabled) {
        const hook = this.hooks.get(hookId);
        if (!hook) {
            this.debug.warn('Hook not found for enable/disable', { hookId });
            return false;
        }
        
        hook.options.enabled = enabled;
        this.debug.info('Hook enabled state changed', { hookId, enabled });
        return true;
    }
    
    /**
     * Enable or disable all telemetry hooks
     * @param {boolean} enabled - Whether to enable telemetry
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        this.debug.info('Telemetry hooks globally enabled/disabled', { enabled });
    }
    
    /**
     * Emit a telemetry event to all registered hooks
     * @param {string} eventType - Type of event
     * @param {Object} eventData - Event data
     * @param {Object} context - Additional context
     */
    async emit(eventType, eventData, context = {}) {
        if (!this.enabled) {
            return;
        }
        
        try {
            const relevantHooks = this.getHooksForEvent(eventType);
            
            if (relevantHooks.length === 0) {
                return;
            }
            
            const event = {
                type: eventType,
                data: eventData,
                context,
                timestamp: new Date().toISOString(),
                id: this.generateEventId()
            };
            
            this.debug.info('Emitting telemetry event', {
                eventType,
                hookCount: relevantHooks.length,
                eventId: event.id
            });
            
            // Execute hooks in priority order
            const sortedHooks = relevantHooks.sort((a, b) => a.options.priority - b.options.priority);
            
            for (const hook of sortedHooks) {
                await this.executeHook(hook, event);
            }
        } catch (error) {
            this.debug.error('Error emitting telemetry event', {
                eventType,
                error: error.message
            });
        }
    }
    
    /**
     * Get hooks that should receive a specific event
     * @param {string} eventType - Type of event
     * @returns {Array<Object>} - Array of relevant hooks
     */
    getHooksForEvent(eventType) {
        const relevantHooks = [];
        
        for (const hook of this.hooks.values()) {
            if (!hook.options.enabled) {
                continue;
            }
            
            if (hook.events.includes(eventType)) {
                // Apply filter if specified
                if (hook.options.filter && !hook.options.filter(eventType)) {
                    continue;
                }
                
                relevantHooks.push(hook);
            }
        }
        
        return relevantHooks;
    }
    
    /**
     * Execute a specific hook with event data
     * @param {Object} hook - Hook configuration
     * @param {Object} event - Event data
     */
    async executeHook(hook, event) {
        try {
            hook.callCount++;
            hook.lastCalled = event.timestamp;
            
            if (hook.options.async) {
                // Execute asynchronously without waiting
                hook.callback(event).catch(error => {
                    hook.errors++;
                    this.debug.error('Async hook execution failed', {
                        hookId: hook.id,
                        error: error.message
                    });
                });
            } else {
                // Execute synchronously
                await hook.callback(event);
            }
        } catch (error) {
            hook.errors++;
            this.debug.error('Hook execution failed', {
                hookId: hook.id,
                eventType: event.type,
                error: error.message
            });
        }
    }
    
    /**
     * Generate a unique hook ID
     * @returns {string} - Unique hook ID
     */
    generateHookId() {
        return `hook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Generate a unique event ID
     * @returns {string} - Unique event ID
     */
    generateEventId() {
        return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Get statistics about registered hooks
     * @returns {Object} - Hook statistics
     */
    getHookStats() {
        const stats = {
            totalHooks: this.hooks.size,
            enabledHooks: 0,
            globalHooks: this.globalHooks.length,
            eventTypeCounts: {},
            totalCalls: 0,
            totalErrors: 0,
            enabled: this.enabled
        };
        
        for (const hook of this.hooks.values()) {
            if (hook.options.enabled) {
                stats.enabledHooks++;
            }
            
            stats.totalCalls += hook.callCount;
            stats.totalErrors += hook.errors;
            
            for (const eventType of hook.events) {
                stats.eventTypeCounts[eventType] = (stats.eventTypeCounts[eventType] || 0) + 1;
            }
        }
        
        return stats;
    }
    
    /**
     * Get detailed information about all hooks
     * @returns {Array<Object>} - Array of hook information
     */
    getHookDetails() {
        return Array.from(this.hooks.values()).map(hook => ({
            id: hook.id,
            events: hook.events,
            priority: hook.options.priority,
            enabled: hook.options.enabled,
            async: hook.options.async,
            metadata: hook.options.metadata,
            registeredAt: hook.registeredAt,
            callCount: hook.callCount,
            lastCalled: hook.lastCalled,
            errors: hook.errors,
            isGlobal: this.globalHooks.includes(hook.id)
        }));
    }
    
    /**
     * Clear all hooks
     */
    clearAllHooks() {
        const hookCount = this.hooks.size;
        this.hooks.clear();
        this.globalHooks = [];
        
        this.debug.info('All telemetry hooks cleared', { clearedCount: hookCount });
    }
    
    /**
     * Export hook configurations for backup
     * @returns {Object} - Hook configuration export
     */
    exportHooks() {
        const hooks = this.getHookDetails().map(hook => ({
            events: hook.events,
            priority: hook.priority,
            enabled: hook.enabled,
            async: hook.async,
            metadata: hook.metadata
            // Note: callback functions cannot be serialized
        }));
        
        return {
            hooks,
            enabled: this.enabled,
            exportedAt: new Date().toISOString()
        };
    }
    
    /**
     * Create predefined hooks for common telemetry scenarios
     */
    createPredefinedHooks() {
        // Performance monitoring hook
        this.registerHook(['agent.completed', 'llm.response'], (event) => {
            if (event.data.processingTime > 5000) { // 5 seconds threshold
                this.emit('performance.threshold', {
                    type: 'slow_processing',
                    processingTime: event.data.processingTime,
                    agentName: event.data.agentName,
                    threshold: 5000
                });
            }
        }, {
            priority: 10,
            metadata: { type: 'performance_monitor' }
        });
        
        // Error tracking hook
        this.registerHook(['agent.error', 'llm.error'], (event) => {
            console.error('Agent/LLM Error:', {
                type: event.type,
                error: event.data.error,
                agentName: event.data.agentName,
                timestamp: event.timestamp
            });
        }, {
            priority: 5,
            metadata: { type: 'error_tracker' }
        });
        
        // Usage analytics hook
        this.registerHook(['agent.activated'], (event) => {
            // Track agent usage patterns
            const usage = JSON.parse(localStorage.getItem('agent_usage_analytics') || '{}');
            const agentName = event.data.agentName;
            
            if (!usage[agentName]) {
                usage[agentName] = { count: 0, lastUsed: null };
            }
            
            usage[agentName].count++;
            usage[agentName].lastUsed = event.timestamp;
            
            localStorage.setItem('agent_usage_analytics', JSON.stringify(usage));
        }, {
            priority: 50,
            async: true,
            metadata: { type: 'usage_analytics' }
        });
        
        this.debug.info('Predefined telemetry hooks created');
    }
}

/**
 * Telemetry Event Emitter - Convenience class for emitting telemetry events
 */
class TelemetryEmitter {
    constructor(hooksManager) {
        this.hooksManager = hooksManager;
    }
    
    /**
     * Emit agent activation event
     * @param {string} agentName - Name of activated agent
     * @param {Object} data - Additional data
     */
    async agentActivated(agentName, data = {}) {
        await this.hooksManager.emit('agent.activated', {
            agentName,
            ...data
        });
    }
    
    /**
     * Emit agent completion event
     * @param {string} agentName - Name of completed agent
     * @param {Object} result - Agent result
     * @param {Object} data - Additional data
     */
    async agentCompleted(agentName, result, data = {}) {
        await this.hooksManager.emit('agent.completed', {
            agentName,
            success: result.success,
            processingTime: result.processingTime,
            tokensUsed: result.tokensUsed,
            error: result.error,
            ...data
        });
    }
    
    /**
     * Emit agent error event
     * @param {string} agentName - Name of agent with error
     * @param {Error} error - Error object
     * @param {Object} data - Additional data
     */
    async agentError(agentName, error, data = {}) {
        await this.hooksManager.emit('agent.error', {
            agentName,
            error: error.message,
            stack: error.stack,
            ...data
        });
    }
    
    /**
     * Emit LLM request event
     * @param {string} provider - LLM provider name
     * @param {Object} request - Request data
     */
    async llmRequest(provider, request) {
        await this.hooksManager.emit('llm.request', {
            provider,
            model: request.model,
            messageCount: request.messages?.length || 0,
            maxTokens: request.maxTokens,
            temperature: request.temperature
        });
    }
    
    /**
     * Emit LLM response event
     * @param {string} provider - LLM provider name
     * @param {Object} response - Response data
     */
    async llmResponse(provider, response) {
        await this.hooksManager.emit('llm.response', {
            provider,
            success: response.success,
            tokensUsed: response.tokensUsed,
            processingTime: response.processingTime,
            model: response.model
        });
    }
    
    /**
     * Emit routing decision event
     * @param {string} selectedAgent - Name of selected agent
     * @param {Array<string>} availableAgents - Names of available agents
     * @param {string} inputText - User input
     */
    async routingDecision(selectedAgent, availableAgents, inputText) {
        await this.hooksManager.emit('routing.decision', {
            selectedAgent,
            availableAgents,
            inputPreview: inputText.substring(0, 100),
            totalAgents: availableAgents.length
        });
    }
    
    /**
     * Emit security violation event
     * @param {string} agentName - Name of agent
     * @param {string} violation - Type of violation
     * @param {Object} details - Violation details
     */
    async securityViolation(agentName, violation, details) {
        await this.hooksManager.emit('security.violation', {
            agentName,
            violation,
            details,
            severity: details.severity || 'medium'
        });
    }
}

// Create global instances
window.telemetryHooksManager = new TelemetryHooksManager();
window.telemetryEmitter = new TelemetryEmitter(window.telemetryHooksManager);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TelemetryHooksManager, TelemetryEmitter };
} else {
    window.TelemetryHooksManager = TelemetryHooksManager;
    window.TelemetryEmitter = TelemetryEmitter;
}