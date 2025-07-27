/**
 * IDVAgent - Identity and Verification Agent
 * Handles identity verification, password resets, and security-related requests
 */
class IDVAgent extends BaseAgent {
    constructor() {
        super(
            'IDVAgent',
            'Handles identity verification, password resets, and account security requests'
        );
        
        // Keywords that trigger this agent
        this.identityKeywords = [
            'verify', 'verification', 'identity', 'authenticate', 'authentication',
            'password', 'pin', 'reset', 'forgot', 'forgotten',
            'security question', 'security questions', 'verify me', 'identity check',
            'account verification', 'confirm identity', 'prove identity'
        ];
        
        this.debug.info('IDVAgent initialized with keywords', { keywords: this.identityKeywords });
    }
    
    /**
     * Determines if this agent can handle the given input
     * @param {string} inputText - The user's input text
     * @returns {boolean} - True if input contains identity verification keywords
     */
    canHandle(inputText) {
        if (!inputText || typeof inputText !== 'string') {
            return false;
        }
        
        const lowerInput = inputText.toLowerCase();
        
        // Check for exact phrase matches first (higher priority)
        const exactPhrases = [
            'verify me', 'identity check', 'forgot password', 'reset pin',
            'security question', 'account verification', 'confirm identity'
        ];
        
        for (const phrase of exactPhrases) {
            if (lowerInput.includes(phrase)) {
                this.debug.info('IDVAgent can handle input - exact phrase match', { 
                    phrase, 
                    inputText: inputText.substring(0, 50) + '...' 
                });
                return true;
            }
        }
        
        // Check for individual keyword matches
        const hasKeyword = this.identityKeywords.some(keyword => 
            lowerInput.includes(keyword.toLowerCase())
        );
        
        if (hasKeyword) {
            this.debug.info('IDVAgent can handle input - keyword match', { 
                inputText: inputText.substring(0, 50) + '...' 
            });
        }
        
        return hasKeyword;
    }
    
    /**
     * Handles identity verification requests with security validation
     * @param {string} inputText - The user's input text
     * @param {Object} context - Context object containing app dependencies
     * @returns {Promise<Object>} - Agent response object
     */
    async handle(inputText, context) {
        const startTime = Date.now();
        
        try {
            // Validate required context dependencies
            this.validateContext(context);
            
            this.debug.info('IDVAgent processing request with security validation', { 
                inputText: inputText.substring(0, 100) + '...' 
            });
            
            // Validate data access permissions for identity verification
            this.validateDataAccess(['identity', 'verification', 'authentication']);
            
            // Validate guardrails for identity verification actions
            this.validateGuardrails('getAccountData', { action: 'identity_verification' });
            
            // Generate domain-specific system prompt
            const systemPrompt = this.generateSystemPrompt(context, inputText);
            
            // Get current persona data for context (through secure access)
            const personaData = this.getPersonaData(context);
            
            // Prepare the request for the LLM using sandboxed API client
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: inputText }
            ];
            
            // Call the LLM API through sandboxed client
            const apiResponse = await this.sandboxedApiClient.generateChatCompletion(messages, {
                model: 'gpt-3.5-turbo',
                maxTokens: 500,
                temperature: 0.7
            });
            
            if (!apiResponse || !apiResponse.choices || !apiResponse.choices.length) {
                throw new Error("No response from LLM");
              }
              
              const content = apiResponse.choices[0].message.content;
              
              return {
                success: true,
                response: content,
                agentName: "IDVAgent",
                tokensUsed: apiResponse.usage?.total_tokens || 0,
                processingTime: Date.now() - startTime,
              };
            
            // Demonstrate secure domain API access with guardrails
            try {
                const identityData = await this.secureDataAccess(['identity', 'verification']);
                this.debug.info('IDVAgent accessed identity data securely', {
                    dataTypes: ['identity', 'verification']
                });
                
                // Test guardrails enforcement for password reset
                if (inputText.toLowerCase().includes('password') || inputText.toLowerCase().includes('reset')) {
                    this.validateGuardrails('resetPassword', { 
                        requiresSecondaryAuth: true,
                        action: 'password_reset'
                    });
                }
            } catch (securityError) {
                this.debug.warn('IDVAgent security/guardrails validation working correctly', {
                    error: securityError.message
                });
            }
            
            const response = apiResponse.content;
            const tokensUsed = apiResponse.tokensUsed || 0;
            const processingTime = Date.now() - startTime;
            
            // Track tokens if tracker is available
            if (context.tokenTracker) {
                // Estimate input/output tokens (rough split)
                const inputTokens = Math.floor(tokensUsed * 0.3);
                const outputTokens = Math.floor(tokensUsed * 0.7);
                context.tokenTracker.trackGptUsage(inputTokens, outputTokens);
            }
            
            this.debug.info('IDVAgent successfully processed request with security', {
                processingTime,
                tokensUsed,
                responseLength: response.length
            });
            
            return this.createResponse(
                true,
                response,
                processingTime,
                tokensUsed,
                null,
                {
                    agentType: 'identity_verification',
                    personaUsed: personaData?.name || 'default',
                    inputCategory: this.categorizeInput(inputText),
                    securityValidated: true
                }
            );
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            
            this.debug.error('IDVAgent failed to process request', {
                error: error.message,
                processingTime,
                inputText: inputText.substring(0, 50) + '...'
            });
            
            return this.createResponse(
                false,
                'I apologize, but I encountered an issue while processing your identity verification request. Please try again or contact support if the problem persists.',
                processingTime,
                0,
                error.message,
                {
                    agentType: 'identity_verification',
                    errorType: error.name || 'UnknownError',
                    securityError: error.message.includes('access') || error.message.includes('permission')
                }
            );
        }
    }
    
    /**
     * Override system prompt components for identity verification context
     * @param {Object} context - Context object containing SystemPromptsManager
     * @param {Object} personaData - Current persona data
     * @returns {Object} - System prompt overrides
     */
    getSystemPromptOverrides(context, personaData) {
        return {
            basePersonality: null, // Use default
            financialContext: "When handling identity verification requests, prioritize security and privacy above all else. Guide users through secure verification processes while maintaining strict security boundaries.",
            responseInstructions: "Keep responses security-focused and provide clear, step-by-step guidance. Never request sensitive information in conversation. Always direct users to secure channels for sensitive operations.",
            additionalInstructions: [
                "You are specialized in identity verification, password resets, and account security",
                "You can ONLY access identity verification functions - no payments, transactions, or balances",
                "Always prioritize security and user privacy in all interactions",
                "Provide clear instructions but never ask for passwords or PINs in conversation",
                "If asked about payments, transfers, or fraud reporting, politely redirect as these are outside your domain"
            ]
        };
    }
    
    /**
     * Generate persona-specific behavior modifications for IDV operations
     * @param {Object} personaData - Current persona data
     * @returns {string} - IDV-specific persona behavior modifications
     */
    generatePersonaBehaviorModifications(personaData) {
        let behaviorMods = super.generatePersonaBehaviorModifications(personaData);
        
        if (!personaData) {
            return behaviorMods;
        }
        
        behaviorMods += `\n\nIDV-SPECIFIC PERSONA ADAPTATIONS:`;
        
        // Account type specific security considerations
        if (personaData.accountType) {
            if (personaData.accountType.toLowerCase().includes('premium') || 
                personaData.accountType.toLowerCase().includes('business')) {
                behaviorMods += `\n- Enhanced Security: Apply heightened security protocols for ${personaData.accountType} account`;
            }
        }
        
        // Recent transaction patterns for security context
        if (personaData.recentTransactions && personaData.recentTransactions.length > 0) {
            const hasRecentLargeTransactions = personaData.recentTransactions.some(tx => 
                Math.abs(tx.amount) > 1000
            );
            
            if (hasRecentLargeTransactions) {
                behaviorMods += `\n- Security Alert Context: Be aware of recent high-value transactions when verifying identity`;
            }
        }
        
        // Balance-based security considerations
        if (typeof personaData.balance === 'number' && personaData.balance > 5000) {
            behaviorMods += `\n- High-Value Account: Apply additional security measures for high-balance account verification`;
        }
        
        return behaviorMods;
    }
    
    /**
     * Supplement system prompt with IDV-specific enhancements
     * @param {Object} context - Context object containing SystemPromptsManager
     * @param {string} basePrompt - The base system prompt
     * @param {Object} personaData - Current persona data
     * @returns {string} - Enhanced system prompt
     */
    supplementSystemPrompt(context, basePrompt, personaData) {
        const idvEnhancements = `

IDENTITY VERIFICATION SECURITY PROTOCOLS:
- Never request sensitive information (passwords, PINs, full card numbers) in conversation
- Always verify user identity through secure, established channels
- Provide step-by-step guidance for password resets and security procedures
- Escalate complex security issues to appropriate secure channels
- Maintain strict boundaries - only handle identity verification tasks

VERIFICATION CAPABILITIES:
- Guide through identity verification processes
- Provide password reset instructions and security best practices
- Help with security question setup and recovery procedures
- Offer general account security advice and best practices
- Explain authentication methods and security requirements`;

        return basePrompt + idvEnhancements;
    }
    
    /**
     * Categorizes the input for metadata tracking
     * @param {string} inputText - The user's input text
     * @returns {string} - Category of the input
     */
    categorizeInput(inputText) {
        const lowerInput = inputText.toLowerCase();
        
        if (lowerInput.includes('password') || lowerInput.includes('forgot')) {
            return 'password_reset';
        }
        if (lowerInput.includes('verify') || lowerInput.includes('identity')) {
            return 'identity_verification';
        }
        if (lowerInput.includes('pin') || lowerInput.includes('reset pin')) {
            return 'pin_reset';
        }
        if (lowerInput.includes('security question')) {
            return 'security_questions';
        }
        
        return 'general_identity';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IDVAgent;
} else {
    window.IDVAgent = IDVAgent;
}