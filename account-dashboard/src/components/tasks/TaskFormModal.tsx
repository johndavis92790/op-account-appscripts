/**
 * TaskFormModal — reusable create / edit dialog.
 *
 * - mode='create': all fields empty; can optionally be locked to a specific account
 *   (when invoked from a TaskPanelV2) or parent task (sub-task creation).
 * - mode='edit': pre-fills from `initialTask`, only writes the diff.
 *
 * Markdown is supported in description but rendered live only in TaskDetail —
 * here we just use a tall textarea with a hint.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useAccounts } from '../../hooks/useAccounts';
import { useAuth } from '../../hooks/useAuth';
import { createTask, updateTask } from '../../hooks/taskMutations';
import type { CreateTaskInput, UpdateTaskPatch } from '../../hooks/taskMutations';
import type { Task, TaskPriority, TaskStatus } from '../../types/tasks';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from '../../types/tasks';
import { AccountPicker } from './AccountPicker';

interface CommonProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (taskId: string) => void;
}

interface CreateModeProps extends CommonProps {
  mode: 'create';
  /** If set, account picker is locked to this account. */
  lockedAccountId?: string | null;
  lockedAccountName?: string | null;
  /** If set, the new task will be a sub-task of this parent. */
  parentTaskId?: string | null;
}

interface EditModeProps extends CommonProps {
  mode: 'edit';
  initialTask: Task;
}

export type TaskFormModalProps = CreateModeProps | EditModeProps;

export function TaskFormModal(props: TaskFormModalProps) {
  const { open, onClose, onSaved, mode } = props;
  const { user } = useAuth();
  const { accounts } = useAccounts();
  const initial = mode === 'edit' ? props.initialTask : null;

  // Locked-account helpers (create mode only)
  const lockedAccountId = mode === 'create' ? props.lockedAccountId : undefined;
  const lockedAccountName = mode === 'create' ? props.lockedAccountName : undefined;
  const parentTaskId = mode === 'create' ? props.parentTaskId : undefined;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('backlog');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [accountId, setAccountId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement | null>(null);

  // Reset form whenever the modal opens with new props
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setTitle(initial.title);
      setDescription(initial.description || '');
      setStatus(initial.status);
      setPriority(initial.priority || '');
      setTargetDate(initial.targetDate || '');
      setAccountId(initial.accountId ?? null);
    } else {
      setTitle('');
      setDescription('');
      setStatus('backlog');
      setPriority('');
      setTargetDate('');
      setAccountId(lockedAccountId !== undefined ? lockedAccountId : null);
    }
    setError(null);
    // Focus title after the open transition
    setTimeout(() => titleRef.current?.focus(), 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, initial?.taskId]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  const resolvedAccountName = useMemo(() => {
    if (lockedAccountName !== undefined) return lockedAccountName;
    if (!accountId) return null;
    return accounts.find((a) => a.accountId === accountId)?.accountName ?? null;
  }, [accountId, accounts, lockedAccountName]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const currentUser = user?.email || '';
      if (mode === 'create') {
        const input: CreateTaskInput = {
          title,
          description,
          status,
          priority: priority || null,
          targetDate: targetDate || null,
          accountId,
          accountName: resolvedAccountName,
          parentTaskId: parentTaskId ?? null,
        };
        const newId = await createTask(input, currentUser);
        onSaved?.(newId);
      } else {
        const patch: UpdateTaskPatch = {
          title,
          description,
          status,
          priority: priority || null,
          targetDate: targetDate || null,
          accountId,
          accountName: resolvedAccountName,
        };
        await updateTask(initial!.taskId, patch, initial!, currentUser);
        onSaved?.(initial!.taskId);
      }
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save task';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        aria-label="Close"
        onClick={() => !saving && onClose()}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-2xl bg-dark-900 border border-dark-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-dark-700 flex items-center justify-between">
          <h2 className="text-base font-semibold text-dark-100">
            {mode === 'create'
              ? parentTaskId
                ? 'New sub-task'
                : 'New task'
              : 'Edit task'}
          </h2>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="text-dark-500 hover:text-dark-200 p-1 rounded hover:bg-dark-800"
            disabled={saving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <Field label="Title" required>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-md text-sm text-dark-100 placeholder:text-dark-500 focus:outline-none focus:border-accent"
              required
              maxLength={200}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Markdown supported. Add context, links, acceptance criteria..."
              rows={6}
              className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-md text-sm text-dark-100 placeholder:text-dark-500 focus:outline-none focus:border-accent font-mono leading-relaxed"
            />
            <p className="text-[10px] text-dark-500 mt-1">Markdown supported.</p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-md text-sm text-dark-100 focus:outline-none focus:border-accent"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority | '')}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-md text-sm text-dark-100 focus:outline-none focus:border-accent"
              >
                <option value="">— None —</option>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Target date">
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-md text-sm text-dark-100 focus:outline-none focus:border-accent"
              />
            </Field>

            <Field label="Account">
              {lockedAccountId !== undefined ? (
                <div className="px-3 py-2 bg-dark-800/60 border border-dark-700/60 rounded-md text-sm text-dark-300">
                  {lockedAccountName || '— No account —'}
                  <span className="ml-2 text-[10px] text-dark-500 uppercase tracking-wider">locked</span>
                </div>
              ) : (
                <AccountPicker
                  value={accountId}
                  onChange={setAccountId}
                />
              )}
            </Field>
          </div>

          {parentTaskId && (
            <div className="text-xs text-dark-500 bg-dark-800/40 border border-dark-700/40 rounded px-3 py-2">
              Sub-task of <code className="text-dark-300">{parentTaskId.substring(0, 8)}</code>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-dark-700 flex items-center justify-end gap-2 bg-dark-900/80">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 text-sm text-dark-300 hover:text-dark-100 rounded-md disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-accent text-white rounded-md hover:bg-accent-hover disabled:opacity-50 flex items-center gap-1.5 font-medium"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {mode === 'create' ? 'Create task' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-dark-500 font-semibold mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
