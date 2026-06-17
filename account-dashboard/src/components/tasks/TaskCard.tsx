import type { Task, TaskLabel } from '../../types/tasks';
import { Calendar, MessageSquare, GitFork, Clock } from 'lucide-react';
import {
  PRIORITY_DISPLAY,
  SOURCE_DISPLAY,
  formatTargetDate,
  formatRelativeTime,
  formatAbsoluteDate,
  targetDateUrgency,
  URGENCY_TEXT,
} from './taskUtils';
import { LabelPill } from './LabelPill';

interface TaskCardProps {
  task: Task;
  /** Show the account name pill (default true). Set false on the per-account view to reduce clutter. */
  showAccount?: boolean;
  onClick?: (taskId: string) => void;
  /** Optional preview of comment count + sub-task count from parent. */
  commentCount?: number;
  childCount?: number;
  /** Drag-and-drop support — wired up by TaskBoard. */
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  /** Lookup so we can render full label pills (name + color). */
  labelsById?: Map<string, TaskLabel>;
  /** Multi-select state. When `selectable` is true, a checkbox is shown. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (taskId: string, shiftKey: boolean) => void;
  /** Callback for quick status changes (shown when not selectable and showAccount is false i.e. on account page) */
  onStatusChange?: (taskId: string, newStatus: string) => void;
  /** Show status dropdown for quick changes (typically on account page) */
  showStatusDropdown?: boolean;
  /** Hide the status badge (use on kanban where the column header already shows status) */
  hideStatus?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  backlog: 'bg-dark-400/30 text-dark-200 border-dark-400/50',
  generated: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  done: 'bg-green-500/20 text-green-400 border-green-500/30',
  not_applicable: 'bg-dark-400/30 text-dark-300 border-dark-400/50',
};

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  generated: 'Generated',
  open: 'Open',
  in_progress: 'In Progress',
  done: 'Done',
  not_applicable: 'N/A',
};

export function TaskCard({
  task,
  showAccount = true,
  onClick,
  commentCount,
  childCount,
  draggable,
  onDragStart,
  labelsById,
  selectable,
  selected,
  onToggleSelect,
  onStatusChange,
  showStatusDropdown = false,
  hideStatus = false,
}: TaskCardProps) {
  const urgency = targetDateUrgency(task.targetDate);
  const priority = task.priority ? PRIORITY_DISPLAY[task.priority] : null;
  const source = SOURCE_DISPLAY[task.source];
  const status = task.status;
  const statusStyle = status ? STATUS_STYLES[status] || STATUS_STYLES.backlog : STATUS_STYLES.backlog;
  const statusLabel = status ? STATUS_LABELS[status] || status : 'Unknown';

  return (
    <div
      onClick={(e) => {
        // If we are in select mode, clicks toggle selection unless modifier-clicked.
        if (selectable && onToggleSelect && !(e.metaKey || e.ctrlKey)) {
          onToggleSelect(task.taskId, e.shiftKey);
          return;
        }
        onClick?.(task.taskId);
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(task.taskId);
        }
      }}
      className={`w-full text-left bg-dark-800/80 hover:bg-dark-800 border rounded-lg p-3 transition-colors group ${
        selected
          ? 'border-accent ring-1 ring-accent/40'
          : 'border-dark-700/50 hover:border-dark-600'
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
    >
      {/* Title row — checkbox + full-width title only */}
      <div className="flex items-start gap-2 mb-2">
        {selectable && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => undefined /* handled on row click */}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(task.taskId, e.shiftKey);
            }}
            className="mt-0.5 shrink-0 w-3.5 h-3.5 rounded border-dark-600 bg-dark-800 text-accent focus:ring-1 focus:ring-accent/40"
            aria-label={`Select task ${task.title}`}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-dark-100 group-hover:text-accent leading-snug line-clamp-4">
            {task.title}
          </div>
        </div>
      </div>

      {/* Labels */}
      {task.labelIds && task.labelIds.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labelIds.map((id) => {
            const l = labelsById?.get(id);
            return <LabelPill key={id} size="xs" label={l || { labelId: id }} orphan={!l} />;
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        {/* Priority badge — moved from title row */}
        {priority && (
          <span
            className={`shrink-0 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${priority.chip}`}
            title={`Priority: ${priority.label}`}
          >
            {priority.label}
          </span>
        )}

        {/* Status badge — moved from title row */}
        {status && !showStatusDropdown && !hideStatus && (
          <span
            className={`shrink-0 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${statusStyle}`}
            title={`Status: ${statusLabel}`}
          >
            {statusLabel}
          </span>
        )}

        {/* Quick Status Change Dropdown (when on account page) */}
        {showStatusDropdown && onStatusChange && !selectable && (
          <select
            value={status || 'backlog'}
            onChange={(e) => {
              e.stopPropagation();
              onStatusChange(task.taskId, e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border bg-dark-800 text-dark-100 border-dark-600 hover:border-accent focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
            title="Click to change status"
          >
            <option value="backlog">Backlog</option>
            <option value="generated">Generated</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
            <option value="not_applicable">N/A</option>
          </select>
        )}

        {showAccount && task.accountName && (
          <span className="px-1.5 py-0.5 rounded bg-dark-700/80 text-dark-300 truncate max-w-[140px]">
            {task.accountName}
          </span>
        )}

        <span
          className={`px-1.5 py-0.5 rounded border ${source.chip}`}
          title={`Source: ${source.label}`}
        >
          {source.label}
        </span>

        {task.targetDate && urgency && (
          <span className={`flex items-center gap-1 ${URGENCY_TEXT[urgency]}`}>
            <Calendar className="w-3 h-3" />
            {formatTargetDate(task.targetDate)}
            {urgency === 'overdue' && <span className="font-semibold">overdue</span>}
            {urgency === 'today' && <span className="font-semibold">today</span>}
          </span>
        )}

        {commentCount !== undefined && commentCount > 0 && (
          <span className="flex items-center gap-1 text-dark-500">
            <MessageSquare className="w-3 h-3" />
            {commentCount}
          </span>
        )}

        {childCount !== undefined && childCount > 0 && (
          <span className="flex items-center gap-1 text-dark-500">
            <GitFork className="w-3 h-3" />
            {childCount}
          </span>
        )}

        {task.createdAt && (
          <span
            className="flex items-center gap-1 text-dark-500 ml-auto"
            title={`Created ${formatAbsoluteDate(task.createdAt)}`}
          >
            <Clock className="w-3 h-3" />
            {formatRelativeTime(task.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}
