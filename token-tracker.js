/**
 * Token Validation Rules
 * Defines business logic validation for token tracking
 */
class TokenValidationRules {
    constructor() {
        // Maximum reasonable values to prevent abuse/errors
        this.limits = {
            whisper: {
                maxMinutes: 60, // 1 hour max per request
                minMinutes: 0.001 // 0.001 minutes minimum
            },
            gpt: {
                maxTokens: 100000, // 100K tokens max per request
                minTokens: 0 // 0 tokens minimum
            },
            tts: {
                maxCharacters: 50000, // 50K characters max per request
                minCharacters: 0 // 0 characters minimum
            }
        };
        
        // Maximum reasonable costs to prevent runaway billing
        this.costLimits = {
            maxSingleRequestCost: 100.00, // $100 max per single request
            maxDailyCost: 1000.00 // $1000 max per day
        };
    }
    
    validateWhisperInput(minutes) {
        if (typeof minutes !== 'number' || isNaN(minutes)) {
            throw new Error('Whisper minutes must be a valid number');
        }
        if (minutes < this.limits.whisper.minMinutes) {
            throw new Error(`Whisper minutes must be at least ${this.limits.whisper.minMinutes}`);
        }
        if (minutes > this.limits.whisper.maxMinutes) {
            throw new Error(`Whisper minutes cannot exceed ${this.limits.whisper.maxMinutes}`);
        }
        return true;
    }
    
    validateGptInput(inputTokens, outputTokens) {
        if (typeof inputTokens !== 'number' || isNaN(inputTokens) || inputTokens < 0) {
            throw new Error('Input tokens must be a non-negative number');
        }
        if (typeof outputTokens !== 'number' || isNaN(outputTokens) || outputTokens < 0) {
            throw new Error('Output tokens must be a non-negative number');
        }
        if (inputTokens > this.limits.gpt.maxTokens) {
            throw new Error(`Input tokens cannot exceed ${this.limits.gpt.maxTokens}`);
        }
        if (outputTokens > this.limits.gpt.maxTokens) {
            throw new Error(`Output tokens cannot exceed ${this.limits.gpt.maxTokens}`);
        }
        return true;
    }
    
    validateTtsInput(characters, model) {
        if (typeof characters !== 'number' || isNaN(characters) || characters < 0) {
            throw new Error('TTS characters must be a non-negative number');
        }
        if (characters > this.limits.tts.maxCharacters) {
            throw new Error(`TTS characters cannot exceed ${this.limits.tts.maxCharacters}`);
        }
        if (model && !['tts-1', 'tts-1-hd'].includes(model)) {
            throw new Error('TTS model must be either "tts-1" or "tts-1-hd"');
        }
        return true;
    }
    
    validateCost(cost) {
        if (typeof cost !== 'number' || isNaN(cost) || cost < 0) {
            throw new Error('Cost must be a non-negative number');
        }
        if (cost > this.costLimits.maxSingleRequestCost) {
            throw new Error(`Single request cost cannot exceed $${this.costLimits.maxSingleRequestCost}`);
        }
        return true;
    }
}

/**
 * Token Usage Tracker
 * Tracks and calculates costs for OpenAI API usage with enhanced validation and reliability
 */
class TokenTracker {
    constructor() {
        this.validationRules = new TokenValidationRules();
        
        // In-memory backup storage using Map data structure
        this.backupStorage = new Map();
        
        // Load usage with backup fallback
        this.usage = this.loadUsage();
        
        // Pricing per unit
        this.pricing = {
            whisper: 0.006, // per minute
            gpt35turbo: { input: 0.0005, output: 0.0015 }, // per 1K tokens
            tts1: 0.015, // per 1K characters
            tts1hd: 0.030 // per 1K characters
        };
    }
    
    /**
     * Validates token input parameters before processing
     * @param {string} type - Type of token usage (whisper, gpt, tts)
     * @param {*} params - Parameters to validate
     */
    validateTokenInput(type, ...params) {
        try {
            switch (type) {
                case 'whisper':
                    return this.validationRules.validateWhisperInput(params[0]);
                case 'gpt':
                    return this.validationRules.validateGptInput(params[0], params[1]);
                case 'tts':
                    return this.validationRules.validateTtsInput(params[0], params[1]);
                default:
                    throw new Error(`Unknown token type: ${type}`);
            }
        } catch (error) {
            console.error(`TokenTracker: Validation failed for ${type}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Validates usage data structure and integrity
     * @param {Object} usage - Usage data to validate
     * @returns {boolean} True if data is valid
     */
    validateUsageData(usage) {
        try {
            // Check if usage is an object
            if (!usage || typeof usage !== 'object') {
                throw new Error('Usage data must be an object');
            }
            
            // Check required properties exist
            const requiredProps = ['whisper', 'gpt', 'tts', 'total'];
            for (const prop of requiredProps) {
                if (!(prop in usage)) {
                    throw new Error(`Missing required property: ${prop}`);
                }
            }
            
            // Validate whisper data
            if (!usage.whisper || typeof usage.whisper !== 'object') {
                throw new Error('Invalid whisper usage data');
            }
            if (typeof usage.whisper.requests !== 'number' || usage.whisper.requests < 0) {
                throw new Error('Invalid whisper requests count');
            }
            if (typeof usage.whisper.cost !== 'number' || usage.whisper.cost < 0) {
                throw new Error('Invalid whisper cost');
            }
            
            // Validate GPT data
            if (!usage.gpt || typeof usage.gpt !== 'object') {
                throw new Error('Invalid GPT usage data');
            }
            if (typeof usage.gpt.tokens !== 'number' || usage.gpt.tokens < 0) {
                throw new Error('Invalid GPT tokens count');
            }
            if (typeof usage.gpt.cost !== 'number' || usage.gpt.cost < 0) {
                throw new Error('Invalid GPT cost');
            }
            
            // Validate TTS data
            if (!usage.tts || typeof usage.tts !== 'object') {
                throw new Error('Invalid TTS usage data');
            }
            if (typeof usage.tts.characters !== 'number' || usage.tts.characters < 0) {
                throw new Error('Invalid TTS characters count');
            }
            if (typeof usage.tts.cost !== 'number' || usage.tts.cost < 0) {
                throw new Error('Invalid TTS cost');
            }
            
            // Validate total
            if (typeof usage.total !== 'number' || usage.total < 0) {
                throw new Error('Invalid total cost');
            }
            
            // Validate checksum if present
            if (usage.checksum) {
                const calculatedChecksum = this.calculateChecksum(usage);
                if (usage.checksum !== calculatedChecksum) {
                    throw new Error('Data integrity check failed - checksum mismatch');
                }
            }
            
            // Validate cost consistency
            const expectedTotal = usage.whisper.cost + usage.gpt.cost + usage.tts.cost;
            const tolerance = 0.0001; // Allow small floating point differences
            if (Math.abs(usage.total - expectedTotal) > tolerance) {
                throw new Error(`Total cost inconsistency: expected ${expectedTotal.toFixed(4)}, got ${usage.total.toFixed(4)}`);
            }
            
            return true;
        } catch (error) {
            console.error('TokenTracker: Usage data validation failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Calculates checksum for usage data integrity verification
     * @param {Object} usage - Usage data (without checksum property)
     * @returns {string} Calculated checksum
     */
    calculateChecksum(usage) {
        // Create a copy without checksum for calculation
        const dataForChecksum = {
            whisper: { ...usage.whisper },
            gpt: { ...usage.gpt },
            tts: { ...usage.tts },
            total: usage.total
        };
        
        // Simple checksum based on JSON string
        const dataString = JSON.stringify(dataForChecksum);
        let hash = 0;
        for (let i = 0; i < dataString.length; i++) {
            const char = dataString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
    }
    
    /**
     * Handles tracking errors with logging and graceful degradation
     * @param {Error} error - The error that occurred
     * @param {string} operation - The operation that failed
     * @param {*} context - Additional context about the error
     */
    handleTrackingError(error, operation, context = {}) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            operation: operation,
            error: {
                message: error.message,
                name: error.name,
                stack: error.stack
            },
            context: context,
            currentUsage: this.usage
        };
        
        // Log the error with full context
        console.error('TokenTracker: Tracking error occurred:', errorInfo);
        
        // Attempt to save current state to backup before degrading
        try {
            this.backupStorage.set('token_usage_error_backup', JSON.parse(JSON.stringify(this.usage)));
            console.log('TokenTracker: Current usage state saved to error backup');
        } catch (backupError) {
            console.error('TokenTracker: Failed to save error backup:', backupError.message);
        }
        
        // Graceful degradation - continue operation with current values
        console.warn(`TokenTracker: Continuing operation with current usage values after ${operation} failure`);
        
        // Optionally emit an event for external error handling
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            const event = new CustomEvent('tokenTrackerError', {
                detail: errorInfo
            });
            window.dispatchEvent(event);
        }
    }
    
    /**
     * Creates fallback mechanisms to continue operation with default values
     * @param {string} type - Type of operation that failed
     * @returns {Object} Fallback values
     */
    createFallbackValues(type) {
        const fallbacks = {
            whisper: { requests: 0, cost: 0 },
            gpt: { tokens: 0, cost: 0 },
            tts: { characters: 0, cost: 0 },
            total: 0
        };
        
        console.log(`TokenTracker: Using fallback values for ${type} operation`);
        return fallbacks[type] || fallbacks;
    }

    loadUsage() {
        try {
            const saved = localStorage.getItem('token_usage');
            if (saved) {
                const usage = JSON.parse(saved);
                
                // Validate data integrity
                this.validateUsageData(usage);
                
                // Store in backup immediately after successful load and validation
                this.backupStorage.set('token_usage', usage);
                console.log('TokenTracker: Successfully loaded and validated usage data from localStorage');
                return usage;
            }
        } catch (error) {
            console.warn('TokenTracker: Failed to load or validate from localStorage, trying backup:', error.message);
            return this.loadBackupOrDefaults();
        }
        
        // Return defaults if no saved data
        return this.getDefaultUsage();
    }
    
    /**
     * Loads usage data from backup storage or returns defaults
     * @returns {Object} Usage data object
     */
    loadBackupOrDefaults() {
        try {
            if (this.backupStorage.has('token_usage')) {
                const backupUsage = this.backupStorage.get('token_usage');
                
                // Validate backup data integrity
                this.validateUsageData(backupUsage);
                
                console.log('TokenTracker: Restored and validated usage data from backup storage');
                return backupUsage;
            }
        } catch (error) {
            console.warn('TokenTracker: Failed to load or validate from backup storage:', error.message);
        }
        
        console.log('TokenTracker: Using default usage data due to corruption or missing backup');
        return this.getDefaultUsage();
    }
    
    /**
     * Returns default usage structure
     * @returns {Object} Default usage data
     */
    getDefaultUsage() {
        return {
            whisper: { requests: 0, cost: 0 },
            gpt: { tokens: 0, cost: 0 },
            tts: { characters: 0, cost: 0 },
            total: 0
        };
    }

    saveUsage() {
        this.saveUsageWithBackup();
    }
    
    /**
     * Saves usage data to both localStorage and backup storage with checksum
     */
    saveUsageWithBackup() {
        try {
            // Create a copy with checksum for integrity verification
            const usageWithChecksum = { ...this.usage };
            usageWithChecksum.checksum = this.calculateChecksum(this.usage);
            
            // Save to localStorage first
            localStorage.setItem('token_usage', JSON.stringify(usageWithChecksum));
            
            // Save to backup storage (also with checksum)
            this.backupStorage.set('token_usage', JSON.parse(JSON.stringify(usageWithChecksum)));
            
            console.log('TokenTracker: Usage data saved to both localStorage and backup with integrity checksum');
        } catch (error) {
            console.error('TokenTracker: Failed to save to localStorage, backup still available:', error.message);
            
            // Even if localStorage fails, ensure backup is updated
            try {
                const usageWithChecksum = { ...this.usage };
                usageWithChecksum.checksum = this.calculateChecksum(this.usage);
                this.backupStorage.set('token_usage', JSON.parse(JSON.stringify(usageWithChecksum)));
                console.log('TokenTracker: Usage data saved to backup storage only with integrity checksum');
            } catch (backupError) {
                console.error('TokenTracker: Critical error - failed to save to backup storage:', backupError.message);
                throw new Error('Failed to save usage data to any storage mechanism');
            }
        }
    }

    trackWhisperUsage(minutes = 0.17) {
        try {
            // Validate input
            this.validateTokenInput('whisper', minutes);
            
            console.log('TokenTracker: Tracking Whisper usage -', minutes, 'minutes');
            this.usage.whisper.requests += 1;
            const cost = minutes * this.pricing.whisper;
            
            // Validate calculated cost
            this.validationRules.validateCost(cost);
            
            this.usage.whisper.cost += cost;
            this.usage.total += cost;
            this.saveUsage();
            console.log('TokenTracker: Whisper usage updated -', this.usage.whisper.requests, 'requests, $' + this.usage.whisper.cost.toFixed(4));
        } catch (error) {
            this.handleTrackingError(error, 'trackWhisperUsage', { minutes });
            
            // Graceful degradation - continue with approximate tracking
            try {
                console.warn('TokenTracker: Attempting graceful degradation for Whisper tracking');
                this.usage.whisper.requests += 1;
                const fallbackCost = 0.17 * this.pricing.whisper; // Use default duration
                this.usage.whisper.cost += fallbackCost;
                this.usage.total += fallbackCost;
                console.log('TokenTracker: Whisper usage tracked with fallback values');
            } catch (fallbackError) {
                this.handleTrackingError(fallbackError, 'trackWhisperUsage_fallback', { minutes });
                console.error('TokenTracker: Complete failure in Whisper tracking, continuing without update');
            }
        }
    }

    trackGptUsage(inputTokens, outputTokens) {
        try {
            // Validate input
            this.validateTokenInput('gpt', inputTokens, outputTokens);
            
            console.log('TokenTracker: Tracking GPT usage -', inputTokens, 'input,', outputTokens, 'output tokens');
            this.usage.gpt.tokens += (inputTokens + outputTokens);
            const inputCost = (inputTokens / 1000) * this.pricing.gpt35turbo.input;
            const outputCost = (outputTokens / 1000) * this.pricing.gpt35turbo.output;
            const totalCost = inputCost + outputCost;
            
            // Validate calculated cost
            this.validationRules.validateCost(totalCost);
            
            this.usage.gpt.cost += totalCost;
            this.usage.total += totalCost;
            this.saveUsage();
            console.log('TokenTracker: GPT usage updated -', this.usage.gpt.tokens, 'tokens, $' + this.usage.gpt.cost.toFixed(4));
        } catch (error) {
            this.handleTrackingError(error, 'trackGptUsage', { inputTokens, outputTokens });
            
            // Graceful degradation - continue with approximate tracking
            try {
                console.warn('TokenTracker: Attempting graceful degradation for GPT tracking');
                const safeInputTokens = Math.max(0, Math.min(inputTokens || 0, 10000));
                const safeOutputTokens = Math.max(0, Math.min(outputTokens || 0, 10000));
                
                this.usage.gpt.tokens += (safeInputTokens + safeOutputTokens);
                const fallbackCost = ((safeInputTokens / 1000) * this.pricing.gpt35turbo.input) + 
                                   ((safeOutputTokens / 1000) * this.pricing.gpt35turbo.output);
                this.usage.gpt.cost += fallbackCost;
                this.usage.total += fallbackCost;
                console.log('TokenTracker: GPT usage tracked with fallback values');
            } catch (fallbackError) {
                this.handleTrackingError(fallbackError, 'trackGptUsage_fallback', { inputTokens, outputTokens });
                console.error('TokenTracker: Complete failure in GPT tracking, continuing without update');
            }
        }
    }

    trackTtsUsage(characters, model = 'tts-1') {
        try {
            // Validate input
            this.validateTokenInput('tts', characters, model);
            
            console.log('TokenTracker: Tracking TTS usage -', characters, 'characters, model:', model);
            this.usage.tts.characters += characters;
            const pricePerChar = model === 'tts-1-hd' ?
                this.pricing.tts1hd / 1000 : this.pricing.tts1 / 1000;
            const cost = characters * pricePerChar;
            
            // Validate calculated cost
            this.validationRules.validateCost(cost);
            
            this.usage.tts.cost += cost;
            this.usage.total += cost;
            this.saveUsage();
            console.log('TokenTracker: TTS usage updated -', this.usage.tts.characters, 'characters, $' + this.usage.tts.cost.toFixed(4));
        } catch (error) {
            this.handleTrackingError(error, 'trackTtsUsage', { characters, model });
            
            // Graceful degradation - continue with approximate tracking
            try {
                console.warn('TokenTracker: Attempting graceful degradation for TTS tracking');
                const safeCharacters = Math.max(0, Math.min(characters || 0, 10000));
                const safeModel = ['tts-1', 'tts-1-hd'].includes(model) ? model : 'tts-1';
                
                this.usage.tts.characters += safeCharacters;
                const fallbackPricePerChar = safeModel === 'tts-1-hd' ?
                    this.pricing.tts1hd / 1000 : this.pricing.tts1 / 1000;
                const fallbackCost = safeCharacters * fallbackPricePerChar;
                this.usage.tts.cost += fallbackCost;
                this.usage.total += fallbackCost;
                console.log('TokenTracker: TTS usage tracked with fallback values');
            } catch (fallbackError) {
                this.handleTrackingError(fallbackError, 'trackTtsUsage_fallback', { characters, model });
                console.error('TokenTracker: Complete failure in TTS tracking, continuing without update');
            }
        }
    }

    getUsage() {
        return { ...this.usage };
    }

    resetUsage() {
        this.usage = {
            whisper: { requests: 0, cost: 0 },
            gpt: { tokens: 0, cost: 0 },
            tts: { characters: 0, cost: 0 },
            total: 0
        };
        this.saveUsage();
    }

    updateDisplay() {
        const elements = {
            whisperTokens: document.getElementById('whisperTokens'),
            whisperCost: document.getElementById('whisperCost'),
            gptTokens: document.getElementById('gptTokens'),
            gptCost: document.getElementById('gptCost'),
            ttsTokens: document.getElementById('ttsTokens'),
            ttsCost: document.getElementById('ttsCost'),
            totalCost: document.getElementById('totalCost')
        };

        console.log('TokenTracker: Updating display with usage:', this.usage);
        
        if (elements.whisperTokens) elements.whisperTokens.textContent = `${this.usage.whisper.requests} requests`;
        if (elements.whisperCost) elements.whisperCost.textContent = `$${this.usage.whisper.cost.toFixed(4)}`;
        if (elements.gptTokens) elements.gptTokens.textContent = `${this.usage.gpt.tokens} tokens`;
        if (elements.gptCost) elements.gptCost.textContent = `$${this.usage.gpt.cost.toFixed(4)}`;
        if (elements.ttsTokens) elements.ttsTokens.textContent = `${this.usage.tts.characters} chars`;
        if (elements.ttsCost) elements.ttsCost.textContent = `$${this.usage.tts.cost.toFixed(4)}`;
        if (elements.totalCost) elements.totalCost.textContent = `$${this.usage.total.toFixed(4)}`;
        
        console.log('TokenTracker: Display updated successfully');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TokenTracker;
}

// Export to global scope for browser usage
if (typeof window !== 'undefined') {
    window.TokenTracker = TokenTracker;
}