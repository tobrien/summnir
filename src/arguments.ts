import { Command } from "commander";
import { Input } from "./arguments.d";
import { ALLOWED_MODELS, DEFAULT_ACTIVITY_DIR, DEFAULT_CONFIG_DIR, DEFAULT_CONTEXT_DIR, DEFAULT_DEBUG, DEFAULT_DRY_RUN, DEFAULT_MODEL, DEFAULT_SUMMARY_DIR, DEFAULT_TIMEZONE, DEFAULT_VERBOSE, PROGRAM_NAME, VERSION } from "./constants";
import { ArgumentError } from "./error/ArgumentError";
import { getLogger } from "./logging";
import * as Run from "./run";
import { Config as RunConfig } from "./run.d";
import * as Dates from "./util/dates";
import * as Storage from "./util/storage";
export const configure = async (): Promise<[RunConfig]> => {
    const program = new Command();

    program
        .name(PROGRAM_NAME)
        .summary('Create Intelligent Release Notes or Change Logs from Git')
        .description('Create Intelligent Release Notes or Change Logs from Git')
        .argument('<summaryType>', 'Type of summary to generate')
        .argument('<year>', 'Year for the summary')
        .argument('<month>', 'Month for the summary')
        .argument('[historyMonths]', 'Number of months of history to include', '1')
        .argument('[summaryMonths]', 'Number of months to summarize', '1')
        .option('--dry-run', 'perform a dry run without saving files', DEFAULT_DRY_RUN)
        .option('--verbose', 'enable verbose logging', DEFAULT_VERBOSE)
        .option('--debug', 'enable debug logging', DEFAULT_DEBUG)
        .option('--timezone <timezone>', 'timezone for date calculations', DEFAULT_TIMEZONE)
        .option('--openai-api-key <openaiApiKey>', 'OpenAI API key', process.env.OPENAI_API_KEY)
        .option('--model <model>', 'OpenAI model to use', DEFAULT_MODEL)
        .option('--config-dir <configDir>', 'config directory', DEFAULT_CONFIG_DIR)
        .option('--context-directory <contextDirectory>', 'directory containing context files to be included in prompts', DEFAULT_CONTEXT_DIR)
        .option('--activity-directory <activityDirectory>', 'directory containing activity files to be included in prompts', DEFAULT_ACTIVITY_DIR)
        .option('--summary-directory <summaryDirectory>', 'directory containing summary files to be included in prompts', DEFAULT_SUMMARY_DIR)
        .option('--replace', 'replace existing summary files if they exist', false)
        .version(VERSION);

    program.parse();

    const options: Input = program.opts<Input>();
    const [summaryType, year, month, historyMonths, summaryMonths] = program.args;

    const params = await validateOptions(options, summaryType, year, month, historyMonths, summaryMonths);

    // Create the run configuration
    const runConfig: RunConfig = Run.createConfig(params);

    return [runConfig];
}

async function validateOptions(
    options: Input,
    summaryType: string,
    year: string,
    month: string,
    historyMonths: string = '1',
    summaryMonths: string = '1'
): Promise<{
    dryRun: boolean;
    verbose: boolean;
    debug: boolean;
    model: string;
    timezone: string;
    configDir: string;
    contextDirectory: string;
    activityDirectory: string;
    summaryDirectory: string;
    summaryType: string;
    year: number;
    month: number;
    historyMonths: number;
    summaryMonths: number;
    replace: boolean;
}> {
    // Validate required arguments
    if (!summaryType) {
        throw new Error('Summary type is required');
    }
    if (!year) {
        throw new Error('Year is required');
    }
    if (!month) {
        throw new Error('Month is required');
    }

    // Validate year and month format
    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
        throw new Error('Year must be a valid number between 1900 and 2100');
    }

    const monthNum = parseInt(month);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        throw new Error('Month must be a valid number between 1 and 12');
    }

    // Validate historyMonths and summaryMonths
    const historyMonthsNum = parseInt(historyMonths);
    if (isNaN(historyMonthsNum) || historyMonthsNum < 1) {
        throw new Error('History months must be a positive number');
    }

    const summaryMonthsNum = parseInt(summaryMonths);
    if (isNaN(summaryMonthsNum) || summaryMonthsNum < 1) {
        throw new Error('Summary months must be a positive number');
    }

    // Validate timezone
    const timezone: string = validateTimezone(options.timezone);


    if (!options.openaiApiKey) {
        throw new Error('OpenAI API key is required, set OPENAI_API_KEY environment variable');
    }


    if (options.configDir) {
        await validateConfigDirectory(options.configDir);
    }

    if (options.contextDirectory) {
        await validateInputDirectory(options.contextDirectory);
    }

    if (options.activityDirectory) {
        await validateInputDirectory(options.activityDirectory);
    }

    if (options.summaryDirectory) {
        await validateOutputDirectory(options.summaryDirectory);
    }


    validateModel(options.model, true, '--model');

    return {
        dryRun: options.dryRun,
        verbose: options.verbose,
        debug: options.debug,
        model: options.model,
        timezone: timezone,
        configDir: options.configDir ?? DEFAULT_CONFIG_DIR,
        contextDirectory: options.contextDirectory ?? DEFAULT_CONTEXT_DIR,
        activityDirectory: options.activityDirectory ?? DEFAULT_ACTIVITY_DIR,
        summaryDirectory: options.summaryDirectory ?? DEFAULT_SUMMARY_DIR,
        summaryType,
        year: yearNum,
        month: monthNum,
        historyMonths: historyMonthsNum,
        summaryMonths: summaryMonthsNum,
        replace: options.replace ?? false,
    };
}

function validateModel(model: string | undefined, required: boolean, modelOptionName: string) {
    if (required && !model) {
        throw new Error(`Model for ${modelOptionName} is required`);
    }

    if (model && !ALLOWED_MODELS.includes(model)) {
        throw new Error(`Invalid model: ${model}. Valid models are: ${ALLOWED_MODELS.join(', ')}`);
    }
}

async function validateConfigDirectory(configDir: string) {
    const logger = getLogger();
    const storage = Storage.create({ log: logger.info });
    if (!storage.isDirectoryReadable(configDir)) {
        throw new Error(`Config directory does not exist: ${configDir}`);
    }
}

async function validateInputDirectory(inputDirectory: string) {
    const logger = getLogger();
    const storage = Storage.create({ log: logger.info });
    if (!storage.isDirectoryReadable(inputDirectory)) {
        throw new Error(`Input directory does not exist: ${inputDirectory}`);
    }
}

async function validateOutputDirectory(outputDirectory: string) {
    const logger = getLogger();
    const storage = Storage.create({ log: logger.info });
    if (!storage.isDirectoryWritable(outputDirectory)) {
        throw new Error(`Output directory does not exist: ${outputDirectory}`);
    }
}

export const validateTimezone = (timezone: string): string => {
    const validOptions = Dates.validTimezones();
    if (validOptions.includes(timezone)) {
        return timezone;
    }
    throw new ArgumentError('--timezone', `Invalid timezone: ${timezone}. Valid options are: ${validOptions.join(', ')}`);
}