/**
 * Firestore Sync - Syncs Google Sheets data to Firebase Firestore
 * 
 * Pushes Account Data Raw + resolved references to Firestore every 5 minutes.
 * Bidirectional sync for Account Notes (webapp writes → Firestore → back to sheet).
 * 
 * Uses Firestore REST API with OAuth2 token from the script owner's Google account.
 * Requires the Firebase project to be in the same Google Cloud project or the
 * script owner to have Firestore access.
 */

const FIRESTORE_PROJECT_ID = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID') || '';
const FIRESTORE_BASE_URL = 'https://firestore.googleapis.com/v1/projects/' + FIRESTORE_PROJECT_ID + '/databases/(default)/documents';

/**
 * Main sync function - called every 5 minutes by trigger
 */
function syncToFirestore() {
  if (!FIRESTORE_PROJECT_ID) {
    Logger.log('ERROR: FIREBASE_PROJECT_ID not set in Script Properties');
    return;
  }
  
  const startTime = new Date();
  Logger.log('=== Starting Firestore Sync ===');
  
  try {
    // Step 0: Regenerate Account Data Raw so it's fresh before syncing
    Logger.log('Regenerating Account Data Raw...');
    generateAccountDataRaw();
    
    // Step 1: Load Account Data Raw
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const rawSheet = spreadsheet.getSheetByName('Account Data Raw');
    if (!rawSheet || rawSheet.getLastRow() < 2) {
      Logger.log('No Account Data Raw data to sync');
      return;
    }
    
    const rawData = rawSheet.getDataRange().getValues();
    const rawHeaders = rawData[0];
    Logger.log(`Loaded ${rawData.length - 1} accounts from Account Data Raw`);
    
    // Step 2: Build account ID lookup from Accounts Card Report
    const accountIdMap = buildAccountNameToIdMap(spreadsheet);
    
    // Step 3: Load source tables for resolving references
    const sources = loadSourceTablesForSync(spreadsheet);
    
    // Step 4: Sync notes from Firestore back to sheet (bidirectional)
    syncNotesFromFirestore(spreadsheet, accountIdMap);
    
    // Step 4.5: Sync email domains from Firestore back to mapping sheet (bidirectional)
    syncEmailDomainsFromFirestore(spreadsheet, accountIdMap);
    
    // Reload sources after bidirectional syncs may have updated sheets
    const updatedSources = loadSourceTablesForSync(spreadsheet);
    Object.assign(sources, updatedSources);
    
    // Step 5: Build and push each account document to Firestore
    let synced = 0;
    let errors = 0;
    
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      const accountName = String(row[rawHeaders.indexOf('Account Name')] || '');
      if (!accountName) continue;
      
      const accountId = accountIdMap.get(accountName);
      if (!accountId) {
        Logger.log(`⚠️ No Account ID found for: ${accountName}`);
        continue;
      }
      
      try {
        const doc = buildFirestoreDocument(row, rawHeaders, accountId, accountName, sources);
        writeFirestoreDocument('accounts', accountId, doc);
        synced++;
      } catch (err) {
        Logger.log(`ERROR syncing ${accountName}: ${err.message}`);
        errors++;
      }
      
      // Rate limit to avoid quota issues
      if (i % 10 === 0) Utilities.sleep(100);
    }
    
    // Step 6: Sync current fiscal period to settings doc
    try {
      const fqIdx = rawHeaders.indexOf('Current Fiscal Quarter');
      const fyIdx = rawHeaders.indexOf('Current Fiscal Year');
      if (fqIdx !== -1 && fyIdx !== -1 && rawData.length > 1) {
        // Grab from first account row (same for all accounts)
        let currentFQ = '', currentFY = '';
        for (let i = 1; i < rawData.length; i++) {
          const fq = rawData[i][fqIdx];
          const fy = rawData[i][fyIdx];
          if (fq && fy) {
            currentFQ = String(fq);
            currentFY = String(fy);
            break;
          }
        }
        if (currentFQ && currentFY) {
          writeFirestoreDocument('settings', 'fiscal_period', {
            currentFiscalQuarter: currentFQ,
            currentFiscalYear: currentFY,
            lastUpdated: new Date().toISOString(),
          });
          Logger.log(`Synced fiscal period: FY${currentFY} Q${currentFQ}`);
        }
      }
    } catch (fpErr) {
      Logger.log('Warning: Failed to sync fiscal period: ' + fpErr.message);
    }
    
    const duration = (new Date() - startTime) / 1000;
    Logger.log(`=== Firestore Sync Complete: ${synced} synced, ${errors} errors in ${duration}s ===`);
    
  } catch (error) {
    Logger.log('FATAL ERROR in syncToFirestore: ' + error.message);
    Logger.log(error.stack);
  }
}

/**
 * Build a map of Account Name -> Account ID from Accounts Card Report
 */
function buildAccountNameToIdMap(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Accounts Card Report');
  if (!sheet) return new Map();
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('Id');
  const nameIdx = headers.indexOf('Name');
  
  const map = new Map();
  for (let i = 1; i < data.length; i++) {
    const id = data[i][idIdx];
    const name = data[i][nameIdx];
    if (id && name) map.set(String(name), String(id));
  }
  
  Logger.log(`Built account name-to-ID map with ${map.size} entries`);
  return map;
}

/**
 * Load source tables needed to resolve reference IDs
 */
function loadSourceTablesForSync(spreadsheet) {
  const loadSheet = (name) => {
    const sheet = spreadsheet.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) return { headers: [], rows: [] };
    const data = sheet.getDataRange().getValues();
    return { headers: data[0], rows: data.slice(1) };
  };
  
  return {
    githubTasks: loadSheet('GitHub Tasks'),
    emailComms: loadSheet('Email Communications'),
    calendarEvents: loadSheet('Calendar Events'),
    meetingRecaps: loadSheet('Webhook Meeting Recaps'),
    actionItems: loadSheet('Meeting Action Items'),
    notesStorage: loadSheet('Notes Storage'),
    accountContacts: loadSheet('Account Contacts'),
    emailDomainMapping: loadSheet('Accounts to Email Domains Mapping'),
  };
}

/**
 * Build a Firestore document from an Account Data Raw row + resolved references
 */
function buildFirestoreDocument(row, headers, accountId, accountName, sources) {
  const col = (name) => {
    const idx = headers.indexOf(name);
    return idx !== -1 ? row[idx] : null;
  };
  
  const toDateStr = (v) => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString();
    return String(v);
  };
  
  const toNum = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    if (v instanceof Date) return 0;
    const n = Number(v);
    if (isNaN(n) || n < -999999 || n > 999999) return 0;
    return n;
  };
  
  // Resolve task IDs to full task objects
  const tasks = resolveTasksForAccount(accountId, accountName, sources.githubTasks);
  
  // Resolve email IDs to full email objects (limit 20 most recent)
  const emails = resolveEmailsForAccount(accountId, sources.emailComms);
  
  // Resolve meeting IDs to full meeting objects
  const meetings = resolveMeetingsForAccount(accountId, sources.calendarEvents);
  
  // Resolve meeting recap IDs to full recap objects
  const meetingRecaps = resolveRecapsForAccount(accountId, sources.meetingRecaps, sources.actionItems);
  
  // Get notes from Notes Storage
  const notes = getNotesForAccount(accountId, sources.notesStorage);
  
  // Resolve contacts for account
  const contacts = resolveContactsForAccount(accountId, accountName, sources.accountContacts);
  
  // Calculate meeting cadence from past meetings
  const meetingCadence = calculateMeetingCadence(meetings);
  
  // Get email domains from mapping sheet
  const emailDomains = getEmailDomainsForAccount(accountId, sources.emailDomainMapping);
  
  return {
    accountId: accountId,
    accountName: accountName,
    autoRenewal: String(col('Auto Renewal') || ''),
    renewalDate: toDateStr(col('Renewal Date')),
    renewable: toNum(col('Renewable')),
    forcast: toNum(col('Forcast')),
    status: String(col('Status') || ''),
    stage: String(col('Stage') || ''),
    loginScore: toNum(col('Login Score')),
    auditUsage: toNum(col('Audit Usage')),
    journeyUsage: toNum(col('Journey Usage')),
    forecast: String(col('Forecast') || ''),
    csm: String(col('CSM') || ''),
    ae: String(col('AE') || ''),
    salesEngineer: String(col('Sales Engineer') || ''),
    fiscalQuarter: String(col('Fiscal Quarter') || ''),
    fiscalYear: String(col('Fiscal Year') || ''),
    pricePerPage: toNum(col('Price Per Page')),
    linkToOpp: String(col('Link to Opp') || ''),
    linkToAccount: String(col('Link to Account') || ''),
    engagementScore: toNum(col('Engagement Score')),
    daysSinceLastContact: col('Days Since Last Contact') !== null && col('Days Since Last Contact') !== '' ? toNum(col('Days Since Last Contact')) : null,
    lastEmailDate: toDateStr(col('Last Email Date')),
    avgMeetingAttendancePct: toNum(col('Avg Meeting Attendance %')),
    lastMeetingDate: toDateStr(col('Last Meeting Date')),
    nextMeetingDate: toDateStr(col('Next Meeting Date')),
    emailCountTotal: toNum(col('Email Count (Total)')),
    emailsSent: toNum(col('Emails Sent')),
    emailsReceived: toNum(col('Emails Received')),
    emailCount30d: toNum(col('Email Count (30d)')),
    emailCount90d: toNum(col('Email Count (90d)')),
    meetingsPast: toNum(col('Meetings (Past)')),
    meetingsFuture: toNum(col('Meetings (Future)')),
    meetings30d: toNum(col('Meetings (30d)')),
    githubTasksTotal: toNum(col('GitHub Tasks (Total)')),
    githubTasksOpen: toNum(col('GitHub Tasks (Open)')),
    githubTasksClosed: toNum(col('GitHub Tasks (Closed)')),
    meetingRecapsCount: toNum(col('Meeting Recaps Count')),
    actionItemsCount: toNum(col('Action Items Count')),
    tasks: tasks,
    emails: emails,
    meetings: meetings,
    meetingRecaps: meetingRecaps,
    notes: notes,
    contacts: contacts,
    meetingCadence: meetingCadence,
    emailDomains: emailDomains,
    manualTasks: [], // preserved from Firestore, not overwritten
    lastSynced: new Date().toISOString(),
  };
}

/**
 * Resolve GitHub tasks for an account
 * Matches by Account ID first, then falls back to Account Name matching
 */
function resolveTasksForAccount(accountId, accountName, githubTasks) {
  if (!githubTasks.headers.length) return [];
  
  const h = githubTasks.headers;
  const accountIdIdx = h.indexOf('Account ID');
  const accountNameIdx = h.indexOf('Account Name');
  const taskIdIdx = 0; // Task ID is always first column
  const titleIdx = h.indexOf('Title');
  const statusIdx = h.indexOf('Status');
  const priorityIdx = h.indexOf('Priority');
  const stateIdx = h.indexOf('State');
  const urlIdx = h.indexOf('URL');
  const labelsIdx = h.indexOf('Labels');
  const createdAtIdx = h.indexOf('Created At');
  const updatedAtIdx = h.indexOf('Updated At');
  const closedAtIdx = h.indexOf('Closed At');
  const descIdx = h.indexOf('Description');
  const numberIdx = h.indexOf('Number');
  
  // Match by Account ID OR Account Name (fallback for tasks missing Account ID)
  const matched = githubTasks.rows.filter(r => {
    const rowAccountId = String(r[accountIdIdx] || '').trim();
    const rowAccountName = String(r[accountNameIdx] || '').trim();
    return rowAccountId === accountId || 
           (rowAccountName && rowAccountName === accountName);
  });
  
  return matched.map(r => ({
    taskId: String(r[taskIdIdx] || ''),
    number: r[numberIdx] ? Number(r[numberIdx]) : null,
    title: String(r[titleIdx] || ''),
    description: String(r[descIdx] || '').substring(0, 500),
    status: String(r[statusIdx] || ''),
    priority: String(r[priorityIdx] || ''),
    state: String(r[stateIdx] || '').toUpperCase(),
    url: String(r[urlIdx] || ''),
    labels: String(r[labelsIdx] || ''),
    accountName: accountName,
    createdAt: r[createdAtIdx] ? (r[createdAtIdx] instanceof Date ? r[createdAtIdx].toISOString() : String(r[createdAtIdx])) : '',
    updatedAt: r[updatedAtIdx] ? (r[updatedAtIdx] instanceof Date ? r[updatedAtIdx].toISOString() : String(r[updatedAtIdx])) : '',
    closedAt: r[closedAtIdx] ? (r[closedAtIdx] instanceof Date ? r[closedAtIdx].toISOString() : String(r[closedAtIdx])) : null,
  }));
}

/**
 * Resolve emails for an account (20 most recent)
 */
function resolveEmailsForAccount(accountId, emailComms) {
  if (!emailComms.headers.length) return [];
  
  const h = emailComms.headers;
  const accountIdIdx = h.indexOf('Account ID');
  const messageIdIdx = h.indexOf('Message ID');
  const threadIdIdx = h.indexOf('Thread ID');
  const dateIdx = h.indexOf('Date');
  const fromIdx = h.indexOf('From');
  const fromDomainIdx = h.indexOf('From Domain');
  const toIdx = h.indexOf('To');
  const subjectIdx = h.indexOf('Subject');
  const bodyPreviewIdx = h.indexOf('Body Preview');
  
  // Check both possible column names for Account ID
  let aidIdx = accountIdIdx;
  if (aidIdx === -1) {
    // Try alternate names
    for (let i = 0; i < h.length; i++) {
      if (String(h[i]).toLowerCase().includes('account id')) { aidIdx = i; break; }
    }
  }
  
  const rows = emailComms.rows
    .filter(r => String(r[aidIdx] || '') === accountId)
    .sort((a, b) => {
      const da = a[dateIdx] ? new Date(a[dateIdx]) : new Date(0);
      const db = b[dateIdx] ? new Date(b[dateIdx]) : new Date(0);
      return db - da;
    })
    .slice(0, 20);
  
  return rows.map(r => {
    const fromDomain = String(r[fromDomainIdx] || '').toLowerCase();
    const isOutbound = fromDomain.includes('observepoint.com');
    return {
      messageId: String(r[messageIdIdx] || ''),
      threadId: threadIdIdx !== -1 ? String(r[threadIdIdx] || '') : '',
      date: r[dateIdx] ? (r[dateIdx] instanceof Date ? r[dateIdx].toISOString() : String(r[dateIdx])) : '',
      from: String(r[fromIdx] || ''),
      fromDomain: fromDomain,
      to: String(r[toIdx] || ''),
      subject: String(r[subjectIdx] || ''),
      bodyPreview: String(r[bodyPreviewIdx] || '').substring(0, 300),
      isOutbound: isOutbound,
      accountName: '',
    };
  });
}

/**
 * Resolve calendar events for an account
 */
function resolveMeetingsForAccount(accountId, calendarEvents) {
  if (!calendarEvents.headers.length) return [];
  
  const h = calendarEvents.headers;
  const accountIdIdx = h.indexOf('Account ID');
  const eventIdIdx = h.indexOf('Event ID');
  const titleIdx = h.indexOf('Title');
  const startTimeIdx = h.indexOf('Start Time');
  const endTimeIdx = h.indexOf('End Time');
  const durationIdx = h.indexOf('Duration (hours)');
  const attendeeCountIdx = h.indexOf('Attendee Count');
  const acceptedCountIdx = h.indexOf('Accepted Count');
  const myStatusIdx = h.indexOf('My Status');
  const attendeeNamesIdx = h.indexOf('Attendee Names');
  
  const now = new Date();
  
  const rows = calendarEvents.rows
    .filter(r => String(r[accountIdIdx] || '') === accountId);
  
  // Sort: future first (by start time ascending), then past (by start time descending)
  const future = rows.filter(r => r[startTimeIdx] && new Date(r[startTimeIdx]) >= now)
    .sort((a, b) => new Date(a[startTimeIdx]) - new Date(b[startTimeIdx]))
    .slice(0, 10);
  
  const past = rows.filter(r => r[startTimeIdx] && new Date(r[startTimeIdx]) < now)
    .sort((a, b) => new Date(b[startTimeIdx]) - new Date(a[startTimeIdx]))
    .slice(0, 15);
  
  return [...future, ...past].map(r => ({
    eventId: String(r[eventIdIdx] || ''),
    title: String(r[titleIdx] || ''),
    startTime: r[startTimeIdx] ? (r[startTimeIdx] instanceof Date ? r[startTimeIdx].toISOString() : String(r[startTimeIdx])) : '',
    endTime: r[endTimeIdx] ? (r[endTimeIdx] instanceof Date ? r[endTimeIdx].toISOString() : String(r[endTimeIdx])) : '',
    duration: Number(r[durationIdx]) || 0,
    attendeeCount: Number(r[attendeeCountIdx]) || 0,
    acceptedCount: Number(r[acceptedCountIdx]) || 0,
    accountName: '',
    isPast: r[startTimeIdx] ? new Date(r[startTimeIdx]) < now : true,
    myStatus: String(r[myStatusIdx] || ''),
    attendeeNames: String(r[attendeeNamesIdx] || '').substring(0, 500),
  }));
}

/**
 * Resolve meeting recaps for an account
 */
function resolveRecapsForAccount(accountId, meetingRecaps, actionItems) {
  if (!meetingRecaps.headers.length) return [];
  
  const h = meetingRecaps.headers;
  const accountIdIdx = h.indexOf('Account ID');
  const recapIdIdx = h.indexOf('Meeting Recap ID');
  const titleIdx = h.indexOf('Meeting Title');
  const dateIdx = h.indexOf('Meeting Date');
  const summaryIdx = h.indexOf('Summary');
  const linkIdx = h.indexOf('Meeting Link');
  const myCountIdx = h.indexOf('My Action Items Count');
  const othersCountIdx = h.indexOf('Others Action Items Count');
  const totalCountIdx = h.indexOf('Total Action Items');
  const actualAttendeesIdx = h.indexOf('Actual Attendees');
  const externalAttendeesIdx = h.indexOf('External Attendees');
  const allNamesIdx = h.indexOf('All Names');
  const durationIdx = h.indexOf('Duration');
  const intAttendeesJsonIdx = h.indexOf('Internal Attendees JSON');
  const extAttendeesJsonIdx = h.indexOf('External Attendees JSON');
  
  // Build action items lookup by recap ID
  const aiByRecap = new Map();
  if (actionItems.headers.length) {
    const aiH = actionItems.headers;
    const aiRecapIdx = aiH.indexOf('Meeting Recap ID');
    const aiIndexIdx = aiH.indexOf('Action Item Index');
    const aiTitleIdx = aiH.indexOf('Title');
    const aiDescIdx = aiH.indexOf('Description');
    const aiPriorityIdx = aiH.indexOf('Priority');
    const aiGhIdIdx = aiH.indexOf('GitHub Issue ID');
    const aiGhNumIdx = aiH.indexOf('GitHub Issue Number');
    const aiMeetingTitleIdx = aiH.indexOf('Meeting Title');
    const aiAccountNameIdx = aiH.indexOf('Account Name');
    
    for (const r of actionItems.rows) {
      const rid = String(r[aiRecapIdx] || '');
      if (!rid) continue;
      if (!aiByRecap.has(rid)) aiByRecap.set(rid, []);
      aiByRecap.get(rid).push({
        recapId: rid,
        index: Number(r[aiIndexIdx]) || 0,
        title: String(r[aiTitleIdx] || ''),
        description: String(r[aiDescIdx] || '').substring(0, 500),
        priority: String(r[aiPriorityIdx] || ''),
        githubIssueId: String(r[aiGhIdIdx] || ''),
        githubIssueNumber: r[aiGhNumIdx] ? Number(r[aiGhNumIdx]) : null,
        meetingTitle: String(r[aiMeetingTitleIdx] || ''),
        accountName: String(r[aiAccountNameIdx] || ''),
      });
    }
  }
  
  return meetingRecaps.rows
    .filter(r => String(r[accountIdIdx] || '') === accountId)
    .sort((a, b) => {
      const da = a[dateIdx] ? new Date(a[dateIdx]) : new Date(0);
      const db = b[dateIdx] ? new Date(b[dateIdx]) : new Date(0);
      return db - da;
    })
    .slice(0, 15)
    .map(r => {
      const recapId = String(r[recapIdIdx] || '');
      return {
        recapId: recapId,
        meetingTitle: String(r[titleIdx] || ''),
        meetingDate: r[dateIdx] ? (r[dateIdx] instanceof Date ? r[dateIdx].toISOString() : String(r[dateIdx])) : '',
        summary: String(r[summaryIdx] || '').substring(0, 2000),
        meetingLink: String(r[linkIdx] || ''),
        myActionItemsCount: Number(r[myCountIdx]) || 0,
        othersActionItemsCount: Number(r[othersCountIdx]) || 0,
        totalActionItems: Number(r[totalCountIdx]) || 0,
        actualAttendees: String(r[actualAttendeesIdx] || ''),
        externalAttendees: String(r[externalAttendeesIdx] || ''),
        allNames: String(r[allNamesIdx] || ''),
        duration: String(r[durationIdx] || ''),
        actionItems: aiByRecap.get(recapId) || [],
        internalAttendees: parseAttendeesJson(r[intAttendeesJsonIdx]),
        externalAttendeesDetailed: parseAttendeesJson(r[extAttendeesJsonIdx]),
      };
    });
}

/**
 * Parse attendees JSON from sheet cell, mapping to standardized format
 */
function parseAttendeesJson(cellValue) {
  if (!cellValue) return [];
  try {
    const arr = JSON.parse(String(cellValue));
    if (!Array.isArray(arr)) return [];
    return arr.map(a => ({
      name: a.Name || a.name || '',
      email: a.Email || a.email || '',
      invited: a.Invited !== undefined ? a.Invited : (a.invited !== undefined ? a.invited : true),
      actuallyAttended: a['Actually Attended'] !== undefined ? a['Actually Attended'] : (a.actuallyAttended !== undefined ? a.actuallyAttended : false),
      roles: a.Roles || a.roles || [],
      title: a.Title || a.title || '',
      linkedInUrl: a['LinkedIn URL'] || a.linkedInUrl || '',
      contactId: a['Contact ID'] || a.contactId || '',
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Resolve contacts for an account from Account Contacts sheet
 */
function resolveContactsForAccount(accountId, accountName, accountContacts) {
  if (!accountContacts.headers.length) return [];
  
  const h = accountContacts.headers;
  const emailIdx = h.indexOf('Email');
  const nameIdx = h.indexOf('Name');
  const titleIdx = h.indexOf('Title');
  const rolesIdx = h.indexOf('Roles');
  const linkedInIdx = h.indexOf('LinkedIn URL');
  const contactIdIdx = h.indexOf('Contact ID');
  const aidIdx = h.indexOf('Account ID');
  const anameIdx = h.indexOf('Account Name');
  const notesIdx = h.indexOf('Notes');
  const lastUpdatedIdx = h.indexOf('Last Updated');
  
  return accountContacts.rows
    .filter(r => {
      const rowAid = String(r[aidIdx] || '').trim();
      const rowAname = String(r[anameIdx] || '').trim();
      return rowAid === accountId || rowAname === accountName;
    })
    .map(r => ({
      email: String(r[emailIdx] || '').toLowerCase().trim(),
      name: String(r[nameIdx] || ''),
      title: String(r[titleIdx] || ''),
      roles: String(r[rolesIdx] || '').split(',').map(s => s.trim()).filter(Boolean),
      linkedInUrl: String(r[linkedInIdx] || ''),
      contactId: String(r[contactIdIdx] || ''),
      accountId: accountId,
      accountName: accountName,
      notes: String(r[notesIdx] || ''),
      lastUpdated: r[lastUpdatedIdx] ? (r[lastUpdatedIdx] instanceof Date ? r[lastUpdatedIdx].toISOString() : String(r[lastUpdatedIdx])) : '',
    }));
}

/**
 * Calculate meeting cadence from past meetings.
 * Looks at intervals between meetings over the last 6 months.
 * Returns: 'Weekly', 'Bi-weekly', 'Monthly', 'Ad Hoc', or ''
 */
function calculateMeetingCadence(meetings) {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 86400000);
  
  // Filter to past meetings in last 6 months
  const pastMeetings = meetings
    .filter(m => m.isPast && m.startTime)
    .map(m => new Date(m.startTime))
    .filter(d => d >= sixMonthsAgo && d <= now)
    .sort((a, b) => a - b);
  
  if (pastMeetings.length < 2) return pastMeetings.length === 1 ? 'Ad Hoc' : '';
  
  // Calculate intervals in days between consecutive meetings
  const intervals = [];
  for (let i = 1; i < pastMeetings.length; i++) {
    const days = (pastMeetings[i] - pastMeetings[i - 1]) / 86400000;
    intervals.push(days);
  }
  
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  
  // Calculate standard deviation to check consistency
  const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / avgInterval; // coefficient of variation
  
  // If too irregular (CV > 0.6), it's ad hoc
  if (cv > 0.6 && pastMeetings.length < 6) return 'Ad Hoc';
  
  // Classify based on average interval
  if (avgInterval <= 9) return 'Weekly';
  if (avgInterval <= 18) return 'Bi-weekly';
  if (avgInterval <= 40) return 'Monthly';
  if (avgInterval <= 70) return 'Bi-monthly';
  return 'Ad Hoc';
}

/**
 * Get email domains for an account from the mapping sheet
 */
function getEmailDomainsForAccount(accountId, emailDomainMapping) {
  if (!emailDomainMapping.headers.length) return '';
  
  const h = emailDomainMapping.headers;
  const aidIdx = h.indexOf('Account ID');
  const domainsIdx = h.indexOf('Email Domains');
  
  for (const r of emailDomainMapping.rows) {
    if (String(r[aidIdx] || '').trim() === accountId) {
      return String(r[domainsIdx] || '');
    }
  }
  
  return '';
}

/**
 * Get notes for an account from Notes Storage sheet
 */
function getNotesForAccount(accountId, notesStorage) {
  if (!notesStorage.headers.length) return { content: '', lastSaved: null };
  
  const h = notesStorage.headers;
  const aidIdx = h.indexOf('Account ID');
  const contentIdx = h.indexOf('Notes Content');
  const lastSavedIdx = h.indexOf('Last Saved');
  
  for (const r of notesStorage.rows) {
    if (String(r[aidIdx] || '').trim() === accountId) {
      return {
        content: String(r[contentIdx] || ''),
        lastSaved: r[lastSavedIdx] ? (r[lastSavedIdx] instanceof Date ? r[lastSavedIdx].toISOString() : String(r[lastSavedIdx])) : null,
      };
    }
  }
  
  return { content: '', lastSaved: null };
}

/**
 * Sync notes FROM Firestore back to Google Sheets (bidirectional)
 * If the webapp edited notes (source = 'webapp'), update the sheet
 */
function syncNotesFromFirestore(spreadsheet, accountIdMap) {
  Logger.log('Checking Firestore for webapp-edited notes...');
  
  const token = ScriptApp.getOAuthToken();
  const notesSheet = getNotesStorageSheet();
  const notesData = notesSheet.getDataRange().getValues();
  const notesHeaders = notesData[0];
  const aidIdx = notesHeaders.indexOf('Account ID');
  const contentIdx = notesHeaders.indexOf('Notes Content');
  const lastSavedIdx = notesHeaders.indexOf('Last Saved');
  
  // Build sheet notes map: accountId -> { content, lastSaved, rowIndex }
  const sheetNotes = new Map();
  for (let i = 1; i < notesData.length; i++) {
    const aid = String(notesData[i][aidIdx] || '').trim();
    if (aid) {
      sheetNotes.set(aid, {
        content: notesData[i][contentIdx] || '',
        lastSaved: notesData[i][lastSavedIdx] ? new Date(notesData[i][lastSavedIdx]) : null,
        rowIndex: i + 1, // 1-indexed sheet row
      });
    }
  }
  
  // Check each account in Firestore for newer notes
  let updated = 0;
  for (const [accountName, accountId] of accountIdMap) {
    try {
      const fsDoc = readFirestoreDocument('accounts', accountId, token);
      if (!fsDoc || !fsDoc.fields || !fsDoc.fields.notes) continue;
      
      const fsNotes = fsDoc.fields.notes.mapValue ? fsDoc.fields.notes.mapValue.fields : null;
      if (!fsNotes) continue;
      
      const fsSource = fsNotes.source ? fsNotes.source.stringValue : '';
      if (fsSource !== 'webapp') continue; // Only sync webapp-edited notes back
      
      const fsContent = fsNotes.content ? fsNotes.content.stringValue : '';
      const fsLastSaved = fsNotes.lastSaved ? fsNotes.lastSaved.stringValue : '';
      
      if (!fsContent || !fsLastSaved) continue;
      
      const fsDate = new Date(fsLastSaved);
      const sheetEntry = sheetNotes.get(accountId);
      
      // If Firestore note is newer than sheet note, update sheet
      if (!sheetEntry || !sheetEntry.lastSaved || fsDate > sheetEntry.lastSaved) {
        if (sheetEntry) {
          // Update existing row
          notesSheet.getRange(sheetEntry.rowIndex, contentIdx + 1).setValue(fsContent);
          notesSheet.getRange(sheetEntry.rowIndex, lastSavedIdx + 1).setValue(fsDate);
        } else {
          // Add new row
          notesSheet.appendRow([accountId, accountName, fsContent, fsDate]);
        }
        updated++;
        Logger.log(`✓ Synced notes from webapp for: ${accountName}`);
        
        // Clear the 'source' flag in Firestore so we don't re-sync
        const clearSourceUrl = FIRESTORE_BASE_URL + '/accounts/' + accountId + '?updateMask.fieldPaths=notes.source&currentDocument.exists=true';
        UrlFetchApp.fetch(clearSourceUrl, {
          method: 'patch',
          contentType: 'application/json',
          headers: { 'Authorization': 'Bearer ' + token },
          payload: JSON.stringify({
            fields: {
              notes: {
                mapValue: {
                  fields: {
                    source: { stringValue: 'synced' }
                  }
                }
              }
            }
          }),
          muteHttpExceptions: true,
        });
      }
    } catch (err) {
      // Silently skip — document may not exist yet
    }
  }
  
  if (updated > 0) {
    Logger.log(`Synced ${updated} notes from webapp back to sheet`);
  }
}

/**
 * Sync email domains FROM Firestore back to the mapping sheet (bidirectional).
 * If the webapp edited email domains (emailDomainsSource = 'webapp'), update the sheet.
 */
function syncEmailDomainsFromFirestore(spreadsheet, accountIdMap) {
  Logger.log('Checking Firestore for webapp-edited email domains...');
  
  const token = ScriptApp.getOAuthToken();
  const mappingSheet = spreadsheet.getSheetByName('Accounts to Email Domains Mapping');
  if (!mappingSheet) {
    Logger.log('No email domains mapping sheet found');
    return;
  }
  
  const mappingData = mappingSheet.getDataRange().getValues();
  const mappingHeaders = mappingData[0];
  const aidIdx = mappingHeaders.indexOf('Account ID');
  const domainsIdx = mappingHeaders.indexOf('Email Domains');
  
  // Build sheet map: accountId -> rowIndex
  const sheetMap = new Map();
  for (let i = 1; i < mappingData.length; i++) {
    const aid = String(mappingData[i][aidIdx] || '').trim();
    if (aid) {
      sheetMap.set(aid, i + 1); // 1-indexed row
    }
  }
  
  let updated = 0;
  for (const [accountName, accountId] of accountIdMap) {
    try {
      const fsDoc = readFirestoreDocument('accounts', accountId, token);
      if (!fsDoc || !fsDoc.fields) continue;
      
      const fsSource = fsDoc.fields.emailDomainsSource ? fsDoc.fields.emailDomainsSource.stringValue : '';
      if (fsSource !== 'webapp') continue;
      
      const fsDomains = fsDoc.fields.emailDomains ? fsDoc.fields.emailDomains.stringValue : '';
      
      const rowNum = sheetMap.get(accountId);
      if (rowNum) {
        // Update existing row
        mappingSheet.getRange(rowNum, domainsIdx + 1).setValue(fsDomains);
      } else {
        // Add new row (account wasn't in the mapping sheet yet)
        mappingSheet.appendRow([accountId, accountName, fsDomains]);
      }
      updated++;
      Logger.log(`✓ Synced email domains from webapp for: ${accountName}`);
      
      // Clear the source flag
      const clearUrl = FIRESTORE_BASE_URL + '/accounts/' + accountId + '?updateMask.fieldPaths=emailDomainsSource&currentDocument.exists=true';
      UrlFetchApp.fetch(clearUrl, {
        method: 'patch',
        contentType: 'application/json',
        headers: { 'Authorization': 'Bearer ' + token },
        payload: JSON.stringify({
          fields: {
            emailDomainsSource: { stringValue: 'synced' }
          }
        }),
        muteHttpExceptions: true,
      });
    } catch (err) {
      // Silently skip
    }
  }
  
  if (updated > 0) {
    Logger.log(`Synced ${updated} email domains from webapp back to sheet`);
  }
}

// === Firestore REST API Helpers ===

/**
 * Write a document to Firestore using REST API
 */
function writeFirestoreDocument(collection, docId, data) {
  const token = ScriptApp.getOAuthToken();
  const url = FIRESTORE_BASE_URL + '/' + collection + '/' + docId;
  
  const firestoreFields = convertToFirestoreFields(data);
  
  const options = {
    method: 'patch',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + token },
    payload: JSON.stringify({ fields: firestoreFields }),
    muteHttpExceptions: true,
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  
  if (code !== 200) {
    const body = response.getContentText();
    throw new Error(`Firestore write failed (${code}): ${body.substring(0, 200)}`);
  }
}

/**
 * Read a document from Firestore using REST API
 */
function readFirestoreDocument(collection, docId, token) {
  if (!token) token = ScriptApp.getOAuthToken();
  const url = FIRESTORE_BASE_URL + '/' + collection + '/' + docId;
  
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true,
  });
  
  if (response.getResponseCode() !== 200) return null;
  return JSON.parse(response.getContentText());
}

/**
 * Convert a JavaScript object to Firestore field format
 */
function convertToFirestoreFields(obj) {
  const fields = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip fields managed by the webapp, not overwritten by sync
    if (key === 'manualTasks') continue;
    if (key === 'successCriteria') continue;
    if (key === 'contactsSource') continue;
    if (key === 'emailDomainsSource') continue;
    if (key === 'emailDomainsLastSaved') continue;
    
    fields[key] = convertToFirestoreValue(value);
  }
  
  return fields;
}

/**
 * Convert a JavaScript value to a Firestore value
 */
function convertToFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(v => convertToFirestoreValue(v))
      }
    };
  }
  if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = convertToFirestoreValue(v);
    }
    return { mapValue: { fields: fields } };
  }
  return { stringValue: String(value) };
}

// === Trigger Setup ===

/**
 * Setup automatic Firestore sync trigger (every 5 minutes)
 */
function setupFirestoreSyncTrigger() {
  // Remove existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncToFirestore') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  ScriptApp.newTrigger('syncToFirestore')
    .timeBased()
    .everyMinutes(5)
    .create();
  
  Logger.log('Firestore sync trigger created (runs every 5 minutes)');
  
  SpreadsheetApp.getUi().alert(
    'Firestore Sync Enabled',
    'Account data will now sync to Firestore every 5 minutes.\n\n' +
    'Make sure FIREBASE_PROJECT_ID is set in Script Properties.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Remove Firestore sync trigger
 */
function removeFirestoreSyncTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncToFirestore') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });
  
  Logger.log(`Removed ${removed} Firestore sync trigger(s)`);
  SpreadsheetApp.getUi().alert(
    'Firestore Sync Disabled',
    `Removed ${removed} sync trigger(s).`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Set Firebase Project ID in Script Properties
 */
function setFirebaseProjectId() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Set Firebase Project ID',
    'Enter your Firebase/GCP Project ID:\n\n' +
    '(Found at: https://console.firebase.google.com)',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const projectId = response.getResponseText().trim();
    if (projectId) {
      PropertiesService.getScriptProperties().setProperty('FIREBASE_PROJECT_ID', projectId);
      ui.alert('Project ID Saved', '✅ Firebase Project ID saved: ' + projectId, ui.ButtonSet.OK);
    }
  }
}

/**
 * Manual sync with UI feedback
 */
function syncToFirestoreManual() {
  try {
    syncToFirestore();
    SpreadsheetApp.getUi().alert(
      'Firestore Sync Complete',
      '✅ Account data has been synced to Firestore.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      'Sync Failed',
      '❌ Error: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
