import { useParams } from 'react-router-dom';
import { useAccount } from '../hooks/useAccount';
import { SuccessCriteriaEditor } from './SuccessCriteriaEditor';
import { BarChart3 } from 'lucide-react';

export function SuccessCriteriaPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const { account, loading, error, updateSuccessCriteria } = useAccount(accountId);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <BarChart3 className="w-12 h-12 text-accent animate-pulse" />
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <p className="text-red-400">{error || 'Account not found'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 p-6 max-w-4xl mx-auto">
      <SuccessCriteriaEditor
        content={account.successCriteria?.content || ''}
        lastSaved={account.successCriteria?.lastSaved || null}
        onSave={updateSuccessCriteria}
        accountName={account.accountName}
      />
    </div>
  );
}
