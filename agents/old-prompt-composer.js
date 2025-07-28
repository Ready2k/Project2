
export function buildPromptMessages({ systemPrompt, agentPrompt, guardrails }) {
    if (!systemPrompt) throw new Error("Global system prompt is required");

    const guardrailViolation = guardrails?.checkPromptOverride?.(systemPrompt, agentPrompt);
    if (guardrailViolation) {
        console.warn("Agent prompt override rejected by guardrails:", guardrailViolation);
        agentPrompt = null; // Remove the override
    }

    const messages = [
        { role: "system", content: systemPrompt }
    ];

    if (agentPrompt && agentPrompt.trim()) {
        messages.push({ role: "system", content: agentPrompt.trim() });
    }

    return messages;
}
