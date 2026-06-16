/**
 * Configuration management for Firebase Functions
 * Uses Environment Variables (firebase functions:env:set)
 * Migrated from deprecated functions.config() API
 */

// =============================================================================
// Environment Configuration (set via: firebase functions:env:set)
// =============================================================================

// Helper to get env var with default
function env(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

// =============================================================================
// Secrets (set via: firebase functions:secrets:set)
// =============================================================================

export const secrets = {
  // Stored in Secret Manager
  get WEBHOOK_SECRET(): string {
    return process.env.WEBHOOK_SECRET || '';
  },
  get GITHUB_TOKEN(): string {
    return process.env.GITHUB_TOKEN || '';
  },
  get GMAIL_REFRESH_TOKEN(): string {
    return process.env.GMAIL_REFRESH_TOKEN || '';
  },
  get GMAIL_CLIENT_ID(): string {
    return process.env.GMAIL_CLIENT_ID || '';
  },
  get GMAIL_CLIENT_SECRET(): string {
    return process.env.GMAIL_CLIENT_SECRET || '';
  },
  get CALENDAR_REFRESH_TOKEN(): string {
    return process.env.CALENDAR_REFRESH_TOKEN || '';
  },
};

// =============================================================================
// Application Configuration (uses env vars with defaults)
// =============================================================================

export const appConfig = {
  // Internal company domain for filtering
  INTERNAL_DOMAIN: env('INTERNAL_DOMAIN', 'observepoint.com'),

  // Gmail search queries for imports
  DOMO_CSV_SEARCH_QUERY: env('DOMO_CSV_SEARCH_QUERY',
    'subject:"Report - Master - Renewal Opportunities" has:attachment filename:csv newer_than:1d'),

  // Calendar to import from
  CALENDAR_ID: env('CALENDAR_ID', 'primary'),

  // Internal domains to exclude from external contact matching
  INTERNAL_DOMAINS: env('DOMAINS_INTERNAL', 'observepoint.com')
    .split(',')
    .map((d: string) => d.trim().toLowerCase()),

  // Import batch sizes
  IMPORT_BATCH_SIZE: 100,
  EMAIL_IMPORT_LIMIT: 100,
  CALENDAR_IMPORT_DAYS_FUTURE: 90,
  CALENDAR_IMPORT_DAYS_PAST: 180,

  // Meeting cadence calculation
  MEETING_CADENCE_DAYS: 180, // 6 months

  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
};

// =============================================================================
// GitHub Configuration (for legacy task creation if needed)
// =============================================================================

export const githubConfig = {
  REPO_OWNER: env('GITHUB_REPO_OWNER', 'johndavis92790'),
  REPO_NAME: env('GITHUB_REPO_NAME', 'op-account-appscripts'),
  PROJECT_ID: env('GITHUB_PROJECT_ID', ''),
};

// =============================================================================
// Collection Names
// =============================================================================

export const collections = {
  ACCOUNTS: 'accounts',
  TASKS: 'tasks',
  USERS: 'users',
  SETTINGS: 'settings',
  EMAIL_DOMAIN_MAPPINGS: 'emailDomainMappings',
  IMPORT_STATE: 'importState',
  WEBHOOK_LOGS: 'webhookLogs',
  TASK_LABELS: 'taskLabels',
  TASK_CONFIG: 'taskConfig',
} as const;

// =============================================================================
// Subcollection Names
// =============================================================================

export const subcollections = {
  CONTACTS: 'contacts',
  MEETING_RECAPS: 'meetingRecaps',
  EMAILS: 'emails',
  CALENDAR_EVENTS: 'calendarEvents',
  COMMENTS: 'comments',
  ACTIVITY: 'activity',
} as const;

// =============================================================================
// Validation
// =============================================================================

export function validateConfig(): void {
  const missing: string[] = [];

  if (!secrets.WEBHOOK_SECRET) {
    missing.push('WEBHOOK_SECRET');
  }

  if (!secrets.GMAIL_CLIENT_ID || !secrets.GMAIL_CLIENT_SECRET) {
    missing.push('GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET');
  }

  if (missing.length > 0) {
    console.warn(
      `[CONFIG] Missing secrets: ${missing.join(', ')}. ` +
      'Some functions may not work correctly. ' +
      'Run: firebase functions:secrets:set <SECRET_NAME>'
    );
  }
}

// Note: validateConfig() should be called at runtime, not at module load
// to avoid deployment timeouts when secrets aren't yet available
