/**
 * Task write helpers — direct Firestore SDK mutations from the dashboard.
 *
 * Every mutation that changes a tracked field appends an `activity` subcollection
 * entry so the audit trail in TaskDetail stays accurate. See TASKS_DATA_MODEL.md
 * for the activity type taxonomy.
 *
 * These are plain async functions (not hooks) so they can be called from event
 * handlers without an extra render. Callers are responsible for displaying
 * loading / error states.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  Task,
  TaskActivity,
  TaskActivityType,
  TaskPriority,
  TaskSource,
  TaskSourceRef,
  TaskStatus,
} from '../types/tasks';
import { TASK_OPEN_STATUSES } from '../types/tasks';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority | null;
  targetDate?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  parentTaskId?: string | null;
  assigneeIds?: string[];
  labelIds?: string[];
  source?: TaskSource;
  sourceRef?: TaskSourceRef;
}

/**
 * Mutable subset of a Task. Anything not listed here is managed automatically
 * (createdAt, createdBy, source, sourceRef are immutable post-creation;
 *  updatedAt/closedAt are stamped by these helpers).
 */
export type UpdateTaskPatch = Partial<
  Pick<
    Task,
    | 'title'
    | 'description'
    | 'status'
    | 'priority'
    | 'targetDate'
    | 'accountId'
    | 'accountName'
    | 'parentTaskId'
    | 'assigneeIds'
    | 'labelIds'
  >
>;

// -----------------------------------------------------------------------------
// Internal: activity logging
// -----------------------------------------------------------------------------

interface ActivityInput {
  type: TaskActivityType;
  actorId: string;
  detail?: TaskActivity['detail'];
}

async function logActivity(taskId: string, input: ActivityInput): Promise<void> {
  await addDoc(collection(db, 'tasks', taskId, 'activity'), {
    type: input.type,
    actorId: input.actorId || 'unknown',
    timestamp: new Date().toISOString(),
    ...(input.detail ? { detail: input.detail } : {}),
  });
}

// -----------------------------------------------------------------------------
// Create
// -----------------------------------------------------------------------------

/**
 * Create a new task. Stamps audit fields, defaults status to 'backlog',
 * source to 'manual', and assignee to the creator. Returns the new taskId.
 */
export async function createTask(
  input: CreateTaskInput,
  currentUserEmail: string
): Promise<string> {
  if (!input.title || !input.title.trim()) {
    throw new Error('Task title is required');
  }

  const nowIso = new Date().toISOString();
  const status: TaskStatus = input.status || 'backlog';
  const source: TaskSource = input.source || 'manual';
  const closed = !TASK_OPEN_STATUSES.includes(status);

  const docData = {
    title: input.title.trim(),
    description: input.description || '',
    status,
    priority: input.priority ?? null,
    targetDate: input.targetDate || null,
    accountId: input.accountId ?? null,
    accountName: input.accountName ?? null,
    parentTaskId: input.parentTaskId ?? null,
    assigneeIds:
      input.assigneeIds && input.assigneeIds.length > 0
        ? input.assigneeIds
        : currentUserEmail
        ? [currentUserEmail]
        : [],
    labelIds: input.labelIds || [],
    source,
    sourceRef:
      input.sourceRef ||
      (source === 'manual' ? { manuallyCreatedBy: currentUserEmail } : {}),
    createdAt: nowIso,
    updatedAt: nowIso,
    closedAt: closed ? nowIso : null,
    createdBy: currentUserEmail || 'unknown',
    // Apps Script uses serverTimestamp via REST when it writes; from the client
    // we rely on ISO strings so queries / ordering remain consistent. We also
    // stash a server timestamp for forensic accuracy.
    _serverCreatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, 'tasks'), docData);

  await logActivity(ref.id, {
    type: 'created',
    actorId: currentUserEmail,
  });

  return ref.id;
}

// -----------------------------------------------------------------------------
// Update
// -----------------------------------------------------------------------------

/**
 * Patch a task. Compares `patch` against `prev` to decide which activity
 * entries to write. Stamps `updatedAt`. Handles `closedAt` automatically on
 * status transitions between open and closed buckets.
 */
export async function updateTask(
  taskId: string,
  patch: UpdateTaskPatch,
  prev: Task,
  currentUserEmail: string
): Promise<void> {
  const nowIso = new Date().toISOString();

  // Build the actual update object — only fields that changed.
  const update: Record<string, unknown> = { updatedAt: nowIso };
  const activityEntries: ActivityInput[] = [];

  if (patch.title !== undefined && patch.title.trim() !== prev.title) {
    update.title = patch.title.trim();
    activityEntries.push({
      type: 'title_changed',
      actorId: currentUserEmail,
      detail: { from: prev.title, to: patch.title.trim() },
    });
  }
  if (patch.description !== undefined && patch.description !== prev.description) {
    update.description = patch.description;
    activityEntries.push({
      type: 'description_changed',
      actorId: currentUserEmail,
    });
  }

  if (patch.status !== undefined && patch.status !== prev.status) {
    update.status = patch.status;
    activityEntries.push({
      type: 'status_changed',
      actorId: currentUserEmail,
      detail: { field: 'status', from: prev.status, to: patch.status },
    });

    const wasOpen = TASK_OPEN_STATUSES.includes(prev.status);
    const willBeOpen = TASK_OPEN_STATUSES.includes(patch.status);
    if (wasOpen && !willBeOpen) {
      update.closedAt = nowIso;
      activityEntries.push({ type: 'closed', actorId: currentUserEmail });
    } else if (!wasOpen && willBeOpen) {
      update.closedAt = null;
      activityEntries.push({ type: 'reopened', actorId: currentUserEmail });
    }
  }

  if (patch.priority !== undefined && patch.priority !== prev.priority) {
    update.priority = patch.priority;
    activityEntries.push({
      type: 'priority_changed',
      actorId: currentUserEmail,
      detail: { field: 'priority', from: prev.priority, to: patch.priority },
    });
  }

  if (patch.targetDate !== undefined && patch.targetDate !== prev.targetDate) {
    update.targetDate = patch.targetDate;
    activityEntries.push({
      type: 'target_date_changed',
      actorId: currentUserEmail,
      detail: { from: prev.targetDate ?? null, to: patch.targetDate ?? null },
    });
  }

  if (patch.accountId !== undefined && patch.accountId !== prev.accountId) {
    update.accountId = patch.accountId;
    update.accountName = patch.accountName ?? null;
    activityEntries.push({
      type: 'account_changed',
      actorId: currentUserEmail,
      detail: {
        field: 'accountId',
        from: prev.accountName || prev.accountId,
        to: patch.accountName || patch.accountId,
      },
    });
  } else if (
    patch.accountName !== undefined &&
    patch.accountName !== prev.accountName
  ) {
    // accountId unchanged but denormalized name drifted — silently sync.
    update.accountName = patch.accountName;
  }

  if (patch.parentTaskId !== undefined && patch.parentTaskId !== prev.parentTaskId) {
    update.parentTaskId = patch.parentTaskId;
    activityEntries.push({
      type: 'parent_changed',
      actorId: currentUserEmail,
      detail: { field: 'parentTaskId', from: prev.parentTaskId, to: patch.parentTaskId },
    });
  }

  if (patch.assigneeIds !== undefined) {
    const prevSet = new Set(prev.assigneeIds || []);
    const nextSet = new Set(patch.assigneeIds);
    const added = [...nextSet].filter((a) => !prevSet.has(a));
    const removed = [...prevSet].filter((a) => !nextSet.has(a));
    if (added.length > 0 || removed.length > 0) {
      update.assigneeIds = patch.assigneeIds;
      added.forEach((a) =>
        activityEntries.push({
          type: 'assignee_added',
          actorId: currentUserEmail,
          detail: { to: a },
        })
      );
      removed.forEach((a) =>
        activityEntries.push({
          type: 'assignee_removed',
          actorId: currentUserEmail,
          detail: { from: a },
        })
      );
    }
  }

  if (patch.labelIds !== undefined) {
    const prevSet = new Set(prev.labelIds || []);
    const nextSet = new Set(patch.labelIds);
    const added = [...nextSet].filter((a) => !prevSet.has(a));
    const removed = [...prevSet].filter((a) => !nextSet.has(a));
    if (added.length > 0 || removed.length > 0) {
      update.labelIds = patch.labelIds;
      activityEntries.push({
        type: 'labels_changed',
        actorId: currentUserEmail,
        detail: { added, removed },
      });
    }
  }

  // Nothing actually changed (other than updatedAt) — bail out to avoid noisy writes.
  if (Object.keys(update).length === 1) return;

  await updateDoc(doc(db, 'tasks', taskId), update);

  // Activity entries are best-effort; rules only allow creates so failures
  // bubble up but don't roll back the main update.
  for (const entry of activityEntries) {
    await logActivity(taskId, entry);
  }
}

// -----------------------------------------------------------------------------
// Delete
// -----------------------------------------------------------------------------

/**
 * Permanently delete a task and its comments. Activity sub-collection entries
 * are intentionally left intact — Firestore rules deny client-side deletes on
 * activity (append-only audit log), so attempting to delete them would fail the
 * entire batch. Orphaned activity documents are harmless.
 */
export async function deleteTask(taskId: string): Promise<void> {
  // Fetch comments sub-collection first.
  // Note: activity docs are append-only (rules deny client deletes), so we
  // intentionally skip them — orphaned activity entries are harmless.
  const commentsSnap = await getDocs(collection(db, 'tasks', taskId, 'comments'));

  const batch = writeBatch(db);
  commentsSnap.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'tasks', taskId));
  await batch.commit();
}

// -----------------------------------------------------------------------------
// Comments
// -----------------------------------------------------------------------------

export async function addComment(
  taskId: string,
  body: string,
  currentUserEmail: string
): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;
  const nowIso = new Date().toISOString();

  await addDoc(collection(db, 'tasks', taskId, 'comments'), {
    body: trimmed,
    authorId: currentUserEmail || 'unknown',
    createdAt: nowIso,
    editedAt: null,
  });

  await logActivity(taskId, {
    type: 'comment_added',
    actorId: currentUserEmail,
  });

  // Bump the parent task's updatedAt so it sorts to the top of recency views.
  await updateDoc(doc(db, 'tasks', taskId), { updatedAt: nowIso });
}

// -----------------------------------------------------------------------------
// Convenience wrappers
// -----------------------------------------------------------------------------

/** Shorthand for status-only updates (used by drag-drop on the kanban). */
export async function setTaskStatus(
  taskId: string,
  status: TaskStatus,
  prev: Task,
  currentUserEmail: string
): Promise<void> {
  if (prev.status === status) return;
  await updateTask(taskId, { status }, prev, currentUserEmail);
}

// -----------------------------------------------------------------------------
// Bulk operations (used by multi-select on TaskBoard)
// -----------------------------------------------------------------------------

export interface BulkUpdateInput {
  status?: TaskStatus;
  priority?: TaskPriority | null;
  /** Replace mode: overwrite labelIds entirely. */
  labelIds?: string[];
  /** Add mode: union with existing labelIds. */
  addLabelIds?: string[];
  /** Remove mode: subtract from existing labelIds. */
  removeLabelIds?: string[];
}

/**
 * Apply the same patch to many tasks. Walks via individual `updateTask`
 * calls (not a single batch) so each task gets accurate per-task activity
 * entries reflecting its own previous state.
 *
 * Errors on individual tasks are collected and returned; the caller decides
 * whether to surface a partial-success state.
 */
export async function bulkUpdateTasks(
  tasks: Task[],
  input: BulkUpdateInput,
  currentUserEmail: string
): Promise<{ succeeded: number; failed: { taskId: string; error: string }[] }> {
  const failures: { taskId: string; error: string }[] = [];
  let succeeded = 0;

  for (const t of tasks) {
    const patch: UpdateTaskPatch = {};
    if (input.status !== undefined) patch.status = input.status;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.labelIds !== undefined) {
      patch.labelIds = input.labelIds;
    } else if (input.addLabelIds || input.removeLabelIds) {
      const next = new Set(t.labelIds || []);
      (input.addLabelIds || []).forEach((id) => next.add(id));
      (input.removeLabelIds || []).forEach((id) => next.delete(id));
      patch.labelIds = [...next];
    }
    try {
      await updateTask(t.taskId, patch, t, currentUserEmail);
      succeeded++;
    } catch (err) {
      failures.push({
        taskId: t.taskId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return { succeeded, failed: failures };
}

/**
 * Bulk-delete tasks. Sub-collection cleanup uses the same per-task path as
 * `deleteTask` so behavior stays identical.
 */
export async function bulkDeleteTasks(
  taskIds: string[]
): Promise<{ succeeded: number; failed: { taskId: string; error: string }[] }> {
  const failures: { taskId: string; error: string }[] = [];
  let succeeded = 0;

  for (const id of taskIds) {
    try {
      await deleteTask(id);
      succeeded++;
    } catch (err) {
      failures.push({
        taskId: id,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return { succeeded, failed: failures };
}
