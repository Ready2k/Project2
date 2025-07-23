/**
 * Test API Factory
 * Creates appropriate API client based on test mode (mock vs real)
 */
class TestAPIFactory {
    static createAPIClient(testMode = null) {
        // Get test mode from debug manager if not specified
        const mode = testMode || (window.debugManager ? window.debugManager.getTestMode() : 'mock');
        
        if (mode === 'real') {
            return TestAPIFactory.createRealAPIClient();
        } else {
            return TestAPIFactory.createMockAPIClient();
        }
    }

    static createRealAPIClient() {
        // Check if API key is available
        const apiKey = localStorage.getItem('openai_api_key');
        if (!apiKey) {
            console.warn('Real API mode selected but no API key found. Falling back to mock mode.');
            return TestAPIFactory.createMockAPIClient();
        }

        // Create real OpenAI client with token tracking
        const tokenTracker = window.TokenTracker ? new TokenTracker() : null;
        const realClient = new OpenAIClient(apiKey, tokenTracker);

        return {
            generateChatCompletion: async (messages, options) => {
                try {
                    const result = await realClient.generateChatCompletion(messages, options);
                    return {
                        success: result.success,
                        content: result.content,
                        tokensUsed: result.usage ? result.usage.total_tokens : 0,
                        usage: result.usage,
                        error: result.error
                    };
                } catch (error) {
                    console.error('Real API call failed:', error);
                    return {
                        success: false,
                        content: 'API call failed',
                        error: error.message
                    };
                }
            },

            speechToText: async (audioBlob, options) => {
                try {
                    const result = await realClient.speechToText(audioBlob, options);
                    return {
                        success: result.success,
                        text: result.text,
                        error: result.error
                    };
                } catch (error) {
                    console.error('Real STT call failed:', error);
                    return {
                        success: false,
                        text: '',
                        error: error.message
                    };
                }
            },

            textToSpeech: async (text, options) => {
                try {
                    const result = await realClient.textToSpeech(text, options);
                    return {
                        success: result.success,
                        audioBlob: result.audioBlob,
                        error: result.error
                    };
                } catch (error) {
                    console.error('Real TTS call failed:', error);
                    return {
                        success: false,
                        audioBlob: null,
                        error: error.message
                    };
                }
            }
        };
    }

    static createMockAPIClient() {
        return {
            generateChatCompletion: async (messages, options) => {
                // Simulate API delay
                await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));
                
                const inputTokens = Math.floor(Math.random() * 50) + 20;
                const outputTokens = Math.floor(Math.random() * 100) + 50;
                
                // Track tokens if tracker is available
                if (window.TokenTracker && window.tokenTracker) {
                    window.tokenTracker.trackGptUsage(inputTokens, outputTokens);
                }
                
                // Generate mock response based on input
                const lastMessage = messages[messages.length - 1].content.toLowerCase();
                let mockResponse = '';
                
                if (lastMessage.includes('balance')) {
                    mockResponse = 'Your current account balance is £2,500.75. Your Premium Current Account is in good standing.';
                } else if (lastMessage.includes('transfer') || lastMessage.includes('send') || lastMessage.includes('pay')) {
                    mockResponse = 'I can help you with that transfer. For security, I\'ll need to verify a few details first.';
                } else if (lastMessage.includes('block') || lastMessage.includes('fraud') || lastMessage.includes('stolen')) {
                    mockResponse = 'I understand your concern about potential fraud. I\'m blocking your card ending in 1234 immediately for your security.';
                } else if (lastMessage.includes('password') || lastMessage.includes('verify') || lastMessage.includes('identity')) {
                    mockResponse = 'I can help you with identity verification. Let me guide you through the secure verification process.';
                } else {
                    mockResponse = `Mock response for: "${messages[messages.length - 1].content.substring(0, 50)}..."`;
                }
                
                return {
                    success: true,
                    content: mockResponse,
                    tokensUsed: inputTokens + outputTokens,
                    usage: {
                        prompt_tokens: inputTokens,
                        completion_tokens: outputTokens,
                        total_tokens: inputTokens + outputTokens
                    }
                };
            },

            speechToText: async (audioBlob, options) => {
                // Simulate STT delay
                await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 200));
                
                // Track Whisper usage if tracker is available
                if (window.TokenTracker && window.tokenTracker) {
                    window.tokenTracker.trackWhisperUsage(0.17); // ~10 seconds of audio
                }
                
                // Generate mock transcription
                const mockTranscriptions = [
                    'What is my account balance?',
                    'I need to transfer money to Alice',
                    'Block my card immediately',
                    'I forgot my password',
                    'Show me my recent transactions',
                    'Is there any suspicious activity on my account?',
                    'I want to make a payment',
                    'Help me verify my identity'
                ];
                
                const randomTranscription = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
                
                return {
                    success: true,
                    text: randomTranscription
                };
            },

            textToSpeech: async (text, options) => {
                // Simulate TTS delay
                await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 300));
                
                // Track TTS usage if tracker is available
                if (window.TokenTracker && window.tokenTracker) {
                    window.tokenTracker.trackTtsUsage(text.length, options?.model || 'tts-1');
                }
                
                // Create a mock audio blob (empty but valid)
                const mockAudioBlob = new Blob(['mock audio data'], { type: 'audio/mpeg' });
                
                return {
                    success: true,
                    audioBlob: mockAudioBlob
                };
            }
        };
    }

    static createTestContext(testMode = null) {
        const apiClient = TestAPIFactory.createAPIClient(testMode);
        
        return {
            personaManager: {
                getCurrentPersonaData: () => ({
                    name: 'Test User',
                    accountType: 'Premium Current Account',
                    balance: 2500.75,
                    cardLast4: '1234',
                    currency: 'GBP',
                    recentTransactions: [
                        { date: '2024-01-15', amount: -45.50, description: 'Grocery Store Purchase' },
                        { date: '2024-01-14', amount: -12.99, description: 'Coffee Shop' },
                        { date: '2024-01-13', amount: 1500.00, description: 'Salary Deposit' },
                        { date: '2024-01-12', amount: -89.99, description: 'Online Shopping' },
                        { date: '2024-01-11', amount: -25.00, description: 'Fuel Station' }
                    ]
                }),
                formatCurrency: (amount) => `£${amount.toFixed(2)}`
            },
            systemPromptsManager: {
                getSystemPrompt: () => 'You are a helpful banking assistant.',
                generateSystemPrompt: (persona, input) => `You are a helpful banking assistant. Customer: ${persona?.name || 'Unknown'}`
            },
            apiClient: apiClient,
            tokenTracker: window.TokenTracker ? new TokenTracker() : {
                trackGptUsage: (input, output) => console.log(`Token tracking: ${input} input, ${output} output tokens`),
                trackWhisperUsage: (duration) => console.log(`Whisper tracking: ${duration} minutes`),
                trackTtsUsage: (chars, model) => console.log(`TTS tracking: ${chars} characters, ${model} model`),
                getUsage: () => ({ gpt: { tokens: 0 }, whisper: { minutes: 0 }, tts: { characters: 0 }, total: 0 })
            },
            debugMode: window.debugManager ? window.debugManager.isEnabled() : false
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestAPIFactory;
}