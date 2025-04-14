import { DEFAULT_ACTIVITY_DIR, DEFAULT_CONFIG_DIR, DEFAULT_CONTEXT_DIR, DEFAULT_DEBUG, DEFAULT_DRY_RUN, DEFAULT_MODEL, DEFAULT_SUMMARY_DIR, DEFAULT_TIMEZONE, DEFAULT_VERBOSE } from "./constants";

import { Config } from "./run.d";

export const createConfig = (params: {
    dryRun?: boolean;
    verbose?: boolean;
    debug?: boolean;
    model?: string;
    timezone?: string;
    configDir?: string;
    contextDirectory?: string;
    activityDirectory?: string;
    summaryDirectory?: string;
    summaryType: string;
    year: number;
    month: number;
    historyMonths: number;
    summaryMonths: number;
    replace: boolean;
}): Config => {
    return {
        dryRun: params.dryRun ?? DEFAULT_DRY_RUN,
        verbose: params.verbose ?? DEFAULT_VERBOSE,
        debug: params.debug ?? DEFAULT_DEBUG,
        model: params.model ?? DEFAULT_MODEL,
        timezone: params.timezone ?? DEFAULT_TIMEZONE,
        configDir: params.configDir ?? DEFAULT_CONFIG_DIR,
        contextDirectory: params.contextDirectory ?? DEFAULT_CONTEXT_DIR,
        activityDirectory: params.activityDirectory ?? DEFAULT_ACTIVITY_DIR,
        summaryDirectory: params.summaryDirectory ?? DEFAULT_SUMMARY_DIR,
        summaryType: params.summaryType,
        year: params.year,
        month: params.month,
        historyMonths: params.historyMonths,
        summaryMonths: params.summaryMonths,
        replace: params.replace,
    }
}