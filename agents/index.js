/**
 * Agents Module Index
 * Exports all agent classes for easy importing
 */

// Import BaseAgent, AgentRouter, domain agents, and manager classes
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    const BaseAgent = require('./base-agent');
    const { AgentRouter, FallbackHandler } = require('./agent-router');
    const IDVAgent = require('./idv-agent');
    const BankingInfoAgent = require('./banking-info-agent');
    const FraudAgent = require('./fraud-agent');
    const PaymentsAgent = require('./payments-agent');
    const LLMManager = require('./llm-manager');
    const GuardrailsManager = require('./guardrails-manager');
    const VoiceConfigManager = require('./voice-config-manager');
    const ConfigUpdateManager = require('./config-update-manager');
    
    module.exports = {
        BaseAgent,
        AgentRouter,
        FallbackHandler,
        IDVAgent,
        BankingInfoAgent,
        FraudAgent,
        PaymentsAgent,
        LLMManager,
        GuardrailsManager,
        VoiceConfigManager,
        ConfigUpdateManager
    };
} else {
    // Browser environment - classes are already available globally
    window.Agents = {
        BaseAgent: window.BaseAgent,
        AgentRouter: window.AgentRouter,
        FallbackHandler: window.FallbackHandler,
        IDVAgent: window.IDVAgent,
        BankingInfoAgent: window.BankingInfoAgent,
        FraudAgent: window.FraudAgent,
        PaymentsAgent: window.PaymentsAgent,
        LLMManager: window.LLMManager,
        GuardrailsManager: window.GuardrailsManager,
        VoiceConfigManager: window.VoiceConfigManager,
        ConfigUpdateManager: window.ConfigUpdateManager
    };
}