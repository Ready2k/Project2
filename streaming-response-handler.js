/**
 * StreamingResponseHandler - Convert agent responses into streaming-compatible format
 * Handles response processing, chunking, voice configuration, and WebSocket formatting
 */
class StreamingResponseHandler {
    constructor(streamingManager) {
        if (!streamingManager) {
            throw new Error('StreamingManager instance is required');
        }

        this.streamingManager = streamingManager;
        
        // Initialize debug logger
        this.debug = window.debugManager ? 
            window.debugManager.createModuleLogger('StreamingResponseHandler') : 
            { log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

        // Response processing configuration
        this.chunkingConfig = {
            sentence_based: {
                maxChunkSize: 150,
                sentenceDelimiters: ['.', '!', '?', ';'],
                minChunkSize: 20
            },
            word_based: {
                maxChunkSize: 50,
                wordDelimiter: ' ',
                minChunkSize: 10
            },
            character_based: {
                maxChunkSize: 100,
                minChunkSize: 20
            }
        };

        // Voice configuration defaults
        this.defaultVoiceConfig = {
            voice: 'shimmer',
            speed: 1.0,
            pitch: 1.0,
            temperature: 0.9
        };

        // Agent-specific voice mappings
        this.agentVoiceMap = {
            'FraudAgent': { voice: 'alloy', speed: 0.9, pitch: 1.0 },
            'PaymentsAgent': { voice: 'echo', speed: 1.0, pitch: 1.0 },
            'IDVAgent': { voice: 'fable', speed: 0.95, pitch: 1.0 },
            'BankingInfoAgent': { voice: 'shimmer', speed: 1.0, pitch: 1.0 },
            'MultiAgentOrchestrator': { voice: 'nova', speed: 1.0, pitch: 1.0 }
        };

        // Performance tracking
        this.processingMetrics = {
            totalResponses: 0,
            averageProcessingTime: 0,
            chunkingStats: {
                sentence_based: 0,
                word_based: 0,
                character_based: 0
            }
        };

        this.debug.info('StreamingResponseHandler initialized', {
            hasStreamingManager: !!this.streamingManager,
            supportedChunkingStrategies: Object.keys(this.chunkingConfig),
            supportedVoices: Object.keys(this.agentVoiceMap)
        });
    }

    /**
     * Process agent response for streaming delivery
     * @param {Object} agentResponse - Response from agent routing
     * @param {Object} streamingContext - Current streaming context
     * @returns {Promise<Object>} - Processed streaming response
     */
    async processAgentResponse(agentResponse, streamingContext = {}) {
        const startTime = Date.now();
        
        try {
            this.debug.info('Processing agent response for streaming', {
                agentName: agentResponse.agentName,
                responseLength: agentResponse.response?.length || 0,
                hasMetadata: !!agentResponse.metadata,
                sessionId: streamingContext.sessionId
            });

            // Validate input
            if (!agentResponse) {
                throw new Error('Invalid agent response: null or undefined');
            }
            
            if (!agentResponse.response && agentResponse.response !== '') {
                throw new Error('Invalid agent response: missing response text');
            }

            // Extract response components
            const responseText = agentResponse.response || '';
            const agentName = agentResponse.agentName || 'DefaultAgent';
            const metadata = agentResponse.metadata || {};

            // Determine chunking strategy
            const chunkingStrategy = this.determineChunkingStrategy(
                responseText, 
                metadata.chunkingStrategy || 'sentence_based'
            );

            // Chunk response for streaming
            const chunks = this.chunkResponseForStreaming(responseText, chunkingStrategy);

            // Configure voice for agent
            const voiceConfig = this.configureAgentVoice(agentName, streamingContext);

            // Generate session instructions if needed
            const sessionInstructions = await this.generateSessionInstructions(
                agentName, 
                responseText, 
                streamingContext
            );

            // Create processed response
            const processedResponse = {
                success: true,
                agentName: agentName,
                originalResponse: responseText,
                chunks: chunks,
                chunkingStrategy: chunkingStrategy,
                voiceConfig: voiceConfig,
                sessionInstructions: sessionInstructions,
                streamingMetadata: {
                    processingTime: Date.now() - startTime,
                    chunkCount: chunks.length,
                    totalLength: responseText.length,
                    requiresVoiceChange: this.requiresVoiceChange(agentName, streamingContext),
                    requiresSessionUpdate: !!sessionInstructions,
                    timestamp: Date.now()
                },
                originalMetadata: metadata
            };

            // Update processing metrics
            this.updateProcessingMetrics(processedResponse);

            this.debug.info('Agent response processed successfully', {
                agentName: agentName,
                chunkCount: chunks.length,
                processingTime: processedResponse.streamingMetadata.processingTime,
                chunkingStrategy: chunkingStrategy
            });

            return processedResponse;

        } catch (error) {
            const processingTime = Date.now() - startTime;
            
            this.debug.error('Failed to process agent response', {
                error: error.message,
                processingTime: processingTime,
                agentName: agentResponse?.agentName,
                responseLength: agentResponse?.response?.length || 0
            });

            // Return error response
            return {
                success: false,
                error: error.message,
                agentName: agentResponse?.agentName || 'Unknown',
                originalResponse: agentResponse?.response || '',
                chunks: [],
                chunkingStrategy: 'error_fallback',
                voiceConfig: this.defaultVoiceConfig,
                sessionInstructions: this.getDefaultSessionInstructions(),
                streamingMetadata: {
                    processingTime: processingTime,
                    chunkCount: 0,
                    totalLength: 0,
                    requiresVoiceChange: false,
                    requiresSessionUpdate: false,
                    error: error.message,
                    timestamp: Date.now()
                },
                originalMetadata: agentResponse?.metadata || {}
            };
        }
    }

    /**
     * Chunk response for real-time delivery
     * @param {string} response - Response text to chunk
     * @param {string} strategy - Chunking strategy to use
     * @returns {Array<Object>} - Array of response chunks
     */
    chunkResponseForStreaming(response, strategy = 'sentence_based') {
        try {
            this.debug.debug('Chunking response for streaming', {
                responseLength: response.length,
                strategy: strategy
            });

            if (!response || typeof response !== 'string') {
                this.debug.warn('Invalid response for chunking', { response: typeof response });
                return [{
                    text: '',
                    index: 0,
                    isLast: true,
                    metadata: {
                        strategy: 'error_fallback',
                        error: 'Invalid input for chunking'
                    }
                }];
            }

            const config = this.chunkingConfig[strategy] || this.chunkingConfig.sentence_based;
            let chunks = [];

            switch (strategy) {
                case 'sentence_based':
                    chunks = this.chunkBySentences(response, config);
                    break;
                
                case 'word_based':
                    chunks = this.chunkByWords(response, config);
                    break;
                
                case 'character_based':
                    chunks = this.chunkByCharacters(response, config);
                    break;
                
                default:
                    this.debug.warn('Unknown chunking strategy, using sentence_based', { strategy });
                    chunks = this.chunkBySentences(response, this.chunkingConfig.sentence_based);
            }

            // Update chunking statistics
            this.processingMetrics.chunkingStats[strategy] = 
                (this.processingMetrics.chunkingStats[strategy] || 0) + 1;

            this.debug.debug('Response chunked successfully', {
                strategy: strategy,
                chunkCount: chunks.length,
                averageChunkSize: chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / chunks.length
            });

            return chunks;

        } catch (error) {
            this.debug.error('Error chunking response', {
                error: error.message,
                strategy: strategy,
                responseLength: response?.length || 0
            });

            // Return single chunk as fallback
            return [{
                text: response || '',
                index: 0,
                isLast: true,
                metadata: {
                    strategy: 'fallback',
                    error: error.message
                }
            }];
        }
    }

    /**
     * Chunk response by sentences
     * @param {string} response - Response text
     * @param {Object} config - Chunking configuration
     * @returns {Array<Object>} - Sentence-based chunks
     */
    chunkBySentences(response, config) {
        const sentences = this.splitIntoSentences(response, config.sentenceDelimiters);
        const chunks = [];
        let currentChunk = '';
        let chunkIndex = 0;

        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i].trim();
            if (!sentence) continue;

            // Check if adding this sentence would exceed max chunk size
            if (currentChunk && (currentChunk.length + sentence.length + 1) > config.maxChunkSize) {
                // Finalize current chunk if it meets minimum size
                if (currentChunk.length >= config.minChunkSize) {
                    chunks.push({
                        text: currentChunk.trim(),
                        index: chunkIndex++,
                        isLast: false,
                        metadata: {
                            strategy: 'sentence_based',
                            sentenceCount: currentChunk.split(/[.!?;]/).length - 1
                        }
                    });
                    currentChunk = sentence;
                } else {
                    // Current chunk too small, add sentence anyway
                    currentChunk += (currentChunk ? ' ' : '') + sentence;
                }
            } else {
                // Add sentence to current chunk
                currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
        }

        // Add final chunk
        if (currentChunk.trim()) {
            chunks.push({
                text: currentChunk.trim(),
                index: chunkIndex,
                isLast: true,
                metadata: {
                    strategy: 'sentence_based',
                    sentenceCount: currentChunk.split(/[.!?;]/).length - 1
                }
            });
        }

        return chunks;
    }

    /**
     * Chunk response by words
     * @param {string} response - Response text
     * @param {Object} config - Chunking configuration
     * @returns {Array<Object>} - Word-based chunks
     */
    chunkByWords(response, config) {
        const words = response.split(config.wordDelimiter).filter(word => word.trim());
        const chunks = [];
        let currentChunk = '';
        let chunkIndex = 0;

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const testChunk = currentChunk ? `${currentChunk} ${word}` : word;

            if (testChunk.length > config.maxChunkSize && currentChunk.length >= config.minChunkSize) {
                // Finalize current chunk
                chunks.push({
                    text: currentChunk,
                    index: chunkIndex++,
                    isLast: false,
                    metadata: {
                        strategy: 'word_based',
                        wordCount: currentChunk.split(' ').length
                    }
                });
                currentChunk = word;
            } else {
                currentChunk = testChunk;
            }
        }

        // Add final chunk
        if (currentChunk.trim()) {
            chunks.push({
                text: currentChunk,
                index: chunkIndex,
                isLast: true,
                metadata: {
                    strategy: 'word_based',
                    wordCount: currentChunk.split(' ').length
                }
            });
        }

        return chunks;
    }

    /**
     * Chunk response by characters
     * @param {string} response - Response text
     * @param {Object} config - Chunking configuration
     * @returns {Array<Object>} - Character-based chunks
     */
    chunkByCharacters(response, config) {
        const chunks = [];
        let chunkIndex = 0;

        for (let i = 0; i < response.length; i += config.maxChunkSize) {
            const chunk = response.substring(i, i + config.maxChunkSize);
            chunks.push({
                text: chunk,
                index: chunkIndex++,
                isLast: i + config.maxChunkSize >= response.length,
                metadata: {
                    strategy: 'character_based',
                    characterCount: chunk.length
                }
            });
        }

        return chunks;
    }

    /**
     * Split text into sentences using delimiters
     * @param {string} text - Text to split
     * @param {Array<string>} delimiters - Sentence delimiters
     * @returns {Array<string>} - Array of sentences
     */
    splitIntoSentences(text, delimiters) {
        // Create regex pattern from delimiters
        const pattern = new RegExp(`([${delimiters.map(d => '\\' + d).join('')}])`, 'g');
        
        // Split and recombine with delimiters
        const parts = text.split(pattern);
        const sentences = [];
        
        for (let i = 0; i < parts.length; i += 2) {
            const sentence = parts[i] + (parts[i + 1] || '');
            if (sentence.trim()) {
                sentences.push(sentence);
            }
        }
        
        return sentences;
    }

    /**
     * Configure agent-specific voice settings
     * @param {string} agentName - Name of the agent
     * @param {Object} sessionConfig - Current session configuration
     * @returns {Object} - Voice configuration object
     */
    configureAgentVoice(agentName, sessionConfig = {}) {
        try {
            this.debug.debug('Configuring voice for agent', {
                agentName: agentName,
                hasSessionConfig: !!sessionConfig
            });

            // Get agent-specific voice configuration from StreamingManager if available
            let agentVoiceConfig = this.agentVoiceMap[agentName] || {};
            
            // Try to get voice config from StreamingManager if available
            if (this.streamingManager && typeof this.streamingManager.getVoiceConfigForAgent === 'function') {
                try {
                    const streamingManagerConfig = this.streamingManager.getVoiceConfigForAgent(agentName);
                    if (streamingManagerConfig) {
                        agentVoiceConfig = streamingManagerConfig;
                        this.debug.debug('Using voice config from StreamingManager', {
                            agentName: agentName,
                            voice: streamingManagerConfig.voice
                        });
                    }
                } catch (error) {
                    this.debug.warn('Failed to get voice config from StreamingManager', {
                        error: error.message,
                        agentName: agentName
                    });
                }
            }
            
            // Get current voice from session config
            const currentVoice = sessionConfig.voiceConfiguration?.currentVoice || 
                               this.defaultVoiceConfig.voice;

            // Merge configurations with priority: StreamingManager > agent-specific > session > default
            const voiceConfig = {
                ...this.defaultVoiceConfig,
                ...sessionConfig.voiceConfiguration,
                ...agentVoiceConfig,
                previousVoice: currentVoice
            };

            // Determine if voice change is needed
            const voiceChangeRequired = voiceConfig.voice !== currentVoice;

            this.debug.debug('Voice configuration determined', {
                agentName: agentName,
                selectedVoice: voiceConfig.voice,
                voiceChangeRequired: voiceChangeRequired,
                previousVoice: currentVoice,
                configSource: this.streamingManager ? 'streaming_manager' : 'local_map'
            });

            return {
                ...voiceConfig,
                voiceChangeRequired: voiceChangeRequired,
                agentName: agentName,
                configurationSource: this.streamingManager ? 'streaming_manager' : 
                                   (agentVoiceConfig.voice ? 'agent_specific' : 'default')
            };

        } catch (error) {
            this.debug.error('Error configuring agent voice', {
                error: error.message,
                agentName: agentName
            });

            // Return default configuration on error
            return {
                ...this.defaultVoiceConfig,
                voiceChangeRequired: false,
                agentName: agentName,
                configurationSource: 'error_fallback',
                error: error.message
            };
        }
    }

    /**
     * Format response for WebSocket transmission
     * @param {Object} response - Processed response object
     * @param {string} messageType - Type of WebSocket message
     * @returns {Object} - WebSocket-formatted message
     */
    formatForWebSocket(response, messageType = 'agent_response') {
        try {
            this.debug.debug('Formatting response for WebSocket', {
                messageType: messageType,
                agentName: response.agentName,
                chunkCount: response.chunks?.length || 0
            });

            // Base WebSocket message structure
            const baseMessage = {
                type: messageType,
                timestamp: Date.now(),
                agentName: response.agentName,
                success: response.success
            };

            // Format based on message type
            switch (messageType) {
                case 'session.update':
                    return this.formatSessionUpdateMessage(response, baseMessage);
                
                case 'agent_response':
                    return this.formatAgentResponseMessage(response, baseMessage);
                
                case 'voice_change':
                    return this.formatVoiceChangeMessage(response, baseMessage);
                
                case 'response_chunk':
                    return this.formatResponseChunkMessage(response, baseMessage);
                
                default:
                    this.debug.warn('Unknown WebSocket message type', { messageType });
                    return {
                        ...baseMessage,
                        data: response,
                        messageType: 'generic'
                    };
            }

        } catch (error) {
            this.debug.error('Error formatting response for WebSocket', {
                error: error.message,
                messageType: messageType,
                agentName: response?.agentName
            });

            // Return error message
            return {
                type: 'error',
                timestamp: Date.now(),
                error: error.message,
                originalMessageType: messageType,
                agentName: response?.agentName || 'Unknown'
            };
        }
    }

    /**
     * Format session update message for WebSocket
     * @param {Object} response - Processed response
     * @param {Object} baseMessage - Base message structure
     * @returns {Object} - Session update message
     */
    formatSessionUpdateMessage(response, baseMessage) {
        return {
            ...baseMessage,
            type: 'session.update',
            session: {
                instructions: response.sessionInstructions,
                voice: response.voiceConfig.voice,
                modalities: ['text', 'audio'],
                input_audio_format: 'pcm16',
                output_audio_format: 'pcm16',
                input_audio_transcription: {
                    model: 'whisper-1'
                },
                turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 1000
                },
                temperature: response.voiceConfig.temperature || 0.9,
                max_response_output_tokens: 500
            },
            metadata: {
                agentName: response.agentName,
                voiceChanged: response.voiceConfig.voiceChangeRequired,
                processingTime: response.streamingMetadata?.processingTime
            }
        };
    }

    /**
     * Format agent response message for WebSocket
     * @param {Object} response - Processed response
     * @param {Object} baseMessage - Base message structure
     * @returns {Object} - Agent response message
     */
    formatAgentResponseMessage(response, baseMessage) {
        return {
            ...baseMessage,
            response: {
                text: response.originalResponse,
                chunks: response.chunks,
                chunkingStrategy: response.chunkingStrategy
            },
            voiceConfig: response.voiceConfig,
            metadata: response.streamingMetadata
        };
    }

    /**
     * Format voice change message for WebSocket
     * @param {Object} response - Processed response
     * @param {Object} baseMessage - Base message structure
     * @returns {Object} - Voice change message
     */
    formatVoiceChangeMessage(response, baseMessage) {
        return {
            ...baseMessage,
            type: 'voice_change',
            voiceConfig: {
                newVoice: response.voiceConfig.voice,
                previousVoice: response.voiceConfig.previousVoice,
                speed: response.voiceConfig.speed,
                pitch: response.voiceConfig.pitch
            },
            agentName: response.agentName
        };
    }

    /**
     * Format response chunk message for WebSocket
     * @param {Object} response - Processed response
     * @param {Object} baseMessage - Base message structure
     * @returns {Object} - Response chunk message
     */
    formatResponseChunkMessage(response, baseMessage) {
        return {
            ...baseMessage,
            type: 'response_chunk',
            chunks: response.chunks,
            totalChunks: response.chunks.length,
            chunkingStrategy: response.chunkingStrategy
        };
    }

    /**
     * Generate session instructions for agent
     * @param {string} agentName - Name of the agent
     * @param {string} responseText - Agent's response text
     * @param {Object} context - Current context
     * @returns {Promise<string>} - Session instructions
     */
    async generateSessionInstructions(agentName, responseText, context) {
        try {
            // Get current persona information
            const personaInfo = this.getCurrentPersonaInfo();
            
            // Get agent-specific instructions
            const agentInstructions = this.getAgentSpecificInstructions(agentName);
            
            // Combine instructions
            const combinedInstructions = `${personaInfo.instructions || ''}

${agentInstructions}

Current Context: You are now operating as ${agentName}. 

Recent Response: "${responseText}"

Please continue the conversation maintaining this agent's expertise and personality.`;

            return combinedInstructions;

        } catch (error) {
            this.debug.error('Failed to generate session instructions', {
                error: error.message,
                agentName: agentName
            });
            
            return this.getDefaultSessionInstructions();
        }
    }

    /**
     * Get agent-specific instructions
     * @param {string} agentName - Name of the agent
     * @returns {string} - Agent-specific instructions
     */
    getAgentSpecificInstructions(agentName) {
        const agentInstructions = {
            'FraudAgent': `You are a fraud prevention specialist. Focus on:
- Card security and blocking suspicious transactions
- Identity verification for security purposes
- Fraud detection and prevention
- Helping users secure their accounts
- Be security-conscious and thorough in verification`,

            'PaymentsAgent': `You are a payments specialist. Focus on:
- Money transfers and payments
- Standing orders and direct debits
- Payment confirmations and cancellations
- Transaction processing
- Be precise with amounts and recipient details`,

            'IDVAgent': `You are an identity verification specialist. Focus on:
- Account security and authentication
- Password resets and security questions
- Two-factor authentication setup
- Identity verification processes
- Be thorough but user-friendly with security procedures`,

            'BankingInfoAgent': `You are a banking information specialist. Focus on:
- Account balances and statements
- Transaction history and details
- Account information and sort codes
- General banking inquiries
- Provide accurate and helpful account information`,

            'MultiAgentOrchestrator': `You are coordinating multiple banking services. Focus on:
- Complex requests requiring multiple agents
- Workflow coordination
- Comprehensive banking assistance
- Seamless service integration`
        };

        return agentInstructions[agentName] || `You are ${agentName}. Provide helpful banking assistance.`;
    }

    /**
     * Get default session instructions
     * @returns {string} - Default instructions
     */
    getDefaultSessionInstructions() {
        const personaInfo = this.getCurrentPersonaInfo();
        return personaInfo.instructions || 'You are a helpful banking assistant. Provide friendly and professional assistance with banking inquiries.';
    }

    /**
     * Get current persona information
     * @returns {Object} - Current persona info
     */
    getCurrentPersonaInfo() {
        try {
            // Try to get persona from global state
            if (window.currentPersona) {
                return window.currentPersona;
            }
            
            // Try to get from persona manager
            if (window.personaManager && typeof window.personaManager.getCurrentPersona === 'function') {
                return window.personaManager.getCurrentPersona();
            }
            
            // Fallback to default
            return {
                name: 'Default Assistant',
                instructions: 'You are a helpful banking assistant.'
            };

        } catch (error) {
            this.debug.warn('Failed to get current persona info', { error: error.message });
            return {
                name: 'Default Assistant',
                instructions: 'You are a helpful banking assistant.'
            };
        }
    }

    /**
     * Determine optimal chunking strategy based on response characteristics
     * @param {string} responseText - Response text to analyze
     * @param {string} preferredStrategy - Preferred strategy from metadata
     * @returns {string} - Selected chunking strategy
     */
    determineChunkingStrategy(responseText, preferredStrategy = 'sentence_based') {
        try {
            // Use preferred strategy if valid
            if (this.chunkingConfig[preferredStrategy]) {
                return preferredStrategy;
            }

            // Analyze response characteristics
            const length = responseText.length;
            const sentenceCount = (responseText.match(/[.!?;]/g) || []).length;
            const wordCount = responseText.split(/\s+/).length;

            // Decision logic based on response characteristics
            if (length < 50) {
                return 'character_based'; // Very short responses
            } else if (sentenceCount >= 2 && length > 100) {
                return 'sentence_based'; // Multi-sentence responses
            } else if (wordCount > 20) {
                return 'word_based'; // Medium-length responses
            } else {
                return 'sentence_based'; // Default fallback
            }

        } catch (error) {
            this.debug.warn('Error determining chunking strategy', {
                error: error.message,
                preferredStrategy: preferredStrategy
            });
            return 'sentence_based'; // Safe fallback
        }
    }

    /**
     * Check if voice change is required for agent
     * @param {string} agentName - Name of the agent
     * @param {Object} streamingContext - Current streaming context
     * @returns {boolean} - Whether voice change is required
     */
    requiresVoiceChange(agentName, streamingContext) {
        try {
            const currentVoice = streamingContext.voiceConfiguration?.currentVoice;
            const agentVoice = this.agentVoiceMap[agentName]?.voice;
            
            return agentVoice && currentVoice && agentVoice !== currentVoice;

        } catch (error) {
            this.debug.warn('Error checking voice change requirement', {
                error: error.message,
                agentName: agentName
            });
            return false;
        }
    }

    /**
     * Update processing metrics
     * @param {Object} processedResponse - Processed response object
     */
    updateProcessingMetrics(processedResponse) {
        try {
            this.processingMetrics.totalResponses++;
            
            const processingTime = processedResponse.streamingMetadata.processingTime;
            this.processingMetrics.averageProcessingTime = 
                ((this.processingMetrics.averageProcessingTime * (this.processingMetrics.totalResponses - 1)) + processingTime) / 
                this.processingMetrics.totalResponses;

        } catch (error) {
            this.debug.warn('Error updating processing metrics', { error: error.message });
        }
    }

    /**
     * Get processing statistics
     * @returns {Object} - Processing statistics
     */
    getProcessingStats() {
        return {
            ...this.processingMetrics,
            supportedStrategies: Object.keys(this.chunkingConfig),
            supportedVoices: Object.keys(this.agentVoiceMap),
            timestamp: Date.now()
        };
    }

    /**
     * Reset processing metrics
     */
    resetProcessingMetrics() {
        this.processingMetrics = {
            totalResponses: 0,
            averageProcessingTime: 0,
            chunkingStats: {
                sentence_based: 0,
                word_based: 0,
                character_based: 0
            }
        };
        
        this.debug.info('Processing metrics reset');
    }

    /**
     * Cleanup resources and references
     */
    cleanup() {
        this.debug.info('Cleaning up StreamingResponseHandler resources');
        
        // Reset metrics
        this.resetProcessingMetrics();
        
        // Clear references
        this.streamingManager = null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingResponseHandler;
} else {
    window.StreamingResponseHandler = StreamingResponseHandler;
}