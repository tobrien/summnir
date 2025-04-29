import { jest } from '@jest/globals';

// Mock fs/promises
const mockWriteFile = jest.fn();
const mockMkdir = jest.fn();
jest.unstable_mockModule('fs/promises', () => ({
    writeFile: mockWriteFile,
    mkdir: mockMkdir,
}));

// Mock path
// We need to use requireActual for path because jest.unstable_mockModule doesn't easily allow
// retaining parts of the original module when mocking others.
// @ts-ignore
const actualPath = jest.requireActual('path');
// @ts-ignore
const mockDirname = jest.fn((path) => actualPath.dirname(path));
// @ts-ignore
const mockJoin = jest.fn((...paths) => actualPath.join(...paths));
jest.unstable_mockModule('path', () => ({
    dirname: mockDirname,
    join: mockJoin,
    // Ensure other path functions are still available if needed, though not strictly necessary for this test
}));


// Mock logger
const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
};

// Dynamically import the module *after* mocking
const { writeOutputFile } = await import('../src/output');

describe('writeOutputFile', () => {
    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
    });

    it('should create directory and write file with string content', async () => {
        const baseDir = '/tmp/output';
        const year = 2024;
        const month = 5;
        const pattern = 'report.txt';
        const content = 'This is the report content.';
        // Use actualPath.join for expected values as mockJoin might change behavior
        // @ts-ignore
        const expectedPath = actualPath.join(baseDir, year.toString(), month.toString(), pattern);
        // @ts-ignore
        const expectedDir = actualPath.dirname(expectedPath);


        await writeOutputFile(baseDir, year, month, pattern, content, mockLogger);

        // Check that mocks were called with expected arguments derived from the inputs
        expect(mockJoin).toHaveBeenCalledWith(baseDir, year.toString(), month.toString(), pattern);
        // The path passed to dirname should be the result of the join call
        expect(mockDirname).toHaveBeenCalledWith(expectedPath);
        expect(mockMkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
        expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, content);
        expect(mockLogger.info).toHaveBeenCalledWith(`Output written to ${expectedPath}`);
    });

    it('should create directory and write file with JSON content', async () => {
        const baseDir = '/tmp/data';
        const year = 2023;
        const month = 12;
        const pattern = 'data.json';
        const content = { key: 'value', count: 42 };
        // @ts-ignore
        const expectedPath = actualPath.join(baseDir, year.toString(), month.toString(), pattern);
        // @ts-ignore
        const expectedDir = actualPath.dirname(expectedPath);
        const expectedJsonContent = JSON.stringify(content, null, 2);

        await writeOutputFile(baseDir, year, month, pattern, content, mockLogger);

        expect(mockJoin).toHaveBeenCalledWith(baseDir, year.toString(), month.toString(), pattern);
        expect(mockDirname).toHaveBeenCalledWith(expectedPath);
        expect(mockMkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
        expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, expectedJsonContent);
        expect(mockLogger.info).toHaveBeenCalledWith(`Output written to ${expectedPath}`);
    });

    it('should handle errors during mkdir', async () => {
        const baseDir = '/restricted';
        const year = 2024;
        const month = 1;
        const pattern = 'error.log';
        const content = 'Error log content';
        // @ts-ignore
        const expectedPath = actualPath.join(baseDir, year.toString(), month.toString(), pattern);
        // @ts-ignore
        const expectedDir = actualPath.dirname(expectedPath);
        const mkdirError = new Error('Permission denied');

        // @ts-ignore
        mockMkdir.mockRejectedValueOnce(mkdirError); // Simulate mkdir failure

        await expect(
            writeOutputFile(baseDir, year, month, pattern, content, mockLogger)
        ).rejects.toThrow(mkdirError);

        expect(mockJoin).toHaveBeenCalledWith(baseDir, year.toString(), month.toString(), pattern);
        expect(mockDirname).toHaveBeenCalledWith(expectedPath);
        expect(mockMkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
        expect(mockWriteFile).not.toHaveBeenCalled(); // writeFile should not be called if mkdir fails
        expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should handle errors during writeFile', async () => {
        const baseDir = '/tmp/output';
        const year = 2024;
        const month = 6;
        const pattern = 'fail.txt';
        const content = 'This should fail';
        // @ts-ignore
        const expectedPath = actualPath.join(baseDir, year.toString(), month.toString(), pattern);
        // @ts-ignore
        const expectedDir = actualPath.dirname(expectedPath);
        const writeFileError = new Error('Disk full');

        // Ensure mkdir resolves successfully for this test case
        // @ts-ignore
        mockMkdir.mockResolvedValue(undefined);
        // @ts-ignore
        mockWriteFile.mockRejectedValueOnce(writeFileError); // Simulate writeFile failure

        await expect(
            writeOutputFile(baseDir, year, month, pattern, content, mockLogger)
        ).rejects.toThrow(writeFileError);

        expect(mockJoin).toHaveBeenCalledWith(baseDir, year.toString(), month.toString(), pattern);
        expect(mockDirname).toHaveBeenCalledWith(expectedPath);
        expect(mockMkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
        expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, content);
        expect(mockLogger.info).not.toHaveBeenCalled(); // Logger info should not be called if writeFile fails
    });
});
