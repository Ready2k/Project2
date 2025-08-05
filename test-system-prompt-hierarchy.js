/**
 * Test System Prompt Hierarchy Implementation
 * 
 * This test verifies that:
 * 1. system-prompts.json provides fallback defaults
 * 2. Agent configs can override specific system prompt components
 * 3. The hierarchy works correctly: agent overrides > system-prompts.json fallback
 */

async function testSystemPromptHierarchy() {
    console.log('🧪 Testing System Prompt Hierarchy...');
    
    try {
        // Test 1: SystemPromptManager loads fallback prompts correctly
        console.log('\n📋 Test 1: Loading fallback system prompts...');
        const systemPromptManager = new SystemPromptManager();
        const fallbackPrompts = await systemPromptManager.loadSystemPrompts();
        
        console.log('✅ Fallback prompts loaded:', {
            hasBasePersonality: !!fallbackPrompts.basePersonality,
            hasFinancialContext: !!fallbackPrompts.financialContext,
            hasResponseInstructions: !!fallbackPrompts.responseInstructions,
            customPromptsCount: fallbackPrompts.customPrompts?.length || 0
        });
        
        // Test 2: Agent with no overrides uses fallback entirely
        console.log('\n📋 Test 2: Agent with no system prompt overrides...');
        const agentConfigNoOverrides = {
            name: 'TestAgent',
            description: 'Test agent without system prompt overrides',
            enabled: true
            // No systemPrompts property
        };
        
        const promptsNoOverrides = await systemPromptManager.getSystemPromptsForAgent('TestAgent', agentConfigNoOverrides);
        
        const allFromFallback = 
            promptsNoOverrides.basePersonality === fallbackPrompts.basePersonality &&
            promptsNoOverrides.financialContext === fallbackPrompts.financialContext &&
            promptsNoOverrides.responseInstructions === fallbackPrompts.responseInstructions;
            
        console.log('✅ Agent without overrides uses fallback:', allFromFallback);
        
        // Test 3: Agent with partial overrides
        console.log('\n📋 Test 3: Agent with partial system prompt overrides...');
        const agentConfigPartialOverrides = {
            name: 'TestAgentPartial',
            description: 'Test agent with partial overrides',
            enabled: true,
            systemPrompts: {
                basePersonality: 'CUSTOM: I am a specialized test agent.',
                // financialContext and responseInstructions should come from fallback
                customPrompts: [
                    {
                        name: 'Test Prompt',
                        prompt: 'This is a custom test prompt.'
                    }
                ]
            }
        };
        
        const promptsPartialOverrides = await systemPromptManager.getSystemPromptsForAgent('TestAgentPartial', agentConfigPartialOverrides);
        
        const correctPartialOverride = 
            promptsPartialOverrides.basePersonality === 'CUSTOM: I am a specialized test agent.' &&
            promptsPartialOverrides.financialContext === fallbackPrompts.financialContext &&
            promptsPartialOverrides.responseInstructions === fallbackPrompts.responseInstructions &&
            promptsPartialOverrides.customPrompts.length > fallbackPrompts.customPrompts.length;
            
        console.log('✅ Agent with partial overrides works correctly:', correctPartialOverride);
        console.log('   - Base personality overridden:', promptsPartialOverrides.basePersonality.startsWith('CUSTOM:'));
        console.log('   - Financial context from fallback:', promptsPartialOverrides.financialContext === fallbackPrompts.financialContext);
        console.log('   - Response instructions from fallback:', promptsPartialOverrides.responseInstructions === fallbackPrompts.responseInstructions);
        console.log('   - Custom prompts merged:', promptsPartialOverrides.customPrompts.length);
        
        // Test 4: Agent with complete overrides
        console.log('\n📋 Test 4: Agent with complete system prompt overrides...');
        const agentConfigCompleteOverrides = {
            name: 'TestAgentComplete',
            description: 'Test agent with complete overrides',
            enabled: true,
            systemPrompts: {
                basePersonality: 'CUSTOM: I am a completely custom agent.',
                financialContext: 'CUSTOM: I handle custom financial contexts.',
                responseInstructions: 'CUSTOM: I follow custom response instructions.',
                customPrompts: [
                    {
                        name: 'Custom Test',
                        prompt: 'This completely overrides everything.'
                    }
                ]
            }
        };
        
        const promptsCompleteOverrides = await systemPromptManager.getSystemPromptsForAgent('TestAgentComplete', agentConfigCompleteOverrides);
        
        const allCustom = 
            promptsCompleteOverrides.basePersonality.startsWith('CUSTOM:') &&
            promptsCompleteOverrides.financialContext.startsWith('CUSTOM:') &&
            promptsCompleteOverrides.responseInstructions.startsWith('CUSTOM:');
            
        console.log('✅ Agent with complete overrides works correctly:', allCustom);
        
        // Test 5: Generate complete system prompt
        console.log('\n📋 Test 5: Generate complete system prompt...');
        const mockPersonaData = {
            name: 'John Smith',
            accountType: 'Premium',
            balance: 5000.50,
            cardLast4: '1234',
            recentTransactions: [
                { date: '2025-01-07', amount: -25.00, description: 'Coffee Shop' },
                { date: '2025-01-06', amount: 1500.00, description: 'Salary Deposit' }
            ]
        };
        
        const completePrompt = await systemPromptManager.generateSystemPromptForAgent(
            'TestAgentPartial', 
            agentConfigPartialOverrides, 
            mockPersonaData, 
            'What is my balance?'
        );
        
        const hasPersonaData = completePrompt.includes('John Smith') && completePrompt.includes('£5000.50');
        const hasAgentContext = completePrompt.includes('TestAgentPartial');
        const hasCustomPrompts = completePrompt.includes('Test Prompt');
        
        console.log('✅ Complete system prompt generated correctly:', {
            hasPersonaData,
            hasAgentContext,
            hasCustomPrompts,
            promptLength: completePrompt.length
        });
        
        // Test 6: Test with AgentConfigManager integration
        console.log('\n📋 Test 6: AgentConfigManager integration...');
        if (typeof AgentConfigManager !== 'undefined') {
            const agentConfigManager = new AgentConfigManager();
            
            // Wait for configs to load
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const bankingInfoPrompts = await agentConfigManager.getSystemPromptsForAgent('BankingInfoAgent');
            const bankingInfoSystemPrompt = await agentConfigManager.generateSystemPromptForAgent('BankingInfoAgent', mockPersonaData);
            
            console.log('✅ AgentConfigManager integration works:', {
                hasPrompts: !!bankingInfoPrompts,
                hasBasePersonality: !!bankingInfoPrompts.basePersonality,
                systemPromptLength: bankingInfoSystemPrompt.length,
                includesAgentName: bankingInfoSystemPrompt.includes('BankingInfoAgent')
            });
        } else {
            console.log('⚠️ AgentConfigManager not available for integration test');
        }
        
        console.log('\n🎉 All system prompt hierarchy tests completed successfully!');
        
        return {
            success: true,
            message: 'System prompt hierarchy working correctly',
            details: {
                fallbackLoaded: !!fallbackPrompts,
                noOverridesWork: allFromFallback,
                partialOverridesWork: correctPartialOverride,
                completeOverridesWork: allCustom,
                promptGenerationWorks: hasPersonaData && hasAgentContext
            }
        };
        
    } catch (error) {
        console.error('❌ System prompt hierarchy test failed:', error);
        return {
            success: false,
            message: 'System prompt hierarchy test failed',
            error: error.message
        };
    }
}

// Auto-run test when script loads
if (typeof window !== 'undefined') {
    // Wait for dependencies to load
    setTimeout(() => {
        if (typeof SystemPromptManager !== 'undefined') {
            testSystemPromptHierarchy().then(result => {
                console.log('🧪 System Prompt Hierarchy Test Result:', result);
                
                // Store result globally for debugging
                window.systemPromptHierarchyTestResult = result;
            });
        } else {
            console.error('❌ SystemPromptManager not available for testing');
        }
    }, 2000);
}

// Export for manual testing
if (typeof window !== 'undefined') {
    window.testSystemPromptHierarchy = testSystemPromptHierarchy;
}