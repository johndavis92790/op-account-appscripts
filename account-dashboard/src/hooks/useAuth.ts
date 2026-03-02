import { useState, useEffect } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

const ALLOWED_EMAIL = 'john.davis@observepoint.com';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email !== ALLOWED_EMAIL) {
        firebaseSignOut(auth);
        setState({
          user: null,
          loading: false,
          error: `Access denied. Only ${ALLOWED_EMAIL} can use this app.`,
        });
        return;
      }
      setState({ user, loading: false, error: null });
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user.email !== ALLOWED_EMAIL) {
        await firebaseSignOut(auth);
        setState({
          user: null,
          loading: false,
          error: `Access denied. Only ${ALLOWED_EMAIL} can use this app.`,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return { ...state, signIn, signOut };
}
