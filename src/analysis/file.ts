import { glob } from 'glob';
import { join } from 'path';
import { DEFAULT_CHARACTER_ENCODING, JOB_REQUIRED_FILES } from '../constants';
import { getLogger } from '../logging';
import { FileContents } from '../types';
import * as Storage from '../util/storage';

/**
 * Reads files from a directory that match a given pattern.
 */
export async function readFiles(directory: string, pattern?: string): Promise<FileContents> {
    const logger = getLogger();
    const storage = Storage.create({ log: logger.debug });
    const fileContents: FileContents = {};

    // If no pattern is specified, default to all files
    const filePattern = pattern || '**/*';

    // Get all files matching the pattern in the directory
    const files = glob.sync(filePattern, {
        cwd: directory,
        nodir: true // Only return files, not directories
    });

    // Read the contents of each file
    for (const file of files) {
        const filePath = join(directory, file);
        try {
            logger.debug(`Reading file ${filePath}`);
            const content = await storage.readFile(filePath, DEFAULT_CHARACTER_ENCODING);
            fileContents[filePath] = content;
        } catch (error) {
            logger.warn(`Could not read file ${filePath}: ${error}`);
        }
    }
    return fileContents;
}

/**
 * Checks if a directory exists and contains required files.
 */
export const checkDirectory = async (directory: string) => {
    const logger = getLogger();
    const storage = Storage.create({ log: logger.debug });

    if (!(await storage.exists(directory))) {
        throw new Error(`Configuration Directory ${directory} does not exist`);
    }

    // Check for required files
    for (const file of JOB_REQUIRED_FILES) {
        if (!(await storage.exists(join(directory, file)))) {
            throw new Error(`Missing required file in ${directory}: ${file}`);
        }
    }
} 