/**
 * Shared visual utilities for task components: status / priority / source styling.
 * Keeping these here means TaskCard, TaskList, TaskDetail, TaskPanelV2 all
 * render badges identically without duplication.
 */
import type { TaskPriority, TaskSource, TaskStatus } from '../../types/tasks';

export const STATUS_COLUMN_ORDER: TaskStatus[] = [
  'backlog',
  'generated',
  'in_progress',
  'done',
  'not_applicable',
];

export const STATUS_DISPLAY: Record<TaskStatus, { label: string; dot: string; chip: string }> = {
  backlog: {
    label: 'Backlog',
    dot: 'bg-dark-500',
    chip: 'bg-dark-700 text-dark-300 border-dark-600',
  },
  generated: {
    label: 'Generated',
    dot: 'bg-violet-500',
    chip: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  },
  in_progress: {
    label: 'In progress',
    dot: 'bg-blue-500',
    chip: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  },
  done: {
    label: 'Done',
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  },
  not_applicable: {
    label: 'Not Applicable',
    dot: 'bg-dark-600',
    chip: 'bg-dark-800 text-dark-500 border-dark-700',
  },
};

export const PRIORITY_DISPLAY: Record<TaskPriority, { label: string; chip: string }> = {
  critical: {
    label: 'Critical',
    chip: 'bg-red-500/15 text-red-300 border-red-500/40',
  },
  high: {
    label: 'High',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  },
  medium: {
    label: 'Medium',
    chip: 'bg-dark-700 text-dark-300 border-dark-600',
  },
  low: {
    label: 'Low',
    chip: 'bg-dark-800 text-dark-500 border-dark-700',
  },
};

export const SOURCE_DISPLAY: Record<TaskSource, { label: string; chip: string }> = {
  manual: {
    label: 'Manual',
    chip: 'bg-dark-700 text-dark-300 border-dark-600',
  },
  meeting_recap: {
    label: 'Auto · Meeting',
    chip: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  },
  email: {
    label: 'Auto · Email',
    chip: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  },
  imported: {
    label: 'GitHub Imported',
    chip: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  },
};

/** YYYY-MM-DD → "Mon, May 21" or returns empty string if null/invalid. */
export function formatTargetDate(d: string | null): string {
  if (!d) return '';
  // Handle "YYYY-MM-DD" without timezone shift
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  const [y, m, day] = parts.map((p) => parseInt(p, 10));
  if (!y || !m || !day) return d;
  const date = new Date(y, m - 1, day);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: y !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

/** Returns 'overdue' | 'today' | 'soon' | 'normal' | null based on a YYYY-MM-DD target date. */
export function targetDateUrgency(d: string | null): 'overdue' | 'today' | 'soon' | 'normal' | null {
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  if (Number.isNaN(target.valueOf())) return null;
  target.setHours(0, 0, 0, 0);
  const diff = (target.getTime() - today.getTime()) / 86400000;
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 3) return 'soon';
  return 'normal';
}

export const URGENCY_TEXT: Record<NonNullable<ReturnType<typeof targetDateUrgency>>, string> = {
  overdue: 'text-red-400',
  today: 'text-amber-300',
  soon: 'text-amber-200',
  normal: 'text-dark-400',
};

/** Compact relative-time formatter for `createdAt`/`updatedAt` ISO strings. */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;
  if (diffSec < 86400 * 60) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Always-explicit absolute date for tooltips / list columns. */
export function formatAbsoluteDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
