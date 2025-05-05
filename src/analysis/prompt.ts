import { Content, Context, createSection, Instruction, Parser, Section } from '@tobrien/minorprompt';
import { join } from 'path';
import { JOB_INSTRUCTIONS_PROMPT_FILE, JOB_PERSONA_PROMPT_FILE } from '../constants';
import { getLogger } from '../logging';
import { AnalysisConfig, HistoryContextConfig, Parameters, StaticContextConfig } from '../types';
import { SummnirConfig } from '../types';
import { readFiles } from './file';

/**
 * Type guard for static context config
 */
export const isStaticContextConfig = (config: any): config is StaticContextConfig => {
    return config && (config.type === 'static');
}

/**
 * Type guard for history context config
 */
export const isHistoryContextConfig = (config: any): config is HistoryContextConfig => {
    return config && config.type === 'history';
}

/**
 * Generates the persona section for the prompt
 */
export async function generatePersona(configPath: string): Promise<Section<Instruction>> {
    const persona = await Parser.parseFile(join(configPath, JOB_PERSONA_PROMPT_FILE));
    return persona;
}

/**
 * Generates the instructions section for the prompt
 */
export async function generateInstructions(configPath: string): Promise<Section<Instruction>> {
    const instructions = await Parser.parseFile(join(configPath, JOB_INSTRUCTIONS_PROMPT_FILE));
    return instructions;
}

/**
 * Generates the context section for the prompt
 */
export async function generateContext(config: AnalysisConfig, parameters: Parameters, summnirConfig: SummnirConfig): Promise<Section<Context>> {
    const logger = getLogger();

    const context = createSection<Context>('Context');

    // Step through each context directory defined in config
    for (const [key, contextConfig] of Object.entries(config.context)) {
        if (contextConfig.include === false) {
            logger.info(`Skipping ${contextConfig.name || key} Context because it is not included`);
            continue;
        }

        if (isStaticContextConfig(contextConfig)) {
            const contextSection = await readStaticContext(contextConfig, summnirConfig);
            context.add(contextSection);
        } else if (isHistoryContextConfig(contextConfig)) {
            const contextSection = await readHistoricalContext(contextConfig, config, parameters, summnirConfig);
            context.add(contextSection);
        }
    }

    return context;
}

/**
 * Reads historical context for the prompt
 */
export async function readHistoricalContext(contextConfig: HistoryContextConfig, config: AnalysisConfig, parameters: Parameters, summnirConfig: SummnirConfig): Promise<Section<Context>> {
    const logger = getLogger();

    // If this is a history context config, we need to get the configuration for the source
    const sourceConfig = config.content[contextConfig.from] || config.output[contextConfig.from];
    if (!sourceConfig) {
        throw new Error(`Missing required source context ${contextConfig.from} for history context ${contextConfig.name}`);
    }

    const year = parameters.year.value as number;
    const month = parameters.month.value as number;

    // Determine the location of the source context based on the type of the source config
    const sourceDirectory = sourceConfig.type === 'activity' ? summnirConfig.activityDirectory : summnirConfig.summaryDirectory;
    const sourcePattern = sourceConfig.pattern;

    // Get the number of months which may be a parameter reference or a number
    const months: number = typeof contextConfig.months === 'string' && /^\${parameters\.(.*)}$/.test(contextConfig.months)
        ? parameters[contextConfig.months.match(/^\${parameters\.(.*)}$/)![1]].value as number
        : contextConfig.months as number || 1;

    // Add section header for this context directory
    const sourceSection: Section<Context> = createSection<Context>(`${sourceConfig.name || contextConfig.from} Context`);

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
                const fileSection: Section<Context> = createSection<Context>(`${filename}`);
                fileSection.add(content as string);
                sourceSection.add(fileSection);
            }
        } catch (error) {
            logger.warn(`Could not read historical data for ${targetYear}-${month}: ${error}`);
        }
    }

    return sourceSection;
}

/**
 * Reads static context for the prompt
 */
export async function readStaticContext(contextConfig: StaticContextConfig, summnirConfig: SummnirConfig): Promise<Section<Context>> {
    const logger = getLogger();
    const section: Section<Context> = createSection<Context>(`${contextConfig.name} Context`);
    const directoryPath = contextConfig.directory;
    logger.debug(`Generating ${contextConfig.name} Context from ${directoryPath} with pattern ${contextConfig.pattern}`);
    try {
        // Read all files in the directory
        const contents = await readFiles(join(summnirConfig.contextDirectory, directoryPath), contextConfig.pattern);

        // Add each file's contents
        for (const [filename, content] of Object.entries(contents)) {
            const fileSection: Section<Context> = createSection<Context>(`${filename}`);
            fileSection.add(content as string);
            section.add(fileSection);
        }
    } catch (error) {
        logger.warn(`Could not read context directory ${directoryPath}: ${error}`);
        throw error;
    }
    return section;
}

/**
 * Generates the content section for the prompt
 */
export async function generateContent(config: AnalysisConfig, parameters: Parameters, summnirConfig: SummnirConfig): Promise<Section<Content>> {
    const logger = getLogger();

    const content = createSection<Content>('Content');

    const year = parameters.year.value as string;
    const month = parameters.month.value as string;

    let contributingFileCount = 0;

    for (const [key, value] of Object.entries(config.content)) {
        let directoryPath = '';

        if (value.type === 'summary') {
            directoryPath = join(summnirConfig.summaryDirectory, value.directory || '', year.toString(), month.toString());
        } else {
            directoryPath = join(summnirConfig.activityDirectory, value.directory || '', year.toString(), month.toString());
        }

        logger.debug(`Generating ${value.name || key} Content from ${directoryPath} with pattern ${value.pattern}`);

        const contents = await readFiles(directoryPath, value.pattern);
        const contentSection: Section<Content> = createSection<Content>(`${value.name || key} Content`);

        // Add each file's contents to the content section
        for (const [filename, content] of Object.entries(contents)) {
            const fileSection: Section<Content> = createSection<Content>(`${filename}`);
            fileSection.add(content as string);
            contentSection.add(fileSection);
            contributingFileCount++;
        }

        content.add(contentSection);
    }

    if (contributingFileCount === 0) {
        logger.warn(`No contributing files found for ${config.name}`);
    }

    return content;
} 