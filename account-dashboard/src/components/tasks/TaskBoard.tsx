import { useMemo, useState } from 'react';
import type { Task, TaskStatus } from '../../types/tasks';
import { TaskCard } from './TaskCard';
import { STATUS_COLUMN_ORDER, STATUS_DISPLAY } from './taskUtils';
import { useTaskLabels } from '../../hooks/useTaskLabels';

export type BoardSortKey = 'priority' | 'created' | 'updated' | 'targetDate' | 'title';

interface TaskBoardProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  /** Called when a card is dropped onto a new column. Parent persists the change. */
  onMoveTask?: (taskId: string, newStatus: TaskStatus) => void;
  showAccount?: boolean;
  /** Restrict which columns to show. Defaults to all five. */
  visibleStatuses?: TaskStatus[];
  /** Per-column sort key. Defaults to 'priority'. */
  sortKey?: BoardSortKey;
  sortAsc?: boolean;
  /** Multi-select integration. */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (taskId: string, shiftKey: boolean) => void;
}

const DRAG_MIME = 'application/x-task-id';

export function TaskBoard({
  tasks,
  onTaskClick,
  onMoveTask,
  showAccount = true,
  visibleStatuses = STATUS_COLUMN_ORDER,
  sortKey = 'priority',
  sortAsc = true,
  selectable,
  selectedIds,
  onToggleSelect,
}: TaskBoardProps) {
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const { labelsById } = useTaskLabels();

  // Group tasks by status, then sort each column.
  const grouped = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const status of visibleStatuses) map.set(status, []);
    for (const t of tasks) {
      const list = map.get(t.status);
      if (list) list.push(t);
    }
    const PRIORITY_ORDER: Record<string, number> = {
      critical: 0, high: 1, medium: 2, low: 3,
    };
    const cmp = (a: Task, b: Task): number => {
      let c = 0;
      switch (sortKey) {
        case 'priority': {
          const pa = a.priority ? PRIORITY_ORDER[a.priority] : 99;
          const pb = b.priority ? PRIORITY_ORDER[b.priority] : 99;
          c = pa - pb;
          if (c === 0) {
            // Stable tiebreak: most recently updated first.
            c = (b.updatedAt || '').localeCompare(a.updatedAt || '');
          }
          return c;
        }
        case 'created':
          c = (a.createdAt || '').localeCompare(b.createdAt || '');
          break;
        case 'updated':
          c = (a.updatedAt || '').localeCompare(b.updatedAt || '');
          break;
        case 'targetDate':
          c = (a.targetDate || '9999-12-31').localeCompare(b.targetDate || '9999-12-31');
          break;
        case 'title':
          c = a.title.localeCompare(b.title);
          break;
      }
      return sortAsc ? c : -c;
    };
    for (const list of map.values()) list.sort(cmp);
    return map;
  }, [tasks, visibleStatuses, sortKey, sortAsc]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {visibleStatuses.map((status) => {
        const list = grouped.get(status) || [];
        const display = STATUS_DISPLAY[status];
        const isDragOver = dragOverStatus === status;
        return (
          <div
            key={status}
            onDragOver={(e) => {
              if (!onMoveTask) return;
              // Only accept drags carrying our task MIME (set by TaskCard).
              if (e.dataTransfer.types.includes(DRAG_MIME)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverStatus !== status) setDragOverStatus(status);
              }
            }}
            onDragLeave={(e) => {
              // Only clear if leaving the column entirely (not entering a child).
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverStatus((s) => (s === status ? null : s));
              }
            }}
            onDrop={(e) => {
              if (!onMoveTask) return;
              e.preventDefault();
              const taskId = e.dataTransfer.getData(DRAG_MIME);
              setDragOverStatus(null);
              if (taskId) onMoveTask(taskId, status);
            }}
            className={`shrink-0 w-72 bg-dark-900/40 border rounded-xl flex flex-col max-h-[calc(100vh-220px)] transition-colors ${
              isDragOver
                ? 'border-accent/70 bg-accent/5'
                : 'border-dark-700/40'
            }`}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-dark-700/40 sticky top-0 bg-dark-900/90 backdrop-blur rounded-t-xl">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${display.dot}`} />
                <span className="text-sm font-semibold text-dark-100">{display.label}</span>
                <span className="text-xs text-dark-500">{list.length}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {list.length === 0 ? (
                <div className="text-center py-8 text-xs text-dark-600">
                  {isDragOver ? 'Drop to move here' : 'No tasks'}
                </div>
              ) : (
                list.map((t) => (
                  <TaskCard
                    key={t.taskId}
                    task={t}
                    showAccount={showAccount}
                    onClick={onTaskClick}
                    draggable={!!onMoveTask && !selectable}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_MIME, t.taskId);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    labelsById={labelsById}
                    selectable={selectable}
                    selected={selectedIds?.has(t.taskId)}
                    onToggleSelect={onToggleSelect}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
