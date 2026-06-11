import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  X,
  ExternalLink,
  Calendar,
  GitFork,
  MessageSquare,
  History,
  Loader2,
  ArrowUpRight,
  Pencil,
  Check,
  Trash2,
  Send,
  Plus,
  Tag,
} from 'lucide-react';
import {
  useTask,
  useTaskComments,
  useTaskActivity,
  useTasks,
} from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { useTaskLabels } from '../../hooks/useTaskLabels';
import {
  updateTask,
  setTaskStatus,
  deleteTask,
  addComment,
} from '../../hooks/taskMutations';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from '../../types/tasks';
import type { TaskPriority, TaskStatus } from '../../types/tasks';
import {
  PRIORITY_DISPLAY,
  SOURCE_DISPLAY,
  STATUS_DISPLAY,
  formatTargetDate,
  targetDateUrgency,
  URGENCY_TEXT,
} from './taskUtils';
import { AccountPicker } from './AccountPicker';
import { TaskFormModal } from './TaskFormModal';
import { LabelPill } from './LabelPill';
import { LabelPicker } from './LabelPicker';

interface TaskDetailProps {
  taskId: string | null;
  onClose: () => void;
}

/**
 * Task detail drawer. Phase 3: editable.
 *
 * Inline edits (status / priority / target date / account) write through the
 * mutation helpers; description + title go through the full TaskFormModal so
 * we get the same validation & layout as creation. Comments and sub-task
 * creation also live here.
 */
export function TaskDetail({ taskId, onClose }: TaskDetailProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUser = user?.email || '';
  const { task, loading } = useTask(taskId || undefined);
  const { comments } = useTaskComments(taskId || undefined);
  const { activity } = useTaskActivity(taskId || undefined);
  const { tasks: children } = useTasks(
    taskId ? { parentTaskId: taskId } : { parentTaskId: '__none__' }
  );

  const { labelsById } = useTaskLabels();

  // Edit modes
  const [subTaskOpen, setSubTaskOpen] = useState(false);
  const [accountEditing, setAccountEditing] = useState(false);
  const [dateEditing, setDateEditing] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Inline title editing
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Inline description editing
  const [descEditing, setDescEditing] = useState(false);
  const [descDraft, setDescDraft] = useState('');

  // Inline label editing
  const [labelEditing, setLabelEditing] = useState(false);
  const [labelSaving, setLabelSaving] = useState(false);

  const startTitleEdit = () => {
    if (!task) return;
    setTitleDraft(task.title);
    setTitleEditing(true);
    // focus is set via useEffect below
  };

  useEffect(() => {
    if (titleEditing) titleInputRef.current?.focus();
  }, [titleEditing]);

  const saveTitleEdit = async () => {
    if (!task) return;
    const v = titleDraft.trim();
    setTitleEditing(false);
    if (!v || v === task.title) return;
    setActionError(null);
    try {
      await updateTask(task.taskId, { title: v }, task, currentUser);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Title update failed');
    }
  };

  const startDescEdit = () => {
    if (!task) return;
    setDescDraft(task.description || '');
    setDescEditing(true);
  };

  const saveDescEdit = async () => {
    if (!task) return;
    setDescEditing(false);
    if (descDraft === (task.description || '')) return;
    setActionError(null);
    try {
      await updateTask(task.taskId, { description: descDraft }, task, currentUser);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Description update failed');
    }
  };

  const saveLabels = async (nextIds: string[]) => {
    if (!task) return;
    setLabelSaving(true);
    setActionError(null);
    try {
      await updateTask(task.taskId, { labelIds: nextIds }, task, currentUser);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Label update failed');
    } finally {
      setLabelSaving(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    if (!taskId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [taskId, onClose]);

  if (!taskId) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl h-full bg-dark-900 border-l border-dark-700/50 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-dark-900/95 backdrop-blur border-b border-dark-700/50 px-5 py-3 flex items-center justify-between">
          <div className="text-xs text-dark-500 truncate">
            {task ? `Task · ${task.taskId.substring(0, 8)}` : 'Task'}
          </div>
          <div className="flex items-center gap-1">
            {task && (
              <button
                onClick={async () => {
                  if (!task) return;
                  if (!confirm(`Delete task "${task.title}"? This cannot be undone.`)) return;
                  setDeleting(true);
                  setActionError(null);
                  try {
                    await deleteTask(task.taskId);
                    onClose();
                  } catch (err) {
                    setActionError(err instanceof Error ? err.message : 'Delete failed');
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="text-dark-500 hover:text-red-400 p-1 rounded hover:bg-dark-800 disabled:opacity-50"
                title="Delete task"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-dark-500 hover:text-dark-200 p-1 rounded hover:bg-dark-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading || !task ? (
          <div className="p-12 text-center text-dark-500">
            <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />
            Loading...
          </div>
        ) : (
          <div className="p-5 space-y-6">
            {/* Title + meta */}
            <div>
              {/* Inline-editable title */}
              {titleEditing ? (
                <div className="flex items-center gap-1.5 mb-3">
                  <input
                    ref={titleInputRef}
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveTitleEdit();
                      if (e.key === 'Escape') setTitleEditing(false);
                    }}
                    className="flex-1 text-xl font-bold bg-dark-800 border border-accent/50 rounded px-2 py-1 text-dark-100 focus:outline-none"
                  />
                  <button
                    onClick={saveTitleEdit}
                    className="p-1.5 rounded bg-accent/10 hover:bg-accent/20 text-accent"
                    title="Save (Enter)"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setTitleEditing(false)}
                    className="p-1.5 rounded hover:bg-dark-800 text-dark-500"
                    title="Cancel (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="group flex items-start gap-1.5 mb-3">
                  <h2 className="text-xl font-bold text-dark-100 leading-snug flex-1">{task.title}</h2>
                  <button
                    onClick={startTitleEdit}
                    className="opacity-0 group-hover:opacity-100 mt-1 p-1 rounded hover:bg-dark-800 text-dark-500 hover:text-dark-300 transition-opacity"
                    title="Edit title"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Status: inline editable select rendered as a pill */}
                <PillSelect
                  value={task.status}
                  options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))}
                  className={STATUS_DISPLAY[task.status].chip}
                  onChange={async (next) => {
                    setActionError(null);
                    try {
                      await setTaskStatus(task.taskId, next as TaskStatus, task, currentUser);
                    } catch (err) {
                      setActionError(err instanceof Error ? err.message : 'Status update failed');
                    }
                  }}
                />

                {/* Priority: inline editable select rendered as a pill */}
                <PillSelect
                  value={task.priority || ''}
                  options={[
                    { value: '', label: '— No priority —' },
                    ...TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] })),
                  ]}
                  className={
                    task.priority
                      ? PRIORITY_DISPLAY[task.priority].chip
                      : 'border-dark-700/50 text-dark-500 bg-dark-800/30'
                  }
                  displayLabel={task.priority ? PRIORITY_DISPLAY[task.priority].label : 'Priority'}
                  onChange={async (next) => {
                    setActionError(null);
                    try {
                      await updateTask(
                        task.taskId,
                        { priority: (next as TaskPriority) || null },
                        task,
                        currentUser
                      );
                    } catch (err) {
                      setActionError(err instanceof Error ? err.message : 'Priority update failed');
                    }
                  }}
                />

                <Pill className={SOURCE_DISPLAY[task.source].chip}>{SOURCE_DISPLAY[task.source].label}</Pill>

                {/* Label pills — inline in header row, click to edit */}
                {(task.labelIds || []).map((id) => {
                  const lbl = labelsById.get(id);
                  return lbl ? (
                    <button
                      key={id}
                      onClick={() => setLabelEditing((v) => !v)}
                      title="Click to edit labels"
                    >
                      <LabelPill label={lbl} size="xs" />
                    </button>
                  ) : null;
                })}
                <button
                  onClick={() => setLabelEditing((v) => !v)}
                  className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                    labelEditing
                      ? 'border-accent/50 text-accent bg-accent/10'
                      : 'border-dark-700/50 text-dark-600 hover:text-dark-400 hover:border-dark-600'
                  }`}
                  title="Edit labels"
                >
                  <Tag className="w-2.5 h-2.5" />
                  {(task.labelIds || []).length === 0 ? 'Add label' : (labelEditing ? 'Done' : 'Labels')}
                </button>

                {/* Target date: click to edit */}
                {dateEditing ? (
                  <input
                    type="date"
                    autoFocus
                    defaultValue={task.targetDate || ''}
                    onBlur={async (e) => {
                      setDateEditing(false);
                      const next = e.target.value || null;
                      if (next === task.targetDate) return;
                      setActionError(null);
                      try {
                        await updateTask(task.taskId, { targetDate: next }, task, currentUser);
                      } catch (err) {
                        setActionError(err instanceof Error ? err.message : 'Date update failed');
                      }
                    }}
                    className="text-xs px-1.5 py-0.5 bg-dark-800 border border-accent rounded text-dark-100"
                  />
                ) : (
                  (() => {
                    const urgency = task.targetDate ? targetDateUrgency(task.targetDate) : null;
                    return (
                      <button
                        onClick={() => setDateEditing(true)}
                        className={`flex items-center gap-1 hover:underline ${
                          urgency ? URGENCY_TEXT[urgency] : 'text-dark-400'
                        }`}
                        title="Click to change target date"
                      >
                        <Calendar className="w-3 h-3" />
                        {task.targetDate ? `Due ${formatTargetDate(task.targetDate)}` : 'No due date'}
                      </button>
                    );
                  })()
                )}
              </div>
              {actionError && (
                <div className="mt-2 text-xs text-red-400">{actionError}</div>
              )}
            </div>

            {/* Label picker — drops down below header when open */}
            {labelEditing && (
              <div className="rounded-lg border border-accent/30 bg-dark-800/60 px-3 py-3">
                <LabelPicker
                  value={task.labelIds || []}
                  onChange={saveLabels}
                />
                {labelSaving && (
                  <div className="flex items-center gap-1.5 mt-2 text-[10px] text-dark-500">
                    <Loader2 className="w-3 h-3 animate-spin" /> Saving…
                  </div>
                )}
              </div>
            )}

            {/* Account: click to change, or follow link to account page */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-dark-500">Account:</span>
              {accountEditing ? (
                <div className="flex-1 max-w-sm">
                  <AccountPicker
                    value={task.accountId}
                    inline
                    onChange={async (nextId, nextName) => {
                      setAccountEditing(false);
                      if (nextId === task.accountId) return;
                      setActionError(null);
                      try {
                        await updateTask(
                          task.taskId,
                          { accountId: nextId, accountName: nextName },
                          task,
                          currentUser
                        );
                      } catch (err) {
                        setActionError(err instanceof Error ? err.message : 'Account update failed');
                      }
                    }}
                  />
                </div>
              ) : task.accountId && task.accountName ? (
                <>
                  <button
                    onClick={() => {
                      onClose();
                      navigate(`/account/${task.accountId}`);
                    }}
                    className="flex items-center gap-1 text-accent hover:text-accent-hover"
                  >
                    {task.accountName}
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setAccountEditing(true)}
                    className="text-[10px] uppercase tracking-wider text-dark-500 hover:text-dark-300"
                  >
                    Change
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setAccountEditing(true)}
                  className="text-dark-400 hover:text-dark-200 italic"
                >
                  None — click to assign
                </button>
              )}
            </div>

            {/* Provenance: where did this task come from? */}
            {task.source === 'imported' && task.sourceRef.githubLegacyNumber && (
              <div className="text-xs text-dark-500">
                Imported from{' '}
                <a
                  href={`https://github.com/johndavis92790/OP-Tasklist/issues/${task.sourceRef.githubLegacyNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline inline-flex items-center gap-0.5"
                >
                  GitHub #{task.sourceRef.githubLegacyNumber}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Meeting context — rendered from structured sourceRef data when available.
                 Falls back to the raw markdown block in the description for tasks that
                 haven't been backfilled yet (sourceRef.meetingTitle is absent). */}
            {task.source === 'meeting_recap' && !!task.sourceRef.meetingTitle && (
              <div className="rounded-lg border border-dark-700/50 bg-dark-800/40 px-4 py-3 text-xs space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-dark-500 font-semibold mb-2">Meeting Context</div>
                {task.sourceRef.meetingTitle && (
                  <div><span className="text-dark-500">Meeting:</span> <span className="text-dark-300">{task.sourceRef.meetingTitle}</span></div>
                )}
                {task.sourceRef.meetingDate && (
                  <div><span className="text-dark-500">Date:</span> <span className="text-dark-300">{formatMeetingDate(task.sourceRef.meetingDate)}</span></div>
                )}
                {task.accountName && (
                  <div><span className="text-dark-500">Account:</span> <span className="text-dark-300">{task.accountName}</span></div>
                )}
                {task.sourceRef.meetingLink && (
                  <div>
                    <span className="text-dark-500">Recap:</span>{' '}
                    {isUrl(task.sourceRef.meetingLink) ? (
                      <a
                        href={task.sourceRef.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline inline-flex items-center gap-0.5"
                      >
                        View Recap <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-dark-300">{task.sourceRef.meetingLink}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Description — inline editable */}
            <Section
              title={
                <span className="flex items-center justify-between">
                  <span>Description</span>
                  {!descEditing && (
                    <button
                      onClick={startDescEdit}
                      className="flex items-center gap-1 text-[10px] text-dark-500 hover:text-dark-300 normal-case font-normal"
                      title="Edit description"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  )}
                </span>
              }
            >
              {descEditing ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setDescEditing(false);
                    }}
                    rows={8}
                    placeholder="Description (Markdown supported)"
                    className="w-full bg-dark-800 border border-accent/40 rounded-lg px-3 py-2 text-sm text-dark-100 placeholder:text-dark-500 focus:outline-none focus:border-accent/70 resize-y"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveDescEdit}
                      className="flex items-center gap-1 px-3 py-1 text-xs bg-accent text-white rounded hover:bg-accent-hover"
                    >
                      <Check className="w-3 h-3" /> Save
                    </button>
                    <button
                      onClick={() => setDescEditing(false)}
                      className="px-3 py-1 text-xs text-dark-400 hover:text-dark-200 rounded hover:bg-dark-800"
                    >
                      Cancel
                    </button>
                    <span className="text-[10px] text-dark-500 ml-auto">Markdown supported · Esc to cancel</span>
                  </div>
                </div>
              ) : task.description ? (
                <div
                  className="prose-task cursor-text group relative"
                  onDoubleClick={startDescEdit}
                  title="Double-click to edit"
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {task.source === 'meeting_recap' && task.sourceRef.meetingTitle
                      ? stripMeetingContextBlock(task.description)
                      : task.description}
                  </ReactMarkdown>
                </div>
              ) : (
                <button
                  onClick={startDescEdit}
                  className="text-dark-500 text-sm italic hover:text-dark-300 hover:underline text-left"
                >
                  No description — click to add
                </button>
              )}
            </Section>

            {/* Sub-tasks */}
            <Section
              title={
                <span className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <GitFork className="w-4 h-4" />
                    Sub-tasks ({children.length})
                  </span>
                  <button
                    onClick={() => setSubTaskOpen(true)}
                    className="flex items-center gap-1 text-[10px] text-accent hover:text-accent-hover normal-case font-medium"
                  >
                    <Plus className="w-3 h-3" />
                    Add sub-task
                  </button>
                </span>
              }
            >
              {children.length === 0 ? (
                <p className="text-dark-500 text-sm italic">No sub-tasks yet.</p>
              ) : (
                <ul className="space-y-1">
                  {children.map((c) => (
                    <li key={c.taskId} className="flex items-center gap-2 text-sm">
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DISPLAY[c.status].dot}`} />
                      <span className="text-dark-200 truncate">{c.title}</span>
                      <span className="text-[10px] text-dark-500">{STATUS_DISPLAY[c.status].label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Comments */}
            <Section
              title={
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4" />
                  Comments ({comments.length})
                </span>
              }
            >
              {comments.length === 0 ? (
                <p className="text-dark-500 text-sm italic mb-3">No comments yet.</p>
              ) : (
                <ul className="space-y-3 mb-3">
                  {comments.map((c) => (
                    <li key={c.commentId} className="border border-dark-700/40 rounded-lg p-3 bg-dark-800/40">
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-xs font-semibold text-dark-200">{c.authorId}</span>
                        <span className="text-[10px] text-dark-500">
                          {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
                          {c.editedAt && ' · edited'}
                        </span>
                      </div>
                      <div className="prose-task text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.body}</ReactMarkdown>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {/* Comment composer */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!commentBody.trim() || !task) return;
                  setSubmittingComment(true);
                  setActionError(null);
                  try {
                    await addComment(task.taskId, commentBody, currentUser);
                    setCommentBody('');
                  } catch (err) {
                    setActionError(err instanceof Error ? err.message : 'Comment failed');
                  } finally {
                    setSubmittingComment(false);
                  }
                }}
                className="border border-dark-700/40 rounded-lg p-2 bg-dark-800/40 focus-within:border-accent/60"
              >
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Add a comment... (Markdown supported)"
                  rows={2}
                  className="w-full bg-transparent text-sm text-dark-100 placeholder:text-dark-500 focus:outline-none resize-y"
                />
                <div className="flex items-center justify-end gap-2 mt-1">
                  <span className="text-[10px] text-dark-500 mr-auto">
                    {currentUser ? `as ${currentUser}` : ''}
                  </span>
                  <button
                    type="submit"
                    disabled={submittingComment || !commentBody.trim()}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-accent text-white rounded hover:bg-accent-hover disabled:opacity-50"
                  >
                    {submittingComment ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    Comment
                  </button>
                </div>
              </form>
            </Section>

            {/* Activity */}
            <Section
              title={
                <span className="flex items-center gap-1.5">
                  <History className="w-4 h-4" />
                  Activity ({activity.length})
                </span>
              }
            >
              {activity.length === 0 ? (
                <p className="text-dark-500 text-sm italic">No activity recorded.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {activity.map((a) => (
                    <li key={a.activityId} className="flex items-start gap-2 text-dark-400">
                      <span className="text-dark-500 shrink-0 w-32">
                        {a.timestamp ? new Date(a.timestamp).toLocaleString() : '—'}
                      </span>
                      <span>
                        <span className="text-dark-200 font-medium">{a.actorId}</span>{' '}
                        {formatActivity(a.type, a.detail)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Footer audit */}
            <div className="pt-4 mt-4 border-t border-dark-700/40 text-xs text-dark-500 grid grid-cols-2 gap-2">
              <div>Created: {task.createdAt ? new Date(task.createdAt).toLocaleString() : '—'}</div>
              <div>Updated: {task.updatedAt ? new Date(task.updatedAt).toLocaleString() : '—'}</div>
              {task.closedAt && (
                <div>Closed: {new Date(task.closedAt).toLocaleString()}</div>
              )}
              {task.createdBy && <div>By: {task.createdBy}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Sub-task creation modal */}
      {task && subTaskOpen && (
        <TaskFormModal
          mode="create"
          open={subTaskOpen}
          onClose={() => setSubTaskOpen(false)}
          parentTaskId={task.taskId}
          lockedAccountId={task.accountId}
          lockedAccountName={task.accountName}
        />
      )}
    </div>
  );
}

/**
 * Pill rendered as a `<select>` so the user can change status / priority
 * without leaving the drawer. The `<select>` is invisible and stretched over
 * the pill so the native dropdown opens on click.
 */
function PillSelect({
  value,
  options,
  className,
  displayLabel,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  className: string;
  displayLabel?: string;
  onChange: (next: string) => void;
}) {
  const currentOption = options.find((o) => o.value === value);
  const visibleLabel = displayLabel ?? currentOption?.label ?? value;
  return (
    <span className={`relative inline-block`}>
      <Pill className={`${className} cursor-pointer pr-4`}>{visibleLabel}</Pill>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        title="Change"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-dark-500 font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${className}`}>
      {children}
    </span>
  );
}

function formatActivity(
  type: string,
  detail: { field?: string; from?: unknown; to?: unknown; note?: string; added?: unknown[]; removed?: unknown[] } | undefined
): React.ReactNode {
  const from = detail?.from != null ? String(detail.from) : null;
  const to = detail?.to != null ? String(detail.to) : null;

  switch (type) {
    case 'created': return 'created the task';
    case 'closed': return 'closed the task';
    case 'reopened': return 'reopened the task';
    case 'comment_added': return 'added a comment';
    case 'imported_from_github': return `imported from GitHub${detail?.note ? ` — ${detail.note}` : ''}`;
    case 'status_changed':
      return (
        <span>changed status{from && to ? <> from <code className="text-dark-300 bg-dark-800 px-1 rounded">{from}</code> → <code className="text-dark-300 bg-dark-800 px-1 rounded">{to}</code></> : ''}</span>
      );
    case 'priority_changed':
      return (
        <span>changed priority{from !== null && to !== null ? <> from <span className="text-dark-300 font-medium">{from || 'none'}</span> → <span className="text-dark-300 font-medium">{to || 'none'}</span></> : ''}</span>
      );
    case 'account_changed':
      return (
        <span>changed account{from && to ? <> from <span className="text-dark-300">{from}</span> → <span className="text-dark-300">{to}</span></> : ''}</span>
      );
    case 'parent_changed': return 'changed parent task';
    case 'assignee_added': return `assigned ${String(detail?.to ?? '')}`;
    case 'assignee_removed': return `unassigned ${String(detail?.from ?? '')}`;
    case 'title_changed':
      return (
        <span>changed title{from ? <> from <span className="text-dark-300 italic">"{from}"</span> → <span className="text-dark-300 italic">"{to ?? ''}"</span></> : ''}</span>
      );
    case 'description_changed': return 'updated description';
    case 'labels_changed': {
      const added = Array.isArray(detail?.added) ? (detail!.added as string[]) : [];
      const removed = Array.isArray(detail?.removed) ? (detail!.removed as string[]) : [];
      const parts: string[] = [];
      if (added.length) parts.push(`+${added.length} added`);
      if (removed.length) parts.push(`−${removed.length} removed`);
      return `updated labels${parts.length ? ` (${parts.join(', ')})` : ''}`;
    }
    case 'target_date_changed':
      return (
        <span>changed due date{from !== null && to !== null ? <> from <span className="text-dark-300">{from || 'none'}</span> → <span className="text-dark-300">{to || 'none'}</span></> : ''}</span>
      );
    default:
      return type;
  }
}

/**
 * Strip the trailing "## Meeting Context" block that Apps Script embeds in
 * meeting-recap task descriptions. The block starts with a `---` separator
 * immediately before the heading and runs to the end of the string.
 * We show that data as structured HTML above the description, so we don't
 * want to render the raw markdown as well.
 */
function stripMeetingContextBlock(desc: string): string {
  // Match the separator + heading that the Apps Script writes:
  //   \n\n---\n\n## Meeting Context
  const idx = desc.search(/\n\n---\n\n##\s*Meeting Context/);
  return idx === -1 ? desc : desc.slice(0, idx).trimEnd();
}

function isUrl(s: string): boolean {
  try { return /^https?:\/\//i.test(s); } catch { return false; }
}

function formatMeetingDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return raw; }
}
