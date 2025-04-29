import { describe, it, expect, jest, beforeEach, afterEach, beforeAll } from '@jest/globals';
import type { JobConfig, SummnirConfig } from '../src/types';
import type { AnalysisConfig, Inputs as AnalysisInputs } from '../src/analysis';
import type { Logger } from 'winston';
import type * as Arguments from '../src/arguments';
import type * as Storage from '../src/util/storage';
import type * as Analysis from '../src/analysis';
import type * as Run from '../src/run';
import type * as Output from '../src/output';
import type { join as JoinType } from 'path';
import type * as GiveMeTheConfig from '@tobrien/givemetheconfig';
import type * as Cabazooka from '@tobrien/cabazooka';

// Define the return type for runModel based on its signature
type RunModelReturnType = { aiSummary: string, aiUsage: any, monthlySummary: AnalysisInputs };

// --- Mock Dependencies ---

const mockLogger = {
    info: jest.fn<Logger['info']>(),
    debug: jest.fn<Logger['debug']>(),
    error: jest.fn<Logger['error']>(),
};
jest.unstable_mockModule('../src/logging', () => ({
    getLogger: jest.fn(() => mockLogger),
    setLogLevel: jest.fn<(level: string) => void>(),
}));

const mockGiveMeTheConfigInstance = {
    // Add necessary mocked methods if configure uses them
};
jest.unstable_mockModule('@tobrien/givemetheconfig', () => ({
    create: jest.fn<typeof GiveMeTheConfig['create']>(() => mockGiveMeTheConfigInstance as any),
    SummnirConfigSchema: {
        partial: jest.fn(() => ({ shape: {} })), // Assuming shape is the only needed part
    }
}));

const mockCabazookaInstance = {
    // Add necessary mocked methods if configure uses them
};
jest.unstable_mockModule('@tobrien/cabazooka', () => ({
    create: jest.fn<typeof Cabazooka['create']>(() => mockCabazookaInstance as any),
}));

const mockStorageInstance = {
    exists: jest.fn<Storage.Utility['exists']>(),
    readFile: jest.fn<Storage.Utility['readFile']>(),
    writeFile: jest.fn<Storage.Utility['writeFile']>(),
    createDirectory: jest.fn<Storage.Utility['createDirectory']>(),
    isDirectory: jest.fn<Storage.Utility['isDirectory']>(),
    isFile: jest.fn<Storage.Utility['isFile']>(),
    isReadable: jest.fn<Storage.Utility['isReadable']>(),
    isWritable: jest.fn<Storage.Utility['isWritable']>(),
    isFileReadable: jest.fn<Storage.Utility['isFileReadable']>(),
    isDirectoryWritable: jest.fn<Storage.Utility['isDirectoryWritable']>(),
    isDirectoryReadable: jest.fn<Storage.Utility['isDirectoryReadable']>(),
    readStream: jest.fn<Storage.Utility['readStream']>(),
    forEachFileIn: jest.fn<Storage.Utility['forEachFileIn']>(),
    hashFile: jest.fn<Storage.Utility['hashFile']>(),
    listFiles: jest.fn<Storage.Utility['listFiles']>(),
};
jest.unstable_mockModule('../src/util/storage', () => ({
    create: jest.fn<typeof Storage['create']>(() => mockStorageInstance as Storage.Utility),
}));

const mockConfigure = jest.fn<typeof Arguments['configure']>();
jest.unstable_mockModule('../src/arguments', () => ({
    configure: mockConfigure,
}));

const mockCreateInputs = jest.fn<typeof Analysis['createInputs']>();
jest.unstable_mockModule('../src/analysis', () => ({
    createInputs: mockCreateInputs,
}));

const mockRunModel = jest.fn<typeof Run['runModel']>();
jest.unstable_mockModule('../src/run', () => ({
    runModel: mockRunModel,
}));

const mockWriteOutputFile = jest.fn<typeof Output['writeOutputFile']>();
jest.unstable_mockModule('../src/output', () => ({
    writeOutputFile: mockWriteOutputFile,
}));

// Mock 'path' join
jest.unstable_mockModule('path', () => ({
    join: jest.fn<typeof JoinType>((...args: string[]) => args.join('/')),
}));

// --- Test Suite --- //

// We need to dynamically import the mocked module *after* mocks are defined
let mainFunc: () => Promise<void>;
let loggingModule: { getLogger: () => typeof mockLogger; setLogLevel: (level: string) => void };
let argumentsModule: { configure: typeof mockConfigure };
let analysisModule: { createInputs: typeof mockCreateInputs };
let runModule: { runModel: typeof mockRunModel };
let outputModule: { writeOutputFile: typeof mockWriteOutputFile };
let storageModule: { create: () => typeof mockStorageInstance };
let pathModule: { join: (...args: string[]) => string };

beforeAll(async () => {
    // Import all mocked modules dynamically *after* jest.unstable_mockModule calls
    // @ts-ignore
    loggingModule = await import('../src/logging');
    // @ts-ignore
    argumentsModule = await import('../src/arguments');
    // @ts-ignore
    analysisModule = await import('../src/analysis');
    // @ts-ignore
    runModule = await import('../src/run');
    // @ts-ignore
    outputModule = await import('../src/output');
    // @ts-ignore
    storageModule = await import('../src/util/storage');
    pathModule = await import('path');

    // Dynamically import the main module last
    const module = await import('../src/summnir');
    mainFunc = module.main;
});

describe('main', () => {
    let mockSummnirConfig: SummnirConfig;
    let mockJobConfig: JobConfig;
    let mockAnalysisInputs: AnalysisInputs;
    let mockRunModelResult: RunModelReturnType;
    let mockProcessExit: jest.SpiedFunction<typeof process.exit>;
    let mockConsoleInfo: jest.SpiedFunction<typeof console.info>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined): never => {
            throw new Error(`process.exit called with code ${code}`);
        });
        mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation(() => { });

        mockSummnirConfig = {
            configDirectory: '.config',
            summaryDirectory: './summaries',
            verbose: false,
            debug: false,
            replace: false,
            model: 'gpt-4',
            timezone: 'UTC',
            contextDirectory: './context',
            activityDirectory: './activity',
            dryRun: false,
        };
        mockJobConfig = {
            job: 'test-job',
            year: 2023,
            month: 10,
            historyMonths: 3,
            summaryMonths: 1,
        };
        mockAnalysisInputs = {
            config: {
                parameters: {},
                temperature: 0.7,
                maxCompletionTokens: 1000,
                model: 'gpt-4',
                context: {},
                content: {},
                output: {
                    summary: { type: "summary", format: "markdown", name: "summary", pattern: 'summary-{{year}}-{{month}}.md' },
                    completion: { type: "summary", format: "markdown", name: "completion", pattern: 'completion-{{year}}-{{month}}.json' },
                    inputs: { type: "summary", format: "markdown", name: "inputs", pattern: 'inputs-{{year}}-{{month}}.json' },
                },
            } as AnalysisConfig,
            messages: [],
            contributingFiles: {
                context: [],
                content: [],
            },
        };
        mockRunModelResult = {
            aiSummary: 'This is a test summary.',
            aiUsage: { tokens: 100 },
            monthlySummary: mockAnalysisInputs,
        };

        // Reset mock implementations to defaults
        mockConfigure.mockResolvedValue([mockSummnirConfig, mockJobConfig] as [SummnirConfig, JobConfig]);
        mockStorageInstance.exists.mockResolvedValue(false as boolean);
        mockCreateInputs.mockResolvedValue(mockAnalysisInputs as AnalysisInputs);
        mockRunModel.mockResolvedValue(mockRunModelResult as RunModelReturnType);
    });

    afterEach(() => {
        mockProcessExit.mockRestore();
        mockConsoleInfo.mockRestore();
    });

    it('should run successfully with default options', async () => {
        await mainFunc();

        const logger = loggingModule.getLogger();
        const join = pathModule.join;

        expect(argumentsModule.configure).toHaveBeenCalledTimes(1);
        expect(logger.debug).toHaveBeenCalledWith('Summnir config: %j', mockSummnirConfig);
        expect(logger.debug).toHaveBeenCalledWith('Job config: %j', mockJobConfig);
        expect(analysisModule.createInputs).toHaveBeenCalledWith(
            mockJobConfig.job,
            {
                year: mockJobConfig.year,
                month: mockJobConfig.month,
                historyMonths: mockJobConfig.historyMonths,
                summaryMonths: mockJobConfig.summaryMonths
            },
            mockSummnirConfig,
            mockJobConfig
        );

        // Calculate the path *as generated by the mocked join*
        const expectedOutputPath = [
            mockSummnirConfig.summaryDirectory,
            mockJobConfig.year.toString(),
            mockJobConfig.month.toString(),
            mockAnalysisInputs.config.output.summary.pattern
        ].join('/');

        // Check that join was called correctly
        expect(join).toHaveBeenCalledWith(
            mockSummnirConfig.summaryDirectory,
            mockJobConfig.year.toString(),
            mockJobConfig.month.toString(),
            mockAnalysisInputs.config.output.summary.pattern
        )
        // Check that exists was called with the output of the mocked join
        expect(mockStorageInstance.exists).toHaveBeenCalledWith(expectedOutputPath);

        expect(runModule.runModel).toHaveBeenCalledWith(mockAnalysisInputs.config, mockSummnirConfig, mockJobConfig);

        expect(outputModule.writeOutputFile).toHaveBeenCalledTimes(3);
        expect(outputModule.writeOutputFile).toHaveBeenCalledWith(
            mockSummnirConfig.summaryDirectory,
            mockJobConfig.year,
            mockJobConfig.month,
            mockAnalysisInputs.config.output.summary.pattern,
            mockRunModelResult.aiSummary,
            logger
        );
        expect(outputModule.writeOutputFile).toHaveBeenCalledWith(
            mockSummnirConfig.summaryDirectory,
            mockJobConfig.year,
            mockJobConfig.month,
            mockAnalysisInputs.config.output.completion.pattern,
            mockRunModelResult.aiUsage,
            logger
        );
        expect(outputModule.writeOutputFile).toHaveBeenCalledWith(
            mockSummnirConfig.summaryDirectory,
            mockJobConfig.year,
            mockJobConfig.month,
            mockAnalysisInputs.config.output.inputs.pattern,
            mockRunModelResult.monthlySummary,
            logger
        );

        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Generating test-job summary'));
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully generated summary'));

        expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should exit with error if 429 retries are exhausted', async () => {
        mockJobConfig.historyMonths = 0;
        mockJobConfig.summaryMonths = 0;
        mockConfigure.mockResolvedValue([mockSummnirConfig, mockJobConfig] as [SummnirConfig, JobConfig]);

        const error429 = new Error('429 Request too large (Limit 1000, Requested 1500)');
        mockRunModel.mockRejectedValue(error429 as Error);

        await expect(mainFunc()).rejects.toThrow('process.exit called with code 1');

        const logger = loggingModule.getLogger();

        expect(runModule.runModel).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`Error generating summary: Unable to generate summary even with minimum history and summary months. Last error: ${error429.message}`));
        expect(outputModule.writeOutputFile).not.toHaveBeenCalled();
        expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle general errors during processing and exit', async () => {
        const generalError = new Error('Something went wrong');
        runModule.runModel.mockRejectedValue(generalError as Error);

        await expect(mainFunc()).rejects.toThrow('process.exit called with code 1');

        const logger = loggingModule.getLogger();

        expect(runModule.runModel).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(`Error generating summary: ${generalError.message} ${generalError.stack}`);
        expect(outputModule.writeOutputFile).not.toHaveBeenCalled();
        expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    // Helper function to re-apply mocks after jest.resetModules()
    const applyMocks = () => {
        const mockSetLogLevel = jest.fn<(level: string) => void>();
        const mockGetLogger = jest.fn(() => mockLogger);
        jest.unstable_mockModule('../src/logging', () => ({ getLogger: mockGetLogger, setLogLevel: mockSetLogLevel }));
        jest.unstable_mockModule('../src/arguments', () => ({ configure: mockConfigure }));
        jest.unstable_mockModule('../src/analysis', () => ({ createInputs: mockCreateInputs }));
        jest.unstable_mockModule('../src/run', () => ({ runModel: mockRunModel }));
        jest.unstable_mockModule('../src/output', () => ({ writeOutputFile: mockWriteOutputFile }));
        jest.unstable_mockModule('../src/util/storage', () => ({ create: jest.fn(() => mockStorageInstance) }));
        jest.unstable_mockModule('path', () => ({ join: jest.fn<typeof JoinType>((...args: string[]) => args.join('/')) }));
        jest.unstable_mockModule('@tobrien/givemetheconfig', () => ({
            create: jest.fn(() => mockGiveMeTheConfigInstance as any),
            SummnirConfigSchema: { partial: jest.fn(() => ({ shape: {} })) }
        }));
        jest.unstable_mockModule('@tobrien/cabazooka', () => ({ create: jest.fn(() => mockCabazookaInstance as any) }));
        // Return the specific mocks needed for assertions in the test
        return { mockSetLogLevel };
    };

    it('should set log level to verbose if verbose flag is true', async () => {
        mockSummnirConfig.verbose = true;
        mockSummnirConfig.debug = false;
        mockConfigure.mockResolvedValue([mockSummnirConfig, mockJobConfig] as [SummnirConfig, JobConfig]);

        jest.resetModules();
        const { mockSetLogLevel } = applyMocks(); // Apply mocks and get the one we need

        const { main: mainForThisTest } = await import('../src/summnir');
        await mainForThisTest();

        expect(mockSetLogLevel).toHaveBeenCalledWith('verbose');
        expect(mockSetLogLevel).not.toHaveBeenCalledWith('debug');
        expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should set log level to debug if debug flag is true', async () => {
        mockSummnirConfig.verbose = false;
        mockSummnirConfig.debug = true;
        mockConfigure.mockResolvedValue([mockSummnirConfig, mockJobConfig] as [SummnirConfig, JobConfig]);

        jest.resetModules();
        const { mockSetLogLevel } = applyMocks(); // Apply mocks and get the one we need

        const { main: mainForThisTest } = await import('../src/summnir');
        await mainForThisTest();

        expect(mockSetLogLevel).toHaveBeenCalledWith('debug');
        expect(mockProcessExit).not.toHaveBeenCalled();
    });
});
