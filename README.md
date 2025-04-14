# Summnir

Summnir is a powerful tool for generating intelligent release notes and change logs from Git history. It uses AI to analyze and summarize code changes, making it easier to create comprehensive and meaningful documentation for your projects.

## Features

- Generate intelligent release notes and change logs
- Analyze Git history with customizable time periods
- AI-powered summarization of code changes
- Flexible configuration options
- Support for multiple output formats
- Context-aware analysis

## Installation

```bash
npm install -g summnir
```

## Command Line Usage

Summnir provides a rich set of command line options to customize its behavior:

### Required Arguments

- `<summaryType>`: Type of summary to generate
- `<year>`: Year for the summary (must be between 1900 and 2100)
- `<month>`: Month for the summary (1-12)

### Optional Arguments

- `[historyMonths]`: Number of months of history to include (default: 1)
- `[summaryMonths]`: Number of months to summarize (default: 1)

### Options

- `--dry-run`: Perform a dry run without saving files (default: false)
- `--verbose`: Enable verbose logging (default: false)
- `--debug`: Enable debug logging (default: false)
- `--timezone <timezone>`: Timezone for date calculations (default: system timezone)
- `--openai-api-key <openaiApiKey>`: OpenAI API key (can also be set via OPENAI_API_KEY environment variable)
- `--model <model>`: OpenAI model to use (default: gpt-4)
- `--config-dir <configDir>`: Config directory (default: ./config)
- `--context-directory <contextDirectory>`: Directory containing context files to be included in prompts (default: ./context)
- `--activity-directory <activityDirectory>`: Directory containing activity files to be included in prompts (default: ./activity)
- `--summary-directory <summaryDirectory>`: Directory containing summary files to be included in prompts (default: ./summary)
- `--replace`: Replace existing summary files if they exist (default: false)
- `--version`: Display version information

### Examples

1. Generate a summary for January 2024:
```bash
summnir release-notes 2024 1
```

2. Generate a summary with 3 months of history:
```bash
summnir release-notes 2024 1 3
```

3. Generate a summary with custom directories:
```bash
summnir release-notes 2024 1 --config-dir ./my-config --context-directory ./my-context
```

4. Generate a summary with a specific timezone:
```bash
summnir release-notes 2024 1 --timezone America/New_York
```

## How It Works

Summnir analyzes your Git history and related content using a sophisticated analysis engine that:

1. Reads and processes configuration files from the specified config directory
2. Gathers context from various sources including:
   - Static context files
   - Historical context from previous summaries
   - Activity files from the specified period
3. Processes and combines this information using AI to generate meaningful summaries
4. Outputs the results in the specified format

The analysis engine is highly configurable, allowing you to:
- Define custom parameters and their types
- Specify which context sources to include
- Control the temperature and token limits for AI processing
- Customize the output format and structure

## Name Origin

The name "Summnir" is a portmanteau combining "Summarization" and "Mjollnir" (Thor's hammer from Norse mythology). Just as Mjollnir was a powerful tool that could be wielded to great effect, Summnir is designed to be a powerful tool for creating meaningful summaries of your code changes and project history.
