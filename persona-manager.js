class PersonaManager {
    constructor() {
        this.personas = {};
        this.currentPersona = 'john_doe';
        this.initialized = false;
        
        // Initialize debug logger for this module
        this.debug = window.debugManager ? window.debugManager.createModuleLogger('PersonaManager') : {
            log: () => {}, warn: () => {}, error: () => {}, info: () => {}
        };
    }

    async init() {
        if (this.initialized) return;
        
        try {
            this.debug.log('PersonaManager initialization starting...');
            
            // Load personas from localStorage first (for custom personas)
            const storedPersonas = localStorage.getItem('personas');
            if (storedPersonas) {
                this.personas = JSON.parse(storedPersonas);
                this.debug.log('Loaded personas from localStorage:', Object.keys(this.personas));
            } else {
                this.debug.log('No personas found in localStorage');
            }

            // Load default personas from JSON file
            this.debug.log('Attempting to fetch personas.json...');
            const response = await fetch('./personas.json');
            this.debug.log('Fetch response status:', response.status, response.statusText);
            
            if (response.ok) {
                const defaultPersonas = await response.json();
                this.debug.log('Loaded default personas from JSON:', Object.keys(defaultPersonas));
                // Merge default personas with stored ones (stored takes precedence)
                this.personas = { ...defaultPersonas, ...this.personas };
            } else {
                this.debug.warn('Could not load personas.json, response not ok:', response.status, response.statusText);
                this.debug.warn('Using stored personas only');
            }

            this.initialized = true;
            const personaCount = Object.keys(this.personas).length;
            this.debug.log('PersonaManager initialized with', personaCount, 'personas:', Object.keys(this.personas));
            
            if (personaCount === 0) {
                this.debug.error('No personas loaded! This will cause issues.');
                // Add a fallback persona to prevent complete failure
                this.personas = {
                    'fallback_user': {
                        name: 'Test User',
                        balance: 1000.00,
                        cardLast4: '0000',
                        accountType: 'Current Account',
                        currency: 'GBP',
                        recentTransactions: [
                            { date: '2025-01-15', amount: -50.00, description: 'Test Transaction' }
                        ]
                    }
                };
                this.debug.log('Added fallback persona');
            }
            
        } catch (error) {
            this.debug.error('Error initializing PersonaManager:', error);
            // Fallback to a basic persona object
            this.personas = {
                'fallback_user': {
                    name: 'Test User',
                    balance: 1000.00,
                    cardLast4: '0000',
                    accountType: 'Current Account',
                    currency: 'GBP',
                    recentTransactions: [
                        { date: '2025-01-15', amount: -50.00, description: 'Test Transaction' }
                    ]
                }
            };
            this.initialized = true;
            this.debug.log('Used fallback persona due to error');
        }
    }

    getPersona(personaId) {
        return this.personas[personaId] || this.personas['john_doe'] || null;
    }

    getAllPersonas() {
        return this.personas;
    }

    addPersona(personaId, personaData) {
        this.personas[personaId] = personaData;
        this.saveToLocalStorage();
    }

    deletePersona(personaId) {
        if (this.personas[personaId]) {
            delete this.personas[personaId];
            this.saveToLocalStorage();
            return true;
        }
        return false;
    }

    updatePersona(personaId, personaData) {
        if (this.personas[personaId]) {
            this.personas[personaId] = { ...this.personas[personaId], ...personaData };
            this.saveToLocalStorage();
            return true;
        }
        return false;
    }

    saveToLocalStorage() {
        localStorage.setItem('personas', JSON.stringify(this.personas));
    }

    setCurrentPersona(personaId) {
        if (this.personas[personaId]) {
            this.currentPersona = personaId;
            return true;
        }
        return false;
    }

    getCurrentPersona() {
        return this.currentPersona;
    }

    getCurrentPersonaData() {
        return this.getPersona(this.currentPersona);
    }

    getPersonaIds() {
        return Object.keys(this.personas);
    }

    personaExists(personaId) {
        return !!this.personas[personaId];
    }

    // Generate a unique ID for new personas
    generatePersonaId(name) {
        const baseId = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        let id = baseId;
        let counter = 1;
        
        while (this.personas[id]) {
            id = `${baseId}_${counter}`;
            counter++;
        }
        
        return id;
    }

    // Transaction management methods
    addTransaction(personaId, transaction) {
        const persona = this.personas[personaId];
        if (!persona) return false;

        // Ensure transaction has required fields
        const newTransaction = {
            date: transaction.date || new Date().toISOString().split('T')[0],
            amount: parseFloat(transaction.amount) || 0,
            description: transaction.description || 'Transaction',
            id: Date.now() + Math.random() // Simple unique ID
        };

        // Initialize transactions array if it doesn't exist
        if (!persona.recentTransactions) {
            persona.recentTransactions = [];
        }

        // Add transaction to the beginning (most recent first)
        persona.recentTransactions.unshift(newTransaction);

        // Update balance
        persona.balance += newTransaction.amount;

        // Keep only the most recent 10 transactions
        if (persona.recentTransactions.length > 10) {
            persona.recentTransactions = persona.recentTransactions.slice(0, 10);
        }

        this.saveToLocalStorage();
        return true;
    }

    removeTransaction(personaId, transactionId) {
        const persona = this.personas[personaId];
        if (!persona || !persona.recentTransactions) return false;

        const transactionIndex = persona.recentTransactions.findIndex(tx => tx.id === transactionId);
        if (transactionIndex === -1) return false;

        const removedTransaction = persona.recentTransactions[transactionIndex];
        
        // Remove transaction
        persona.recentTransactions.splice(transactionIndex, 1);
        
        // Adjust balance
        persona.balance -= removedTransaction.amount;

        this.saveToLocalStorage();
        return true;
    }

    getTransactions(personaId, limit = 10) {
        const persona = this.personas[personaId];
        if (!persona || !persona.recentTransactions) return [];
        
        return persona.recentTransactions.slice(0, limit);
    }

    // Format currency for UK Sterling
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: 'GBP'
        }).format(amount);
    }

    // Get formatted balance for display
    getFormattedBalance(personaId) {
        const persona = this.personas[personaId];
        if (!persona) return '£0.00';
        
        return this.formatCurrency(persona.balance);
    }
}

// Export to global scope for browser usage
if (typeof window !== 'undefined') {
    window.PersonaManager = PersonaManager;
}