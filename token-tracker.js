/**
 * Token Usage Tracker
 * Tracks and calculates costs for OpenAI API usage
 */
class TokenTracker {
    constructor() {
        this.usage = this.loadUsage();
        
        // Pricing per unit
        this.pricing = {
            whisper: 0.006, // per minute
            gpt35turbo: { input: 0.0005, output: 0.0015 }, // per 1K tokens
            tts1: 0.015, // per 1K characters
            tts1hd: 0.030 // per 1K characters
        };
    }

    loadUsage() {
        const saved = localStorage.getItem('token_usage');
        return saved ? JSON.parse(saved) : {
            whisper: { requests: 0, cost: 0 },
            gpt: { tokens: 0, cost: 0 },
            tts: { characters: 0, cost: 0 },
            total: 0
        };
    }

    saveUsage() {
        localStorage.setItem('token_usage', JSON.stringify(this.usage));
    }

    trackWhisperUsage(minutes = 0.17) {
        this.usage.whisper.requests += 1;
        const cost = minutes * this.pricing.whisper;
        this.usage.whisper.cost += cost;
        this.usage.total += cost;
        this.saveUsage();
    }

    trackGptUsage(inputTokens, outputTokens) {
        this.usage.gpt.tokens += (inputTokens + outputTokens);
        const inputCost = (inputTokens / 1000) * this.pricing.gpt35turbo.input;
        const outputCost = (outputTokens / 1000) * this.pricing.gpt35turbo.output;
        const totalCost = inputCost + outputCost;
        this.usage.gpt.cost += totalCost;
        this.usage.total += totalCost;
        this.saveUsage();
    }

    trackTtsUsage(characters, model = 'tts-1') {
        this.usage.tts.characters += characters;
        const pricePerChar = model === 'tts-1-hd' ?
            this.pricing.tts1hd / 1000 : this.pricing.tts1 / 1000;
        const cost = characters * pricePerChar;
        this.usage.tts.cost += cost;
        this.usage.total += cost;
        this.saveUsage();
    }

    getUsage() {
        return { ...this.usage };
    }

    resetUsage() {
        this.usage = {
            whisper: { requests: 0, cost: 0 },
            gpt: { tokens: 0, cost: 0 },
            tts: { characters: 0, cost: 0 },
            total: 0
        };
        this.saveUsage();
    }

    updateDisplay() {
        const elements = {
            whisperTokens: document.getElementById('whisperTokens'),
            whisperCost: document.getElementById('whisperCost'),
            gptTokens: document.getElementById('gptTokens'),
            gptCost: document.getElementById('gptCost'),
            ttsTokens: document.getElementById('ttsTokens'),
            ttsCost: document.getElementById('ttsCost'),
            totalCost: document.getElementById('totalCost')
        };

        if (elements.whisperTokens) elements.whisperTokens.textContent = `${this.usage.whisper.requests} requests`;
        if (elements.whisperCost) elements.whisperCost.textContent = `${this.usage.whisper.cost.toFixed(4)}`;
        if (elements.gptTokens) elements.gptTokens.textContent = `${this.usage.gpt.tokens} tokens`;
        if (elements.gptCost) elements.gptCost.textContent = `${this.usage.gpt.cost.toFixed(4)}`;
        if (elements.ttsTokens) elements.ttsTokens.textContent = `${this.usage.tts.characters} chars`;
        if (elements.ttsCost) elements.ttsCost.textContent = `${this.usage.tts.cost.toFixed(4)}`;
        if (elements.totalCost) elements.totalCost.textContent = `$${this.usage.total.toFixed(4)}`;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TokenTracker;
}