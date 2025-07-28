class SystemPromptsManager {
    constructor() {
        this.systemPrompts = {};
        this.initialized = false;
        
        // Initialize debug logger for this module
        this.debug = window.debugManager ? window.debugManager.createModuleLogger('SystemPromptsManager') : {
            log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}
        };
    }

    async init() {
        if (this.initialized) return;
        
        try {
            // Load system prompts from localStorage first (for custom modifications)
            const storedPrompts = localStorage.getItem('system_prompts');
            if (storedPrompts) {
                this.systemPrompts = JSON.parse(storedPrompts);
            }

            // Load default system prompts from JSON file (skip if file:// protocol to avoid CORS)
            const isFileProtocol = window.location.protocol === 'file:';
            
            if (!isFileProtocol) {
                try {
                    const response = await fetch('./system-prompts.json');
                    if (response.ok) {
                        const defaultPrompts = await response.json();
                        // Merge default prompts with stored ones (stored takes precedence)
                        this.systemPrompts = { ...defaultPrompts, ...this.systemPrompts };
                        this.debug.log('Loaded system prompts from JSON file');
                    } else {
                        this.debug.warn('Could not load system-prompts.json, using stored/default prompts only');
                    }
                } catch (fetchError) {
                    this.debug.warn('Could not load system-prompts.json:', fetchError.message);
                }
            } else {
                this.debug.log('File protocol detected, using default system prompts to avoid CORS issues');
            }

            // Ensure required properties exist
            this.ensureRequiredProperties();

            this.initialized = true;
            this.debug.log('SystemPromptsManager initialized');
        } catch (error) {
            this.debug.error('Error initializing SystemPromptsManager:', error);
            // Fallback to default structure
            this.setDefaults();
            this.initialized = true;
        }
    }

    ensureRequiredProperties() {
        if (!this.systemPrompts.basePersonality) {
            this.systemPrompts.basePersonality = "You are a helpful, professional, and friendly AI voice assistant.";
        }
        if (!this.systemPrompts.financialContext) {
            this.systemPrompts.financialContext = "Provide helpful financial information.";
        }
        if (!this.systemPrompts.responseInstructions) {
            this.systemPrompts.responseInstructions = "Keep responses conversational and concise.";
        }
        if (!this.systemPrompts.customPrompts) {
            this.systemPrompts.customPrompts = [];
        }
    }

    setDefaults() {
        this.systemPrompts = {
            basePersonality: "You are a helpful, professional, and friendly AI voice assistant for a UK financial services company. You should be empathetic, clear in your communication, and engaging in conversation. Speak in a conversational tone while being informative and helpful.",
            financialContext: "When handling financial services requests, be conversational and provide helpful information about UK banking practices.",
            responseInstructions: "Keep responses conversational and concise (suitable for voice). Use natural speech patterns and British English.",
            customPrompts: []
        };
    }

    getBasePersonality() {
        return this.systemPrompts.basePersonality;
    }

    getFinancialContext() {
        return this.systemPrompts.financialContext;
    }

    getResponseInstructions() {
        return this.systemPrompts.responseInstructions;
    }

    getCustomPrompts() {
        return this.systemPrompts.customPrompts || [];
    }

    getAllPrompts() {
        return this.systemPrompts;
    }

    updateBasePersonality(personality) {
        this.systemPrompts.basePersonality = personality;
        this.saveToLocalStorage();
    }

    updateFinancialContext(context) {
        this.systemPrompts.financialContext = context;
        this.saveToLocalStorage();
    }

    updateResponseInstructions(instructions) {
        this.systemPrompts.responseInstructions = instructions;
        this.saveToLocalStorage();
    }

    updateCustomPrompts(customPrompts) {
        this.systemPrompts.customPrompts = customPrompts;
        this.saveToLocalStorage();
    }

    addCustomPrompt(name, prompt) {
        if (!this.systemPrompts.customPrompts) {
            this.systemPrompts.customPrompts = [];
        }
        
        this.systemPrompts.customPrompts.push({
            name: name,
            prompt: prompt,
            id: Date.now() + Math.random() // Simple unique ID
        });
        
        this.saveToLocalStorage();
    }

    removeCustomPrompt(promptId) {
        if (!this.systemPrompts.customPrompts) return false;
        
        const index = this.systemPrompts.customPrompts.findIndex(p => p.id === promptId);
        if (index === -1) return false;
        
        this.systemPrompts.customPrompts.splice(index, 1);
        this.saveToLocalStorage();
        return true;
    }

    updateCustomPrompt(promptId, name, prompt) {
        if (!this.systemPrompts.customPrompts) return false;
        
        const customPrompt = this.systemPrompts.customPrompts.find(p => p.id === promptId);
        if (!customPrompt) return false;
        
        customPrompt.name = name;
        customPrompt.prompt = prompt;
        this.saveToLocalStorage();
        return true;
    }

    saveToLocalStorage() {
        localStorage.setItem('system_prompts', JSON.stringify(this.systemPrompts));
    }

    resetToDefaults() {
        try {
            // Check if we're on file:// protocol to avoid CORS errors
            const isFileProtocol = window.location.protocol === 'file:';
            
            if (!isFileProtocol) {
                // Load fresh defaults from JSON file
                return fetch('./system-prompts.json')
                    .then(response => response.json())
                    .then(defaultPrompts => {
                        this.systemPrompts = defaultPrompts;
                        this.saveToLocalStorage();
                        return true;
                    })
                    .catch(error => {
                        this.debug.error('Error loading defaults:', error);
                        this.setDefaults();
                        this.saveToLocalStorage();
                        return true;
                    });
            } else {
                // Use embedded defaults for file:// protocol
                this.debug.log('File protocol detected, using embedded defaults');
                this.setDefaults();
                this.saveToLocalStorage();
                return Promise.resolve(true);
            }
        } catch (error) {
            this.debug.error('Error resetting to defaults:', error);
            this.setDefaults();
            this.saveToLocalStorage();
            return Promise.resolve(true);
        }
    }

    // Generate the complete system prompt for AI interactions
    generateSystemPrompt(personaData, userMessage) {
        let systemPrompt = this.systemPrompts.basePersonality + '\n\n';
        systemPrompt += this.systemPrompts.financialContext + '\n\n';
        systemPrompt += this.systemPrompts.responseInstructions + '\n\n';

        // Add persona context if provided
        if (personaData) {
            systemPrompt += `Customer Information:
- Name: ${personaData.name}
- Account Type: ${personaData.accountType}
- Current Balance: ${this.formatCurrency ? this.formatCurrency(personaData.balance) : '£' + personaData.balance.toFixed(2)}
- Card Last 4 Digits: ${personaData.cardLast4}`;

            // Add recent transactions if available
            if (personaData.recentTransactions && personaData.recentTransactions.length > 0) {
                systemPrompt += '\n- Recent Transactions:\n';
                personaData.recentTransactions.slice(0, 3).forEach(tx => {
                    const amount = this.formatCurrency ? this.formatCurrency(tx.amount) : '£' + tx.amount.toFixed(2);
                    systemPrompt += `  ${tx.date}: ${amount} - ${tx.description}\n`;
                });
            }
        } else {
            systemPrompt += 'Customer Information: No customer data available';
        }

        // Add custom prompts if any
        if (this.systemPrompts.customPrompts && this.systemPrompts.customPrompts.length > 0) {
            systemPrompt += '\n\nAdditional Instructions:\n';
            this.systemPrompts.customPrompts.forEach(customPrompt => {
                systemPrompt += `- ${customPrompt.name}: ${customPrompt.prompt}\n`;
            });
        }

        return systemPrompt;
    }

    // Set currency formatter (to be injected from PersonaManager)
    setCurrencyFormatter(formatFunction) {
        this.formatCurrency = formatFunction;
    }
}

// Export to global scope for browser usage
if (typeof window !== 'undefined') {
    window.SystemPromptsManager = SystemPromptsManager;
}