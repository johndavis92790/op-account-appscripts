/**
 * CSV Import Function
 * Replaces EmailToSheet.js importLatestCSV()
 * Scheduled daily to import Domo CSVs from Gmail
 */

import * as functions from 'firebase-functions';
import { google } from 'googleapis';
import { parse } from 'csv-parse/sync';
import * as firestore from '../firestore';
import { updateImportState } from '../firestore';
import { secrets, appConfig } from '../config';
import type { Account, DomoRenewalRow } from '../types';

// =============================================================================
// Gmail Client Setup (OAuth 2.0)
// =============================================================================

function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    secrets.GMAIL_CLIENT_ID,
    secrets.GMAIL_CLIENT_SECRET,
    'http://localhost' // Redirect URL - not used for refresh token flow
  );

  // Use refresh token to get access token
  oauth2Client.setCredentials({
    refresh_token: secrets.GMAIL_REFRESH_TOKEN,
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// =============================================================================
// Main Import Function
// =============================================================================

export const importDomoCSVs = functions.pubsub
  .schedule('0 2 * * *') // Daily at 2 AM
  .timeZone('America/Denver')
  .onRun(async (context) => {
    console.log('=== Starting Domo CSV Import ===');
    const startTime = Date.now();

    try {
      const results = await importRenewalOpportunities();

      const duration = (Date.now() - startTime) / 1000;
      console.log(`=== Import Complete in ${duration}s ===`);
      console.log(`Accounts imported: ${results.imported}`);
      console.log(`Errors: ${results.errors}`);

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('FATAL ERROR in importDomoCSVs:', errorMessage);
      throw error;
    }
  });

// =============================================================================
// Import Logic
// =============================================================================

interface ImportResult {
  imported: number;
  errors: number;
  accounts: string[];
}

async function importRenewalOpportunities(): Promise<ImportResult> {
  const gmail = getGmailClient();
  const result: ImportResult = { imported: 0, errors: 0, accounts: [] };

  // Search for emails with CSV attachments
  console.log('Searching Gmail for CSV attachments...');
  const searchQuery = appConfig.DOMO_CSV_SEARCH_QUERY;

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: searchQuery,
    maxResults: 10,
  });

  const messages = response.data.messages || [];
  console.log(`Found ${messages.length} messages matching query`);

  if (messages.length === 0) {
    console.log('No CSV emails found');
    return result;
  }

  // Get the most recent message
  const latestMessage = await gmail.users.messages.get({
    userId: 'me',
    id: messages[0].id!,
    format: 'full',
  });

  // Find CSV attachment
  const parts = latestMessage.data.payload?.parts || [];
  const csvAttachment = parts.find(
    (part) => part.filename?.toLowerCase().endsWith('.csv')
  );

  if (!csvAttachment || !csvAttachment.body?.attachmentId) {
    console.log('No CSV attachment found in latest message');
    return result;
  }

  console.log(`Found attachment: ${csvAttachment.filename}`);

  // Download attachment
  const attachment = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId: messages[0].id!,
    id: csvAttachment.body.attachmentId,
  });

  if (!attachment.data.data) {
    console.log('Attachment data is empty');
    return result;
  }

  // Decode base64 (url-safe variant used by Gmail API)
  const csvContent = Buffer.from(attachment.data.data, 'base64').toString('utf-8');
  console.log(`CSV content length: ${csvContent.length} chars`);

  // Parse CSV
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as DomoRenewalRow[];

  console.log(`Parsed ${records.length} rows from CSV`);

  // Process each row
  const activeAccountIds = new Set<string>();

  for (const row of records) {
    try {
      const account = parseAccountFromRow(row);
      const accountId = account.accountId || '';
      const accountName = account.accountName || '';
      
      if (!accountId) {
        console.warn(`Skipping row - no account ID: ${accountName}`);
        continue;
      }

      await firestore.upsertAccount(accountId, account);
      activeAccountIds.add(accountId);

      // Upsert email domain mapping
      const domains = extractDomainsFromAccount(account);
      if (domains.length > 0) {
        await firestore.upsertEmailDomainMapping({
          accountId: accountId,
          accountName: accountName,
          emailDomains: domains,
          lastUpdated: new Date().toISOString(),
        });
      }

      result.imported++;
      result.accounts.push(accountName);
      console.log(`✓ Imported: ${accountName} (${accountId})`);
    } catch (rowError) {
      result.errors++;
      const errorMsg = rowError instanceof Error ? rowError.message : 'Unknown';
      console.error(`ERROR processing row: ${errorMsg}`);
    }
  }

  // Deactivate accounts not in the active set
  await deactivateMissingAccounts(activeAccountIds);

  // Update import state
  await updateImportState('domo_csv', {
    lastSuccessAt: new Date().toISOString(),
    lastErrorAt: null,
    lastErrorMessage: null,
    totalImported: result.imported,
  });

  return result;
}

// =============================================================================
// Account Parsing
// =============================================================================

function parseAccountFromRow(row: DomoRenewalRow): Partial<Account> {
  const accountId = row['Account ID'] || row['Id'] || '';
  const accountName = row['Account Name'] || '';

  return {
    accountId,
    accountName,
    autoRenewal: row['Auto Renewal'] || '',
    renewalDate: parseDate(row['Renewal Date']),
    renewable: toNum(row['Renewable ARR']),
    forcast: 0,
    status: row['Status'] || '',
    stage: row['Stage'] || '',
    loginScore: 0,
    auditUsage: 0,
    journeyUsage: 0,
    forecast: '',
    csm: row['Customer Success Manager'] || '',
    ae: row['Account Executive'] || '',
    salesEngineer: row['Sales Engineer'] || '',
    fiscalQuarter: row['Fiscal Quarter'] || '',
    fiscalYear: row['Fiscal Year'] || '',
    pricePerPage: toNum(row['Price Per Page']),
    linkToOpp: row['Link to Opp'] || '',
    linkToAccount: row['Link to Account'] || '',
    engagementScore: 0,
    daysSinceLastContact: null,
    lastEmailDate: null,
    avgMeetingAttendancePct: 0,
    lastMeetingDate: null,
    nextMeetingDate: null,
    emailCountTotal: 0,
    emailsSent: 0,
    emailsReceived: 0,
    emailCount30d: 0,
    emailCount90d: 0,
    meetingsPast: 0,
    meetingsFuture: 0,
    meetings30d: 0,
    githubTasksTotal: 0,
    githubTasksOpen: 0,
    githubTasksClosed: 0,
    meetingRecapsCount: 0,
    actionItemsCount: 0,
    meetingCadence: '',
    emailDomains: '',
    isActive: true,
    deactivatedAt: null,
    lastImported: new Date().toISOString(),
    importSource: 'domo_csv',
  };
}

function parseDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toNum(value: string | number | undefined): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return value;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

function extractDomainsFromAccount(account: Partial<Account>): string[] {
  // Extract domains from account name or other fields
  // This is a simplified version - you may want to customize this
  const domains: string[] = [];

  // Example: extract domain from account name
  const accountName = account.accountName || '';
  const domainMatch = accountName.match(/@([^.]+\.[^.]+)$/);
  if (domainMatch) {
    domains.push(domainMatch[1].toLowerCase());
  }

  return domains;
}

// =============================================================================
// Account Cleanup
// =============================================================================

async function deactivateMissingAccounts(activeIds: Set<string>): Promise<number> {
  const allAccounts = await firestore.getAllActiveAccounts();
  let deactivated = 0;

  for (const account of allAccounts) {
    if (!activeIds.has(account.accountId)) {
      await firestore.deactivateAccount(account.accountId);
      deactivated++;
      console.log(`Deactivated account: ${account.accountName} (${account.accountId})`);
    }
  }

  if (deactivated > 0) {
    console.log(`Deactivated ${deactivated} accounts not in CSV`);
  }

  return deactivated;
}
