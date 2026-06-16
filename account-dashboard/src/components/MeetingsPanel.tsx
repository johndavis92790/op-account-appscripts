import { useState, useMemo } from 'react';
import type { Meeting, MeetingRecap } from '../types';
import {
  ChevronDown,
  ChevronUp,
  CalendarClock,
  CalendarCheck,
  ExternalLink,
  Users,
  ListTodo,
  FileText,
  UserCheck,
  UserX,
  SquareArrowUpRight,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTasks } from '../hooks/useTasks';

interface MeetingsPanelProps {
  meetings: Meeting[];
  recaps: MeetingRecap[];
  initialView?: 'past' | 'upcoming';
  /** When provided the panel fetches Firestore tasks for the account and
   *  renders action items as clickable links that open TaskDetail. */
  accountId?: string;
  onTaskClick?: (taskId: string | null) => void;
}

interface PastMeetingEntry {
  key: string;
  meeting: Meeting | null;
  recap: MeetingRecap | null;
  title: string;
  date: string;
}

export function MeetingsPanel({
  meetings,
  recaps: recapsProp,
  initialView,
  accountId,
  onTaskClick,
}: MeetingsPanelProps) {
  // Defensive: normalize recaps to always be an array (handles null, undefined, or bad data)
  const recaps = Array.isArray(recapsProp) ? recapsProp : [];

  // Fetch tasks for this account so we can match action item titles to taskIds.
  // When accountId is not provided (e.g. upcoming-only panel), we still call
  // useTasks but with a parentTaskId sentinel that will never match anything,
  // so the subscription is cheap and accountTasks stays empty.
  const { tasks: accountTasks } = useTasks(
    accountId && onTaskClick
      ? { accountId }
      : { parentTaskId: '__no_match__' }
  );

  // Build a normalized-title → taskId lookup so we can link action items.
  const taskByTitle = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of accountTasks) {
      m.set(normalizeTitle(t.title), t.taskId);
    }
    return m;
  }, [accountTasks]);
  const [showSection, setShowSection] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAllPast, setShowAllPast] = useState(false);
  const [autoExpanded, setAutoExpanded] = useState(false);

  const futureMeetings = useMemo(
    () =>
      meetings
        .filter((m) => !m.isPast)
        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')),
    [meetings]
  );

  const pastEntries = useMemo(() => {
    const pastMeetings = meetings.filter((m) => m.isPast);
    const usedRecapIds = new Set<string>();

    // Recurring meetings (e.g. "ObservePoint | Caleres Sync") produce many
    // recaps that all share the same normalized title. We must therefore pair
    // each calendar event to the *closest-by-date* unused recap whose title
    // matches — never just "first one with that title", which would alias all
    // occurrences to a single recap and render duplicates with mis-stamped
    // dates (see bug fix 2026-05-22).
    const TWO_DAYS_MS = 86400000 * 2;

    const entries: PastMeetingEntry[] = [];

    for (const meeting of pastMeetings) {
      const normalizedTitle = normalizeTitle(meeting.title);
      const meetingTime = meeting.startTime
        ? new Date(meeting.startTime).getTime()
        : NaN;

      let matchedRecap: MeetingRecap | null = null;
      let bestDelta = Infinity;

      for (const recap of recaps) {
        if (usedRecapIds.has(recap.recapId)) continue;
        const recapNorm = normalizeTitle(recap.meetingTitle);
        const titleMatches =
          recapNorm === normalizedTitle ||
          recapNorm.includes(normalizedTitle) ||
          normalizedTitle.includes(recapNorm);
        if (!titleMatches) continue;

        // If either side is missing a usable date, fall back to a one-shot
        // title match (only when no date-based candidate has been found).
        if (!Number.isFinite(meetingTime) || !recap.meetingDate) {
          if (!matchedRecap) matchedRecap = recap;
          continue;
        }

        const delta = Math.abs(
          new Date(recap.meetingDate).getTime() - meetingTime
        );
        if (delta <= TWO_DAYS_MS && delta < bestDelta) {
          bestDelta = delta;
          matchedRecap = recap;
        }
      }

      if (matchedRecap) usedRecapIds.add(matchedRecap.recapId);

      entries.push({
        key: `meeting-${meeting.eventId}-${entries.length}`,
        meeting,
        recap: matchedRecap,
        title: meeting.title,
        date: meeting.startTime,
      });
    }

    for (const recap of recaps) {
      if (!usedRecapIds.has(recap.recapId)) {
        entries.push({
          key: `recap-${recap.recapId}`,
          meeting: null,
          recap,
          title: recap.meetingTitle,
          date: recap.meetingDate,
        });
      }
    }

    entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return entries;
  }, [meetings, recaps]);

  // Auto-expand the first past entry when initialView is 'past'
  if (initialView === 'past' && !autoExpanded && pastEntries.length > 0 && expandedId === null) {
    setExpandedId(pastEntries[0].key);
    setAutoExpanded(true);
  }

  const displayedPast = showAllPast ? pastEntries : pastEntries.slice(0, 8);

  const formatTime = (d: string) => {
    try {
      return format(parseISO(d), 'MMM d, yyyy h:mm a');
    } catch {
      return d;
    }
  };

  const formatDate = (d: string) => {
    try {
      return format(parseISO(d), 'MMM d, yyyy');
    } catch {
      return d;
    }
  };

  // Render upcoming-only
  if (initialView === 'upcoming') {
    return (
      <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowSection(!showSection)}
          className="w-full flex items-center justify-between px-4 py-2.5 border-b border-dark-700/50 hover:bg-dark-800/30"
        >
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-dark-200">
              Upcoming Meetings
              <span className="text-dark-500 font-normal ml-1.5">{futureMeetings.length}</span>
            </h2>
          </div>
          {showSection ? <ChevronUp className="w-4 h-4 text-dark-500" /> : <ChevronDown className="w-4 h-4 text-dark-500" />}
        </button>
        {showSection && (
          <div className="max-h-[300px] overflow-y-auto">
            {futureMeetings.length === 0 && (
              <div className="px-4 py-6 text-center text-dark-500 text-sm">No upcoming meetings scheduled</div>
            )}
            {futureMeetings.map((meeting, idx) => (
              <div key={`future-${meeting.eventId}-${idx}`} className="px-4 py-2.5 border-b border-dark-700/30 hover:bg-dark-800/50">
                <div className="flex items-start gap-2">
                  <CalendarClock className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-dark-100 truncate block font-medium">{meeting.title}</span>
                    <div className="flex items-center gap-2 text-xs text-dark-500 mt-0.5">
                      <span>{formatTime(meeting.startTime)}</span>
                      {meeting.attendeeCount > 0 && (
                        <>
                          <span className="text-dark-600">·</span>
                          <span>{meeting.acceptedCount}/{meeting.attendeeCount} accepted</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Render attendees from new structured data
  const renderAttendees = (recap: MeetingRecap) => {
    const extAttendees = recap.externalAttendeesDetailed || [];
    const intAttendees = recap.internalAttendees || [];

    if (extAttendees.length === 0 && intAttendees.length === 0) {
      // Fallback to old allNames string
      if (recap.allNames) {
        return (
          <div className="flex items-center gap-1.5 text-xs text-dark-500">
            <Users className="w-3.5 h-3.5" />
            <span>{recap.allNames}</span>
          </div>
        );
      }
      return null;
    }

    return (
      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-dark-400 flex items-center gap-1">
          <Users className="w-3 h-3" /> Attendees
        </h4>
        {extAttendees.map((a) => (
          <div key={a.email} className="flex items-center gap-2 text-xs">
            {a.actuallyAttended ? (
              <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
            ) : (
              <UserX className="w-3 h-3 text-dark-500 shrink-0" />
            )}
            <span className="text-dark-200">{a.name}</span>
            {a.title && <span className="text-dark-500">— {a.title}</span>}
            {a.roles && a.roles.length > 0 && (
              <span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400">
                {a.roles.join(', ')}
              </span>
            )}
            {!a.invited && <span className="text-[10px] text-dark-500">(not invited)</span>}
          </div>
        ))}
        {intAttendees.map((a) => (
          <div key={a.email} className="flex items-center gap-2 text-xs">
            {a.actuallyAttended ? (
              <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
            ) : (
              <UserX className="w-3 h-3 text-dark-500 shrink-0" />
            )}
            <span className="text-dark-300">{a.name}</span>
            <span className="text-[10px] px-1 py-0.5 rounded bg-dark-700 text-dark-400">Internal</span>
            {!a.invited && <span className="text-[10px] text-dark-500">(not invited)</span>}
          </div>
        ))}
      </div>
    );
  };

  // Render past-only or combined
  const pastContent = (
    <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setShowSection(!showSection)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-b border-dark-700/50 hover:bg-dark-800/30"
      >
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-dark-200">
            Past Meetings & Recaps
            <span className="text-dark-500 font-normal ml-1.5">{pastEntries.length}</span>
          </h2>
        </div>
        {showSection ? <ChevronUp className="w-4 h-4 text-dark-500" /> : <ChevronDown className="w-4 h-4 text-dark-500" />}
      </button>

      {showSection && (
        <div className="max-h-[600px] overflow-y-auto">
          {pastEntries.length === 0 && (
            <div className="px-4 py-6 text-center text-dark-500 text-sm">No past meetings</div>
          )}

          {displayedPast.map((entry) => {
            const isExpanded = expandedId === entry.key;
            const hasRecap = !!entry.recap;

            return (
              <div key={entry.key} className="border-b border-dark-700/30">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.key)}
                  className="w-full px-4 py-2.5 hover:bg-dark-800/50 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      {hasRecap ? (
                        <FileText className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                      ) : (
                        <CalendarCheck className="w-4 h-4 text-dark-500 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-dark-100 font-medium truncate">{entry.title}</span>
                          {hasRecap && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 shrink-0">Recap</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-dark-500 mt-0.5">
                          <span>{formatDate(entry.date)}</span>
                          {entry.recap?.duration && (
                            <><span className="text-dark-600">·</span><span>{entry.recap.duration}</span></>
                          )}
                          {entry.meeting && entry.meeting.attendeeCount > 0 && (
                            <><span className="text-dark-600">·</span><span>{entry.meeting.acceptedCount}/{entry.meeting.attendeeCount} attended</span></>
                          )}
                          {entry.recap && entry.recap.totalActionItems > 0 && (
                            <><span className="text-dark-600">·</span><span>{entry.recap.totalActionItems} action items</span></>
                          )}
                        </div>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-dark-500 shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-dark-500 shrink-0 mt-0.5" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 space-y-3">
                    {entry.recap?.summary && (
                      <div className="bg-dark-850/50 rounded-lg p-3">
                        <p className="text-xs text-dark-300 leading-relaxed whitespace-pre-wrap">{entry.recap.summary}</p>
                      </div>
                    )}

                    {entry.recap && renderAttendees(entry.recap)}
                    {!entry.recap && entry.meeting?.attendeeNames && (
                      <div className="flex items-center gap-1.5 text-xs text-dark-500">
                        <Users className="w-3.5 h-3.5" />
                        <span>{entry.meeting.attendeeNames}</span>
                      </div>
                    )}

                    {entry.recap?.actionItems && entry.recap.actionItems.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-dark-400 mb-1.5 flex items-center gap-1">
                          <ListTodo className="w-3 h-3" /> Action Items
                        </h4>
                        <div className="space-y-1">
                          {entry.recap.actionItems.map((item, idx) => {
                            const matchedTaskId = onTaskClick
                              ? (taskByTitle.get(normalizeTitle(item.title)) ?? null)
                              : null;
                            return (
                              <div key={`${entry.key}-ai-${idx}`} className="flex items-start gap-2 text-xs">
                                <span className="text-dark-500 shrink-0 mt-0.5">•</span>
                                <div className="min-w-0 flex-1">
                                  {matchedTaskId ? (
                                    <button
                                      onClick={() => onTaskClick!(matchedTaskId)}
                                      className="text-accent hover:text-accent-hover font-medium hover:underline inline-flex items-center gap-1 text-left"
                                      title="Open task"
                                    >
                                      {item.title}
                                      <SquareArrowUpRight className="w-3 h-3 shrink-0" />
                                    </button>
                                  ) : (
                                    <span className="text-dark-300 font-medium">{item.title}</span>
                                  )}
                                  {item.priority && (
                                    <span
                                      className={`ml-2 text-[10px] px-1 py-0.5 rounded ${
                                        item.priority === 'High'
                                          ? 'bg-red-500/10 text-red-400'
                                          : 'bg-dark-700 text-dark-400'
                                      }`}
                                    >
                                      {item.priority}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {onTaskClick && (
                          <p className="mt-2 text-[10px] text-dark-500">
                            Live task status is available in the Tasks panel above.
                          </p>
                        )}
                      </div>
                    )}

                    {entry.recap?.meetingLink && isExternalUrl(entry.recap.meetingLink) && (
                      <a href={entry.recap.meetingLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover">
                        View Full Recap on AskElephant <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {pastEntries.length > 8 && (
            <button
              onClick={() => setShowAllPast(!showAllPast)}
              className="w-full px-4 py-2 text-xs text-dark-500 hover:text-dark-300 text-center hover:bg-dark-800/30"
            >
              {showAllPast ? 'Show less' : `Show all ${pastEntries.length} past meetings`}
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (initialView === 'past') {
    return pastContent;
  }

  // Default: render both sections (no initialView)
  return (
    <div className="space-y-4">
      {pastContent}
    </div>
  );
}

function normalizeTitle(title: string | undefined | null): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function isExternalUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}
