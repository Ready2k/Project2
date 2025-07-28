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
    const LRUCache = require('./lru-cache');
    const RoutingFallbackChain = require('./routing-fallback-chain');
    const ConversationContextManager = require('./conversation-context-manager');
    const { RateLimiter, RateLimitError } = require('./rate-limiter');
    const { RequestValidator, ValidationError } = require('./request-validator');
    const { AuditLogger } = require('./audit-logger');
    const { SecurityEnhancementLayer, SecurityError } = require('./security-manager');
    const ErrorReporter = require('./error-reporter');
    
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
        ConfigUpdateManager,
        LRUCache,
        RoutingFallbackChain,
        ConversationContextManager,
        RateLimiter,
        RateLimitError,
        RequestValidator,
        ValidationError,
        AuditLogger,
        SecurityEnhancementLayer,
        SecurityError,
        ErrorReporter
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
        ConfigUpdateManager: window.ConfigUpdateManager,
        LRUCache: window.LRUCache,
        RoutingFallbackChain: window.RoutingFallbackChain,
        ConversationContextManager: window.ConversationContextManager,
        RateLimiter: window.RateLimiter,
        RateLimitError: window.RateLimitError,
        RequestValidator: window.RequestValidator,
        ValidationError: window.ValidationError,
        AuditLogger: window.AuditLogger,
        SecurityEnhancementLayer: window.SecurityEnhancementLayer,
        SecurityError: window.SecurityError,
        ErrorReporter: window.ErrorReporter
    };
}