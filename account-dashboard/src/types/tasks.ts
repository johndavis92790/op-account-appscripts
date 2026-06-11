/**
 * Task manager types — replaces the legacy GitHub-Project-derived types.
 *
 * These are the source of truth for the new task system. Once Phase 6 cutover
 * completes, the legacy `Task` and `ManualTask` interfaces in `./index.ts` can
 * be removed.
 *
 * Schema reference: see /TASKS_DATA_MODEL.md at repo root.
 */

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export type TaskStatus =
  | 'backlog'
  | 'generated'
  | 'in_progress'
  | 'done'
  | 'not_applicable';

export const TASK_STATUSES: TaskStatus[] = [
  'backlog',
  'generated',
  'in_progress',
  'done',
  'not_applicable',
];

/** Statuses that count as "open" / on the active board */
export const TASK_OPEN_STATUSES: TaskStatus[] = [
  'backlog',
  'generated',
  'in_progress',
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  generated: 'Generated',
  in_progress: 'In progress',
  done: 'Done',
  not_applicable: 'Not Applicable',
};

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export const TASK_PRIORITIES: TaskPriority[] = ['critical', 'high', 'medium', 'low'];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export type TaskSource = 'manual' | 'meeting_recap' | 'email' | 'imported';

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

// -----------------------------------------------------------------------------
// Documents
// -----------------------------------------------------------------------------

export interface TaskSourceRef {
  /** Set when source = 'meeting_recap'. Points at accounts/{aid}/meetingRecaps/{rid}. */
  meetingRecapId?: string;
  /** Set when source = 'meeting_recap'. Frozen-in-time snapshot of the recap headers
   *  so TaskDetail can render meeting context without an extra fetch. */
  meetingTitle?: string;
  meetingDate?: string;
  meetingLink?: string;
  /** Set when source = 'email'. Reserved for future use. */
  emailMessageId?: string;
  /** User id (email) who manually created. Set when source = 'manual'. */
  manuallyCreatedBy?: string;
  /** GitHub issue number, only on source = 'imported'. */
  githubLegacyNumber?: number;
  /** GitHub GraphQL node id, only on source = 'imported'. */
  githubLegacyNodeId?: string;
}

export interface Task {
  taskId: string;

  title: string;
  description: string;

  status: TaskStatus;
  priority: TaskPriority | null;
  /** ISO date "YYYY-MM-DD" or null. No time component. */
  targetDate: string | null;

  /** FK to accounts/{accountId}. null = general / no account. */
  accountId: string | null;

  /** Convenience denormalization, set on write. Useful for queries that don't join. */
  accountName: string | null;

  /** null = root task. */
  parentTaskId: string | null;

  /** Empty array = unassigned. Single-user app stamps [currentUserEmail]. */
  assigneeIds: string[];

  /** FK list to taskLabels/{labelId}. Empty = no labels. */
  labelIds: string[];

  source: TaskSource;
  sourceRef: TaskSourceRef;

  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp */
  updatedAt: string;
  /** ISO timestamp; set when status -> done | not_applicable */
  closedAt: string | null;

  /** User id (email) or 'system'. */
  createdBy: string;
}

export interface TaskComment {
  commentId: string;
  body: string;
  authorId: string;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp; null until edited. */
  editedAt: string | null;
}

export interface TaskActivity {
  activityId: string;
  type: TaskActivityType;
  actorId: string;
  /** ISO timestamp */
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

// -----------------------------------------------------------------------------
// Labels (top-level taskLabels collection — shared across all tasks)
// -----------------------------------------------------------------------------

/** Pre-defined color palette (Tailwind-aligned) for label swatches. */
export const TASK_LABEL_COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#10b981', // emerald-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#64748b', // slate-500
  '#737373', // neutral-500
] as const;

export type TaskLabelColor = typeof TASK_LABEL_COLORS[number];

export interface TaskLabel {
  labelId: string;
  name: string;
  /** Hex color from TASK_LABEL_COLORS, plus any custom hex set later. */
  color: string;
  description: string | null;
  createdAt: string;
  createdBy: string;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function isTaskOpen(t: Pick<Task, 'status'>): boolean {
  return TASK_OPEN_STATUSES.includes(t.status);
}

export function isTaskClosed(t: Pick<Task, 'status'>): boolean {
  return t.status === 'done' || t.status === 'not_applicable';
}

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Sort comparator: critical < high < medium < low. Null priorities sort last. */
export function comparePriority(a: TaskPriority | null, b: TaskPriority | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return PRIORITY_ORDER[a] - PRIORITY_ORDER[b];
}

const STATUS_ORDER: Record<TaskStatus, number> = {
  generated: 0,
  in_progress: 1,
  backlog: 2,
  done: 3,
  not_applicable: 4,
};

/** Sort comparator: generated < in_progress < backlog < done < not_applicable. */
export function compareStatus(a: TaskStatus, b: TaskStatus): number {
  return STATUS_ORDER[a] - STATUS_ORDER[b];
}
