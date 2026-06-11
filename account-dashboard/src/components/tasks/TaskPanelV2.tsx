import { useMemo, useState } from 'react';
import { ListChecks, ChevronDown, ChevronRight, Sparkles, Plus } from 'lucide-react';
import { useTasks } from '../../hooks/useTasks';
import { TaskCard } from './TaskCard';
import { TaskDetail } from './TaskDetail';
import { TaskFormModal } from './TaskFormModal';
import { TASK_OPEN_STATUSES, TASK_STATUS_LABELS } from '../../types/tasks';
import type { TaskStatus } from '../../types/tasks';

interface TaskPanelV2Props {
  accountId: string;
  accountName: string;
  /** If provided, the panel will use these externally-managed values instead
   *  of its own internal state — so the parent can share one TaskDetail drawer
   *  with sibling panels (e.g. MeetingsPanel). */
  externalOpenTaskId?: string | null;
  onExternalTaskClick?: (taskId: string | null) => void;
}

/**
 * The new account-detail Tasks panel. Reads directly from the top-level
 * `tasks` collection filtered by accountId.
 *
 * Phase 2: read-only. Phase 3 adds create/edit affordances.
 */
export function TaskPanelV2({
  accountId,
  accountName,
  externalOpenTaskId,
  onExternalTaskClick,
}: TaskPanelV2Props) {
  const { tasks, loading, error } = useTasks({ accountId });
  const [internalOpenTaskId, setInternalOpenTaskId] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  const isExternal = onExternalTaskClick !== undefined;
  const openTaskId = isExternal ? (externalOpenTaskId ?? null) : internalOpenTaskId;
  const setOpenTaskId = isExternal ? onExternalTaskClick : setInternalOpenTaskId;

  const { openTasks, closedTasks, byStatus } = useMemo(() => {
    const open = tasks.filter((t) => TASK_OPEN_STATUSES.includes(t.status));
    const closed = tasks.filter((t) => !TASK_OPEN_STATUSES.includes(t.status));
    const byStatusMap = new Map<TaskStatus, typeof tasks>();
    for (const t of open) {
      const list = byStatusMap.get(t.status) || [];
      list.push(t);
      byStatusMap.set(t.status, list);
    }
    // Sort each bucket: priority asc then targetDate asc
    const PRI: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    for (const list of byStatusMap.values()) {
      list.sort((a, b) => {
        const pa = a.priority ? PRI[a.priority] : 99;
        const pb = b.priority ? PRI[b.priority] : 99;
        if (pa !== pb) return pa - pb;
        return (a.targetDate || '9999').localeCompare(b.targetDate || '9999');
      });
    }
    return { openTasks: open, closedTasks: closed, byStatus: byStatusMap };
  }, [tasks]);

  const orderedOpenStatuses: TaskStatus[] = ['generated', 'in_progress', 'backlog'];

  return (
    <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-dark-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-accent" />
          <span className="font-semibold text-dark-100 text-sm">Tasks</span>
          <span className="text-xs text-dark-500">
            {openTasks.length} open · {closedTasks.length} closed
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNewTaskOpen(true)}
            className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            New Task
          </button>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-violet-400/80 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/30">
            <Sparkles className="w-3 h-3" />
            New system
          </div>
        </div>
      </div>

      <div className="p-3 space-y-4">
        {error && (
          <div className="text-sm text-red-400">Error loading tasks: {error}</div>
        )}

        {loading && tasks.length === 0 ? (
          <div className="text-sm text-dark-500 text-center py-6">Loading...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-dark-400 mb-1">No tasks yet for {accountName}.</p>
            <p className="text-xs text-dark-500">
              Tasks will appear here automatically when generated from meeting recaps,
              or after the GitHub migration in Phase 4.
            </p>
          </div>
        ) : (
          <>
            {orderedOpenStatuses.map((status) => {
              const list = byStatus.get(status) || [];
              if (list.length === 0) return null;
              return (
                <div key={status}>
                  <div className="text-[11px] uppercase tracking-wider text-dark-500 font-semibold mb-1.5 px-1">
                    {TASK_STATUS_LABELS[status]} · {list.length}
                  </div>
                  <div className="space-y-1.5">
                    {list.map((t) => (
                      <TaskCard
                        key={t.taskId}
                        task={t}
                        showAccount={false}
                        onClick={setOpenTaskId}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Closed tasks (collapsed by default) */}
            {closedTasks.length > 0 && (
              <div>
                <button
                  onClick={() => setShowClosed((v) => !v)}
                  className="w-full text-left flex items-center gap-1 text-[11px] uppercase tracking-wider text-dark-500 hover:text-dark-300 font-semibold px-1 py-1"
                >
                  {showClosed ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  Closed · {closedTasks.length}
                </button>
                {showClosed && (
                  <div className="space-y-1.5 mt-1.5">
                    {closedTasks.map((t) => (
                      <TaskCard
                        key={t.taskId}
                        task={t}
                        showAccount={false}
                        onClick={setOpenTaskId}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Only render the detail drawer if we own state (not externally lifted). */}
      {!isExternal && (
        <TaskDetail taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
      )}

      {newTaskOpen && (
        <TaskFormModal
          mode="create"
          open={newTaskOpen}
          onClose={() => setNewTaskOpen(false)}
          lockedAccountId={accountId}
          lockedAccountName={accountName}
          onSaved={(id) => setOpenTaskId(id)}
        />
      )}
    </div>
  );
}
