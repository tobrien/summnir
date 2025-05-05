import { Content, Context, createPrompt, Formatter, Instruction, Model, Prompt, Request, Section } from '@tobrien/minorprompt';
import { join } from 'path';
import { JobConfig, SummnirConfig } from '../types';
import { checkDirectory } from './file';
import { Inputs } from '../types';
import { createConfig, createParameters } from './configLoader';
import { generateContent, generateContext, generateInstructions, generatePersona } from './prompt';
import { replaceParameters } from './section';

/**
 * Main function that creates inputs for analysis by combining configuration, parameters, and content generation
 */
export const createInputs = async (analysisName: string, params: Record<string, string | number>, summnirConfig: SummnirConfig, jobConfig: JobConfig): Promise<Inputs> => {
    const configPath = join(summnirConfig.configDirectory, jobConfig.job);
    checkDirectory(configPath);

    // Load and validate configuration
    const config = await createConfig(jobConfig.job, configPath);

    // Process parameters
    const parameters = createParameters(config, params);

    // Generate prompt sections
    let persona: Section<Instruction> = await generatePersona(configPath);
    let instructions: Section<Instruction> = await generateInstructions(configPath);

    // Replace parameters in text
    persona = replaceParameters(persona, parameters);
    instructions = replaceParameters(instructions, parameters);

    // Generate context and content
    const context: Section<Context> = await generateContext(config, parameters, summnirConfig);
    const content: Section<Content> = await generateContent(config, parameters, summnirConfig);

    // Create the complete prompt
    const prompt: Prompt = createPrompt(persona, instructions, context, content);

    // Format for the model
    const request: Request = Formatter.formatPrompt(summnirConfig.model as Model, prompt);

    return {
        config,
        request
    };
}

