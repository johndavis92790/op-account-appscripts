import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccounts } from '../hooks/useAccounts';
import { getScoreLevel } from '../types';
import {
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  DollarSign,
  Target,
  Activity,
  Video,
  X,
  ArrowUp,
  ArrowDown,
  Repeat,
  VideoOff,
} from 'lucide-react';
import { format, parseISO, isPast, differenceInDays } from 'date-fns';

type SortKey = 'renewal' | 'score' | 'contact' | 'name' | 'renewable' | 'loginScore' | 'auditUsage' | 'journeyUsage' | 'tasks';

export function AccountList() {
  const { accounts, loading, error } = useAccounts();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('renewal');
  const [sortAsc, setSortAsc] = useState(true);
  const [aeFilter, setAeFilter] = useState<string>('');
  const [noFutureMeetings, setNoFutureMeetings] = useState(false);

  const aeOptions = useMemo(() => {
    const aes = new Set(accounts.map((a) => a.ae).filter(Boolean));
    return Array.from(aes).sort();
  }, [accounts]);

  const handleSortClick = (key: SortKey) => {
    if (sortBy === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(key);
      // Default direction per sort type
      setSortAsc(['renewal', 'contact', 'name'].includes(key));
    }
  };

  const filtered = useMemo(() => {
    let list = accounts.filter((a) =>
      a.accountName.toLowerCase().includes(search.toLowerCase())
    );

    if (aeFilter) {
      list = list.filter((a) => a.ae === aeFilter);
    }

    if (noFutureMeetings) {
      list = list.filter((a) => !a.nextMeetingDate && a.meetingsFuture === 0);
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'renewal':
          cmp = (a.renewalDate || '9999').localeCompare(b.renewalDate || '9999');
          break;
        case 'score':
          cmp = (b.engagementScore ?? 0) - (a.engagementScore ?? 0);
          break;
        case 'contact':
          cmp = (a.daysSinceLastContact ?? 999) - (b.daysSinceLastContact ?? 999);
          break;
        case 'name':
          cmp = a.accountName.localeCompare(b.accountName);
          break;
        case 'renewable':
          cmp = (b.renewable ?? 0) - (a.renewable ?? 0);
          break;
        case 'loginScore':
          cmp = (b.loginScore ?? 0) - (a.loginScore ?? 0);
          break;
        case 'auditUsage':
          cmp = (b.auditUsage ?? 0) - (a.auditUsage ?? 0);
          break;
        case 'journeyUsage':
          cmp = (b.journeyUsage ?? 0) - (a.journeyUsage ?? 0);
          break;
        case 'tasks':
          cmp = (b.githubTasksOpen ?? 0) - (a.githubTasksOpen ?? 0);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [accounts, search, sortBy, sortAsc, aeFilter, noFutureMeetings]);

  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-dark-800 rounded-xl p-5 animate-pulse h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-400">
        <p>Error loading accounts: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-100 mb-1">Accounts</h1>
        <p className="text-dark-400 text-sm">{accounts.length} active accounts</p>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-dark-800 border border-dark-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors"
            />
          </div>
          <select
            value={aeFilter}
            onChange={(e) => setAeFilter(e.target.value)}
            className="bg-dark-800 border border-dark-700 rounded-lg px-3 py-2.5 text-sm text-dark-200 focus:outline-none focus:border-accent/50"
          >
            <option value="">All AEs</option>
            {aeOptions.map((ae) => (
              <option key={ae} value={ae}>{ae}</option>
            ))}
          </select>
          <button
            onClick={() => setNoFutureMeetings(!noFutureMeetings)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              noFutureMeetings
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-dark-800 text-dark-400 border border-dark-700 hover:text-dark-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            No Meetings
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: 'renewal', label: 'Renewal' },
            { key: 'score', label: 'Score' },
            { key: 'contact', label: 'Contact' },
            { key: 'name', label: 'Name' },
            { key: 'renewable', label: 'Amount' },
            { key: 'loginScore', label: 'Login' },
            { key: 'auditUsage', label: 'Audit' },
            { key: 'journeyUsage', label: 'Journey' },
            { key: 'tasks', label: 'Tasks' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleSortClick(opt.key as SortKey)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${
                sortBy === opt.key
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'bg-dark-800 text-dark-400 border border-dark-700 hover:text-dark-200'
              }`}
            >
              {opt.label}
              {sortBy === opt.key && (
                sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
            </button>
          ))}
          {(aeFilter || noFutureMeetings || search) && (
            <button
              onClick={() => { setAeFilter(''); setNoFutureMeetings(false); setSearch(''); }}
              className="px-3 py-1.5 text-xs text-dark-500 hover:text-dark-300 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((account) => {
          const scoreLevel = getScoreLevel(account.engagementScore);
          const renewalDate = account.renewalDate ? parseISO(account.renewalDate) : null;
          const daysToRenewal = renewalDate ? differenceInDays(renewalDate, new Date()) : null;
          const isOverdue = renewalDate ? isPast(renewalDate) : false;

          return (
            <button
              key={account.accountId}
              onClick={() => navigate(`/account/${account.accountId}`)}
              className="text-left bg-dark-800/60 hover:bg-dark-800 border border-dark-700/50 hover:border-dark-600 rounded-xl p-4 transition-all group"
            >
              {/* Row 1: Name + Score */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-dark-100 group-hover:text-accent transition-colors truncate pr-2">
                  {account.accountName}
                </h3>
                <span
                  className={`shrink-0 text-xs font-bold px-2 py-1 rounded-md border ${
                    scoreLevel === 'high'
                      ? 'score-high'
                      : scoreLevel === 'medium'
                      ? 'score-medium'
                      : 'score-low'
                  }`}
                >
                  {account.engagementScore}
                </span>
              </div>

              {/* Row 2: Always-visible metrics in fixed 2-col grid */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs mb-2">
                {/* Renewable Amount - always slot 1 */}
                <div className="flex flex-col">
                  <span className="text-[10px] text-dark-500 uppercase tracking-wider">Amount</span>
                  <span className="text-dark-300 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-400" />
                    {account.renewable > 0 ? `$${account.renewable.toLocaleString()}` : '—'}
                  </span>
                </div>

                {/* Renewal Date - always slot 2 */}
                <div className="flex flex-col">
                  <span className="text-[10px] text-dark-500 uppercase tracking-wider">Renewal Date</span>
                  <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400' : daysToRenewal !== null && daysToRenewal < 30 ? 'text-amber-400' : 'text-dark-300'}`}>
                    <Calendar className="w-3 h-3" />
                    {renewalDate ? (
                      <>
                        {format(renewalDate, 'MMM d, yyyy')}
                        <span className="text-dark-500 ml-0.5">({isOverdue ? 'overdue' : `${daysToRenewal}d`})</span>
                      </>
                    ) : '—'}
                  </span>
                </div>

                {/* Login Score - always slot 3 */}
                <div className="flex flex-col">
                  <span className="text-[10px] text-dark-500 uppercase tracking-wider">Login</span>
                  <span className="text-dark-300 flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    {account.loginScore > 0 ? account.loginScore : '—'}
                  </span>
                </div>

                {/* Audit Usage - always slot 4 */}
                <div className="flex flex-col">
                  <span className="text-[10px] text-dark-500 uppercase tracking-wider">Audit</span>
                  <span className="text-dark-300 flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    {account.auditUsage > 0 ? `${Math.round(account.auditUsage * 100)}%` : '—'}
                  </span>
                </div>

                {/* Journey Usage - always slot 5 */}
                <div className="flex flex-col">
                  <span className="text-[10px] text-dark-500 uppercase tracking-wider">Journey</span>
                  <span className="text-dark-300 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {account.journeyUsage > 0 ? `${Math.round(account.journeyUsage * 100)}%` : '—'}
                  </span>
                </div>

                {/* Last Contact - always slot 6 */}
                <div className="flex flex-col">
                  <span className="text-[10px] text-dark-500 uppercase tracking-wider">Last Contact</span>
                  <span className={`flex items-center gap-1 ${
                    account.daysSinceLastContact != null && account.daysSinceLastContact > 30
                      ? 'text-red-400'
                      : account.daysSinceLastContact != null && account.daysSinceLastContact > 14
                      ? 'text-amber-400'
                      : 'text-dark-300'
                  }`}>
                    <Clock className="w-3 h-3" />
                    {account.daysSinceLastContact != null ? `${account.daysSinceLastContact}d ago` : '—'}
                  </span>
                </div>

                {/* Next Meeting - always slot 7 */}
                <div className="flex flex-col">
                  <span className="text-[10px] text-dark-500 uppercase tracking-wider">Next Meeting</span>
                  {account.nextMeetingDate ? (
                    <span className="text-accent/70 flex items-center gap-1">
                      <Video className="w-3 h-3" />
                      {format(parseISO(account.nextMeetingDate), 'MMM d')}
                    </span>
                  ) : (
                    <span className="text-amber-400/70 flex items-center gap-1">
                      <VideoOff className="w-3 h-3" />
                      None scheduled
                    </span>
                  )}
                </div>

                {/* Tasks - always slot 8 */}
                <div className="flex flex-col">
                  <span className="text-[10px] text-dark-500 uppercase tracking-wider">Tasks</span>
                  <span className="text-dark-300 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {account.githubTasksOpen > 0 ? `${account.githubTasksOpen} open` : '—'}
                  </span>
                </div>
              </div>

              {/* Row 3: Status bar with cadence */}
              <div className="flex items-center gap-2 text-xs text-dark-500">
                {account.status && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {account.status}
                  </span>
                )}
                {account.ae && (
                  <>
                    <span className="text-dark-700">·</span>
                    <span>{account.ae}</span>
                  </>
                )}
                {account.stage && (
                  <>
                    <span className="text-dark-700">·</span>
                    <span className="truncate">{account.stage}</span>
                  </>
                )}
                {account.meetingCadence && (
                  <>
                    <span className="text-dark-700">·</span>
                    <span className="flex items-center gap-0.5">
                      <Repeat className="w-3 h-3" />
                      {account.meetingCadence}
                    </span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-12">
          <BarChart3 className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">
            {search ? 'No accounts match your search' : 'No accounts found'}
          </p>
        </div>
      )}
    </div>
  );
}
