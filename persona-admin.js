// Enhanced Persona Administration with Transaction Management
class PersonaAdmin {
    constructor() {
        this.personaManager = null;
        this.currentEditingPersona = null;
        this.newPersonaTransactionCount = 0;
        this.editPersonaTransactionCount = 0;
        this.lastKnownPersonaData = null;
        
        // Initialize debug logger for this module
        this.debug = window.debugManager ? window.debugManager.createModuleLogger('PersonaAdmin') : {
            log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}
        };
    }

    async init() {
        this.debug.log('PersonaAdmin initialization starting...');
        
        // Wait for PersonaManager to be available
        if (window.PersonaManager) {
            this.personaManager = new window.PersonaManager();
            await this.personaManager.init();
        } else {
            this.debug.error('PersonaManager not available');
            return;
        }

        this.initializeEventListeners();
        this.loadPersonaList();
        this.initializePersonaSelector();
        this.setupWindowFocusRefresh();
        this.setupUpdateFlagChecker();
        
        this.debug.log('PersonaAdmin initialized successfully');
    }

    setupWindowFocusRefresh() {
        console.log('🔧 Setting up refresh listeners...');
        
        // Refresh persona list when window regains focus (e.g., when editor tab is closed)
        window.addEventListener('focus', async () => {
            console.log('👁️ Window regained focus, refreshing persona data...');
            this.debug.log('Window regained focus, refreshing persona data...');
            await this.refreshPersonaData();
        });
        
        // Additional visibility change listener for better reliability
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden) {
                console.log('👁️ Page became visible, refreshing persona data...');
                this.debug.log('Page became visible, refreshing persona data...');
                await this.refreshPersonaData();
            }
        });
    }

    setupUpdateFlagChecker() {
        // Check for update flag every 500ms
        let lastFlagValue = localStorage.getItem('personaUpdateFlag');
        
        setInterval(() => {
            const currentFlagValue = localStorage.getItem('personaUpdateFlag');
            if (currentFlagValue && currentFlagValue !== lastFlagValue) {
                console.log('🚩 Detected persona update flag, refreshing...');
                this.refreshPersonaData();
                lastFlagValue = currentFlagValue;
            }
        }, 500);
    }

    initializeEventListeners() {
        // Add new persona form
        const personaForm = document.getElementById('personaForm');
        if (personaForm) {
            personaForm.addEventListener('submit', (e) => this.handleAddPersona(e));
        }

        // Add transaction button for new persona
        const addNewPersonaTransactionBtn = document.getElementById('addNewPersonaTransaction');
        if (addNewPersonaTransactionBtn) {
            addNewPersonaTransactionBtn.addEventListener('click', () => this.addNewPersonaTransaction());
        }

        // Edit persona form
        const editPersonaForm = document.getElementById('editPersonaForm');
        if (editPersonaForm) {
            editPersonaForm.addEventListener('submit', (e) => this.handleEditPersona(e));
        }

        // Add transaction button for edit persona
        const addEditPersonaTransactionBtn = document.getElementById('addEditPersonaTransaction');
        if (addEditPersonaTransactionBtn) {
            addEditPersonaTransactionBtn.addEventListener('click', () => this.addEditPersonaTransaction());
        }

        this.debug.log('Event listeners initialized');
    }

    async loadPersonaList() {
        console.log('📋 loadPersonaList called!');
        const personaList = document.getElementById('personaList');
        if (!personaList || !this.personaManager) {
            console.log('❌ personaList element or personaManager not found');
            return;
        }

        const personas = this.personaManager.getAllPersonas();
        console.log('📊 Found personas:', Object.keys(personas));
        personaList.innerHTML = '';

        Object.entries(personas).forEach(([id, persona]) => {
            const personaCard = this.createPersonaCard(id, persona);
            personaList.appendChild(personaCard);
        });

        // Track the current data for change detection
        this.lastKnownPersonaData = localStorage.getItem('personas');
        
        console.log('✅ Persona list loaded with', Object.keys(personas).length, 'personas');
        this.debug.log('Persona list loaded with', Object.keys(personas).length, 'personas');
    }

    createPersonaCard(id, persona) {
        const card = document.createElement('div');
        card.className = 'persona-card';
        
        // Get recent transactions for display
        const transactions = persona.recentTransactions || [];
        const recentTransactions = transactions.slice(0, 3);

        card.innerHTML = `
            <h5>${persona.name}</h5>
            <p><strong>Balance:</strong> ${this.personaManager.formatCurrency(persona.balance)}</p>
            <p><strong>Card:</strong> **** ${persona.cardLast4}</p>
            <p><strong>Account:</strong> ${persona.accountType}</p>
            
            ${recentTransactions.length > 0 ? `
                <div class="persona-transactions">
                    <h6>Recent Transactions (${transactions.length} total)</h6>
                    <div class="transaction-summary">
                        ${recentTransactions.map(tx => `
                            <div class="transaction-summary-item">
                                <span>${tx.description}</span>
                                <span class="transaction-summary-amount ${tx.amount >= 0 ? 'positive' : 'negative'}">
                                    ${this.personaManager.formatCurrency(tx.amount)}
                                </span>
                            </div>
                        `).join('')}
                        ${transactions.length > 3 ? `
                            <div class="transaction-summary-item">
                                <span><em>... and ${transactions.length - 3} more</em></span>
                                <span></span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
            
            <div class="persona-actions">
                <button class="edit-btn" onclick="personaAdmin.openEditPersonaModal('${id}')">
                    <i class="fas fa-edit"></i>
                    Edit
                </button>
                <button class="delete-btn" onclick="personaAdmin.deletePersona('${id}')">
                    <i class="fas fa-trash"></i>
                    Delete
                </button>
            </div>
        `;

        return card;
    }

    addNewPersonaTransaction() {
        const container = document.getElementById('newPersonaTransactions');
        if (!container) return;

        const transactionEntry = this.createTransactionEntry(`newPersona_${this.newPersonaTransactionCount}`);
        container.appendChild(transactionEntry);
        this.newPersonaTransactionCount++;

        this.debug.log('Added new persona transaction entry');
    }

    addEditPersonaTransaction() {
        const container = document.getElementById('editPersonaTransactions');
        if (!container) return;

        const transactionEntry = this.createTransactionEntry(`editPersona_${this.editPersonaTransactionCount}`, true);
        container.appendChild(transactionEntry);
        this.editPersonaTransactionCount++;

        this.debug.log('Added edit persona transaction entry');
    }

    createTransactionEntry(prefix, isEdit = false) {
        const entry = document.createElement('div');
        entry.className = isEdit ? 'transaction-item' : 'transaction-entry';
        
        entry.innerHTML = `
            <div>
                <label>Date:</label>
                <input type="date" name="${prefix}_date" value="${new Date().toISOString().split('T')[0]}" required>
            </div>
            <div>
                <label>Amount (£):</label>
                <input type="number" name="${prefix}_amount" step="0.01" placeholder="0.00" required>
            </div>
            <div>
                <label>Description:</label>
                <input type="text" name="${prefix}_description" placeholder="Transaction description" required>
            </div>
            <button type="button" class="remove-transaction-btn" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        return entry;
    }

    async handleAddPersona(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const name = formData.get('personaName');
        const balance = parseFloat(formData.get('personaBalance'));
        const cardLast4 = formData.get('personaCard');
        const accountType = formData.get('personaAccountType');

        // Collect transactions
        const transactions = this.collectTransactions('newPersona');

        // Generate persona ID
        const personaId = this.personaManager.generatePersonaId(name);

        // Create persona data
        const personaData = {
            name,
            balance,
            cardLast4,
            accountType,
            currency: 'GBP',
            recentTransactions: transactions
        };

        // Add persona
        this.personaManager.addPersona(personaId, personaData);

        // Reset form
        e.target.reset();
        document.getElementById('newPersonaTransactions').innerHTML = '';
        this.newPersonaTransactionCount = 0;

        // Reload persona list
        await this.loadPersonaList();

        // Update persona selector in main interface
        this.updatePersonaSelector();

        this.debug.log('Added new persona:', personaId, personaData);
        
        // Show success message
        this.showMessage('Persona added successfully!', 'success');
    }

    collectTransactions(prefix) {
        const transactions = [];
        const container = document.getElementById(prefix === 'newPersona' ? 'newPersonaTransactions' : 'editPersonaTransactions');
        
        if (!container) return transactions;

        const entries = container.querySelectorAll(prefix === 'newPersona' ? '.transaction-entry' : '.transaction-item');
        
        entries.forEach(entry => {
            const dateInput = entry.querySelector(`input[name*="_date"]`);
            const amountInput = entry.querySelector(`input[name*="_amount"]`);
            const descriptionInput = entry.querySelector(`input[name*="_description"]`);

            if (dateInput && amountInput && descriptionInput) {
                const date = dateInput.value;
                const amount = parseFloat(amountInput.value);
                const description = descriptionInput.value;

                if (date && !isNaN(amount) && description) {
                    transactions.push({
                        date,
                        amount,
                        description,
                        id: Date.now() + Math.random()
                    });
                }
            }
        });

        // Sort by date (newest first)
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        return transactions;
    }

    openEditPersonaModal(personaId) {
        const persona = this.personaManager.getPersona(personaId);
        if (!persona) {
            this.debug.error('Persona not found:', personaId);
            return;
        }

        // Open persona editor in new tab
        const editorUrl = `persona-editor.html?personaId=${encodeURIComponent(personaId)}`;
        const editorWindow = window.open(editorUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
        
        if (!editorWindow) {
            // Fallback if popup was blocked
            this.showMessage('Please allow popups to open the persona editor, or open it manually.', 'error');
            // Provide a direct link as fallback
            const link = document.createElement('a');
            link.href = editorUrl;
            link.target = '_blank';
            link.textContent = 'Open Persona Editor';
            link.style.cssText = 'color: #667eea; text-decoration: underline; font-weight: 500;';
            
            const message = document.createElement('div');
            message.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                z-index: 10000;
                text-align: center;
            `;
            message.innerHTML = `
                <p>Popup blocked. Click the link below to open the persona editor:</p>
                <br>
            `;
            message.appendChild(link);
            
            document.body.appendChild(message);
            
            setTimeout(() => {
                if (message.parentNode) {
                    message.parentNode.removeChild(message);
                }
            }, 5000);
        } else {
            // Focus the new window
            editorWindow.focus();
        }

        this.debug.log('Opened persona editor for:', personaId);
        
        // Log user action
        if (window.systemLogger) {
            window.systemLogger.logUserAction('Opened persona editor', { 
                personaId: personaId,
                personaName: persona.name 
            });
        }
    }

    // Method to manually refresh persona data (can be called from editor)
    async refreshPersonaData() {
        console.log('🔄 refreshPersonaData called!');
        this.debug.log('Manually refreshing persona data...');
        
        // Force PersonaManager to reload from localStorage
        if (this.personaManager && typeof this.personaManager.reloadPersonas === 'function') {
            console.log('🔄 Reloading personas from localStorage...');
            await this.personaManager.reloadPersonas();
        }
        
        this.loadPersonaList();
        this.updatePersonaSelector();
        console.log('✅ refreshPersonaData completed!');
    }

    // Modal functions removed - now using dedicated editor page

    // Edit persona functionality moved to dedicated editor page

    async deletePersona(personaId) {
        if (!confirm('Are you sure you want to delete this persona? This action cannot be undone.')) {
            return;
        }

        const success = this.personaManager.deletePersona(personaId);
        
        if (success) {
            await this.loadPersonaList();
            this.updatePersonaSelector();
            this.showMessage('Persona deleted successfully!', 'success');
            this.debug.log('Deleted persona:', personaId);
        } else {
            this.showMessage('Failed to delete persona!', 'error');
            this.debug.error('Failed to delete persona:', personaId);
        }
    }

    initializePersonaSelector() {
        const selector = document.getElementById('personaSelect');
        if (!selector || !this.personaManager) return;

        // Add change event listener
        selector.addEventListener('change', (e) => {
            const selectedPersonaId = e.target.value;
            if (selectedPersonaId && this.personaManager) {
                this.personaManager.setCurrentPersona(selectedPersonaId);
                this.debug.log('Selected persona:', selectedPersonaId);
                
                // Log user action
                if (window.systemLogger) {
                    window.systemLogger.logUserAction('Changed persona', { 
                        personaId: selectedPersonaId,
                        personaName: this.personaManager.getPersona(selectedPersonaId)?.name 
                    });
                }
            }
        });

        this.updatePersonaSelector();
        this.debug.log('Persona selector initialized');
    }

    updatePersonaSelector() {
        const selector = document.getElementById('personaSelect');
        if (!selector || !this.personaManager) return;

        const personas = this.personaManager.getAllPersonas();
        const currentValue = selector.value;

        selector.innerHTML = '<option value="">Select a persona...</option>';

        Object.entries(personas).forEach(([id, persona]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = persona.name;
            selector.appendChild(option);
        });

        // Restore previous selection if still valid
        if (currentValue && personas[currentValue]) {
            selector.value = currentValue;
        } else {
            // Set default persona if none selected
            const defaultPersona = Object.keys(personas)[0];
            if (defaultPersona) {
                selector.value = defaultPersona;
                this.personaManager.setCurrentPersona(defaultPersona);
            }
        }

        this.debug.log('Updated persona selector with', Object.keys(personas).length, 'personas');
    }

    showMessage(message, type = 'info') {
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
            color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'};
            border-radius: 6px;
            z-index: 10001;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        toast.textContent = message;

        document.body.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }
}

// Global functions for onclick handlers
// Make refresh method globally accessible for editor
window.refreshPersonaData = function() {
    if (window.personaAdmin && typeof window.personaAdmin.refreshPersonaData === 'function') {
        window.personaAdmin.refreshPersonaData();
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Wait a bit for other managers to initialize
    setTimeout(async () => {
        window.personaAdmin = new PersonaAdmin();
        await window.personaAdmin.init();
        console.log('PersonaAdmin initialized and ready');
    }, 1000);
});

// Export for global access
if (typeof window !== 'undefined') {
    window.PersonaAdmin = PersonaAdmin;
}