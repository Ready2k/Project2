// Main Interface Controller
class MainInterfaceController {
    constructor() {
        this.currentPanel = null;
        this.initializeEventListeners();
        this.initializePanelNavigation();
    }

    initializeEventListeners() {
        // Navigation buttons
        document.getElementById('settingsBtn').addEventListener('click', () => this.openPanel('settingsPanel'));
        document.getElementById('adminBtn').addEventListener('click', () => this.openPanel('adminPanel'));
        document.getElementById('debugBtn').addEventListener('click', () => this.openPanel('debugPanel'));
        document.getElementById('helpBtn').addEventListener('click', () => this.openPanel('helpPanel'));

        // Close panel buttons
        document.querySelectorAll('.close-panel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const panelId = e.target.getAttribute('data-panel');
                this.closePanel(panelId);
            });
        });

        // Panel overlay
        document.getElementById('panelOverlay').addEventListener('click', () => this.closeAllPanels());

        // Escape key to close panels
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentPanel) {
                this.closeAllPanels();
            }
        });

        // Clear conversation buttons
        document.getElementById('clearConversationBtn').addEventListener('click', () => {
            if (window.speechApp && typeof window.speechApp.clearConversation === 'function') {
                window.speechApp.clearConversation();
            }
        });

        // Streaming mode clear button (if exists)
        const clearStreamingBtn = document.getElementById('clearStreamingConversationBtn');
        if (clearStreamingBtn) {
            clearStreamingBtn.addEventListener('click', () => {
                if (window.speechApp && typeof window.speechApp.clearConversation === 'function') {
                    window.speechApp.clearConversation();
                }
            });
        }
    }

    initializePanelNavigation() {
        // Admin panel navigation
        document.querySelectorAll('.admin-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.getAttribute('data-admin-section');
                this.switchAdminSection(section);
            });
        });

        // Debug panel navigation
        document.querySelectorAll('.debug-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.getAttribute('data-debug-section');
                this.switchDebugSection(section);
            });
        });

        // Prompt tabs
        document.querySelectorAll('.prompt-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const promptType = e.target.getAttribute('data-prompt');
                this.switchPromptTab(promptType);
            });
        });
    }

    openPanel(panelId) {
        this.closeAllPanels();
        const panel = document.getElementById(panelId);
        const overlay = document.getElementById('panelOverlay');
        
        if (panel) {
            panel.classList.add('open');
            overlay.classList.add('active');
            this.currentPanel = panelId;
            document.body.style.overflow = 'hidden';
        }
    }

    closePanel(panelId) {
        const panel = document.getElementById(panelId);
        const overlay = document.getElementById('panelOverlay');
        
        if (panel) {
            panel.classList.remove('open');
            overlay.classList.remove('active');
            this.currentPanel = null;
            document.body.style.overflow = '';
        }
    }

    closeAllPanels() {
        document.querySelectorAll('.side-panel').forEach(panel => {
            panel.classList.remove('open');
        });
        document.getElementById('panelOverlay').classList.remove('active');
        this.currentPanel = null;
        document.body.style.overflow = '';
    }

    switchAdminSection(sectionId) {
        // Update navigation
        document.querySelectorAll('.admin-nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-admin-section="${sectionId}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionId}-section`).classList.add('active');
    }

    switchDebugSection(sectionId) {
        // Update navigation
        document.querySelectorAll('.debug-nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-debug-section="${sectionId}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.debug-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionId}-section`).classList.add('active');
    }

    switchPromptTab(promptType) {
        // Update tabs
        document.querySelectorAll('.prompt-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-prompt="${promptType}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.prompt-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${promptType}-prompt`).classList.add('active');
    }

    // Utility methods for integration with existing functionality
    updateAgentIndicator(agentName) {
        const indicator = document.getElementById('currentAgent');
        if (indicator) {
            indicator.textContent = agentName;
            indicator.className = 'agent-name';
            
            // Add specific styling based on agent type
            if (agentName.toLowerCase().includes('fraud')) {
                indicator.classList.add('fraud-agent');
            } else if (agentName.toLowerCase().includes('payment')) {
                indicator.classList.add('payments-agent');
            } else if (agentName.toLowerCase().includes('idv') || agentName.toLowerCase().includes('identity')) {
                indicator.classList.add('idv-agent');
            } else if (agentName.toLowerCase().includes('banking')) {
                indicator.classList.add('banking-info-agent');
            } else {
                indicator.classList.add('default-agent');
            }
        }
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.className = `status-badge ${status}`;
            const icon = statusElement.querySelector('i');
            
            switch (status) {
                case 'connected':
                    statusElement.innerHTML = '<i class="fas fa-circle"></i> Connected';
                    break;
                case 'connecting':
                    statusElement.innerHTML = '<i class="fas fa-circle"></i> Connecting';
                    break;
                default:
                    statusElement.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
            }
        }
    }

    updateAudioLevel(level) {
        const levelFill = document.getElementById('audioLevel');
        const levelText = document.getElementById('audioLevelText');
        
        if (levelFill && levelText) {
            levelFill.style.width = `${level}%`;
            levelText.textContent = `${Math.round(level)}%`;
        }
    }

    updateRecordingQuality(quality) {
        const indicator = document.getElementById('recordingQuality');
        if (indicator) {
            indicator.className = `quality-indicator ${quality}`;
            
            switch (quality) {
                case 'recording':
                    indicator.innerHTML = '<i class="fas fa-circle"></i> Recording';
                    break;
                case 'excellent':
                    indicator.innerHTML = '<i class="fas fa-circle"></i> Excellent Quality';
                    break;
                case 'good':
                    indicator.innerHTML = '<i class="fas fa-circle"></i> Good Quality';
                    break;
                case 'poor':
                    indicator.innerHTML = '<i class="fas fa-circle"></i> Poor Quality';
                    break;
                default:
                    indicator.innerHTML = '<i class="fas fa-circle"></i> Not Recording';
            }
        }
    }

    updateStatus(message) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    // Token/Stats update methods
    updateTokenStats(stats) {
        if (stats.whisper !== undefined) {
            const whisperElement = document.getElementById('whisperTokens');
            const whisperCostElement = document.getElementById('whisperCost');
            if (whisperElement) whisperElement.textContent = stats.whisper;
            if (whisperCostElement) whisperCostElement.textContent = stats.whisperCost || '$0.00';
        }

        if (stats.gpt !== undefined) {
            const gptElement = document.getElementById('gptTokens');
            const gptCostElement = document.getElementById('gptCost');
            if (gptElement) gptElement.textContent = stats.gpt;
            if (gptCostElement) gptCostElement.textContent = stats.gptCost || '$0.00';
        }

        if (stats.tts !== undefined) {
            const ttsElement = document.getElementById('ttsTokens');
            const ttsCostElement = document.getElementById('ttsCost');
            if (ttsElement) ttsElement.textContent = stats.tts;
            if (ttsCostElement) ttsCostElement.textContent = stats.ttsCost || '$0.00';
        }

        if (stats.total !== undefined) {
            const totalElement = document.getElementById('totalCost');
            if (totalElement) totalElement.textContent = stats.total || '$0.00';
        }
    }

    // Agent stats update methods
    updateAgentStats(stats) {
        const totalElement = document.getElementById('totalAgents');
        const enabledElement = document.getElementById('enabledAgents');
        const disabledElement = document.getElementById('disabledAgents');

        if (totalElement) totalElement.textContent = stats.total || '0';
        if (enabledElement) enabledElement.textContent = stats.enabled || '0';
        if (disabledElement) disabledElement.textContent = stats.disabled || '0';
    }

    // Debug output methods
    updateDebugOutput(section, content) {
        const outputElement = document.getElementById(section);
        if (outputElement) {
            outputElement.textContent = content;
            outputElement.classList.add('updated');
            setTimeout(() => outputElement.classList.remove('updated'), 500);
        }
    }
}

// Quick action functions
function suggestPhrase(phrase) {
    // Add the phrase to the conversation as a user message
    if (window.speechApp && typeof window.speechApp.addUserMessage === 'function') {
        window.speechApp.addUserMessage(phrase);
        // Optionally trigger processing
        if (typeof window.speechApp.processTextInput === 'function') {
            window.speechApp.processTextInput(phrase);
        }
    } else {
        // Fallback: just add to conversation display
        const conversation = document.getElementById('conversation');
        if (conversation) {
            const userMessage = document.createElement('div');
            userMessage.className = 'user-message';
            userMessage.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="message-content">${phrase}</div>
            `;
            conversation.appendChild(userMessage);
            conversation.scrollTop = conversation.scrollHeight;
        }
    }
}

// Debug utility functions
function clearDebugLogs() {
    document.querySelectorAll('.debug-output').forEach(output => {
        output.textContent = 'Logs cleared...';
    });
}

function exportDebugLogs() {
    const logs = {};
    document.querySelectorAll('.debug-output').forEach(output => {
        const section = output.id;
        logs[section] = output.textContent;
    });
    
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `debug-logs-${new Date().toISOString().slice(0, 19)}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
}

// LLM Manager integration functions
function openFullLLMManager() {
    window.open('llm-manager-admin-ui.html', '_blank');
}

function refreshLLMData() {
    // Trigger refresh of LLM data
    if (window.speechApp && window.speechApp.agentRouter) {
        const stats = window.speechApp.agentRouter.getAgentStats();
        window.mainInterface.updateAgentStats(stats);
        
        // Update LLM specific stats
        const llmStats = {
            total: stats.total,
            enabled: stats.enabled,
            lastUpdated: new Date().toLocaleTimeString()
        };
        
        document.getElementById('llmTotalAgents').textContent = llmStats.total;
        document.getElementById('llmEnabledAgents').textContent = llmStats.enabled;
        document.getElementById('llmLastUpdated').textContent = llmStats.lastUpdated;
    }
}

// Initialize the main interface controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mainInterface = new MainInterfaceController();
    
    // Initialize token update buttons
    const updateTokensBtn = document.getElementById('updateTokens');
    const resetTokensBtn = document.getElementById('resetTokens');
    
    if (updateTokensBtn) {
        updateTokensBtn.addEventListener('click', () => {
            if (window.speechApp && window.speechApp.tokenTracker) {
                const stats = window.speechApp.tokenTracker.getUsageStats();
                window.mainInterface.updateTokenStats(stats);
            }
        });
    }
    
    if (resetTokensBtn) {
        resetTokensBtn.addEventListener('click', () => {
            if (window.speechApp && window.speechApp.tokenTracker) {
                window.speechApp.tokenTracker.reset();
                window.mainInterface.updateTokenStats({
                    whisper: '0',
                    gpt: '0',
                    tts: '0',
                    total: '$0.00',
                    whisperCost: '$0.00',
                    gptCost: '$0.00',
                    ttsCost: '$0.00'
                });
            }
        });
    }
    
    // Initialize settings save functionality
    const saveKeyBtn = document.getElementById('saveKey');
    if (saveKeyBtn) {
        saveKeyBtn.addEventListener('click', () => {
            const apiKey = document.getElementById('apiKey').value;
            if (apiKey && window.speechApp) {
                window.speechApp.setApiKey(apiKey);
                document.getElementById('apiStatus').innerHTML = 
                    '<span class="status-indicator" style="background: #d4edda; color: #155724;">API Key Saved</span>';
            }
        });
    }
    
    console.log('Main interface controller initialized');
});

// Export for global access
window.MainInterfaceController = MainInterfaceController;