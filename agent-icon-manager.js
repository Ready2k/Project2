class AgentIconManager {
    constructor() {
        // Map agent names to their specific icons
        this.agentIcons = {
            'BankingInfoAgent': {
                icon: 'fas fa-university',
                color: '#ffffff',  // White for better contrast
                name: 'Banking Info'
            },
            'FraudAgent': {
                icon: 'fas fa-shield-alt',
                color: '#ffffff',  // White for better contrast
                name: 'Fraud Protection'
            },
            'IDVAgent': {
                icon: 'fas fa-user-check',
                color: '#ffffff',  // White for better contrast
                name: 'Identity Verification'
            },
            'PaymentsAgent': {
                icon: 'fas fa-credit-card',
                color: '#ffffff',  // White for better contrast
                name: 'Payments'
            },
            'DefaultAgent': {
                icon: 'fas fa-robot',
                color: '#ffffff',  // White for better contrast
                name: 'Assistant'
            }
        };
        
        this.currentAgent = 'DefaultAgent';
        this.debug = window.debugManager ? window.debugManager.createModuleLogger('AgentIconManager') : console;
    }

    /**
     * Sanitize agent name for use in CSS classes
     * @param {string} agentName - Name of the agent
     * @returns {string} Sanitized name safe for CSS classes
     */
    sanitizeAgentName(agentName) {
        return agentName.toLowerCase()
            .replace(/\s+/g, '-')  // Replace spaces with hyphens
            .replace(/[^a-z0-9-]/g, '')  // Remove any non-alphanumeric characters except hyphens
            .replace(/-+/g, '-')  // Replace multiple hyphens with single hyphen
            .replace(/^-|-$/g, '');  // Remove leading/trailing hyphens
    }

    /**
     * Get icon configuration for an agent
     * @param {string} agentName - Name of the agent
     * @returns {Object} Icon configuration
     */
    getAgentIcon(agentName) {
        const config = this.agentIcons[agentName] || this.agentIcons['DefaultAgent'];
        this.debug.debug(`Getting icon for agent: ${agentName}`, config);
        return config;
    }

    /**
     * Set the current active agent
     * @param {string} agentName - Name of the agent
     */
    setCurrentAgent(agentName) {
        const previousAgent = this.currentAgent;
        this.currentAgent = agentName;
        
        this.debug.info(`Agent changed from ${previousAgent} to ${agentName}`);
        
        // Update the agent indicator in the UI
        this.updateAgentIndicator(agentName);
        
        // Log system event
        if (window.systemLogger) {
            window.systemLogger.logSystemEvent(`Agent switched to ${agentName}`, {
                previousAgent,
                newAgent: agentName,
                iconConfig: this.getAgentIcon(agentName)
            });
        }
    }

    /**
     * Update the agent indicator in the main interface
     * @param {string} agentName - Name of the agent
     */
    updateAgentIndicator(agentName) {
        const indicator = document.getElementById('currentAgent');
        if (indicator) {
            const config = this.getAgentIcon(agentName);
            indicator.textContent = config.name;
            // Don't set inline color - let CSS handle it for better readability
            // indicator.style.color = config.color;
            
            // Add agent-specific class with sanitized name
            indicator.className = 'agent-name';
            const sanitizedName = this.sanitizeAgentName(agentName);
            indicator.classList.add(`agent-${sanitizedName}`);
        }
    }

    /**
     * Create a bot message with the appropriate agent icon
     * @param {string} message - The message content
     * @param {string} agentName - Name of the agent (optional, uses current if not provided)
     * @returns {HTMLElement} The message element
     */
    createBotMessage(message, agentName = null) {
        const agent = agentName || this.currentAgent;
        const config = this.getAgentIcon(agent);
        const sanitizedName = this.sanitizeAgentName(agent);
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'bot-message';
        messageDiv.setAttribute('data-agent', agent);
        
        messageDiv.innerHTML = `
            <div class="message-avatar agent-avatar-${sanitizedName}">
                <i class="${config.icon}" style="color: ${config.color}"></i>
            </div>
            <div class="message-content">
                <div class="agent-label">${config.name}</div>
                <div class="message-text">${message}</div>
            </div>
        `;
        
        return messageDiv;
    }

    /**
     * Create a user message
     * @param {string} message - The message content
     * @returns {HTMLElement} The message element
     */
    createUserMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'user-message';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="message-content">
                <div class="message-text">${message}</div>
            </div>
        `;
        
        return messageDiv;
    }

    /**
     * Add a message to the conversation
     * @param {string} message - The message content
     * @param {string} type - 'bot' or 'user'
     * @param {string} agentName - Name of the agent (for bot messages)
     */
    addMessage(message, type = 'bot', agentName = null) {
        const conversation = document.getElementById('conversation');
        if (!conversation) {
            this.debug.warn('Conversation element not found');
            return;
        }

        let messageElement;
        if (type === 'bot') {
            messageElement = this.createBotMessage(message, agentName);
            
            // Update current agent if provided
            if (agentName && agentName !== this.currentAgent) {
                this.setCurrentAgent(agentName);
            }
        } else {
            messageElement = this.createUserMessage(message);
        }

        conversation.appendChild(messageElement);
        conversation.scrollTop = conversation.scrollHeight;

        // Add animation
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(20px)';
        
        requestAnimationFrame(() => {
            messageElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
        });
    }

    /**
     * Update existing bot messages to show correct agent icons
     * This is useful when agent detection improves or changes
     */
    updateExistingMessages() {
        const botMessages = document.querySelectorAll('.bot-message');
        
        botMessages.forEach(messageDiv => {
            const agentName = messageDiv.getAttribute('data-agent') || this.currentAgent;
            const config = this.getAgentIcon(agentName);
            const sanitizedName = this.sanitizeAgentName(agentName);
            
            const avatar = messageDiv.querySelector('.message-avatar');
            const icon = avatar.querySelector('i');
            
            if (icon) {
                icon.className = config.icon;
                icon.style.color = config.color;
            }
            
            // Update agent class with sanitized name
            avatar.className = `message-avatar agent-avatar-${sanitizedName}`;
            
            // Update or add agent label
            let agentLabel = messageDiv.querySelector('.agent-label');
            if (!agentLabel) {
                agentLabel = document.createElement('div');
                agentLabel.className = 'agent-label';
                const messageContent = messageDiv.querySelector('.message-content');
                messageContent.insertBefore(agentLabel, messageContent.firstChild);
            }
            agentLabel.textContent = config.name;
        });
    }

    /**
     * Register a new agent icon
     * @param {string} agentName - Name of the agent
     * @param {Object} iconConfig - Icon configuration
     */
    registerAgentIcon(agentName, iconConfig) {
        this.agentIcons[agentName] = {
            icon: iconConfig.icon || 'fas fa-robot',
            color: iconConfig.color || '#6c757d',
            name: iconConfig.name || agentName
        };
        
        this.debug.info(`Registered icon for agent: ${agentName}`, iconConfig);
    }

    /**
     * Get all registered agents and their icons
     * @returns {Object} All agent icon configurations
     */
    getAllAgentIcons() {
        return { ...this.agentIcons };
    }

    /**
     * Clear conversation and reset to default agent
     */
    clearConversation() {
        const conversation = document.getElementById('conversation');
        if (conversation) {
            conversation.innerHTML = '';
            
            // Add initial bot message with default agent
            this.setCurrentAgent('DefaultAgent');
            this.addMessage('Hello! I\'m your AI voice assistant. How can I help you today?', 'bot');
        }
    }
}

// Create global instance
window.agentIconManager = new AgentIconManager();

// Global convenience functions
window.addBotMessage = (message, agentName) => window.agentIconManager.addMessage(message, 'bot', agentName);
window.addUserMessage = (message) => window.agentIconManager.addMessage(message, 'user');
window.setCurrentAgent = (agentName) => window.agentIconManager.setCurrentAgent(agentName);
window.clearConversation = () => window.agentIconManager.clearConversation();