# Tasks — Data Model Reference

**Last updated:** 2026-05-21 · **Status:** Phase 1 design

This document is the authoritative schema reference for the new task manager.
For the broader migration plan, see [`TASKS_MIGRATION_PLAN.md`](./TASKS_MIGRATION_PLAN.md).

---

## Collections

```
firestore/
├── tasks/{taskId}                          ← top-level, NOT under accounts
│   ├── comments/{commentId}                ← subcollection
│   └── activity/{activityId}               ← subcollection
├── taskConfig/statuses                     ← shared enum config
├── taskConfig/priorities
└── taskConfig/views/{viewId}               ← saved filters (Phase 7)
```

Top-level (`tasks`) so we can query across accounts efficiently. The previous
GitHub-derived `tasks: []` array on `accounts/{id}` becomes deprecated in
Phase 5.

---

## `tasks/{taskId}` document

```ts
interface Task {
  taskId: string;                           // Firestore auto-id (or UUID)

  // Core
  title: string;                            // <= 200 chars
  description: string;                      // markdown, no length limit (~1 MiB doc cap)

  // Workflow
  status: TaskStatus;                       // see enum below
  priority: TaskPriority | null;            // null = unset
  targetDate: string | null;                // ISO date "YYYY-MM-DD" (no time)

  // Account linkage (FIRST-CLASS, not a label)
  accountId: string | null;                 // FK to accounts/{accountId}, or null for general tasks

  // Hierarchy
  parentTaskId: string | null;              // null = root task
  // childTaskIds is NOT stored; query `tasks where parentTaskId == thisId` instead
                                            // (avoids dual-write consistency problems)

  // Assignment (future-proof)
  assigneeIds: string[];                    // empty = unassigned. Single-user: defaults to ["john.davis@observepoint.com"]

  // Provenance
  source: TaskSource;
  sourceRef: TaskSourceRef;

  // Audit
  createdAt: string;                        // ISO timestamp
  updatedAt: string;                        // ISO timestamp
  closedAt: string | null;                  // set when status → done | not_applicable
  createdBy: string;                        // user id (email) or 'system' for auto-gen
}

type TaskStatus =
  | 'backlog'        // not started, low urgency
  | 'generated'      // auto-generated, awaiting triage
  | 'in_progress'    // actively being worked
  | 'done'           // completed
  | 'not_applicable' // dismissed, no action needed

type TaskPriority = 'critical' | 'high' | 'medium' | 'low'

type TaskSource =
  | 'manual'         // created in dashboard UI
  | 'meeting_recap'  // auto-generated from Otter action item
  | 'email'          // future: created from email
  | 'imported'       // backfilled from GitHub during Phase 4

interface TaskSourceRef {
  meetingRecapId?: string;                  // accounts/{aid}/meetingRecaps/{rid}
  emailMessageId?: string;                  // future
  manuallyCreatedBy?: string;               // user id, set on source='manual'
  githubLegacyNumber?: number;              // only on source='imported'
  githubLegacyNodeId?: string;              // only on source='imported'
}
```

---

## `tasks/{taskId}/comments/{commentId}` subcollection

```ts
interface TaskComment {
  commentId: string;
  body: string;                             // markdown
  authorId: string;                         // email
  createdAt: string;
  editedAt: string | null;
}
```

Comments are write-once-edit-occasionally. No real-time presence indicator.

---

## `tasks/{taskId}/activity/{activityId}` subcollection

```ts
interface TaskActivity {
  activityId: string;
  type: TaskActivityType;
  actorId: string;                          // email or 'system'
  timestamp: string;
  // type-specific payload
  detail?: {
    field?: string;                         // 'status' | 'priority' | 'accountId' | ...
    from?: any;
    to?: any;
    note?: string;                          // free-form, e.g. for 'imported_from_github'
  };
}

type TaskActivityType =
  | 'created'
  | 'status_changed'
  | 'priority_changed'
  | 'account_changed'
  | 'assignee_added'
  | 'assignee_removed'
  | 'parent_changed'
  | 'comment_added'
  | 'closed'
  | 'reopened'
  | 'imported_from_github'
```

Written by the dashboard SDK on any mutation, and by Apps Script on auto-gen and
import. Append-only — never modified.

---

## Composite indexes

Required Firestore composite indexes (will be added to `firestore.indexes.json`):

| Collection | Fields | Use case |
|---|---|---|
| `tasks` | `accountId ASC, status ASC, updatedAt DESC` | Account detail page kanban |
| `tasks` | `status ASC, targetDate ASC` | Global kanban + due-date sort |
| `tasks` | `assigneeIds ARRAY-CONTAINS, status ASC, targetDate ASC` | "My open tasks" view |
| `tasks` | `parentTaskId ASC, createdAt ASC` | Sub-task children query |
| `tasks` | `source ASC, createdAt DESC` | Audit / "show all auto-generated" |

---

## Query patterns

```ts
// Account detail kanban
query(collection(db, 'tasks'),
      where('accountId', '==', accountId),
      orderBy('status'), orderBy('updatedAt', 'desc'))

// Global kanban — all open
query(collection(db, 'tasks'),
      where('status', 'in', ['backlog','generated','in_progress']),
      orderBy('targetDate', 'asc'))

// My critical open (Phase 7 saved view)
query(collection(db, 'tasks'),
      where('assigneeIds', 'array-contains', currentUserEmail),
      where('status', 'in', ['backlog','generated','in_progress']),
      where('priority', '==', 'critical'),
      orderBy('targetDate', 'asc'))

// Sub-tasks of a parent
query(collection(db, 'tasks'),
      where('parentTaskId', '==', parentId),
      orderBy('createdAt', 'asc'))

// Activity feed for a task
query(collection(taskRef, 'activity'),
      orderBy('timestamp', 'desc'),
      limit(50))
```

---

## Security rules (sketch — finalized in Phase 1)

```
match /tasks/{taskId} {
  allow read, write: if request.auth != null
                     && request.auth.token.email.matches('.*@observepoint[.]com$');

  match /comments/{commentId} {
    allow read, write: if request.auth != null
                       && request.auth.token.email.matches('.*@observepoint[.]com$');
  }
  match /activity/{activityId} {
    allow read: if request.auth != null
                && request.auth.token.email.matches('.*@observepoint[.]com$');
    // activity is append-only; create allowed, update/delete denied
    allow create: if request.auth != null
                  && request.auth.token.email.matches('.*@observepoint[.]com$');
    allow update, delete: if false;
  }
}
```

The Apps Script back-end uses ADC / a service account that bypasses rules — but
all client writes are funneled through these rules.

---

## Migration mapping (Phase 4)

When importing GitHub issues:

| GitHub field | New `Task` field | Notes |
|---|---|---|
| `title` | `title` | direct |
| `body` | `description` | direct (markdown preserved) |
| Project field "Status" | `status` | map "Backlog"→`backlog`, "Generated"→`generated`, "In progress"→`in_progress`, "Done"→`done`, "Not Applicable"→`not_applicable` |
| Project field "Priority" | `priority` | lowercase |
| Project field "Target date" | `targetDate` | direct (ISO date) |
| Project field "Start date" | (DROPPED) | per Q2 decision |
| Project field "Size" | (DROPPED) | per Q2 decision |
| Project field "Estimate" | (DROPPED) | per Q2 decision |
| Project field "Milestone" | (DROPPED) | per Q2 decision |
| Issue assignees | `assigneeIds` | map GitHub login → ObservePoint email if known, else GitHub login string |
| `account:Name` label | `accountId` | look up `accountName` in `accounts` collection. If no match, `accountId: null` and add `imported_from_github` activity with note. |
| Other labels | (DROPPED) | only `auto-generated` is meaningful, captured via `source: 'meeting_recap'` if matchable, else `source: 'imported'` |
| `auto-generated` label | `source: 'meeting_recap'` (best-effort) or `source: 'imported'` | If we can match to a `meetingRecapId` via body parsing, set source accordingly. |
| Issue parent / sub-issue | `parentTaskId` / inferred children | Two-pass: import all tasks first, then resolve parent links. |
| Issue comments | comments subcollection | preserve `authorId`, `createdAt`, `body` |
| Issue created/updated/closed | `createdAt` / `updatedAt` / `closedAt` | direct |
| Issue number | `sourceRef.githubLegacyNumber` | preserved for back-references |
| Issue node id | `sourceRef.githubLegacyNodeId` | preserved |
| Issue URL | (DROPPED, derivable) | After GitHub archive, repo is read-only at `https://github.com/johndavis92790/OP-Tasklist/issues/{number}`. |

Project state changes / activity history → activity subcollection entries with
`type: 'imported_from_github'` and `detail.note` containing a summary.
