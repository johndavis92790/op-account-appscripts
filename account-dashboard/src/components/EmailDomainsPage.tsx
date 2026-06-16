import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccounts } from '../hooks/useAccounts';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  ArrowLeft,
  Search,
  Globe,
  AlertCircle,
  Check,
  Loader2,
  ExternalLink,
  X,
  RotateCcw,
  Sparkles,
  User,
  Ban,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { AccountListItem } from '../types';

interface DomainStatus {
  domain: string;
  source: 'manual' | 'auto' | 'excluded';
}

function parseDomainStatus(account: AccountListItem): DomainStatus[] {
  const statuses: DomainStatus[] = [];
  const seen = new Set<string>();

  // Manual domains (highest priority)
  const manual = account.emailDomainsManual || '';
  manual.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).forEach(d => {
    if (!seen.has(d)) {
      seen.add(d);
      statuses.push({ domain: d, source: 'manual' });
    }
  });

  // Auto domains (if not already seen and not excluded)
  const auto = account.emailDomainsAuto || '';
  const excluded = new Set(
    (account.emailDomainsExcluded || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  );

  auto.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).forEach(d => {
    if (!seen.has(d) && !excluded.has(d)) {
      seen.add(d);
      statuses.push({ domain: d, source: 'auto' });
    }
  });

  return statuses;
}

function parseExcludedDomains(account: AccountListItem): string[] {
  return (account.emailDomainsExcluded || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

export function EmailDomainsPage() {
  const { accounts, loading } = useAccounts();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});
  const saveTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const sorted = useMemo(() => {
    let list = [...accounts];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.accountName.toLowerCase().includes(q) ||
          (a.emailDomains || '').toLowerCase().includes(q) ||
          (a.emailDomainsAuto || '').toLowerCase().includes(q) ||
          (a.emailDomainsManual || '').toLowerCase().includes(q)
      );
    }
    if (showMissingOnly) {
      list = list.filter((a) => !a.emailDomains || a.emailDomains.trim() === '');
    }
    list.sort((a, b) => a.accountName.localeCompare(b.accountName));
    return list;
  }, [accounts, search, showMissingOnly]);

  const missingCount = useMemo(
    () => accounts.filter((a) => !a.emailDomains || a.emailDomains.trim() === '').length,
    [accounts]
  );

  const autoCount = useMemo(
    () => accounts.filter((a) => a.emailDomainsAuto && a.emailDomainsAuto.trim() !== '').length,
    [accounts]
  );

  const handleManualDomainsChange = (accountId: string, value: string) => {
    setManualInputs(prev => ({ ...prev, [accountId]: value }));

    const existing = saveTimeouts.current.get(accountId);
    if (existing) clearTimeout(existing);

    saveTimeouts.current.set(
      accountId,
      setTimeout(async () => {
        setSavingId(accountId);
        try {
          const account = accounts.find(a => a.accountId === accountId);
          if (!account) return;

          const newManualSet = new Set(
            value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
          );

          const currentAuto = account.emailDomainsAuto || '';
          const autoSet = new Set(
            currentAuto.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
          );

          // Remove manual domains from auto list
          for (const manual of newManualSet) {
            autoSet.delete(manual);
          }

          const finalDomains = [...Array.from(newManualSet).sort(), ...Array.from(autoSet).sort()];

          const docRef = doc(db, 'accounts', accountId);
          await updateDoc(docRef, {
            emailDomainsManual: Array.from(newManualSet).sort().join(', '),
            emailDomainsAuto: Array.from(autoSet).sort().join(', '),
            emailDomains: finalDomains.join(', '),
            emailDomainsSource: 'webapp',
            emailDomainsLastSaved: new Date().toISOString(),
          });
          setSavedId(accountId);
          setTimeout(() => setSavedId(null), 2000);
        } catch (err) {
          console.error('Failed to save email domains:', err);
        } finally {
          setSavingId(null);
        }
      }, 1200)
    );
  };

  const handleExcludeDomain = async (accountId: string, domain: string) => {
    setSavingId(accountId);
    try {
      const account = accounts.find(a => a.accountId === accountId);
      if (!account) return;

      const normalizedDomain = domain.trim().toLowerCase();

      const currentExcluded = account.emailDomainsExcluded || '';
      const excludedSet = new Set(
        currentExcluded.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      );

      const currentAuto = account.emailDomainsAuto || '';
      const autoSet = new Set(
        currentAuto.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      );

      const currentManual = account.emailDomainsManual || '';
      const manualSet = new Set(
        currentManual.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      );

      excludedSet.add(normalizedDomain);
      autoSet.delete(normalizedDomain);

      const finalDomains = [...Array.from(manualSet).sort(), ...Array.from(autoSet).sort()];

      const docRef = doc(db, 'accounts', accountId);
      await updateDoc(docRef, {
        emailDomainsExcluded: Array.from(excludedSet).sort().join(', '),
        emailDomainsAuto: Array.from(autoSet).sort().join(', '),
        emailDomains: finalDomains.join(', '),
        emailDomainsSource: 'webapp',
        emailDomainsLastSaved: new Date().toISOString(),
      });
      setSavedId(accountId);
      setTimeout(() => setSavedId(null), 2000);
    } catch (err) {
      console.error('Failed to exclude domain:', err);
    } finally {
      setSavingId(null);
    }
  };

  const handleRestoreDomain = async (accountId: string, domain: string) => {
    setSavingId(accountId);
    try {
      const account = accounts.find(a => a.accountId === accountId);
      if (!account) return;

      const normalizedDomain = domain.trim().toLowerCase();

      const currentExcluded = account.emailDomainsExcluded || '';
      const excludedSet = new Set(
        currentExcluded.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      );

      excludedSet.delete(normalizedDomain);

      const docRef = doc(db, 'accounts', accountId);
      await updateDoc(docRef, {
        emailDomainsExcluded: Array.from(excludedSet).sort().join(', '),
        emailDomainsSource: 'webapp',
        emailDomainsLastSaved: new Date().toISOString(),
      });
      setSavedId(accountId);
      setTimeout(() => setSavedId(null), 2000);
    } catch (err) {
      console.error('Failed to restore domain:', err);
    } finally {
      setSavingId(null);
    }
  };

  const toggleExpanded = (accountId: string) => {
    setExpandedId(expandedId === accountId ? null : accountId);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-3">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-12 bg-dark-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-dark-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-dark-100">Email Domain Mapping</h1>
          <p className="text-dark-400 text-sm">
            {accounts.length} accounts
            {missingCount > 0 && (
              <span className="text-amber-400 ml-2">· {missingCount} missing domains</span>
            )}
            {autoCount > 0 && (
              <span className="text-emerald-400 ml-2">· {autoCount} with auto-populated</span>
            )}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-dark-400">Manual (you added)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-dark-400">Auto (from contacts)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Ban className="w-3.5 h-3.5 text-red-400" />
          <span className="text-dark-400">Excluded</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
          <input
            type="text"
            placeholder="Search accounts or domains..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-dark-800 border border-dark-700 rounded-lg pl-10 pr-4 py-2 text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent/50"
          />
        </div>
        <button
          onClick={() => setShowMissingOnly(!showMissingOnly)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
            showMissingOnly
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-dark-800 text-dark-400 border border-dark-700 hover:text-dark-200'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Missing Only ({missingCount})
        </button>
      </div>

      {/* Table */}
      <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[40px_minmax(200px,1fr)_minmax(300px,2fr)_40px] gap-0 text-xs uppercase tracking-wider text-dark-500 px-4 py-2.5 border-b border-dark-700/50 bg-dark-850/50">
          <span></span>
          <span>Account Name</span>
          <span>Email Domains</span>
          <span></span>
        </div>

        <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
          {sorted.map((account) => {
            const isMissing = !account.emailDomains || account.emailDomains.trim() === '';
            const domainStatuses = parseDomainStatus(account);
            const excludedDomains = parseExcludedDomains(account);
            const isExpanded = expandedId === account.accountId;
            const hasExcluded = excludedDomains.length > 0;

            return (
              <div
                key={account.accountId}
                className={`border-b border-dark-700/30 ${isMissing ? 'bg-amber-500/5' : ''}`}
              >
                {/* Main Row */}
                <div className="grid grid-cols-[40px_minmax(200px,1fr)_minmax(300px,2fr)_40px] gap-0 items-center px-4 py-2 hover:bg-dark-800/50">
                  <button
                    onClick={() => toggleExpanded(account.accountId)}
                    className="p-1 text-dark-500 hover:text-dark-300 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>

                  <div className="flex items-center gap-2 min-w-0 pr-3">
                    {isMissing && <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    <button
                      onClick={() => navigate(`/account/${account.accountId}`)}
                      className="text-sm text-dark-200 hover:text-accent truncate text-left transition-colors"
                    >
                      {account.accountName}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {domainStatuses.length === 0 ? (
                        <span className="text-dark-500 text-sm italic">No domains configured</span>
                      ) : (
                        domainStatuses.map(({ domain, source }) => (
                          <span
                            key={domain}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                              source === 'manual'
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                            title={source === 'manual' ? 'Manually added' : 'Auto-populated from contacts'}
                          >
                            {source === 'manual' ? (
                              <User className="w-3 h-3" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                            {domain}
                            {source === 'auto' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExcludeDomain(account.accountId, domain);
                                }}
                                className="ml-1 hover:text-red-400 transition-colors"
                                title="Exclude this domain"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        ))
                      )}
                      {hasExcluded && !isExpanded && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-300 border border-red-500/30">
                          <Ban className="w-3 h-3" />
                          {excludedDomains.length} excluded
                        </span>
                      )}
                    </div>
                    {savingId === account.accountId && (
                      <Loader2 className="w-3.5 h-3.5 text-dark-500 animate-spin shrink-0" />
                    )}
                    {savedId === account.accountId && savingId !== account.accountId && (
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                  </div>

                  <button
                    onClick={() => navigate(`/account/${account.accountId}`)}
                    className="p-1 text-dark-500 hover:text-accent transition-colors"
                    title="View account"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 bg-dark-800/30 border-t border-dark-700/20">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Manual Domains Input */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-medium text-dark-400 mb-2">
                          <User className="w-3.5 h-3.5 text-indigo-400" />
                          Manual Domains (takes precedence)
                        </label>
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-dark-500 shrink-0" />
                          <input
                            type="text"
                            value={manualInputs[account.accountId] ?? (account.emailDomainsManual || '')}
                            onChange={(e) => handleManualDomainsChange(account.accountId, e.target.value)}
                            placeholder="company.com, other.com"
                            className="flex-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-dark-100 placeholder-dark-600 focus:outline-none focus:border-indigo-500/50"
                          />
                        </div>
                        <p className="text-xs text-dark-500 mt-1.5">
                          These domains are always included and take precedence over auto-populated ones.
                        </p>
                      </div>

                      {/* Excluded Domains */}
                      {hasExcluded && (
                        <div>
                          <label className="flex items-center gap-2 text-xs font-medium text-dark-400 mb-2">
                            <Ban className="w-3.5 h-3.5 text-red-400" />
                            Excluded Domains
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {excludedDomains.map((domain) => (
                              <span
                                key={domain}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/20 text-red-300 border border-red-500/30"
                              >
                                {domain}
                                <button
                                  onClick={() => handleRestoreDomain(account.accountId, domain)}
                                  className="hover:text-red-200 transition-colors"
                                  title="Restore this domain (will be re-added on next auto-sync if in contacts)"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-dark-500 mt-1.5">
                            Excluded domains are removed from auto-population. Click the restore icon to allow them back.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Last Sync Info */}
                    {account.emailDomainsLastAutoSync && (
                      <div className="mt-4 pt-3 border-t border-dark-700/30">
                        <p className="text-xs text-dark-500">
                          <Sparkles className="w-3 h-3 inline mr-1 text-emerald-400" />
                          Last auto-sync: {new Date(account.emailDomainsLastAutoSync).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {sorted.length === 0 && (
            <div className="px-4 py-8 text-center text-dark-500 text-sm">
              {search ? 'No accounts match your search' : 'No accounts found'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
