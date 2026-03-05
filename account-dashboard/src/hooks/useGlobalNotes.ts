import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { GlobalNotes } from '../types';

const GLOBAL_NOTES_DOC = 'global_notes';

export function useGlobalNotes() {
  const [globalNotes, setGlobalNotes] = useState<GlobalNotes>({ content: '', lastSaved: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'settings', GLOBAL_NOTES_DOC);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const d = snapshot.data();
          setGlobalNotes({
            content: d.content || '',
            lastSaved: d.lastSaved || null,
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching global notes:', err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const updateGlobalNotes = async (content: string) => {
    const docRef = doc(db, 'settings', GLOBAL_NOTES_DOC);
    const data = {
      content,
      lastSaved: new Date().toISOString(),
      source: 'webapp',
    };
    try {
      await updateDoc(docRef, data);
    } catch {
      // Document may not exist yet, create it
      await setDoc(docRef, data);
    }
  };

  return { globalNotes, loading, updateGlobalNotes };
}
