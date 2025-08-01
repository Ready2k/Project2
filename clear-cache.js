/**
 * Simple script to clear routing cache
 * Run this in the browser console to clear cache after applying the fix
 */

function clearAgentRoutingCache() {
    console.log('🧹 Clearing agent routing cache...');
    
    try {
        if (window.agentRouter && typeof window.agentRouter.invalidateRoutingCache === 'function') {
            window.agentRouter.invalidateRoutingCache('Manual cache clear - routing fallback chain fix applied');
            console.log('✅ Router cache cleared');
        } else {
            console.warn('⚠️ AgentRouter not found or invalidateRoutingCache method not available');
        }
        
        if (window.agentRouter && window.agentRouter.contextManager && typeof window.agentRouter.contextManager.resetContextRouting === 'function') {
            window.agentRouter.contextManager.resetContextRouting();
            console.log('✅ Context routing reset');
        } else {
            console.warn('⚠️ ContextManager not found or resetContextRouting method not available');
        }
        
        console.log('🎉 Cache clearing completed! The agent handoff fix should now work properly.');
        console.log('💡 Try your fraud scenario again: ask for balance, then report fraud.');
        
    } catch (error) {
        console.error('❌ Error clearing cache:', error);
    }
}

// Auto-run and export
clearAgentRoutingCache();
window.clearAgentRoutingCache = clearAgentRoutingCache;

console.log('🔧 Cache cleared. Function available as clearAgentRoutingCache() for future use.');