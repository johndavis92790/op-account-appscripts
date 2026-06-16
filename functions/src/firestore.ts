/**
 * Firestore client helpers and utilities
 * Provides typed operations for common patterns
 */

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { collections, subcollections } from './config';
import type {
  Account,
  AccountContact,
  MeetingRecap,
  Email,
  CalendarEvent,
  Task,
  TaskActivity,
  ImportState,
  EmailDomainMapping,
} from './types';

// Initialize Firestore
admin.initializeApp();
export const db = admin.firestore();

// =============================================================================
// Helper Types
// =============================================================================

type WithId<T> = T & { id: string };

// =============================================================================
// Generic Operations
// =============================================================================

export async function getDocument<T>(
  collection: string,
  docId: string
): Promise<T | null> {
  const doc = await db.collection(collection).doc(docId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as T;
}

export async function setDocument<T>(
  collection: string,
  docId: string,
  data: Partial<T>,
  merge = true
): Promise<void> {
  const ref = db.collection(collection).doc(docId);
  if (merge) {
    await ref.set(data, { merge: true });
  } else {
    await ref.set(data);
  }
}

export async function updateDocument<T>(
  collection: string,
  docId: string,
  data: Partial<T>
): Promise<void> {
  await db.collection(collection).doc(docId).update(data);
}

export async function deleteDocument(
  collection: string,
  docId: string
): Promise<void> {
  await db.collection(collection).doc(docId).delete();
}

export async function queryDocuments<T>(
  collection: string,
  field: string,
  operator: FirebaseFirestore.WhereFilterOp,
  value: unknown
): Promise<WithId<T>[]> {
  const snapshot = await db
    .collection(collection)
    .where(field, operator, value)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as T),
  }));
}

// =============================================================================
// Account Operations
// =============================================================================

export async function getAccount(accountId: string): Promise<Account | null> {
  return getDocument<Account>(collections.ACCOUNTS, accountId);
}

export async function upsertAccount(
  accountId: string,
  data: Partial<Account>
): Promise<void> {
  const now = new Date().toISOString();
  await setDocument<Account>(collections.ACCOUNTS, accountId, {
    ...data,
    accountId,
    lastImported: now,
  });
}

export async function deactivateAccount(accountId: string): Promise<void> {
  const now = new Date().toISOString();
  await updateDocument<Account>(collections.ACCOUNTS, accountId, {
    isActive: false,
    deactivatedAt: now,
  });
}

export async function reactivateAccount(accountId: string): Promise<void> {
  await updateDocument<Account>(collections.ACCOUNTS, accountId, {
    isActive: true,
    deactivatedAt: null,
  });
}

export async function getAllActiveAccounts(): Promise<WithId<Account>[]> {
  const snapshot = await db
    .collection(collections.ACCOUNTS)
    .where('isActive', '!=', false)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as Account),
  }));
}

// =============================================================================
// Contact Operations (Subcollection)
// =============================================================================

export async function upsertContact(
  accountId: string,
  contact: AccountContact
): Promise<void> {
  const ref = db
    .collection(collections.ACCOUNTS)
    .doc(accountId)
    .collection(subcollections.CONTACTS)
    .doc(contact.email);

  await ref.set(contact, { merge: true });
}

export async function getContactsForAccount(
  accountId: string
): Promise<AccountContact[]> {
  const snapshot = await db
    .collection(collections.ACCOUNTS)
    .doc(accountId)
    .collection(subcollections.CONTACTS)
    .get();

  return snapshot.docs.map(doc => doc.data() as AccountContact);
}

// =============================================================================
// Meeting Recap Operations (Subcollection)
// =============================================================================

export async function upsertMeetingRecap(
  accountId: string,
  recap: MeetingRecap
): Promise<void> {
  const ref = db
    .collection(collections.ACCOUNTS)
    .doc(accountId)
    .collection(subcollections.MEETING_RECAPS)
    .doc(recap.recapId);

  await ref.set(recap, { merge: true });
}

export async function addRecapToAccountArray(
  accountId: string,
  recap: MeetingRecap
): Promise<void> {
  const accountRef = db.collection(collections.ACCOUNTS).doc(accountId);
  await accountRef.update({
    meetingRecaps: FieldValue.arrayUnion(recap)
  });
}

export async function getMeetingRecap(
  accountId: string,
  recapId: string
): Promise<MeetingRecap | null> {
  const doc = await db
    .collection(collections.ACCOUNTS)
    .doc(accountId)
    .collection(subcollections.MEETING_RECAPS)
    .doc(recapId)
    .get();

  if (!doc.exists) return null;
  return doc.data() as MeetingRecap;
}

export async function meetingRecapExists(
  accountId: string,
  recapId: string
): Promise<boolean> {
  const doc = await db
    .collection(collections.ACCOUNTS)
    .doc(accountId)
    .collection(subcollections.MEETING_RECAPS)
    .doc(recapId)
    .get();

  return doc.exists;
}

export async function getMeetingRecapsForAccount(
  accountId: string,
  limit = 15
): Promise<MeetingRecap[]> {
  const snapshot = await db
    .collection(collections.ACCOUNTS)
    .doc(accountId)
    .collection(subcollections.MEETING_RECAPS)
    .orderBy('meetingDate', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => doc.data() as MeetingRecap);
}

// =============================================================================
// Email Operations (Subcollection)
// =============================================================================

export async function upsertEmail(
  accountId: string,
  email: Email
): Promise<void> {
  const ref = db
    .collection(collections.ACCOUNTS)
    .doc(accountId)
    .collection(subcollections.EMAILS)
    .doc(email.messageId);

  await ref.set(email, { merge: true });
}

export async function getRecentEmailsForAccount(
  accountId: string,
  limit = 20
): Promise<Email[]> {
  const snapshot = await db
    .collection(collections.ACCOUNTS)
    .doc(accountId)
    .collection(subcollections.EMAILS)
    .orderBy('date', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => doc.data() as Email);
}

// =============================================================================
// Calendar Event Operations (Subcollection)
// =============================================================================

export async function upsertCalendarEvent(
  accountId: string,
  event: CalendarEvent
): Promise<void> {
  const ref = db
    .collection(collections.ACCOUNTS)
    .doc(accountId)
    .collection(subcollections.CALENDAR_EVENTS)
    .doc(event.eventId);

  await ref.set(event, { merge: true });
}

export async function getCalendarEventsForAccount(
  accountId: string
): Promise<CalendarEvent[]> {
  const snapshot = await db
    .collection(collections.ACCOUNTS)
    .doc(accountId)
    .collection(subcollections.CALENDAR_EVENTS)
    .orderBy('startTime', 'desc')
    .get();

  return snapshot.docs.map(doc => doc.data() as CalendarEvent);
}

// =============================================================================
// Task Operations (Top-level collection)
// =============================================================================

export async function createTask(task: Task): Promise<void> {
  const ref = db.collection(collections.TASKS).doc(task.taskId);
  await ref.set(task);
}

export async function getTask(taskId: string): Promise<Task | null> {
  const doc = await db.collection(collections.TASKS).doc(taskId).get();
  if (!doc.exists) return null;
  return { taskId: doc.id, ...doc.data() } as Task;
}

export async function addTaskActivity(
  taskId: string,
  activity: TaskActivity
): Promise<void> {
  const ref = db
    .collection(collections.TASKS)
    .doc(taskId)
    .collection(subcollections.ACTIVITY)
    .doc(activity.activityId);

  await ref.set(activity);
}

// =============================================================================
// Email Domain Mapping Operations
// =============================================================================

export async function upsertEmailDomainMapping(
  mapping: EmailDomainMapping
): Promise<void> {
  const ref = db.collection(collections.EMAIL_DOMAIN_MAPPINGS).doc(mapping.accountId);
  await ref.set(mapping, { merge: true });
}

export async function getEmailDomainMapping(
  accountId: string
): Promise<EmailDomainMapping | null> {
  const doc = await db.collection(collections.EMAIL_DOMAIN_MAPPINGS).doc(accountId).get();
  if (!doc.exists) return null;
  return { accountId: doc.id, ...doc.data() } as EmailDomainMapping;
}

export async function getAllEmailDomainMappings(): Promise<EmailDomainMapping[]> {
  const snapshot = await db.collection(collections.EMAIL_DOMAIN_MAPPINGS).get();
  return snapshot.docs.map(doc => ({
    accountId: doc.id,
    ...doc.data(),
  } as EmailDomainMapping));
}

export async function findAccountByDomain(domain: string): Promise<string | null> {
  const snapshot = await db
    .collection(collections.EMAIL_DOMAIN_MAPPINGS)
    .where('emailDomains', 'array-contains', domain.toLowerCase())
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

// =============================================================================
// Import State Operations
// =============================================================================

export async function getImportState(importType: string): Promise<ImportState | null> {
  const doc = await db.collection(collections.IMPORT_STATE).doc(importType).get();
  if (!doc.exists) return null;
  return { importType: doc.id, ...doc.data() } as ImportState;
}

export async function updateImportState(
  importType: string,
  update: Partial<ImportState>
): Promise<void> {
  const ref = db.collection(collections.IMPORT_STATE).doc(importType);
  const now = new Date().toISOString();

  await ref.set(
    {
      ...update,
      importType,
      lastRunAt: now,
    },
    { merge: true }
  );
}

// =============================================================================
// Webhook Log Operations
// =============================================================================

export async function logWebhook(
  type: string,
  status: 'success' | 'error' | 'skipped',
  details: Record<string, unknown>
): Promise<void> {
  const ref = db.collection(collections.WEBHOOK_LOGS).doc();
  await ref.set({
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    type,
    status,
    ...details,
  });
}

// =============================================================================
// Batch Operations
// =============================================================================

export async function batchUpsertAccounts(
  accounts: Array<{ id: string; data: Partial<Account> }>
): Promise<void> {
  const batch = db.batch();
  const now = new Date().toISOString();

  for (const { id, data } of accounts) {
    const ref = db.collection(collections.ACCOUNTS).doc(id);
    batch.set(
      ref,
      {
        ...data,
        accountId: id,
        lastImported: now,
      },
      { merge: true }
    );
  }

  await batch.commit();
}

// =============================================================================
// Transaction Helpers
// =============================================================================

export async function runTransaction<T>(
  updateFn: (transaction: FirebaseFirestore.Transaction) => Promise<T>
): Promise<T> {
  return db.runTransaction(updateFn);
}
