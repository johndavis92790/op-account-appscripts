/**
 * Tasks hooks — real-time queries against the new top-level `tasks` collection.
 *
 * Schema reference: /TASKS_DATA_MODEL.md.
 *
 * The hooks intentionally accept narrow filter args so they translate one-to-one
 * to a single Firestore query (keeping reads efficient and indexes minimal).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Query,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  Task,
  TaskActivity,
  TaskComment,
  TaskStatus,
} from '../types/tasks';
import { TASK_OPEN_STATUSES } from '../types/tasks';

// -----------------------------------------------------------------------------
// Internal: shared snapshot mapping
// -----------------------------------------------------------------------------

function mapTaskDoc(snapshotId: string, d: Record<string, unknown>): Task {
  return {
    taskId: snapshotId,
    title: (d.title as string) || '',
    description: (d.description as string) || '',
    status: ((d.status as Task['status']) || 'backlog'),
    priority: (d.priority as Task['priority']) ?? null,
    targetDate: (d.targetDate as string) || null,
    accountId: (d.accountId as string) || null,
    accountName: (d.accountName as string) || null,
    parentTaskId: (d.parentTaskId as string) || null,
    assigneeIds: Array.isArray(d.assigneeIds) ? (d.assigneeIds as string[]) : [],
    labelIds: Array.isArray(d.labelIds) ? (d.labelIds as string[]) : [],
    source: ((d.source as Task['source']) || 'manual'),
    sourceRef: (d.sourceRef as Task['sourceRef']) || {},
    createdAt: (d.createdAt as string) || '',
    updatedAt: (d.updatedAt as string) || '',
    closedAt: (d.closedAt as string) || null,
    createdBy: (d.createdBy as string) || '',
  };
}

function useFirestoreTaskQuery(q: Query | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTasks(snap.docs.map((d) => mapTaskDoc(d.id, d.data())));
        setLoading(false);
      },
      (err) => {
        console.error('useTasks query error:', err);
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [q]);

  return { tasks, loading, error };
}

// -----------------------------------------------------------------------------
// Public hooks
// -----------------------------------------------------------------------------

export interface UseTasksOptions {
  /** Filter to a single account. Use `null` for general (no-account) tasks. Omit for all. */
  accountId?: string | null;
  /** Filter to specific statuses. Empty array means "all statuses". */
  statuses?: TaskStatus[];
  /** Convenience: passing `true` is equivalent to statuses = TASK_OPEN_STATUSES. Ignored if `statuses` set. */
  openOnly?: boolean;
  /** Filter to tasks whose assigneeIds array contains this user. */
  assigneeId?: string;
  /** Filter to children of a specific parent task. */
  parentTaskId?: string | null;
}

/**
 * Real-time list of tasks matching the given filters.
 *
 * Note: at most ONE inequality / array-contains constraint per query. The hook
 * picks the most specific filter you provided.
 */
export function useTasks(options: UseTasksOptions = {}) {
  const { accountId, statuses, openOnly, assigneeId, parentTaskId } = options;

  const q = useMemo<Query | null>(() => {
    let qBuilder: Query = collection(db, 'tasks');

    // Most-specific account filter
    if (accountId !== undefined) {
      qBuilder = query(qBuilder, where('accountId', '==', accountId));
    }

    // Status filter
    let statusList = statuses;
    if (!statusList && openOnly) statusList = TASK_OPEN_STATUSES;
    if (statusList && statusList.length > 0) {
      // Firestore `in` supports up to 30 values
      qBuilder = query(qBuilder, where('status', 'in', statusList));
    }

    if (assigneeId) {
      qBuilder = query(qBuilder, where('assigneeIds', 'array-contains', assigneeId));
    }

    if (parentTaskId !== undefined) {
      qBuilder = query(qBuilder, where('parentTaskId', '==', parentTaskId));
    }

    // Default ordering — by recency. UI can re-sort client-side as needed.
    qBuilder = query(qBuilder, orderBy('updatedAt', 'desc'));
    return qBuilder;
  }, [accountId, statuses, openOnly, assigneeId, parentTaskId]);

  return useFirestoreTaskQuery(q);
}

/** Real-time single task. Returns `null` while loading or if the task does not exist. */
export function useTask(taskId: string | undefined) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'tasks', taskId),
      (snap) => {
        if (!snap.exists()) {
          setTask(null);
          setLoading(false);
          return;
        }
        setTask(mapTaskDoc(snap.id, snap.data()));
        setLoading(false);
      },
      (err) => {
        console.error('useTask error:', err);
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [taskId]);

  return { task, loading, error };
}

/** Real-time comments for a task, oldest-first. */
export function useTaskComments(taskId: string | undefined) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'tasks', taskId, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              commentId: d.id,
              body: (data.body as string) || '',
              authorId: (data.authorId as string) || '',
              createdAt: (data.createdAt as string) || '',
              editedAt: (data.editedAt as string) || null,
            };
          })
        );
        setLoading(false);
      },
      (err) => {
        console.error('useTaskComments error:', err);
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [taskId]);

  return { comments, loading, error };
}

/** Real-time activity feed for a task, newest-first. */
export function useTaskActivity(taskId: string | undefined, limit = 50) {
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setActivity([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'tasks', taskId, 'activity'),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: TaskActivity[] = snap.docs.slice(0, limit).map((d) => {
          const data = d.data();
          return {
            activityId: d.id,
            type: (data.type as TaskActivity['type']) || 'created',
            actorId: (data.actorId as string) || '',
            timestamp: (data.timestamp as string) || '',
            detail: (data.detail as TaskActivity['detail']) || undefined,
          };
        });
        setActivity(items);
        setLoading(false);
      },
      (err) => {
        console.error('useTaskActivity error:', err);
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [taskId, limit]);

  return { activity, loading, error };
}
