/**
 * Voice Configuration Manager - Manages voice settings for different agents
 * Handles voice configuration, validation, and TTS integration
 */

class VoiceConfigManager {
    constructor() {
        this.voiceConfigs = new Map();
        this.ttsProviders = ['openai', 'elevenlabs', 'azure'];
        this.debug = window.debugManager?.createModuleLogger('VoiceConfigManager') || console;
        this.storageKey = 'voice_config';
        
        // Available voice options by provider
        this.availableVoices = {
            openai: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
            elevenlabs: ['rachel', 'domi', 'bella', 'antoni', 'elli', 'josh', 'arnold', 'adam', 'sam'],
            azure: ['en-US-JennyNeural', 'en-US-GuyNeural', 'en-GB-SoniaNeural', 'en-GB-RyanNeural']
        };
        
        this.initialize();
    }
    
    /**
     * Initialize the Voice Configuration Manager
     */
    initialize() {
        this.debug.log('Initializing Voice Configuration Manager');
        
        // Load existing voice configurations from storage
        this.loadVoiceConfigs();
        
        // Set up default voice configurations if none exist
        if (this.voiceConfigs.size === 0) {
            this.initializeDefaultVoiceConfigs();
        }
        
        this.debug.log('Voice Configuration Manager initialized with', this.voiceConfigs.size, 'agent configurations');
    }
    
    /**
     * Set voice configuration for a specific agent
     * @param {string} agentName - Name of the agent
     * @param {Object} config - Voice configuration
     * @returns {boolean} Success status
     */
    setVoiceConfig(agentName, config) {
        try {
            const validationResult = this.validateVoiceConfig(config);
            if (!validationResult.valid) {
                this.debug.error('Invalid voice config for', agentName, ':', validationResult.errors);
                return false;
            }
            
            const voiceConfig = {
                agentName,
                ...config,
                lastUpdated: new Date().toISOString()
            };
            
            this.voiceConfigs.set(agentName, voiceConfig);
            this.saveVoiceConfigs();
            
            this.debug.log('Set voice configuration for agent:', agentName);
            return true;
            
        } catch (error) {
            this.debug.error('Error setting voice config for', agentName, ':', error);
            return false;
        }
    }
    
    /**
     * Set voice configuration with real-time update support
     * @param {string} agentName - Name of the agent
     * @param {Object} config - Voice configuration
     * @param {Object} options - Update options
     * @returns {Promise<boolean>} Success status
     */
    async setVoiceConfigRealTime(agentName, config, options = {}) {
        try {
            // Check if agent is currently in a conversation
            const isInConversation = await this.checkConversationStatus(agentName);
            
            if (isInConversation && !options.allowDuringConversation) {
                // Queue the update for after the conversation ends
                return await this.queueVoiceConfigUpdate(agentName, config, options);
            }
            
            // Store previous configuration for potential rollback
            const previousConfig = this.voiceConfigs.get(agentName);
            
            // Apply the new voice configuration
            const success = this.setVoiceConfig(agentName, config);
            
            if (success) {
                // Notify TTS system about the voice configuration change
                await this.notifyTTSSystemOfChange(agentName, config, previousConfig);
                
                this.debug.log('Real-time voice config update completed for agent:', agentName);
            }
            
            return success;
            
        } catch (error) {
            this.debug.error('Error setting voice config in real-time for', agentName, ':', error);
            return false;
        }
    }
    
    /**
     * Get voice configuration for a specific agent
     * @param {string} agentName - Name of the agent
     * @returns {Object|null} Voice configuration or null if not found
     */
    getVoiceConfig(agentName) {
        return this.voiceConfigs.get(agentName) || null;
    }
    
    /**
     * Get all voice configurations
     * @returns {Object} All voice configurations
     */
    getAllVoiceConfigs() {
        return Object.fromEntries(this.voiceConfigs);
    }
    
    /**
     * Generate voice preview for configuration testing
     * @param {Object} config - Voice configuration to preview
     * @param {string} sampleText - Text to use for preview
     * @returns {Promise<Object>} Preview result with audio data or error
     */
    async previewVoice(config, sampleText = "Hello, this is a voice preview for the banking assistant.") {
        try {
            const validationResult = this.validateVoiceConfig(config);
            if (!validationResult.valid) {
                return {
                    success: false,
                    error: 'Invalid voice configuration',
                    details: validationResult.errors
                };
            }
            
            // Create TTS request with the configuration
            const ttsRequest = this.buildTTSRequest(config, sampleText);
            
            // For now, return a mock preview (in real implementation, this would call the TTS service)
            return {
                success: true,
                audioUrl: null, // Would contain actual audio URL
                config: config,
                sampleText: sampleText,
                estimatedDuration: this.estimateDuration(sampleText, config.ttsSettings?.speed || 1.0),
                preview: true
            };
            
        } catch (error) {
            this.debug.error('Error generating voice preview:', error);
            return {
                success: false,
                error: 'Failed to generate voice preview',
                details: error.message
            };
        }
    }
    
    /**
     * Apply voice configuration to TTS request
     * @param {string} agentName - Name of the agent
     * @param {string} text - Text to convert to speech
     * @returns {Object} TTS request configuration
     */
    applyVoiceConfig(agentName, text) {
        const config = this.voiceConfigs.get(agentName);
        
        if (!config) {
            // Return default configuration if no specific config found
            return this.getDefaultTTSConfig(text);
        }
        
        return this.buildTTSRequest(config, text);
    }
    
    /**
     * Validate voice configuration
     * @param {Object} config - Voice configuration to validate
     * @returns {Object} Validation result with valid flag and errors array
     */
    validateVoiceConfig(config) {
        const errors = [];
        
        if (!config || typeof config !== 'object') {
            errors.push('Voice configuration must be an object');
            return { valid: false, errors };
        }
        
        // Validate TTS settings
        if (config.ttsSettings) {
            const tts = config.ttsSettings;
            
            // Validate provider
            if (tts.provider && !this.ttsProviders.includes(tts.provider)) {
                errors.push(`Invalid TTS provider: ${tts.provider}. Must be one of: ${this.ttsProviders.join(', ')}`);
            }
            
            // Validate voice for provider
            if (tts.provider && tts.voice) {
                const availableForProvider = this.availableVoices[tts.provider];
                if (availableForProvider && !availableForProvider.includes(tts.voice)) {
                    errors.push(`Invalid voice '${tts.voice}' for provider '${tts.provider}'. Available: ${availableForProvider.join(', ')}`);
                }
            }
            
            // Validate speed
            if (tts.speed !== undefined) {
                if (typeof tts.speed !== 'number' || tts.speed < 0.25 || tts.speed > 4.0) {
                    errors.push('Speed must be a number between 0.25 and 4.0');
                }
            }
            
            // Validate pitch
            if (tts.pitch !== undefined) {
                if (typeof tts.pitch !== 'number' || tts.pitch < -20 || tts.pitch > 20) {
                    errors.push('Pitch must be a number between -20 and 20 semitones');
                }
            }
            
            // Validate volume
            if (tts.volume !== undefined) {
                if (typeof tts.volume !== 'number' || tts.volume < 0 || tts.volume > 1) {
                    errors.push('Volume must be a number between 0 and 1');
                }
            }
            
            // Validate stability (ElevenLabs specific)
            if (tts.stability !== undefined) {
                if (typeof tts.stability !== 'number' || tts.stability < 0 || tts.stability > 1) {
                    errors.push('Stability must be a number between 0 and 1');
                }
            }
            
            // Validate clarity (ElevenLabs specific)
            if (tts.clarity !== undefined) {
                if (typeof tts.clarity !== 'number' || tts.clarity < 0 || tts.clarity > 1) {
                    errors.push('Clarity must be a number between 0 and 1');
                }
            }
        }
        
        // Validate personality traits
        if (config.personalityTraits) {
            const traits = config.personalityTraits;
            
            if (traits.tone && typeof traits.tone !== 'string') {
                errors.push('Personality tone must be a string');
            }
            
            if (traits.formality && !['casual', 'professional', 'formal'].includes(traits.formality)) {
                errors.push('Formality must be one of: casual, professional, formal');
            }
            
            if (traits.enthusiasm !== undefined) {
                if (typeof traits.enthusiasm !== 'number' || traits.enthusiasm < 1 || traits.enthusiasm > 10) {
                    errors.push('Enthusiasm must be a number between 1 and 10');
                }
            }
            
            if (traits.empathy !== undefined) {
                if (typeof traits.empathy !== 'number' || traits.empathy < 1 || traits.empathy > 10) {
                    errors.push('Empathy must be a number between 1 and 10');
                }
            }
        }
        
        // Validate contextual adaptation
        if (config.contextualAdaptation) {
            const adaptation = config.contextualAdaptation;
            
            const validTones = ['neutral', 'apologetic', 'confident', 'urgent', 'calm', 'friendly'];
            
            if (adaptation.errorResponseTone && !validTones.includes(adaptation.errorResponseTone)) {
                errors.push(`Invalid error response tone. Must be one of: ${validTones.join(', ')}`);
            }
            
            if (adaptation.successResponseTone && !validTones.includes(adaptation.successResponseTone)) {
                errors.push(`Invalid success response tone. Must be one of: ${validTones.join(', ')}`);
            }
            
            if (adaptation.urgentSituationTone && !validTones.includes(adaptation.urgentSituationTone)) {
                errors.push(`Invalid urgent situation tone. Must be one of: ${validTones.join(', ')}`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Export all voice configurations
     * @returns {Object} Exported voice configurations data
     */
    exportVoiceConfigs() {
        return {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            voiceConfigs: Object.fromEntries(this.voiceConfigs)
        };
    }
    
    /**
     * Import voice configurations
     * @param {Object} voiceConfigsData - Voice configurations data to import
     * @returns {boolean} Success status
     */
    importVoiceConfigs(voiceConfigsData) {
        try {
            if (!voiceConfigsData.voiceConfigs) {
                throw new Error('Invalid voice configurations data structure');
            }
            
            this.voiceConfigs.clear();
            
            for (const [agentName, config] of Object.entries(voiceConfigsData.voiceConfigs)) {
                const validationResult = this.validateVoiceConfig(config);
                if (validationResult.valid) {
                    this.voiceConfigs.set(agentName, config);
                } else {
                    this.debug.warn(`Skipping invalid voice config for ${agentName}:`, validationResult.errors);
                }
            }
            
            this.saveVoiceConfigs();
            this.debug.log('Successfully imported voice configurations');
            return true;
            
        } catch (error) {
            this.debug.error('Error importing voice configurations:', error);
            return false;
        }
    }
    
    /**
     * Reset all voice configurations to defaults
     */
    resetToDefaults() {
        this.voiceConfigs.clear();
        this.initializeDefaultVoiceConfigs();
        this.saveVoiceConfigs();
        this.debug.log('Reset voice configurations to defaults');
    }
    
    /**
     * Get available voices for a specific provider
     * @param {string} provider - TTS provider name
     * @returns {Array} Array of available voice names
     */
    getAvailableVoices(provider) {
        return this.availableVoices[provider] || [];
    }
    
    /**
     * Get all available TTS providers
     * @returns {Array} Array of provider names
     */
    getAvailableProviders() {
        return [...this.ttsProviders];
    }
    
    /**
     * Build TTS request configuration
     * @param {Object} config - Voice configuration
     * @param {string} text - Text to convert
     * @returns {Object} TTS request configuration
     */
    buildTTSRequest(config, text) {
        const ttsSettings = config.ttsSettings || {};
        const personalityTraits = config.personalityTraits || {};
        const contextualAdaptation = config.contextualAdaptation || {};
        
        // Determine context-appropriate tone
        const contextTone = this.determineContextualTone(text, contextualAdaptation);
        
        return {
            provider: ttsSettings.provider || 'openai',
            voice: ttsSettings.voice || 'alloy',
            speed: ttsSettings.speed || 1.0,
            pitch: ttsSettings.pitch || 0,
            volume: ttsSettings.volume || 0.8,
            stability: ttsSettings.stability || 0.5, // ElevenLabs
            clarity: ttsSettings.clarity || 0.7, // ElevenLabs
            text: text,
            personalityTraits: {
                tone: contextTone || personalityTraits.tone || 'professional',
                formality: personalityTraits.formality || 'professional',
                enthusiasm: personalityTraits.enthusiasm || 5,
                empathy: personalityTraits.empathy || 6
            }
        };
    }
    
    /**
     * Determine contextual tone based on text content
     * @param {string} text - Text to analyze
     * @param {Object} contextualAdaptation - Contextual adaptation settings
     * @returns {string|null} Appropriate tone or null for default
     */
    determineContextualTone(text, contextualAdaptation) {
        const textLower = text.toLowerCase();
        
        // Check for error indicators
        if (textLower.includes('error') || textLower.includes('sorry') || textLower.includes('unable')) {
            return contextualAdaptation.errorResponseTone || 'apologetic';
        }
        
        // Check for success indicators
        if (textLower.includes('success') || textLower.includes('completed') || textLower.includes('done')) {
            return contextualAdaptation.successResponseTone || 'confident';
        }
        
        // Check for urgent indicators
        if (textLower.includes('urgent') || textLower.includes('immediate') || textLower.includes('fraud')) {
            return contextualAdaptation.urgentSituationTone || 'urgent';
        }
        
        return null; // Use default tone
    }
    
    /**
     * Estimate speech duration based on text and speed
     * @param {string} text - Text to analyze
     * @param {number} speed - Speech speed multiplier
     * @returns {number} Estimated duration in seconds
     */
    estimateDuration(text, speed = 1.0) {
        // Average speaking rate is about 150 words per minute
        const wordsPerMinute = 150 * speed;
        const wordCount = text.split(/\s+/).length;
        return Math.ceil((wordCount / wordsPerMinute) * 60);
    }
    
    /**
     * Get default TTS configuration
     * @param {string} text - Text for context
     * @returns {Object} Default TTS configuration
     */
    getDefaultTTSConfig(text) {
        return {
            provider: 'openai',
            voice: 'alloy',
            speed: 1.0,
            pitch: 0,
            volume: 0.8,
            text: text,
            personalityTraits: {
                tone: 'professional',
                formality: 'professional',
                enthusiasm: 5,
                empathy: 6
            }
        };
    }
    
    /**
     * Initialize default voice configurations for known agents
     */
    initializeDefaultVoiceConfigs() {
        const defaultVoiceConfigs = {
            IDVAgent: {
                agentName: 'IDVAgent',
                ttsSettings: {
                    provider: 'openai',
                    voice: 'nova',
                    speed: 0.9,
                    pitch: 0,
                    volume: 0.8
                },
                personalityTraits: {
                    tone: 'professional',
                    formality: 'formal',
                    enthusiasm: 4,
                    empathy: 7
                },
                contextualAdaptation: {
                    errorResponseTone: 'apologetic',
                    successResponseTone: 'confident',
                    urgentSituationTone: 'calm'
                }
            },
            BankingInfoAgent: {
                agentName: 'BankingInfoAgent',
                ttsSettings: {
                    provider: 'openai',
                    voice: 'alloy',
                    speed: 1.0,
                    pitch: 0,
                    volume: 0.8
                },
                personalityTraits: {
                    tone: 'friendly',
                    formality: 'professional',
                    enthusiasm: 6,
                    empathy: 5
                },
                contextualAdaptation: {
                    errorResponseTone: 'apologetic',
                    successResponseTone: 'friendly',
                    urgentSituationTone: 'calm'
                }
            },
            FraudAgent: {
                agentName: 'FraudAgent',
                ttsSettings: {
                    provider: 'openai',
                    voice: 'onyx',
                    speed: 0.8,
                    pitch: -2,
                    volume: 0.9
                },
                personalityTraits: {
                    tone: 'authoritative',
                    formality: 'formal',
                    enthusiasm: 3,
                    empathy: 8
                },
                contextualAdaptation: {
                    errorResponseTone: 'calm',
                    successResponseTone: 'confident',
                    urgentSituationTone: 'urgent'
                }
            },
            PaymentsAgent: {
                agentName: 'PaymentsAgent',
                ttsSettings: {
                    provider: 'openai',
                    voice: 'echo',
                    speed: 0.9,
                    pitch: 1,
                    volume: 0.8
                },
                personalityTraits: {
                    tone: 'confident',
                    formality: 'professional',
                    enthusiasm: 5,
                    empathy: 6
                },
                contextualAdaptation: {
                    errorResponseTone: 'apologetic',
                    successResponseTone: 'confident',
                    urgentSituationTone: 'calm'
                }
            }
        };
        
        for (const [agentName, config] of Object.entries(defaultVoiceConfigs)) {
            config.createdAt = new Date().toISOString();
            config.lastUpdated = new Date().toISOString();
            this.voiceConfigs.set(agentName, config);
        }
        
        this.debug.log('Initialized default voice configurations for', Object.keys(defaultVoiceConfigs).length, 'agents');
    }
    
    /**
     * Load voice configurations from storage
     */
    loadVoiceConfigs() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                if (data.voiceConfigs) {
                    this.voiceConfigs = new Map(Object.entries(data.voiceConfigs));
                    this.debug.log('Loaded voice configurations from storage');
                }
            }
        } catch (error) {
            this.debug.error('Error loading voice configurations from storage:', error);
        }
    }
    
    /**
     * Save voice configurations to storage
     */
    saveVoiceConfigs() {
        try {
            const data = {
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                voiceConfigs: Object.fromEntries(this.voiceConfigs)
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            this.debug.log('Saved voice configurations to storage');
        } catch (error) {
            this.debug.error('Error saving voice configurations to storage:', error);
        }
    }
    
    /**
     * Handle real-time voice configuration update
     * @param {Object} updateData - Update data from ConfigUpdateManager
     * @returns {Promise<Object>} Update result
     */
    async handleRealTimeUpdate(updateData) {
        try {
            const { agentName, configUpdate, options } = updateData;
            
            this.debug.log(`Handling real-time voice config update for ${agentName}`);
            
            // Apply the voice configuration update
            const success = await this.setVoiceConfigRealTime(agentName, configUpdate.data, options);
            
            return {
                success,
                agentName,
                updateType: 'voiceConfig',
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            this.debug.error('Error handling real-time voice config update:', error);
            return {
                success: false,
                error: 'Failed to handle real-time voice config update',
                details: error.message
            };
        }
    }
    
    /**
     * Check if agent is currently in a conversation
     * @param {string} agentName - Name of the agent
     * @returns {Promise<boolean>} True if agent is in conversation
     */
    async checkConversationStatus(agentName) {
        try {
            // This would integrate with the conversation/session manager
            // Check if there's an active TTS operation for this agent
            if (window.speechToSpeechApp && window.speechToSpeechApp.isGeneratingSpeech) {
                return true;
            }
            
            // Check if there's an active conversation session
            if (window.conversationManager && typeof window.conversationManager.isAgentActive === 'function') {
                return window.conversationManager.isAgentActive(agentName);
            }
            
            return false;
        } catch (error) {
            this.debug.warn('Could not check conversation status:', error);
            return false; // Safe default - allow updates
        }
    }
    
    /**
     * Queue voice configuration update for later application
     * @param {string} agentName - Name of the agent
     * @param {Object} config - Voice configuration
     * @param {Object} options - Update options
     * @returns {Promise<boolean>} Success status
     */
    async queueVoiceConfigUpdate(agentName, config, options = {}) {
        try {
            if (!this.queuedUpdates) {
                this.queuedUpdates = new Map();
            }
            
            const queuedUpdate = {
                agentName,
                config,
                options,
                timestamp: new Date().toISOString(),
                id: this.generateUpdateId()
            };
            
            this.queuedUpdates.set(agentName, queuedUpdate);
            
            this.debug.log(`Queued voice config update for ${agentName} (agent in conversation)`);
            
            // Set up listener for conversation end
            this.setupConversationEndListener(agentName);
            
            return true;
            
        } catch (error) {
            this.debug.error('Error queuing voice config update:', error);
            return false;
        }
    }
    
    /**
     * Set up listener for conversation end to apply queued updates
     * @param {string} agentName - Name of the agent
     */
    setupConversationEndListener(agentName) {
        // This would integrate with the conversation system
        // For now, set up a periodic check
        const checkInterval = setInterval(async () => {
            const isInConversation = await this.checkConversationStatus(agentName);
            
            if (!isInConversation && this.queuedUpdates && this.queuedUpdates.has(agentName)) {
                const queuedUpdate = this.queuedUpdates.get(agentName);
                
                this.debug.log(`Applying queued voice config update for ${agentName}`);
                
                const success = await this.setVoiceConfigRealTime(agentName, queuedUpdate.config, {
                    ...queuedUpdate.options,
                    fromQueue: true
                });
                
                if (success) {
                    this.queuedUpdates.delete(agentName);
                    clearInterval(checkInterval);
                    
                    this.debug.log(`Successfully applied queued voice config update for ${agentName}`);
                }
            }
        }, 5000); // Check every 5 seconds
        
        // Clean up after 5 minutes to prevent memory leaks
        setTimeout(() => {
            clearInterval(checkInterval);
            if (this.queuedUpdates && this.queuedUpdates.has(agentName)) {
                this.debug.warn(`Cleaning up queued voice config update for ${agentName} after timeout`);
                this.queuedUpdates.delete(agentName);
            }
        }, 300000); // 5 minutes
    }
    
    /**
     * Notify TTS system about voice configuration changes
     * @param {string} agentName - Name of the agent
     * @param {Object} newConfig - New voice configuration
     * @param {Object} previousConfig - Previous voice configuration
     * @returns {Promise<void>}
     */
    async notifyTTSSystemOfChange(agentName, newConfig, previousConfig) {
        try {
            // Emit custom event for TTS system
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                const event = new CustomEvent('voiceConfigUpdate', {
                    detail: {
                        agentName,
                        newConfig,
                        previousConfig,
                        timestamp: new Date().toISOString()
                    }
                });
                window.dispatchEvent(event);
            }
            
            // Direct notification to TTS system if available
            if (window.speechToSpeechApp && typeof window.speechToSpeechApp.updateVoiceConfig === 'function') {
                await window.speechToSpeechApp.updateVoiceConfig(agentName, newConfig);
                this.debug.log(`Notified TTS system of voice config change for ${agentName}`);
            }
            
        } catch (error) {
            this.debug.error('Error notifying TTS system of voice config change:', error);
        }
    }
    
    /**
     * Apply voice configuration updates without interrupting conversations
     * @param {string} agentName - Name of the agent (or 'all' for all agents)
     * @param {Object} newVoiceConfig - New voice configuration
     * @param {Object} options - Update options
     * @returns {Promise<Object>} Update result
     */
    async updateVoiceConfigGracefully(agentName, newVoiceConfig, options = {}) {
        try {
            this.debug.log(`Gracefully updating voice config for ${agentName}`);
            
            const updateOptions = {
                ...options,
                allowDuringConversation: options.allowDuringConversation || false,
                queueIfBusy: options.queueIfBusy !== false // Default to true
            };
            
            if (agentName === 'all') {
                // Update all agent voice configurations
                const results = [];
                for (const [name, _] of this.voiceConfigs) {
                    const result = await this.setVoiceConfigRealTime(name, newVoiceConfig, updateOptions);
                    results.push({ agentName: name, success: result });
                }
                
                return {
                    success: true,
                    message: 'Gracefully updated voice config for all agents',
                    results
                };
            } else {
                // Update specific agent voice configuration
                const success = await this.setVoiceConfigRealTime(agentName, newVoiceConfig, updateOptions);
                
                return {
                    success,
                    message: success ? 
                        `Gracefully updated voice config for ${agentName}` : 
                        `Failed to update voice config for ${agentName}`,
                    agentName
                };
            }
            
        } catch (error) {
            this.debug.error('Error gracefully updating voice config:', error);
            return {
                success: false,
                error: 'Failed to gracefully update voice config',
                details: error.message
            };
        }
    }
    
    /**
     * Get queued voice configuration updates
     * @param {string} agentName - Name of the agent (optional)
     * @returns {Array|Object} Queued updates
     */
    getQueuedUpdates(agentName = null) {
        if (!this.queuedUpdates) {
            return agentName ? null : [];
        }
        
        if (agentName) {
            return this.queuedUpdates.get(agentName) || null;
        }
        
        return Array.from(this.queuedUpdates.values());
    }
    
    /**
     * Clear queued voice configuration updates
     * @param {string} agentName - Name of the agent (optional, clears all if not specified)
     */
    clearQueuedUpdates(agentName = null) {
        if (!this.queuedUpdates) {
            return;
        }
        
        if (agentName) {
            this.queuedUpdates.delete(agentName);
            this.debug.log(`Cleared queued voice config update for ${agentName}`);
        } else {
            this.queuedUpdates.clear();
            this.debug.log('Cleared all queued voice config updates');
        }
    }
    
    /**
     * Generate unique update ID
     * @returns {string} Unique update ID
     */
    generateUpdateId() {
        return `voice_update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceConfigManager;
} else if (typeof window !== 'undefined') {
    window.VoiceConfigManager = VoiceConfigManager;
}