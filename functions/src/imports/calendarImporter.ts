/**
 * Calendar Import Function
 * Replaces CalendarImport.js
 * Scheduled every 15 minutes to import calendar events
 */

import * as functions from 'firebase-functions';
import { google } from 'googleapis';
import * as firestore from '../firestore';
import { updateImportState, getImportState, getAllEmailDomainMappings } from '../firestore';
import { secrets, appConfig } from '../config';
import type { CalendarEvent } from '../types';

// =============================================================================
// Calendar Client
// =============================================================================

function getCalendarClient() {
  const oauth2Client = new google.auth.OAuth2(
    secrets.GMAIL_CLIENT_ID,
    secrets.GMAIL_CLIENT_SECRET,
    'http://localhost'
  );

  oauth2Client.setCredentials({
    refresh_token: secrets.CALENDAR_REFRESH_TOKEN || secrets.GMAIL_REFRESH_TOKEN,
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// =============================================================================
// Main Import Function
// =============================================================================

export const importCalendarEvents = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async (context) => {
    console.log('=== Starting Calendar Import ===');
    const startTime = Date.now();

    try {
      // Load domain mappings
      const mappings = await getAllEmailDomainMappings();
      console.log(`Loaded ${mappings.length} domain mappings`);

      // Build domain to account map
      const domainToAccounts = buildDomainMap(mappings);

      // Fetch events
      const result = await fetchAndProcessEvents(domainToAccounts);

      // Update state
      const importState = await getImportState('calendar_events');
      await updateImportState('calendar_events', {
        lastSuccessAt: new Date().toISOString(),
        totalImported: (importState?.totalImported || 0) + result.imported,
      });

      const duration = (Date.now() - startTime) / 1000;
      console.log(`=== Import Complete in ${duration}s ===`);
      console.log(`Events imported: ${result.imported}`);
      console.log(`Errors: ${result.errors}`);

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('FATAL ERROR in importCalendarEvents:', errorMessage);

      await updateImportState('calendar_events', {
        lastErrorAt: new Date().toISOString(),
        lastErrorMessage: errorMessage,
      });

      throw error;
    }
  });

// =============================================================================
// Event Processing
// =============================================================================

interface ImportResult {
  imported: number;
  errors: number;
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

async function fetchAndProcessEvents(
  domainToAccounts: Map<string, string>
): Promise<ImportResult> {
  const calendar = getCalendarClient();
  const result: ImportResult = { imported: 0, errors: 0 };

  // Calculate date range
  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - appConfig.CALENDAR_IMPORT_DAYS_PAST);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + appConfig.CALENDAR_IMPORT_DAYS_FUTURE);

  console.log(`Fetching events from ${timeMin.toISOString()} to ${timeMax.toISOString()}`);

  // Fetch events
  const response = await calendar.events.list({
    calendarId: appConfig.CALENDAR_ID,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  });

  const events = response.data.items || [];
  console.log(`Found ${events.length} events`);

  for (const event of events) {
    if (!event.id) continue;

    try {
      const calendarEvent = parseEventFromGoogleEvent(event, domainToAccounts);
      if (calendarEvent) {
        await firestore.upsertCalendarEvent(calendarEvent.accountId, calendarEvent);
        result.imported++;
        console.log(`✓ Imported event: ${calendarEvent.title.substring(0, 50)}...`);
      }
    } catch (error) {
      result.errors++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown';
      console.error(`ERROR processing event ${event.id}: ${errorMsg}`);
    }
  }

  return result;
}

// =============================================================================
// Event Parsing
// =============================================================================

function parseEventFromGoogleEvent(
  event: any,
  domainToAccounts: Map<string, string>
): CalendarEvent | null {
  // Get attendees
  const attendees = event.attendees || [];
  if (attendees.length === 0) return null;

  // Try to find account by attendee domains
  let accountId: string | null = null;
  for (const attendee of attendees) {
    const email = attendee.email || '';
    const domain = extractDomain(email);

    if (domain) {
      // Skip internal domain
      if (appConfig.INTERNAL_DOMAINS.some(d => domain.includes(d))) {
        continue;
      }

      const foundAccountId = domainToAccounts.get(domain);
      if (foundAccountId) {
        accountId = foundAccountId;
        break;
      }
    }
  }

  if (!accountId) return null;

  // Parse dates
  const start = event.start?.dateTime || event.start?.date;
  const end = event.end?.dateTime || event.end?.date;

  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);

  // Calculate duration in hours
  const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

  // Count attendees
  const attendeeCount = attendees.length;
  const acceptedCount = attendees.filter(
    (a: any) => a.responseStatus === 'accepted'
  ).length;

  // Determine if past
  const now = new Date();
  const isPast = startDate < now;

  // Get my status
  const myAttendee = attendees.find(
    (a: any) => appConfig.INTERNAL_DOMAINS.some(d =>
      (a.email || '').toLowerCase().includes(d)
    )
  );
  const myStatus = myAttendee?.responseStatus || 'needsAction';

  // Build attendee names string
  const attendeeNames = attendees
    .map((a: any) => a.displayName || a.email || '')
    .filter(Boolean)
    .join(', ');

  return {
    eventId: event.id,
    title: event.summary || '(No title)',
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
    duration: durationHours,
    attendeeCount,
    acceptedCount,
    accountId,
    accountName: '', // Resolved on read
    isPast,
    myStatus,
    attendeeNames: attendeeNames.substring(0, 500),
    importedAt: new Date().toISOString(),
  };
}

function extractDomain(email: string): string | null {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : null;
}
