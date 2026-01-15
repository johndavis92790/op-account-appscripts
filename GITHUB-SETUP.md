# GitHub Projects Import Setup

This guide will help you set up automatic syncing of your GitHub Projects board to Google Sheets.

## Overview

Your GitHub Projects kanban board will automatically sync to a Google Sheet every 1-5 minutes (configurable). The system uses GitHub's GraphQL API to efficiently fetch all task data including:

- Task titles, numbers, and URLs
- Status columns (Backlog, Blocked, Ready, In Progress, Done)
- Priority levels
- Assignees and labels
- Created/updated/closed timestamps
- Custom fields

## Prerequisites

1. **GitHub Personal Access Token** with the following scopes:
   - `project` (read/write access to projects)
   - `read:org` (read organization data)
   - `repo` (if your project includes private repositories)

2. **Google Apps Script** access to your spreadsheet

## Step 1: Create GitHub Personal Access Token

1. Go to [GitHub Settings > Personal Access Tokens > Tokens (classic)](https://github.com/settings/tokens)
2. Click **Generate new token** > **Generate new token (classic)**
3. Give it a descriptive name: `Google Sheets Project Sync`
4. Set expiration (recommend: 90 days or No expiration)
5. Select the following scopes:
   - ✅ `project` (full control)
   - ✅ `read:org` (read org and team membership)
   - ✅ `repo` (if using private repos)
6. Click **Generate token**
7. **IMPORTANT:** Copy the token immediately (you won't see it again!)

## Step 2: Upload Scripts to Apps Script

1. Open your Google Sheet
2. Go to **Extensions > Apps Script**
3. Add the following files from your project:
   - `GitHubConfig.js`
   - `GitHubImport.js`
4. Click **Save** (💾 icon)

## Step 3: Store Your GitHub Token Securely

**IMPORTANT:** Never hardcode tokens in your script files. Use Script Properties instead.

1. In Apps Script, click the **Run** button dropdown
2. Select function: `setGitHubToken`
3. In the function editor, modify the function call to include your token:
   - Click in the code editor
   - Type: `setGitHubToken("github_pat_your_token_here")`
   - Replace `github_pat_your_token_here` with your actual token
4. Click **Run** (▶️ icon)
5. **First time only:** Authorize the script (see authorization steps below)
6. You should see a success dialog confirming the token was saved
7. **Delete the token from the code editor** - it's now stored securely

**Alternative method (more secure):**
1. In Apps Script, go to **Project Settings** (⚙️ icon on left)
2. Scroll to **Script Properties**
3. Click **Add script property**
4. Property name: `GITHUB_TOKEN`
5. Value: Your GitHub token
6. Click **Save**

## Step 4: Test the Import

1. In Apps Script, select the function: `testGitHubImport`
2. Click **Run** (▶️ icon)
3. **First time only:** You'll need to authorize the script:
   - Click **Review permissions**
   - Select your Google account
   - Click **Advanced** > **Go to [Project Name] (unsafe)**
   - Click **Allow**
4. Wait for the test to complete
5. You should see a success dialog with the number of tasks imported
6. Check your sheet for the new "GitHub Tasks" tab

## Step 5: Enable Automatic Sync

Choose your sync frequency (faster = more API calls):

### Option A: Every 1 minute (fastest, ~43,200 API calls/month)
```javascript
setupGitHubAutoImport(1);
```

### Option B: Every 5 minutes (recommended, ~8,640 API calls/month)
```javascript
setupGitHubAutoImport(5);
```

### Option C: Every 15 minutes (conservative, ~2,880 API calls/month)
```javascript
setupGitHubAutoImport(15);
```

**To enable:**
1. In Apps Script, select the function: `setupGitHubAutoImport`
2. Click **Run** (▶️ icon)
3. You'll see a confirmation dialog

**Note:** GitHub's API rate limit is 5,000 requests/hour for authenticated requests. Even at 1-minute intervals, you'll only use ~60 requests/hour.

## Step 6: Verify Automatic Sync

1. Make a change to your GitHub Project (move a task, update a title, etc.)
2. Wait for the sync interval (1-5 minutes)
3. Check your Google Sheet to see the changes reflected

## Troubleshooting

### "Failed to fetch project data"
- Verify your GitHub token is correct in `GitHubConfig.js`
- Ensure the token has `project` and `read:org` scopes
- Check that `projectNumber: 2` matches your project URL

### "GitHub API request failed with status 401"
- Your token is invalid or expired
- Generate a new token and update `GitHubConfig.js`

### "GitHub API request failed with status 403"
- Rate limit exceeded (unlikely with normal usage)
- Token doesn't have required permissions

### "GraphQL errors"
- Check the Apps Script logs (View > Logs) for detailed error messages
- Verify your username and project number are correct

### No data appearing in sheet
- Check if the trigger is running: **Apps Script > Triggers** (⏰ icon on left)
- Look for `importGitHubTasks` in the trigger list
- Check execution logs: **Apps Script > Executions** (📋 icon on left)

## Managing the Sync

### Disable automatic sync
```javascript
removeGitHubAutoImport();
```

### Manual import (run once)
```javascript
importGitHubTasks();
```

### Change sync frequency
1. Run `removeGitHubAutoImport()` first
2. Then run `setupGitHubAutoImport(X)` with your desired interval

## Sheet Structure

The imported data includes these columns:

| Column | Description |
|--------|-------------|
| Task ID | Unique GitHub identifier |
| Type | ISSUE, DRAFT_ISSUE, or PULL_REQUEST |
| Number | Issue/PR number |
| Title | Task title |
| Status | Current status column (Backlog, Ready, etc.) |
| Priority | Priority level (if set) |
| State | OPEN, CLOSED, or MERGED |
| Repository | Repo name (if applicable) |
| URL | Direct link to task |
| Assignees | Comma-separated list |
| Labels | Comma-separated list |
| Created At | When task was created |
| Updated At | Last update timestamp |
| Closed At | When task was closed (if applicable) |
| Custom Fields | Any other project fields |

## API Usage & Limits

- **GitHub API Rate Limit:** 5,000 requests/hour (authenticated)
- **Sync intervals:**
  - 1 minute = ~60 requests/hour
  - 5 minutes = ~12 requests/hour
  - 15 minutes = ~4 requests/hour
- **Apps Script Quotas:**
  - Free: 90 minutes/day of execution time
  - Each sync typically takes 2-5 seconds
  - Even at 1-minute intervals: ~2.4 minutes/day

## Security Best Practices

1. **Never commit your token to version control**
2. **Use token expiration** (regenerate periodically)
3. **Limit token scopes** to only what's needed
4. **Revoke old tokens** when no longer needed
5. **Don't share your spreadsheet** with untrusted users (they can view the script)

## Next Steps

- Customize the `sheetName` in `GitHubConfig.js`
- Add conditional formatting to highlight different statuses
- Create pivot tables or charts from the task data
- Combine with other data sources (Calendar, Domo, etc.)

## Support

If you encounter issues:
1. Check **Apps Script > Executions** for error logs
2. Run `testGitHubImport()` to see detailed error messages
3. Verify your configuration in `GitHubConfig.js`
4. Check GitHub token permissions and expiration
