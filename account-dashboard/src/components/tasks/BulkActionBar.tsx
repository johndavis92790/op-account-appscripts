/**
 * Floating action bar shown when one or more tasks are selected on the
 * board / list. Lets the user run bulk operations: move status, change
 * priority, add labels, delete.
 *
 * Stays sticky at the bottom of the viewport so it never interrupts the
 * card grid above.
 */
import { useState } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from '../../types/tasks';
import type { Task, TaskPriority, TaskStatus } from '../../types/tasks';
import { LabelPicker } from './LabelPicker';
import { bulkUpdateTasks, bulkDeleteTasks } from '../../hooks/taskMutations';
import { useAuth } from '../../hooks/useAuth';

interface BulkActionBarProps {
  /** Full Task records for the currently-selected ids. Used so per-task
   *  activity entries reflect each task's individual prior state. */
  selected: Task[];
  onClear: () => void;
}

export function BulkActionBar({ selected, onClear }: BulkActionBarProps) {
  const { user } = useAuth();
  const currentUser = user?.email || '';
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (selected.length === 0) return null;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk operation failed');
    } finally {
      setBusy(null);
    }
  };

  const handleStatus = (status: TaskStatus) =>
    run('status', async () => {
      const res = await bulkUpdateTasks(selected, { status }, currentUser);
      if (res.failed.length > 0) {
        setError(`${res.failed.length} of ${selected.length} updates failed`);
      }
    });

  const handlePriority = (priority: TaskPriority | null) =>
    run('priority', async () => {
      const res = await bulkUpdateTasks(selected, { priority }, currentUser);
      if (res.failed.length > 0) {
        setError(`${res.failed.length} of ${selected.length} updates failed`);
      }
    });

  const handleAddLabels = (labelIds: string[]) =>
    run('labels', async () => {
      // LabelPicker hands us the FULL desired set on every change, but for
      // a bulk add we treat the new ids as additions to existing label sets.
      // We diff against the union of selected tasks' current labels to know
      // what to add — see explanation in CHANGELOG/types.
      const existingUnion = new Set<string>();
      for (const t of selected) (t.labelIds || []).forEach((id) => existingUnion.add(id));
      const toAdd = labelIds.filter((id) => !existingUnion.has(id));
      const toRemove = [...existingUnion].filter((id) => !labelIds.includes(id));
      const res = await bulkUpdateTasks(
        selected,
        { addLabelIds: toAdd, removeLabelIds: toRemove },
        currentUser
      );
      if (res.failed.length > 0) {
        setError(`${res.failed.length} of ${selected.length} updates failed`);
      }
    });

  const handleDelete = () =>
    run('delete', async () => {
      if (
        !confirm(
          `Delete ${selected.length} task${selected.length === 1 ? '' : 's'}? This cannot be undone.`
        )
      ) {
        return;
      }
      const res = await bulkDeleteTasks(selected.map((t) => t.taskId));
      if (res.failed.length > 0) {
        setError(`${res.failed.length} of ${selected.length} deletes failed`);
      } else {
        onClear();
      }
    });

  // Compute the union of labels currently on the selection so the picker
  // can render those pills as the "current" selection.
  const unionLabelIds = Array.from(
    new Set(selected.flatMap((t) => t.labelIds || []))
  );

  return (
    <div className="sticky bottom-3 z-30 mt-3 mx-auto w-fit max-w-[95%] flex flex-wrap items-center gap-2 px-3 py-2 bg-dark-900/95 border border-accent/40 rounded-xl shadow-2xl backdrop-blur">
      <span className="text-xs font-medium text-dark-100 mr-1">
        {selected.length} selected
      </span>

      {/* Move status */}
      <BulkSelect
        label="Move to"
        disabled={busy !== null}
        onChange={(v) => v && handleStatus(v as TaskStatus)}
        options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))}
      />

      {/* Priority */}
      <BulkSelect
        label="Priority"
        disabled={busy !== null}
        onChange={(v) => handlePriority((v || null) as TaskPriority | null)}
        options={[
          { value: '', label: '— None —' },
          ...TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] })),
        ]}
      />

      {/* Labels */}
      <div className="flex items-center gap-1 px-2 py-1 bg-dark-800/60 border border-dark-700 rounded-md">
        <span className="text-[10px] uppercase tracking-wider text-dark-500">Labels</span>
        <LabelPicker
          value={unionLabelIds}
          onChange={handleAddLabels}
          placeholder="Edit"
          compact
        />
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy !== null}
        className="flex items-center gap-1 px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-300 text-xs rounded-md disabled:opacity-50"
      >
        {busy === 'delete' ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Trash2 className="w-3 h-3" />
        )}
        Delete
      </button>

      {/* Clear */}
      <button
        type="button"
        onClick={onClear}
        className="flex items-center gap-1 px-2 py-1 text-dark-400 hover:text-dark-100 text-xs"
        title="Clear selection (Esc)"
      >
        <X className="w-3 h-3" />
        Clear
      </button>

      {busy && (
        <span className="flex items-center gap-1 text-[11px] text-dark-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Working…
        </span>
      )}
      {error && <span className="text-[11px] text-red-400 ml-2">{error}</span>}
    </div>
  );
}

function BulkSelect({
  label,
  options,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-1 px-2 py-1 bg-dark-800/60 border border-dark-700 rounded-md text-xs text-dark-300">
      <span className="text-[10px] uppercase tracking-wider text-dark-500">{label}</span>
      <select
        defaultValue=""
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          // Reset right after triggering so the select stays usable as a "menu".
          e.target.value = '';
          onChange(v);
        }}
        className="bg-transparent text-xs text-dark-100 focus:outline-none disabled:opacity-50"
      >
        <option value="" disabled>
          Choose…
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
