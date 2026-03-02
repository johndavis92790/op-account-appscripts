import { useState, useMemo } from 'react';
import type { Meeting, MeetingRecap, Task } from '../types';
import {
  Video,
  ChevronDown,
  ChevronUp,
  CalendarClock,
  CalendarCheck,
  ExternalLink,
  Users,
  GitBranch,
  CircleDot,
  CircleCheck,
  FileText,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface MeetingsPanelProps {
  meetings: Meeting[];
  recaps: MeetingRecap[];
  tasks: Task[];
}

interface PastMeetingEntry {
  key: string;
  meeting: Meeting | null;
  recap: MeetingRecap | null;
  title: string;
  date: string;
}

export function MeetingsPanel({ meetings, recaps, tasks }: MeetingsPanelProps) {
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showPast, setShowPast] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAllPast, setShowAllPast] = useState(false);

  const futureMeetings = useMemo(
    () =>
      meetings
        .filter((m) => !m.isPast)
        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')),
    [meetings]
  );

  const pastEntries = useMemo(() => {
    const pastMeetings = meetings.filter((m) => m.isPast);

    // Build a map of recap by normalized title+date for matching
    const recapMap = new Map<string, MeetingRecap>();
    const usedRecapIds = new Set<string>();

    for (const recap of recaps) {
      // Try to match by title similarity
      const key = normalizeTitle(recap.meetingTitle);
      recapMap.set(key, recap);
    }

    const entries: PastMeetingEntry[] = [];

    // First pass: match past meetings to recaps
    for (const meeting of pastMeetings) {
      const normalizedTitle = normalizeTitle(meeting.title);
      let matchedRecap: MeetingRecap | null = null;

      // Try exact normalized title match
      if (recapMap.has(normalizedTitle)) {
        matchedRecap = recapMap.get(normalizedTitle)!;
        usedRecapIds.add(matchedRecap.recapId);
      } else {
        // Try fuzzy match: check if recap title contains meeting title or vice versa
        for (const recap of recaps) {
          if (usedRecapIds.has(recap.recapId)) continue;
          const recapNorm = normalizeTitle(recap.meetingTitle);
          if (
            recapNorm.includes(normalizedTitle) ||
            normalizedTitle.includes(recapNorm)
          ) {
            // Also check date proximity (within 1 day)
            if (meeting.startTime && recap.meetingDate) {
              const meetDate = new Date(meeting.startTime).getTime();
              const recapDate = new Date(recap.meetingDate).getTime();
              if (Math.abs(meetDate - recapDate) < 86400000 * 2) {
                matchedRecap = recap;
                usedRecapIds.add(recap.recapId);
                break;
              }
            }
          }
        }
      }

      entries.push({
        key: `meeting-${meeting.eventId}-${entries.length}`,
        meeting,
        recap: matchedRecap,
        title: meeting.title,
        date: meeting.startTime,
      });
    }

    // Second pass: add unmatched recaps
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

    // Sort by date descending
    entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return entries;
  }, [meetings, recaps]);

  // Build GitHub task lookup by issue number for action item linking
  const taskByNumber = useMemo(() => {
    const map = new Map<number, Task>();
    for (const task of tasks) {
      if (task.number) map.set(task.number, task);
    }
    return map;
  }, [tasks]);

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

  return (
    <div className="space-y-4">
      {/* Upcoming Meetings */}
      <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowUpcoming(!showUpcoming)}
          className="w-full flex items-center justify-between px-4 py-2.5 border-b border-dark-700/50 hover:bg-dark-800/30"
        >
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-dark-200">
              Upcoming Meetings
              <span className="text-dark-500 font-normal ml-1.5">
                {futureMeetings.length}
              </span>
            </h2>
          </div>
          {showUpcoming ? (
            <ChevronUp className="w-4 h-4 text-dark-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-dark-500" />
          )}
        </button>

        {showUpcoming && (
          <div className="max-h-[300px] overflow-y-auto">
            {futureMeetings.length === 0 && (
              <div className="px-4 py-6 text-center text-dark-500 text-sm">
                No upcoming meetings
              </div>
            )}
            {futureMeetings.map((meeting, idx) => (
              <div
                key={`future-${meeting.eventId}-${idx}`}
                className="px-4 py-2.5 border-b border-dark-700/30 hover:bg-dark-800/50"
              >
                <div className="flex items-start gap-2">
                  <CalendarClock className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-dark-100 truncate block font-medium">
                      {meeting.title}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-dark-500 mt-0.5">
                      <span>{formatTime(meeting.startTime)}</span>
                      {meeting.attendeeCount > 0 && (
                        <>
                          <span className="text-dark-600">·</span>
                          <span>
                            {meeting.acceptedCount}/{meeting.attendeeCount}{' '}
                            accepted
                          </span>
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

      {/* Past Meetings & Recaps */}
      <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowPast(!showPast)}
          className="w-full flex items-center justify-between px-4 py-2.5 border-b border-dark-700/50 hover:bg-dark-800/30"
        >
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-dark-200">
              Past Meetings & Recaps
              <span className="text-dark-500 font-normal ml-1.5">
                {pastEntries.length}
              </span>
            </h2>
          </div>
          {showPast ? (
            <ChevronUp className="w-4 h-4 text-dark-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-dark-500" />
          )}
        </button>

        {showPast && (
          <div className="max-h-[600px] overflow-y-auto">
            {pastEntries.length === 0 && (
              <div className="px-4 py-6 text-center text-dark-500 text-sm">
                No past meetings
              </div>
            )}

            {displayedPast.map((entry) => {
              const isExpanded = expandedId === entry.key;
              const hasRecap = !!entry.recap;

              return (
                <div key={entry.key} className="border-b border-dark-700/30">
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : entry.key)
                    }
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
                            <span className="text-sm text-dark-100 font-medium truncate">
                              {entry.title}
                            </span>
                            {hasRecap && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 shrink-0">
                                Recap
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-dark-500 mt-0.5">
                            <span>{formatDate(entry.date)}</span>
                            {entry.recap?.duration && (
                              <>
                                <span className="text-dark-600">·</span>
                                <span>{entry.recap.duration}</span>
                              </>
                            )}
                            {entry.meeting &&
                              entry.meeting.attendeeCount > 0 && (
                                <>
                                  <span className="text-dark-600">·</span>
                                  <span>
                                    {entry.meeting.acceptedCount}/
                                    {entry.meeting.attendeeCount} attended
                                  </span>
                                </>
                              )}
                            {entry.recap &&
                              entry.recap.totalActionItems > 0 && (
                                <>
                                  <span className="text-dark-600">·</span>
                                  <span>
                                    {entry.recap.totalActionItems} action items
                                  </span>
                                </>
                              )}
                          </div>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-dark-500 shrink-0 mt-0.5" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-dark-500 shrink-0 mt-0.5" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-3">
                      {/* Recap summary */}
                      {entry.recap?.summary && (
                        <div className="bg-dark-850/50 rounded-lg p-3">
                          <p className="text-xs text-dark-300 leading-relaxed whitespace-pre-wrap">
                            {entry.recap.summary}
                          </p>
                        </div>
                      )}

                      {/* Attendees */}
                      {entry.recap?.allNames && (
                        <div className="flex items-center gap-1.5 text-xs text-dark-500">
                          <Users className="w-3.5 h-3.5" />
                          <span>{entry.recap.allNames}</span>
                        </div>
                      )}
                      {!entry.recap?.allNames &&
                        entry.meeting?.attendeeNames && (
                          <div className="flex items-center gap-1.5 text-xs text-dark-500">
                            <Users className="w-3.5 h-3.5" />
                            <span>{entry.meeting.attendeeNames}</span>
                          </div>
                        )}

                      {/* Action Items as GitHub Issues */}
                      {entry.recap?.actionItems &&
                        entry.recap.actionItems.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-dark-400 mb-1.5 flex items-center gap-1">
                              <GitBranch className="w-3 h-3" />
                              GitHub Issues from Action Items
                            </h4>
                            <div className="space-y-1">
                              {entry.recap.actionItems.map((item, idx) => {
                                const linkedTask = item.githubIssueNumber
                                  ? taskByNumber.get(item.githubIssueNumber)
                                  : null;

                                return (
                                  <div
                                    key={`${entry.key}-ai-${idx}`}
                                    className="flex items-start gap-2 text-xs"
                                  >
                                    {linkedTask ? (
                                      linkedTask.state === 'OPEN' ? (
                                        <CircleDot className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                                      ) : (
                                        <CircleCheck className="w-3.5 h-3.5 text-dark-500 mt-0.5 shrink-0" />
                                      )
                                    ) : (
                                      <span className="text-dark-500 shrink-0 mt-0.5">
                                        •
                                      </span>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      {linkedTask ? (
                                        <a
                                          href={linkedTask.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-dark-200 hover:text-accent transition-colors"
                                        >
                                          <span className="font-medium">
                                            {linkedTask.title}
                                          </span>
                                          <span className="text-dark-500 ml-1">
                                            #{linkedTask.number}
                                          </span>
                                        </a>
                                      ) : (
                                        <span className="text-dark-300 font-medium">
                                          {item.title}
                                        </span>
                                      )}
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        {(linkedTask?.status ||
                                          linkedTask?.priority) && (
                                          <>
                                            {linkedTask.status && (
                                              <span className="text-[10px] px-1 py-0.5 rounded bg-dark-700 text-dark-300">
                                                {linkedTask.status}
                                              </span>
                                            )}
                                            {linkedTask.priority && (
                                              <span
                                                className={`text-[10px] px-1 py-0.5 rounded ${
                                                  linkedTask.priority ===
                                                    'Critical' ||
                                                  linkedTask.priority === 'High'
                                                    ? 'bg-red-500/10 text-red-400'
                                                    : linkedTask.priority ===
                                                      'Medium'
                                                    ? 'bg-amber-500/10 text-amber-400'
                                                    : 'bg-dark-700 text-dark-400'
                                                }`}
                                              >
                                                {linkedTask.priority}
                                              </span>
                                            )}
                                          </>
                                        )}
                                        {!linkedTask && item.priority && (
                                          <span
                                            className={`text-[10px] px-1 py-0.5 rounded ${
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
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                      {/* External link to AskElephant */}
                      {entry.recap?.meetingLink &&
                        isExternalUrl(entry.recap.meetingLink) && (
                          <a
                            href={entry.recap.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
                          >
                            View Full Recap on AskElephant{' '}
                            <ExternalLink className="w-3 h-3" />
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
                {showAllPast
                  ? 'Show less'
                  : `Show all ${pastEntries.length} past meetings`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function isExternalUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}
