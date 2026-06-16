/**
 * Gmail Email Import Function
 * Replaces GmailImport.js
 * Scheduled every 15 minutes to import emails matching account domains
 */

import * as functions from 'firebase-functions';
import { google } from 'googleapis';
import * as firestore from '../firestore';
import { updateImportState, getImportState, getAllEmailDomainMappings } from '../firestore';
import { secrets, appConfig } from '../config';
import type { Email } from '../types';

// =============================================================================
// Gmail Client
// =============================================================================

function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    secrets.GMAIL_CLIENT_ID,
    secrets.GMAIL_CLIENT_SECRET,
    'http://localhost'
  );

  oauth2Client.setCredentials({
    refresh_token: secrets.GMAIL_REFRESH_TOKEN,
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// =============================================================================
// Main Import Function
// =============================================================================

export const importGmailEmails = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async (context) => {
    console.log('=== Starting Gmail Email Import ===');
    const startTime = Date.now();

    try {
      // Load domain mappings
      const mappings = await getAllEmailDomainMappings();
      console.log(`Loaded ${mappings.length} domain mappings`);

      // Build domain to account map
      const domainToAccounts = buildDomainMap(mappings);

      // Get last sync state
      const importState = await getImportState('gmail_emails');
      const lastHistoryId = importState?.checkpoint?.historyId as string | undefined;

      // Fetch emails
      const result = await fetchAndProcessEmails(domainToAccounts, lastHistoryId);

      // Update state
      await updateImportState('gmail_emails', {
        lastSuccessAt: new Date().toISOString(),
        checkpoint: { historyId: result.newHistoryId },
        totalImported: (importState?.totalImported || 0) + result.imported,
      });

      const duration = (Date.now() - startTime) / 1000;
      console.log(`=== Import Complete in ${duration}s ===`);
      console.log(`Emails imported: ${result.imported}`);
      console.log(`Errors: ${result.errors}`);

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('FATAL ERROR in importGmailEmails:', errorMessage);

      await updateImportState('gmail_emails', {
        lastErrorAt: new Date().toISOString(),
        lastErrorMessage: errorMessage,
      });

      throw error;
    }
  });

// =============================================================================
// Email Processing
// =============================================================================

interface ImportResult {
  imported: number;
  errors: number;
  newHistoryId?: string;
}

function buildDomainMap(mappings: Awaited<ReturnType<typeof getAllEmailDomainMappings>>): Map<string, string> {
  const map = new Map<string, string>();

  for (const mapping of mappings) {
    for (const domain of mapping.emailDomains) {
      map.set(domain.toLowerCase(), mapping.accountId);
    }
  }

  return map;
}

async function fetchAndProcessEmails(
  domainToAccounts: Map<string, string>,
  lastHistoryId?: string
): Promise<ImportResult> {
  const gmail = getGmailClient();
  const result: ImportResult = { imported: 0, errors: 0 };

  // Search for recent emails
  // Query: emails from last 24 hours that aren't from internal domain
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 1);
  const sinceQuery = sinceDate.toISOString().split('T')[0].replace(/-/g, '/');

  const searchQuery = `after:${sinceQuery} -from:${appConfig.INTERNAL_DOMAIN}`;

  console.log(`Searching: ${searchQuery}`);

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: searchQuery,
    maxResults: appConfig.EMAIL_IMPORT_LIMIT,
  });

  const messages = response.data.messages || [];
  console.log(`Found ${messages.length} messages to process`);

  for (const message of messages) {
    if (!message.id) continue;

    try {
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full',
      });

      const email = parseEmailFromMessage(fullMessage.data, domainToAccounts);
      if (email) {
        await firestore.upsertEmail(email.accountId, email);
        result.imported++;
        console.log(`✓ Imported email: ${email.subject.substring(0, 50)}...`);
      }
    } catch (error) {
      result.errors++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown';
      console.error(`ERROR processing message ${message.id}: ${errorMsg}`);
    }
  }

  // Store history ID for incremental sync (if implementing history API)
  // For now, we use date-based search
  result.newHistoryId = response.data.nextPageToken || undefined;

  return result;
}

// =============================================================================
// Email Parsing
// =============================================================================

function parseEmailFromMessage(
  message: any,
  domainToAccounts: Map<string, string>
): Email | null {
  const headers = message.payload?.headers || [];

  const messageId = message.id;
  const threadId = message.threadId;
  const date = getHeader(headers, 'Date');
  const from = getHeader(headers, 'From');
  const to = getHeader(headers, 'To');
  const subject = getHeader(headers, 'Subject') || '(no subject)';

  // Extract sender domain
  const fromDomain = extractDomain(from);
  if (!fromDomain) return null;

  // Check if sender domain matches an account
  const accountId = domainToAccounts.get(fromDomain.toLowerCase());
  if (!accountId) {
    // Also check recipient domain for outbound emails
    const toDomain = extractDomain(to);
    if (toDomain) {
      const outboundAccountId = domainToAccounts.get(toDomain.toLowerCase());
      if (outboundAccountId) {
        // This is an outbound email (we sent it)
        return buildEmail(messageId, threadId, date, from, to, subject, toDomain, outboundAccountId, true);
      }
    }
    return null;
  }

  // Inbound email
  return buildEmail(messageId, threadId, date, from, to, subject, fromDomain, accountId, false);
}

function getHeader(headers: any[], name: string): string {
  const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

function extractDomain(email: string): string | null {
  const match = email.match(/<([^>]+)>/);
  const emailAddress = match ? match[1] : email;
  const domainMatch = emailAddress.match(/@([^@]+)$/);
  return domainMatch ? domainMatch[1].toLowerCase() : null;
}

function buildEmail(
  messageId: string,
  threadId: string,
  date: string,
  from: string,
  to: string,
  subject: string,
  fromDomain: string,
  accountId: string,
  isOutbound: boolean
): Email {
  // Extract body preview
  const bodyPreview = ''; // Would need to decode message parts - simplified for now

  // Parse date
  let parsedDate: string;
  try {
    parsedDate = new Date(date).toISOString();
  } catch {
    parsedDate = new Date().toISOString();
  }

  return {
    messageId,
    threadId: threadId || messageId,
    date: parsedDate,
    from: from.substring(0, 200),
    fromDomain,
    to: to.substring(0, 200),
    subject: subject.substring(0, 500),
    bodyPreview: bodyPreview.substring(0, 300),
    isOutbound,
    accountId,
    accountName: '', // Will be resolved on read
    importedAt: new Date().toISOString(),
  };
}
