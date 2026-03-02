import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Account } from '../types';

export function useAccount(accountId: string | undefined) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'accounts', accountId);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const d = snapshot.data();
          setAccount({
            accountId: snapshot.id,
            accountName: d.accountName || '',
            autoRenewal: d.autoRenewal || '',
            renewalDate: d.renewalDate || null,
            renewable: d.renewable ?? 0,
            forcast: d.forcast ?? 0,
            status: d.status || '',
            stage: d.stage || '',
            loginScore: d.loginScore ?? 0,
            auditUsage: d.auditUsage ?? 0,
            journeyUsage: d.journeyUsage ?? 0,
            forecast: d.forecast || '',
            csm: d.csm || '',
            ae: d.ae || '',
            engagementScore: d.engagementScore ?? 0,
            daysSinceLastContact: d.daysSinceLastContact ?? null,
            lastEmailDate: d.lastEmailDate || null,
            avgMeetingAttendancePct: d.avgMeetingAttendancePct ?? 0,
            lastMeetingDate: d.lastMeetingDate || null,
            nextMeetingDate: d.nextMeetingDate || null,
            emailCountTotal: d.emailCountTotal ?? 0,
            emailsSent: d.emailsSent ?? 0,
            emailsReceived: d.emailsReceived ?? 0,
            emailCount30d: d.emailCount30d ?? 0,
            emailCount90d: d.emailCount90d ?? 0,
            meetingsPast: d.meetingsPast ?? 0,
            meetingsFuture: d.meetingsFuture ?? 0,
            meetings30d: d.meetings30d ?? 0,
            githubTasksTotal: d.githubTasksTotal ?? 0,
            githubTasksOpen: d.githubTasksOpen ?? 0,
            githubTasksClosed: d.githubTasksClosed ?? 0,
            meetingRecapsCount: d.meetingRecapsCount ?? 0,
            actionItemsCount: d.actionItemsCount ?? 0,
            tasks: d.tasks || [],
            emails: d.emails || [],
            meetings: d.meetings || [],
            meetingRecaps: d.meetingRecaps || [],
            notes: d.notes || { content: '', lastSaved: null },
            manualTasks: d.manualTasks || [],
            lastSynced: d.lastSynced || '',
          } as Account);
        } else {
          setAccount(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching account:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [accountId]);

  const updateNotes = async (content: string) => {
    if (!accountId) return;
    const docRef = doc(db, 'accounts', accountId);
    await updateDoc(docRef, {
      'notes.content': content,
      'notes.lastSaved': new Date().toISOString(),
      'notes.source': 'webapp',
    });
  };

  return { account, loading, error, updateNotes };
}
