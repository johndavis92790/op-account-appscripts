import { useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAccount } from '../hooks/useAccount';
import { useGlobalNotes } from '../hooks/useGlobalNotes';
import { getScoreLevel, getStatusClass } from '../types';
import type { Meeting, MeetingRecap, Task } from '../types';
import { NotesEditor } from './NotesEditor';
import { GlobalNotesEditor } from './GlobalNotesEditor';
import { SuccessCriteriaEditor } from './SuccessCriteriaEditor';
import { ContactRoster } from './ContactRoster';
import { TaskPanel } from './TaskPanel';
import { EmailPanel } from './EmailPanel';
import { MeetingsPanel } from './MeetingsPanel';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  TrendingUp,
  Target,
  Shield,
  DollarSign,
  BarChart3,
  Activity,
  Mail,
  Video,
  GitBranch,
  FileText,
  RefreshCw,
  Repeat,
  ExternalLink,
  Briefcase,
  Hash,
  Globe,
  Check,
  Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function AccountDashboard() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { account, loading, error, updateNotes, updateSuccessCriteria, updateContactNotes, updateEmailDomains } = useAccount(accountId);
  const { globalNotes, updateGlobalNotes } = useGlobalNotes();

  const futureMeetings = useMemo(
    () =>
      (account?.meetings || [])
        .filter((m: Meeting) => !m.isPast)
        .sort((a: Meeting, b: Meeting) => (a.startTime || '').localeCompare(b.startTime || '')),
    [account?.meetings]
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-dark-800 rounded w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-24 bg-dark-800 rounded-xl" />
            ))}
          </div>
          <div className="h-96 bg-dark-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400 mb-4">{error || 'Account not found'}</p>
        <button onClick={() => navigate('/')} className="text-accent hover:underline">
          Back to accounts
        </button>
      </div>
    );
  }

  const scoreLevel = getScoreLevel(account.engagementScore);
  const statusClass = getStatusClass(account.status);

  const safeCount = (n: number) => {
    if (n == null || n < 0 || n > 999999 || isNaN(n)) return 0;
    return n;
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return format(parseISO(d), 'MMM d, yyyy');
    } catch {
      return d;
    }
  };

  const formatPct = (n: number) => {
    if (!n && n !== 0) return '—';
    return `${Math.round(n * 100)}%`;
  };

  const formatCurrency = (n: number) => {
    if (!n) return '—';
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="p-4 sm:p-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-dark-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-dark-100 truncate">
            {account.accountName}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {account.status && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusClass}`}>
                {account.status}
              </span>
            )}
            {account.stage && (
              <span className="text-xs text-dark-400 bg-dark-800 px-2 py-0.5 rounded-full">
                {account.stage}
              </span>
            )}
            {account.forecast && (
              <span className="text-xs text-dark-400 bg-dark-800 px-2 py-0.5 rounded-full">
                {account.forecast}
              </span>
            )}
            {account.autoRenewal && (
              <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Auto-Renewal
              </span>
            )}
          </div>
        </div>
        <div
          className={`shrink-0 text-center px-3 py-2 rounded-xl border ${
            scoreLevel === 'high'
              ? 'score-high'
              : scoreLevel === 'medium'
              ? 'score-medium'
              : 'score-low'
          }`}
        >
          <div className="text-2xl font-bold">{account.engagementScore}</div>
          <div className="text-[10px] uppercase tracking-wider opacity-70">Communication Score</div>
        </div>
      </div>

      {/* Team Cards - CSM, AE, Sales Engineer */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-indigo-400/70 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-[11px] uppercase tracking-wider">CSM</span>
          </div>
          <div className="text-sm font-semibold text-dark-100 truncate">{account.csm || '—'}</div>
        </div>
        <div className="flex-1 bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-indigo-400/70 mb-1">
            <Shield className="w-4 h-4" />
            <span className="text-[11px] uppercase tracking-wider">AE</span>
          </div>
          <div className="text-sm font-semibold text-dark-100 truncate">{account.ae || '—'}</div>
        </div>
        <div className="flex-1 bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-indigo-400/70 mb-1">
            <Briefcase className="w-4 h-4" />
            <span className="text-[11px] uppercase tracking-wider">Sales Engineer</span>
          </div>
          <div className="text-sm font-semibold text-dark-100 truncate">{account.salesEngineer || '—'}</div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-6">
        <MetricCard
          icon={<Calendar className="w-4 h-4" />}
          label="Renewal Date"
          value={formatDate(account.renewalDate)}
          accent={account.renewalDate && new Date(account.renewalDate) < new Date() ? 'danger' : undefined}
        />
        <MetricCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Renewable"
          value={formatCurrency(account.renewable)}
        />
        <MetricCard
          icon={<Clock className="w-4 h-4" />}
          label="Days Since Contact"
          value={account.daysSinceLastContact != null ? `${account.daysSinceLastContact}d` : '—'}
          accent={
            account.daysSinceLastContact != null && account.daysSinceLastContact > 30
              ? 'danger'
              : account.daysSinceLastContact != null && account.daysSinceLastContact > 14
              ? 'warning'
              : undefined
          }
        />
        <MetricCard
          icon={<Target className="w-4 h-4" />}
          label="Login Score"
          value={account.loginScore ? String(account.loginScore) : '—'}
        />
        <MetricCard
          icon={<Activity className="w-4 h-4" />}
          label="Audit Usage"
          value={account.auditUsage ? formatPct(account.auditUsage) : '—'}
        />
        <MetricCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Journey Usage"
          value={account.journeyUsage ? formatPct(account.journeyUsage) : '—'}
        />
        <MetricCard
          icon={<Mail className="w-4 h-4" />}
          label="Emails (30d / Total)"
          value={`${safeCount(account.emailCount30d)} / ${safeCount(account.emailCountTotal)}`}
        />
        <MetricCard
          icon={<Video className="w-4 h-4" />}
          label="Meetings (Past / Future)"
          value={`${account.meetingsPast} / ${account.meetingsFuture}`}
        />
        <MetricCard
          icon={<BarChart3 className="w-4 h-4" />}
          label="Avg Attendance"
          value={`${account.avgMeetingAttendancePct}%`}
        />
        <MetricCard
          icon={<GitBranch className="w-4 h-4" />}
          label="Tasks (Open / Total)"
          value={`${account.githubTasksOpen} / ${account.githubTasksTotal}`}
        />
        <MetricCard
          icon={<Repeat className="w-4 h-4" />}
          label="Meeting Cadence"
          value={account.meetingCadence || 'Unknown'}
        />
        <MetricCard
          icon={<Hash className="w-4 h-4" />}
          label="FY / FQ"
          value={account.fiscalYear && account.fiscalQuarter ? `${account.fiscalYear}-Q${account.fiscalQuarter}` : '—'}
        />
        <MetricCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Price Per Page"
          value={account.pricePerPage ? `$${account.pricePerPage}` : '—'}
        />
      </div>

      {/* Key Dates Row */}
      <div className="flex flex-wrap gap-4 mb-6 text-xs text-dark-400">
        <span className="flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5" />
          Last Email: <span className="text-dark-200">{formatDate(account.lastEmailDate)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Video className="w-3.5 h-3.5" />
          Last Meeting: <span className="text-dark-200">{formatDate(account.lastMeetingDate)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          Next Meeting: <span className="text-dark-200 font-medium">{formatDate(account.nextMeetingDate)}</span>
        </span>
        {account.linkToOpp && (
          <a href={account.linkToOpp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-accent hover:text-accent-hover">
            <ExternalLink className="w-3 h-3" /> Opportunity
          </a>
        )}
        {account.linkToAccount && (
          <a href={account.linkToAccount} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-accent hover:text-accent-hover">
            <ExternalLink className="w-3 h-3" /> Account
          </a>
        )}
        {account.lastSynced && (
          <span className="flex items-center gap-1.5 ml-auto text-dark-500">
            <RefreshCw className="w-3 h-3" />
            Synced: {formatDate(account.lastSynced)}
          </span>
        )}
      </div>

      {/* Email Domains */}
      <EmailDomainsInline
        domains={account.emailDomains || ''}
        onSave={updateEmailDomains}
      />

      {/* Main Content: Notes + Data Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Global Notes, Account Notes, Contacts, Success Criteria */}
        <div className="space-y-6">
          <GlobalNotesEditor
            content={globalNotes.content}
            lastSaved={globalNotes.lastSaved}
            onSave={updateGlobalNotes}
          />
          <NotesEditor
            content={account.notes?.content || ''}
            lastSaved={account.notes?.lastSaved || null}
            onSave={updateNotes}
            accountId={account.accountId}
          />
          <ContactRoster
            contacts={account.contacts || []}
            onUpdateContactNotes={updateContactNotes}
          />
          <SuccessCriteriaEditor
            content={account.successCriteria?.content || ''}
            lastSaved={account.successCriteria?.lastSaved || null}
            onSave={updateSuccessCriteria}
            accountName={account.accountName}
            accountId={account.accountId}
          />
        </div>

        {/* Right Column: Tasks, Past Meetings & Recaps (first expanded), Emails, Upcoming Meetings */}
        <div className="space-y-6">
          <TaskPanel
            tasks={account.tasks}
            manualTasks={account.manualTasks}
            accountId={account.accountId}
            accountName={account.accountName}
          />
          <MeetingsPanel
            meetings={account.meetings}
            recaps={account.meetingRecaps}
            tasks={account.tasks}
            initialView="past"
          />
          <EmailPanel emails={account.emails} />
          <MeetingsPanel
            meetings={account.meetings}
            recaps={account.meetingRecaps}
            tasks={account.tasks}
            initialView="upcoming"
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: 'danger' | 'warning';
}) {
  return (
    <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-dark-500 mb-1">
        {icon}
        <span className="text-[11px] uppercase tracking-wider truncate">{label}</span>
      </div>
      <div
        className={`text-sm font-semibold truncate ${
          accent === 'danger'
            ? 'text-red-400'
            : accent === 'warning'
            ? 'text-amber-400'
            : 'text-dark-100'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function EmailDomainsInline({
  domains,
  onSave,
}: {
  domains: string;
  onSave: (domains: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();
  const isMissing = !domains || domains.trim() === '';

  const handleChange = (value: string) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      try {
        await onSave(value);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        console.error('Failed to save email domains:', err);
      } finally {
        setSaving(false);
      }
    }, 1200);
  };

  return (
    <div className={`flex items-center gap-2 mb-6 text-xs px-1 ${isMissing ? 'py-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3' : ''}`}>
      <Globe className={`w-3.5 h-3.5 shrink-0 ${isMissing ? 'text-amber-400' : 'text-dark-500'}`} />
      <span className={`shrink-0 ${isMissing ? 'text-amber-400 font-medium' : 'text-dark-400'}`}>
        {isMissing ? 'Email Domains (required):' : 'Email Domains:'}
      </span>
      <input
        type="text"
        defaultValue={domains}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="company.com, other.com"
        className={`flex-1 bg-transparent border-b text-sm text-dark-200 py-0.5 focus:outline-none transition-colors ${
          isMissing
            ? 'border-amber-500/30 focus:border-amber-400 placeholder-amber-500/40'
            : 'border-dark-700 focus:border-accent/50 placeholder-dark-600'
        }`}
      />
      {saving && <Loader2 className="w-3 h-3 text-dark-500 animate-spin shrink-0" />}
      {saved && !saving && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
    </div>
  );
}
