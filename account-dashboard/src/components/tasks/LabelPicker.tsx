/**
 * LabelPicker — GitHub-style multi-select label picker with inline create.
 *
 * Behaviors:
 * - Shows current selection as colored pills with X to remove.
 * - Click "Add label" → dropdown listing every label, searchable.
 * - If the search term has no exact match, surface a "Create '<term>'" row
 *   that opens a tiny color-swatch picker and creates the label, then
 *   immediately selects it.
 * - Entirely controlled: parent owns `value` (string[] of labelIds).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Check, Loader2, Tag } from 'lucide-react';
import { useTaskLabels } from '../../hooks/useTaskLabels';
import { createTaskLabel } from '../../hooks/labelMutations';
import { useAuth } from '../../hooks/useAuth';
import { TASK_LABEL_COLORS } from '../../types/tasks';
import { LabelPill } from './LabelPill';

interface LabelPickerProps {
  /** Selected label ids. */
  value: string[];
  /** Called with the new array on every change. */
  onChange: (next: string[]) => void;
  /** Optional placeholder when nothing is selected. */
  placeholder?: string;
  /** Compact mode hides the leading "Labels" icon. */
  compact?: boolean;
}

export function LabelPicker({
  value,
  onChange,
  placeholder = 'Add label',
  compact,
}: LabelPickerProps) {
  const { labels, labelsById, loading } = useTaskLabels();
  const { user } = useAuth();
  const currentUser = user?.email || '';

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pickerColor, setPickerColor] = useState<string>(TASK_LABEL_COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
        setShowColorPicker(false);
        setCreateError(null);
      }
    };
    window.addEventListener('mousedown', onDoc);
    return () => window.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return labels;
    return labels.filter((l) => l.name.toLowerCase().includes(term));
  }, [labels, search]);

  const exactMatch = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return false;
    return labels.some((l) => l.name.toLowerCase() === term);
  }, [labels, search]);

  const toggle = (labelId: string) => {
    if (value.includes(labelId)) {
      onChange(value.filter((id) => id !== labelId));
    } else {
      onChange([...value, labelId]);
    }
  };

  const handleCreate = async () => {
    const name = search.trim();
    if (!name) return;
    setCreating(true);
    setCreateError(null);
    try {
      const newId = await createTaskLabel(
        { name, color: pickerColor },
        currentUser
      );
      onChange([...value, newId]);
      setSearch('');
      setShowColorPicker(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create label');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative inline-flex flex-wrap items-center gap-1">
      {!compact && value.length === 0 && (
        <span className="inline-flex items-center gap-1 text-dark-500 text-xs">
          <Tag className="w-3.5 h-3.5" />
        </span>
      )}

      {/* Selected pills */}
      {value.map((id) => {
        const label = labelsById.get(id);
        return (
          <LabelPill
            key={id}
            label={label || { labelId: id }}
            orphan={!label}
            onRemove={() => toggle(id)}
          />
        );
      })}

      {/* Add button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-dashed border-dark-600 text-dark-400 hover:text-dark-100 hover:border-dark-500"
      >
        <Plus className="w-3 h-3" />
        {placeholder}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 z-50 bg-dark-900 border border-dark-700 rounded-lg shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-dark-700">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-dark-500" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search or create…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !exactMatch && search.trim() && !showColorPicker) {
                    e.preventDefault();
                    setShowColorPicker(true);
                  }
                  if (e.key === 'Escape') {
                    setOpen(false);
                  }
                }}
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-dark-800 border border-dark-700 rounded text-dark-100 placeholder:text-dark-500 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-4 text-center text-xs text-dark-500">Loading…</div>
            ) : filtered.length === 0 && !search.trim() ? (
              <div className="px-3 py-4 text-center text-xs text-dark-500">
                No labels yet. Type a name to create one.
              </div>
            ) : (
              filtered.map((l) => {
                const selected = value.includes(l.labelId);
                return (
                  <button
                    key={l.labelId}
                    type="button"
                    onClick={() => toggle(l.labelId)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-dark-800/80"
                  >
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ backgroundColor: l.color }}
                    />
                    <span className="text-xs text-dark-100 flex-1 truncate">{l.name}</span>
                    {selected && <Check className="w-3.5 h-3.5 text-accent" />}
                  </button>
                );
              })
            )}

            {/* Create new row */}
            {search.trim() && !exactMatch && (
              <div className="border-t border-dark-700/60">
                {!showColorPicker ? (
                  <button
                    type="button"
                    onClick={() => setShowColorPicker(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-dark-800/80 text-xs text-accent"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create label{' '}
                    <span className="font-semibold text-dark-100">"{search.trim()}"</span>
                  </button>
                ) : (
                  <div className="px-3 py-2 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-dark-300">
                      <span
                        className="inline-block w-3 h-3 rounded-sm"
                        style={{ backgroundColor: pickerColor }}
                      />
                      <span className="font-semibold text-dark-100 truncate">
                        {search.trim()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {TASK_LABEL_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setPickerColor(c)}
                          className={`w-5 h-5 rounded-sm border ${
                            pickerColor === c
                              ? 'border-dark-100 scale-110'
                              : 'border-transparent'
                          } transition-transform`}
                          style={{ backgroundColor: c }}
                          aria-label={`Color ${c}`}
                        />
                      ))}
                    </div>
                    {createError && (
                      <div className="text-[10px] text-red-400">{createError}</div>
                    )}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowColorPicker(false);
                          setCreateError(null);
                        }}
                        className="px-2 py-1 text-[11px] text-dark-400 hover:text-dark-200"
                        disabled={creating}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreate}
                        disabled={creating}
                        className="px-2 py-1 text-[11px] bg-accent text-white rounded hover:bg-accent-hover disabled:opacity-50 flex items-center gap-1"
                      >
                        {creating && <Loader2 className="w-3 h-3 animate-spin" />}
                        Create
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
