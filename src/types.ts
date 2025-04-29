import { z } from "zod";
import * as GiveMeTheConfig from '@tobrien/givemetheconfig';
import * as Cabazooka from '@tobrien/cabazooka';

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

