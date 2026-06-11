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
}

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
}: TaskCardProps) {
  const urgency = targetDateUrgency(task.targetDate);
  const priority = task.priority ? PRIORITY_DISPLAY[task.priority] : null;
  const source = SOURCE_DISPLAY[task.source];

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
      <div className="flex items-start justify-between gap-2 mb-2">
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
          <div className="text-sm font-medium text-dark-100 group-hover:text-accent leading-snug line-clamp-2">
            {task.title}
          </div>
        </div>
        {priority && (
          <span
            className={`shrink-0 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${priority.chip}`}
            title={`Priority: ${priority.label}`}
          >
            {priority.label}
          </span>
        )}
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
