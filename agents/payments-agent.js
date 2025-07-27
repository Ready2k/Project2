/**
 * PaymentsAgent - Payment Processing Agent
 * Handles money transfers, payment requests, and secure transaction processing
 */
class PaymentsAgent extends BaseAgent {
    constructor() {
        super(
            'PaymentsAgent',
            'Handles money transfers, payment requests, and secure transaction processing'
        );
        
        // Keywords that trigger this agent
        this.paymentKeywords = [
            'send', 'transfer', 'pay', 'payment', 'money',
            'send money', 'transfer money', 'make payment',
            'pay someone', 'send to', 'transfer to',
            'wire', 'remit', 'remittance'
        ];
        
        // Amount pattern keywords
        this.amountKeywords = [
            '£', '$', '€', 'pounds', 'dollars', 'euros',
            'amount', 'sum', 'total'
        ];
        
        // Recipient pattern keywords
        this.recipientKeywords = [
            'to', 'for', 'recipient', 'beneficiary',
            'account', 'person', 'contact'
        ];
        
        this.debug.info('PaymentsAgent initialized with keywords', { 
            paymentKeywords: this.paymentKeywords,
            amountKeywords: this.amountKeywords,
            recipientKeywords: this.recipientKeywords
        });
    }
    
    /**
     * Determines if this agent can handle the given input
     * @param {string} inputText - The user's input text
     * @returns {boolean} - True if input contains payment or transfer keywords
     */
    canHandle(inputText) {
        if (!inputText || typeof inputText !== 'string') {
            return false;
        }
        
        const lowerInput = inputText.toLowerCase();
        
        // Check for exact phrase matches first (higher priority)
        const exactPhrases = [
            'send money', 'transfer money', 'make payment', 'send £', 'send $',
            'transfer £', 'transfer $', 'pay £', 'pay $', 'send to',
            'transfer to', 'pay someone', 'make transfer', 'wire money'
        ];
        
        for (const phrase of exactPhrases) {
            if (lowerInput.includes(phrase)) {
                this.debug.info('PaymentsAgent can handle input - exact phrase match', { 
                    phrase, 
                    inputText: inputText.substring(0, 50) + '...' 
                });
                return true;
            }
        }
        
        // Check for payment keywords combined with amount indicators
        const hasPaymentKeyword = this.paymentKeywords.some(keyword => 
            lowerInput.includes(keyword.toLowerCase())
        );
        
        const hasAmountIndicator = this.amountKeywords.some(keyword => 
            lowerInput.includes(keyword.toLowerCase())
        ) || /\d+/.test(lowerInput); // Contains numbers
        
        // High confidence if both payment and amount keywords are present
        if (hasPaymentKeyword && hasAmountIndicator) {
            this.debug.info('PaymentsAgent can handle input - payment + amount match', { 
                inputText: inputText.substring(0, 50) + '...' 
            });
            return true;
        }
        
        // Check for standalone payment keywords that are transaction-related
        const transactionKeywords = [
            'send money', 'transfer money', 'make payment', 'wire money',
            'remit', 'remittance'
        ];
        
        const hasTransactionKeyword = transactionKeywords.some(keyword => 
            lowerInput.includes(keyword.toLowerCase())
        );
        
        if (hasTransactionKeyword) {
            this.debug.info('PaymentsAgent can handle input - transaction keyword match', { 
                inputText: inputText.substring(0, 50) + '...' 
            });
        }
        
        return hasTransactionKeyword;
    }
    
    /**
     * Handles payment and transfer requests with highest security validation
     * @param {string} inputText - The user's input text
     * @param {Object} context - Context object containing app dependencies
     * @returns {Promise<Object>} - Agent response object
     */
    async handle(inputText, context) {
        const startTime = Date.now();
        
        try {
            // Validate required context dependencies
            this.validateContext(context);
            
            this.debug.info('PaymentsAgent processing request with highest security validation', { 
                inputText: inputText.substring(0, 100) + '...' 
            });
            
            // Validate data access permissions for payment processing (highest security)
            this.validateDataAccess(['payments', 'transfers', 'payment_history']);
            
            // Validate guardrails for payment processing actions
            this.validateGuardrails('initiateTransfer', { 
                action: 'payment_processing',
                requiresSecondaryAuth: true 
            });
            
            // Get current persona data for account validation
            const personaData = this.getPersonaData(context);
            if (!personaData) {
                throw new Error('No persona data available for payment processing');
            }
            
            // Validate transaction security requirements
            this.validateTransactionSecurity(inputText, personaData);
            
            // Extract and validate transaction amount against guardrails
            const amountMatch = inputText.match(/£(\d+(?:\.\d{2})?)/);
            if (amountMatch) {
                const requestedAmount = parseFloat(amountMatch[1]);
                this.validateTransactionAmount(requestedAmount);
            }
            
            // Generate domain-specific system prompt with security context
            const systemPrompt = this.generateSystemPrompt(context, inputText, personaData);
            
            // Prepare the request for the LLM using sandboxed API client
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: inputText }
            ];
            
            // Call the LLM API through sandboxed client with highest security settings
            const apiResponse = await this.sandboxedApiClient.generateChatCompletion(messages, {
                model: 'gpt-3.5-turbo',
                maxTokens: 800,
                temperature: 0.1 // Very low temperature for consistent security responses
            });
            
            if (!apiResponse || !apiResponse.choices || !apiResponse.choices.length) {
                throw new Error("No response from LLM");
              }
              
              const content = apiResponse.choices[0].message.content;
              
              return {
                success: true,
                response: content,
                agentName: "PaymentsAgent",
                tokensUsed: apiResponse.usage?.total_tokens || 0,
                processingTime: Date.now() - startTime,
              };
            
            // Demonstrate secure domain API access for payment processing with guardrails
            try {
                const paymentData = await this.secureDataAccess(['payments', 'transfers']);
                this.debug.info('PaymentsAgent accessed payment data securely', {
                    dataTypes: ['payments', 'transfers']
                });
                
                // Test guardrails enforcement for payment capabilities
                if (!this.isCapabilityAllowed('canInitiateTransactions')) {
                    throw new Error('Transaction initiation not allowed by guardrails');
                }
                
                // Test secure API call for payment processing with guardrails validation
                const paymentResult = await this.secureApiCall('process_payment', { 
                    amount: 100, 
                    recipient: 'test_recipient' 
                });
                this.debug.info('PaymentsAgent performed secure payment processing with guardrails', {
                    result: paymentResult
                });
                
                // Test guardrails enforcement for secondary auth requirement
                if (this.requiresSecondaryAuth('initiateTransfer')) {
                    this.debug.info('Guardrails correctly require secondary auth for transfers');
                }
            } catch (securityError) {
                this.debug.warn('PaymentsAgent security/guardrails validation working correctly', {
                    error: securityError.message
                });
            }
            
            // Test that agent cannot access restricted data (highest security validation)
            try {
                await this.secureDataAccess(['identity_verification', 'fraud_actions']);
                this.debug.error('Security violation: PaymentsAgent accessed restricted data');
            } catch (securityError) {
                this.debug.info('Security working: PaymentsAgent correctly blocked from restricted data', {
                    restrictedData: ['identity_verification', 'fraud_actions']
                });
            }
            
            // Test that agent cannot make restricted API calls
            try {
                await this.secureApiCall('verify_identity');
                this.debug.error('Security violation: PaymentsAgent made restricted API call');
            } catch (securityError) {
                this.debug.info('Security working: PaymentsAgent correctly blocked from restricted API calls', {
                    restrictedApiCall: 'verify_identity'
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
            
            this.debug.info('PaymentsAgent successfully processed request with highest security', {
                processingTime,
                tokensUsed,
                responseLength: response.length,
                personaUsed: personaData.name,
                securityLevel: 'highest'
            });
            
            return this.createResponse(
                true,
                response,
                processingTime,
                tokensUsed,
                null,
                {
                    agentType: 'payment_processing',
                    personaUsed: personaData.name,
                    accountType: personaData.accountType,
                    inputCategory: this.categorizeInput(inputText),
                    securityLevel: 'highest',
                    transactionValidated: true,
                    securityValidated: true
                }
            );
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            
            this.debug.error('PaymentsAgent failed to process request', {
                error: error.message,
                processingTime,
                inputText: inputText.substring(0, 50) + '...',
                securityLevel: 'highest'
            });
            
            return this.createResponse(
                false,
                'I apologize, but I encountered an issue while processing your payment request. For security reasons, please contact our support team or visit your nearest branch to complete this transaction.',
                processingTime,
                0,
                error.message,
                {
                    agentType: 'payment_processing',
                    errorType: error.name || 'UnknownError',
                    securityLevel: 'highest',
                    securityError: error.message.includes('access') || error.message.includes('permission')
                }
            );
        }
    }
    
    /**
     * Validates transaction security requirements with highest security level
     * @param {string} inputText - The user's input text
     * @param {Object} personaData - Current persona's account data
     * @throws {Error} - If security validation fails
     */
    validateTransactionSecurity(inputText, personaData) {
        // Validate account has sufficient balance for potential transactions
        if (!personaData.balance || personaData.balance <= 0) {
            this.debug.warn('PaymentsAgent rejecting request - insufficient balance', {
                balance: personaData.balance
            });
            throw new Error('Insufficient account balance for payment processing');
        }
        
        // Extract potential amount from input for validation
        const amountMatch = inputText.match(/£(\d+(?:\.\d{2})?)/);
        if (amountMatch) {
            const requestedAmount = parseFloat(amountMatch[1]);
            if (requestedAmount > personaData.balance) {
                this.debug.warn('PaymentsAgent rejecting request - amount exceeds balance', {
                    requestedAmount,
                    availableBalance: personaData.balance
                });
                throw new Error('Requested payment amount exceeds available balance');
            }
        }
        
        // Validate account is not frozen or restricted
        if (personaData.accountStatus && personaData.accountStatus !== 'active') {
            this.debug.warn('PaymentsAgent rejecting request - account not active', {
                accountStatus: personaData.accountStatus
            });
            throw new Error('Account is not active for payment processing');
        }
        
        this.debug.info('PaymentsAgent transaction security validation passed', {
            balance: personaData.balance,
            accountStatus: personaData.accountStatus || 'active'
        });
    }
    
    /**
     * Override system prompt components for payment processing context
     * @param {Object} context - Context object containing SystemPromptsManager
     * @param {Object} personaData - Current persona data
     * @returns {Object} - System prompt overrides
     */
    getSystemPromptOverrides(context, personaData) {
        return {
            basePersonality: "You are a highly secure, professional payment processing assistant. You prioritize security, accuracy, and clear communication in all financial transactions. You are thorough, careful, and always confirm details before processing.",
            financialContext: "When handling payment requests, apply the highest security standards. Always validate transaction details, confirm amounts, and ensure secure processing. Never process transactions without explicit confirmation.",
            responseInstructions: "Provide clear, step-by-step guidance for payment processing. Always confirm transaction details before proceeding. Be precise about amounts, fees, and processing times. Use secure language and maintain professional tone.",
            additionalInstructions: [
                "You are specialized in money transfers, payments, and secure transaction processing",
                "Apply HIGHEST SECURITY LEVEL to all payment requests",
                "ALWAYS validate transaction amounts against available balance",
                "NEVER process payments exceeding account balance",
                "ALWAYS require explicit confirmation for payment amounts and recipient details",
                "Provide transaction reference numbers and confirmations",
                "If asked about balances, fraud, or identity verification, redirect to appropriate agents"
            ]
        };
    }
    
    /**
     * Generate persona-specific behavior modifications for payment processing
     * @param {Object} personaData - Current persona data
     * @returns {string} - Payment-specific persona behavior modifications
     */
    generatePersonaBehaviorModifications(personaData) {
        let behaviorMods = super.generatePersonaBehaviorModifications(personaData);
        
        if (!personaData) {
            return behaviorMods;
        }
        
        behaviorMods += `\n\nPAYMENT PROCESSING PERSONA ADAPTATIONS:`;
        
        // Balance-based security adaptations
        if (typeof personaData.balance === 'number') {
            if (personaData.balance < 500) {
                behaviorMods += `\n- Low Balance Alert: Apply extra caution for transactions with limited available funds`;
            } else if (personaData.balance > 10000) {
                behaviorMods += `\n- High-Value Account: Apply enhanced security protocols for high-balance account transactions`;
            }
            
            // Set transaction limits based on balance
            const suggestedLimit = Math.min(personaData.balance * 0.8, 5000);
            behaviorMods += `\n- Transaction Limit Guidance: Suggest transactions under £${suggestedLimit.toFixed(2)} for safety`;
        }
        
        // Account type specific payment features
        if (personaData.accountType) {
            if (personaData.accountType.toLowerCase().includes('business')) {
                behaviorMods += `\n- Business Account: Offer business payment features like bulk transfers and invoice payments`;
            } else if (personaData.accountType.toLowerCase().includes('premium')) {
                behaviorMods += `\n- Premium Account: Provide enhanced payment services and priority processing`;
            }
        }
        
        // Recent transaction pattern analysis for security
        if (personaData.recentTransactions && personaData.recentTransactions.length > 0) {
            const recentOutgoing = personaData.recentTransactions
                .filter(tx => tx.amount < 0)
                .slice(0, 3);
            
            if (recentOutgoing.length > 0) {
                const avgAmount = recentOutgoing.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / recentOutgoing.length;
                behaviorMods += `\n- Transaction Pattern: Customer's recent average outgoing transaction is £${avgAmount.toFixed(2)}`;
            }
        }
        
        return behaviorMods;
    }
    
    /**
     * Supplement system prompt with payment-specific enhancements
     * @param {Object} context - Context object containing SystemPromptsManager
     * @param {string} basePrompt - The base system prompt
     * @param {Object} personaData - Current persona data
     * @returns {string} - Enhanced system prompt
     */
    supplementSystemPrompt(context, basePrompt, personaData) {
        if (!personaData) {
            return basePrompt;
        }
        
        // Format account information for the prompt
        const formattedBalance = context.personaManager.formatCurrency(personaData.balance);
        
        const paymentEnhancements = `

CURRENT ACCOUNT INFORMATION:
- Account Holder: ${personaData.name}
- Account Type: ${personaData.accountType}
- Available Balance: ${formattedBalance}
- Card Last 4 Digits: ${personaData.cardLast4}
- Currency: ${personaData.currency || 'GBP'}

PAYMENT PROCESSING CAPABILITIES:
- Process money transfer requests with security validation
- Guide users through payment authorization steps
- Validate recipient information and transfer amounts
- Provide transaction confirmation and reference numbers
- Handle payment scheduling and recurring transfer setup
- Assist with international transfer requirements

SECURITY REQUIREMENTS (HIGHEST LEVEL):
- ALWAYS validate transaction amounts against available balance (${formattedBalance})
- NEVER process payments exceeding account balance
- ALWAYS require explicit confirmation for payment amounts
- ALWAYS provide clear transaction summaries before processing
- NEVER store or log sensitive payment details
- ALWAYS use secure channels for payment processing

TRANSACTION VALIDATION CHECKLIST:
- Verify recipient details are complete and accurate
- Confirm payment amount is within available balance
- Check for any account restrictions or holds
- Validate payment method and authorization
- Ensure compliance with transfer limits and regulations`;

        return basePrompt + paymentEnhancements;
    }
    
    /**
     * Categorizes the input for metadata tracking
     * @param {string} inputText - The user's input text
     * @returns {string} - Category of the input
     */
    categorizeInput(inputText) {
        const lowerInput = inputText.toLowerCase();
        
        if (lowerInput.includes('send') && (lowerInput.includes('£') || lowerInput.includes('$'))) {
            return 'money_transfer';
        }
        if (lowerInput.includes('transfer') && (lowerInput.includes('£') || lowerInput.includes('$'))) {
            return 'account_transfer';
        }
        if (lowerInput.includes('pay') && (lowerInput.includes('£') || lowerInput.includes('$'))) {
            return 'payment_processing';
        }
        if (lowerInput.includes('wire') || lowerInput.includes('remit')) {
            return 'wire_transfer';
        }
        if (lowerInput.includes('international') || lowerInput.includes('overseas')) {
            return 'international_transfer';
        }
        if (lowerInput.includes('recurring') || lowerInput.includes('schedule')) {
            return 'scheduled_payment';
        }
        
        return 'general_payment';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentsAgent;
} else {
    window.PaymentsAgent = PaymentsAgent;
}