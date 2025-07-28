
function buildPromptMessages({ systemPrompt, agentPrompt, guardrails }) {
    if (!systemPrompt) throw new Error("Global system prompt is required");

    const auditLog = [];

    let allowOverride = true;
    if (guardrails?.checkPromptOverride) {
        const violation = guardrails.checkPromptOverride(systemPrompt, agentPrompt);
        if (violation) {
            auditLog.push({ type: "REJECTED", reason: violation, prompt: agentPrompt });
            console.warn("Agent prompt override rejected by guardrails:", violation);
            allowOverride = false;
        } else if (agentPrompt) {
            auditLog.push({ type: "ACCEPTED", prompt: agentPrompt });
        }
    }

    const messages = [
        { role: "system", content: systemPrompt }
    ];

    if (allowOverride && agentPrompt?.trim()) {
        messages.push({ role: "system", content: agentPrompt.trim() });
    }

    // Attach audit log for external access
    messages.auditLog = auditLog;
    return messages;
}
// Export to global scope for non-module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildPromptMessages };
} else {
    window.buildPromptMessages = buildPromptMessages;
}