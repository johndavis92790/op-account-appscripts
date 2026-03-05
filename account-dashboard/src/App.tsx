import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AccountList } from './components/AccountList';
import { AccountDashboard } from './components/AccountDashboard';
import { SuccessCriteriaPage } from './components/SuccessCriteriaPage';
import { EmailDomainsPage } from './components/EmailDomainsPage';
import { LoginPage } from './components/LoginPage';
import { BarChart3 } from 'lucide-react';

export default function App() {
  const { user, loading, error, signIn, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <BarChart3 className="w-12 h-12 text-accent animate-pulse" />
          <p className="text-dark-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onSignIn={signIn} error={error} />;
  }

  return (
    <div className="min-h-screen bg-dark-900">
      <header className="sticky top-0 z-50 bg-dark-950/80 backdrop-blur-xl border-b border-dark-700/50">
        <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-accent" />
            <span className="font-semibold text-dark-100 text-lg hidden sm:block">
              OP Accounts
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-dark-400 text-sm hidden sm:block">
              {user.email}
            </span>
            <button
              onClick={signOut}
              className="text-dark-400 hover:text-dark-200 text-sm px-3 py-1.5 rounded-lg hover:bg-dark-800 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto">
        <Routes>
          <Route path="/" element={<AccountList />} />
          <Route path="/account/:accountId" element={<AccountDashboard />} />
          <Route path="/account/:accountId/success-criteria" element={<SuccessCriteriaPage />} />
          <Route path="/domains" element={<EmailDomainsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
