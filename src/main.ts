#!/usr/bin/env node
import 'dotenv/config';
import { mkdir, writeFile } from 'fs/promises';
import { OpenAI } from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';
import { dirname, join } from 'path';
import * as Analysis from './analysis';
import * as Arguments from './arguments';
import { PROGRAM_NAME, VERSION } from './constants';
import { getLogger, setLogLevel } from './logging';
import { Config as RunConfig } from './run.d';
import * as Storage from './util/storage';



async function runModelWithParams(
    runConfig: RunConfig,
    summaryType: string,
    year: number,
    month: number,
    historyMonths: number,
    summaryMonths: number,
    existingMonthlySummary?: any,
): Promise<{ aiSummary: string, aiUsage: any, monthlySummary: any }> {
    const logger = getLogger();
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
    const monthlySummary = existingMonthlySummary || await Analysis.createInputs(summaryType, {
        year: year,
        month: month,
        historyMonths: historyMonths,
        summaryMonths: summaryMonths
    }, runConfig);

    // Check if there's any content to process
    if (monthlySummary.contributingFiles.content.length === 0) {
        logger.info(`No content found for ${summaryType} in ${year}-${month}. Skipping generation.`);
        return {
            aiSummary: "",
            aiUsage: null,
            monthlySummary
        };
    }


    const response = await openai.chat.completions.create({
        model: monthlySummary.config.model,
        messages: monthlySummary.messages as ChatCompletionMessageParam[],
        temperature: monthlySummary.config.temperature,
        max_completion_tokens: monthlySummary.config.maxCompletionTokens
    });

    return {
        aiSummary: response.choices[0].message.content!,
        aiUsage: response,
        monthlySummary
    };
}

async function writeOutputFile(
    baseDir: string,
    year: number,
    month: number,
    pattern: string,
    content: string | object,
    logger: any
): Promise<void> {
    const outputPath = join(baseDir, year.toString(), month.toString(), pattern);
    await mkdir(dirname(outputPath), { recursive: true });
    const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    await writeFile(outputPath, fileContent);
    logger.info(`Output written to ${outputPath}`);
}


export async function main() {

    // eslint-disable-next-line no-console
    console.info(`Starting ${PROGRAM_NAME}: ${VERSION}`);

    const [runConfig]: [RunConfig] = await Arguments.configure();

    // Set log level based on verbose flag
    if (runConfig.verbose) {
        setLogLevel('verbose');
    }
    if (runConfig.debug) {
        setLogLevel('debug');
    }

    const logger = getLogger();
    logger.debug('Run config: %j', runConfig);

    try {

        const storage = Storage.create({ log: logger.debug });
        try {

            logger.info(`Generating ${runConfig.summaryType} summary for ${runConfig.year}-${runConfig.month} with historyMonths=${runConfig.historyMonths} and summaryMonths=${runConfig.summaryMonths}`);

            // Get the configuration to determine the output pattern
            const monthlySummaryConfig = await Analysis.createInputs(runConfig.summaryType, {
                year: runConfig.year,
                month: runConfig.month,
                historyMonths: runConfig.historyMonths,
                summaryMonths: runConfig.summaryMonths
            }, runConfig);

            // Check if output file already exists
            const outputPath = join(
                runConfig.summaryDirectory,
                runConfig.year.toString(),
                runConfig.month.toString(),
                monthlySummaryConfig.config.output.summary.pattern
            );

            if (await storage.exists(outputPath) && !runConfig.replace) {
                logger.error(`Output file ${outputPath} already exists. Use --replace flag to overwrite.`);
                process.exit(1);
            }

            let success = false;
            let result;
            const originalHistoryMonths = runConfig.historyMonths;
            const originalSummaryMonths = runConfig.summaryMonths;

            while (!success && (runConfig.historyMonths >= 0 || runConfig.summaryMonths >= 0)) {
                try {
                    result = await runModelWithParams(runConfig, runConfig.summaryType, runConfig.year, runConfig.month, runConfig.historyMonths, runConfig.summaryMonths, monthlySummaryConfig);
                    // Check if the result contains a blank string
                    if (result?.aiSummary?.trim() === '') {
                        logger.info('Summary generation skipped: AI returned a blank response');
                        process.exit(0); // Exit gracefully
                    }
                    success = true;
                } catch (error: any) {
                    if (error?.message?.includes('429 Request too large')) {
                        // Extract token limits from error message
                        const limitMatch = error.message.match(/Limit (\d+), Requested (\d+)/);
                        const limit = limitMatch ? limitMatch[1] : 'unknown';
                        const requested = limitMatch ? limitMatch[2] : 'unknown';

                        if (runConfig.historyMonths > 0) {
                            runConfig.historyMonths--;
                            logger.info(`Token limit exceeded (Limit: ${limit}, Requested: ${requested}). Reducing history months to ${runConfig.historyMonths} and retrying...`);
                        } else if (runConfig.summaryMonths > 0) {
                            // Once history Months is 0, we move on to the summaryMonths.
                            runConfig.summaryMonths--;
                            logger.info(`Token limit exceeded (Limit: ${limit}, Requested: ${requested}). Reducing summary months to ${runConfig.summaryMonths} and retrying...`);
                        } else {
                            throw new Error(`Unable to generate summary even with minimum history and summary months. Last error: ${error.message}`);
                        }
                    } else {
                        throw error;
                    }
                }
            }

            if (!success || !result) {
                throw new Error('Failed to generate summary after all retries');
            }

            const { aiSummary, aiUsage, monthlySummary } = result;

            // Log final parameters used
            logger.info(`Successfully generated summary with historyMonths=${runConfig.historyMonths} and summaryMonths=${runConfig.summaryMonths}`);
            if (runConfig.historyMonths !== originalHistoryMonths || runConfig.summaryMonths !== originalSummaryMonths) {
                logger.info(`Note: Original parameters were historyMonths=${originalHistoryMonths} and summaryMonths=${originalSummaryMonths}`);
            }

            // Write all output files
            await writeOutputFile(
                runConfig.summaryDirectory,
                runConfig.year,
                runConfig.month,
                monthlySummary.config.output.summary.pattern,
                aiSummary,
                logger
            );

            await writeOutputFile(
                runConfig.summaryDirectory,
                runConfig.year,
                runConfig.month,
                monthlySummary.config.output.completion.pattern,
                aiUsage,
                logger
            );

            await writeOutputFile(
                runConfig.summaryDirectory,
                runConfig.year,
                runConfig.month,
                monthlySummary.config.output.inputs.pattern,
                monthlySummary,
                logger
            );

        } catch (error: any) {
            logger.error(`Error generating summary: ${error.message} ${error.stack}`);
            process.exit(1);
        }
    } catch (error: any) {
        logger.error('Exiting due to Error: %s, %s', error.message, error.stack);
        process.exit(1);
    }
}

main();