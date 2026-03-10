import { useState, useRef } from 'react';
import type { AccountContact } from '../types';
import {
  Users,
  ChevronDown,
  ChevronUp,
  Mail,
  Briefcase,
  Shield,
  Linkedin,
  StickyNote,
  Check,
  Loader2,
} from 'lucide-react';

interface ContactRosterProps {
  contacts: AccountContact[];
  onUpdateContactNotes: (email: string, notes: string) => Promise<void>;
}

export function ContactRoster({ contacts, onUpdateContactNotes }: ContactRosterProps) {
  const [expanded, setExpanded] = useState(true);
  const [collapsedContacts, setCollapsedContacts] = useState<Set<string>>(new Set());
  const [savingEmail, setSavingEmail] = useState<string | null>(null);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const saveTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleNotesChange = (email: string, notes: string) => {
    const existing = saveTimeouts.current.get(email);
    if (existing) clearTimeout(existing);

    saveTimeouts.current.set(
      email,
      setTimeout(async () => {
        setSavingEmail(email);
        try {
          await onUpdateContactNotes(email, notes);
          setSavedEmail(email);
          setTimeout(() => setSavedEmail(null), 2000);
        } catch (err) {
          console.error('Failed to save contact notes:', err);
        } finally {
          setSavingEmail(null);
        }
      }, 1500)
    );
  };

  const roleColors: Record<string, string> = {
    'Champion': 'bg-emerald-500/10 text-emerald-400',
    'Decision Maker': 'bg-blue-500/10 text-blue-400',
    'Billing': 'bg-amber-500/10 text-amber-400',
    'Technical': 'bg-purple-500/10 text-purple-400',
    'Executive': 'bg-red-500/10 text-red-400',
  };

  const getRoleClass = (role: string) => {
    return roleColors[role] || 'bg-dark-700 text-dark-300';
  };

  return (
    <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-b border-dark-700/50 hover:bg-dark-800/30"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-dark-200">
            Contacts
            <span className="text-dark-500 font-normal ml-1.5">{contacts.length}</span>
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
          {contacts.length === 0 && (
            <div className="px-4 py-6 text-center text-dark-500 text-sm">
              No contacts yet — contacts are populated from meeting recaps
            </div>
          )}

          {contacts.map((contact) => {
            const isContactExpanded = !collapsedContacts.has(contact.email);

            return (
              <div key={contact.email} className="border-b border-dark-700/30">
                <button
                  onClick={() => setCollapsedContacts(prev => {
                    const next = new Set(prev);
                    if (next.has(contact.email)) next.delete(contact.email);
                    else next.add(contact.email);
                    return next;
                  })}
                  className="w-full px-4 py-2.5 hover:bg-dark-800/50 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm text-dark-100 font-medium block">
                        {contact.name}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-dark-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {contact.email}
                        </span>
                      </div>
                      {contact.title && (
                        <div className="flex items-center gap-1 text-xs text-dark-400 mt-0.5">
                          <Briefcase className="w-3 h-3" />
                          {contact.title}
                        </div>
                      )}
                      {contact.roles && contact.roles.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {contact.roles.map((role) => (
                            <span
                              key={role}
                              className={`text-[10px] px-1.5 py-0.5 rounded ${getRoleClass(role)}`}
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {isContactExpanded ? (
                      <ChevronUp className="w-4 h-4 text-dark-500 shrink-0 mt-0.5" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-dark-500 shrink-0 mt-0.5" />
                    )}
                  </div>
                </button>

                {isContactExpanded && (
                  <div className="px-4 pb-3 space-y-2">
                    {contact.contactId && (
                      <div className="flex items-center gap-1.5 text-xs text-dark-500">
                        <Shield className="w-3 h-3" />
                        <span>Salesforce: {contact.contactId}</span>
                      </div>
                    )}

                    {contact.linkedInUrl && contact.linkedInUrl !== 'Not available' && (
                      <a
                        href={contact.linkedInUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover"
                      >
                        <Linkedin className="w-3 h-3" />
                        View LinkedIn Profile
                      </a>
                    )}

                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="flex items-center gap-1 text-xs text-dark-400">
                          <StickyNote className="w-3 h-3" />
                          Contact Notes
                        </label>
                        {savingEmail === contact.email && (
                          <span className="flex items-center gap-1 text-dark-500 text-xs">
                            <Loader2 className="w-3 h-3 animate-spin" /> Saving
                          </span>
                        )}
                        {savedEmail === contact.email && savingEmail !== contact.email && (
                          <span className="flex items-center gap-1 text-emerald-400 text-xs">
                            <Check className="w-3 h-3" /> Saved
                          </span>
                        )}
                      </div>
                      <textarea
                        defaultValue={contact.notes || ''}
                        onChange={(e) => handleNotesChange(contact.email, e.target.value)}
                        placeholder="Add notes about this contact..."
                        rows={3}
                        className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-xs text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent/50 resize-none"
                      />
                    </div>
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
