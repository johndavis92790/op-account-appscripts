import { useMemo, useState } from 'react';
import { useAccounts } from '../../hooks/useAccounts';
import type { Task } from '../../types/tasks';
import { Search, FolderOpen, Inbox, X } from 'lucide-react';

interface AccountFilterSidebarProps {
  /** Currently active account filter. `undefined` = "All", `null` = "No account", string = accountId. */
  selectedAccountId: string | null | undefined;
  onSelectAccount: (accountId: string | null | undefined) => void;
  /** Tasks currently visible in the parent — used for per-account counts. */
  tasks: Task[];
}

/**
 * Left sidebar listing real accounts (from the accounts collection) with a
 * count of tasks per account. Replaces the GitHub `account:Name` label sidebar.
 *
 * "All" and "No account" are pseudo-entries.
 */
export function AccountFilterSidebar({
  selectedAccountId,
  onSelectAccount,
  tasks,
}: AccountFilterSidebarProps) {
  const { accounts, loading } = useAccounts();
  const [search, setSearch] = useState('');

  // Per-account counts derived from the unfiltered task list
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    let unassigned = 0;
    for (const t of tasks) {
      if (t.accountId) {
        m.set(t.accountId, (m.get(t.accountId) || 0) + 1);
      } else {
        unassigned += 1;
      }
    }
    return { byAccount: m, unassigned, total: tasks.length };
  }, [tasks]);

  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLowerCase();
    // Active accounts only, sorted alphabetically by name (case-insensitive).
    // The legacy renewal-date sort lived in `useAccounts` and made finding a
    // specific account in the tasks sidebar slow.
    const list = accounts
      .filter((a) => a.isActive !== false)
      .slice()
      .sort((a, b) =>
        (a.accountName || '').toLowerCase().localeCompare((b.accountName || '').toLowerCase())
      );
    if (!term) return list;
    return list.filter((a) => a.accountName.toLowerCase().includes(term));
  }, [accounts, search]);

  return (
    <aside className="w-60 shrink-0 border-r border-dark-700/40 bg-dark-900/40 flex flex-col h-full">
      <div className="p-3 border-b border-dark-700/40">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            type="text"
            placeholder="Filter accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-dark-800 border border-dark-700 rounded-md text-dark-200 placeholder:text-dark-500 focus:outline-none focus:border-accent"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-y-auto flex-1 p-1">
        {/* Pseudo entries */}
        <SidebarItem
          icon={<Inbox className="w-3.5 h-3.5" />}
          label="All tasks"
          count={counts.total}
          active={selectedAccountId === undefined}
          onClick={() => onSelectAccount(undefined)}
        />
        <SidebarItem
          icon={<FolderOpen className="w-3.5 h-3.5" />}
          label="No account"
          count={counts.unassigned}
          active={selectedAccountId === null}
          onClick={() => onSelectAccount(null)}
        />

        <div className="my-2 border-t border-dark-700/40" />

        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-dark-500 font-semibold">
          Accounts {!loading && `(${filteredAccounts.length})`}
        </div>

        {loading ? (
          <div className="px-2 py-2 text-xs text-dark-500">Loading...</div>
        ) : (
          filteredAccounts.map((a) => (
            <SidebarItem
              key={a.accountId}
              label={a.accountName}
              count={counts.byAccount.get(a.accountId) || 0}
              active={selectedAccountId === a.accountId}
              onClick={() => onSelectAccount(a.accountId)}
              dim={(counts.byAccount.get(a.accountId) || 0) === 0}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function SidebarItem({
  icon,
  label,
  count,
  active,
  onClick,
  dim,
}: {
  icon?: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  dim?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors ${
        active
          ? 'bg-accent/15 text-accent'
          : dim
          ? 'text-dark-500 hover:bg-dark-800/60 hover:text-dark-300'
          : 'text-dark-300 hover:bg-dark-800/60 hover:text-dark-100'
      }`}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      <span className={`shrink-0 text-[10px] ${active ? 'text-accent' : 'text-dark-500'}`}>{count}</span>
    </button>
  );
}
