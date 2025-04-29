import { jest } from '@jest/globals';
import { JobConfig, SummnirConfig } from '../src/types';
import { AnalysisConfig } from '../src/analysis';

// Mock dependencies before importing the module under test
const mockGetLogger = jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});
const mockCreateInputs = jest.fn();
const mockOpenAIChatCompletionsCreate = jest.fn();

jest.unstable_mockModule('../src/logging', () => ({
    getLogger: mockGetLogger,
}));

jest.unstable_mockModule('../src/analysis', () => ({
    createInputs: mockCreateInputs,
}));

// Mock the OpenAI class constructor and the specific method used
jest.unstable_mockModule('openai', () => ({
    OpenAI: jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: mockOpenAIChatCompletionsCreate,
            },
        },
    })),
}));

// Now import the module under test
const { runModel } = await import('../src/run');

describe('runModel', () => {
    // @ts-ignore
    const analysisConfig: AnalysisConfig = {
        model: 'gpt-4',
        temperature: 0.7,
        maxCompletionTokens: 500,
        // Add other required fields if any
    };
    // @ts-ignore
    const summnirConfig: SummnirConfig = { /* Mock config */ };
    // @ts-ignore
    const jobConfig: JobConfig = {
        job: 'test-job',
        year: 2023,
        month: 10,
        historyMonths: 3,
        summaryMonths: 1,
        // Add other required fields if any
    };

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
        // Reset process.env if needed, or set it here
        process.env.OPENAI_API_KEY = 'test-key';
    });

    it('should call createInputs and OpenAI API, returning the summary', async () => {
        const mockMonthlySummary = {
            messages: [{ role: 'user', content: 'Test prompt' }],
            contributingFiles: { content: ['file1.txt'], metadata: {} } // Ensure content is not empty
            // Add other necessary fields
        };
        const mockApiResponse = {
            choices: [{ message: { content: 'AI generated summary' } }],
            usage: { total_tokens: 100 },
            // Add other fields returned by OpenAI API
        };

        // @ts-ignore
        mockCreateInputs.mockResolvedValue(mockMonthlySummary);
        // @ts-ignore
        mockOpenAIChatCompletionsCreate.mockResolvedValue(mockApiResponse);

        const result = await runModel(analysisConfig, summnirConfig, jobConfig);

        expect(mockCreateInputs).toHaveBeenCalledWith(
            jobConfig.job,
            {
                year: jobConfig.year,
                month: jobConfig.month,
                historyMonths: jobConfig.historyMonths,
                summaryMonths: jobConfig.summaryMonths,
            },
            summnirConfig,
            jobConfig
        );
        expect(mockOpenAIChatCompletionsCreate).toHaveBeenCalledWith({
            model: analysisConfig.model,
            messages: mockMonthlySummary.messages,
            temperature: analysisConfig.temperature,
            max_completion_tokens: analysisConfig.maxCompletionTokens,
        });
        expect(result.aiSummary).toBe('AI generated summary');
        expect(result.aiUsage).toEqual(mockApiResponse);
        expect(result.monthlySummary).toEqual(mockMonthlySummary);
        // @ts-ignore
        expect(mockGetLogger().info).not.toHaveBeenCalledWith(expect.stringContaining('Skipping generation'));
    });

    it('should skip OpenAI call if createInputs returns no content', async () => {
        const mockMonthlySummary = {
            messages: [],
            contributingFiles: { content: [], metadata: {} } // Empty content
            // Add other necessary fields
        };

        // @ts-ignore
        mockCreateInputs.mockResolvedValue(mockMonthlySummary);

        const result = await runModel(analysisConfig, summnirConfig, jobConfig);

        expect(mockCreateInputs).toHaveBeenCalledTimes(1);
        expect(mockOpenAIChatCompletionsCreate).not.toHaveBeenCalled();
        expect(result.aiSummary).toBe('');
        expect(result.aiUsage).toBeNull();
        // @ts-ignore
        expect(result.monthlySummary).toEqual(mockMonthlySummary);
        // @ts-ignore
        expect(mockGetLogger().info).toHaveBeenCalledWith(`No content found for ${jobConfig.job} in ${jobConfig.year}-${jobConfig.month}. Skipping generation.`);
    });

    it('should use existingMonthlySummary if provided', async () => {
        const existingMonthlySummary = {
            messages: [{ role: 'user', content: 'Existing prompt' }],
            contributingFiles: { content: ['file2.txt'], metadata: {} }, // Ensure content is not empty
            // Add other necessary fields
        };
        const mockApiResponse = {
            choices: [{ message: { content: 'AI summary from existing' } }],
            usage: { total_tokens: 120 },
            // Add other fields returned by OpenAI API
        };

        // @ts-ignore
        mockOpenAIChatCompletionsCreate.mockResolvedValue(mockApiResponse);

        const result = await runModel(analysisConfig, summnirConfig, jobConfig, existingMonthlySummary);

        expect(mockCreateInputs).not.toHaveBeenCalled();
        expect(mockOpenAIChatCompletionsCreate).toHaveBeenCalledWith({
            model: analysisConfig.model,
            messages: existingMonthlySummary.messages,
            temperature: analysisConfig.temperature,
            max_completion_tokens: analysisConfig.maxCompletionTokens,
        });
        expect(result.aiSummary).toBe('AI summary from existing');
        expect(result.aiUsage).toEqual(mockApiResponse);
        expect(result.monthlySummary).toEqual(existingMonthlySummary);
        // @ts-ignore
        expect(mockGetLogger().info).not.toHaveBeenCalledWith(expect.stringContaining('Skipping generation'));
    });

    it('should skip OpenAI call if existingMonthlySummary has no content', async () => {
        const existingMonthlySummary = {
            messages: [],
            contributingFiles: { content: [], metadata: {} }, // Empty content
            // Add other necessary fields
        };

        const result = await runModel(analysisConfig, summnirConfig, jobConfig, existingMonthlySummary);

        expect(mockCreateInputs).not.toHaveBeenCalled();
        expect(mockOpenAIChatCompletionsCreate).not.toHaveBeenCalled();
        expect(result.aiSummary).toBe('');
        expect(result.aiUsage).toBeNull();
        expect(result.monthlySummary).toEqual(existingMonthlySummary);
        // @ts-ignore
        expect(mockGetLogger().info).toHaveBeenCalledWith(`No content found for ${jobConfig.job} in ${jobConfig.year}-${jobConfig.month}. Skipping generation.`);
    });
});
