/**
 * FraudAgent - Fraud Detection and Security Agent
 * Handles card blocking, fraud reporting, and security-related requests
 */
class FraudAgent extends BaseAgent {
    constructor() {
        super(
            'FraudAgent',
            'Handles fraud detection, card blocking, and security threat responses'
        );

        // Keywords that trigger this agent
        this.fraudKeywords = [
            'fraud', 'fraudulent', 'suspicious', 'unauthorised', 'unauthorized',
            'freeze', 'block', 'stop', 'cancel', 'disable',
            'stolen', 'lost', 'compromised', 'hacked', 'breach',
            'scam', 'phishing', 'suspicious activity', 'unknown transaction',
            'dispute', 'chargeback', 'report fraud', 'security alert'
        ];

        // Card-specific keywords for blocking/freezing
        this.cardKeywords = [
            'card', 'debit card', 'credit card', 'bank card', 'payment card'
        ];

        this.debug.info('FraudAgent initialized with keywords', {
            fraudKeywords: this.fraudKeywords,
            cardKeywords: this.cardKeywords
        });
    }

    /**
     * Determines if this agent can handle the given input
     * @param {string} inputText - The user's input text
     * @returns {boolean} - True if input contains fraud or security keywords
     */
    canHandle(inputText) {
        console.log('DEBUG: FraudAgent.canHandle called with:', inputText.substring(0, 50));
        
        if (!inputText || typeof inputText !== 'string') {
            return false;
        }

        const lowerInput = inputText.toLowerCase();

        // Check for exact phrase matches first (higher priority)
        const exactPhrases = [
            'freeze card', 'block card', 'stop card', 'cancel card',
            'freeze my card', 'block my card', 'stop my card',
            'block it', 'freeze it', 'stop it', 'cancel it',
            'yes block', 'yes freeze', 'yeah block', 'yeah freeze',
            'suspicious activity', 'unauthorised transaction', 'unauthorized transaction',
            'report fraud', 'fraud alert', 'security alert', 'card stolen',
            'card lost', 'card compromised', 'unknown transaction'
        ];

        for (const phrase of exactPhrases) {
            if (lowerInput.includes(phrase)) {
                console.log('DEBUG: FraudAgent EXACT MATCH found', {
                    phrase,
                    inputText: inputText.substring(0, 50)
                });
                this.debug.info('FraudAgent can handle input - exact phrase match', {
                    phrase,
                    inputText: inputText.substring(0, 50) + '...'
                });
                return true;
            }
        }

        // Check for fraud keywords combined with card keywords
        const hasFraudKeyword = this.fraudKeywords.some(keyword =>
            lowerInput.includes(keyword.toLowerCase())
        );

        const hasCardKeyword = this.cardKeywords.some(keyword =>
            lowerInput.includes(keyword.toLowerCase())
        );

        // High confidence if both fraud and card keywords are present
        if (hasFraudKeyword && hasCardKeyword) {
            this.debug.info('FraudAgent can handle input - fraud + card keyword match', {
                inputText: inputText.substring(0, 50) + '...'
            });
            return true;
        }

        // Check for standalone fraud keywords that are security-related
        const securityKeywords = [
            'fraud', 'fraudulent', 'suspicious', 'unauthorised', 'unauthorized',
            'stolen', 'compromised', 'hacked', 'breach', 'scam', 'phishing'
        ];

        const hasSecurityKeyword = securityKeywords.some(keyword =>
            lowerInput.includes(keyword.toLowerCase())
        );

        if (hasSecurityKeyword) {
            this.debug.info('FraudAgent can handle input - security keyword match', {
                inputText: inputText.substring(0, 50) + '...'
            });
        }

        return hasSecurityKeyword;
    }

    /**
     * Handles fraud detection and security requests with security validation
     * @param {string} inputText - The user's input text
     * @param {Object} context - Context object containing app dependencies
     * @returns {Promise<Object>} - Agent response object
     */
    async handle(inputText, context) {
        const startTime = Date.now();

        try {
            // Validate required context dependencies
            this.validateContext(context);

            this.debug.info('FraudAgent processing request with security validation', {
                inputText: inputText.substring(0, 100) + '...'
            });

            // Validate data access permissions for fraud detection
            this.validateDataAccess(['fraud_alerts', 'security_actions', 'card_status']);
            
            // Validate guardrails for fraud detection actions
            const requiresSecondaryAuth = this.checkSecondaryAuthRequired('blockCard', context);
            this.validateGuardrails('blockCard', { 
                action: 'card_blocking', 
                requiresSecondaryAuth 
            });

            // Generate domain-specific system prompt
            const systemPrompt = this.generateSystemPrompt(context, inputText);

            // Get current persona data for context
            const personaData = this.getPersonaData(context);

            // Prepare the request for the LLM using sandboxed API client
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: inputText }
            ];

            // Call the LLM API through sandboxed client
            const apiResponse = await this.sandboxedApiClient.generateChatCompletion(messages, {
                model: 'gpt-3.5-turbo',
                maxTokens: 600,
                temperature: 0.3 // Lower temperature for more consistent security responses
            });

            if (!apiResponse || !apiResponse.choices || !apiResponse.choices.length) {
                throw new Error("No response from LLM");
              }
              
              const content = apiResponse.choices[0].message.content;
              
              return {
                success: true,
                response: content,
                agentName: "FraudAgent",
                tokensUsed: apiResponse.usage?.total_tokens || 0,
                processingTime: Date.now() - startTime,
              };

            // Demonstrate secure domain API access for fraud actions with guardrails
            try {
                const fraudData = await this.secureDataAccess(['fraud_alerts', 'security_actions']);
                this.debug.info('FraudAgent accessed fraud data securely', {
                    dataTypes: ['fraud_alerts', 'security_actions']
                });

                // Test secure API call for card blocking with guardrails validation
                if (this.isCapabilityAllowed('canBlockCards')) {
                    const blockResult = await this.secureApiCall('block_card', { reason: 'fraud_prevention' });
                    this.debug.info('FraudAgent performed secure card blocking with guardrails', {
                        result: blockResult
                    });
                }
                
                // Test guardrails enforcement for secondary auth requirement
                if (this.requiresSecondaryAuth('blockCard')) {
                    this.debug.info('Guardrails correctly require secondary auth for card blocking');
                }
            } catch (securityError) {
                this.debug.warn('FraudAgent security/guardrails validation working correctly', {
                    error: securityError.message
                });
            }

            // Test that agent cannot access restricted data or capabilities
            try {
                await this.secureDataAccess(['balance', 'payments']);
                this.debug.error('Security violation: FraudAgent accessed restricted data');
            } catch (securityError) {
                this.debug.info('Security working: FraudAgent correctly blocked from restricted data', {
                    restrictedData: ['balance', 'payments']
                });
            }
            
            // Test guardrails block payment capabilities
            try {
                this.validateGuardrails('initiateTransfer', { amount: 500 });
                this.debug.error('Guardrails violation: FraudAgent allowed payment capability');
            } catch (guardrailsError) {
                this.debug.info('Guardrails working: FraudAgent correctly blocked from payment capability');
            }

            const response = apiResponse.text;
            const tokensUsed = apiResponse.tokensUsed || 0;
            const processingTime = Date.now() - startTime;

            // Track tokens if tracker is available
            if (context.tokenTracker) {
                // Estimate input/output tokens (rough split)
                const inputTokens = Math.floor(tokensUsed * 0.3);
                const outputTokens = Math.floor(tokensUsed * 0.7);
                context.tokenTracker.trackGptUsage(inputTokens, outputTokens);
            }

            this.debug.info('FraudAgent successfully processed request with security', {
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
                    agentType: 'fraud_security',
                    personaUsed: personaData?.name || 'default',
                    inputCategory: this.categorizeInput(inputText),
                    securityLevel: 'high',
                    securityValidated: true
                }
            );

        } catch (error) {
            const processingTime = Date.now() - startTime;

            this.debug.error('FraudAgent failed to process request', {
                error: error.message,
                processingTime,
                inputText: inputText.substring(0, 50) + '...'
            });

            return this.createResponse(
                false,
                'I apologize, but I encountered an issue while processing your security request. For immediate assistance with fraud or security concerns, please contact our fraud hotline directly or visit your nearest branch.',
                processingTime,
                0,
                error.message,
                {
                    agentType: 'fraud_security',
                    errorType: error.name || 'UnknownError',
                    securityLevel: 'high',
                    securityError: error.message.includes('access') || error.message.includes('permission')
                }
            );
        }
    }

    /**
     * Get agent-specific prompt overrides (fallback for when no configuration exists)
     * @param {Object} context - Context object containing SystemPromptsManager
     * @param {Object} personaData - Current persona data
     * @returns {Object} - System prompt overrides
     */
    getAgentSpecificPromptOverrides(context, personaData) {
        // These are now the fallback defaults - configuration takes precedence
        return {
            basePersonality: "You are an urgent, professional fraud detection and security specialist. You prioritize immediate protective actions and clear guidance. You are reassuring but maintain appropriate urgency for security threats.",
            financialContext: "When handling fraud and security requests, prioritize immediate protective actions. Focus on card blocking, fraud reporting, and security guidance. Always emphasize the time-sensitive nature of fraud response.",
            responseInstructions: "Provide immediate, clear guidance for security threats. Be urgent but reassuring. Give step-by-step instructions for protective actions. Always provide emergency contact information when relevant.",
            additionalInstructions: [
                "You are specialized in fraud detection, card blocking, and security threat responses",
                "Treat all fraud reports with HIGH PRIORITY and urgency",
                "You can perform PROTECTIVE actions like card blocking and fraud reporting",
                "You CANNOT access payment processing, money transfers, or account balances",
                "Provide immediate protective actions when requested",
                "Never ask for sensitive information like card numbers or PINs",
                "Always emphasize time-sensitive nature of fraud response",
                "If asked about payments or transfers, redirect to appropriate agents"
            ]
        };
    }

    /**
     * Generate persona-specific behavior modifications for fraud detection
     * @param {Object} personaData - Current persona data
     * @returns {string} - Fraud-specific persona behavior modifications
     */
    generatePersonaBehaviorModifications(personaData) {
        let behaviorMods = super.generatePersonaBehaviorModifications(personaData);

        if (!personaData) {
            return behaviorMods;
        }

        behaviorMods += `\n\nFRAUD DETECTION PERSONA ADAPTATIONS:`;

        // Account type specific security considerations
        if (personaData.accountType) {
            if (personaData.accountType.toLowerCase().includes('business')) {
                behaviorMods += `\n- Business Account Security: Apply enhanced fraud protocols for business account protection`;
            } else if (personaData.accountType.toLowerCase().includes('premium')) {
                behaviorMods += `\n- Premium Account Security: Provide priority fraud response for premium account holder`;
            }
        }

        // Balance-based risk assessment
        if (typeof personaData.balance === 'number') {
            if (personaData.balance > 10000) {
                behaviorMods += `\n- High-Value Target: Account has significant balance - emphasize immediate protective actions`;
            } else if (personaData.balance < 100) {
                behaviorMods += `\n- Limited Exposure: Lower balance reduces financial risk but maintain security protocols`;
            }
        }

        // Recent transaction analysis for fraud patterns
        if (personaData.recentTransactions && personaData.recentTransactions.length > 0) {
            const recentTransactions = personaData.recentTransactions.slice(0, 5);
            const hasLargeTransactions = recentTransactions.some(tx => Math.abs(tx.amount) > 500);
            const hasFrequentActivity = recentTransactions.length >= 3;

            if (hasLargeTransactions) {
                behaviorMods += `\n- High-Value Activity: Recent large transactions detected - monitor for unusual patterns`;
            }

            if (hasFrequentActivity) {
                behaviorMods += `\n- Active Account: Frequent recent activity - compare against normal usage patterns`;
            }
        }

        // Card information for blocking procedures
        if (personaData.cardLast4) {
            behaviorMods += `\n- Card Reference: Use card ending in ${personaData.cardLast4} for blocking confirmations`;
        }

        return behaviorMods;
    }

    /**
     * Supplement system prompt with fraud-specific enhancements
     * @param {Object} context - Context object containing SystemPromptsManager
     * @param {string} basePrompt - The base system prompt
     * @param {Object} personaData - Current persona data
     * @returns {string} - Enhanced system prompt
     */
    supplementSystemPrompt(context, basePrompt, personaData) {
        let fraudEnhancements = `

FRAUD DETECTION CAPABILITIES:
- Guide users through card blocking and freezing procedures
- Provide fraud reporting instructions and next steps
- Help identify suspicious activity patterns
- Offer security best practices and prevention advice
- Assist with dispute and chargeback processes
- Provide emergency contact information for fraud situations
- Clearly explain when actions (like card blocking) are restricted due to security policies (e.g., secondary authentication requirements)

EMERGENCY PROTOCOLS:
- For card blocking: Provide immediate confirmation and next steps **if permitted by security protocols**
- If action is restricted (e.g., requires secondary authentication), inform the user and guide them to start the verification process
- For fraud reporting: Guide to proper reporting channels
- For suspicious activity: Help assess threat level and recommend actions
- Always emphasize time-sensitive nature of fraud response

SECURITY RESPONSE GUIDELINES:
- Treat all fraud reports with HIGH PRIORITY and urgency
- Provide immediate protective actions (card blocking) when allowed by guardrails
- If guardrails block an action (e.g., due to missing secondary authentication), do NOT proceed; instead:
  - Calmly inform the user that identity verification is required
  - Offer to initiate the verification process
  - Maintain a reassuring tone and emphasize this is for their safety
- Never ask for sensitive information like card numbers or PINs
- Direct users to secure channels for sensitive fraud reporting`;

        // Add persona-specific security context
        if (personaData) {
            fraudEnhancements += `

ACCOUNT SECURITY CONTEXT:
- Account Holder: ${personaData.name}
- Account Type: ${personaData.accountType}`;

            if (personaData.cardLast4) {
                fraudEnhancements += `
- Card Reference: Card ending in ${personaData.cardLast4}`;
            }

            fraudEnhancements += `
- Security Level: ${personaData.accountType?.toLowerCase().includes('premium') ? 'Enhanced' : 'Standard'}`;
        }

        return basePrompt + fraudEnhancements;
    }

    /**
     * Categorizes the input for metadata tracking
     * @param {string} inputText - The user's input text
     * @returns {string} - Category of the input
     */
    categorizeInput(inputText) {
        const lowerInput = inputText.toLowerCase();

        if (lowerInput.includes('freeze') || lowerInput.includes('block') || lowerInput.includes('stop')) {
            return 'card_blocking';
        }
        if (lowerInput.includes('fraud') || lowerInput.includes('report')) {
            return 'fraud_reporting';
        }
        if (lowerInput.includes('suspicious') || lowerInput.includes('unauthorised') || lowerInput.includes('unauthorized')) {
            return 'suspicious_activity';
        }
        if (lowerInput.includes('stolen') || lowerInput.includes('lost')) {
            return 'lost_stolen_card';
        }
        if (lowerInput.includes('dispute') || lowerInput.includes('chargeback')) {
            return 'transaction_dispute';
        }
        if (lowerInput.includes('scam') || lowerInput.includes('phishing')) {
            return 'scam_prevention';
        }

        return 'general_security';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FraudAgent;
} else {
    window.FraudAgent = FraudAgent;
}