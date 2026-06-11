import type { TaskLabel } from '../../types/tasks';
import { X } from 'lucide-react';

interface LabelPillProps {
  label: TaskLabel | { labelId: string; name?: string; color?: string };
  size?: 'xs' | 'sm';
  onRemove?: () => void;
  /** Show the raw id when the label has been deleted upstream. */
  orphan?: boolean;
}

/**
 * A single label pill, colored from `label.color`. Auto-picks readable text
 * color (light text on dark backgrounds, dark text on bright). Optional
 * inline X button when `onRemove` is supplied (used inside the picker).
 */
export function LabelPill({ label, size = 'sm', onRemove, orphan }: LabelPillProps) {
  const color = (label as TaskLabel).color || '#64748b';
  const name = (label as TaskLabel).name || label.labelId;

  // Pick text color based on luminance of the background.
  const text = readableText(color);

  const baseSize =
    size === 'xs'
      ? 'text-[10px] px-1.5 py-0 h-[18px]'
      : 'text-[11px] px-2 py-0.5 h-[20px]';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium leading-none ${baseSize} ${
        orphan ? 'opacity-50 line-through' : ''
      }`}
      style={{
        backgroundColor: hexAlpha(color, 0.18),
        color: text === 'light' ? lighten(color) : '#0f172a',
        border: `1px solid ${hexAlpha(color, 0.45)}`,
      }}
      title={orphan ? `${name} (deleted)` : name}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="truncate max-w-[160px]">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-60 hover:opacity-100"
          aria-label={`Remove ${name}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Color helpers (lightweight, no extra deps)
// -----------------------------------------------------------------------------

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function readableText(hex: string): 'light' | 'dark' {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 'light';
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  // Perceived luminance (Rec. 709)
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l < 0.5 ? 'light' : 'dark';
}

/** Mix the color halfway with white for a pill text against a dark UI. */
function lighten(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = Math.round((parseInt(h.substring(0, 2), 16) + 255) / 2);
  const g = Math.round((parseInt(h.substring(2, 4), 16) + 255) / 2);
  const b = Math.round((parseInt(h.substring(4, 6), 16) + 255) / 2);
  return `rgb(${r}, ${g}, ${b})`;
}
