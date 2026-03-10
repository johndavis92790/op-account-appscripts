import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface AppUser {
  email: string;
  displayName: string;
  role: 'admin' | 'editor' | 'viewer';
  createdAt: string;
  lastLogin: string | null;
  createdBy: string;
}

export function useUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: AppUser[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            email: d.id,
            displayName: data.displayName || '',
            role: data.role || 'viewer',
            createdAt: data.createdAt || '',
            lastLogin: data.lastLogin || null,
            createdBy: data.createdBy || '',
          };
        });
        setUsers(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching users:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const addUser = async (
    email: string,
    role: 'admin' | 'editor' | 'viewer',
    createdBy: string
  ) => {
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail.endsWith('@observepoint.com')) {
      throw new Error('Only @observepoint.com emails are allowed');
    }
    const docRef = doc(db, 'users', normalizedEmail);
    await setDoc(docRef, {
      displayName: normalizedEmail.split('@')[0].replace('.', ' '),
      role,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      createdBy,
    });
  };

  const updateUserRole = async (
    email: string,
    role: 'admin' | 'editor' | 'viewer'
  ) => {
    const docRef = doc(db, 'users', email);
    await setDoc(docRef, { role }, { merge: true });
  };

  const removeUser = async (email: string) => {
    const docRef = doc(db, 'users', email);
    await deleteDoc(docRef);
  };

  const updateLastLogin = async (email: string) => {
    const docRef = doc(db, 'users', email);
    await setDoc(
      docRef,
      { lastLogin: new Date().toISOString() },
      { merge: true }
    );
  };

  return { users, loading, error, addUser, updateUserRole, removeUser, updateLastLogin };
}
