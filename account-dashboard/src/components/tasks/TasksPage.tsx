import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutGrid,
  List,
  Filter as FilterIcon,
  ListChecks,
  Plus,
  CheckSquare,
  ArrowDownUp,
  Tag,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useTasks } from '../../hooks/useTasks';
import { useAccounts } from '../../hooks/useAccounts';
import { useAuth } from '../../hooks/useAuth';
import { setTaskStatus } from '../../hooks/taskMutations';
import type { TaskPriority, TaskStatus } from '../../types/tasks';
import { TASK_OPEN_STATUSES, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '../../types/tasks';
import { useTaskLabels } from '../../hooks/useTaskLabels';
import { AccountFilterSidebar } from './AccountFilterSidebar';
import { TaskBoard } from './TaskBoard';
import type { BoardSortKey } from './TaskBoard';
import { TaskList } from './TaskList';
import { TaskDetail } from './TaskDetail';
import { TaskFormModal } from './TaskFormModal';
import { BulkActionBar } from './BulkActionBar';

type ViewMode = 'kanban' | 'list';

const BOARD_SORT_LABELS: Record<BoardSortKey, string> = {
  priority: 'Priority',
  created: 'Created',
  updated: 'Updated',
  targetDate: 'Due date',
  title: 'Title',
};

/**
 * Top-level /tasks page. Read-only in Phase 2.
 *
 * Layout:
 *   [account sidebar] [main: header (filters + view toggle) | board/list ]
 *
 * Filters intentionally stay in component state (not URL params) for Phase 2.
 * Phase 7 saved-views feature will move these to a persisted shape.
 */
export function TasksPage() {
  // Filters
  const [accountFilter, setAccountFilter] = useState<string | null | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<'open' | 'all' | TaskStatus>('open');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [view, setView] = useState<ViewMode>('kanban');
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [sortKey, setSortKey] = useState<BoardSortKey>('priority');
  const [sortAsc, setSortAsc] = useState(true);

  // Label filter
  const [labelFilter, setLabelFilter] = useState<string>('all');

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // Move-toast: shown when tasks are moved to a status hidden by the current filter
  const [moveToast, setMoveToast] = useState<{ count: number; status: TaskStatus } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMoveToast = useCallback((count: number, status: TaskStatus) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setMoveToast({ count, status });
    toastTimerRef.current = setTimeout(() => setMoveToast(null), 5000);
  }, []);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const { accounts } = useAccounts();
  const { user } = useAuth();
  const { labels } = useTaskLabels();
  const currentUser = user?.email || '';

  // Pull a wide query (filtered by accountId only at the DB level) and refine
  // the rest client-side. This keeps composite-index requirements small while
  // still being efficient for our scale (low-thousands of tasks at most).
  const { tasks: rawTasks, loading, error } = useTasks({
    accountId: accountFilter,
  });

  const filtered = useMemo(() => {
    let arr = rawTasks;
    if (statusFilter === 'open') {
      arr = arr.filter((t) => TASK_OPEN_STATUSES.includes(t.status));
    } else if (statusFilter !== 'all') {
      arr = arr.filter((t) => t.status === statusFilter);
    }
    if (priorityFilter !== 'all') {
      arr = arr.filter((t) => t.priority === priorityFilter);
    }
    if (labelFilter === 'source:meeting_recap') {
      arr = arr.filter((t) => t.source === 'meeting_recap');
    } else if (labelFilter === 'source:imported') {
      arr = arr.filter((t) => t.source === 'imported');
    } else if (labelFilter !== 'all') {
      arr = arr.filter((t) => (t.labelIds || []).includes(labelFilter));
    }
    return arr;
  }, [rawTasks, statusFilter, priorityFilter, labelFilter]);

  const showAccountColumn = accountFilter === undefined;

  // When the user has selected a specific account in the sidebar, lock the
  // new-task modal to that account so single-click creation is fast.
  const lockedAccount = useMemo(() => {
    if (typeof accountFilter !== 'string') return null;
    const a = accounts.find((x) => x.accountId === accountFilter);
    return a ? { id: a.accountId, name: a.accountName } : null;
  }, [accountFilter, accounts]);

  // Drag-and-drop status change. The TaskBoard hands us the target column;
  // we resolve the previous task state from the in-memory list (avoids an
  // extra Firestore read).
  // Returns true if `status` would be hidden by the current statusFilter.
  const isStatusHidden = useCallback(
    (status: TaskStatus) => {
      if (statusFilter === 'all') return false;
      if (statusFilter === 'open') return !TASK_OPEN_STATUSES.includes(status);
      return statusFilter !== status;
    },
    [statusFilter]
  );

  const handleMoveTask = useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      const prev = rawTasks.find((t) => t.taskId === taskId);
      if (!prev) return;
      try {
        await setTaskStatus(taskId, newStatus, prev, currentUser);
        if (isStatusHidden(newStatus)) showMoveToast(1, newStatus);
      } catch (err) {
        console.error('Move task failed:', err);
      }
    },
    [rawTasks, currentUser, isStatusHidden, showMoveToast]
  );

  const handleMoveTasks = useCallback(
    async (taskIds: string[], newStatus: TaskStatus) => {
      await Promise.all(
        taskIds.map(async (taskId) => {
          const prev = rawTasks.find((t) => t.taskId === taskId);
          if (!prev) return;
          try {
            await setTaskStatus(taskId, newStatus, prev, currentUser);
          } catch (err) {
            console.error('Move task failed:', err);
          }
        })
      );
      if (isStatusHidden(newStatus)) showMoveToast(taskIds.length, newStatus);
    },
    [rawTasks, currentUser, isStatusHidden, showMoveToast]
  );

  // Multi-select toggle: shift-click extends the range from the last
  // selected card to the clicked one (within the current `filtered` order).
  const handleToggleSelect = useCallback(
    (taskId: string, shiftKey: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastSelectedId && lastSelectedId !== taskId) {
          const ids = filtered.map((t) => t.taskId);
          const a = ids.indexOf(lastSelectedId);
          const b = ids.indexOf(taskId);
          if (a !== -1 && b !== -1) {
            const [from, to] = a < b ? [a, b] : [b, a];
            for (let i = from; i <= to; i++) next.add(ids[i]);
          } else {
            next.has(taskId) ? next.delete(taskId) : next.add(taskId);
          }
        } else if (next.has(taskId)) {
          next.delete(taskId);
        } else {
          next.add(taskId);
        }
        return next;
      });
      setLastSelectedId(taskId);
    },
    [filtered, lastSelectedId]
  );

  const handleSelectAll = useCallback(
    (next: boolean) => {
      if (next) setSelectedIds(new Set(filtered.map((t) => t.taskId)));
      else setSelectedIds(new Set());
    },
    [filtered]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  // Auto-exit select mode when nothing is selected (after a bulk delete, etc.)
  // and clear stale ids if the underlying tasks list changes.
  useEffect(() => {
    if (selectedIds.size === 0) return;
    setSelectedIds((prev) => {
      const valid = new Set(rawTasks.map((t) => t.taskId));
      const next = new Set<string>();
      for (const id of prev) if (valid.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [rawTasks, selectedIds.size]);

  // Esc clears selection / exits select mode.
  useEffect(() => {
    if (!selectMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedIds.size > 0) clearSelection();
        else setSelectMode(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectMode, selectedIds.size, clearSelection]);

  const selectedTasks = useMemo(
    () => rawTasks.filter((t) => selectedIds.has(t.taskId)),
    [rawTasks, selectedIds]
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <AccountFilterSidebar
        selectedAccountId={accountFilter}
        onSelectAccount={setAccountFilter}
        tasks={rawTasks}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-dark-700/40 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-accent" />
            <h1 className="text-lg font-semibold text-dark-100">Tasks</h1>
            <span className="text-xs text-dark-500">{filtered.length} of {rawTasks.length}</span>
          </div>

          {/* Active account-filter chip with one-click clear */}
          {accountFilter !== undefined && (
            <button
              onClick={() => setAccountFilter(undefined)}
              className="flex items-center gap-1 px-2 py-1 bg-accent/10 border border-accent/40 text-accent text-xs rounded-md hover:bg-accent/20"
              title="Clear account filter"
            >
              {accountFilter === null
                ? 'No account'
                : lockedAccount?.name || 'Account'}
              <span className="text-base leading-none">×</span>
            </button>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              onClick={() => setNewTaskOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-md hover:bg-accent-hover"
            >
              <Plus className="w-3.5 h-3.5" />
              New Task
            </button>

            {/* Multi-select toggle */}
            <button
              onClick={() => {
                setSelectMode((m) => {
                  const next = !m;
                  if (!next) clearSelection();
                  return next;
                });
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border ${
                selectMode
                  ? 'bg-accent/15 text-accent border-accent/40'
                  : 'bg-dark-800 text-dark-300 border-dark-700 hover:text-dark-100'
              }`}
              title={selectMode ? 'Exit select mode (Esc)' : 'Select multiple'}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {selectMode ? 'Selecting' : 'Select'}
            </button>

            {/* Status filter */}
            <FilterPill icon={<FilterIcon className="w-3 h-3" />}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="bg-transparent text-xs text-dark-200 focus:outline-none"
              >
                <option value="open">Open (Backlog · Generated · In progress)</option>
                <option value="all">All statuses</option>
                <option value="backlog">{TASK_STATUS_LABELS.backlog}</option>
                <option value="generated">{TASK_STATUS_LABELS.generated}</option>
                <option value="in_progress">{TASK_STATUS_LABELS.in_progress}</option>
                <option value="done">{TASK_STATUS_LABELS.done}</option>
                <option value="not_applicable">{TASK_STATUS_LABELS.not_applicable}</option>
              </select>
            </FilterPill>

            {/* Priority filter */}
            <FilterPill>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
                className="bg-transparent text-xs text-dark-200 focus:outline-none"
              >
                <option value="all">Any priority</option>
                <option value="critical">{TASK_PRIORITY_LABELS.critical}</option>
                <option value="high">{TASK_PRIORITY_LABELS.high}</option>
                <option value="medium">{TASK_PRIORITY_LABELS.medium}</option>
                <option value="low">{TASK_PRIORITY_LABELS.low}</option>
              </select>
            </FilterPill>

            {/* Label filter */}
            <FilterPill icon={<Tag className="w-3 h-3" />}>
              <select
                value={labelFilter}
                onChange={(e) => setLabelFilter(e.target.value)}
                className="bg-transparent text-xs text-dark-200 focus:outline-none max-w-[130px]"
              >
                <option value="all">Any label</option>
                <optgroup label="Source">
                  <option value="source:meeting_recap">Auto · Meeting</option>
                  <option value="source:imported">GitHub Imported</option>
                </optgroup>
                {labels.length > 0 && (
                  <optgroup label="Labels">
                    {labels.map((l) => (
                      <option key={l.labelId} value={l.labelId}>{l.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </FilterPill>

            {/* Sort (board view only) */}
            {view === 'kanban' && (
              <FilterPill icon={<ArrowDownUp className="w-3 h-3" />}>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as BoardSortKey)}
                  className="bg-transparent text-xs text-dark-200 focus:outline-none"
                >
                  {(Object.keys(BOARD_SORT_LABELS) as BoardSortKey[]).map((k) => (
                    <option key={k} value={k}>
                      {BOARD_SORT_LABELS[k]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setSortAsc((a) => !a)}
                  className="text-dark-400 hover:text-dark-200 text-xs px-1"
                  title={sortAsc ? 'Ascending (click for descending)' : 'Descending (click for ascending)'}
                >
                  {sortAsc ? '↑' : '↓'}
                </button>
              </FilterPill>
            )}

            {/* View toggle */}
            <div className="flex items-center bg-dark-800 border border-dark-700 rounded-md overflow-hidden">
              <button
                onClick={() => setView('kanban')}
                className={`px-2 py-1.5 text-xs flex items-center gap-1 ${
                  view === 'kanban' ? 'bg-accent/15 text-accent' : 'text-dark-400 hover:text-dark-200'
                }`}
                title="Kanban view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Board
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-2 py-1.5 text-xs flex items-center gap-1 border-l border-dark-700 ${
                  view === 'list' ? 'bg-accent/15 text-accent' : 'text-dark-400 hover:text-dark-200'
                }`}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
            </div>
          </div>
        </div>

        {/* Move toast — appears when tasks are filtered out after a drag */}
        {moveToast && (
          <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-xs text-green-300">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">
              {moveToast.count === 1 ? '1 task' : `${moveToast.count} tasks`} moved to{' '}
              <span className="font-semibold">{TASK_STATUS_LABELS[moveToast.status]}</span>
              {' '}— hidden by current filter.
            </span>
            <button
              onClick={() => { setStatusFilter('all'); setMoveToast(null); }}
              className="underline hover:no-underline font-medium"
            >
              Show all
            </button>
            <button onClick={() => setMoveToast(null)} className="ml-1 text-green-500 hover:text-green-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto p-4">
          {error && (
            <div className="text-sm text-red-400 mb-3">Error loading tasks: {error}</div>
          )}
          {loading && rawTasks.length === 0 ? (
            <div className="text-center py-16 text-dark-500 text-sm">Loading tasks...</div>
          ) : rawTasks.length === 0 ? (
            <EmptyState />
          ) : view === 'kanban' ? (
            <>
              <TaskBoard
                tasks={filtered}
                showAccount={showAccountColumn}
                onTaskClick={setOpenTaskId}
                onMoveTask={selectMode ? undefined : handleMoveTask}
                onMoveTasks={selectMode ? handleMoveTasks : undefined}
                sortKey={sortKey}
                sortAsc={sortAsc}
                selectable={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
              />
              {selectMode && (
                <BulkActionBar
                  selected={selectedTasks}
                  onClear={clearSelection}
                />
              )}
            </>
          ) : (
            <>
              <TaskList
                tasks={filtered}
                showAccount={showAccountColumn}
                onTaskClick={setOpenTaskId}
                selectable={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
              />
              {selectMode && (
                <BulkActionBar
                  selected={selectedTasks}
                  onClear={clearSelection}
                />
              )}
            </>
          )}
        </div>
      </div>

      <TaskDetail taskId={openTaskId} onClose={() => setOpenTaskId(null)} />

      {newTaskOpen && (
        <TaskFormModal
          mode="create"
          open={newTaskOpen}
          onClose={() => setNewTaskOpen(false)}
          lockedAccountId={lockedAccount ? lockedAccount.id : undefined}
          lockedAccountName={lockedAccount ? lockedAccount.name : undefined}
          onSaved={(id) => setOpenTaskId(id)}
        />
      )}
    </div>
  );
}

function FilterPill({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 bg-dark-800 border border-dark-700 rounded-md px-2 py-1">
      {icon && <span className="text-dark-500">{icon}</span>}
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <ListChecks className="w-12 h-12 mx-auto mb-3 text-dark-600" />
      <h3 className="text-base font-semibold text-dark-200 mb-1">No tasks yet</h3>
      <p className="text-sm text-dark-500 max-w-md mx-auto">
        The new task system is in place but hasn't been populated yet. Tasks will appear here
        once meeting recaps generate them or after the GitHub migration runs in Phase 4.
      </p>
    </div>
  );
}
