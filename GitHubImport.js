/**
 * GitHub Projects Import - Efficient Project Data Collection
 * 
 * Imports tasks from GitHub Projects V2 using GraphQL API
 * Optimized for minimal API calls and fast sheet operations
 * 
 * Updated: Now uses account-centric model via labels (account:AccountName)
 */

/**
 * Main function - Import GitHub project tasks
 */
function importGitHubTasks() {
  const startTime = new Date();
  Logger.log('=== Starting GitHub Projects Import ===');
  
  try {
    const config = validateGitHubConfig();
    
    Logger.log('Step 1: Fetching project data from GitHub...');
    const projectData = fetchGitHubProject(config);
    Logger.log(`Retrieved project: ${projectData.title}`);
    Logger.log(`Found ${projectData.items.length} tasks`);
    
    Logger.log('Step 2: Processing task data...');
    const processedData = processGitHubTasks(projectData);
    
    Logger.log('Step 3: Writing to sheet...');
    writeGitHubToSheet(processedData, config.sheetName);
    
    const duration = (new Date() - startTime) / 1000;
    Logger.log(`=== Import Complete in ${duration}s ===`);
    
    return {
      success: true,
      taskCount: projectData.items.length,
      duration: duration
    };
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * Fetch GitHub project data using GraphQL API
 */
function fetchGitHubProject(config) {
  const query = `
    query($login: String!, $number: Int!) {
      user(login: $login) {
        projectV2(number: $number) {
          id
          title
          shortDescription
          url
          items(first: 100) {
            nodes {
              id
              type
              fieldValues(first: 20) {
                nodes {
                  ... on ProjectV2ItemFieldTextValue {
                    text
                    field {
                      ... on ProjectV2FieldCommon {
                        name
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldNumberValue {
                    number
                    field {
                      ... on ProjectV2FieldCommon {
                        name
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldDateValue {
                    date
                    field {
                      ... on ProjectV2FieldCommon {
                        name
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field {
                      ... on ProjectV2FieldCommon {
                        name
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldIterationValue {
                    title
                    field {
                      ... on ProjectV2FieldCommon {
                        name
                      }
                    }
                  }
                }
              }
              content {
                ... on Issue {
                  number
                  title
                  body
                  url
                  state
                  createdAt
                  updatedAt
                  closedAt
                  assignees(first: 10) {
                    nodes {
                      login
                    }
                  }
                  labels(first: 10) {
                    nodes {
                      name
                    }
                  }
                  repository {
                    name
                    owner {
                      login
                    }
                  }
                }
                ... on DraftIssue {
                  title
                  body
                  createdAt
                  updatedAt
                  assignees(first: 10) {
                    nodes {
                      login
                    }
                  }
                }
                ... on PullRequest {
                  number
                  title
                  body
                  url
                  state
                  createdAt
                  updatedAt
                  closedAt
                  mergedAt
                  assignees(first: 10) {
                    nodes {
                      login
                    }
                  }
                  labels(first: 10) {
                    nodes {
                      name
                    }
                  }
                  repository {
                    name
                    owner {
                      login
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  
  const variables = {
    login: config.githubUsername,
    number: config.projectNumber
  };
  
  const response = makeGitHubGraphQLRequest(config.githubToken, query, variables);
  
  if (!response.data || !response.data.user || !response.data.user.projectV2) {
    throw new Error('Failed to fetch project data. Check your username and project number.');
  }
  
  const project = response.data.user.projectV2;
  
  return {
    id: project.id,
    title: project.title,
    description: project.shortDescription || '',
    url: project.url,
    items: project.items.nodes.map(item => parseProjectItem(item))
  };
}

/**
 * Parse a project item into a structured format
 */
function parseProjectItem(item) {
  const parsed = {
    id: item.id,
    type: item.type,
    title: '',
    description: '',
    url: '',
    state: '',
    number: null,
    repository: '',
    createdAt: null,
    updatedAt: null,
    closedAt: null,
    assignees: [],
    labels: [],
    status: '',
    priority: '',
    customFields: {}
  };
  
  if (item.content) {
    const content = item.content;
    parsed.title = content.title || '';
    parsed.description = content.body || '';
    parsed.url = content.url || '';
    parsed.state = content.state || '';
    parsed.number = content.number || null;
    parsed.createdAt = content.createdAt ? new Date(content.createdAt) : null;
    parsed.updatedAt = content.updatedAt ? new Date(content.updatedAt) : null;
    parsed.closedAt = content.closedAt ? new Date(content.closedAt) : null;
    
    if (content.repository) {
      parsed.repository = `${content.repository.owner.login}/${content.repository.name}`;
    }
    
    if (content.assignees && content.assignees.nodes) {
      parsed.assignees = content.assignees.nodes.map(a => a.login);
    }
    
    if (content.labels && content.labels.nodes) {
      parsed.labels = content.labels.nodes.map(l => l.name);
    }
  }
  
  if (item.fieldValues && item.fieldValues.nodes) {
    item.fieldValues.nodes.forEach(fieldValue => {
      if (!fieldValue.field) return;
      
      const fieldName = fieldValue.field.name;
      
      if (fieldValue.text !== undefined) {
        parsed.customFields[fieldName] = fieldValue.text;
      } else if (fieldValue.number !== undefined) {
        parsed.customFields[fieldName] = fieldValue.number;
      } else if (fieldValue.date !== undefined) {
        parsed.customFields[fieldName] = fieldValue.date;
      } else if (fieldValue.name !== undefined) {
        parsed.customFields[fieldName] = fieldValue.name;
        if (fieldName.toLowerCase() === 'status') {
          parsed.status = fieldValue.name;
        } else if (fieldName.toLowerCase() === 'priority') {
          parsed.priority = fieldValue.name;
        }
      } else if (fieldValue.title !== undefined) {
        parsed.customFields[fieldName] = fieldValue.title;
      }
    });
  }
  
  return parsed;
}

/**
 * Make a GraphQL request to GitHub API
 */
function makeGitHubGraphQLRequest(token, query, variables) {
  const url = 'https://api.github.com/graphql';
  
  const payload = {
    query: query,
    variables: variables
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + token,
      'User-Agent': 'Google-Apps-Script'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  if (responseCode !== 200) {
    Logger.log('GitHub API Error Response: ' + responseText);
    throw new Error(`GitHub API request failed with status ${responseCode}: ${responseText}`);
  }
  
  const data = JSON.parse(responseText);
  
  if (data.errors) {
    Logger.log('GitHub GraphQL Errors: ' + JSON.stringify(data.errors));
    throw new Error('GraphQL errors: ' + JSON.stringify(data.errors));
  }
  
  return data;
}

/**
 * Process GitHub tasks into flat structure for sheet storage
 */
function processGitHubTasks(projectData) {
  const headers = [
    'Task ID',
    'Type',
    'Number',
    'Title',
    'Description',
    'Status',
    'Priority',
    'State',
    'Repository',
    'URL',
    'Assignees',
    'Labels',
    'Account ID',
    'Account Name',
    'Created At',
    'Updated At',
    'Closed At',
    'Custom Fields'
  ];
  
  const rows = projectData.items.map(item => {
    const customFieldsStr = Object.keys(item.customFields)
      .filter(key => key.toLowerCase() !== 'status' && key.toLowerCase() !== 'priority')
      .map(key => `${key}: ${item.customFields[key]}`)
      .join('; ');
    
    // Find account from labels (account:AccountName format)
    const accountName = getAccountFromGitHubLabels(item.labels);
    const accountInfo = accountName ? getAccountInfoByName(accountName) : null;
    
    return [
      item.id,
      item.type,
      item.number || '',
      item.title,
      item.description,
      item.status,
      item.priority,
      item.state,
      item.repository,
      item.url,
      item.assignees.join(', '),
      item.labels.join(', '),
      accountInfo ? accountInfo.accountId : '',
      accountName || '',
      item.createdAt || '',
      item.updatedAt || '',
      item.closedAt || '',
      customFieldsStr
    ];
  });
  
  return [headers, ...rows];
}

/**
 * Write GitHub data to sheet (optimized for speed)
 */
function writeGitHubToSheet(data, sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  
  sheet.clear();
  
  if (data.length > 0) {
    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    
    sheet.getRange(1, 1, 1, data[0].length)
      .setFontWeight('bold')
      .setBackground('#4078c0')
      .setFontColor('#ffffff');
    
    const createdCol = 15;
    const updatedCol = 16;
    const closedCol = 17;
    if (data.length > 1) {
      sheet.getRange(2, createdCol, data.length - 1, 1)
        .setNumberFormat('yyyy-mm-dd hh:mm');
      sheet.getRange(2, updatedCol, data.length - 1, 1)
        .setNumberFormat('yyyy-mm-dd hh:mm');
      sheet.getRange(2, closedCol, data.length - 1, 1)
        .setNumberFormat('yyyy-mm-dd hh:mm');
    }
    
    for (let i = 1; i <= data[0].length; i++) {
      sheet.autoResizeColumn(i);
    }
    
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(2);
  }
  
  const timestamp = new Date();
  sheet.getRange(1, data[0].length + 2).setValue('Last Updated:');
  sheet.getRange(1, data[0].length + 3).setValue(timestamp);
  
  Logger.log(`Wrote ${data.length} rows to sheet "${sheetName}"`);
}

/**
 * Setup automatic import trigger (configurable interval)
 */
function setupGitHubAutoImport(intervalMinutes) {
  intervalMinutes = intervalMinutes || 5;
  
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'importGitHubTasks') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  ScriptApp.newTrigger('importGitHubTasks')
    .timeBased()
    .everyMinutes(intervalMinutes)
    .create();
  
  Logger.log(`GitHub auto-import trigger created (runs every ${intervalMinutes} minutes)`);
  
  SpreadsheetApp.getUi().alert(
    'GitHub Auto-Import Enabled',
    `GitHub tasks will now be imported automatically every ${intervalMinutes} minutes.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Remove automatic import trigger
 */
function removeGitHubAutoImport() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'importGitHubTasks') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });
  
  Logger.log(`Removed ${removed} GitHub auto-import trigger(s)`);
  
  SpreadsheetApp.getUi().alert(
    'GitHub Auto-Import Disabled',
    `Removed ${removed} automatic import trigger(s).`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Test GitHub import
 */
function testGitHubImport() {
  try {
    const result = importGitHubTasks();
    
    SpreadsheetApp.getUi().alert(
      'GitHub Import Test',
      `✅ Success!\n\nImported ${result.taskCount} tasks.\nDuration: ${result.duration}s`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('GitHub import failed: ' + error.message);
    SpreadsheetApp.getUi().alert(
      'GitHub Import Test',
      `❌ Failed\n\nError: ${error.message}\n\nCheck logs for details.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
