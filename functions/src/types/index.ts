/**
 * TypeScript type definitions for Firebase Functions
 * Aligned with TASKS_DATA_MODEL.md and existing dashboard types
 */

// =============================================================================
// Firestore Document Types
// =============================================================================

export interface Account {
  accountId: string;
  accountName: string;
  autoRenewal: string;
  renewalDate: string | null;
  renewable: number;
  forcast: number;
  status: string;
  stage: string;
  loginScore: number;
  auditUsage: number;
  journeyUsage: number;
  forecast: string;
  csm: string;
  ae: string;
  salesEngineer: string;
  fiscalQuarter: string;
  fiscalYear: string;
  pricePerPage: number;
  linkToOpp: string;
  linkToAccount: string;
  engagementScore: number;
  daysSinceLastContact: number | null;
  lastEmailDate: string | null;
  avgMeetingAttendancePct: number;
  lastMeetingDate: string | null;
  nextMeetingDate: string | null;
  emailCountTotal: number;
  emailsSent: number;
  emailsReceived: number;
  emailCount30d: number;
  emailCount90d: number;
  meetingsPast: number;
  meetingsFuture: number;
  meetings30d: number;
  githubTasksTotal: number;
  githubTasksOpen: number;
  githubTasksClosed: number;
  meetingRecapsCount: number;
  actionItemsCount: number;
  meetingCadence: string;
  emailDomains: string;
  emailDomainsAuto?: string;
  emailDomainsManual?: string;
  emailDomainsExcluded?: string;
  emailDomainsLastAutoSync?: string;
  isActive: boolean;
  deactivatedAt: string | null;
  lastImported: string;
  importSource: string;
  // Webapp-managed fields (not overwritten by imports)
  notes?: AccountNotes;
  successCriteria?: AccountNotes;
  manualTasks?: ManualTask[];
  contacts?: AccountContact[];
}

export interface AccountNotes {
  content: string;
  lastSaved: string | null;
}

export interface ManualTask {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Done';
  accountId: string;
  accountName: string;
  githubIssueId: string | null;
  githubIssueNumber: number | null;
  githubIssueUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountContact {
  email: string;
  name: string;
  title: string;
  roles: string[];
  linkedInUrl: string;
  contactId: string;
  accountId: string;
  accountName: string;
  notes: string;
  lastUpdated: string;
  lastMeetingRecapId?: string;
}

export interface MeetingRecap {
  recapId: string;
  meetingTitle: string;
  meetingCompany: string;
  meetingDate: string;
  meetingEndTime: string;
  meetingDuration: string;
  summary: string;
  actualAttendees: string;
  invitedAttendees: string;
  allNames: string;
  externalAttendees: string;
  myActionItemsCount: number;
  othersActionItemsCount: number;
  totalActionItemsCount: number;
  accountId: string;
  accountName: string;
  opportunityId: string;
  opportunityName: string;
  mappedDomain: string;
  meetingLink: string;
  zoomLink: string;
  slackMessages: string | null;
  calendarEventId: string | null;
  receivedDate: string;
  internalAttendees: RecapAttendee[];
  externalAttendeesDetailed: RecapAttendee[];
  followUpEmailSubject?: string;
  followUpEmailTo?: string;
  followUpEmailDraftStatus?: string;
}

export interface RecapAttendee {
  name: string;
  email: string;
  invited: boolean;
  actuallyAttended: boolean;
  roles?: string[];
  title?: string;
  linkedInUrl?: string;
  contactId?: string;
}

export interface ActionItem {
  recapId: string;
  index: number;
  title: string;
  description: string;
  priority: string;
  assignee: string | null;
  accountId: string;
  accountName: string;
  meetingTitle: string;
}

export interface Email {
  messageId: string;
  threadId: string;
  date: string;
  from: string;
  fromDomain: string;
  to: string;
  subject: string;
  bodyPreview: string;
  isOutbound: boolean;
  accountId: string;
  accountName: string;
  importedAt: string;
}

export interface CalendarEvent {
  eventId: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  attendeeCount: number;
  acceptedCount: number;
  accountId: string;
  accountName: string;
  isPast: boolean;
  myStatus: string;
  attendeeNames: string;
  importedAt: string;
}

export interface EmailDomainMapping {
  accountId: string;
  accountName: string;
  emailDomains: string[];
  lastUpdated: string;
}

// =============================================================================
// Task Types (from TASKS_DATA_MODEL.md)
// =============================================================================

export type TaskStatus = 'backlog' | 'generated' | 'in_progress' | 'done' | 'not_applicable';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low' | null;
export type TaskSource = 'manual' | 'meeting_recap' | 'email' | 'imported';

export interface Task {
  taskId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  targetDate: string | null;
  accountId: string | null;
  accountName: string | null;
  parentTaskId: string | null;
  assigneeIds: string[];
  labelIds: string[];
  source: TaskSource;
  sourceRef: TaskSourceRef;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  createdBy: string;
}

export interface TaskSourceRef {
  meetingRecapId?: string;
  meetingTitle?: string;
  meetingDate?: string;
  meetingLink?: string;
  emailMessageId?: string;
  manuallyCreatedBy?: string;
  githubLegacyNumber?: number;
  githubLegacyNodeId?: string;
}

export interface TaskComment {
  commentId: string;
  body: string;
  authorId: string;
  createdAt: string;
  editedAt: string | null;
}

export interface TaskActivity {
  activityId: string;
  type: TaskActivityType;
  actorId: string;
  timestamp: string;
  detail?: {
    field?: string;
    from?: unknown;
    to?: unknown;
    note?: string;
    added?: string[];
    removed?: string[];
  };
}

export type TaskActivityType =
  | 'created'
  | 'status_changed'
  | 'priority_changed'
  | 'account_changed'
  | 'assignee_added'
  | 'assignee_removed'
  | 'parent_changed'
  | 'comment_added'
  | 'labels_changed'
  | 'title_changed'
  | 'description_changed'
  | 'closed'
  | 'reopened'
  | 'imported_from_github'
  | 'target_date_changed';

// =============================================================================
// Webhook Payload Types
// =============================================================================

export interface MeetingRecapPayload {
  meetingInfo: {
    title: string;
    startTime: string;
    endTime: string;
    meetingLink: string;
    meetingUrl?: string;
  };
  companyInfo: {
    companyName: string;
    slackMessages?: number | any[];
  };
  attendees: {
    actual: string[];
    invited: string[];
    allNames: string[];
  };
  externalAttendees?: Array<{
    Email: string;
    Name?: string;
    Title?: string;
    Roles?: string[] | string;
    'LinkedIn URL'?: string;
    'Contact ID'?: string;
  }>;
  internalAttendees?: Array<{
    Email: string;
    Name?: string;
    Title?: string;
    'Actually Attended'?: boolean;
    Invited?: boolean;
  }>;
  summary: string;
  actionItems: {
    myItems: Array<{
      actionItemTitle: string;
      actionItemDescription: string;
      priority?: string;
    }>;
    othersItems: Array<{
      actionItemTitle: string;
      actionItemDescription: string;
    }>;
  };
  followUpEmail?: {
    subject: string;
    htmlBody: string;
    toEmails: string[];
  };
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  priority?: string;
  accountName?: string;
  accountId?: string;
  createdBy?: string;
}

// =============================================================================
// Import State Tracking
// =============================================================================

export interface ImportState {
  importType: string;
  lastSyncToken?: string;
  lastRunAt: string;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  totalImported: number;
  checkpoint?: Record<string, unknown>;
}

// =============================================================================
// CSV Types
// =============================================================================

export interface CSVImportConfig {
  id: string;
  name: string;
  emailSearchQuery: string;
  requiredColumns: string[];
  columnMapping: Record<string, string>;
}

export interface DomoRenewalRow {
  'Account Name': string;
  'Account ID'?: string;
  'Id'?: string;
  'Renewal Date'?: string;
  'Renewable ARR'?: string | number;
  'Status'?: string;
  'Stage'?: string;
  'Customer Success Manager'?: string;
  'Account Executive'?: string;
  'Sales Engineer'?: string;
  'Fiscal Quarter'?: string;
  'Fiscal Year'?: string;
  'Price Per Page'?: string | number;
  'Link to Opp'?: string;
  'Link to Account'?: string;
  'Auto Renewal'?: string;
  [key: string]: string | number | undefined;
}
