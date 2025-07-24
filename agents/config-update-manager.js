/**
 * Configuration Update Manager - Handles real-time configuration updates
 * Manages broadcasting configuration changes to active agents and provides rollback functionality
 */

class ConfigUpdateManager {
    constructor() {
        this.debug = window.debugManager?.createModuleLogger('ConfigUpdateManager') || console;
        this.subscribers = new Map(); // Map of agent names to update callbacks
        this.configHistory = new Map(); // Map of agent names to configuration history
        this.maxHistorySize = 10; // Keep last 10 configurations for rollback
        this.updateQueue = []; // Queue for pending updates
        this.isProcessingUpdates = false;
        
        // Event listeners for configuration changes
        this.eventListeners = new Map();
        
        this.initialize();
    }
    
    /**
     * Initialize the Configuration Update Manager
     */
    initialize() {
        this.debug.log('Initializing Configuration Update Manager');
        
        // Set up event handling for storage changes (for cross-tab synchronization)
        this.setupStorageListener();
        
        this.debug.log('Configuration Update Manager initialized');
    }
    
    /**
     * Subscribe an agent to configuration updates
     * @param {string} agentName - Name of the agent
     * @param {Function} updateCallback - Callback function to handle updates
     * @returns {Function} Unsubscribe function
     */
    subscribe(agentName, updateCallback) {
        if (!this.subscribers.has(agentName)) {
            this.subscribers.set(agentName, new Set());
        }
        
        this.subscribers.get(agentName).add(updateCallback);
        
        this.debug.log(`Agent ${agentName} subscribed to configuration updates`);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.subscribers.get(agentName);
            if (callbacks) {
                callbacks.delete(updateCallback);
                if (callbacks.size === 0) {
                    this.subscribers.delete(agentName);
                }
            }
            this.debug.log(`Agent ${agentName} unsubscribed from configuration updates`);
        };
    }
    
    /**
     * Broadcast configuration update to subscribed agents
     * @param {string} agentName - Name of the agent (or 'all' for all agents)
     * @param {Object} configUpdate - Configuration update data
     * @param {Object} options - Update options
     * @returns {Promise<Object>} Update result
     */
    async broadcastUpdate(agentName, configUpdate, options = {}) {
        try {
            this.debug.log(`Broadcasting configuration update for ${agentName}`, configUpdate);
            
            // Validate the configuration update before broadcasting
            const validationResult = await this.validateConfigUpdate(agentName, configUpdate);
            if (!validationResult.valid) {
                return {
                    success: false,
                    error: 'Configuration validation failed',
                    details: validationResult.errors
                };
            }
            
            // Store current configuration for rollback if needed
            await this.storeConfigurationSnapshot(agentName, configUpdate);
            
            // Add update to queue
            const updateTask = {
                id: this.generateUpdateId(),
                agentName,
                configUpdate,
                options,
                timestamp: new Date().toISOString(),
                status: 'pending'
            };
            
            this.updateQueue.push(updateTask);
            
            // Process the update queue
            const result = await this.processUpdateQueue();
            
            return result;
            
        } catch (error) {
            this.debug.error('Error broadcasting configuration update:', error);
            return {
                success: false,
                error: 'Failed to broadcast configuration update',
                details: error.message
            };
        }
    }
    
    /**
     * Process the update queue
     * @returns {Promise<Object>} Processing result
     */
    async processUpdateQueue() {
        if (this.isProcessingUpdates) {
            return { success: true, message: 'Updates already being processed' };
        }
        
        this.isProcessingUpdates = true;
        const results = [];
        
        try {
            while (this.updateQueue.length > 0) {
                const updateTask = this.updateQueue.shift();
                updateTask.status = 'processing';
                
                const result = await this.processConfigUpdate(updateTask);
                results.push(result);
                
                // If update failed and rollback is enabled, perform rollback
                if (!result.success && updateTask.options.enableRollback !== false) {
                    await this.rollbackConfiguration(updateTask.agentName, updateTask.id);
                }
            }
            
            return {
                success: true,
                processedUpdates: results.length,
                results
            };
            
        } catch (error) {
            this.debug.error('Error processing update queue:', error);
            return {
                success: false,
                error: 'Failed to process update queue',
                details: error.message
            };
        } finally {
            this.isProcessingUpdates = false;
        }
    }
    
    /**
     * Process a single configuration update
     * @param {Object} updateTask - Update task to process
     * @returns {Promise<Object>} Processing result
     */
    async processConfigUpdate(updateTask) {
        const { agentName, configUpdate, options } = updateTask;
        
        try {
            // Determine which agents to update
            const targetAgents = agentName === 'all' ? 
                Array.from(this.subscribers.keys()) : 
                [agentName];
            
            const updateResults = [];
            
            for (const targetAgent of targetAgents) {
                const callbacks = this.subscribers.get(targetAgent);
                if (!callbacks || callbacks.size === 0) {
                    continue;
                }
                
                // Call each subscriber callback
                for (const callback of callbacks) {
                    try {
                        const result = await callback({
                            agentName: targetAgent,
                            configUpdate,
                            options,
                            updateId: updateTask.id,
                            timestamp: updateTask.timestamp
                        });
                        
                        updateResults.push({
                            agentName: targetAgent,
                            success: true,
                            result
                        });
                        
                    } catch (callbackError) {
                        this.debug.error(`Callback error for ${targetAgent}:`, callbackError);
                        updateResults.push({
                            agentName: targetAgent,
                            success: false,
                            error: callbackError.message
                        });
                    }
                }
            }
            
            // Trigger storage event for cross-tab synchronization
            this.triggerStorageEvent(agentName, configUpdate);
            
            updateTask.status = 'completed';
            
            return {
                success: true,
                updateId: updateTask.id,
                agentName,
                updateResults,
                timestamp: updateTask.timestamp
            };
            
        } catch (error) {
            updateTask.status = 'failed';
            this.debug.error('Error processing config update:', error);
            
            return {
                success: false,
                updateId: updateTask.id,
                agentName,
                error: error.message,
                timestamp: updateTask.timestamp
            };
        }
    }
    
    /**
     * Validate configuration update before applying
     * @param {string} agentName - Name of the agent
     * @param {Object} configUpdate - Configuration update to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateConfigUpdate(agentName, configUpdate) {
        const errors = [];
        
        try {
            // Basic structure validation
            if (!configUpdate || typeof configUpdate !== 'object') {
                errors.push('Configuration update must be an object');
                return { valid: false, errors };
            }
            
            // Validate different types of configuration updates
            if (configUpdate.type === 'guardrails' && configUpdate.data) {
                const guardrailsValidation = await this.validateGuardrailsUpdate(agentName, configUpdate.data);
                if (!guardrailsValidation.valid) {
                    errors.push(...guardrailsValidation.errors);
                }
            }
            
            if (configUpdate.type === 'voiceConfig' && configUpdate.data) {
                const voiceValidation = await this.validateVoiceConfigUpdate(agentName, configUpdate.data);
                if (!voiceValidation.valid) {
                    errors.push(...voiceValidation.errors);
                }
            }
            
            if (configUpdate.type === 'agentConfig' && configUpdate.data) {
                const agentValidation = await this.validateAgentConfigUpdate(agentName, configUpdate.data);
                if (!agentValidation.valid) {
                    errors.push(...agentValidation.errors);
                }
            }
            
            // Check for conflicting updates
            const conflictCheck = await this.checkForConflicts(agentName, configUpdate);
            if (!conflictCheck.valid) {
                errors.push(...conflictCheck.errors);
            }
            
            return {
                valid: errors.length === 0,
                errors
            };
            
        } catch (error) {
            this.debug.error('Error validating configuration update:', error);
            return {
                valid: false,
                errors: [`Validation error: ${error.message}`]
            };
        }
    }
    
    /**
     * Validate guardrails configuration update
     * @param {string} agentName - Name of the agent
     * @param {Object} guardrailsData - Guardrails data to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateGuardrailsUpdate(agentName, guardrailsData) {
        try {
            // Use GuardrailsManager validation if available
            if (window.guardrailsManager && window.guardrailsManager.validateGuardrails) {
                return window.guardrailsManager.validateGuardrails(guardrailsData);
            }
            
            // Basic validation if GuardrailsManager not available
            const errors = [];
            
            if (guardrailsData.allowedCapabilities && typeof guardrailsData.allowedCapabilities !== 'object') {
                errors.push('allowedCapabilities must be an object');
            }
            
            if (guardrailsData.restrictions && typeof guardrailsData.restrictions !== 'object') {
                errors.push('restrictions must be an object');
            }
            
            return {
                valid: errors.length === 0,
                errors
            };
            
        } catch (error) {
            return {
                valid: false,
                errors: [`Guardrails validation error: ${error.message}`]
            };
        }
    }
    
    /**
     * Validate voice configuration update
     * @param {string} agentName - Name of the agent
     * @param {Object} voiceConfigData - Voice config data to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateVoiceConfigUpdate(agentName, voiceConfigData) {
        try {
            // Use VoiceConfigManager validation if available
            if (window.voiceConfigManager && window.voiceConfigManager.validateVoiceConfig) {
                return window.voiceConfigManager.validateVoiceConfig(voiceConfigData);
            }
            
            // Basic validation if VoiceConfigManager not available
            const errors = [];
            
            if (voiceConfigData.ttsSettings) {
                const tts = voiceConfigData.ttsSettings;
                
                if (tts.speed !== undefined && (typeof tts.speed !== 'number' || tts.speed < 0.25 || tts.speed > 4.0)) {
                    errors.push('Speed must be a number between 0.25 and 4.0');
                }
                
                if (tts.pitch !== undefined && (typeof tts.pitch !== 'number' || tts.pitch < -20 || tts.pitch > 20)) {
                    errors.push('Pitch must be a number between -20 and 20 semitones');
                }
            }
            
            return {
                valid: errors.length === 0,
                errors
            };
            
        } catch (error) {
            return {
                valid: false,
                errors: [`Voice config validation error: ${error.message}`]
            };
        }
    }
    
    /**
     * Validate agent configuration update
     * @param {string} agentName - Name of the agent
     * @param {Object} agentConfigData - Agent config data to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateAgentConfigUpdate(agentName, agentConfigData) {
        try {
            // Use LLMManager validation if available
            if (window.llmManager && window.llmManager.validateConfiguration) {
                return window.llmManager.validateConfiguration(agentConfigData);
            }
            
            // Basic validation if LLMManager not available
            const errors = [];
            
            if (agentConfigData.enabled !== undefined && typeof agentConfigData.enabled !== 'boolean') {
                errors.push('enabled must be a boolean');
            }
            
            if (agentConfigData.priority !== undefined && (typeof agentConfigData.priority !== 'number' || agentConfigData.priority < 0)) {
                errors.push('priority must be a non-negative number');
            }
            
            return {
                valid: errors.length === 0,
                errors
            };
            
        } catch (error) {
            return {
                valid: false,
                errors: [`Agent config validation error: ${error.message}`]
            };
        }
    }
    
    /**
     * Check for conflicting configuration updates
     * @param {string} agentName - Name of the agent
     * @param {Object} configUpdate - Configuration update to check
     * @returns {Promise<Object>} Conflict check result
     */
    async checkForConflicts(agentName, configUpdate) {
        const errors = [];
        
        try {
            // Check if there are pending updates for the same agent
            const pendingUpdates = this.updateQueue.filter(task => 
                task.agentName === agentName && task.status === 'pending'
            );
            
            if (pendingUpdates.length > 0) {
                errors.push(`There are ${pendingUpdates.length} pending updates for agent ${agentName}`);
            }
            
            // Check for type-specific conflicts
            if (configUpdate.type === 'voiceConfig') {
                // Check if agent is currently in a conversation (would need integration with conversation manager)
                const isInConversation = await this.checkIfAgentInConversation(agentName);
                if (isInConversation && !configUpdate.options?.allowDuringConversation) {
                    errors.push(`Agent ${agentName} is currently in a conversation. Voice config updates not allowed unless explicitly permitted.`);
                }
            }
            
            return {
                valid: errors.length === 0,
                errors
            };
            
        } catch (error) {
            return {
                valid: false,
                errors: [`Conflict check error: ${error.message}`]
            };
        }
    }
    
    /**
     * Check if agent is currently in a conversation
     * @param {string} agentName - Name of the agent
     * @returns {Promise<boolean>} True if agent is in conversation
     */
    async checkIfAgentInConversation(agentName) {
        try {
            // This would integrate with the conversation/session manager
            // For now, return false as a safe default
            return false;
        } catch (error) {
            this.debug.warn('Could not check conversation status:', error);
            return false;
        }
    }
    
    /**
     * Store configuration snapshot for rollback
     * @param {string} agentName - Name of the agent
     * @param {Object} configUpdate - Configuration update
     * @returns {Promise<void>}
     */
    async storeConfigurationSnapshot(agentName, configUpdate) {
        try {
            if (!this.configHistory.has(agentName)) {
                this.configHistory.set(agentName, []);
            }
            
            const history = this.configHistory.get(agentName);
            
            // Get current configuration before update
            const currentConfig = await this.getCurrentConfiguration(agentName, configUpdate.type);
            
            const snapshot = {
                id: this.generateUpdateId(),
                timestamp: new Date().toISOString(),
                type: configUpdate.type,
                previousConfig: currentConfig,
                updateConfig: configUpdate.data,
                reason: configUpdate.reason || 'Configuration update'
            };
            
            history.unshift(snapshot);
            
            // Keep only the last N snapshots
            if (history.length > this.maxHistorySize) {
                history.splice(this.maxHistorySize);
            }
            
            this.debug.log(`Stored configuration snapshot for ${agentName}`, snapshot.id);
            
        } catch (error) {
            this.debug.error('Error storing configuration snapshot:', error);
        }
    }
    
    /**
     * Get current configuration for an agent
     * @param {string} agentName - Name of the agent
     * @param {string} configType - Type of configuration
     * @returns {Promise<Object>} Current configuration
     */
    async getCurrentConfiguration(agentName, configType) {
        try {
            switch (configType) {
                case 'guardrails':
                    return window.guardrailsManager?.getGuardrails(agentName) || null;
                case 'voiceConfig':
                    return window.voiceConfigManager?.getVoiceConfig(agentName) || null;
                case 'agentConfig':
                    return window.llmManager?.getAgentConfiguration(agentName) || null;
                default:
                    return null;
            }
        } catch (error) {
            this.debug.error('Error getting current configuration:', error);
            return null;
        }
    }
    
    /**
     * Rollback configuration to previous state
     * @param {string} agentName - Name of the agent
     * @param {string} updateId - ID of the update to rollback (optional)
     * @returns {Promise<Object>} Rollback result
     */
    async rollbackConfiguration(agentName, updateId = null) {
        try {
            const history = this.configHistory.get(agentName);
            if (!history || history.length === 0) {
                return {
                    success: false,
                    error: 'No configuration history available for rollback'
                };
            }
            
            // Find the snapshot to rollback to
            let snapshot;
            if (updateId) {
                snapshot = history.find(s => s.id === updateId);
            } else {
                snapshot = history[0]; // Most recent
            }
            
            if (!snapshot) {
                return {
                    success: false,
                    error: 'Configuration snapshot not found'
                };
            }
            
            // Create rollback update
            const rollbackUpdate = {
                type: snapshot.type,
                data: snapshot.previousConfig,
                reason: `Rollback from update ${snapshot.id}`,
                options: {
                    isRollback: true,
                    enableRollback: false // Prevent recursive rollbacks
                }
            };
            
            // Apply the rollback
            const result = await this.broadcastUpdate(agentName, rollbackUpdate, rollbackUpdate.options);
            
            if (result.success) {
                this.debug.log(`Successfully rolled back configuration for ${agentName}`, snapshot.id);
            }
            
            return result;
            
        } catch (error) {
            this.debug.error('Error rolling back configuration:', error);
            return {
                success: false,
                error: 'Failed to rollback configuration',
                details: error.message
            };
        }
    }
    
    /**
     * Get configuration history for an agent
     * @param {string} agentName - Name of the agent
     * @param {number} limit - Maximum number of history entries to return
     * @returns {Array} Configuration history
     */
    getConfigurationHistory(agentName, limit = 10) {
        const history = this.configHistory.get(agentName) || [];
        return history.slice(0, limit);
    }
    
    /**
     * Clear configuration history for an agent
     * @param {string} agentName - Name of the agent
     */
    clearConfigurationHistory(agentName) {
        this.configHistory.delete(agentName);
        this.debug.log(`Cleared configuration history for ${agentName}`);
    }
    
    /**
     * Set up storage listener for cross-tab synchronization
     */
    setupStorageListener() {
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('storage', (event) => {
                if (event.key && event.key.startsWith('config_update_')) {
                    this.handleStorageConfigUpdate(event);
                }
            });
        }
    }
    
    /**
     * Handle configuration update from storage event
     * @param {StorageEvent} event - Storage event
     */
    handleStorageConfigUpdate(event) {
        try {
            if (!event.newValue) return;
            
            const updateData = JSON.parse(event.newValue);
            const agentName = event.key.replace('config_update_', '');
            
            this.debug.log(`Received cross-tab configuration update for ${agentName}`);
            
            // Broadcast to local subscribers
            this.broadcastUpdate(agentName, updateData, { fromStorage: true });
            
        } catch (error) {
            this.debug.error('Error handling storage config update:', error);
        }
    }
    
    /**
     * Trigger storage event for cross-tab synchronization
     * @param {string} agentName - Name of the agent
     * @param {Object} configUpdate - Configuration update
     */
    triggerStorageEvent(agentName, configUpdate) {
        try {
            const key = `config_update_${agentName}`;
            const data = {
                ...configUpdate,
                timestamp: new Date().toISOString(),
                source: 'config-update-manager'
            };
            
            localStorage.setItem(key, JSON.stringify(data));
            
            // Clean up after a short delay
            setTimeout(() => {
                localStorage.removeItem(key);
            }, 1000);
            
        } catch (error) {
            this.debug.error('Error triggering storage event:', error);
        }
    }
    
    /**
     * Generate unique update ID
     * @returns {string} Unique update ID
     */
    generateUpdateId() {
        return `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Get current update queue status
     * @returns {Object} Queue status
     */
    getUpdateQueueStatus() {
        return {
            queueLength: this.updateQueue.length,
            isProcessing: this.isProcessingUpdates,
            pendingUpdates: this.updateQueue.filter(task => task.status === 'pending').length,
            processingUpdates: this.updateQueue.filter(task => task.status === 'processing').length
        };
    }
    
    /**
     * Clear the update queue (emergency stop)
     * @returns {number} Number of updates cleared
     */
    clearUpdateQueue() {
        const clearedCount = this.updateQueue.length;
        this.updateQueue = [];
        this.isProcessingUpdates = false;
        
        this.debug.warn(`Cleared ${clearedCount} updates from queue`);
        return clearedCount;
    }
    
    /**
     * Add event listener for configuration updates
     * @param {string} eventType - Type of event ('update', 'rollback', 'error')
     * @param {Function} callback - Callback function
     * @returns {Function} Remove listener function
     */
    addEventListener(eventType, callback) {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, new Set());
        }
        
        this.eventListeners.get(eventType).add(callback);
        
        return () => {
            const listeners = this.eventListeners.get(eventType);
            if (listeners) {
                listeners.delete(callback);
            }
        };
    }
    
    /**
     * Emit event to listeners
     * @param {string} eventType - Type of event
     * @param {Object} eventData - Event data
     */
    emitEvent(eventType, eventData) {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(eventData);
                } catch (error) {
                    this.debug.error(`Error in event listener for ${eventType}:`, error);
                }
            });
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigUpdateManager;
} else if (typeof window !== 'undefined') {
    window.ConfigUpdateManager = ConfigUpdateManager;
}