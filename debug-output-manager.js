/**
 * DebugOutputManager - Manages debug panel output display
 * 
 * This class handles updating the debug panel with real-time information
 * including system prompts, AI responses, and other debug data.
 */
class DebugOutputManager {
    constructor() {
        this.debug = window.debugManager?.createModuleLogger('DebugOutputManager') || console;
        
        // Cache debug elements for performance
        this.debugElements = {};
        this.initializeDebugElements();
        
        this.debug.info('DebugOutputManager initialized');
    }
    
    /**
     * Initialize and cache debug panel elements
     */
    initializeDebugElements() {
        const elementIds = [
            'sttOutput',        // Speech-to-Text output
            'systemPrompt',     // System Prompt to GPT
            'gptResponse',      // GPT Response
            'ttsOutput',        // Text-to-Speech output
            'systemLogs'        // System logs
        ];
        
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.debugElements[id] = element;
                this.debug.info(`Debug element cached: ${id}`);
            } else {
                this.debug.warn(`Debug element not found: ${id}`);
            }
        });
    }
    
    /**
     * Update debug output for a specific section
     * @param {string} section - Section ID (sttOutput, systemPrompt, gptResponse, ttsOutput)
     * @param {string} content - Content to display
     * @param {string} title - Optional title prefix
     */
    updateDebugOutput(section, content, title = null) {
        try {
            const element = this.debugElements[section];
            if (!element) {
                this.debug.warn(`Debug element not found: ${section}`);
                return;
            }
            
            // Format content with timestamp
            const timestamp = new Date().toLocaleTimeString();
            let formattedContent = content;
            
            if (title) {
                formattedContent = `${title}\n${content}`;
            }
            
            // Add timestamp for non-static content
            if (section !== 'systemPrompt' || content !== 'System prompt will appear here...') {
                formattedContent = `[${timestamp}] ${formattedContent}`;
            }
            
            // Update the element
            element.textContent = formattedContent;
            
            // Add visual indicator for updates
            element.classList.add('debug-updated');
            setTimeout(() => {
                element.classList.remove('debug-updated');
            }, 1000);
            
            this.debug.info(`Debug output updated: ${section}`, {
                contentLength: content.length,
                hasTitle: !!title
            });
            
        } catch (error) {
            this.debug.error(`Failed to update debug output for ${section}`, { error: error.message });
        }
    }
    
    /**
     * Update Speech-to-Text debug output
     * @param {string} transcription - Transcribed text
     * @param {Object} metadata - Additional metadata (confidence, language, etc.)
     */
    updateSpeechToText(transcription, metadata = {}) {
        let content = `Transcription: ${transcription}`;
        
        if (metadata.confidence) {
            content += `\nConfidence: ${(metadata.confidence * 100).toFixed(1)}%`;
        }
        
        if (metadata.language) {
            content += `\nLanguage: ${metadata.language}`;
        }
        
        if (metadata.duration) {
            content += `\nDuration: ${metadata.duration}ms`;
        }
        
        this.updateDebugOutput('sttOutput', content);
    }
    
    /**
     * Update System Prompt debug output
     * @param {string} systemPrompt - The complete system prompt sent to GPT
     * @param {Object} metadata - Additional metadata (agent, persona, etc.)
     */
    updateSystemPrompt(systemPrompt, metadata = {}) {
        let content = systemPrompt;
        
        // Add metadata if available
        if (metadata.agentName) {
            content = `Agent: ${metadata.agentName}\n\n${content}`;
        }
        
        if (metadata.personaName) {
            content = `Persona: ${metadata.personaName}\n${content}`;
        }
        
        if (metadata.promptLength) {
            content += `\n\n--- Prompt Stats ---\nLength: ${metadata.promptLength} characters`;
        }
        
        if (metadata.tokensEstimate) {
            content += `\nEstimated Tokens: ${metadata.tokensEstimate}`;
        }
        
        this.updateDebugOutput('systemPrompt', content, 'System Prompt to GPT:');
    }
    
    /**
     * Update GPT Response debug output
     * @param {string} response - GPT response text
     * @param {Object} metadata - Additional metadata (tokens, model, etc.)
     */
    updateGPTResponse(response, metadata = {}) {
        let content = response;
        
        // Add metadata if available
        if (metadata.agentName) {
            content = `Agent: ${metadata.agentName}\nResponse: ${response}`;
        }
        
        if (metadata.model) {
            content += `\n\n--- Response Stats ---\nModel: ${metadata.model}`;
        }
        
        if (metadata.tokensUsed) {
            content += `\nTokens Used: ${metadata.tokensUsed}`;
        }
        
        if (metadata.processingTime) {
            content += `\nProcessing Time: ${metadata.processingTime}ms`;
        }
        
        if (metadata.cost) {
            content += `\nEstimated Cost: $${metadata.cost.toFixed(4)}`;
        }
        
        this.updateDebugOutput('gptResponse', content, 'GPT Response:');
    }
    
    /**
     * Update Text-to-Speech debug output
     * @param {string} text - Text being converted to speech
     * @param {Object} settings - TTS settings used
     * @param {Object} metadata - Additional metadata
     */
    updateTextToSpeech(text, settings = {}, metadata = {}) {
        let content = `Text: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`;
        
        if (settings.voice) {
            content += `\nVoice: ${settings.voice}`;
        }
        
        if (settings.model) {
            content += `\nModel: ${settings.model}`;
        }
        
        if (settings.speed) {
            content += `\nSpeed: ${settings.speed}x`;
        }
        
        if (metadata.duration) {
            content += `\nAudio Duration: ${metadata.duration}s`;
        }
        
        if (metadata.characters) {
            content += `\nCharacters: ${metadata.characters}`;
        }
        
        this.updateDebugOutput('ttsOutput', content, 'Text-to-Speech:');
    }
    
    /**
     * Update system logs
     * @param {string} logEntry - Log entry to add
     * @param {string} level - Log level (info, warn, error)
     */
    updateSystemLogs(logEntry, level = 'info') {
        try {
            const element = this.debugElements['systemLogs'];
            if (!element) {
                return;
            }
            
            const timestamp = new Date().toLocaleTimeString();
            const levelIcon = {
                'info': 'ℹ️',
                'warn': '⚠️',
                'error': '❌',
                'debug': '🐛'
            }[level] || 'ℹ️';
            
            const newEntry = `[${timestamp}] ${levelIcon} ${logEntry}`;
            
            // Append to existing logs
            const currentLogs = element.textContent || '';
            const logLines = currentLogs.split('\n').filter(line => line.trim());
            
            // Keep only last 50 log entries
            logLines.push(newEntry);
            if (logLines.length > 50) {
                logLines.shift();
            }
            
            element.textContent = logLines.join('\n');
            
            // Auto-scroll to bottom
            element.scrollTop = element.scrollHeight;
            
        } catch (error) {
            this.debug.error('Failed to update system logs', { error: error.message });
        }
    }
    
    /**
     * Clear debug output for a specific section
     * @param {string} section - Section to clear
     */
    clearDebugOutput(section) {
        try {
            const element = this.debugElements[section];
            if (element) {
                const defaultMessages = {
                    'sttOutput': 'Waiting for speech input...',
                    'systemPrompt': 'System prompt will appear here...',
                    'gptResponse': 'AI response will appear here...',
                    'ttsOutput': 'TTS information will appear here...',
                    'systemLogs': 'System logs will appear here...'
                };
                
                element.textContent = defaultMessages[section] || '';
                this.debug.info(`Debug output cleared: ${section}`);
            }
        } catch (error) {
            this.debug.error(`Failed to clear debug output for ${section}`, { error: error.message });
        }
    }
    
    /**
     * Clear all debug outputs
     */
    clearAllDebugOutput() {
        Object.keys(this.debugElements).forEach(section => {
            this.clearDebugOutput(section);
        });
        this.debug.info('All debug outputs cleared');
    }
    
    /**
     * Show error in debug output
     * @param {string} section - Section to show error in
     * @param {string} error - Error message
     */
    showError(section, error) {
        const timestamp = new Date().toLocaleTimeString();
        const errorContent = `[${timestamp}] ❌ ERROR: ${error}`;
        
        const element = this.debugElements[section];
        if (element) {
            element.textContent = errorContent;
            element.classList.add('debug-error');
            setTimeout(() => {
                element.classList.remove('debug-error');
            }, 3000);
        }
    }
    
    /**
     * Get current debug output content
     * @param {string} section - Section to get content from
     * @returns {string} Current content
     */
    getDebugOutput(section) {
        const element = this.debugElements[section];
        return element ? element.textContent : '';
    }
    
    /**
     * Export all debug outputs for troubleshooting
     * @returns {Object} All debug outputs
     */
    exportDebugOutputs() {
        const outputs = {};
        Object.keys(this.debugElements).forEach(section => {
            outputs[section] = this.getDebugOutput(section);
        });
        
        outputs.timestamp = new Date().toISOString();
        outputs.userAgent = navigator.userAgent;
        
        this.debug.info('Debug outputs exported', { sections: Object.keys(outputs) });
        return outputs;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebugOutputManager;
} else {
    window.DebugOutputManager = DebugOutputManager;
}