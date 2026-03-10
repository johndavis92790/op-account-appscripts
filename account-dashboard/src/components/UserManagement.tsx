import { useState } from 'react';
import { useUsers } from '../hooks/useUsers';
import type { AppUser } from '../hooks/useUsers';
import {
  Users,
  UserPlus,
  Trash2,
  Shield,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UserManagementProps {
  currentUserEmail: string;
}

export function UserManagement({ currentUserEmail }: UserManagementProps) {
  const navigate = useNavigate();
  const { users, loading, error, addUser, updateUserRole, removeUser } = useUsers();
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'editor' | 'viewer'>('viewer');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const currentUser = users.find((u) => u.email === currentUserEmail);
  const isAdmin = currentUser?.role === 'admin';

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    setAddError(null);
    setAddSuccess(false);
    try {
      await addUser(newEmail, newRole, currentUserEmail);
      setNewEmail('');
      setNewRole('viewer');
      setAddSuccess(true);
      setTimeout(() => setAddSuccess(false), 3000);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (email: string) => {
    if (email === currentUserEmail) return;
    if (!confirm(`Remove ${email} from the app?`)) return;
    setRemoving(email);
    try {
      await removeUser(email);
    } catch (err) {
      console.error('Failed to remove user:', err);
    } finally {
      setRemoving(null);
    }
  };

  const handleRoleChange = async (email: string, role: 'admin' | 'editor' | 'viewer') => {
    try {
      await updateUserRole(email, role);
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-red-500/10 text-red-400 border-red-500/20',
    editor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    viewer: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-dark-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-dark-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            User Management
          </h1>
          <p className="text-dark-400 text-sm mt-0.5">
            Manage who can access this dashboard. Only @observepoint.com accounts allowed.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Add User Form */}
      {isAdmin && (
        <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl p-4 mb-6">
          <h2 className="text-sm font-semibold text-dark-200 flex items-center gap-2 mb-3">
            <UserPlus className="w-4 h-4 text-accent" />
            Add User
          </h2>
          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="name@observepoint.com"
              className="flex-1 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent/50"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'admin' | 'editor' | 'viewer')}
              className="bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-xs text-dark-200 focus:outline-none focus:border-accent/50"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={handleAdd}
              disabled={adding || !newEmail.trim()}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Add
            </button>
          </div>
          {addError && (
            <p className="mt-2 text-red-400 text-xs flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {addError}
            </p>
          )}
          {addSuccess && (
            <p className="mt-2 text-emerald-400 text-xs flex items-center gap-1">
              <Check className="w-3 h-3" /> User added successfully
            </p>
          )}
        </div>
      )}

      {/* Users List */}
      <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-dark-700/50">
          <h2 className="text-sm font-semibold text-dark-200 flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            Authorized Users
            <span className="text-dark-500 font-normal">{users.length}</span>
          </h2>
        </div>

        {users.length === 0 && (
          <div className="px-4 py-8 text-center text-dark-500 text-sm">
            No users configured yet. Add yourself as admin to get started.
          </div>
        )}

        <div className="divide-y divide-dark-700/30">
          {users.map((user: AppUser) => (
            <div
              key={user.email}
              className="px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-sm text-dark-100 font-medium truncate">
                  {user.email}
                  {user.email === currentUserEmail && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                      You
                    </span>
                  )}
                </div>
                <div className="text-xs text-dark-500 mt-0.5">
                  Added {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                  {user.lastLogin && (
                    <> · Last login {new Date(user.lastLogin).toLocaleDateString()}</>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isAdmin && user.email !== currentUserEmail ? (
                  <select
                    value={user.role}
                    onChange={(e) =>
                      handleRoleChange(
                        user.email,
                        e.target.value as 'admin' | 'editor' | 'viewer'
                      )
                    }
                    className="bg-dark-800 border border-dark-700 rounded-lg px-2 py-1 text-xs text-dark-200 focus:outline-none focus:border-accent/50"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                      roleColors[user.role] || roleColors.viewer
                    }`}
                  >
                    {user.role}
                  </span>
                )}

                {isAdmin && user.email !== currentUserEmail && (
                  <button
                    onClick={() => handleRemove(user.email)}
                    disabled={removing === user.email}
                    className="p-1.5 rounded text-dark-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    title="Remove user"
                  >
                    {removing === user.email ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role descriptions */}
      <div className="mt-6 bg-dark-800/30 border border-dark-700/30 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">
          Role Permissions
        </h3>
        <div className="space-y-1.5 text-xs text-dark-500">
          <div>
            <span className="text-red-400 font-medium">Admin</span> — Full access. Can manage users, edit all data, and change settings.
          </div>
          <div>
            <span className="text-blue-400 font-medium">Editor</span> — Can view and edit account data, notes, and tasks.
          </div>
          <div>
            <span className="text-emerald-400 font-medium">Viewer</span> — Read-only access to all account data.
          </div>
        </div>
      </div>
    </div>
  );
}
