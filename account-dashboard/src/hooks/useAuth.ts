import { useState, useEffect } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';

const ALLOWED_DOMAIN = 'observepoint.com';
const BOOTSTRAP_ADMIN = 'john.davis@observepoint.com';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  role: 'admin' | 'editor' | 'viewer' | null;
}

async function checkUserAuthorized(email: string): Promise<{ authorized: boolean; role: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Must be @observepoint.com
  if (!normalizedEmail.endsWith(`@${ALLOWED_DOMAIN}`)) {
    return { authorized: false, role: '' };
  }
  
  // Check if user exists in Firestore users collection
  const userDoc = await getDoc(doc(db, 'users', normalizedEmail));
  
  if (userDoc.exists()) {
    return { authorized: true, role: userDoc.data().role || 'viewer' };
  }
  
  // Bootstrap: if this is the known admin and no user doc exists, auto-create
  if (normalizedEmail === BOOTSTRAP_ADMIN) {
    await setDoc(doc(db, 'users', normalizedEmail), {
      displayName: 'John Davis',
      role: 'admin',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      createdBy: 'system',
    });
    return { authorized: true, role: 'admin' };
  }
  
  return { authorized: false, role: '' };
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    role: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || !user.email) {
        setState({ user: null, loading: false, error: null, role: null });
        return;
      }
      
      try {
        const { authorized, role } = await checkUserAuthorized(user.email);
        if (!authorized) {
          await firebaseSignOut(auth);
          setState({
            user: null,
            loading: false,
            error: `Access denied. ${user.email} is not authorized. Contact an admin to get access.`,
            role: null,
          });
          return;
        }
        
        // Update last login
        const normalizedEmail = user.email.toLowerCase().trim();
        await setDoc(
          doc(db, 'users', normalizedEmail),
          { lastLogin: new Date().toISOString() },
          { merge: true }
        );
        
        setState({
          user,
          loading: false,
          error: null,
          role: role as 'admin' | 'editor' | 'viewer',
        });
      } catch (err) {
        console.error('Auth check failed:', err);
        setState({
          user,
          loading: false,
          error: null,
          role: 'viewer',
        });
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      await signInWithPopup(auth, googleProvider);
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
