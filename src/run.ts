import { getLogger } from "./logging";
import { OpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources";
import * as Analysis from "./analysis";
import { JobConfig, SummnirConfig } from "./types";
import { AnalysisConfig } from "./analysis";

export const runModel = async (
    analysisConfig: AnalysisConfig,
    summnirConfig: SummnirConfig,
    jobConfig: JobConfig,
    existingMonthlySummary?: any,
): Promise<{ aiSummary: string, aiUsage: any, monthlySummary: any }> => {
    const logger = getLogger();
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
    const monthlySummary = existingMonthlySummary || await Analysis.createInputs(jobConfig.job, {
        year: jobConfig.year,
        month: jobConfig.month,
        historyMonths: jobConfig.historyMonths,
        summaryMonths: jobConfig.summaryMonths
    }, summnirConfig, jobConfig);

    // Check if there's any content to process
    if (monthlySummary.contributingFiles.content.length === 0) {
        logger.info(`No content found for ${jobConfig.job} in ${jobConfig.year}-${jobConfig.month}. Skipping generation.`);
        return {
            aiSummary: "",
            aiUsage: null,
            monthlySummary
        };
    }


    const response = await openai.chat.completions.create({
        model: analysisConfig.model,
        messages: monthlySummary.messages as ChatCompletionMessageParam[],
        temperature: analysisConfig.temperature,
        max_completion_tokens: analysisConfig.maxCompletionTokens
    });

    return {
        aiSummary: response.choices[0].message.content!,
        aiUsage: response,
        monthlySummary
    };
}