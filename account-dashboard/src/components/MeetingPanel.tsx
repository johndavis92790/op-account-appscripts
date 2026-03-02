import { useState } from 'react';
import type { Meeting } from '../types';
import { Video, ChevronDown, ChevronUp, CalendarClock, CalendarCheck } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface MeetingPanelProps {
  meetings: Meeting[];
}

export function MeetingPanel({ meetings }: MeetingPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const futureMeetings = meetings
    .filter((m) => !m.isPast)
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  const pastMeetings = meetings
    .filter((m) => m.isPast)
    .sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''));

  const [showPast, setShowPast] = useState(false);
  const displayedPast = showPast ? pastMeetings : pastMeetings.slice(0, 5);

  const formatTime = (d: string) => {
    try {
      return format(parseISO(d), 'MMM d, yyyy h:mm a');
    } catch {
      return d;
    }
  };

  return (
    <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-b border-dark-700/50 hover:bg-dark-800/30"
      >
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-dark-200">
            Meetings
            <span className="text-dark-500 font-normal ml-1.5">
              {futureMeetings.length} upcoming · {pastMeetings.length} past
            </span>
          </h2>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-dark-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-dark-500" />
        )}
      </button>

      {expanded && (
        <div className="max-h-[400px] overflow-y-auto">
          {meetings.length === 0 && (
            <div className="px-4 py-6 text-center text-dark-500 text-sm">No meetings</div>
          )}

          {futureMeetings.length > 0 && (
            <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-accent font-semibold bg-accent/5">
              Upcoming
            </div>
          )}
          {futureMeetings.map((meeting) => (
            <div
              key={meeting.eventId}
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
                          {meeting.acceptedCount}/{meeting.attendeeCount} accepted
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {pastMeetings.length > 0 && (
            <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-dark-500 font-semibold bg-dark-850/50">
              Past
            </div>
          )}
          {displayedPast.map((meeting) => (
            <div
              key={meeting.eventId}
              className="px-4 py-2.5 border-b border-dark-700/30 hover:bg-dark-800/50"
            >
              <div className="flex items-start gap-2">
                <CalendarCheck className="w-4 h-4 text-dark-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-dark-300 truncate block">
                    {meeting.title}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-dark-500 mt-0.5">
                    <span>{formatTime(meeting.startTime)}</span>
                    {meeting.attendeeCount > 0 && (
                      <>
                        <span className="text-dark-600">·</span>
                        <span>
                          {meeting.acceptedCount}/{meeting.attendeeCount} accepted
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {pastMeetings.length > 5 && (
            <button
              onClick={() => setShowPast(!showPast)}
              className="w-full px-4 py-2 text-xs text-dark-500 hover:text-dark-300 text-center hover:bg-dark-800/30"
            >
              {showPast ? 'Show less' : `Show all ${pastMeetings.length} past meetings`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
