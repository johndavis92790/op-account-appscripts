/**
 * Account Data Raw - Consolidated Account View
 * 
 * Combines data from multiple sheets into a single comprehensive view:
 * - Accounts Card Report (base account data)
 * - Renewal Opportunities (renewal details)
 * - GitHub Tasks (aggregated by account)
 * - Email Communications (aggregated by account)
 * - Calendar Events (aggregated by account)
 */

const ACCOUNT_DATA_RAW_SHEET = 'Account Data Raw';

/**
 * Main function - Generate consolidated account data
 */
function generateAccountDataRaw() {
  const startTime = new Date();
  Logger.log('=== Starting Account Data Raw Generation ===');
  
  try {
    Logger.log('Step 1: Loading source data...');
    const sourceData = loadSourceData();
    
    Logger.log('Step 2: Building consolidated rows...');
    const consolidatedData = buildConsolidatedData(sourceData);
    
    Logger.log('Step 3: Writing to sheet...');
    writeAccountDataRaw(consolidatedData);
    
    Logger.log('Step 4: Analyzing cell sizes...');
    const sizeStats = analyzeCellSizes(consolidatedData);
    
    const duration = (new Date() - startTime) / 1000;
    Logger.log(`=== Generation Complete in ${duration}s ===`);
    
    return {
      success: true,
      accountCount: consolidatedData.length - 1,
      duration: duration,
      sizeStats: sizeStats
    };
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * Load all source data from sheets
 */
function loadSourceData() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // Load Accounts Card Report
  const accountsSheet = spreadsheet.getSheetByName(ACCOUNTS_CARD_SHEET_NAME);
  if (!accountsSheet) throw new Error('Accounts Card Report sheet not found');
  const accountsData = accountsSheet.getDataRange().getValues();
  const accountsHeaders = accountsData[0];
  
  // Load Opptys Report
  const opptysSheet = spreadsheet.getSheetByName(OPPTYS_REPORT_SHEET_NAME);
  if (!opptysSheet) throw new Error('Opptys Report sheet not found');
  const opptysData = opptysSheet.getDataRange().getValues();
  const opptysHeaders = opptysData[0];
  
  // Load Renewal Opportunities
  const renewalSheet = spreadsheet.getSheetByName(RENEWAL_OPPORTUNITIES_SHEET_NAME);
  if (!renewalSheet) throw new Error('Renewal Opportunities sheet not found');
  const renewalData = renewalSheet.getDataRange().getValues();
  const renewalHeaders = renewalData[0];
  
  // Load GitHub Tasks
  const githubSheet = spreadsheet.getSheetByName('GitHub Tasks');
  const githubData = githubSheet ? githubSheet.getDataRange().getValues() : [[]];
  const githubHeaders = githubData.length > 0 ? githubData[0] : [];
  
  // Load Email Communications
  const emailSheet = spreadsheet.getSheetByName('Email Communications');
  const emailData = emailSheet ? emailSheet.getDataRange().getValues() : [[]];
  const emailHeaders = emailData.length > 0 ? emailData[0] : [];
  
  // Load Calendar Events
  const calendarSheet = spreadsheet.getSheetByName('Calendar Events');
  const calendarData = calendarSheet ? calendarSheet.getDataRange().getValues() : [[]];
  const calendarHeaders = calendarData.length > 0 ? calendarData[0] : [];
  
  // Load Webhook Meeting Recaps
  const meetingRecapsSheet = spreadsheet.getSheetByName('Webhook Meeting Recaps');
  const meetingRecapsData = meetingRecapsSheet ? meetingRecapsSheet.getDataRange().getValues() : [[]];
  const meetingRecapsHeaders = meetingRecapsData.length > 0 ? meetingRecapsData[0] : [];
  
  // Load Meeting Action Items
  const actionItemsSheet = spreadsheet.getSheetByName('Meeting Action Items');
  const actionItemsData = actionItemsSheet ? actionItemsSheet.getDataRange().getValues() : [[]];
  const actionItemsHeaders = actionItemsData.length > 0 ? actionItemsData[0] : [];
  
  Logger.log(`Loaded: ${accountsData.length} accounts, ${opptysData.length} opportunities, ${renewalData.length} renewals`);
  Logger.log(`Loaded: ${githubData.length} tasks, ${emailData.length} emails, ${calendarData.length} events`);
  Logger.log(`Loaded: ${meetingRecapsData.length} meeting recaps, ${actionItemsData.length} action items`);
  
  return {
    accounts: { data: accountsData, headers: accountsHeaders },
    opptys: { data: opptysData, headers: opptysHeaders },
    renewals: { data: renewalData, headers: renewalHeaders },
    github: { data: githubData, headers: githubHeaders },
    emails: { data: emailData, headers: emailHeaders },
    calendar: { data: calendarData, headers: calendarHeaders },
    meetingRecaps: { data: meetingRecapsData, headers: meetingRecapsHeaders },
    actionItems: { data: actionItemsData, headers: actionItemsHeaders }
  };
}

/**
 * Build consolidated data rows
 */
function buildConsolidatedData(sourceData) {
  // Build lookup maps
  const renewalOpportunityMap = buildRenewalOpportunityMap(sourceData.renewals);
  const oppIdToNameMap = buildOppIdToNameMap(sourceData.opptys);
  const renewalDetailMap = buildRenewalDetailMap(sourceData.renewals);
  const githubByAccountMap = buildGitHubByAccountMap(sourceData.github);
  const emailsByAccountMap = buildEmailsByAccountMap(sourceData.emails);
  const calendarByAccountMap = buildCalendarByAccountMap(sourceData.calendar);
  const meetingRecapsByAccountMap = buildMeetingRecapsByAccountMap(sourceData.meetingRecaps);
  const actionItemsByAccountMap = buildActionItemsByAccountMap(sourceData.actionItems);
  
  // Get column indices from Accounts Card Report
  const accountIdIdx = sourceData.accounts.headers.indexOf('Id');
  const accountNameIdx = sourceData.accounts.headers.indexOf('Name');
  const nextRenewalOppIdIdx = sourceData.accounts.headers.indexOf('next_renewal_opportunity_id');
  const autoRenewalIdx = sourceData.accounts.headers.indexOf('Auto_Renewal__c');
  
  // Build output headers
  const headers = [
    'Account Name',
    'Link to SF Opportunity',
    'Auto Renewal',
    'Renewal Date',
    'Renewable',
    'Forcast',
    'Status',
    'Stage',
    'Amount (gross)',
    'Login Score',
    'Audit Usage',
    'Journey Usage',
    'Forecast',
    'CSM',
    'AE',
    'Support Type',
    // Engagement metrics
    'Engagement Score',
    'Days Since Last Contact',
    'Email Count (Total)',
    'Emails Sent',
    'Emails Received',
    'Email Count (30d)',
    'Email Count (90d)',
    'Last Email Date',
    'Meetings (Past)',
    'Meetings (Future)',
    'Meetings (30d)',
    'Avg Meeting Attendance %',
    'Last Meeting Date',
    'Next Meeting Date',
    'GitHub Tasks (Total)',
    'GitHub Tasks (Open)',
    'GitHub Tasks (Closed)',
    'Meeting Recaps Count',
    'Action Items Count',
    // Enriched text for AI context
    'Recent Email Snippets',
    'Recent Task Summaries',
    'Recent Recap Summaries',
    // Raw JSON reference blobs
    'Tasks',
    'Emails',
    'Meetings',
    'Meeting Recaps',
    'Meeting Action Items',
    // AI-generated summary (formula injected post-write)
    'AI Engagement Summary',
    // Hash of content-based inputs — used to skip AI() regeneration when nothing meaningful changed
    'AI Prompt Hash'
  ];
  
  const rows = [headers];
  
  // Process only ACTIVE accounts (those in Renewal Opportunities)
  for (let i = 1; i < sourceData.accounts.data.length; i++) {
    const accountRow = sourceData.accounts.data[i];
    const accountId = accountRow[accountIdIdx];
    const accountName = accountRow[accountNameIdx];
    const nextRenewalOppId = accountRow[nextRenewalOppIdIdx];
    const autoRenewal = accountRow[autoRenewalIdx];
    
    // Only include accounts with opportunities in Renewal Opportunities sheet
    const oppName = oppIdToNameMap.get(nextRenewalOppId);
    if (!oppName || !renewalOpportunityMap.has(oppName)) {
      continue; // Skip inactive accounts
    }
    
    const renewalLink = renewalOpportunityMap.get(oppName);
    const renewalDetails = renewalDetailMap.get(oppName) || {};
    
    // Get aggregated data
    const tasks = githubByAccountMap.get(accountId) || [];
    const emails = emailsByAccountMap.get(accountId) || [];
    const meetings = calendarByAccountMap.get(accountId) || [];
    const meetingRecaps = meetingRecapsByAccountMap.get(accountId) || [];
    const actionItems = actionItemsByAccountMap.get(accountId) || [];
    
    // Build JSON strings
    const tasksJson = buildTasksJson(tasks);
    const emailsJson = buildEmailsJson(emails);
    const meetingsJson = buildMeetingsJson(meetings);
    const meetingRecapsJson = buildMeetingRecapsJson(meetingRecaps);
    const actionItemsJson = buildActionItemsJson(actionItems);
    
    // Build enriched text summaries for AI context
    const recentEmailSnippets = buildRecentEmailSnippets(emails);
    const recentTaskSummaries = buildRecentTaskSummaries(tasks);
    const recentRecapSummaries = buildRecentRecapSummaries(meetingRecaps);
    
    // Compute engagement metrics
    const metrics = computeEngagementMetrics(tasks, emails, meetings, meetingRecaps, actionItems);
    
    rows.push([
      accountName,
      renewalLink,
      autoRenewal || '',
      renewalDetails.renewalDate || '',
      renewalDetails.renewable || '',
      renewalDetails.forcast || '',
      renewalDetails.status || '',
      renewalDetails.stage || '',
      renewalDetails.amountGross || '',
      renewalDetails.loginScore || '',
      renewalDetails.auditUsage || '',
      renewalDetails.journeyUsage || '',
      renewalDetails.forecast || '',
      renewalDetails.csm || '',
      renewalDetails.ae || '',
      renewalDetails.supportType || '',
      // Engagement metrics
      metrics.engagementScore,
      metrics.daysSinceLastContact !== null ? metrics.daysSinceLastContact : '',
      metrics.emailTotal,
      metrics.emailsSent,
      metrics.emailsReceived,
      metrics.emails30d,
      metrics.emails90d,
      metrics.lastEmailDate || '',
      metrics.meetingsPast,
      metrics.meetingsFuture,
      metrics.meetings30d,
      metrics.avgAttendancePct,
      metrics.lastMeetingDate || '',
      metrics.nextMeetingDate || '',
      metrics.tasksTotal,
      metrics.tasksOpen,
      metrics.tasksClosed,
      metrics.recapsCount,
      metrics.actionItemsCount,
      // Enriched text for AI context
      recentEmailSnippets,
      recentTaskSummaries,
      recentRecapSummaries,
      // Raw JSON reference blobs
      tasksJson,
      emailsJson,
      meetingsJson,
      meetingRecapsJson,
      actionItemsJson,
      // AI Engagement Summary - formula injected by writeAccountDataRaw after setValues
      '',
      // AI Prompt Hash - written by writeAccountDataRaw after setValues
      ''
    ]);
  }
  
  // Sort by Renewal Date (column index 3), closest first
  const dataRows = rows.slice(1);
  dataRows.sort((a, b) => {
    const dateA = a[3] ? new Date(a[3]) : new Date('9999-12-31');
    const dateB = b[3] ? new Date(b[3]) : new Date('9999-12-31');
    return dateA - dateB;
  });
  
  return [headers, ...dataRows];
}

/**
 * Build map of Opportunity Name -> Link to SF Opportunity
 */
function buildRenewalOpportunityMap(renewals) {
  const map = new Map();
  const linkColIdx = renewals.headers.indexOf('Link to SF Opportunity');
  
  for (let i = 1; i < renewals.data.length; i++) {
    const linkCell = renewals.data[i][linkColIdx];
    if (linkCell) {
      const oppName = extractOpportunityNameFromLink(linkCell);
      if (oppName) {
        map.set(oppName, linkCell);
      }
    }
  }
  
  Logger.log(`Built renewal opportunity map with ${map.size} entries`);
  return map;
}

/**
 * Build map of Opportunity ID -> Opportunity Name
 */
function buildOppIdToNameMap(opptys) {
  const map = new Map();
  const oppIdIdx = opptys.headers.indexOf('Id');
  const oppNameIdx = opptys.headers.indexOf('Name');
  
  for (let i = 1; i < opptys.data.length; i++) {
    const oppId = opptys.data[i][oppIdIdx];
    const oppName = opptys.data[i][oppNameIdx];
    if (oppId && oppName) {
      map.set(oppId, oppName);
    }
  }
  
  Logger.log(`Built opportunity ID to name map with ${map.size} entries`);
  return map;
}

/**
 * Build map of Opportunity Name -> Renewal Details
 */
function buildRenewalDetailMap(renewals) {
  const map = new Map();
  const headers = renewals.headers;
  
  const linkColIdx = headers.indexOf('Link to SF Opportunity');
  const renewalDateIdx = headers.indexOf('Renewal Date');
  const renewableIdx = headers.indexOf('Renewable');
  const forcastIdx = headers.indexOf('Forcast');
  const statusIdx = headers.indexOf('Status');
  const stageIdx = headers.indexOf('Stage');
  const amountGrossIdx = headers.indexOf('Amount (gross)');
  const loginScoreIdx = headers.indexOf('Login Score');
  const auditUsageIdx = headers.indexOf('Audit Usage');
  const journeyUsageIdx = headers.indexOf('Journey Usage');
  const forecastIdx = headers.indexOf('Forecast');
  const csmIdx = headers.indexOf('CSM');
  const aeIdx = headers.indexOf('AE');
  const supportTypeIdx = headers.indexOf('Support Type');
  
  for (let i = 1; i < renewals.data.length; i++) {
    const row = renewals.data[i];
    const linkCell = row[linkColIdx];
    const oppName = extractOpportunityNameFromLink(linkCell);
    
    if (oppName) {
      map.set(oppName, {
        renewalDate: renewalDateIdx !== -1 ? row[renewalDateIdx] : '',
        renewable: renewableIdx !== -1 ? row[renewableIdx] : '',
        forcast: forcastIdx !== -1 ? row[forcastIdx] : '',
        status: statusIdx !== -1 ? row[statusIdx] : '',
        stage: stageIdx !== -1 ? row[stageIdx] : '',
        amountGross: amountGrossIdx !== -1 ? row[amountGrossIdx] : '',
        loginScore: loginScoreIdx !== -1 ? row[loginScoreIdx] : '',
        auditUsage: auditUsageIdx !== -1 ? row[auditUsageIdx] : '',
        journeyUsage: journeyUsageIdx !== -1 ? row[journeyUsageIdx] : '',
        forecast: forecastIdx !== -1 ? row[forecastIdx] : '',
        csm: csmIdx !== -1 ? row[csmIdx] : '',
        ae: aeIdx !== -1 ? row[aeIdx] : '',
        supportType: supportTypeIdx !== -1 ? row[supportTypeIdx] : ''
      });
    }
  }
  
  Logger.log(`Built renewal detail map with ${map.size} entries`);
  return map;
}

/**
 * Build map of Account ID -> GitHub Task IDs
 */
function buildGitHubByAccountMap(github) {
  const map = new Map();
  
  if (github.data.length <= 1) {
    Logger.log('No GitHub tasks data available');
    return map;
  }
  
  const headers = github.headers;
  const accountIdIdx = headers.indexOf('Account ID');
  const stateIdx = headers.indexOf('State');
  const statusIdx = headers.indexOf('Status');
  const titleIdx = headers.indexOf('Title');
  const createdAtIdx = headers.indexOf('Created At');
  const updatedAtIdx = headers.indexOf('Updated At');
  
  for (let i = 1; i < github.data.length; i++) {
    const row = github.data[i];
    const accountId = row[accountIdIdx];
    
    if (accountId) {
      if (!map.has(accountId)) {
        map.set(accountId, []);
      }
      
      const taskId = row[0];
      const state = stateIdx !== -1 ? String(row[stateIdx] || '').toUpperCase() : '';
      const status = statusIdx !== -1 ? row[statusIdx] : '';
      const title = titleIdx !== -1 ? String(row[titleIdx] || '') : '';
      const createdAt = createdAtIdx !== -1 ? row[createdAtIdx] : '';
      const updatedAt = updatedAtIdx !== -1 ? row[updatedAtIdx] : '';
      map.get(accountId).push({
        taskId: taskId,
        state: state,
        status: status,
        title: title,
        createdAt: createdAt,
        updatedAt: updatedAt
      });
    }
  }
  
  Logger.log(`Built GitHub map with ${map.size} accounts having tasks`);
  return map;
}

/**
 * Build map of Account ID -> Email Message IDs (20 most recent)
 */
function buildEmailsByAccountMap(emails) {
  const map = new Map();
  
  if (emails.data.length <= 1) {
    Logger.log('No email data available');
    return map;
  }
  
  const headers = emails.headers;
  const accountIdIdx = headers.indexOf('Account ID');
  const messageIdIdx = headers.indexOf('Message ID');
  const dateIdx = headers.indexOf('Date');
  
  if (accountIdIdx === -1) {
    Logger.log('ERROR: Account ID column not found in Email Communications');
    Logger.log(`Available columns: ${headers.join(', ')}`);
    return map;
  }
  
  if (messageIdIdx === -1) {
    Logger.log('ERROR: Message ID column not found in Email Communications');
    return map;
  }
  
  const fromIdx = headers.indexOf('From');
  const fromDomainIdx = headers.indexOf('From Domain');
  const subjectIdx = headers.indexOf('Subject');
  const bodyPreviewIdx = headers.indexOf('Body Preview');
  
  // Group emails by account
  const emailsByAccount = new Map();
  let emptyAccountIdCount = 0;
  let validEmailCount = 0;
  
  for (let i = 1; i < emails.data.length; i++) {
    const row = emails.data[i];
    const accountId = row[accountIdIdx];
    
    if (!accountId || accountId === '') {
      emptyAccountIdCount++;
      continue;
    }
    
    // Skip if accountId looks like a name instead of an ID
    if (typeof accountId === 'string' && 
        !accountId.startsWith('001') && 
        !accountId.startsWith('006') && 
        !accountId.startsWith('0010') && 
        !accountId.startsWith('0016')) {
      if (i <= 3) {
        Logger.log(`⚠️ Row ${i + 1}: Account ID appears to be a name: "${accountId}"`);
        Logger.log(`   → Run "Fix Email Account References" to convert names to IDs`);
      }
      continue;
    }
    
    if (!emailsByAccount.has(accountId)) {
      emailsByAccount.set(accountId, []);
    }
    
    const messageId = messageIdIdx !== -1 ? row[messageIdIdx] : '';
    const from = fromIdx !== -1 ? String(row[fromIdx] || '') : '';
    const fromDomain = fromDomainIdx !== -1 ? String(row[fromDomainIdx] || '').toLowerCase() : '';
    const subject = subjectIdx !== -1 ? String(row[subjectIdx] || '') : '';
    const bodyPreview = bodyPreviewIdx !== -1 ? String(row[bodyPreviewIdx] || '').substring(0, 200) : '';
    // Outbound = sent by us (observepoint.com domain)
    const isOutbound = fromDomain.includes('observepoint.com');
    emailsByAccount.get(accountId).push({
      messageId: messageId,
      date: dateIdx !== -1 ? row[dateIdx] : '',
      isOutbound: isOutbound,
      subject: subject,
      bodyPreview: bodyPreview
    });
    validEmailCount++;
  }
  
  // Sort by date (most recent first) and keep all for metrics (cap at 500 to avoid memory issues)
  for (const [accountId, accountEmails] of emailsByAccount) {
    accountEmails.sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateB - dateA;
    });
    
    map.set(accountId, accountEmails.slice(0, 500));
  }
  
  Logger.log(`Built email map with ${map.size} accounts having emails`);
  Logger.log(`  Valid emails: ${validEmailCount}`);
  Logger.log(`  Empty Account IDs: ${emptyAccountIdCount}`);
  Logger.log(`  Skipped (names instead of IDs): ${emails.data.length - 1 - validEmailCount - emptyAccountIdCount}`);
  
  if (map.size === 0 && emails.data.length > 1) {
    Logger.log('⚠️ WARNING: No emails mapped! Account ID column may contain names instead of IDs.');
    Logger.log('   → Run "Fix Email Account References" from the Data Integrity menu');
  }
  
  return map;
}

/**
 * Build map of Account ID -> Calendar Event IDs (10 most recent past + 10 upcoming)
 */
function buildCalendarByAccountMap(calendar) {
  const map = new Map();
  
  if (calendar.data.length <= 1) {
    Logger.log('No calendar data available');
    return map;
  }
  
  const headers = calendar.headers;
  const accountIdIdx = headers.indexOf('Account ID');
  const eventIdIdx = headers.indexOf('Event ID');
  const startTimeIdx = headers.indexOf('Start Time');
  const acceptedCountIdx = headers.indexOf('Accepted Count');
  const attendeeCountIdx = headers.indexOf('Attendee Count');
  
  const now = new Date();
  
  // Group events by account
  const eventsByAccount = new Map();
  for (let i = 1; i < calendar.data.length; i++) {
    const row = calendar.data[i];
    const accountId = row[accountIdIdx];
    
    if (accountId) {
      if (!eventsByAccount.has(accountId)) {
        eventsByAccount.set(accountId, { past: [], future: [] });
      }
      
      const startTime = startTimeIdx !== -1 ? row[startTimeIdx] : null;
      const startDate = startTime ? new Date(startTime) : null;
      
      const event = {
        eventId: eventIdIdx !== -1 ? row[eventIdIdx] : '',
        startTime: startTime || '',
        acceptedCount: acceptedCountIdx !== -1 ? (Number(row[acceptedCountIdx]) || 0) : 0,
        attendeeCount: attendeeCountIdx !== -1 ? (Number(row[attendeeCountIdx]) || 0) : 0
      };
      
      if (startDate && startDate < now) {
        eventsByAccount.get(accountId).past.push(event);
      } else {
        eventsByAccount.get(accountId).future.push(event);
      }
    }
  }
  
  // Sort and combine: 10 most recent past + 10 upcoming future
  for (const [accountId, events] of eventsByAccount) {
    // Sort past events (most recent first)
    events.past.sort((a, b) => {
      const dateA = a.startTime ? new Date(a.startTime) : new Date(0);
      const dateB = b.startTime ? new Date(b.startTime) : new Date(0);
      return dateB - dateA;
    });
    
    // Sort future events (soonest first)
    events.future.sort((a, b) => {
      const dateA = a.startTime ? new Date(a.startTime) : new Date('9999-12-31');
      const dateB = b.startTime ? new Date(b.startTime) : new Date('9999-12-31');
      return dateA - dateB;
    });
    
    const combined = [
      ...events.past.slice(0, 50),
      ...events.future.slice(0, 50)
    ];
    
    map.set(accountId, combined);
  }
  
  Logger.log(`Built calendar map with ${map.size} accounts having events`);
  return map;
}

/**
 * Compute engagement metrics for a single account
 * @param {Array} tasks - GitHub tasks array
 * @param {Array} emails - Email records array
 * @param {Array} meetings - Calendar event records array (past + future combined)
 * @param {Array} meetingRecaps - Meeting recap IDs array
 * @param {Array} actionItems - Action item IDs array
 * @returns {Object} Engagement metrics object
 */
function computeEngagementMetrics(tasks, emails, meetings, meetingRecaps, actionItems) {
  const now = new Date();
  const ms30d = 30 * 24 * 60 * 60 * 1000;
  const ms90d = 90 * 24 * 60 * 60 * 1000;
  const cutoff30d = new Date(now - ms30d);
  const cutoff90d = new Date(now - ms90d);

  // --- Email metrics ---
  const emailTotal = emails.length;
  const emailsSent = emails.filter(e => e.isOutbound).length;
  const emailsReceived = emailTotal - emailsSent;

  const emails30d = emails.filter(e => {
    const d = e.date ? new Date(e.date) : null;
    return d && d >= cutoff30d;
  }).length;

  const emails90d = emails.filter(e => {
    const d = e.date ? new Date(e.date) : null;
    return d && d >= cutoff90d;
  }).length;

  const lastEmailDate = emails.length > 0 && emails[0].date
    ? new Date(emails[0].date)
    : null;

  // --- Calendar / Meeting metrics ---
  const pastMeetings = meetings.filter(m => {
    const d = m.startTime ? new Date(m.startTime) : null;
    return d && d < now;
  });
  const futureMeetings = meetings.filter(m => {
    const d = m.startTime ? new Date(m.startTime) : null;
    return d && d >= now;
  });

  const meetingsPast = pastMeetings.length;
  const meetingsFuture = futureMeetings.length;

  const meetings30d = pastMeetings.filter(m => {
    const d = m.startTime ? new Date(m.startTime) : null;
    return d && d >= cutoff30d;
  }).length;

  // Average attendance rate across past meetings (accepted / total attendees)
  let avgAttendancePct = 0;
  const meetingsWithAttendees = pastMeetings.filter(m => m.attendeeCount > 0);
  if (meetingsWithAttendees.length > 0) {
    const totalRate = meetingsWithAttendees.reduce((sum, m) => {
      return sum + (m.acceptedCount / m.attendeeCount);
    }, 0);
    avgAttendancePct = Math.round((totalRate / meetingsWithAttendees.length) * 100);
  }

  // Sort past meetings most-recent first for last meeting date
  const sortedPast = pastMeetings.slice().sort((a, b) => {
    return new Date(b.startTime) - new Date(a.startTime);
  });
  const lastMeetingDate = sortedPast.length > 0 && sortedPast[0].startTime
    ? new Date(sortedPast[0].startTime)
    : null;

  // Sort future meetings soonest first for next meeting date
  const sortedFuture = futureMeetings.slice().sort((a, b) => {
    return new Date(a.startTime) - new Date(b.startTime);
  });
  const nextMeetingDate = sortedFuture.length > 0 && sortedFuture[0].startTime
    ? new Date(sortedFuture[0].startTime)
    : null;

  // --- GitHub task metrics ---
  const tasksTotal = tasks.length;
  const tasksOpen = tasks.filter(t => t.state === 'OPEN').length;
  const tasksClosed = tasks.filter(t => t.state === 'CLOSED').length;

  // --- Meeting recap / action item counts ---
  const recapsCount = meetingRecaps.length;
  const actionItemsCount = actionItems.length;

  // --- Days since last contact (email or meeting, whichever is more recent) ---
  let lastContactDate = null;
  if (lastEmailDate) lastContactDate = lastEmailDate;
  if (lastMeetingDate) {
    if (!lastContactDate || lastMeetingDate > lastContactDate) {
      lastContactDate = lastMeetingDate;
    }
  }
  const daysSinceLastContact = lastContactDate
    ? Math.floor((now - lastContactDate) / (24 * 60 * 60 * 1000))
    : null;

  // --- Engagement Score (0-100 composite) ---
  // Weighted signals:
  //   Recency (40pts): days since last contact — 0d=40, 30d=20, 90d=5, 180d+=0
  //   Email activity (20pts): emails in last 90d — 10+=20, 5+=12, 1+=6, 0=0
  //   Meeting activity (20pts): meetings in last 30d — 3+=20, 2=15, 1=10, 0=0
  //   Future meetings (10pts): has upcoming meeting — yes=10, no=0
  //   GitHub tasks open (10pts): open tasks — 5+=10, 3+=7, 1+=4, 0=0
  let score = 0;

  // Recency
  if (daysSinceLastContact !== null) {
    if (daysSinceLastContact <= 7) score += 40;
    else if (daysSinceLastContact <= 14) score += 35;
    else if (daysSinceLastContact <= 30) score += 25;
    else if (daysSinceLastContact <= 60) score += 15;
    else if (daysSinceLastContact <= 90) score += 8;
    else if (daysSinceLastContact <= 180) score += 3;
  }

  // Email activity (90d)
  if (emails90d >= 10) score += 20;
  else if (emails90d >= 5) score += 12;
  else if (emails90d >= 1) score += 6;

  // Meeting activity (30d)
  if (meetings30d >= 3) score += 20;
  else if (meetings30d >= 2) score += 15;
  else if (meetings30d >= 1) score += 10;

  // Future meetings
  if (meetingsFuture > 0) score += 10;

  // Open GitHub tasks
  if (tasksOpen >= 5) score += 10;
  else if (tasksOpen >= 3) score += 7;
  else if (tasksOpen >= 1) score += 4;

  score = Math.min(100, score);

  return {
    emailTotal,
    emailsSent,
    emailsReceived,
    emails30d,
    emails90d,
    lastEmailDate,
    meetingsPast,
    meetingsFuture,
    meetings30d,
    avgAttendancePct,
    lastMeetingDate,
    nextMeetingDate,
    tasksTotal,
    tasksOpen,
    tasksClosed,
    recapsCount,
    actionItemsCount,
    daysSinceLastContact,
    engagementScore: score
  };
}

/**
 * Build JSON array of task IDs
 */
function buildTasksJson(tasks) {
  if (tasks.length === 0) return '[]';
  
  const taskIds = tasks.map(task => JSON.stringify(task.taskId)).filter(id => id && id !== '""');
  
  return '[' + taskIds.join(', ') + ']';
}

/**
 * Build JSON array of email message IDs
 */
function buildEmailsJson(emails) {
  if (emails.length === 0) return '[]';
  
  const messageIds = emails.map(email => JSON.stringify(email.messageId)).filter(id => id && id !== '""');
  
  return '[' + messageIds.join(', ') + ']';
}

/**
 * Build JSON array of meeting event IDs
 */
function buildMeetingsJson(meetings) {
  if (meetings.length === 0) return '[]';
  
  const eventIds = meetings.map(meeting => JSON.stringify(meeting.eventId)).filter(id => id && id !== '""');
  
  return '[' + eventIds.join(', ') + ']';
}

/**
 * Build map of Account ID -> Meeting Recap IDs
 */
function buildMeetingRecapsByAccountMap(meetingRecaps) {
  const map = new Map();
  
  if (meetingRecaps.data.length <= 1) {
    Logger.log('No meeting recaps data available');
    return map;
  }
  
  const headers = meetingRecaps.headers;
  const accountIdIdx = headers.indexOf('Account ID');
  const recapIdIdx = headers.indexOf('Meeting Recap ID');
  const meetingTitleIdx = headers.indexOf('Meeting Title');
  const meetingDateIdx = headers.indexOf('Meeting Date');
  const summaryIdx = headers.indexOf('Summary');
  
  if (accountIdIdx === -1 || recapIdIdx === -1) {
    Logger.log('Meeting Recaps sheet missing required columns');
    return map;
  }
  
  for (let i = 1; i < meetingRecaps.data.length; i++) {
    const row = meetingRecaps.data[i];
    const accountId = row[accountIdIdx];
    const recapId = row[recapIdIdx];
    
    if (accountId && recapId) {
      if (!map.has(accountId)) {
        map.set(accountId, []);
      }
      map.get(accountId).push({
        recapId: recapId,
        meetingTitle: meetingTitleIdx !== -1 ? String(row[meetingTitleIdx] || '') : '',
        meetingDate: meetingDateIdx !== -1 ? row[meetingDateIdx] : '',
        summary: summaryIdx !== -1 ? String(row[summaryIdx] || '').substring(0, 500) : ''
      });
    }
  }
  
  Logger.log(`Built meeting recaps map with ${map.size} accounts having recaps`);
  return map;
}

/**
 * Build map of Account ID -> Meeting Action Item IDs (concatenated Meeting Recap ID + Action Item Index)
 */
function buildActionItemsByAccountMap(actionItems) {
  const map = new Map();
  
  if (actionItems.data.length <= 1) {
    Logger.log('No action items data available');
    return map;
  }
  
  const headers = actionItems.headers;
  const recapIdIdx = headers.indexOf('Meeting Recap ID');
  const indexIdx = headers.indexOf('Action Item Index');
  const accountNameIdx = headers.indexOf('Account Name');
  
  if (recapIdIdx === -1 || indexIdx === -1) {
    Logger.log('Meeting Action Items sheet missing required columns');
    return map;
  }
  
  // We need to get Account ID from the Meeting Recaps sheet
  // First, build a map of Account Name -> Account ID from the action items
  // But we need to match back to Account ID, so we'll use the recap ID to find the account
  
  // Load meeting recaps to get account IDs
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const recapsSheet = spreadsheet.getSheetByName('Webhook Meeting Recaps');
  
  if (!recapsSheet) {
    Logger.log('Webhook Meeting Recaps sheet not found for action items mapping');
    return map;
  }
  
  const recapsData = recapsSheet.getDataRange().getValues();
  const recapsHeaders = recapsData[0];
  const recapAccountIdIdx = recapsHeaders.indexOf('Account ID');
  const recapRecapIdIdx = recapsHeaders.indexOf('Meeting Recap ID');
  
  // Build recap ID -> account ID map
  const recapIdToAccountId = new Map();
  for (let i = 1; i < recapsData.length; i++) {
    const recapId = recapsData[i][recapRecapIdIdx];
    const accountId = recapsData[i][recapAccountIdIdx];
    if (recapId && accountId) {
      recapIdToAccountId.set(recapId, accountId);
    }
  }
  
  // Now build the action items map
  for (let i = 1; i < actionItems.data.length; i++) {
    const row = actionItems.data[i];
    const recapId = row[recapIdIdx];
    const actionIndex = row[indexIdx];
    
    if (recapId !== undefined && recapId !== '' && actionIndex !== undefined && actionIndex !== '') {
      const accountId = recapIdToAccountId.get(recapId);
      
      if (accountId) {
        if (!map.has(accountId)) {
          map.set(accountId, []);
        }
        // Concatenate Meeting Recap ID + Action Item Index
        const actionItemId = `${recapId}_${actionIndex}`;
        map.get(accountId).push(actionItemId);
      }
    }
  }
  
  Logger.log(`Built action items map with ${map.size} accounts having action items`);
  return map;
}

/**
 * Build JSON array of meeting recap IDs
 */
function buildMeetingRecapsJson(recaps) {
  if (recaps.length === 0) return '[]';
  
  const recapIds = recaps.map(r => JSON.stringify(r.recapId || r)).filter(id => id && id !== '""');
  
  return '[' + recapIds.join(', ') + ']';
}

/**
 * Build JSON array of action item IDs (Meeting Recap ID + Action Item Index)
 */
function buildActionItemsJson(actionItems) {
  if (actionItems.length === 0) return '[]';
  
  const itemIds = actionItems.map(itemId => JSON.stringify(itemId)).filter(id => id && id !== '""');
  
  return '[' + itemIds.join(', ') + ']';
}

/**
 * Build a plain-text snippet of the 5 most recent emails for AI context
 * Format: "DATE (IN/OUT): SUBJECT — BODY_PREVIEW\n..."
 */
function buildRecentEmailSnippets(emails) {
  if (emails.length === 0) return '';
  
  return emails.slice(0, 3).map(e => {
    const direction = e.isOutbound ? 'OUT' : 'IN';
    const date = e.date ? new Date(e.date).toISOString().substring(0, 10) : '?';
    const subject = (e.subject || '(no subject)').substring(0, 80);
    const preview = (e.bodyPreview || '').replace(/\n/g, ' ').trim().substring(0, 150);
    return `${date} (${direction}): ${subject}${preview ? ' — ' + preview : ''}`;
  }).join('\n');
}

/**
 * Build a plain-text summary of GitHub tasks for AI context
 * Prioritises open tasks, then most recently updated closed tasks
 * Format: "[OPEN] TITLE (status)\n..."
 */
function buildRecentTaskSummaries(tasks) {
  if (tasks.length === 0) return '';
  
  const open = tasks.filter(t => t.state === 'OPEN');
  
  return open.map(t => {
    const status = t.status ? ` (${t.status})` : '';
    const title = (t.title || '(untitled)').substring(0, 100);
    return `[OPEN] ${title}${status}`;
  }).join('\n');
}

/**
 * Build a plain-text summary of the 3 most recent meeting recaps for AI context
 * Format: "DATE: TITLE\nSUMMARY\n---\n..."
 */
function buildRecentRecapSummaries(recaps) {
  if (recaps.length === 0) return '';
  
  // Sort by meeting date descending
  const sorted = recaps.slice().sort((a, b) => {
    const da = a.meetingDate ? new Date(a.meetingDate) : new Date(0);
    const db = b.meetingDate ? new Date(b.meetingDate) : new Date(0);
    return db - da;
  });
  
  return sorted.slice(0, 2).map(r => {
    const date = r.meetingDate ? new Date(r.meetingDate).toISOString().substring(0, 10) : '?';
    const title = (r.meetingTitle || '(untitled)').substring(0, 80);
    const summary = (r.summary || '').replace(/\n/g, ' ').trim();
    return `${date}: ${title}${summary ? '\n' + summary : ''}`;
  }).join('\n---\n');
}

/**
 * Analyze cell sizes and return statistics
 */
function analyzeCellSizes(data) {
  const cellSizes = [];
  const CHAR_LIMIT = 50000;
  
  // Skip header row
  for (let i = 1; i < data.length; i++) {
    for (let j = 0; j < data[i].length; j++) {
      const cellValue = String(data[i][j] || '');
      const size = cellValue.length;
      
      if (size > 0) {
        cellSizes.push({
          row: i + 1,
          col: j + 1,
          size: size,
          percentage: (size / CHAR_LIMIT * 100).toFixed(2)
        });
      }
    }
  }
  
  if (cellSizes.length === 0) {
    return {
      count: 0,
      smallest: 0,
      largest: 0,
      average: 0,
      median: 0,
      overLimit: 0
    };
  }
  
  cellSizes.sort((a, b) => a.size - b.size);
  
  const smallest = cellSizes[0].size;
  const largest = cellSizes[cellSizes.length - 1].size;
  const sum = cellSizes.reduce((acc, cell) => acc + cell.size, 0);
  const average = Math.round(sum / cellSizes.length);
  const median = cellSizes[Math.floor(cellSizes.length / 2)].size;
  const overLimit = cellSizes.filter(cell => cell.size > CHAR_LIMIT).length;
  
  // Log largest cells
  const largestCells = cellSizes.slice(-10).reverse();
  Logger.log('=== Top 10 Largest Cells ===');
  largestCells.forEach(cell => {
    Logger.log(`Row ${cell.row}, Col ${cell.col}: ${cell.size} chars (${cell.percentage}% of limit)`);
  });
  
  const stats = {
    count: cellSizes.length,
    smallest: smallest,
    largest: largest,
    average: average,
    median: median,
    overLimit: overLimit,
    largestCells: largestCells
  };
  
  Logger.log('=== Cell Size Statistics ===');
  Logger.log(`Total cells: ${stats.count}`);
  Logger.log(`Smallest: ${stats.smallest} chars`);
  Logger.log(`Largest: ${stats.largest} chars (${(stats.largest / CHAR_LIMIT * 100).toFixed(2)}% of limit)`);
  Logger.log(`Average: ${stats.average} chars`);
  Logger.log(`Median: ${stats.median} chars`);
  Logger.log(`Over limit (50k): ${stats.overLimit} cells`);
  
  return stats;
}

/**
 * Compute a stable hash string from the content-based fields that drive the AI summary.
 * Excludes purely time-derived fields (days since last contact, 30d/90d email counts).
 */
function computeAiPromptHash(row, findCol) {
  const fields = [
    'Recent Email Snippets',
    'Recent Task Summaries',
    'Recent Recap Summaries',
    'Engagement Score',
    'GitHub Tasks (Open)',
    'Meetings (Future)',
    'Next Meeting Date',
    'Meeting Recaps Count',
    'Action Items Count',
    'Stage',
    'CSM'
  ];
  const content = fields.map(name => {
    const idx = findCol(name);
    return idx > 0 ? String(row[idx - 1] || '') : '';
  }).join('|');
  
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, content);
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

/**
 * Write consolidated data to sheet
 */
function writeAccountDataRaw(data) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(ACCOUNT_DATA_RAW_SHEET);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(ACCOUNT_DATA_RAW_SHEET);
  }
  
  // Before clearing, snapshot existing AI formulas and hashes keyed by Account Name
  // so we can skip regenerating AI() for rows whose content hasn't changed
  const aiCache = new Map(); // accountName -> { formula, hash }
  if (sheet.getLastRow() > 1) {
    const existingData = sheet.getDataRange().getValues();
    const exHeaders = existingData[0];
    const exAccountCol = exHeaders.indexOf('Account Name');
    const exAiCol = exHeaders.indexOf('AI Engagement Summary');
    const exHashCol = exHeaders.indexOf('AI Prompt Hash');
    if (exAccountCol !== -1 && exAiCol !== -1) {
      const existingFormulas = sheet.getRange(2, exAiCol + 1, existingData.length - 1, 1).getFormulas();
      for (let i = 1; i < existingData.length; i++) {
        const accountName = String(existingData[i][exAccountCol] || '');
        const existingFormula = existingFormulas[i - 1][0] || '';
        const existingHash = exHashCol !== -1 ? String(existingData[i][exHashCol] || '') : '';
        if (accountName) {
          aiCache.set(accountName, { formula: existingFormula, hash: existingHash });
        }
      }
    }
    Logger.log(`AI cache loaded: ${aiCache.size} existing entries`);
  }
  
  sheet.clear();
  
  if (data.length > 0) {
    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    
    // Format header
    sheet.getRange(1, 1, 1, data[0].length)
      .setFontWeight('bold')
      .setBackground('#9900ff')
      .setFontColor('#ffffff');
    
    // Format Renewal column (hyperlinks)
    const renewalCol = 2;
    if (data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const cellValue = data[i][renewalCol - 1];
        if (cellValue && typeof cellValue === 'string' && cellValue.startsWith('=HYPERLINK')) {
          sheet.getRange(i + 1, renewalCol).setFormula(cellValue);
        }
      }
    }
    
    // Format currency columns
    const renewableCol = 5;
    const forcastCol = 6;
    const amountGrossCol = 9;
    if (data.length > 1) {
      if (renewableCol <= data[0].length) {
        sheet.getRange(2, renewableCol, data.length - 1, 1).setNumberFormat('$#,##0.00');
      }
      if (forcastCol <= data[0].length) {
        sheet.getRange(2, forcastCol, data.length - 1, 1).setNumberFormat('$#,##0.00');
      }
      if (amountGrossCol <= data[0].length) {
        sheet.getRange(2, amountGrossCol, data.length - 1, 1).setNumberFormat('$#,##0.00');
      }
    }
    
    // Format percentage columns
    const auditUsageCol = 11;
    const journeyUsageCol = 12;
    if (data.length > 1) {
      if (auditUsageCol <= data[0].length) {
        sheet.getRange(2, auditUsageCol, data.length - 1, 1).setNumberFormat('0.00%');
      }
      if (journeyUsageCol <= data[0].length) {
        sheet.getRange(2, journeyUsageCol, data.length - 1, 1).setNumberFormat('0.00%');
      }
    }
    
    // Format engagement metric columns
    // Dynamically find column positions from headers to stay resilient to future reordering
    const headerRow = data[0];
    const findCol = (name) => headerRow.indexOf(name) + 1; // 1-indexed, 0 if not found
    
    if (data.length > 1) {
      const engagementScoreCol = findCol('Engagement Score');
      const avgAttendanceCol = findCol('Avg Meeting Attendance %');
      const lastEmailDateCol = findCol('Last Email Date');
      const lastMeetingDateCol = findCol('Last Meeting Date');
      const nextMeetingDateCol = findCol('Next Meeting Date');
      
      // Engagement Score: integer 0-100
      if (engagementScoreCol > 0) {
        sheet.getRange(2, engagementScoreCol, data.length - 1, 1).setNumberFormat('0');
      }
      
      // Avg Meeting Attendance %: display as percentage integer
      if (avgAttendanceCol > 0) {
        sheet.getRange(2, avgAttendanceCol, data.length - 1, 1).setNumberFormat('0"%"');
      }
      
      // Date columns
      const dateFormat = 'yyyy-mm-dd';
      if (lastEmailDateCol > 0) {
        sheet.getRange(2, lastEmailDateCol, data.length - 1, 1).setNumberFormat(dateFormat);
      }
      if (lastMeetingDateCol > 0) {
        sheet.getRange(2, lastMeetingDateCol, data.length - 1, 1).setNumberFormat(dateFormat);
      }
      if (nextMeetingDateCol > 0) {
        sheet.getRange(2, nextMeetingDateCol, data.length - 1, 1).setNumberFormat(dateFormat);
      }
      
      // Color-code Engagement Score column with conditional background
      // High (70-100): green, Medium (40-69): yellow, Low (0-39): red
      if (engagementScoreCol > 0) {
        for (let i = 1; i < data.length; i++) {
          const score = data[i][engagementScoreCol - 1];
          if (typeof score === 'number') {
            let bg;
            if (score >= 70) bg = '#b7e1cd';       // green
            else if (score >= 40) bg = '#fce8b2';  // yellow
            else bg = '#f4c7c3';                   // red
            sheet.getRange(i + 1, engagementScoreCol).setBackground(bg);
          }
        }
      }
    }
    
    // Inject AI() formulas into the AI Engagement Summary column.
    // AI() only accepts a single string literal — no cell refs, no nested functions.
    // We build the full prompt string in Apps Script from the data array and embed it inline.
    const aiSummaryCol = findCol('AI Engagement Summary');
    if (aiSummaryCol > 0 && data.length > 1) {
      Logger.log(`Injecting AI() formulas into column ${aiSummaryCol}...`);
      
      // Pre-compute 0-based data indices for all fields we need
      const di = {};
      [
        'Account Name', 'Renewal Date', 'Stage', 'CSM',
        'Engagement Score', 'Days Since Last Contact',
        'Email Count (30d)', 'Email Count (90d)',
        'Meetings (Past)', 'Meetings (Future)', 'Meetings (30d)',
        'Last Meeting Date', 'Next Meeting Date',
        'GitHub Tasks (Open)',
        'Meeting Recaps Count', 'Action Items Count',
        'Recent Email Snippets', 'Recent Task Summaries', 'Recent Recap Summaries'
      ].forEach(name => {
        const idx = findCol(name);
        if (idx > 0) di[name] = idx - 1; // convert to 0-based
      });
      
      // Helper: safely get a string value from the data row
      const val = (row, name) => {
        if (di[name] === undefined) return '';
        const v = row[di[name]];
        if (v === null || v === undefined) return '';
        if (v instanceof Date) return v.toISOString().substring(0, 10);
        return String(v);
      };
      
      // Helper: escape double-quotes for embedding inside =AI("...")
      const esc = (s) => s.replace(/"/g, '""');
      
      const aiHashCol = findCol('AI Prompt Hash');
      const aiFormulas = [];   // [formula | ''] per data row
      const aiHashes = [];     // new hash per data row
      let regenerated = 0;
      let reused = 0;
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const accountName = val(row, 'Account Name');
        
        // Compute hash from content-based fields only (excludes time-only fields)
        const newHash = computeAiPromptHash(row, findCol);
        aiHashes.push([newHash]);
        
        // Check cache: if hash matches and a formula already exists, reuse it
        const cached = aiCache.get(accountName);
        if (cached && cached.hash === newHash && cached.formula) {
          aiFormulas.push([cached.formula]);
          reused++;
          continue;
        }
        
        // Hash changed or no prior formula — build a fresh AI() prompt
        const prompt = esc(
          'You are a customer success manager reviewing account health. ' +
          'Write a 3-4 sentence engagement summary for: ' + val(row, 'Account Name') + '\n' +
          'Renewal: ' + val(row, 'Renewal Date') +
          ' | Stage: ' + val(row, 'Stage') +
          ' | CSM: ' + val(row, 'CSM') +
          ' | Engagement Score: ' + val(row, 'Engagement Score') + '/100' +
          ' | Days since last contact: ' + val(row, 'Days Since Last Contact') +
          ' | Emails 30d/90d: ' + val(row, 'Email Count (30d)') + '/' + val(row, 'Email Count (90d)') +
          ' | Meetings past/future/30d: ' + val(row, 'Meetings (Past)') + '/' + val(row, 'Meetings (Future)') + '/' + val(row, 'Meetings (30d)') +
          ' | Last meeting: ' + val(row, 'Last Meeting Date') +
          ' | Next meeting: ' + val(row, 'Next Meeting Date') +
          ' | Open tasks: ' + val(row, 'GitHub Tasks (Open)') +
          ' | Recaps: ' + val(row, 'Meeting Recaps Count') +
          ' | Action items: ' + val(row, 'Action Items Count') + '\n\n' +
          '--- RECENT EMAILS (newest first) ---\n' + val(row, 'Recent Email Snippets') + '\n\n' +
          '--- OPEN/RECENT GITHUB TASKS ---\n' + val(row, 'Recent Task Summaries') + '\n\n' +
          '--- RECENT MEETING RECAPS ---\n' + val(row, 'Recent Recap Summaries') + '\n\n' +
          'Based on all of the above, describe the engagement level, call out any concerns ' +
          '(e.g. no recent contact, low score, no future meetings booked, overdue action items), ' +
          'and suggest one specific next step.'
        );
        
        aiFormulas.push([`=AI("${prompt}")`]);
        regenerated++;
      }
      
      // Batch write formulas and hashes
      if (aiFormulas.length > 0) {
        sheet.getRange(2, aiSummaryCol, aiFormulas.length, 1).setFormulas(aiFormulas);
      }
      if (aiHashCol > 0 && aiHashes.length > 0) {
        sheet.getRange(2, aiHashCol, aiHashes.length, 1).setValues(aiHashes);
      }
      Logger.log(`AI() formulas: ${regenerated} regenerated, ${reused} reused from cache (hash unchanged)`);
    }
    
    // Auto-resize columns
    for (let i = 1; i <= data[0].length; i++) {
      sheet.autoResizeColumn(i);
      // Cap column width at 500 pixels for readability
      const currentWidth = sheet.getColumnWidth(i);
      if (currentWidth > 500) {
        sheet.setColumnWidth(i, 500);
      }
    }
    
    // Set AI Engagement Summary column to a fixed wider width for readability
    if (findCol('AI Engagement Summary') > 0) {
      sheet.setColumnWidth(findCol('AI Engagement Summary'), 400);
    }
    
    // Set all data rows to single-line height
    if (data.length > 1) {
      sheet.setRowHeights(2, data.length - 1, 21);
    }
    
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(1);
  }
  
  const timestamp = new Date();
  sheet.getRange(1, data[0].length + 2).setValue('Last Updated:');
  sheet.getRange(1, data[0].length + 3).setValue(timestamp);
  
  Logger.log(`Wrote ${data.length} rows to sheet "${ACCOUNT_DATA_RAW_SHEET}"`);
}

/**
 * Manual function to generate Account Data Raw with UI feedback
 */
function generateAccountDataRawManual() {
  try {
    const result = generateAccountDataRaw();
    
    const stats = result.sizeStats;
    const warningMessage = stats.overLimit > 0 
      ? `\n\n⚠️ WARNING: ${stats.overLimit} cells exceed the 50,000 character limit!`
      : '';
    
    SpreadsheetApp.getUi().alert(
      'Account Data Raw Generated',
      `✅ Success!\n\n` +
      `Accounts: ${result.accountCount}\n` +
      `Duration: ${result.duration}s\n\n` +
      `Cell Size Statistics:\n` +
      `• Smallest: ${stats.smallest} chars\n` +
      `• Largest: ${stats.largest} chars (${(stats.largest / 50000 * 100).toFixed(2)}% of limit)\n` +
      `• Average: ${stats.average} chars\n` +
      `• Median: ${stats.median} chars` +
      warningMessage,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('Account Data Raw generation failed: ' + error.message);
    SpreadsheetApp.getUi().alert(
      'Generation Failed',
      `❌ Error: ${error.message}\n\nCheck logs for details.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
