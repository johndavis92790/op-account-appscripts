import { BarChart3 } from 'lucide-react';

interface LoginPageProps {
  onSignIn: () => void;
  error: string | null;
}

export function LoginPage({ onSignIn, error }: LoginPageProps) {
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <div className="flex flex-col items-center gap-6 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-accent" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-dark-100 mb-2">
              OP Account Dashboard
            </h1>
            <p className="text-dark-400 text-sm">
              Customer success account management
            </p>
          </div>
        </div>

        <button
          onClick={onSignIn}
          className="w-full flex items-center justify-center gap-3 bg-dark-800 hover:bg-dark-700 border border-dark-600 text-dark-100 rounded-xl px-6 py-3.5 font-medium transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <p className="text-dark-500 text-xs text-center mt-6">
          Restricted to authorized ObservePoint accounts
        </p>
      </div>
    </div>
  );
}
