/**
 * GitHub Account Sync
 * 
 * Syncs account names as labels to GitHub repository/project.
 * Allows associating GitHub issues with accounts via labels.
 * 
 * Labels are prefixed with "account:" for easy filtering.
 * Example: "account:Torrid", "account:CDW"
 */

const ACCOUNT_LABEL_PREFIX = 'account:';
const ACCOUNT_LABEL_COLOR = 'fbca04'; // GitHub yellow

/**
 * Sync account names from the Accounts to Email Domains Mapping sheet
 * to GitHub as labels on the configured repository.
 */
function syncAccountLabelsToGitHub() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    const config = validateGitHubConfig();
    
    // Get active accounts
    const accounts = getActiveAccounts();
    
    if (accounts.length === 0) {
      ui.alert(
        'No Accounts Found',
        'No active accounts found in the mapping sheet.\n\nRun "Initialize/Refresh Account Mapping" first.',
        ui.ButtonSet.OK
      );
      return;
    }
    
    Logger.log(`Found ${accounts.length} active accounts to sync`);
    
    // Get repository info - we need to determine which repo to use
    // For user projects, we'll use the first repository found in the project
    const repoInfo = getProjectRepository(config);
    
    if (!repoInfo) {
      ui.alert(
        'Repository Not Found',
        'Could not determine repository for the GitHub project.\n\nMake sure the project has at least one issue linked to a repository.',
        ui.ButtonSet.OK
      );
      return;
    }
    
    Logger.log(`Using repository: ${repoInfo.owner}/${repoInfo.name}`);
    
    // Get existing labels
    const existingLabels = getRepositoryLabels(config.githubToken, repoInfo.owner, repoInfo.name);
    const existingAccountLabels = existingLabels.filter(l => l.name.startsWith(ACCOUNT_LABEL_PREFIX));
    
    Logger.log(`Found ${existingAccountLabels.length} existing account labels`);
    
    // Determine labels to create
    const existingLabelNames = new Set(existingAccountLabels.map(l => l.name));
    const desiredLabelNames = new Set(accounts.map(a => ACCOUNT_LABEL_PREFIX + a.accountName));
    
    const labelsToCreate = [];
    const labelsToKeep = [];
    const labelsToRemove = [];
    
    for (const labelName of desiredLabelNames) {
      if (existingLabelNames.has(labelName)) {
        labelsToKeep.push(labelName);
      } else {
        labelsToCreate.push(labelName);
      }
    }
    
    for (const labelName of existingLabelNames) {
      if (!desiredLabelNames.has(labelName)) {
        labelsToRemove.push(labelName);
      }
    }
    
    Logger.log(`Labels to create: ${labelsToCreate.length}`);
    Logger.log(`Labels to keep: ${labelsToKeep.length}`);
    Logger.log(`Labels to remove: ${labelsToRemove.length}`);
    
    // Create new labels
    let createdCount = 0;
    for (const labelName of labelsToCreate) {
      try {
        createRepositoryLabel(config.githubToken, repoInfo.owner, repoInfo.name, labelName, ACCOUNT_LABEL_COLOR);
        createdCount++;
        Logger.log(`Created label: ${labelName}`);
      } catch (error) {
        Logger.log(`Failed to create label ${labelName}: ${error.message}`);
      }
      Utilities.sleep(100); // Rate limiting
    }
    
    // Optionally remove old labels (ask user first if there are any)
    let removedCount = 0;
    if (labelsToRemove.length > 0) {
      const removeResponse = ui.alert(
        'Remove Old Labels?',
        `Found ${labelsToRemove.length} account label(s) that are no longer in the active accounts list.\n\n` +
        `Do you want to remove them?\n\n` +
        `Labels: ${labelsToRemove.slice(0, 5).join(', ')}${labelsToRemove.length > 5 ? '...' : ''}`,
        ui.ButtonSet.YES_NO
      );
      
      if (removeResponse === ui.Button.YES) {
        for (const labelName of labelsToRemove) {
          try {
            deleteRepositoryLabel(config.githubToken, repoInfo.owner, repoInfo.name, labelName);
            removedCount++;
            Logger.log(`Removed label: ${labelName}`);
          } catch (error) {
            Logger.log(`Failed to remove label ${labelName}: ${error.message}`);
          }
          Utilities.sleep(100);
        }
      }
    }
    
    // Show summary
    ui.alert(
      'Account Labels Synced',
      `✅ Sync complete!\n\n` +
      `📋 Total active accounts: ${accounts.length}\n` +
      `➕ Labels created: ${createdCount}\n` +
      `✔️ Labels already exist: ${labelsToKeep.length}\n` +
      `➖ Labels removed: ${removedCount}\n\n` +
      `Repository: ${repoInfo.owner}/${repoInfo.name}`,
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log('Error syncing account labels: ' + error.message);
    Logger.log(error.stack);
    
    ui.alert(
      'Sync Failed',
      'Error: ' + error.message,
      ui.ButtonSet.OK
    );
  }
}

/**
 * Get the repository associated with the GitHub project
 * by fetching project items and finding the first repo
 */
function getProjectRepository(config) {
  const query = `
    query($login: String!, $number: Int!) {
      user(login: $login) {
        projectV2(number: $number) {
          items(first: 10) {
            nodes {
              content {
                ... on Issue {
                  repository {
                    name
                    owner {
                      login
                    }
                  }
                }
                ... on PullRequest {
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
    return null;
  }
  
  const items = response.data.user.projectV2.items.nodes;
  
  for (const item of items) {
    if (item.content && item.content.repository) {
      return {
        owner: item.content.repository.owner.login,
        name: item.content.repository.name
      };
    }
  }
  
  return null;
}

/**
 * Get all labels from a repository
 */
function getRepositoryLabels(token, owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/labels?per_page=100`;
  
  const options = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + token,
      'User-Agent': 'Google-Apps-Script',
      'Accept': 'application/vnd.github+json'
    },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  
  if (responseCode !== 200) {
    throw new Error(`Failed to get labels: ${response.getContentText()}`);
  }
  
  return JSON.parse(response.getContentText());
}

/**
 * Create a label in a repository
 */
function createRepositoryLabel(token, owner, repo, name, color) {
  const url = `https://api.github.com/repos/${owner}/${repo}/labels`;
  
  const payload = {
    name: name,
    color: color,
    description: 'Account label synced from Google Sheets'
  };
  
  const options = {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + token,
      'User-Agent': 'Google-Apps-Script',
      'Accept': 'application/vnd.github+json'
    },
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  
  if (responseCode !== 201) {
    throw new Error(`Failed to create label: ${response.getContentText()}`);
  }
  
  return JSON.parse(response.getContentText());
}

/**
 * Delete a label from a repository
 */
function deleteRepositoryLabel(token, owner, repo, name) {
  const encodedName = encodeURIComponent(name);
  const url = `https://api.github.com/repos/${owner}/${repo}/labels/${encodedName}`;
  
  const options = {
    method: 'delete',
    headers: {
      'Authorization': 'Bearer ' + token,
      'User-Agent': 'Google-Apps-Script',
      'Accept': 'application/vnd.github+json'
    },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  
  if (responseCode !== 204) {
    throw new Error(`Failed to delete label: ${response.getContentText()}`);
  }
}

/**
 * Find account name from a GitHub issue's labels
 */
function getAccountFromGitHubLabels(labels) {
  if (!labels || !Array.isArray(labels)) return null;
  
  for (const label of labels) {
    if (label.startsWith(ACCOUNT_LABEL_PREFIX)) {
      return label.substring(ACCOUNT_LABEL_PREFIX.length);
    }
  }
  
  return null;
}

/**
 * Look up account info by name
 */
function getAccountInfoByName(accountName) {
  if (!accountName) return null;
  
  const accountMap = buildAccountMap();
  
  for (const [accountId, accountInfo] of accountMap) {
    if (accountInfo.accountName === accountName) {
      return accountInfo;
    }
  }
  
  return null;
}
