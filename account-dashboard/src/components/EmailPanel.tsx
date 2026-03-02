import { useState } from 'react';
import type { Email } from '../types';
import { Mail, ArrowUpRight, ArrowDownLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface EmailPanelProps {
  emails: Email[];
}

export function EmailPanel({ emails }: EmailPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const displayed = showAll ? emails : emails.slice(0, 10);

  return (
    <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-b border-dark-700/50 hover:bg-dark-800/30"
      >
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-red-400" />
          <h2 className="text-sm font-semibold text-dark-200">
            Emails
            <span className="text-dark-500 font-normal ml-1.5">{emails.length}</span>
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
          {emails.length === 0 && (
            <div className="px-4 py-6 text-center text-dark-500 text-sm">No emails</div>
          )}

          {displayed.map((email) => {
            const isOutbound = email.isOutbound;
            let dateStr = '';
            try {
              dateStr = format(parseISO(email.date), 'MMM d, h:mm a');
            } catch {
              dateStr = email.date || '';
            }

            const gmailUrl = email.messageId
              ? `https://mail.google.com/mail/u/0/#search/rfc822msgid%3A${encodeURIComponent(email.messageId)}`
              : undefined;

            return (
              <a
                key={email.messageId}
                href={gmailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-2.5 border-b border-dark-700/30 hover:bg-dark-800/50 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-2">
                  {isOutbound ? (
                    <ArrowUpRight className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  ) : (
                    <ArrowDownLeft className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm text-dark-100 truncate font-medium">
                        {email.subject || '(no subject)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-dark-500">
                      <span className="truncate">
                        {isOutbound ? 'To: ' : 'From: '}
                        {isOutbound ? email.to : email.from}
                      </span>
                      <span className="shrink-0 text-dark-600">·</span>
                      <span className="shrink-0">{dateStr}</span>
                    </div>
                    {email.bodyPreview && (
                      <p className="text-xs text-dark-500 mt-1 line-clamp-2">
                        {email.bodyPreview}
                      </p>
                    )}
                  </div>
                </div>
              </a>
            );
          })}

          {emails.length > 10 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full px-4 py-2 text-xs text-dark-500 hover:text-dark-300 text-center hover:bg-dark-800/30"
            >
              {showAll ? 'Show less' : `Show all ${emails.length} emails`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
