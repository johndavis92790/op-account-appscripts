export interface Account {
  accountId: string;
  accountName: string;

  // Renewal info
  autoRenewal: string;
  renewalDate: string | null;
  renewable: number;
  forcast: number;
  status: string;
  stage: string;

  // Scores & Usage
  loginScore: number;
  auditUsage: number;
  journeyUsage: number;
  forecast: string;

  // People
  csm: string;
  ae: string;

  // Engagement metrics
  engagementScore: number;
  daysSinceLastContact: number | null;
  lastEmailDate: string | null;
  avgMeetingAttendancePct: number;
  lastMeetingDate: string | null;
  nextMeetingDate: string | null;

  // Aggregated counts
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

  // Resolved reference data
  tasks: Task[];
  emails: Email[];
  meetings: Meeting[];
  meetingRecaps: MeetingRecap[];

  // Notes (bidirectional sync)
  notes: AccountNotes;

  // Manual tasks created in webapp
  manualTasks: ManualTask[];

  // Metadata
  lastSynced: string;
}

export interface AccountListItem {
  accountId: string;
  accountName: string;
  status: string;
  stage: string;
  engagementScore: number;
  renewalDate: string | null;
  daysSinceLastContact: number | null;
  nextMeetingDate: string | null;
  forecast: string;
  csm: string;
  ae: string;
  githubTasksOpen: number;
  renewable: number;
  loginScore: number;
  auditUsage: number;
  journeyUsage: number;
  meetingsFuture: number;
}

export interface Task {
  taskId: string;
  number: number | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  state: string;
  url: string;
  labels: string;
  accountName: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface Email {
  messageId: string;
  threadId?: string;
  date: string;
  from: string;
  fromDomain: string;
  to: string;
  subject: string;
  bodyPreview: string;
  isOutbound: boolean;
  accountName: string;
}

export interface Meeting {
  eventId: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  attendeeCount: number;
  acceptedCount: number;
  accountName: string;
  isPast: boolean;
  myStatus: string;
  attendeeNames: string;
}

export interface MeetingRecap {
  recapId: string;
  meetingTitle: string;
  meetingDate: string;
  summary: string;
  meetingLink: string;
  myActionItemsCount: number;
  othersActionItemsCount: number;
  totalActionItems: number;
  actualAttendees: string;
  externalAttendees: string;
  allNames: string;
  duration: string;
  actionItems: ActionItem[];
}

export interface ActionItem {
  recapId: string;
  index: number;
  title: string;
  description: string;
  priority: string;
  githubIssueId: string;
  githubIssueNumber: number | null;
  meetingTitle: string;
  accountName: string;
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

export type ScoreLevel = 'high' | 'medium' | 'low';

export function getScoreLevel(score: number): ScoreLevel {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function getStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('on-track') || s.includes('on track')) return 'status-on-track';
  if (s.includes('at-risk') || s.includes('at risk')) return 'status-at-risk';
  if (s.includes('off-track') || s.includes('off track') || s.includes('churn')) return 'status-off-track';
  return 'status-on-track';
}
