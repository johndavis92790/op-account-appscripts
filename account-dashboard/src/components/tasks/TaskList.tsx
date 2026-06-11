import { useMemo, useState } from 'react';
import type { Task, TaskPriority, TaskStatus } from '../../types/tasks';
import {
  PRIORITY_DISPLAY,
  SOURCE_DISPLAY,
  STATUS_DISPLAY,
  formatTargetDate,
  formatAbsoluteDate,
  targetDateUrgency,
  URGENCY_TEXT,
} from './taskUtils';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { LabelPill } from './LabelPill';
import { useTaskLabels } from '../../hooks/useTaskLabels';

interface TaskListProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  showAccount?: boolean;
  /** Multi-select: when set, a checkbox column appears and each row stops opening the drawer on click. */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (taskId: string, shiftKey: boolean) => void;
  onSelectAll?: (next: boolean) => void;
}

type SortKey =
  | 'title'
  | 'status'
  | 'priority'
  | 'account'
  | 'targetDate'
  | 'updated'
  | 'created';

const PRIORITY_RANK: Record<TaskPriority, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};
const STATUS_RANK: Record<TaskStatus, number> = {
  generated: 0, in_progress: 1, backlog: 2, done: 3, not_applicable: 4,
};

export function TaskList({
  tasks,
  onTaskClick,
  showAccount = true,
  selectable,
  selectedIds,
  onToggleSelect,
  onSelectAll,
}: TaskListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortAsc, setSortAsc] = useState(false);
  const { labelsById } = useTaskLabels();

  const sorted = useMemo(() => {
    const arr = [...tasks];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'status':
          cmp = STATUS_RANK[a.status] - STATUS_RANK[b.status];
          break;
        case 'priority': {
          const ra = a.priority ? PRIORITY_RANK[a.priority] : 99;
          const rb = b.priority ? PRIORITY_RANK[b.priority] : 99;
          cmp = ra - rb;
          break;
        }
        case 'account':
          cmp = (a.accountName || '').localeCompare(b.accountName || '');
          break;
        case 'targetDate':
          cmp = (a.targetDate || '9999-12-31').localeCompare(b.targetDate || '9999-12-31');
          break;
        case 'updated':
          cmp = (a.updatedAt || '').localeCompare(b.updatedAt || '');
          break;
        case 'created':
          cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [tasks, sortKey, sortAsc]);

  const onSortClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      // Sensible defaults: title/account asc, everything else desc.
      setSortAsc(key === 'title' || key === 'account');
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-dark-500 text-sm">No tasks match the current filter.</div>
    );
  }

  return (
    <div className="overflow-x-auto border border-dark-700/40 rounded-xl">
      <table className="w-full text-sm">
        <thead className="bg-dark-900/60 text-dark-400 text-xs uppercase tracking-wider">
          <tr>
            {selectable && (
              <th className="px-2 py-2 w-8">
                <input
                  type="checkbox"
                  checked={tasks.length > 0 && selectedIds?.size === tasks.length}
                  onChange={(e) => onSelectAll?.(e.target.checked)}
                  aria-label="Select all visible tasks"
                  className="w-3.5 h-3.5 rounded border-dark-600 bg-dark-800 text-accent focus:ring-1 focus:ring-accent/40"
                />
              </th>
            )}
            <SortHeader label="Title" active={sortKey === 'title'} asc={sortAsc} onClick={() => onSortClick('title')} />
            <SortHeader label="Status" active={sortKey === 'status'} asc={sortAsc} onClick={() => onSortClick('status')} />
            <SortHeader label="Priority" active={sortKey === 'priority'} asc={sortAsc} onClick={() => onSortClick('priority')} />
            <th className="px-3 py-2 text-left font-medium select-none">Labels</th>
            {showAccount && <SortHeader label="Account" active={sortKey === 'account'} asc={sortAsc} onClick={() => onSortClick('account')} />}
            <SortHeader label="Due" active={sortKey === 'targetDate'} asc={sortAsc} onClick={() => onSortClick('targetDate')} />
            <SortHeader label="Source" active={false} asc={false} onClick={() => undefined} />
            <SortHeader label="Created" active={sortKey === 'created'} asc={sortAsc} onClick={() => onSortClick('created')} />
            <SortHeader label="Updated" active={sortKey === 'updated'} asc={sortAsc} onClick={() => onSortClick('updated')} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => {
            const urgency = targetDateUrgency(task.targetDate);
            const status = STATUS_DISPLAY[task.status];
            const priority = task.priority ? PRIORITY_DISPLAY[task.priority] : null;
            const source = SOURCE_DISPLAY[task.source];
            const isSelected = !!selectedIds?.has(task.taskId);
            return (
              <tr
                key={task.taskId}
                onClick={(e) => {
                  if (selectable && onToggleSelect && !(e.metaKey || e.ctrlKey)) {
                    onToggleSelect(task.taskId, e.shiftKey);
                    return;
                  }
                  onTaskClick(task.taskId);
                }}
                className={`border-t border-dark-700/40 hover:bg-dark-800/60 cursor-pointer ${
                  isSelected ? 'bg-accent/5' : ''
                }`}
              >
                {selectable && (
                  <td className="px-2 py-2.5 w-8" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => undefined}
                      onClick={(e) => onToggleSelect?.(task.taskId, e.shiftKey)}
                      className="w-3.5 h-3.5 rounded border-dark-600 bg-dark-800 text-accent focus:ring-1 focus:ring-accent/40"
                    />
                  </td>
                )}
                <td className="px-3 py-2.5 text-dark-100 max-w-[400px] truncate">{task.title}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded border ${status.chip}`}>{status.label}</span>
                </td>
                <td className="px-3 py-2.5">
                  {priority ? (
                    <span className={`text-[11px] px-1.5 py-0.5 rounded border ${priority.chip}`}>{priority.label}</span>
                  ) : (
                    <span className="text-dark-600 text-xs">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {task.labelIds && task.labelIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {task.labelIds.slice(0, 3).map((id) => {
                        const l = labelsById.get(id);
                        return (
                          <LabelPill
                            key={id}
                            size="xs"
                            label={l || { labelId: id }}
                            orphan={!l}
                          />
                        );
                      })}
                      {task.labelIds.length > 3 && (
                        <span className="text-[10px] text-dark-500">
                          +{task.labelIds.length - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-dark-600 text-xs">—</span>
                  )}
                </td>
                {showAccount && (
                  <td className="px-3 py-2.5 text-dark-300 text-xs">
                    {task.accountName || <span className="text-dark-600">—</span>}
                  </td>
                )}
                <td className={`px-3 py-2.5 text-xs ${urgency ? URGENCY_TEXT[urgency] : 'text-dark-500'}`}>
                  {task.targetDate ? formatTargetDate(task.targetDate) : '—'}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded border ${source.chip}`}>{source.label}</span>
                </td>
                <td
                  className="px-3 py-2.5 text-xs text-dark-500 whitespace-nowrap"
                  title={task.createdAt ? new Date(task.createdAt).toLocaleString() : ''}
                >
                  {formatAbsoluteDate(task.createdAt)}
                </td>
                <td className="px-3 py-2.5 text-xs text-dark-500">
                  {task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  label,
  active,
  asc,
  onClick,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className="px-3 py-2 text-left font-medium select-none cursor-pointer hover:text-dark-200"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (asc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </span>
    </th>
  );
}
