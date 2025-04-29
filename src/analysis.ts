import { glob } from 'glob';
import { load as loadYaml } from 'js-yaml';
import { ChatCompletionMessageParam } from 'openai/resources';
import { join } from 'path';
import { DEFAULT_CHARACTER_ENCODING, JOB_CONFIG_FILE, JOB_REQUIRED_FILES, JOB_SYSTEM_PROMPT_FILE, JOB_USER_PROMPT_FILE } from './constants';
import { getLogger } from './logging';
import { JobConfig, SummnirConfig } from './types';
import * as Storage from './util/storage';

interface ContextConfig {
    type: "history" | "static";
    name: string;
    include?: boolean;
}

interface StaticContextConfig extends ContextConfig {
    type: "static";
    directory: string;
    pattern?: string;
}

interface HistoryContextConfig extends ContextConfig {
    type: "history";
    name: string;
    from: string;
    months?: number | string;
    include?: boolean;
}

interface ContentConfig {
    type: "activity" | "summary";
    name: string;
    directory: string;
    pattern?: string;
}

interface OutputConfig {
    type: "summary";
    format: "markdown";
    name: string;
    pattern: string;
}

export interface AnalysisConfig {
    parameters: {
        [key: string]: {
            type: "string" | "number";
            default: string | number;
            description: string;
            required: boolean;
        }
    }
    temperature: number;
    maxCompletionTokens: number;
    model: string;
    context: {
        [key: string]: StaticContextConfig | HistoryContextConfig;
    };
    content: {
        [key: string]: ContentConfig;
    };
    output: {
        [key: string]: OutputConfig;
    };
}


export interface Inputs {
    config: AnalysisConfig;
    messages: ChatCompletionMessageParam[];
    contributingFiles: {
        context: string[];
        content: string[];
    }
    // Add other configuration options as needed
}

interface Parameter {
    type: "string" | "number";
    value: string | number;
    description: string;
    required: boolean;
    default: string | number;
}

interface Parameters {
    [key: string]: Parameter;
}

interface FileContents {
    [fileName: string]: string;
}

const isStaticContextConfig = (config: ContextConfig): config is StaticContextConfig => {
    return config && (config.type === 'static');
}

const isHistoryContextConfig = (config: ContextConfig): config is HistoryContextConfig => {
    return config && config.type === 'history';
}

async function readFiles(directory: string, pattern?: string): Promise<FileContents> {
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

const checkDirectory = async (directory: string) => {
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

const createConfig = async (configPath: string): Promise<AnalysisConfig> => {
    const logger = getLogger();
    const storage = Storage.create({ log: logger.debug });

    // Read and parse YAML config
    const config = loadYaml(
        await storage.readFile(join(configPath, JOB_CONFIG_FILE), DEFAULT_CHARACTER_ENCODING)
    ) as AnalysisConfig;

    // Validate required config properties
    if (!config.model) {
        throw new Error(`Missing required config property in ${configPath}/config.yaml: model`);
    }

    // Validate each context directory has required properties
    for (const [key, value] of Object.entries(config.context)) {
        // Validate required name property
        if (!value.name) {
            throw new Error(`Missing required name property for context ${key} in ${configPath}/config.yaml`);
        }

        // Validate based on context type
        switch (value.type) {
            case 'static':
                if (!value.directory) {
                    throw new Error(`Missing required directory property for ${value.type} context ${key} in ${configPath}/config.yaml`);
                }
                break;

            case 'history':
                if (!value.from) {
                    throw new Error(`Missing required 'from' property for history context ${key} in ${configPath}/config.yaml`);
                }
                // months is optional but must be a number if provided
                if (value.months && (typeof value.months !== 'number' && !(typeof value.months === 'string' && /^\${.*}$/.test(value.months)))) {
                    throw new Error(`Invalid months property for history context ${key} in ${configPath}/config.yaml - must be a number or parameter reference`);
                }

                // If months is a parameter reference, validate it points to a valid numeric parameter
                if (typeof value.months === 'string' && /^\${parameters\.(.*)}$/.test(value.months)) {
                    const paramMatch = value.months.match(/^\${parameters\.(.*)}$/);
                    const paramName = paramMatch![1];
                    const param = config.parameters?.[paramName];

                    if (!param) {
                        throw new Error(`Parameter ${paramName} referenced in months for history context ${key} not found in config parameters`);
                    }

                    if (param.type !== 'number') {
                        throw new Error(`Parameter ${paramName} referenced in months for history context ${key} must be of type number`);
                    }

                    if (!param.required && param.default === undefined) {
                        throw new Error(`Parameter ${paramName} referenced in months for history context ${key} must be required or have a default value`);
                    }
                }
                break;

            default:
                throw new Error(`Invalid context type '${value}' for context ${key} in ${configPath}/config.yaml`);
        }

    }

    return config;
}

async function generateContext(config: AnalysisConfig, parameters: Parameters, summnirConfig: SummnirConfig): Promise<{ contextString: string, contextFiles: string[] }> {
    const logger = getLogger();

    let contextString = '';
    const contextFiles: string[] = [];

    // Step through each context directory defined in config
    for (const [key, contextConfig] of Object.entries(config.context)) {
        if (contextConfig.include === false) {
            logger.info(`Skipping ${contextConfig.name || key} Context because it is not included`);
            continue;
        }

        if (isStaticContextConfig(contextConfig)) {
            const { contextString: newContextString, contextFiles: newContextFiles } = await readStaticContext(contextConfig, summnirConfig);
            contextString += newContextString;
            contextFiles.push(...newContextFiles);
        } else if (isHistoryContextConfig(contextConfig)) {
            const { contextString: newContextString, contextFiles: newContextFiles } = await readHistoricalContext(contextConfig, config, parameters, summnirConfig);
            contextString += newContextString;
            contextFiles.push(...newContextFiles);
        }
    }

    return { contextString, contextFiles };
}

async function readHistoricalContext(contextConfig: HistoryContextConfig, config: AnalysisConfig, parameters: Parameters, summnirConfig: SummnirConfig): Promise<{ contextString: string, contextFiles: string[] }> {
    const logger = getLogger();

    const historyContextConfig = contextConfig as HistoryContextConfig;

    const contextFiles: string[] = [];
    let contextString: string = '';

    // If this is a history context config, we need to get the configuration for the source.   The source should point to a key that is present in the contents
    const sourceConfig = config.content[historyContextConfig.from] || config.output[historyContextConfig.from] as ContentConfig | OutputConfig;
    if (!sourceConfig) {
        throw new Error(`Missing required source context ${historyContextConfig.from} for history context ${historyContextConfig.name}`);
    }

    const year = parameters.year.value as number;
    const month = parameters.month.value as number;

    // Determing the location of the source context based on the type of the source config
    const sourceDirectory = sourceConfig.type === 'activity' ? summnirConfig.activityDirectory : summnirConfig.summaryDirectory;
    const sourcePattern = sourceConfig.pattern;

    // Get the numbers which may be a parameter reference or a number
    const months: number = typeof historyContextConfig.months === 'string' && /^\${parameters\.(.*)}$/.test(historyContextConfig.months)
        ? parameters[historyContextConfig.months.match(/^\${parameters\.(.*)}$/)![1]].value as number
        : historyContextConfig.months as number || 1;

    // Add section header for this context directory
    contextString += `\n## ${sourceConfig.name || historyContextConfig.from} Context\n`;

    // Get historical data for the specified number of months
    for (let i = 1; i < months + 1; i++) {
        // Calculate the target year and month
        let targetMonth = month - i;
        let targetYear = year;

        // Handle month rollover
        while (targetMonth <= 0) {
            targetMonth += 12;
            targetYear--;
        }

        try {
            // Read files from the target directory
            const historyPath = join(sourceDirectory, sourceConfig.directory || '', targetYear.toString(), targetMonth.toString());
            logger.debug(`Reading historical data from ${historyPath} with pattern ${sourcePattern}`);

            const contents = await readFiles(historyPath, sourcePattern);

            // Add each file's contents
            for (const [filename, content] of Object.entries(contents)) {
                contextString += `\n### ${targetYear}-${targetMonth}-${filename}\n${content}\n\n`;
                contextFiles.push(filename);
            }
        } catch (error) {
            logger.warn(`Could not read historical data for ${targetYear}-${month}: ${error}`);
        }
    }

    return { contextString, contextFiles };
}

/** This function reads the contents of a static context directory and adds it to the context string. */
async function readStaticContext(contextConfig: StaticContextConfig, summnirConfig: SummnirConfig): Promise<{ contextString: string, contextFiles: string[] }> {
    const logger = getLogger();

    const contextFiles: string[] = [];
    let contextString: string = '';

    const directoryPath = contextConfig.directory;
    logger.debug(`Generating ${contextConfig.name} Context from ${directoryPath} with pattern ${contextConfig.pattern}`);
    try {
        // Read all files in the directory
        const contents: FileContents = await readFiles(join(summnirConfig.contextDirectory, directoryPath), contextConfig.pattern);

        // Add section header for this context directory
        contextString += `\n## ${contextConfig.name} Context\n`;

        // Add each file's contents
        for (const [filename, content] of Object.entries(contents)) {
            contextString += `\n### ${filename}\n${content}\n\n`;
            contextFiles.push(filename);
        }
    } catch (error) {
        logger.warn(`Could not read context directory ${directoryPath}: ${error}`);
        throw error;
    }
    return { contextString, contextFiles };
}

async function generateContent(config: AnalysisConfig, parameters: Parameters, summnirConfig: SummnirConfig): Promise<{ contentString: string, contentFiles: string[] }> {
    const logger = getLogger();

    let contentString = '';
    const contentFiles: string[] = [];

    const year = parameters.year.value as string;
    const month = parameters.month.value as string;


    for (const [key, value] of Object.entries(config.content)) {
        let directoryPath = '';

        if (value.type === 'summary') {
            directoryPath = join(summnirConfig.summaryDirectory, value.directory || '', year.toString(), month.toString());
        } else {
            directoryPath = join(summnirConfig.activityDirectory, value.directory || '', year.toString(), month.toString());
        }

        logger.debug(`Generating ${value.name || key} Content from ${directoryPath} with pattern ${value.pattern}`);

        const contents: FileContents = await readFiles(directoryPath, value.pattern);
        contentString += `\n## ${value.name || key}\n\n`;

        // Iterate through all of the files in the content, and replace the parameters with the actual values.
        for (const [filename, content] of Object.entries(contents)) {
            contentString += `\n### ${filename}\n${content}\n\n`;
            contentFiles.push(filename);
        }
    }

    return { contentString, contentFiles };
}

const createParameters = (config: AnalysisConfig, params: Record<string, string | number>): Parameters => {
    const parameters: Parameters = {};

    // Check to see if the params has all of the required parameters from the configuration.  If one is missing, throw an error stating which one is missing.
    for (const [key, value] of Object.entries(config.parameters)) {
        const parameter = value as Parameter;

        if (parameter.required && params[key] === undefined) {
            throw new Error(`Missing required parameter: ${key}`);
        }
    }

    // Iterate through all of the parameters defined in the configuration, and assign either the value from the params object or the default value from the configuration.
    for (const [key, value] of Object.entries(config.parameters)) {
        const parameter = value as Parameter;

        parameters[key] = { ...parameter, value: params[key] === undefined ? parameter.default : params[key] };
    }

    // Return the parameters object.
    return parameters;
}

export const createInputs = async (analysisName: string, params: Record<string, string | number>, summnirConfig: SummnirConfig, jobConfig: JobConfig): Promise<Inputs> => {
    const logger = getLogger();
    const storage = Storage.create({ log: logger.debug });

    const configPath = join(summnirConfig.configDirectory, jobConfig.job);
    checkDirectory(configPath);
    const config = await createConfig(configPath);

    const parameters = createParameters(config, params);

    // Read system and user prompts
    const systemPrompt = await storage.readFile(join(configPath, JOB_SYSTEM_PROMPT_FILE), DEFAULT_CHARACTER_ENCODING);

    const userPrompt = await storage.readFile(join(configPath, JOB_USER_PROMPT_FILE), DEFAULT_CHARACTER_ENCODING);
    // Replace parameter references in prompts
    const systemPromptProcessed = Object.entries(parameters).reduce((prompt, [key, param]) => {
        return prompt.replace(new RegExp(`{{parameters.${key}}}`, 'g'), param.value.toString());
    }, systemPrompt);

    const userPromptProcessed = Object.entries(parameters).reduce((prompt, [key, param]) => {
        return prompt.replace(new RegExp(`{{parameters.${key}}}`, 'g'), param.value.toString());
    }, userPrompt);

    const { contextString, contextFiles } = await generateContext(config, parameters, summnirConfig);

    const { contentString, contentFiles } = await generateContent(config, parameters, summnirConfig);

    // Skip generating content summary if there are no content files
    if (contentFiles.length === 0) {
        logger.warn('No content files found, skipping content generation');
        return {
            config,
            messages: [],
            contributingFiles: {
                context: contextFiles,
                content: []
            }
        };
    }

    const messages = [
        {
            role: "system",
            content: systemPromptProcessed
        },
        {
            role: "user",
            content: `${userPromptProcessed}\n\nContent:\n${contentString}\n\nContext:\n${contextString}`
        }
    ];

    return {
        config,
        messages: messages as ChatCompletionMessageParam[],
        contributingFiles: {
            context: contextFiles,
            content: contentFiles
        }
    };
}

