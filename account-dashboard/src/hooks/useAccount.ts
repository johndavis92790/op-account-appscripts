import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Account, AccountContact } from '../types';

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
            salesEngineer: d.salesEngineer || '',
            fiscalQuarter: d.fiscalQuarter || '',
            fiscalYear: d.fiscalYear || '',
            pricePerPage: d.pricePerPage ?? 0,
            linkToOpp: d.linkToOpp || '',
            linkToAccount: d.linkToAccount || '',
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
            successCriteria: d.successCriteria || { content: '', lastSaved: null },
            contacts: d.contacts || [],
            manualTasks: d.manualTasks || [],
            meetingCadence: d.meetingCadence || '',
            emailDomains: d.emailDomains || '',
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

  const updateSuccessCriteria = async (content: string) => {
    if (!accountId) return;
    const docRef = doc(db, 'accounts', accountId);
    await updateDoc(docRef, {
      'successCriteria.content': content,
      'successCriteria.lastSaved': new Date().toISOString(),
      'successCriteria.source': 'webapp',
    });
  };

  const updateContactNotes = async (contactEmail: string, notes: string) => {
    if (!accountId || !account) return;
    const updatedContacts = (account.contacts || []).map((c: AccountContact) =>
      c.email === contactEmail ? { ...c, notes, lastUpdated: new Date().toISOString() } : c
    );
    const docRef = doc(db, 'accounts', accountId);
    await updateDoc(docRef, {
      contacts: updatedContacts,
      'contactsSource': 'webapp',
    });
  };

  const updateEmailDomains = async (domains: string) => {
    if (!accountId) return;
    const docRef = doc(db, 'accounts', accountId);
    await updateDoc(docRef, {
      emailDomains: domains,
      emailDomainsSource: 'webapp',
      emailDomainsLastSaved: new Date().toISOString(),
    });
  };

  return { account, loading, error, updateNotes, updateSuccessCriteria, updateContactNotes, updateEmailDomains };
}
