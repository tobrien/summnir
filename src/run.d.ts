export interface Config {
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
}