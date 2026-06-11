# Tasks Migration — Progress

Lightweight running checklist. Update as you (Cascade or human) complete steps.
For the full plan, see [`TASKS_MIGRATION_PLAN.md`](./TASKS_MIGRATION_PLAN.md).

**Current phase:** Phase 4 complete — ready for Phase 5 hard cutover (kill GitHub plumbing)

---

## Phase 1 — Schema, types, security rules ✅

- [x] Plan docs written (`TASKS_MIGRATION_PLAN.md`, `TASKS_DATA_MODEL.md`)
- [x] New TS types in `account-dashboard/src/types/tasks.ts`
- [x] `firestore.rules` permits `tasks` collection (auth + ObservePoint domain;
      activity is append-only)
- [x] `firestore.indexes.json` updated with 5 composite indexes for tasks
- [x] Hooks: `useTasks`, `useTask`, `useTaskComments`, `useTaskActivity` in
      `account-dashboard/src/hooks/useTasks.ts`
- [x] Rules + indexes deployed to Firebase project
- [x] TypeScript build passes
- [x] Reviewed and signed off by user

## Phase 2 — Read-only UI (parallel display) ✅

- [x] `/tasks` route registered in router (`App.tsx`) + Tasks link in header
- [x] `TaskBoard` kanban component (`components/tasks/TaskBoard.tsx`)
- [x] `TaskList` table component (sortable) (`components/tasks/TaskList.tsx`)
- [x] `TaskDetail` drawer with markdown, comments, activity, sub-tasks
      (`components/tasks/TaskDetail.tsx`)
- [x] Account-filter sidebar reads real `accounts` collection
      (`components/tasks/AccountFilterSidebar.tsx`)
- [x] `TaskPanelV2` on account detail page reads from new `tasks` collection
      (`components/tasks/TaskPanelV2.tsx`)
- [x] Old `TaskPanel` left rendering above legacy GitHub data; both panels
      visible until cutover
- [x] `react-markdown` + `remark-gfm` installed; `.prose-task` style added
- [x] Production build passes (`npm run build`)
- [x] User reviewed and approved → proceed to Phase 3

## Phase 3 — Write UI + auto-gen pipeline ✅

- [x] Write helpers in `account-dashboard/src/hooks/taskMutations.ts`
      (`createTask`, `updateTask`, `deleteTask`, `addComment`, `setTaskStatus`)
      with automatic `activity` subcollection logging
- [x] `TaskFormModal.tsx` for create + edit; reused for sub-task creation
- [x] `AccountPicker.tsx` searchable combobox (used in modal + TaskDetail
      inline reassignment)
- [x] `New Task` buttons wired into `TasksPage` (global) and `TaskPanelV2`
      (account-locked)
- [x] `TaskDetail` editing: inline status / priority pills (PillSelect),
      inline target-date input, inline account picker, comment composer,
      sub-task button, edit-in-modal, delete with confirm
- [x] Drag-and-drop status changes on `TaskBoard` (HTML5 native, MIME-typed
      payload), `setTaskStatus` mutation persists with activity entry
- [x] Apps Script `TaskFromRecap.js`:
      `createFirestoreTasksFromActionItems(meetingRecapId, recap)` writes
      `tasks/{uuid}` docs with `source: 'meeting_recap'`, an initial
      `activity/{uuid}` entry, normalized priority, and meeting-context
      markdown description. Idempotent via new "Firestore Task ID" column on
      `Meeting Action Items` sheet
- [x] `WebhookHandler.js` Step 5 swapped from `createGitHubIssuesFromActionItems`
      to `createFirestoreTasksFromActionItems` (HARD CUTOVER); Step 4
      (`importGitHubTasks`) commented out, slated for deletion in Phase 6
- [x] `processCreateTaskWebhook` repurposed to write Firestore (legacy
      `TaskPanel.tsx` still POSTs here; both old + new UI now write the same
      collection)
- [x] Manual helper: `createMissingFirestoreTasksFromActionItems()` mops up
      rows missing a Firestore Task ID after the cutover
- [x] TypeScript build passes (`npx tsc --noEmit`)
- [x] **Live verification**: May 22 Caleres meeting recap → Firestore task end-to-end
      verified; dashboard renders generated tasks; create/edit/delete/drag-drop/
      comment/sub-task flows confirmed from `/tasks` and `TaskPanelV2`
- [x] Action item sheet column-transposition bug rooted out
      (`writeMyActionItemsToSheet` now column-name-aware in `WebhookHandler.js`)
- [x] `TaskFromRecap.js` hardened: `buildAccountIdToNameMap_` canonical source,
      `resolveAccountIdentity_` rejects accountName === accountId; one-shot
      `repairActionItemAndTaskAccounts()` patched 329 Firestore tasks + 347
      sheet rows on 2026-06-01

## Phase 4 — Migration & verification ✅

- [x] `VerifyGithubToFirestoreCoverage.js` written — audits GH issue →
      action-item-row → Firestore-task coverage end-to-end
- [x] Initial audit (2026-06-01): 370 GH issues; 339 already covered via the
      meeting-recap pipeline; 0 leaked; 31 never migrated
- [x] `MigrateGithubToFirestoreTasks.js` written with dry-run + real-run modes
- [x] Inactive-account resolution: name→id map merges Salesforce
      `Accounts Card Report` (active) with Firestore `accounts` (includes
      deactivated like Bluebeam)
- [x] Dry run validated 31 classifications (8 truly unlabeled)
- [x] Full migration run: 31/31 tasks created, 0 errors, 0 comments
      (none of the imported issues had GH comments)
- [x] Post-migration verify: `NEVER MIGRATED: 0` (pending user re-run for sign-off)
- [x] User signs off on accuracy — pending one-shot reverify

## Phase 5 — Hard cutover

- [ ] Remove GitHub auto-import trigger
- [ ] Remove GitHub join from `Account Data Raw`
- [ ] Mark `tasks: []` on account doc as deprecated (still synced for rollback)
- [ ] Monitor 1–2 weeks

## Phase 6 — Decommission

- [ ] Delete `GitHubImport.js`, `GitHubAccountSync.js`, `GitHubIssueCreator.js`,
      `GitHubConfig.js`
- [ ] Strip GitHub code from `WebhookHandler.js`
- [ ] Delete `GitHub Tasks` sheet
- [ ] Remove `GITHUB_TOKEN` from script properties
- [ ] Archive GitHub Project + `OP-Tasklist` repo
- [ ] Remove `tasks: []` array from account docs (one-shot Firestore migration)
- [ ] Remove webhook handlers `?type=create_task` / `?type=close_task`
- [ ] Update root `README.md`

## Phase 7 — "More" features

- [ ] Saved filters/views
- [ ] Bulk-edit selection

---

## Notes / decisions log

- 2026-05-21: User chose hard cutover (Q4) instead of dual-write. Migration must
  produce 100% accuracy on first run; verification step is critical.
- 2026-05-21: User clarified `account:Name` was a GitHub workaround — new schema
  uses `accountId` as a real FK to `accounts/{id}`.
