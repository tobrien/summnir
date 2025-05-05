import { z } from "zod";
import * as GiveMeTheConfig from '@tobrien/givemetheconfig';
import * as Cabazooka from '@tobrien/cabazooka';
import { Request } from '@tobrien/minorprompt';

export interface Args extends Cabazooka.Args, GiveMeTheConfig.Args {
    dryRun?: boolean;
    verbose?: boolean;
    debug?: boolean;
    model?: string;
    filenameOptions?: string[];
    contextDirectory?: string;
    activityDirectory?: string;
    summaryDirectory?: string;
    replace?: boolean;
}

export const SummnirConfigSchema = z.object({
    dryRun: z.boolean(),
    verbose: z.boolean(),
    debug: z.boolean(),
    timezone: z.string(),
    model: z.string(),
    contextDirectory: z.string(),
    activityDirectory: z.string(),
    summaryDirectory: z.string(),
    replace: z.boolean(),
});

export const JobConfigSchema = z.object({
    job: z.string(),
    year: z.number(),
    month: z.number(),
    historyMonths: z.number(),
    summaryMonths: z.number(),
});

export type SummnirConfig = z.infer<typeof SummnirConfigSchema> & Cabazooka.Config & GiveMeTheConfig.Config;
export type JobConfig = z.infer<typeof JobConfigSchema>;

export interface ContextConfig {
    type: "history" | "static";
    name: string;
    include?: boolean;
}

export interface StaticContextConfig extends ContextConfig {
    type: "static";
    directory: string;
    pattern?: string;
}

export interface HistoryContextConfig extends ContextConfig {
    type: "history";
    name: string;
    from: string;
    months?: number | string;
    include?: boolean;
}

export interface ContentConfig {
    type: "activity" | "summary";
    name: string;
    directory: string;
    pattern?: string;
}

export interface OutputConfig {
    type: "summary";
    format: "markdown";
    name: string;
    pattern: string;
}

export interface AnalysisConfig {
    name: string;
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
    request: Request;
}

export interface Parameter {
    type: "string" | "number";
    value: string | number;
    description: string;
    required: boolean;
    default: string | number;
}

export interface Parameters {
    [key: string]: Parameter;
}

export interface FileContents {
    [fileName: string]: string;
} 