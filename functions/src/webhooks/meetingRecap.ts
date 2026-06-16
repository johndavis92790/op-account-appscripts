/**
 * Meeting Recap Webhook Handler
 * Replaces WebhookHandler.js processMeetingRecapWebhook()
 * Receives POST from AskElephant, writes directly to Firestore
 */

import * as functions from 'firebase-functions';
import { z } from 'zod';
import { db, logWebhook } from '../firestore';
import * as firestore from '../firestore';
import { secrets, appConfig } from '../config';
import type { MeetingRecapPayload, MeetingRecap, AccountContact, RecapAttendee } from '../types';

// =============================================================================
// Request Validation Schema
// =============================================================================

const MeetingInfoSchema = z.object({
  title: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  meetingLink: z.string(),
  meetingUrl: z.string().optional(),
});

const CompanyInfoSchema = z.object({
  companyName: z.string(),
  slackMessages: z.union([z.number(), z.array(z.any())]).optional(),
});

const AttendeesSchema = z.object({
  actual: z.array(z.string()),
  invited: z.array(z.string()),
  allNames: z.array(z.string()),
});

const ExternalAttendeeSchema = z.object({
  Email: z.string(),
  Name: z.string().optional(),
  Title: z.string().optional(),
  Roles: z.union([z.array(z.string()), z.string()]).optional(),
  'LinkedIn URL': z.string().optional(),
  'Contact ID': z.string().optional(),
});

const InternalAttendeeSchema = z.object({
  Email: z.string(),
  Name: z.string().optional(),
  Title: z.string().optional(),
  'Actually Attended': z.boolean().optional(),
  Invited: z.boolean().optional(),
});

const ActionItemSchema = z.object({
  actionItemTitle: z.string(),
  actionItemDescription: z.string(),
  priority: z.string().optional(),
});

const FollowUpEmailSchema = z.object({
  subject: z.string(),
  htmlBody: z.string(),
  toEmails: z.array(z.string()),
});

const MeetingRecapPayloadSchema = z.object({
  meetingInfo: MeetingInfoSchema,
  companyInfo: CompanyInfoSchema,
  attendees: AttendeesSchema,
  externalAttendees: z.array(ExternalAttendeeSchema).optional(),
  internalAttendees: z.array(InternalAttendeeSchema).optional(),
  summary: z.string(),
  actionItems: z.object({
    myItems: z.array(ActionItemSchema),
    othersItems: z.array(ActionItemSchema),
  }),
  followUpEmail: FollowUpEmailSchema.optional(),
});

// =============================================================================
// Main Handler
// =============================================================================

export const receiveMeetingRecap = functions.https.onRequest(async (req, res) => {
  const startTime = Date.now();
  const logEntries: string[] = [];

  const log = (msg: string) => {
    console.log(msg);
    logEntries.push(msg);
  };

  try {
    // Validate method
    if (req.method !== 'POST') {
      res.status(405).json({ success: false, error: 'Method not allowed' });
      return;
    }

    // Validate webhook secret
    const authHeader = req.headers.authorization || '';
    const expectedSecret = secrets.WEBHOOK_SECRET;

    if (expectedSecret && !authHeader.includes(expectedSecret)) {
      log('ERROR: Invalid webhook secret');
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Parse and validate payload
    let payload: MeetingRecapPayload;
    try {
      payload = MeetingRecapPayloadSchema.parse(req.body);
    } catch (parseError) {
      const error = parseError instanceof Error ? parseError.message : 'Unknown error';
      log(`ERROR: Failed to validate payload: ${error}`);
      await logWebhook('meeting_recap', 'error', { error: error, body: req.body });
      res.status(400).json({ success: false, error: 'Invalid payload', details: error });
      return;
    }

    log(`=== Meeting Recap Webhook Received ===`);
    log(`Title: ${payload.meetingInfo.title}`);
    log(`Company: ${payload.companyInfo.companyName}`);

    // Extract recap ID from meeting link
    const recapId = extractRecapId(payload.meetingInfo.meetingLink);
    if (!recapId) {
      log('ERROR: Could not extract recap ID from meetingLink');
      res.status(400).json({ success: false, error: 'Invalid meetingLink format' });
      return;
    }

    log(`Recap ID: ${recapId}`);

    // Find account by attendee domains
    const accountMatch = await findAccountByAttendees(payload);
    log(`Account match: ${accountMatch ? accountMatch.accountName : 'NOT FOUND'}`);

    // Process contacts (always runs, upserts by email)
    let contactsResult = { created: 0, updated: 0 };
    if (accountMatch) {
      try {
        contactsResult = await processExternalContacts(payload, accountMatch.accountId);
        log(`Contacts: ${contactsResult.created} created, ${contactsResult.updated} updated`);
      } catch (contactError) {
        log(`WARNING: Contact processing failed: ${contactError instanceof Error ? contactError.message : 'Unknown'}`);
      }
    }

    // Check for duplicate recap
    const isDuplicate = accountMatch
      ? await firestore.meetingRecapExists(accountMatch.accountId, recapId)
      : false;

    if (isDuplicate) {
      log('⏭️ Duplicate meeting recap - skipping recap/action items');
      await logWebhook('meeting_recap', 'skipped', {
        recapId,
        reason: 'duplicate',
        accountMatched: !!accountMatch,
      });

      res.json({
        success: true,
        action: 'skipped_duplicate',
        recapId,
        accountMatched: !!accountMatch,
        contactsCreated: contactsResult.created,
        contactsUpdated: contactsResult.updated,
      });
      return;
    }

    // Process recap
    let tasksResult = null;
    let followUpResult = null;

    if (accountMatch) {
      // Create meeting recap document
      const recap = buildMeetingRecap(payload, recapId, accountMatch);
      await firestore.upsertMeetingRecap(accountMatch.accountId, recap);
      log(`✓ Meeting recap saved to Firestore subcollection`);

      // Also add to account's meetingRecaps array for frontend visibility
      try {
        await firestore.addRecapToAccountArray(accountMatch.accountId, recap);
        log(`✓ Meeting recap added to account array`);
      } catch (arrayError) {
        log(`⚠️ Failed to add to account array: ${arrayError instanceof Error ? arrayError.message : 'Unknown'}`);
      }

      // Create tasks from action items
      try {
        tasksResult = await createTasksFromActionItems(
          payload.actionItems.myItems,
          payload,
          recapId,
          accountMatch
        );
        log(`✓ Tasks created: ${tasksResult.created}`);
      } catch (taskError) {
        log(`WARNING: Task creation failed: ${taskError instanceof Error ? taskError.message : 'Unknown'}`);
        tasksResult = { created: 0, error: taskError instanceof Error ? taskError.message : 'Unknown' };
      }

      // Process follow-up email
      if (payload.followUpEmail) {
        try {
          followUpResult = await processFollowUpEmail(
            payload.followUpEmail,
            recapId,
            accountMatch.accountId
          );
          log(`✓ Follow-up email: ${followUpResult.drafted ? 'drafted' : 'skipped'}`);
        } catch (emailError) {
          log(`WARNING: Follow-up email failed: ${emailError instanceof Error ? emailError.message : 'Unknown'}`);
        }
      }
    } else {
      log('⚠️ No account matched - recap not saved');
    }

    // Log success
    const duration = (Date.now() - startTime) / 1000;
    log(`=== Webhook Complete in ${duration}s ===`);

    await logWebhook('meeting_recap', 'success', {
      recapId,
      accountId: accountMatch?.accountId,
      accountName: accountMatch?.accountName,
      contactsCreated: contactsResult.created,
      contactsUpdated: contactsResult.updated,
      tasksCreated: tasksResult?.created,
      followUpDrafted: followUpResult?.drafted,
      duration,
    });

    res.json({
      success: true,
      action: 'created',
      recapId,
      accountMatched: !!accountMatch,
      accountId: accountMatch?.accountId,
      accountName: accountMatch?.accountName,
      contactsCreated: contactsResult.created,
      contactsUpdated: contactsResult.updated,
      tasksCreated: tasksResult?.created || 0,
      followUpDrafted: followUpResult?.drafted || false,
      duration,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`FATAL ERROR: ${errorMessage}`);
    console.error(error);

    await logWebhook('meeting_recap', 'error', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: errorMessage,
    });
  }
});

// =============================================================================
// Helper Functions
// =============================================================================

function extractRecapId(meetingLink: string): string | null {
  if (!meetingLink || typeof meetingLink !== 'string') {
    return null;
  }

  // Extract the last path segment after /engagements/
  const match = meetingLink.match(/\/engagements\/([^\/\?#]+)/);
  if (match) {
    return match[1];
  }

  // Fallback: get last path segment
  const parts = meetingLink.split('/').filter(p => p);
  if (parts.length > 0) {
    return parts[parts.length - 1];
  }

  return null;
}

interface AccountMatch {
  accountId: string;
  accountName: string;
  opportunityId?: string;
  opportunityName?: string;
}

async function findAccountByAttendees(payload: MeetingRecapPayload): Promise<AccountMatch | null> {
  const allEmails = [...new Set([...payload.attendees.actual, ...payload.attendees.invited])];
  const externalEmails = allEmails.filter(
    email => !appConfig.INTERNAL_DOMAINS.some(domain => email.toLowerCase().includes(domain))
  );

  if (externalEmails.length === 0) {
    console.log('No external attendees found');
    return null;
  }

  // Try to find account by email domain
  for (const email of externalEmails) {
    const domain = getEmailDomain(email);
    if (!domain) continue;

    const accountId = await firestore.findAccountByDomain(domain);
    if (accountId) {
      const account = await firestore.getAccount(accountId);
      if (account) {
        return {
          accountId: account.accountId,
          accountName: account.accountName,
        };
      }
    }
  }

  // Fallback: try company name matching
  if (payload.companyInfo.companyName) {
    const mappings = await firestore.getAllEmailDomainMappings();
    for (const mapping of mappings) {
      if (
        payload.companyInfo.companyName.toLowerCase().includes(mapping.accountName.toLowerCase()) ||
        mapping.accountName.toLowerCase().includes(payload.companyInfo.companyName.toLowerCase())
      ) {
        return {
          accountId: mapping.accountId,
          accountName: mapping.accountName,
        };
      }
    }
  }

  return null;
}

function getEmailDomain(email: string): string | null {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : null;
}

async function processExternalContacts(
  payload: MeetingRecapPayload,
  accountId: string
): Promise<{ created: number; updated: number }> {
  const externalAttendees = payload.externalAttendees || [];
  if (externalAttendees.length === 0) {
    return { created: 0, updated: 0 };
  }

  let created = 0;
  let updated = 0;

  for (const attendee of externalAttendees) {
    const email = attendee.Email.toLowerCase().trim();
    if (!email) continue;

    const existingContact = await getExistingContact(accountId, email);

    const contact: AccountContact = {
      email,
      name: attendee.Name || existingContact?.name || '',
      title: attendee.Title || existingContact?.title || '',
      roles: parseRoles(attendee.Roles),
      linkedInUrl: attendee['LinkedIn URL'] || existingContact?.linkedInUrl || '',
      contactId: attendee['Contact ID'] || existingContact?.contactId || '',
      accountId,
      accountName: existingContact?.accountName || '',
      notes: existingContact?.notes || '', // Preserve existing notes
      lastUpdated: new Date().toISOString(),
    };

    await firestore.upsertContact(accountId, contact);

    if (existingContact) {
      updated++;
    } else {
      created++;
    }
  }

  return { created, updated };
}

async function getExistingContact(
  accountId: string,
  email: string
): Promise<AccountContact | null> {
  const contacts = await firestore.getContactsForAccount(accountId);
  return contacts.find(c => c.email.toLowerCase() === email.toLowerCase()) || null;
}

function parseRoles(roles: string[] | string | undefined): string[] {
  if (!roles) return [];
  if (Array.isArray(roles)) return roles;
  return roles.split(',').map(r => r.trim()).filter(Boolean);
}

function buildMeetingRecap(
  payload: MeetingRecapPayload,
  recapId: string,
  accountMatch: AccountMatch
): MeetingRecap {
  const { meetingInfo, companyInfo, attendees, summary, actionItems } = payload;

  // Calculate duration
  let duration = '';
  try {
    const start = new Date(meetingInfo.startTime);
    const end = new Date(meetingInfo.endTime);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    duration = `${minutes} minutes`;
  } catch {
    duration = '';
  }

  // Parse attendees JSON
  const internalAttendees: RecapAttendee[] = (payload.internalAttendees || []).map(a => ({
    name: a.Name || '',
    email: a.Email,
    invited: a.Invited !== undefined ? a.Invited : true,
    actuallyAttended: a['Actually Attended'] || false,
    title: a.Title || '',
  }));

  const externalAttendeesDetailed: RecapAttendee[] = (payload.externalAttendees || []).map(a => ({
    name: a.Name || '',
    email: a.Email,
    invited: true,
    actuallyAttended: true, // These are from the externalAttendees array which are actual attendees
    title: a.Title || '',
    roles: parseRoles(a.Roles),
    linkedInUrl: a['LinkedIn URL'] || '',
    contactId: a['Contact ID'] || '',
  }));

  return {
    recapId,
    meetingTitle: meetingInfo.title,
    meetingCompany: companyInfo.companyName,
    meetingDate: meetingInfo.startTime,
    meetingEndTime: meetingInfo.endTime,
    meetingDuration: duration,
    summary,
    actualAttendees: attendees.actual.join(', '),
    invitedAttendees: attendees.invited.join(', '),
    allNames: attendees.allNames.join(', '),
    externalAttendees: attendees.actual
      .filter(email => !appConfig.INTERNAL_DOMAINS.some(domain => email.toLowerCase().includes(domain)))
      .join(', '),
    myActionItemsCount: actionItems.myItems.length,
    othersActionItemsCount: actionItems.othersItems.length,
    totalActionItemsCount: actionItems.myItems.length + actionItems.othersItems.length,
    accountId: accountMatch.accountId,
    accountName: accountMatch.accountName,
    opportunityId: '',
    opportunityName: '',
    mappedDomain: '',
    meetingLink: meetingInfo.meetingLink,
    zoomLink: meetingInfo.meetingUrl || '',
    slackMessages: companyInfo.slackMessages?.toString() || null,
    calendarEventId: null,
    receivedDate: new Date().toISOString(),
    internalAttendees,
    externalAttendeesDetailed,
  };
}

interface TaskResult {
  created: number;
  taskIds: string[];
}

async function createTasksFromActionItems(
  actionItems: Array<{ actionItemTitle: string; actionItemDescription: string; priority?: string }>,
  payload: any,
  recapId: string,
  accountMatch: AccountMatch
): Promise<TaskResult> {
  const results: string[] = [];

  // Get meeting date for task creation date
  const meetingDate = payload.meetingInfo?.startTime;
  const createdAt = meetingDate ? new Date(meetingDate).toISOString() : new Date().toISOString();

  for (let i = 0; i < actionItems.length; i++) {
    const item = actionItems[i];
    const taskId = db.collection('tasks').doc().id;

    // Map priority
    let priority: 'critical' | 'high' | 'medium' | 'low' | null = null;
    const rawPriority = (item.priority || '').toLowerCase();
    if (rawPriority.includes('high')) priority = 'high';
    else if (rawPriority.includes('medium')) priority = 'medium';
    else if (rawPriority.includes('low')) priority = 'low';

    // Build comprehensive description with meeting context
    const description = buildTaskDescription(item, payload);

    const task = {
      taskId,
      title: item.actionItemTitle.substring(0, 200),
      description,
      status: 'generated' as const,
      priority,
      targetDate: null,
      accountId: accountMatch.accountId,
      accountName: accountMatch.accountName,
      parentTaskId: null,
      assigneeIds: [],
      labelIds: [],
      source: 'meeting_recap' as const,
      sourceRef: {
        meetingRecapId: recapId,
        meetingDate: meetingDate,
        meetingTitle: payload.meetingInfo?.title,
      },
      createdAt,
      updatedAt: createdAt,
      closedAt: null,
      createdBy: 'system',
    };

    await firestore.createTask(task);

    // Add activity log
    await firestore.addTaskActivity(taskId, {
      activityId: db.collection('tasks').doc().id,
      type: 'created',
      actorId: 'system',
      timestamp: createdAt,
      detail: { note: 'Created from meeting recap webhook' },
    });

    results.push(taskId);
  }

  return { created: results.length, taskIds: results };
}

function buildTaskDescription(
  item: { actionItemTitle: string; actionItemDescription: string },
  payload: any
): string {
  const parts: string[] = [];

  // Add the action item description
  if (item.actionItemDescription) {
    parts.push(item.actionItemDescription);
  } else {
    parts.push(item.actionItemTitle);
  }

  // Add meeting context
  const meetingInfo = payload.meetingInfo;
  if (meetingInfo) {
    parts.push('');
    parts.push('---');
    parts.push('');
    parts.push(`**Meeting:** ${meetingInfo.title || 'N/A'}`);
    if (meetingInfo.startTime) {
      const date = new Date(meetingInfo.startTime);
      parts.push(`**Date:** ${date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`);
    }
    if (meetingInfo.meetingUrl) {
      parts.push(`**Meeting Link:** ${meetingInfo.meetingUrl}`);
    }
  }

  // Add meeting summary if available
  if (payload.summary) {
    parts.push('');
    parts.push('**Meeting Summary:**');
    parts.push(payload.summary);
  }

  // Add external attendees
  const attendees = payload.externalAttendees;
  if (attendees && attendees.length > 0) {
    parts.push('');
    parts.push('**Attendees:**');
    attendees.forEach((attendee: any) => {
      const name = attendee.Name || attendee.name || 'Unknown';
      const email = attendee.Email || attendee.email || '';
      const title = attendee.Title || attendee.title || '';
      parts.push(`- ${name}${title ? ` (${title})` : ''}${email ? ` - ${email}` : ''}`);
    });
  }

  // Add auto-generated footer with meeting date (not current date)
  const meetingDate = payload.meetingInfo?.startTime;
  const footerDate = meetingDate 
    ? new Date(meetingDate).toISOString().split('T')[0] 
    : new Date().toISOString().split('T')[0];
  parts.push('');
  parts.push('---');
  parts.push(`*Auto-generated from meeting recap on ${footerDate}*`);

  return parts.join('\n');
}

interface FollowUpResult {
  drafted: boolean;
  draftId?: string;
}

async function processFollowUpEmail(
  followUpEmail: { subject: string; htmlBody: string; toEmails: string[] },
  recapId: string,
  accountId: string
): Promise<FollowUpResult> {
  // Store metadata in Firestore
  await firestore.updateDocument(collections.ACCOUNTS, accountId, {
    [`meetingRecaps.${recapId}.followUpEmailSubject`]: followUpEmail.subject,
    [`meetingRecaps.${recapId}.followUpEmailTo`]: followUpEmail.toEmails.join(', '),
    [`meetingRecaps.${recapId}.followUpEmailDraftStatus`]: 'pending',
  });

  // Note: Creating Gmail draft requires OAuth credentials with Gmail API scope
  // This is a placeholder for the actual implementation
  // You would use googleapis Gmail API to create a draft here

  // For now, we just log that it would be created
  console.log(`Follow-up email would be drafted: ${followUpEmail.subject}`);
  console.log(`To: ${followUpEmail.toEmails.join(', ')}`);

  return { drafted: true };
}

// Collection name for update
const collections = {
  ACCOUNTS: 'accounts',
};
