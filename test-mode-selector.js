/**
 * Test Mode Selector Component
 * Provides UI for switching between mock and real API testing
 */
class TestModeSelector {
    constructor(containerId = 'test-mode-selector') {
        this.containerId = containerId;
        this.currentMode = window.debugManager ? window.debugManager.getTestMode() : 'mock';
        this.callbacks = [];
    }

    // Add callback for when test mode changes
    onModeChange(callback) {
        this.callbacks.push(callback);
    }

    // Notify all callbacks of mode change
    notifyModeChange(newMode) {
        this.callbacks.forEach(callback => {
            try {
                callback(newMode);
            } catch (error) {
                console.error('Test mode change callback error:', error);
            }
        });
    }

    // Create the selector UI
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.warn(`Test mode selector container '${this.containerId}' not found`);
            return;
        }

        container.innerHTML = `
            <div class="test-mode-selector" style="
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 8px;
                padding: 15px;
                margin: 10px 0;
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 10px;
            ">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: bold; color: #495057;">Test Mode:</span>
                    <div class="mode-toggle" style="display: flex; background: white; border: 1px solid #ced4da; border-radius: 6px; overflow: hidden;">
                        <button id="mock-mode-btn" class="mode-btn" data-mode="mock" style="
                            padding: 8px 16px;
                            border: none;
                            background: ${this.currentMode === 'mock' ? '#007bff' : 'white'};
                            color: ${this.currentMode === 'mock' ? 'white' : '#495057'};
                            cursor: pointer;
                            transition: all 0.2s;
                        ">🎭 Mock API</button>
                        <button id="real-mode-btn" class="mode-btn" data-mode="real" style="
                            padding: 8px 16px;
                            border: none;
                            background: ${this.currentMode === 'real' ? '#dc3545' : 'white'};
                            color: ${this.currentMode === 'real' ? 'white' : '#495057'};
                            cursor: pointer;
                            transition: all 0.2s;
                        ">🌐 Real API</button>
                    </div>
                </div>
                
                <div class="mode-info" style="font-size: 14px; color: #6c757d;">
                    <span id="mode-description">
                        ${this.getModeDescription(this.currentMode)}
                    </span>
                </div>
                
                <div class="api-key-status" style="font-size: 12px;">
                    <span id="api-key-status" style="
                        padding: 4px 8px;
                        border-radius: 4px;
                        background: ${this.hasApiKey() ? '#d4edda' : '#f8d7da'};
                        color: ${this.hasApiKey() ? '#155724' : '#721c24'};
                    ">
                        ${this.hasApiKey() ? '🔑 API Key Set' : '⚠️ No API Key'}
                    </span>
                </div>
            </div>
        `;

        // Add event listeners
        document.getElementById('mock-mode-btn').addEventListener('click', () => this.setMode('mock'));
        document.getElementById('real-mode-btn').addEventListener('click', () => this.setMode('real'));
    }

    // Set the test mode
    setMode(mode) {
        if (mode === 'real' && !this.hasApiKey()) {
            this.showApiKeyPrompt();
            return;
        }

        this.currentMode = mode;
        
        // Update debug manager
        if (window.debugManager) {
            window.debugManager.setTestMode(mode);
        }

        // Update UI
        this.updateUI();
        
        // Notify callbacks
        this.notifyModeChange(mode);
    }

    // Update the UI to reflect current mode
    updateUI() {
        const mockBtn = document.getElementById('mock-mode-btn');
        const realBtn = document.getElementById('real-mode-btn');
        const modeDescription = document.getElementById('mode-description');

        if (mockBtn && realBtn && modeDescription) {
            // Update button styles
            if (this.currentMode === 'mock') {
                mockBtn.style.background = '#007bff';
                mockBtn.style.color = 'white';
                realBtn.style.background = 'white';
                realBtn.style.color = '#495057';
            } else {
                mockBtn.style.background = 'white';
                mockBtn.style.color = '#495057';
                realBtn.style.background = '#dc3545';
                realBtn.style.color = 'white';
            }

            // Update description
            modeDescription.textContent = this.getModeDescription(this.currentMode);
        }
    }

    // Get description for current mode
    getModeDescription(mode) {
        if (mode === 'real') {
            return 'Tests will use real OpenAI API calls (costs money, requires API key)';
        } else {
            return 'Tests will use simulated API responses (free, no API key needed)';
        }
    }

    // Check if API key is available
    hasApiKey() {
        return !!localStorage.getItem('openai_api_key');
    }

    // Show API key prompt
    showApiKeyPrompt() {
        const apiKey = prompt('Enter your OpenAI API key to use real API mode:');
        if (apiKey && apiKey.trim()) {
            localStorage.setItem('openai_api_key', apiKey.trim());
            this.setMode('real');
            this.updateApiKeyStatus();
        }
    }

    // Update API key status display
    updateApiKeyStatus() {
        const statusElement = document.getElementById('api-key-status');
        if (statusElement) {
            const hasKey = this.hasApiKey();
            statusElement.textContent = hasKey ? '🔑 API Key Set' : '⚠️ No API Key';
            statusElement.style.background = hasKey ? '#d4edda' : '#f8d7da';
            statusElement.style.color = hasKey ? '#155724' : '#721c24';
        }
    }

    // Get current mode
    getCurrentMode() {
        return this.currentMode;
    }

    // Create a simple inline selector (for smaller spaces)
    renderInline(parentElement) {
        const inlineHTML = `
            <div style="display: inline-flex; align-items: center; gap: 8px; margin: 0 10px;">
                <span style="font-size: 12px; color: #6c757d;">Mode:</span>
                <select id="inline-mode-select" style="
                    padding: 4px 8px;
                    border: 1px solid #ced4da;
                    border-radius: 4px;
                    font-size: 12px;
                    background: white;
                ">
                    <option value="mock" ${this.currentMode === 'mock' ? 'selected' : ''}>🎭 Mock</option>
                    <option value="real" ${this.currentMode === 'real' ? 'selected' : ''}>🌐 Real</option>
                </select>
            </div>
        `;

        if (typeof parentElement === 'string') {
            const element = document.getElementById(parentElement);
            if (element) {
                element.insertAdjacentHTML('beforeend', inlineHTML);
            }
        } else if (parentElement) {
            parentElement.insertAdjacentHTML('beforeend', inlineHTML);
        }

        // Add event listener for inline select
        const select = document.getElementById('inline-mode-select');
        if (select) {
            select.addEventListener('change', (e) => {
                this.setMode(e.target.value);
            });
        }
    }
}

// Auto-initialize if container exists
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('test-mode-selector');
    if (container) {
        const selector = new TestModeSelector();
        selector.render();
        
        // Make it globally accessible
        window.testModeSelector = selector;
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestModeSelector;
}