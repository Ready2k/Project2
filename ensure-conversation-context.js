/**
 * Ensure ConversationContextManager is available globally
 * This script should be loaded after conversation-context-manager.js but before other components
 */

(function() {
    'use strict';
    
    // Function to ensure conversation context manager is available
    function ensureConversationContextManager() {
        // Check if already available globally
        if (window.conversationContextManager) {
            console.log('✅ ConversationContextManager already available globally');
            return true;
        }
        
        // Check if available via speechApp
        if (window.speechApp && window.speechApp.conversationContextManager) {
            window.conversationContextManager = window.speechApp.conversationContextManager;
            console.log('✅ ConversationContextManager exposed from speechApp');
            return true;
        }
        
        // Check if available via agentRouter
        if (window.agentRouter && window.agentRouter.contextManager) {
            window.conversationContextManager = window.agentRouter.contextManager;
            console.log('✅ ConversationContextManager exposed from agentRouter');
            return true;
        }
        
        // Create standalone instance if class is available
        if (typeof ConversationContextManager !== 'undefined') {
            try {
                window.conversationContextManager = new ConversationContextManager();
                console.log('✅ Standalone ConversationContextManager created');
                return true;
            } catch (error) {
                console.error('❌ Failed to create standalone ConversationContextManager:', error);
                return false;
            }
        }
        
        console.warn('⚠️  ConversationContextManager class not available');
        return false;
    }
    
    // Function to patch streaming manager if needed
    function patchStreamingManagerIntegration() {
        // Wait for StreamingManager to be available
        const checkStreamingManager = () => {
            if (window.StreamingManager && window.StreamingManager.prototype) {
                const originalDisplayUserMessage = window.StreamingManager.prototype.displayUserMessage;
                const originalDisplayBotMessage = window.StreamingManager.prototype.displayBotMessage;
                
                // Only patch if not already patched
                if (originalDisplayUserMessage && !originalDisplayUserMessage._conversationContextPatched) {
                    window.StreamingManager.prototype.displayUserMessage = function(transcript) {
                        // Call original method
                        const result = originalDisplayUserMessage.call(this, transcript);
                        
                        // Add to conversation context if available
                        if (window.conversationContextManager && typeof window.conversationContextManager.addMessage === 'function') {
                            try {
                                window.conversationContextManager.addMessage('user', transcript, null, {
                                    streamingMode: true,
                                    timestamp: Date.now()
                                });
                            } catch (error) {
                                console.warn('Failed to add user message to conversation context:', error);
                            }
                        }
                        
                        return result;
                    };
                    window.StreamingManager.prototype.displayUserMessage._conversationContextPatched = true;
                    console.log('✅ StreamingManager.displayUserMessage patched for conversation context');
                }
                
                if (originalDisplayBotMessage && !originalDisplayBotMessage._conversationContextPatched) {
                    window.StreamingManager.prototype.displayBotMessage = function(text) {
                        // Call original method
                        const result = originalDisplayBotMessage.call(this, text);
                        
                        // Add to conversation context if available
                        if (window.conversationContextManager && typeof window.conversationContextManager.addMessage === 'function') {
                            try {
                                const currentAgent = this.currentStreamingAgent?.name || 'StreamingAgent';
                                window.conversationContextManager.addMessage('assistant', text, currentAgent, {
                                    streamingMode: true,
                                    timestamp: Date.now()
                                });
                            } catch (error) {
                                console.warn('Failed to add bot message to conversation context:', error);
                            }
                        }
                        
                        return result;
                    };
                    window.StreamingManager.prototype.displayBotMessage._conversationContextPatched = true;
                    console.log('✅ StreamingManager.displayBotMessage patched for conversation context');
                }
                
                return true;
            }
            return false;
        };
        
        // Try immediately
        if (!checkStreamingManager()) {
            // Try again after a delay
            setTimeout(checkStreamingManager, 1000);
        }
    }
    
    // Main initialization function
    function initialize() {
        console.log('🔧 Ensuring ConversationContextManager availability...');
        
        const success = ensureConversationContextManager();
        
        if (success) {
            // Also ensure streaming integration
            patchStreamingManagerIntegration();
            
            // Make speechApp aware of the conversation context manager if it exists
            if (window.speechApp && !window.speechApp.conversationContextManager) {
                window.speechApp.conversationContextManager = window.conversationContextManager;
                console.log('✅ ConversationContextManager linked to speechApp');
            }
        }
        
        return success;
    }
    
    // IMMEDIATE initialization - create ConversationContextManager as soon as this script loads
    if (typeof ConversationContextManager !== 'undefined' && !window.conversationContextManager) {
        try {
            window.conversationContextManager = new ConversationContextManager();
            console.log('🚀 ConversationContextManager created immediately on script load');
        } catch (error) {
            console.error('❌ Failed to create immediate ConversationContextManager:', error);
        }
    }
    
    // Try to initialize immediately
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // Also try after a delay to catch late-loading components
    setTimeout(initialize, 100);
    setTimeout(initialize, 500);
    setTimeout(initialize, 2000);
    
    // Make functions available globally for debugging
    window.ensureConversationContextManager = ensureConversationContextManager;
    window.patchStreamingManagerIntegration = patchStreamingManagerIntegration;
    
})();