/**
 * BankingInfoAgent - Banking Information Agent
 * Handles account balance inquiries, transaction history, and account information requests
 */
class BankingInfoAgent extends BaseAgent {
    constructor() {
        super(
            'BankingInfoAgent',
            'Handles account balance inquiries, transaction history, and account information requests'
        );
        
        // Keywords that trigger this agent
        this.bankingKeywords = [
            'balance', 'account balance', 'how much', 'money',
            'transaction', 'transactions', 'transaction history', 'recent transactions',
            'statement', 'account statement', 'bank statement',
            'account details', 'account info', 'account information',
            'spending', 'spent', 'purchases', 'payments made',
            'deposits', 'income', 'salary', 'credits',
            'account summary', 'financial summary'
        ];
        
        this.debug.info('BankingInfoAgent initialized with keywords', { keywords: this.bankingKeywords });
    }
    
    /**
     * Determines if this agent can handle the given input
     * @param {string} inputText - The user's input text
     * @returns {boolean} - True if input contains banking information keywords
     */
    canHandle(inputText) {
        if (!inputText || typeof inputText !== 'string') {
            return false;
        }
        
        const lowerInput = inputText.toLowerCase();
        
        // Check for exact phrase matches first (higher priority)
        const exactPhrases = [
            'account balance', 'check balance', 'what\'s my balance', 'how much money',
            'transaction history', 'recent transactions', 'account statement',
            'account details', 'account information', 'account summary'
        ];
        
        for (const phrase of exactPhrases) {
            if (lowerInput.includes(phrase)) {
                this.debug.info('BankingInfoAgent can handle input - exact phrase match', { 
                    phrase, 
                    inputText: inputText.substring(0, 50) + '...' 
                });
                return true;
            }
        }
        
        // Check for individual keyword matches
        const hasKeyword = this.bankingKeywords.some(keyword => 
            lowerInput.includes(keyword.toLowerCase())
        );
        
        if (hasKeyword) {
            this.debug.info('BankingInfoAgent can handle input - keyword match', { 
                inputText: inputText.substring(0, 50) + '...' 
            });
        }
        
        return hasKeyword;
    }
    
    /**
     * Handles banking information requests with security validation and persona data integration
     * @param {string} inputText - The user's input text
     * @param {Object} context - Context object containing app dependencies
     * @returns {Promise<Object>} - Agent response object
     */
    async handle(inputText, context) {
        const startTime = Date.now();
        
        try {
            // Validate required context dependencies
            this.validateContext(context);
            
            this.debug.info('BankingInfoAgent processing request with security validation', { 
                inputText: inputText.substring(0, 100) + '...' 
            });
            
            // Validate data access permissions for banking information
            this.validateDataAccess(['balance', 'transactions', 'account_info']);
            
            // Get current persona data for account information
            const personaData = this.getPersonaData(context);
            if (!personaData) {
                throw new Error('No persona data available for banking information');
            }
            
            // Validate read-only data access
            this.validateReadOnlyAccess(inputText);
            
            // Generate domain-specific system prompt with account context
            const systemPrompt = this.generateSystemPrompt(context, inputText, personaData);
            
            // Prepare the request for the LLM using sandboxed API client
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: inputText }
            ];
            
            // Call the LLM API through sandboxed client
            const apiResponse = await this.sandboxedApiClient.generateChatCompletion(messages, {
                model: 'gpt-3.5-turbo',
                maxTokens: 600,
                temperature: 0.3 // Lower temperature for more consistent financial information
            });
            
            if (!apiResponse.success) {
                throw new Error(apiResponse.error);
            }
            
            // Demonstrate secure domain API access for banking data
            try {
                const bankingData = await this.secureDataAccess(['balance', 'transactions']);
                this.debug.info('BankingInfoAgent accessed banking data securely', {
                    dataTypes: ['balance', 'transactions']
                });
            } catch (securityError) {
                this.debug.warn('BankingInfoAgent security validation working correctly', {
                    error: securityError.message
                });
            }
            
            // Test that agent cannot access restricted data
            try {
                await this.secureDataAccess(['payments', 'fraud_actions']);
                this.debug.error('Security violation: BankingInfoAgent accessed restricted data');
            } catch (securityError) {
                this.debug.info('Security working: BankingInfoAgent correctly blocked from restricted data', {
                    restrictedData: ['payments', 'fraud_actions']
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
            
            this.debug.info('BankingInfoAgent successfully processed request with security', {
                processingTime,
                tokensUsed,
                responseLength: response.length,
                personaUsed: personaData.name
            });
            
            return this.createResponse(
                true,
                response,
                processingTime,
                tokensUsed,
                null,
                {
                    agentType: 'banking_information',
                    personaUsed: personaData.name,
                    accountType: personaData.accountType,
                    inputCategory: this.categorizeInput(inputText),
                    dataAccess: 'read_only',
                    securityValidated: true
                }
            );
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            
            this.debug.error('BankingInfoAgent failed to process request', {
                error: error.message,
                processingTime,
                inputText: inputText.substring(0, 50) + '...'
            });
            
            return this.createResponse(
                false,
                'I apologize, but I encountered an issue while retrieving your banking information. Please try again or contact support if the problem persists.',
                processingTime,
                0,
                error.message,
                {
                    agentType: 'banking_information',
                    errorType: error.name || 'UnknownError',
                    securityError: error.message.includes('access') || error.message.includes('permission')
                }
            );
        }
    }
    
    /**
     * Validates that the request is for read-only data access only
     * @param {string} inputText - The user's input text
     * @throws {Error} - If request contains transaction or modification keywords
     */
    validateReadOnlyAccess(inputText) {
        const lowerInput = inputText.toLowerCase();
        
        // Keywords that indicate write operations (not allowed for this agent)
        const writeOperationKeywords = [
            'transfer', 'send', 'pay', 'payment', 'move money',
            'withdraw', 'deposit', 'block', 'freeze', 'cancel',
            'change', 'update', 'modify', 'delete', 'remove'
        ];
        
        const hasWriteOperation = writeOperationKeywords.some(keyword => 
            lowerInput.includes(keyword)
        );
        
        if (hasWriteOperation) {
            this.debug.warn('BankingInfoAgent rejecting request - write operation detected', {
                inputText: inputText.substring(0, 50) + '...'
            });
            throw new Error('Banking Information Agent can only provide read-only access to account data');
        }
    }
    
    /**
     * Override system prompt components for banking information context
     * @param {Object} context - Context object containing SystemPromptsManager
     * @param {Object} personaData - Current persona data
     * @returns {Object} - System prompt overrides
     */
    getSystemPromptOverrides(context, personaData) {
        return {
            basePersonality: null, // Use default
            financialContext: "When providing banking information, be accurate, helpful, and informative. Focus on read-only account data and transaction history. Always use the customer's actual account information.",
            responseInstructions: "Present financial information clearly and accurately. Format currency amounts properly. Provide helpful context about transactions and account activity. Keep responses informative but concise.",
            additionalInstructions: [
                "You are specialized in providing account balance, transaction history, and account information",
                "You can ONLY provide READ-ONLY access to banking information",
                "You CANNOT perform transactions, transfers, payments, or account modifications",
                "Always use the customer's actual account data when responding",
                "Format currency amounts clearly using GBP (£) symbol",
                "If asked about payments, transfers, or account modifications, redirect to appropriate services"
            ]
        };
    }
    
    /**
     * Generate persona-specific behavior modifications for banking information
     * @param {Object} personaData - Current persona data
     * @returns {string} - Banking-specific persona behavior modifications
     */
    generatePersonaBehaviorModifications(personaData) {
        let behaviorMods = super.generatePersonaBehaviorModifications(personaData);
        
        if (!personaData) {
            return behaviorMods;
        }
        
        behaviorMods += `\n\nBANKING INFO PERSONA ADAPTATIONS:`;
        
        // Transaction pattern analysis
        if (personaData.recentTransactions && personaData.recentTransactions.length > 0) {
            const totalSpending = personaData.recentTransactions
                .filter(tx => tx.amount < 0)
                .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
            
            const totalIncome = personaData.recentTransactions
                .filter(tx => tx.amount > 0)
                .reduce((sum, tx) => sum + tx.amount, 0);
            
            if (totalSpending > totalIncome) {
                behaviorMods += `\n- Spending Pattern: Customer has higher outgoing than incoming transactions recently`;
            }
            
            // Identify frequent transaction types
            const merchantTypes = personaData.recentTransactions.map(tx => {
                const desc = tx.description.toLowerCase();
                if (desc.includes('grocery') || desc.includes('supermarket')) return 'grocery';
                if (desc.includes('restaurant') || desc.includes('cafe')) return 'dining';
                if (desc.includes('fuel') || desc.includes('petrol')) return 'fuel';
                if (desc.includes('salary') || desc.includes('wage')) return 'income';
                return 'other';
            });
            
            const frequentType = merchantTypes.reduce((a, b, i, arr) => 
                arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
            );
            
            if (frequentType !== 'other') {
                behaviorMods += `\n- Transaction Context: Customer frequently uses account for ${frequentType} transactions`;
            }
        }
        
        // Account usage patterns
        if (personaData.accountType) {
            if (personaData.accountType.toLowerCase().includes('savings')) {
                behaviorMods += `\n- Account Focus: Emphasize savings growth and interest when discussing balance`;
            } else if (personaData.accountType.toLowerCase().includes('current')) {
                behaviorMods += `\n- Account Focus: Focus on transaction history and spending patterns for current account`;
            }
        }
        
        return behaviorMods;
    }
    
    /**
     * Supplement system prompt with banking-specific enhancements
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
        const recentTransactions = personaData.recentTransactions || [];
        const transactionSummary = recentTransactions.slice(0, 5).map(tx => 
            `${tx.date}: ${context.personaManager.formatCurrency(tx.amount)} - ${tx.description}`
        ).join('\n');
        
        const bankingEnhancements = `

CURRENT ACCOUNT INFORMATION:
- Account Holder: ${personaData.name}
- Account Type: ${personaData.accountType}
- Current Balance: ${formattedBalance}
- Card Last 4 Digits: ${personaData.cardLast4}
- Currency: ${personaData.currency || 'GBP'}

RECENT TRANSACTIONS:
${transactionSummary}

BANKING INFORMATION CAPABILITIES:
- Provide current account balance information
- Show recent transaction history and details
- Explain account types and features
- Summarize spending patterns and account activity
- Answer questions about specific transactions
- Provide account statements and summaries

RESPONSE GUIDELINES:
- Always use the current persona's actual account data provided above
- Format currency amounts clearly using GBP (£) symbol
- Present transaction information in a clear, chronological format
- Be helpful and informative about account details
- Provide context about spending patterns when relevant`;

        return basePrompt + bankingEnhancements;
    }
    
    /**
     * Categorizes the input for metadata tracking
     * @param {string} inputText - The user's input text
     * @returns {string} - Category of the input
     */
    categorizeInput(inputText) {
        const lowerInput = inputText.toLowerCase();
        
        if (lowerInput.includes('balance') || lowerInput.includes('how much')) {
            return 'balance_inquiry';
        }
        if (lowerInput.includes('transaction') || lowerInput.includes('history')) {
            return 'transaction_history';
        }
        if (lowerInput.includes('statement')) {
            return 'account_statement';
        }
        if (lowerInput.includes('account details') || lowerInput.includes('account info')) {
            return 'account_information';
        }
        if (lowerInput.includes('spending') || lowerInput.includes('spent')) {
            return 'spending_analysis';
        }
        
        return 'general_banking_info';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BankingInfoAgent;
} else {
    window.BankingInfoAgent = BankingInfoAgent;
}