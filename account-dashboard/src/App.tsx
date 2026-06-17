import { Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AccountList } from './components/AccountList';
import { AccountDashboard } from './components/AccountDashboard';
import { SuccessCriteriaPage } from './components/SuccessCriteriaPage';
import { EmailDomainsPage } from './components/EmailDomainsPage';
import { UserManagement } from './components/UserManagement';
import { LoginPage } from './components/LoginPage';
import { TasksPage } from './components/tasks/TasksPage';
import { BarChart3, Shield, ListChecks } from 'lucide-react';

function AdminUsersLink() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/admin/users')}
      className="flex items-center gap-1.5 text-dark-400 hover:text-dark-200 text-sm px-3 py-1.5 rounded-lg hover:bg-dark-800 transition-colors"
      title="User Management"
    >
      <Shield className="w-4 h-4" />
      <span className="hidden sm:inline">Users</span>
    </button>
  );
}

function TasksLink() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname.startsWith('/tasks');
  return (
    <button
      onClick={() => navigate('/tasks')}
      className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
        active
          ? 'text-accent bg-accent/10'
          : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
      }`}
      title="Tasks"
    >
      <ListChecks className="w-4 h-4" />
      <span className="hidden sm:inline">Tasks</span>
    </button>
  );
}

export default function App() {
  const { user, loading, error, role, signIn, signOut } = useAuth();

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
        <div className="w-full px-4 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-3 group"
            title="Back to all accounts"
          >
            <BarChart3 className="w-6 h-6 text-accent group-hover:text-accent-hover transition-colors" />
            <span className="font-semibold text-dark-100 text-lg hidden sm:block group-hover:text-accent transition-colors">
              OP Accounts
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <TasksLink />
            {role === 'admin' && (
              <AdminUsersLink />
            )}
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

      <main className="w-full">
        <Routes>
          <Route path="/" element={<AccountList />} />
          <Route path="/account/:accountId" element={<AccountDashboard />} />
          <Route path="/account/:accountId/success-criteria" element={<SuccessCriteriaPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/domains" element={<EmailDomainsPage />} />
          <Route path="/admin/users" element={<UserManagement currentUserEmail={user.email || ''} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
