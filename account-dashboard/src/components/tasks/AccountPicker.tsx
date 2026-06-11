/**
 * AccountPicker — searchable combobox over the active accounts list.
 *
 * Renders a button that opens a popover listing all active accounts. Includes
 * a "No account" option for tasks that aren't tied to an account.
 *
 * Used inside TaskFormModal and (later) for inline reassignment from TaskDetail.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Search, X } from 'lucide-react';
import { useAccounts } from '../../hooks/useAccounts';

interface AccountPickerProps {
  value: string | null;
  onChange: (accountId: string | null, accountName: string | null) => void;
  /** Optional placeholder when no account selected. */
  placeholder?: string;
  /** Compact variant for inline use (no border, smaller text). */
  inline?: boolean;
}

export function AccountPicker({
  value,
  onChange,
  placeholder = '— No account —',
  inline = false,
}: AccountPickerProps) {
  const { accounts, loading } = useAccounts();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Active-only and alphabetically sorted for predictable picking
  const activeAccounts = useMemo(
    () =>
      accounts
        .filter((a) => a.isActive !== false)
        .slice()
        .sort((a, b) => a.accountName.localeCompare(b.accountName)),
    [accounts]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return activeAccounts;
    return activeAccounts.filter((a) =>
      a.accountName.toLowerCase().includes(term)
    );
  }, [activeAccounts, search]);

  const selected = useMemo(
    () => accounts.find((a) => a.accountId === value) || null,
    [accounts, value]
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
    else setSearch('');
  }, [open]);

  const buttonClasses = inline
    ? 'w-full text-left px-2 py-1 text-xs rounded hover:bg-dark-800/60 text-dark-200 flex items-center gap-1.5'
    : 'w-full text-left px-3 py-2 bg-dark-800 border border-dark-700 rounded-md text-sm text-dark-100 hover:border-dark-600 focus:outline-none focus:border-accent flex items-center gap-2';

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={buttonClasses}
      >
        <Building2 className={inline ? 'w-3 h-3 text-dark-500' : 'w-4 h-4 text-dark-500'} />
        <span className={`flex-1 truncate ${!selected ? 'text-dark-500' : ''}`}>
          {selected ? selected.accountName : placeholder}
        </span>
        <ChevronDown className={inline ? 'w-3 h-3 text-dark-500' : 'w-3.5 h-3.5 text-dark-500'} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 right-0 bg-dark-800 border border-dark-700 rounded-md shadow-xl overflow-hidden">
          <div className="p-2 border-b border-dark-700">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-500" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search accounts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 text-xs bg-dark-900 border border-dark-700 rounded text-dark-200 placeholder:text-dark-500 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {/* No-account option */}
            <PickerRow
              icon={<X className="w-3.5 h-3.5 text-dark-500" />}
              label="— No account —"
              active={value === null}
              onClick={() => {
                onChange(null, null);
                setOpen(false);
              }}
            />
            <div className="my-1 border-t border-dark-700/60" />

            {loading ? (
              <div className="px-3 py-2 text-xs text-dark-500">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-dark-500 italic">No matches.</div>
            ) : (
              filtered.map((a) => (
                <PickerRow
                  key={a.accountId}
                  label={a.accountName}
                  active={value === a.accountId}
                  onClick={() => {
                    onChange(a.accountId, a.accountName);
                    setOpen(false);
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PickerRow({
  icon,
  label,
  active,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 ${
        active
          ? 'bg-accent/15 text-accent'
          : 'text-dark-200 hover:bg-dark-700/60 hover:text-dark-100'
      }`}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {active && <Check className="w-3.5 h-3.5 shrink-0" />}
    </button>
  );
}
