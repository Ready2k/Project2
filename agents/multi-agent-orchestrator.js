/**
 * MultiAgentOrchestrator - Handles complex requests requiring multiple agents
 * Manages agent handoffs, context sharing, and conditional workflows
 */
class MultiAgentOrchestrator {
    constructor(router) {
        this.router = router;
        this.debug = window.debugManager?.createModuleLogger('MultiAgentOrchestrator') || console;
        this.activeWorkflows = new Map();
        this.workflowResults = new Map();
        
        this.debug.info('MultiAgentOrchestrator initialized');
    }

    /**
     * Analyze if input requires multi-agent orchestration
     * @param {string} inputText - User input text
     * @returns {Object|null} - Workflow plan or null if single agent sufficient
     */
    analyzeMultiAgentRequest(inputText) {
        const lowerInput = inputText.toLowerCase();
        
        // Pattern: Check balance and conditional payment
        const balanceAndPaymentPattern = /check.*balance.*and.*if.*pay|balance.*if.*enough.*pay|if.*have.*enough.*pay/;
        if (balanceAndPaymentPattern.test(lowerInput)) {
            return this.createBalanceAndPaymentWorkflow(inputText);
        }
        
        // Pattern: Transfer between accounts with verification
        const transferWithVerificationPattern = /transfer.*from.*to.*if|move.*money.*if.*verify/;
        if (transferWithVerificationPattern.test(lowerInput)) {
            return this.createTransferWithVerificationWorkflow(inputText);
        }
        
        // Pattern: Check transactions and report fraud if suspicious
        const checkAndReportPattern = /check.*transactions.*and.*if.*suspicious|review.*activity.*report/;
        if (checkAndReportPattern.test(lowerInput)) {
            return this.createCheckAndReportWorkflow(inputText);
        }
        
        // Pattern: Multiple actions in sequence
        const sequentialPattern = /first.*then|after.*do|once.*complete/;
        if (sequentialPattern.test(lowerInput)) {
            return this.createSequentialWorkflow(inputText);
        }
        
        return null;
    }

    /**
     * Create workflow for balance check followed by conditional payment
     * @param {string} inputText - Original user input
     * @returns {Object} - Workflow configuration
     */
    createBalanceAndPaymentWorkflow(inputText) {
        // Extract payment amount and target
        const amountMatch = inputText.match(/£(\d+(?:\.\d{2})?)/);
        const amount = amountMatch ? amountMatch[1] : null;
        
        const creditCardMatch = /credit card|card bill/i.test(inputText);
        const target = creditCardMatch ? 'credit card' : 'payment';
        
        return {
            id: `balance_payment_${Date.now()}`,
            type: 'balance_and_payment',
            originalInput: inputText,
            steps: [
                {
                    id: 'check_balance',
                    agent: 'BankingInfoAgent',
                    action: 'get_balance',
                    input: 'What is my current account balance?',
                    condition: null,
                    extractData: ['balance']
                },
                {
                    id: 'conditional_payment',
                    agent: 'PaymentsAgent',
                    action: 'make_payment',
                    input: `Pay £${amount} off my ${target}`,
                    condition: {
                        type: 'balance_check',
                        field: 'balance',
                        operator: '>=',
                        value: parseFloat(amount || 0),
                        failureMessage: `Insufficient funds. Your balance is not enough to pay £${amount}.`
                    },
                    extractData: ['payment_confirmation']
                }
            ],
            context: {
                amount,
                target,
                requiresConfirmation: true
            }
        };
    }

    /**
     * Create workflow for transfer with verification
     * @param {string} inputText - Original user input
     * @returns {Object} - Workflow configuration
     */
    createTransferWithVerificationWorkflow(inputText) {
        return {
            id: `transfer_verify_${Date.now()}`,
            type: 'transfer_with_verification',
            originalInput: inputText,
            steps: [
                {
                    id: 'verify_identity',
                    agent: 'IDVAgent',
                    action: 'verify_identity',
                    input: 'Please verify your identity for this transfer',
                    condition: null,
                    extractData: ['verification_status']
                },
                {
                    id: 'process_transfer',
                    agent: 'PaymentsAgent',
                    action: 'transfer_funds',
                    input: inputText,
                    condition: {
                        type: 'verification_check',
                        field: 'verification_status',
                        operator: '==',
                        value: 'verified',
                        failureMessage: 'Identity verification failed. Transfer cannot proceed.'
                    },
                    extractData: ['transfer_confirmation']
                }
            ]
        };
    }

    /**
     * Create workflow for checking transactions and reporting fraud
     * @param {string} inputText - Original user input
     * @returns {Object} - Workflow configuration
     */
    createCheckAndReportWorkflow(inputText) {
        return {
            id: `check_report_${Date.now()}`,
            type: 'check_and_report',
            originalInput: inputText,
            steps: [
                {
                    id: 'check_transactions',
                    agent: 'BankingInfoAgent',
                    action: 'get_recent_transactions',
                    input: 'Show me my recent transactions',
                    condition: null,
                    extractData: ['transactions', 'suspicious_activity']
                },
                {
                    id: 'report_fraud',
                    agent: 'FraudAgent',
                    action: 'report_suspicious_activity',
                    input: 'Report suspicious activity found in transactions',
                    condition: {
                        type: 'data_check',
                        field: 'suspicious_activity',
                        operator: '==',
                        value: true,
                        failureMessage: 'No suspicious activity detected in your recent transactions.'
                    },
                    extractData: ['fraud_report']
                }
            ]
        };
    }

    /**
     * Create generic sequential workflow
     * @param {string} inputText - Original user input
     * @returns {Object} - Workflow configuration
     */
    createSequentialWorkflow(inputText) {
        // This would need more sophisticated parsing
        // For now, return a basic structure
        return {
            id: `sequential_${Date.now()}`,
            type: 'sequential',
            originalInput: inputText,
            steps: [], // Would be populated by more advanced parsing
            requiresManualParsing: true
        };
    }

    /**
     * Execute a multi-agent workflow
     * @param {Object} workflow - Workflow configuration
     * @param {Object} context - Execution context
     * @returns {Promise<Object>} - Workflow execution result
     */
    async executeWorkflow(workflow, context) {
        const workflowId = workflow.id;
        this.activeWorkflows.set(workflowId, workflow);
        this.workflowResults.set(workflowId, { steps: [], context: {} });
        
        this.debug.info('Starting workflow execution', {
            workflowId,
            type: workflow.type,
            stepsCount: workflow.steps.length
        });

        try {
            const results = this.workflowResults.get(workflowId);
            
            for (let i = 0; i < workflow.steps.length; i++) {
                const step = workflow.steps[i];
                
                this.debug.info(`Executing workflow step ${i + 1}/${workflow.steps.length}`, {
                    stepId: step.id,
                    agent: step.agent
                });

                // Check condition before executing step
                if (step.condition && !this.evaluateCondition(step.condition, results.context)) {
                    this.debug.info('Step condition not met, skipping', {
                        stepId: step.id,
                        condition: step.condition,
                        failureMessage: step.condition.failureMessage
                    });
                    
                    return {
                        success: false,
                        workflowId,
                        completedSteps: i,
                        totalSteps: workflow.steps.length,
                        response: step.condition.failureMessage || 'Workflow condition not met',
                        reason: 'condition_failed',
                        context: results.context
                    };
                }

                // Execute the step
                const stepResult = await this.executeWorkflowStep(step, context, results.context);
                
                // Store step result
                results.steps.push({
                    stepId: step.id,
                    agent: step.agent,
                    success: stepResult.success,
                    response: stepResult.response,
                    extractedData: stepResult.extractedData || {},
                    processingTime: stepResult.processingTime
                });

                // Update workflow context with extracted data
                if (stepResult.extractedData) {
                    Object.assign(results.context, stepResult.extractedData);
                }

                // If step failed and no condition handling, stop workflow
                if (!stepResult.success && !step.continueOnFailure) {
                    this.debug.error('Workflow step failed, stopping execution', {
                        stepId: step.id,
                        error: stepResult.error
                    });
                    
                    // Generate user-friendly error message based on step type
                    let userFriendlyMessage = stepResult.response;
                    if (step.id === 'conditional_payment' && stepResult.error?.includes('Guardrails violation')) {
                        userFriendlyMessage = "I'm sorry, but I need additional security verification to process this payment. Please contact our customer service team to complete this transaction securely.";
                    } else if (step.id === 'check_balance' && !stepResult.success) {
                        userFriendlyMessage = "I'm unable to check your account balance at the moment. Please try again later or contact customer service.";
                    }
                    
                    return {
                        success: false,
                        workflowId,
                        completedSteps: i + 1,
                        totalSteps: workflow.steps.length,
                        response: userFriendlyMessage,
                        reason: 'step_failed',
                        context: results.context,
                        steps: results.steps,
                        technicalError: stepResult.error
                    };
                }
            }

            // All steps completed successfully
            const finalResponse = this.generateWorkflowSummary(workflow, results);
            
            this.debug.info('Workflow completed successfully', {
                workflowId,
                completedSteps: workflow.steps.length,
                totalSteps: workflow.steps.length
            });

            return {
                success: true,
                workflowId,
                completedSteps: workflow.steps.length,
                totalSteps: workflow.steps.length,
                response: finalResponse,
                context: results.context,
                steps: results.steps
            };

        } catch (error) {
            this.debug.error('Workflow execution failed', {
                workflowId,
                error: error.message
            });

            return {
                success: false,
                workflowId,
                response: `Workflow execution failed: ${error.message}`,
                reason: 'execution_error',
                error: error.message
            };
        } finally {
            // Clean up
            this.activeWorkflows.delete(workflowId);
            // Keep results for a while for debugging
            setTimeout(() => {
                this.workflowResults.delete(workflowId);
            }, 5 * 60 * 1000); // 5 minutes
        }
    }

    /**
     * Execute a single workflow step
     * @param {Object} step - Step configuration
     * @param {Object} globalContext - Global execution context
     * @param {Object} workflowContext - Workflow-specific context
     * @returns {Promise<Object>} - Step execution result
     */
    async executeWorkflowStep(step, globalContext, workflowContext) {
        const startTime = Date.now();
        
        try {
            // Find the agent for this step
            const agent = this.router.agents.find(a => a.name === step.agent);
            if (!agent) {
                throw new Error(`Agent ${step.agent} not found`);
            }

            // Prepare context for the agent with workflow data
            const stepContext = {
                ...globalContext,
                workflowContext,
                workflowStep: step,
                isWorkflowExecution: true
            };

            // Execute the agent
            const result = await agent.handle(step.input, stepContext);
            
            // Extract data if specified
            let extractedData = {};
            if (step.extractData && result.success) {
                extractedData = this.extractDataFromResponse(result.response, step.extractData, step.agent);
            }

            return {
                success: result.success,
                response: result.response,
                extractedData,
                processingTime: Date.now() - startTime,
                agentName: step.agent
            };

        } catch (error) {
            return {
                success: false,
                response: `Step execution failed: ${error.message}`,
                error: error.message,
                processingTime: Date.now() - startTime,
                agentName: step.agent
            };
        }
    }

    /**
     * Evaluate a workflow condition
     * @param {Object} condition - Condition configuration
     * @param {Object} context - Current workflow context
     * @returns {boolean} - True if condition is met
     */
    evaluateCondition(condition, context) {
        const { type, field, operator, value } = condition;
        const fieldValue = context[field];

        switch (operator) {
            case '>=':
                return fieldValue >= value;
            case '<=':
                return fieldValue <= value;
            case '>':
                return fieldValue > value;
            case '<':
                return fieldValue < value;
            case '==':
                return fieldValue === value;
            case '!=':
                return fieldValue !== value;
            case 'exists':
                return fieldValue !== undefined && fieldValue !== null;
            case 'not_exists':
                return fieldValue === undefined || fieldValue === null;
            default:
                this.debug.warn('Unknown condition operator', { operator });
                return false;
        }
    }

    /**
     * Extract structured data from agent response
     * @param {string} response - Agent response text
     * @param {Array} extractFields - Fields to extract
     * @param {string} agentName - Name of the agent
     * @returns {Object} - Extracted data
     */
    extractDataFromResponse(response, extractFields, agentName) {
        const extracted = {};
        const lowerResponse = response.toLowerCase();

        for (const field of extractFields) {
            switch (field) {
                case 'balance':
                    const balanceMatch = response.match(/£([\d,]+(?:\.\d{2})?)/);
                    if (balanceMatch) {
                        extracted.balance = parseFloat(balanceMatch[1].replace(/,/g, ''));
                    }
                    break;
                    
                case 'verification_status':
                    if (lowerResponse.includes('verified') || lowerResponse.includes('confirmed')) {
                        extracted.verification_status = 'verified';
                    } else if (lowerResponse.includes('failed') || lowerResponse.includes('denied')) {
                        extracted.verification_status = 'failed';
                    }
                    break;
                    
                case 'payment_confirmation':
                    extracted.payment_confirmation = lowerResponse.includes('payment') && 
                        (lowerResponse.includes('successful') || lowerResponse.includes('completed'));
                    break;
                    
                case 'suspicious_activity':
                    extracted.suspicious_activity = lowerResponse.includes('suspicious') || 
                        lowerResponse.includes('unusual') || lowerResponse.includes('fraud');
                    break;
                    
                default:
                    this.debug.warn('Unknown extraction field', { field, agentName });
            }
        }

        return extracted;
    }

    /**
     * Generate a summary response for completed workflow
     * @param {Object} workflow - Workflow configuration
     * @param {Object} results - Workflow execution results
     * @returns {string} - Summary response
     */
    generateWorkflowSummary(workflow, results) {
        const { type, context } = workflow;
        const { steps } = results;

        switch (type) {
            case 'balance_and_payment':
                const balanceStep = steps.find(s => s.stepId === 'check_balance');
                const paymentStep = steps.find(s => s.stepId === 'conditional_payment');
                
                if (balanceStep && paymentStep && paymentStep.success) {
                    return `I've checked your balance and successfully processed the payment of £${context.amount} to your ${context.target}. ${balanceStep.response} ${paymentStep.response}`;
                } else if (balanceStep && !paymentStep) {
                    return `I've checked your balance: ${balanceStep.response} However, the payment could not be processed due to insufficient funds.`;
                }
                break;
                
            case 'transfer_with_verification':
                return `I've completed the identity verification and transfer process. ${steps.map(s => s.response).join(' ')}`;
                
            case 'check_and_report':
                return `I've reviewed your transactions and handled any suspicious activity. ${steps.map(s => s.response).join(' ')}`;
                
            default:
                return `I've completed the multi-step process: ${steps.map(s => s.response).join(' ')}`;
        }

        return 'Multi-step process completed successfully.';
    }

    /**
     * Get workflow status
     * @param {string} workflowId - Workflow ID
     * @returns {Object|null} - Workflow status or null if not found
     */
    getWorkflowStatus(workflowId) {
        const workflow = this.activeWorkflows.get(workflowId);
        const results = this.workflowResults.get(workflowId);
        
        if (!workflow) {
            return null;
        }

        return {
            id: workflowId,
            type: workflow.type,
            totalSteps: workflow.steps.length,
            completedSteps: results ? results.steps.length : 0,
            isActive: this.activeWorkflows.has(workflowId),
            context: results ? results.context : {}
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiAgentOrchestrator;
} else {
    window.MultiAgentOrchestrator = MultiAgentOrchestrator;
}