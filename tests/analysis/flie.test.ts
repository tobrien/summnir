/**
 * Tests for file analysis module
 */
import { jest } from '@jest/globals';
import { join } from 'path';
import type { FileContents } from '../../src/types';

// Define interface types for mocks
interface MockLogger {
    debug: jest.Mock;
    warn: jest.Mock;
}

interface MockStorage {
    readFile: jest.Mock;
    exists: jest.Mock;
}

interface MockFileModule {
    readFiles: (directory: string, pattern?: string) => Promise<FileContents>;
    checkDirectory: (directory: string) => Promise<void>;
}

// Mock dependencies before importing the module being tested
jest.unstable_mockModule('glob', () => ({
    glob: {
        sync: jest.fn()
    }
}));

jest.unstable_mockModule('../../src/logging', () => ({
    getLogger: jest.fn(() => ({
        debug: jest.fn(),
        warn: jest.fn()
    }))
}));

jest.unstable_mockModule('../../src/util/storage', () => ({
    create: jest.fn(() => ({
        readFile: jest.fn(),
        exists: jest.fn()
    }))
}));

let mockConstants: { JOB_REQUIRED_FILES: string[], DEFAULT_CHARACTER_ENCODING: string } = {
    JOB_REQUIRED_FILES: ['config.json', 'settings.json'],
    DEFAULT_CHARACTER_ENCODING: 'utf-8'
};

jest.unstable_mockModule('../../src/constants', () => {
    return mockConstants;
});

// Variables to hold mocked modules
let mockGlob: { glob: { sync: jest.Mock } };
let mockLogger: { getLogger: jest.Mock };
let mockStorage: { create: jest.Mock };
let fileModule: MockFileModule;

// Load mocked dependencies and module under test
beforeAll(async () => {
    // @ts-ignore
    mockGlob = await import('glob');
    // @ts-ignore
    mockLogger = await import('../../src/logging');
    // @ts-ignore
    mockStorage = await import('../../src/util/storage');
    // @ts-ignore
    mockConstants = await import('../../src/constants');
    // @ts-ignore
    fileModule = await import('../../src/analysis/file');
});

describe('File analysis module', () => {
    let mockStorageInstance: MockStorage;
    let mockLoggerInstance: MockLogger;

    beforeEach(() => {
        jest.clearAllMocks();

        mockLoggerInstance = {
            debug: jest.fn(),
            warn: jest.fn()
        };

        mockStorageInstance = {
            readFile: jest.fn(),
            exists: jest.fn()
        };

        // @ts-ignore
        mockLogger.getLogger.mockReturnValue(mockLoggerInstance);
        // @ts-ignore
        mockStorage.create.mockReturnValue(mockStorageInstance);
    });

    describe('readFiles', () => {
        test('reads files based on provided pattern', async () => {
            // Setup mocks
            const mockFiles = ['file1.txt', 'file2.txt'];
            const mockDirectory = '/test/dir';
            const mockPattern = '*.txt';
            const mockFileContent = 'file content';

            // @ts-ignore
            mockGlob.glob.sync.mockReturnValue(mockFiles);
            // @ts-ignore
            mockStorageInstance.readFile.mockResolvedValue(mockFileContent);

            // Call function
            const result = await fileModule.readFiles(mockDirectory, mockPattern);

            // Assertions
            // @ts-ignore
            expect(mockGlob.glob.sync).toHaveBeenCalledWith(mockPattern, {
                cwd: mockDirectory,
                nodir: true
            });

            expect(mockStorageInstance.readFile).toHaveBeenCalledTimes(mockFiles.length);

            // Check content structure matches expected
            const expectedResult: FileContents = {};
            // @ts-ignore
            expectedResult[join(mockDirectory, 'file1.txt')] = mockFileContent;
            // @ts-ignore
            expectedResult[join(mockDirectory, 'file2.txt')] = mockFileContent;
            expect(result).toEqual(expectedResult);
        });

        test('uses default pattern when pattern is not provided', async () => {
            // Setup
            const mockFiles = ['file1.txt'];
            const mockDirectory = '/test/dir';

            // @ts-ignore
            mockGlob.glob.sync.mockReturnValue(mockFiles);
            // @ts-ignore
            mockStorageInstance.readFile.mockResolvedValue('content');

            // Call function
            await fileModule.readFiles(mockDirectory);

            // Assertions
            // @ts-ignore
            expect(mockGlob.glob.sync).toHaveBeenCalledWith('**/*', {
                cwd: mockDirectory,
                nodir: true
            });
        });

        test('handles error when reading file fails', async () => {
            // Setup
            const mockFiles = ['file1.txt'];
            const mockDirectory = '/test/dir';
            const testError = new Error('test error');

            // @ts-ignore
            mockGlob.glob.sync.mockReturnValue(mockFiles);
            // @ts-ignore
            mockStorageInstance.readFile.mockRejectedValue(testError);

            // Call function
            const result = await fileModule.readFiles(mockDirectory);

            // Assertions
            expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
                expect.stringContaining(`Could not read file ${join(mockDirectory, 'file1.txt')}: ${testError}`)
            );
            expect(result).toEqual({});
        });
    });

    describe('checkDirectory', () => {
        const mockRequiredFiles = ['config.json', 'settings.json'];
        test('succeeds when directory exists and contains required files', async () => {
            // Setup
            const mockDirectory = '/test/dir';
            // @ts-ignore
            mockStorageInstance.exists.mockResolvedValue(true);

            // Call function
            await fileModule.checkDirectory(mockDirectory);

            // Assertions
            expect(mockStorageInstance.exists).toHaveBeenCalledWith(mockDirectory);
            for (const file of mockRequiredFiles) {
                expect(mockStorageInstance.exists).toHaveBeenCalledWith(join(mockDirectory, file));
            }
        });

        test('throws when directory does not exist', async () => {
            // Setup
            const mockDirectory = '/test/dir';
            // @ts-ignore
            mockStorageInstance.exists.mockResolvedValueOnce(false);

            // Call and assert
            await expect(fileModule.checkDirectory(mockDirectory)).rejects.toThrow(
                `Configuration Directory ${mockDirectory} does not exist`
            );
        });

        test('throws when a required file is missing', async () => {
            // Setup
            const mockDirectory = '/test/dir';

            // First call for directory check returns true
            // @ts-ignore
            mockStorageInstance.exists.mockResolvedValueOnce(true);
            // Second call for first required file returns true
            // @ts-ignore
            mockStorageInstance.exists.mockResolvedValueOnce(true);
            // Third call for second required file returns false
            // @ts-ignore
            mockStorageInstance.exists.mockResolvedValueOnce(false);

            // Call and assert
            await expect(fileModule.checkDirectory(mockDirectory)).rejects.toThrow(
                `Missing required file in ${mockDirectory}: ${mockRequiredFiles[1]}`
            );
        });
    });
});
