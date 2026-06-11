/**
 * CRUD helpers for the global `taskLabels` collection.
 *
 * Labels are intentionally not tied to a single task; deleting a label is a
 * destructive op that orphans the labelId on every task that referenced it.
 * The dashboard handles orphans gracefully (renders the raw id grayed-out)
 * but a Cloud Function janitor pass would be cleaner long-term.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface CreateLabelInput {
  name: string;
  color: string;
  description?: string | null;
}

export async function createTaskLabel(
  input: CreateLabelInput,
  currentUserEmail: string
): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error('Label name is required.');
  if (name.length > 60) throw new Error('Label name must be 60 characters or less.');

  // Cheap dedup: case-insensitive name uniqueness. Firestore can't
  // case-insensitive query natively so we pull active labels and check.
  // For our scale this is fine — labels are a small set (10s, not 1000s).
  const snap = await getDocs(collection(db, 'taskLabels'));
  for (const d of snap.docs) {
    const existing = (d.data().name as string) || '';
    if (existing.trim().toLowerCase() === name.toLowerCase()) {
      throw new Error(`A label named "${existing}" already exists.`);
    }
  }

  const ref = await addDoc(collection(db, 'taskLabels'), {
    name,
    color: input.color,
    description: input.description || null,
    createdAt: new Date().toISOString(),
    createdBy: currentUserEmail || 'unknown',
  });
  return ref.id;
}

export interface UpdateLabelPatch {
  name?: string;
  color?: string;
  description?: string | null;
}

export async function updateTaskLabel(
  labelId: string,
  patch: UpdateLabelPatch
): Promise<void> {
  const next: Record<string, unknown> = {};
  if (patch.name !== undefined) next.name = patch.name.trim();
  if (patch.color !== undefined) next.color = patch.color;
  if (patch.description !== undefined) next.description = patch.description || null;
  if (Object.keys(next).length === 0) return;
  await updateDoc(doc(db, 'taskLabels', labelId), next);
}

/**
 * Delete a label and remove its id from every task's `labelIds` array.
 * For our scale this is a single batched pass; would warrant a Cloud
 * Function fan-out for a much larger task corpus.
 */
export async function deleteTaskLabel(labelId: string): Promise<void> {
  // Sweep tasks that reference this label
  const q = query(
    collection(db, 'tasks'),
    where('labelIds', 'array-contains', labelId)
  );
  const snap = await getDocs(q);

  // Firestore batched writes cap at 500 ops — chunk if needed.
  const tasksToPatch = snap.docs.slice();
  while (tasksToPatch.length > 0) {
    const chunk = tasksToPatch.splice(0, 400);
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    for (const taskDoc of chunk) {
      const fresh = await getDoc(taskDoc.ref);
      const next = (((fresh.data() || {}).labelIds as string[]) || []).filter(
        (id) => id !== labelId
      );
      batch.update(taskDoc.ref, { labelIds: next, updatedAt: nowIso });
    }
    await batch.commit();
  }

  await deleteDoc(doc(db, 'taskLabels', labelId));
}
