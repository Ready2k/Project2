/**
 * Agents Module Index
 * Exports all agent classes for easy importing
 */

// Import BaseAgent, AgentRouter, and domain agents
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    const BaseAgent = require('./base-agent');
    const { AgentRouter, FallbackHandler } = require('./agent-router');
    const IDVAgent = require('./idv-agent');
    const BankingInfoAgent = require('./banking-info-agent');
    const FraudAgent = require('./fraud-agent');
    
    module.exports = {
        BaseAgent,
        AgentRouter,
        FallbackHandler,
        IDVAgent,
        BankingInfoAgent,
        FraudAgent
    };
} else {
    // Browser environment - classes are already available globally
    window.Agents = {
        BaseAgent: window.BaseAgent,
        AgentRouter: window.AgentRouter,
        FallbackHandler: window.FallbackHandler,
        IDVAgent: window.IDVAgent,
        BankingInfoAgent: window.BankingInfoAgent,
        FraudAgent: window.FraudAgent
    };
}