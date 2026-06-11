import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import type { AccountListItem } from '../types';

export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'accounts'), orderBy('renewalDate', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: AccountListItem[] = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            accountId: doc.id,
            accountName: d.accountName || '',
            status: d.status || '',
            stage: d.stage || '',
            engagementScore: d.engagementScore ?? 0,
            renewalDate: d.renewalDate || null,
            daysSinceLastContact: d.daysSinceLastContact ?? null,
            nextMeetingDate: d.nextMeetingDate || null,
            forecast: d.forecast || '',
            csm: d.csm || '',
            ae: d.ae || '',
            githubTasksOpen: d.githubTasksOpen ?? 0,
            renewable: d.renewable ?? 0,
            loginScore: d.loginScore ?? 0,
            auditUsage: d.auditUsage ?? 0,
            journeyUsage: d.journeyUsage ?? 0,
            meetingsFuture: d.meetingsFuture ?? 0,
            meetingCadence: d.meetingCadence || '',
            lastMeetingDate: d.lastMeetingDate || null,
            fiscalQuarter: d.fiscalQuarter || '',
            fiscalYear: d.fiscalYear || '',
            pricePerPage: d.pricePerPage ?? 0,
            salesEngineer: d.salesEngineer || '',
            emailDomains: d.emailDomains || '',
            // Default to true so docs synced before this field existed still appear.
            // The next sync run will explicitly stamp isActive on all docs.
            isActive: d.isActive !== false,
            deactivatedAt: d.deactivatedAt || null,
          };
        });
        setAccounts(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching accounts:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { accounts, loading, error };
}
