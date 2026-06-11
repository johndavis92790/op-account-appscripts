/**
 * Real-time list of task labels (top-level `taskLabels` collection).
 *
 * Labels are global / shared across every task in the system, similar to
 * GitHub's repo-wide label set. Tasks reference labels by id via `labelIds`.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { TaskLabel } from '../types/tasks';

export function useTaskLabels() {
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'taskLabels'), orderBy('name', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: TaskLabel[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            labelId: d.id,
            name: (data.name as string) || '',
            color: (data.color as string) || '#64748b',
            description: (data.description as string) || null,
            createdAt: (data.createdAt as string) || '',
            createdBy: (data.createdBy as string) || '',
          };
        });
        setLabels(items);
        setLoading(false);
      },
      (err) => {
        console.error('useTaskLabels error:', err);
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  /** Quick id → label lookup. */
  const labelsById = useMemo(() => {
    const m = new Map<string, TaskLabel>();
    for (const l of labels) m.set(l.labelId, l);
    return m;
  }, [labels]);

  return { labels, labelsById, loading, error };
}
