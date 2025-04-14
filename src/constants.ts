export const VERSION = '__VERSION__ (__GIT_BRANCH__/__GIT_COMMIT__ __GIT_TAGS__ __GIT_COMMIT_DATE__) __SYSTEM_INFO__';
export const PROGRAM_NAME = 'summnir';
export const DEFAULT_CHARACTER_ENCODING = 'utf-8';
export const DEFAULT_BINARY_TO_TEXT_ENCODING = 'base64';
export const DEFAULT_DIFF = true;
export const DEFAULT_LOG = false;
export const DEFAULT_TIMEZONE = 'Etc/UTC';
export const DATE_FORMAT_MONTH_DAY = 'M-D';
export const DATE_FORMAT_YEAR = 'YYYY';
export const DATE_FORMAT_YEAR_MONTH = 'YYYY-M';
export const DATE_FORMAT_YEAR_MONTH_DAY = 'YYYY-M-D';
export const DATE_FORMAT_YEAR_MONTH_DAY_SLASH = 'YYYY/M/D';
export const DATE_FORMAT_YEAR_MONTH_DAY_HOURS_MINUTES = 'YYYY-M-D-HHmm';
export const DATE_FORMAT_YEAR_MONTH_DAY_HOURS_MINUTES_SECONDS = 'YYYY-M-D-HHmmss';
export const DATE_FORMAT_YEAR_MONTH_DAY_HOURS_MINUTES_SECONDS_MILLISECONDS = 'YYYY-M-D-HHmmss.SSS';
export const DATE_FORMAT_MONTH = 'M';
export const DATE_FORMAT_DAY = 'D';
export const DATE_FORMAT_HOURS = 'HHmm';
export const DATE_FORMAT_MINUTES = 'mm';
export const DATE_FORMAT_SECONDS = 'ss';
export const DATE_FORMAT_MILLISECONDS = 'SSS';
export const DEFAULT_VERBOSE = false;
export const DEFAULT_DRY_RUN = false;
export const DEFAULT_DEBUG = false;
export const DEFAULT_MODEL = 'gpt-4o';


export const DEFAULT_CONFIG_DIR = `./.${PROGRAM_NAME}`;

export const DEFAULT_PERSONAS_DIR = `/personas`;

export const DEFAULT_PERSONA_CLASSIFIER_TRAITS_FILE = `${DEFAULT_PERSONAS_DIR}/classifier/traits.md`;
export const DEFAULT_PERSONA_CLASSIFIER_INSTRUCTIONS_FILE = `${DEFAULT_PERSONAS_DIR}/classifier/instructions.md`;

export const DEFAULT_PERSONA_YOU_TRAITS_FILE = `${DEFAULT_PERSONAS_DIR}/you/traits.md`;
export const DEFAULT_PERSONA_YOU_INSTRUCTIONS_FILE = `${DEFAULT_PERSONAS_DIR}/you/instructions.md`;

export const DEFAULT_INSTRUCTIONS_DIR = `/instructions`;

export const DEFAULT_TYPE_INSTRUCTIONS_DIR = `${DEFAULT_INSTRUCTIONS_DIR}/types`;

export const DEFAULT_INSTRUCTIONS_CLASSIFY_FILE = `${DEFAULT_INSTRUCTIONS_DIR}/classify.md`;
export const DEFAULT_INSTRUCTIONS_COMPOSE_FILE = `${DEFAULT_INSTRUCTIONS_DIR}/compose.md`;

// TODO: Add more models, but also this should be a part of an OpenAI specific extension.
export const ALLOWED_MODELS: string[] = ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini', 'o3-mini', 'o3-preview', 'o1-pro', 'o1-preview-2024-09-12'];

export const DEFAULT_OVERRIDES = false;


export const JOB_CONFIG_FILE = 'config.yaml';
export const JOB_SYSTEM_PROMPT_FILE = 'system.md';
export const JOB_USER_PROMPT_FILE = 'user.md';
export const JOB_REQUIRED_FILES = [JOB_CONFIG_FILE, JOB_SYSTEM_PROMPT_FILE, JOB_USER_PROMPT_FILE];

export const DEFAULT_JOB_DIR = `./.${PROGRAM_NAME}/jobs`;

export const DEFAULT_CONTEXT_DIR = `./context`;
export const DEFAULT_ACTIVITY_DIR = `./activity`;
export const DEFAULT_SUMMARY_DIR = `./summary`;


