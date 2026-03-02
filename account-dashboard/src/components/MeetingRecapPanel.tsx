import { useState } from 'react';
import type { MeetingRecap } from '../types';
import { FileText, ChevronDown, ChevronUp, ExternalLink, Users, ListChecks } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface MeetingRecapPanelProps {
  recaps: MeetingRecap[];
}

export function MeetingRecapPanel({ recaps }: MeetingRecapPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [expandedRecap, setExpandedRecap] = useState<string | null>(null);

  const sorted = [...recaps].sort((a, b) =>
    (b.meetingDate || '').localeCompare(a.meetingDate || '')
  );

  const formatDate = (d: string) => {
    try {
      return format(parseISO(d), 'MMM d, yyyy');
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
          <FileText className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-dark-200">
            Meeting Recaps
            <span className="text-dark-500 font-normal ml-1.5">{recaps.length}</span>
          </h2>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-dark-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-dark-500" />
        )}
      </button>

      {expanded && (
        <div className="max-h-[500px] overflow-y-auto">
          {recaps.length === 0 && (
            <div className="px-4 py-6 text-center text-dark-500 text-sm">No meeting recaps</div>
          )}

          {sorted.map((recap) => {
            const isExpanded = expandedRecap === recap.recapId;

            return (
              <div key={recap.recapId} className="border-b border-dark-700/30">
                <button
                  onClick={() => setExpandedRecap(isExpanded ? null : recap.recapId)}
                  className="w-full px-4 py-2.5 hover:bg-dark-800/50 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm text-dark-100 font-medium block truncate">
                        {recap.meetingTitle}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-dark-500 mt-0.5">
                        <span>{formatDate(recap.meetingDate)}</span>
                        {recap.duration && (
                          <>
                            <span className="text-dark-600">·</span>
                            <span>{recap.duration}</span>
                          </>
                        )}
                        {recap.totalActionItems > 0 && (
                          <>
                            <span className="text-dark-600">·</span>
                            <span className="flex items-center gap-0.5">
                              <ListChecks className="w-3 h-3" />
                              {recap.totalActionItems} action items
                            </span>
                          </>
                        )}
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
                    {recap.summary && (
                      <div className="bg-dark-850/50 rounded-lg p-3">
                        <p className="text-xs text-dark-300 leading-relaxed whitespace-pre-wrap">
                          {recap.summary}
                        </p>
                      </div>
                    )}

                    {recap.allNames && (
                      <div className="flex items-center gap-1.5 text-xs text-dark-500">
                        <Users className="w-3.5 h-3.5" />
                        <span>{recap.allNames}</span>
                      </div>
                    )}

                    {recap.actionItems && recap.actionItems.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-dark-400 mb-1.5">
                          Action Items
                        </h4>
                        <div className="space-y-1">
                          {recap.actionItems.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2 text-xs text-dark-300"
                            >
                              <span className="text-dark-500 shrink-0">•</span>
                              <div>
                                <span className="font-medium">{item.title}</span>
                                {item.priority && (
                                  <span
                                    className={`ml-1.5 text-[10px] px-1 py-0.5 rounded ${
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
                          ))}
                        </div>
                      </div>
                    )}

                    {recap.meetingLink && (
                      <a
                        href={recap.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
                      >
                        View Full Recap <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
