/**
 * Email Domain Auto-Sync Function
 * 
 * Scheduled daily to auto-populate email domains from account contacts.
 * - Extracts unique domains from all contact email addresses
 * - Respects emailDomainsExcluded (won't re-add excluded domains)
 * - Merges with emailDomainsManual (manual takes precedence)
 * - Updates emailDomainsAuto and final emailDomains field
 * 
 * Schedule: Daily at 2:30 AM (after CSV imports at 2 AM)
 */

import * as functions from 'firebase-functions';
import { db, getContactsForAccount } from '../firestore';
import { collections } from '../config';
import type { Account } from '../types';

// =============================================================================
// Scheduled Function
// =============================================================================

export const syncEmailDomainsFromContacts = functions.pubsub
  .schedule('30 2 * * *') // Daily at 2:30 AM (after CSV imports at 2 AM)
  .timeZone('America/Denver')
  .onRun(async (context) => {
    console.log('=== Starting Email Domain Auto-Sync from Contacts ===');
    const startTime = Date.now();

    try {
      const results = await processAllAccounts();

      const duration = (Date.now() - startTime) / 1000;
      console.log(`=== Email Domain Auto-Sync Complete in ${duration}s ===`);
      console.log(`Accounts processed: ${results.processed}`);
      console.log(`Accounts updated: ${results.updated}`);
      console.log(`Errors: ${results.errors}`);

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('FATAL ERROR in syncEmailDomainsFromContacts:', errorMessage);
      throw error;
    }
  });

// =============================================================================
// Processing Logic
// =============================================================================

interface SyncResult {
  processed: number;
  updated: number;
  errors: number;
  details: Array<{
    accountId: string;
    accountName: string;
    action: 'updated' | 'unchanged' | 'error';
    manualCount: number;
    autoCount: number;
    excludedCount: number;
    message?: string;
  }>;
}

async function processAllAccounts(): Promise<SyncResult> {
  const result: SyncResult = {
    processed: 0,
    updated: 0,
    errors: 0,
    details: [],
  };

  // Get all accounts with their contacts
  const accountsSnapshot = await db.collection(collections.ACCOUNTS).get();
  console.log(`Found ${accountsSnapshot.size} accounts to process`);

  for (const doc of accountsSnapshot.docs) {
    const account = { accountId: doc.id, ...doc.data() } as Account;
    
    try {
      const updateResult = await processAccount(account);
      
      result.processed++;
      
      if (updateResult.updated) {
        result.updated++;
      }
      
      result.details.push({
        accountId: account.accountId,
        accountName: account.accountName,
        action: updateResult.updated ? 'updated' : 'unchanged',
        manualCount: updateResult.manualCount,
        autoCount: updateResult.autoCount,
        excludedCount: updateResult.excludedCount,
      });

      // Small delay to avoid rate limiting
      if (result.processed % 10 === 0) {
        await delay(100);
      }
    } catch (error) {
      result.processed++;
      result.errors++;
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error processing account ${account.accountId}:`, errorMessage);
      
      result.details.push({
        accountId: account.accountId,
        accountName: account.accountName,
        action: 'error',
        manualCount: 0,
        autoCount: 0,
        excludedCount: 0,
        message: errorMessage,
      });
    }
  }

  return result;
}

interface AccountProcessResult {
  updated: boolean;
  manualCount: number;
  autoCount: number;
  excludedCount: number;
}

async function processAccount(account: Account): Promise<AccountProcessResult> {
  // Fetch contacts from subcollection
  const contacts = await getContactsForAccount(account.accountId);
  
  if (contacts.length === 0) {
    return {
      updated: false,
      manualCount: 0,
      autoCount: 0,
      excludedCount: 0,
    };
  }

  // Get existing domain lists
  const manualDomains = parseDomainList(account.emailDomainsManual || '');
  const excludedDomains = parseDomainList(account.emailDomainsExcluded || '');
  const existingAutoDomains = parseDomainList(account.emailDomainsAuto || '');

  // Extract domains from contact emails
  const autoDomains = new Set<string>();
  for (const contact of contacts) {
    const domain = extractDomainFromEmail(contact.email);
    if (domain && !isGenericDomain(domain)) {
      autoDomains.add(domain);
    }
  }

  // Remove excluded domains from auto list
  for (const excluded of excludedDomains) {
    autoDomains.delete(excluded);
  }

  // Remove manual domains from auto list (manual takes precedence)
  for (const manual of manualDomains) {
    autoDomains.delete(manual);
  }

  // Build final merged list: manual + auto (sorted alphabetically)
  const finalDomains = [...Array.from(manualDomains).sort(), ...Array.from(autoDomains).sort()];

  // Check if anything changed
  const currentAutoStr = Array.from(autoDomains).sort().join(', ');
  const currentFinalStr = finalDomains.join(', ');
  const existingAutoStr = Array.from(existingAutoDomains).sort().join(', ');
  const existingFinalStr = account.emailDomains || '';

  const hasChanges = currentAutoStr !== existingAutoStr || currentFinalStr !== existingFinalStr;

  if (hasChanges) {
    // Update Firestore
    await db.collection(collections.ACCOUNTS).doc(account.accountId).update({
      emailDomainsAuto: currentAutoStr,
      emailDomains: currentFinalStr,
      emailDomainsLastAutoSync: new Date().toISOString(),
    });

    console.log(`✓ Updated ${account.accountName}: ${finalDomains.length} total (${manualDomains.size} manual, ${autoDomains.size} auto)`);

    return {
      updated: true,
      manualCount: manualDomains.size,
      autoCount: autoDomains.size,
      excludedCount: excludedDomains.size,
    };
  }

  return {
    updated: false,
    manualCount: manualDomains.size,
    autoCount: autoDomains.size,
    excludedCount: excludedDomains.size,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

function extractDomainFromEmail(email: string): string | null {
  if (!email || typeof email !== 'string') return null;
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1 || atIndex === email.length - 1) return null;
  return email.substring(atIndex + 1).toLowerCase().trim();
}

function isGenericDomain(domain: string): boolean {
  if (!domain) return true;
  const genericDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'me.com', 'mac.com', 'live.com', 'msn.com',
    'protonmail.com', 'zoho.com', 'yandex.com', 'mail.com',
    'observepoint.com', // Internal domain
  ];
  return genericDomains.includes(domain.toLowerCase());
}

function parseDomainList(str: string): Set<string> {
  if (!str || typeof str !== 'string') return new Set();
  return new Set(
    str.split(',')
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 0)
  );
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// HTTP Function for Manual Trigger (for testing/ad-hoc runs)
// =============================================================================

export const syncEmailDomainsManual = functions.https.onRequest(async (req, res) => {
  // Simple auth check - require a secret key in header or query param
  const authKey = req.headers['x-auth-key'] || req.query.key;
  const expectedKey = process.env.MANUAL_SYNC_KEY || 'dev-key';
  
  if (authKey !== expectedKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  console.log('=== Manual Email Domain Sync Triggered ===');
  
  try {
    const results = await processAllAccounts();
    
    res.json({
      success: true,
      processed: results.processed,
      updated: results.updated,
      errors: results.errors,
      details: results.details,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in manual sync:', errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});
