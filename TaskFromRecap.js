/**
 * TaskFromRecap.js — write Firestore `tasks` documents from meeting recap
 * action items.
 *
 * Replaces the legacy GitHub-issue creation flow that ran from
 * `createGitHubIssuesFromActionItems` in WebhookHandler.js. Same trigger
 * (called from processMeetingRecapWebhook step 5), same input data, but the
 * output lands in the Firestore `tasks` collection instead of GitHub.
 *
 * Schema reference: /TASKS_DATA_MODEL.md.
 *
 * Idempotency: the Meeting Action Items sheet now has a "Firestore Task ID"
 * column. If a row already has a task id, we skip it. This means re-running
 * the webhook (or the `createMissingFirestoreTasksFromActionItems` manual
 * helper) is safe.
 *
 * Reuses Firestore helpers from FirestoreSync.js:
 *   - writeFirestoreDocument(collection, docId, data)
 *   - convertToFirestoreValue(value)
 *   - FIRESTORE_BASE_URL
 */

const FIRESTORE_TASK_ID_COL = 'Firestore Task ID';

/**
 * Build a canonical Account ID -> Account Name map from `Accounts Card
 * Report`. This is the source-of-truth for account naming inside this
 * spreadsheet — any Account Name we read off the Meeting Action Items rows
 * (or the Webhook Meeting Recaps rows) should be cross-checked against it.
 *
 * Background: legacy backfill scripts in `FixEmailAccountReferences.js` and
 * `ComprehensiveRemapping.js` accidentally wrote `accountId` into the
 * `Account Name` column when the name was missing, leaving rows where
 * accountName === accountId. We must never propagate that into Firestore.
 */
function buildAccountIdToNameMap_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName('Accounts Card Report');
  const map = new Map();
  if (!sheet || sheet.getLastRow() < 2) {
    Logger.log('⚠ Accounts Card Report missing — cannot build canonical name map');
    return map;
  }
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('Id');
  const nameIdx = headers.indexOf('Name');
  if (idIdx === -1 || nameIdx === -1) {
    Logger.log('⚠ Accounts Card Report missing Id/Name columns');
    return map;
  }
  for (let i = 1; i < data.length; i++) {
    const id = data[i][idIdx];
    const name = data[i][nameIdx];
    if (id && name) map.set(String(id), String(name));
  }
  Logger.log('Built canonical accountId→name map with ' + map.size + ' entries');
  return map;
}

/**
 * Resolve the (accountId, accountName) pair for a task, preferring trustworthy
 * sources in order: row Account ID + canonical name map > recap Account ID +
 * canonical name map > raw row accountName (only if it doesn't smell like an
 * id) > raw recap accountName.
 *
 * Always rejects the "accountName equals accountId" pattern because that's
 * the legacy backfill bug we're trying to clean up.
 */
function resolveAccountIdentity_(rowAccountId, rowAccountName, recap, idToNameMap) {
  const accountId =
    String(rowAccountId || (recap && recap.accountId) || '').trim();
  if (!accountId) {
    return { accountId: '', accountName: '' };
  }

  // Strongest signal: canonical map.
  if (idToNameMap && idToNameMap.has(accountId)) {
    return { accountId: accountId, accountName: idToNameMap.get(accountId) };
  }

  // Otherwise, try the row's Account Name — but only if it doesn't equal the id.
  const rowName = String(rowAccountName || '').trim();
  if (rowName && rowName !== accountId) {
    return { accountId: accountId, accountName: rowName };
  }

  // Last-resort fallback: recap's accountName.
  const recapName = String((recap && recap.accountName) || '').trim();
  if (recapName && recapName !== accountId) {
    return { accountId: accountId, accountName: recapName };
  }

  // Worst case: id but no usable name. Return empty name rather than the id.
  return { accountId: accountId, accountName: '' };
}

/**
 * Iterate the Meeting Action Items sheet for the given meeting recap and
 * create a Firestore `tasks/{taskId}` doc for each "my action item" that
 * doesn't already have one. Writes a `created` activity entry per task.
 *
 * @param {string} meetingRecapId - id from extractMeetingRecapId()
 * @param {Object} recap - the flattened recap object (must include
 *                         accountId / accountName / meetingTitle).
 * @param {Object} [opts] - { idToNameMap?: Map } for batch invocations
 * @returns {{ created: number, skipped: number, errors: number }}
 */
function createFirestoreTasksFromActionItems(meetingRecapId, recap, opts) {
  opts = opts || {};
  const idToNameMap = opts.idToNameMap || buildAccountIdToNameMap_();

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(MEETING_ACTION_ITEMS_SHEET);

  if (!sheet || sheet.getLastRow() < 2) {
    Logger.log('No action items to process for Firestore tasks');
    return { created: 0, skipped: 0, errors: 0 };
  }

  // Ensure the sheet has the task-id tracking column. If it doesn't, add it
  // right after the existing GitHub columns so legacy data stays put.
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let firestoreTaskIdCol = headers.indexOf(FIRESTORE_TASK_ID_COL);
  if (firestoreTaskIdCol === -1) {
    // Insert after the rightmost column to be safe.
    const newCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, newCol).setValue(FIRESTORE_TASK_ID_COL);
    sheet.getRange(1, newCol)
      .setFontWeight('bold')
      .setBackground('#34a853')
      .setFontColor('#ffffff');
    firestoreTaskIdCol = newCol - 1; // back to 0-indexed
    Logger.log(`Added "${FIRESTORE_TASK_ID_COL}" column at position ${newCol}`);
  }

  // Re-read after potential structural change
  const data = sheet.getDataRange().getValues();
  const liveHeaders = data[0];
  const idx = {
    meetingRecapId: liveHeaders.indexOf('Meeting Recap ID'),
    actionItemIndex: liveHeaders.indexOf('Action Item Index'),
    title: liveHeaders.indexOf('Title'),
    description: liveHeaders.indexOf('Description'),
    priority: liveHeaders.indexOf('Priority'),
    accountId: liveHeaders.indexOf('Account ID'),
    accountName: liveHeaders.indexOf('Account Name'),
    meetingTitle: liveHeaders.indexOf('Meeting Title'),
    firestoreTaskId: liveHeaders.indexOf(FIRESTORE_TASK_ID_COL),
  };

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[idx.meetingRecapId] !== meetingRecapId) continue;

    // Skip if already created (idempotency).
    if (row[idx.firestoreTaskId] && row[idx.firestoreTaskId].toString().trim()) {
      skipped++;
      continue;
    }

    const title = row[idx.title] || '';
    if (!title) {
      skipped++;
      continue;
    }

    const identity = resolveAccountIdentity_(
      row[idx.accountId],
      row[idx.accountName],
      recap,
      idToNameMap
    );

    try {
      const taskId = writeTaskDocFromActionItem({
        actionItemTitle: title,
        actionItemDescription: row[idx.description] || '',
        actionItemPriority: row[idx.priority] || '',
        meetingRecapId: meetingRecapId,
        meetingTitle: row[idx.meetingTitle] || (recap && recap.meetingTitle) || '',
        accountId: identity.accountId,
        accountName: identity.accountName,
        meetingLink: recap && recap.meetingLink,
        meetingDate: recap && recap.meetingDate,
        externalAttendees: recap && recap.externalAttendees,
        summary: recap && recap.summary,
      });

      // Self-heal the source sheet too: if the row's Account Name was empty
      // or polluted with the id, rewrite it with the canonical name so any
      // downstream consumer reading this sheet gets the correct value.
      const rowName = String(row[idx.accountName] || '').trim();
      if (
        idx.accountName !== -1 &&
        identity.accountName &&
        (!rowName || rowName === String(row[idx.accountId] || '').trim())
      ) {
        sheet.getRange(i + 1, idx.accountName + 1).setValue(identity.accountName);
      }
      if (
        idx.accountId !== -1 &&
        identity.accountId &&
        !String(row[idx.accountId] || '').trim()
      ) {
        sheet.getRange(i + 1, idx.accountId + 1).setValue(identity.accountId);
      }

      // Stash the new task id in the sheet so subsequent runs skip it.
      sheet.getRange(i + 1, idx.firestoreTaskId + 1).setValue(taskId);
      created++;
      Logger.log(`  ✓ Created Firestore task ${taskId}: ${title}`);
    } catch (err) {
      errors++;
      Logger.log(`  ❌ Error creating task for "${title}": ${err.message}`);
    }

    // Light rate limit — Firestore quotas are generous but be polite.
    Utilities.sleep(50);
  }

  Logger.log(
    `Firestore task creation: ${created} created, ${skipped} skipped, ${errors} errors`
  );
  return { created: created, skipped: skipped, errors: errors };
}

/**
 * Build and write a single `tasks/{taskId}` document plus its initial
 * activity entry. Returns the new taskId.
 */
function writeTaskDocFromActionItem(input) {
  const taskId = Utilities.getUuid();
  const nowIso = new Date().toISOString();

  // Build the markdown description with meeting context, mirroring the
  // legacy GitHub issue body format so existing notes/conventions still read
  // naturally in the new UI.
  const description = buildTaskDescriptionFromActionItem(input);

  // Normalize priority to lowercase enum value matching TaskPriority type.
  const priority = normalizeTaskPriority(input.actionItemPriority);

  const task = {
    title: String(input.actionItemTitle).trim().substring(0, 200),
    description: description,
    status: 'generated', // Auto-generated tasks land in the "Generated" lane.
    priority: priority,
    targetDate: null,
    accountId: input.accountId || null,
    accountName: input.accountName || null,
    parentTaskId: null,
    assigneeIds: [], // No assignee yet; user triages from the dashboard.
    source: 'meeting_recap',
    sourceRef: {
      meetingRecapId: input.meetingRecapId || null,
      meetingTitle: input.meetingTitle || null,
      meetingDate: input.meetingDate ? String(input.meetingDate) : null,
      meetingLink: (input.meetingLink && /^https?:\/\//i.test(String(input.meetingLink).trim()))
        ? String(input.meetingLink).trim() : null,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
    closedAt: null,
    createdBy: 'system',
  };

  // Write the task doc.
  writeFirestoreDocument('tasks', taskId, task);

  // Append a `created` activity entry so the audit trail in TaskDetail is
  // populated immediately. Use a UUID for the activity doc id.
  const activityId = Utilities.getUuid();
  const activity = {
    type: 'created',
    actorId: 'system',
    timestamp: nowIso,
    detail: {
      note:
        'Auto-generated from meeting recap' +
        (input.meetingTitle ? ': ' + input.meetingTitle : ''),
    },
  };
  writeFirestoreDocument('tasks/' + taskId + '/activity', activityId, activity);

  return taskId;
}

/**
 * Build the task description body. Mirrors buildIssueBodyWebhook() from
 * GitHubIssueCreator.js so we don't lose the meeting context that users have
 * grown used to seeing on auto-generated tasks.
 */
function buildTaskDescriptionFromActionItem(input) {
  const desc = input.actionItemDescription || '';

  let meetingDateStr = '';
  if (input.meetingDate) {
    try {
      const d = new Date(input.meetingDate);
      meetingDateStr = d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      meetingDateStr = String(input.meetingDate);
    }
  }

  let body = desc;
  body += '\n\n---\n\n';
  body += '## Meeting Context\n\n';
  body += '**Meeting:** ' + (input.meetingTitle || 'Unknown') + '\n';
  if (meetingDateStr) body += '**Date:** ' + meetingDateStr + '\n';
  if (input.accountName) body += '**Account:** ' + input.accountName + '\n';
  if (input.externalAttendees) body += '**External Attendees:** ' + input.externalAttendees + '\n';
  // Only emit a clickable link if meetingLink looks like a real HTTP(S) URL.
  if (input.meetingLink && /^https?:\/\//i.test(String(input.meetingLink).trim())) {
    body += '**Meeting Recap:** [View Recap](' + input.meetingLink + ')\n';
  } else if (input.meetingLink) {
    body += '**Meeting Recap:** ' + input.meetingLink + '\n';
  }
  if (input.summary) {
    body += '\n### Meeting Summary\n' + input.summary + '\n';
  }
  body +=
    '\n---\n*Auto-generated from meeting recap on ' +
    new Date().toISOString().split('T')[0] +
    '*';

  return body;
}

/**
 * Normalize a priority value from Otter/Domo into our lowercase TaskPriority
 * enum (critical | high | medium | low) — or null if unmapped.
 */
function normalizeTaskPriority(raw) {
  if (!raw) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === 'critical' || v === 'urgent') return 'critical';
  if (v === 'high') return 'high';
  if (v === 'medium' || v === 'normal') return 'medium';
  if (v === 'low') return 'low';
  return null;
}

