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
} from 'lucide-react';

export function EmailDomainsPage() {
  const { accounts, loading } = useAccounts();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const saveTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const sorted = useMemo(() => {
    let list = [...accounts];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.accountName.toLowerCase().includes(q) ||
          (a.emailDomains || '').toLowerCase().includes(q)
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

  const handleDomainsChange = (accountId: string, value: string) => {
    const existing = saveTimeouts.current.get(accountId);
    if (existing) clearTimeout(existing);

    saveTimeouts.current.set(
      accountId,
      setTimeout(async () => {
        setSavingId(accountId);
        try {
          const docRef = doc(db, 'accounts', accountId);
          await updateDoc(docRef, {
            emailDomains: value,
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
            {accounts.length} accounts · {missingCount > 0 && (
              <span className="text-amber-400">{missingCount} missing domains</span>
            )}
          </p>
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
        <div className="grid grid-cols-[minmax(200px,1fr)_minmax(300px,2fr)_40px] gap-0 text-xs uppercase tracking-wider text-dark-500 px-4 py-2.5 border-b border-dark-700/50 bg-dark-850/50">
          <span>Account Name</span>
          <span>Email Domains</span>
          <span></span>
        </div>

        <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
          {sorted.map((account) => {
            const isMissing = !account.emailDomains || account.emailDomains.trim() === '';

            return (
              <div
                key={account.accountId}
                className={`grid grid-cols-[minmax(200px,1fr)_minmax(300px,2fr)_40px] gap-0 items-center px-4 py-2 border-b border-dark-700/30 hover:bg-dark-800/50 ${
                  isMissing ? 'bg-amber-500/5' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-3">
                  {isMissing && <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  <button
                    onClick={() => navigate(`/account/${account.accountId}`)}
                    className="text-sm text-dark-200 hover:text-accent truncate text-left transition-colors"
                  >
                    {account.accountName}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <Globe className="w-3.5 h-3.5 text-dark-500 shrink-0" />
                    <input
                      type="text"
                      defaultValue={account.emailDomains || ''}
                      onChange={(e) => handleDomainsChange(account.accountId, e.target.value)}
                      placeholder="company.com, other.com"
                      className={`w-full bg-transparent border-b text-sm text-dark-100 placeholder-dark-600 py-1 focus:outline-none transition-colors ${
                        isMissing
                          ? 'border-amber-500/30 focus:border-amber-400'
                          : 'border-transparent focus:border-accent/50 hover:border-dark-600'
                      }`}
                    />
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
