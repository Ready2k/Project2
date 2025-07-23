/**
 * LLM Provider Interface - Pluggable interface for different LLM backends
 * Supports OpenAI, Claude, Bedrock, and custom providers
 */

/**
 * Abstract base class for LLM providers
 */
class LLMProvider {
    constructor(name, config = {}) {
        if (this.constructor === LLMProvider) {
            throw new Error('LLMProvider is abstract and cannot be instantiated directly');
        }
        
        this.name = name;
        this.config = config;
        this.debug = window.debugManager?.createModuleLogger(`LLMProvider:${name}`) || console;
        this.initialized = false;
    }
    
    /**
     * Initialize the provider with configuration
     * @param {Object} config - Provider-specific configuration
     * @returns {Promise<boolean>} - True if initialization successful
     */
    async initialize(config = {}) {
        throw new Error(`Provider ${this.name} must implement initialize() method`);
    }
    
    /**
     * Generate a chat completion
     * @param {Array<Object>} messages - Array of message objects
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} - Response object
     */
    async generateChatCompletion(messages, options = {}) {
        throw new Error(`Provider ${this.name} must implement generateChatCompletion() method`);
    }
    
    /**
     * Generate a streaming chat completion
     * @param {Array<Object>} messages - Array of message objects
     * @param {Object} options - Generation options
     * @param {Function} onChunk - Callback for each chunk
     * @returns {Promise<Object>} - Response object
     */
    async generateStreamingCompletion(messages, options = {}, onChunk = null) {
        throw new Error(`Provider ${this.name} must implement generateStreamingCompletion() method`);
    }
    
    /**
     * Check if the provider is available and configured
     * @returns {boolean} - True if provider is ready to use
     */
    isAvailable() {
        return this.initialized;
    }
    
    /**
     * Get provider capabilities
     * @returns {Object} - Capabilities object
     */
    getCapabilities() {
        return {
            streaming: false,
            functionCalling: false,
            maxTokens: 4096,
            supportedModels: []
        };
    }
    
    /**
     * Get provider configuration schema
     * @returns {Object} - Configuration schema for UI generation
     */
    getConfigSchema() {
        return {};
    }
    
    /**
     * Validate configuration
     * @param {Object} config - Configuration to validate
     * @returns {Object} - Validation result
     */
    validateConfig(config) {
        return { valid: true, errors: [] };
    }
}

/**
 * OpenAI Provider Implementation
 */
class OpenAIProvider extends LLMProvider {
    constructor(config = {}) {
        super('openai', config);
        this.apiKey = config.apiKey || '';
        this.baseURL = config.baseURL || 'https://api.openai.com/v1';
        this.organization = config.organization || '';
    }
    
    async initialize(config = {}) {
        try {
            this.config = { ...this.config, ...config };
            this.apiKey = this.config.apiKey || this.apiKey;
            this.baseURL = this.config.baseURL || this.baseURL;
            this.organization = this.config.organization || this.organization;
            
            if (!this.apiKey) {
                throw new Error('OpenAI API key is required');
            }
            
            // Test the connection
            await this.testConnection();
            
            this.initialized = true;
            this.debug.info('OpenAI provider initialized successfully');
            return true;
        } catch (error) {
            this.debug.error('Failed to initialize OpenAI provider', { error: error.message });
            return false;
        }
    }
    
    async testConnection() {
        const response = await fetch(`${this.baseURL}/models`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                ...(this.organization && { 'OpenAI-Organization': this.organization })
            }
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API test failed: ${response.status} ${response.statusText}`);
        }
    }
    
    async generateChatCompletion(messages, options = {}) {
        if (!this.initialized) {
            throw new Error('OpenAI provider not initialized');
        }
        
        const startTime = Date.now();
        
        try {
            const requestBody = {
                model: options.model || 'gpt-3.5-turbo',
                messages: messages,
                max_tokens: options.maxTokens || 1000,
                temperature: options.temperature || 0.7,
                top_p: options.topP || 1,
                frequency_penalty: options.frequencyPenalty || 0,
                presence_penalty: options.presencePenalty || 0,
                ...options.additionalParams
            };
            
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    ...(this.organization && { 'OpenAI-Organization': this.organization })
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }
            
            const data = await response.json();
            const processingTime = Date.now() - startTime;
            
            return {
                success: true,
                content: data.choices[0]?.message?.content || '',
                tokensUsed: data.usage?.total_tokens || 0,
                model: data.model,
                processingTime,
                provider: 'openai',
                metadata: {
                    promptTokens: data.usage?.prompt_tokens || 0,
                    completionTokens: data.usage?.completion_tokens || 0,
                    finishReason: data.choices[0]?.finish_reason
                }
            };
        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.debug.error('OpenAI completion failed', { error: error.message });
            
            return {
                success: false,
                content: '',
                tokensUsed: 0,
                processingTime,
                provider: 'openai',
                error: error.message
            };
        }
    }
    
    async generateStreamingCompletion(messages, options = {}, onChunk = null) {
        if (!this.initialized) {
            throw new Error('OpenAI provider not initialized');
        }
        
        const startTime = Date.now();
        let fullContent = '';
        let totalTokens = 0;
        
        try {
            const requestBody = {
                model: options.model || 'gpt-3.5-turbo',
                messages: messages,
                max_tokens: options.maxTokens || 1000,
                temperature: options.temperature || 0.7,
                stream: true,
                ...options.additionalParams
            };
            
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    ...(this.organization && { 'OpenAI-Organization': this.organization })
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices[0]?.delta?.content || '';
                            
                            if (content) {
                                fullContent += content;
                                if (onChunk) {
                                    onChunk(content, fullContent);
                                }
                            }
                        } catch (parseError) {
                            // Ignore parsing errors for individual chunks
                        }
                    }
                }
            }
            
            const processingTime = Date.now() - startTime;
            
            return {
                success: true,
                content: fullContent,
                tokensUsed: totalTokens,
                processingTime,
                provider: 'openai',
                streaming: true
            };
        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.debug.error('OpenAI streaming completion failed', { error: error.message });
            
            return {
                success: false,
                content: fullContent,
                tokensUsed: totalTokens,
                processingTime,
                provider: 'openai',
                error: error.message
            };
        }
    }
    
    getCapabilities() {
        return {
            streaming: true,
            functionCalling: true,
            maxTokens: 128000,
            supportedModels: [
                'gpt-3.5-turbo',
                'gpt-3.5-turbo-16k',
                'gpt-4',
                'gpt-4-turbo',
                'gpt-4-turbo-preview'
            ]
        };
    }
    
    getConfigSchema() {
        return {
            apiKey: {
                type: 'password',
                label: 'API Key',
                description: 'OpenAI API key',
                required: true
            },
            baseURL: {
                type: 'text',
                label: 'Base URL',
                description: 'OpenAI API base URL',
                default: 'https://api.openai.com/v1'
            },
            organization: {
                type: 'text',
                label: 'Organization ID',
                description: 'OpenAI organization ID (optional)'
            }
        };
    }
    
    validateConfig(config) {
        const errors = [];
        
        if (!config.apiKey) {
            errors.push('API key is required');
        }
        
        if (config.baseURL && !config.baseURL.startsWith('http')) {
            errors.push('Base URL must be a valid HTTP/HTTPS URL');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

/**
 * Claude Provider Implementation (Anthropic)
 */
class ClaudeProvider extends LLMProvider {
    constructor(config = {}) {
        super('claude', config);
        this.apiKey = config.apiKey || '';
        this.baseURL = config.baseURL || 'https://api.anthropic.com/v1';
    }
    
    async initialize(config = {}) {
        try {
            this.config = { ...this.config, ...config };
            this.apiKey = this.config.apiKey || this.apiKey;
            this.baseURL = this.config.baseURL || this.baseURL;
            
            if (!this.apiKey) {
                throw new Error('Claude API key is required');
            }
            
            this.initialized = true;
            this.debug.info('Claude provider initialized successfully');
            return true;
        } catch (error) {
            this.debug.error('Failed to initialize Claude provider', { error: error.message });
            return false;
        }
    }
    
    async generateChatCompletion(messages, options = {}) {
        if (!this.initialized) {
            throw new Error('Claude provider not initialized');
        }
        
        const startTime = Date.now();
        
        try {
            // Convert OpenAI format to Claude format
            const systemMessage = messages.find(m => m.role === 'system');
            const userMessages = messages.filter(m => m.role !== 'system');
            
            const requestBody = {
                model: options.model || 'claude-3-sonnet-20240229',
                max_tokens: options.maxTokens || 1000,
                temperature: options.temperature || 0.7,
                messages: userMessages,
                ...(systemMessage && { system: systemMessage.content }),
                ...options.additionalParams
            };
            
            const response = await fetch(`${this.baseURL}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Claude API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }
            
            const data = await response.json();
            const processingTime = Date.now() - startTime;
            
            return {
                success: true,
                content: data.content[0]?.text || '',
                tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens || 0,
                model: data.model,
                processingTime,
                provider: 'claude',
                metadata: {
                    inputTokens: data.usage?.input_tokens || 0,
                    outputTokens: data.usage?.output_tokens || 0,
                    stopReason: data.stop_reason
                }
            };
        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.debug.error('Claude completion failed', { error: error.message });
            
            return {
                success: false,
                content: '',
                tokensUsed: 0,
                processingTime,
                provider: 'claude',
                error: error.message
            };
        }
    }
    
    async generateStreamingCompletion(messages, options = {}, onChunk = null) {
        // Claude streaming implementation would go here
        // For now, fall back to non-streaming
        return await this.generateChatCompletion(messages, options);
    }
    
    getCapabilities() {
        return {
            streaming: false, // Would be true when implemented
            functionCalling: false,
            maxTokens: 200000,
            supportedModels: [
                'claude-3-opus-20240229',
                'claude-3-sonnet-20240229',
                'claude-3-haiku-20240307'
            ]
        };
    }
    
    getConfigSchema() {
        return {
            apiKey: {
                type: 'password',
                label: 'API Key',
                description: 'Anthropic API key',
                required: true
            },
            baseURL: {
                type: 'text',
                label: 'Base URL',
                description: 'Anthropic API base URL',
                default: 'https://api.anthropic.com/v1'
            }
        };
    }
    
    validateConfig(config) {
        const errors = [];
        
        if (!config.apiKey) {
            errors.push('API key is required');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

/**
 * AWS Bedrock Provider Implementation
 */
class BedrockProvider extends LLMProvider {
    constructor(config = {}) {
        super('bedrock', config);
        this.region = config.region || 'us-east-1';
        this.accessKeyId = config.accessKeyId || '';
        this.secretAccessKey = config.secretAccessKey || '';
    }
    
    async initialize(config = {}) {
        try {
            this.config = { ...this.config, ...config };
            this.region = this.config.region || this.region;
            this.accessKeyId = this.config.accessKeyId || this.accessKeyId;
            this.secretAccessKey = this.config.secretAccessKey || this.secretAccessKey;
            
            if (!this.accessKeyId || !this.secretAccessKey) {
                throw new Error('AWS credentials are required for Bedrock');
            }
            
            this.initialized = true;
            this.debug.info('Bedrock provider initialized successfully');
            return true;
        } catch (error) {
            this.debug.error('Failed to initialize Bedrock provider', { error: error.message });
            return false;
        }
    }
    
    async generateChatCompletion(messages, options = {}) {
        if (!this.initialized) {
            throw new Error('Bedrock provider not initialized');
        }
        
        // Bedrock implementation would require AWS SDK
        // This is a placeholder implementation
        throw new Error('Bedrock provider not fully implemented - requires AWS SDK integration');
    }
    
    async generateStreamingCompletion(messages, options = {}, onChunk = null) {
        throw new Error('Bedrock streaming not implemented');
    }
    
    getCapabilities() {
        return {
            streaming: false,
            functionCalling: false,
            maxTokens: 100000,
            supportedModels: [
                'anthropic.claude-v2',
                'anthropic.claude-instant-v1',
                'amazon.titan-text-express-v1'
            ]
        };
    }
    
    getConfigSchema() {
        return {
            region: {
                type: 'select',
                label: 'AWS Region',
                description: 'AWS region for Bedrock',
                options: ['us-east-1', 'us-west-2', 'eu-west-1'],
                default: 'us-east-1'
            },
            accessKeyId: {
                type: 'password',
                label: 'Access Key ID',
                description: 'AWS Access Key ID',
                required: true
            },
            secretAccessKey: {
                type: 'password',
                label: 'Secret Access Key',
                description: 'AWS Secret Access Key',
                required: true
            }
        };
    }
    
    validateConfig(config) {
        const errors = [];
        
        if (!config.accessKeyId) {
            errors.push('Access Key ID is required');
        }
        
        if (!config.secretAccessKey) {
            errors.push('Secret Access Key is required');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LLMProvider, OpenAIProvider, ClaudeProvider, BedrockProvider };
} else {
    window.LLMProvider = LLMProvider;
    window.OpenAIProvider = OpenAIProvider;
    window.ClaudeProvider = ClaudeProvider;
    window.BedrockProvider = BedrockProvider;
}