export interface Input {
    dryRun: boolean;
    verbose: boolean;
    debug: boolean;
    model: string;
    openaiApiKey: string;
    timezone: string;
    filenameOptions?: string[];
    configDir: string;
    contextDirectory: string;
    activityDirectory: string;
    summaryDirectory: string;
    replace?: boolean;
}

