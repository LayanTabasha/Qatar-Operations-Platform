# Qatar Operations — Operations Runbook

This runbook is the practical troubleshooting and recovery guide for the live **Qatar Operations Platform**.

Use it when the platform is unavailable, a page is blank, data is missing, a Site or Charger behaves incorrectly, files do not open, permissions look wrong, or a recent deployment appears to have caused a problem.

> **Goal:** identify the failing layer first, then make the smallest safe correction. Do not stack unrelated fixes on top of an unresolved production issue.

---

## 1. Production quick reference

| Item | Production value |
|---|---|
| Live site | `https://zdoperations.zdenergyqatar.com` |
| Source | `/var/www/qatar-operations/source` |
| Backend | `/var/www/qatar-operations/source/backend` |
| Uploads | `/var/www/qatar-operations/uploads` |
| Database | `qatar_operations` |
| Backend port | `3000` |
| PM2 application | `qatar-operations-backend` |
| Nginx vhost | `/etc/nginx/sites-available/zdoperations` |
| Latest handover migration | `028_remove_closed_fault_status.sql` |

Healthy request path:

```text
Browser → Nginx → frontend or /api/ → Node.js/Express :3000 → PostgreSQL
```

---

## 2. First five checks

When somebody reports that “the website is not working,” start here.

```bash
# 1. Public site
curl -s -o /dev/null -w "%{http_code}\n" https://zdoperations.zdenergyqatar.com/

# 2. Backend health
curl -s -o /dev/null -w "%{http_code}\n" https://zdoperations.zdenergyqatar.com/api/health

# 3. Runtime
pm2 status

# 4. Backend logs
pm2 logs qatar-operations-backend --lines 100

# 5. Git state
cd /var/www/qatar-operations/source
git status
git log --oneline -8
```

Healthy baseline:

```text
Homepage: 200
/api/health: 200
qatar-operations-backend: online
```

If production is already unhealthy, diagnose that first. Do not deploy another change on top of an unresolved problem.

---

## 3. Fast diagnosis table

| Symptom | Likely layer | Start with |
|---|---|---|
| Entire domain unavailable | Nginx / server / network | Nginx and server status |
| HTML returns 200 but screen is blank | Frontend JavaScript | Console, script order, cache tokens |
| Login works but data does not load | API / database | Network tab, `/api/health`, PM2 logs |
| `/api/health` fails | Backend / PostgreSQL | PM2, port 3000, logs, DB |
| One module is broken | Feature frontend/API | Console + Network + owning feature file |
| Only one Site is wrong | Data/context | Site/Charger records and relationships |
| Charger profile disappears after refresh | Frontend context | `refreshOpenProfiles()` |
| File View/Download fails | Attachment workflow | API status, attachment ID, backend logs |
| User sees wrong actions | Permissions | role + backend authorization |
| New frontend code does not appear | Browser cache | `index.html` token + live script |
| 403 | Authorization | role and backend permission |
| 401 on protected file | Authentication | login/session |
| Protected raw upload gives 404 | Usually expected | use attachment API |
| Migration error | Database | migration state + backup + logs |

---

## 4. Blank Homepage or broken frontend

If the Homepage and `/api/health` both return `200` but the UI is blank, suspect frontend startup before touching PM2 or Nginx.

Open:

```text
F12 → Console
```

Look for:

```text
SyntaxError
ReferenceError
Identifier '...' has already been declared
404 script
```

Then:

```text
F12 → Network → Disable cache → Ctrl + Shift + R
```

Inspect active scripts locally and publicly:

```bash
cd /var/www/qatar-operations/source
grep -n "<script" index.html
curl -s https://zdoperations.zdenergyqatar.com/ | grep "<script"
```

### Historical failure to remember

During frontend reorganization, a newly extracted Sites script and an older cached script both declared `siteListFilters`. Browser startup stopped with:

```text
Identifier 'siteListFilters' has already been declared
```

The Homepage disappeared even though the server and API were healthy.

Correct response:

1. inspect Console;
2. identify the duplicate/stale script;
3. correct the script reference/cache token;
4. run the exact-index startup harness;
5. verify live script content;
6. hard-refresh with cache disabled.

---

## 5. Frontend change is not appearing

Check the token locally:

```bash
grep -n "<script-name>" /var/www/qatar-operations/source/index.html
```

Check public HTML:

```bash
curl -s https://zdoperations.zdenergyqatar.com/ | grep "<script-name>"
```

Check the current script URL:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
"https://zdoperations.zdenergyqatar.com/path/to/script.js?v=CURRENT-TOKEN"
```

Expected: `200`.

When necessary, compare local/public SHA-256. Then hard-refresh with browser cache disabled.

Do not repeatedly rewrite working source code when the actual problem is stale browser content.

---

## 6. Backend/API unavailable

```bash
pm2 status
pm2 logs qatar-operations-backend --lines 100
ss -ltnp | grep :3000
```

Test through Nginx:

```bash
curl -i https://zdoperations.zdenergyqatar.com/api/health
```

If the managed backend is stopped and there is no unresolved configuration/database issue:

```bash
pm2 restart qatar-operations-backend
```

Verify again afterward.

Do **not** start a second manual Node process on port `3000` while PM2 owns the application.

---

## 7. PM2 restart loop or high CPU

```bash
pm2 status
pm2 logs qatar-operations-backend --lines 200
pm2 describe qatar-operations-backend
```

Check host resources:

```bash
top
free -h
df -h
```

Identify whether the resource problem belongs to Node.js, PostgreSQL, Nginx, or another process before changing application code.

Do not repeatedly restart a failing process without reading the error first.

---

## 8. Database connection problem

Symptoms may include API health failure, login/API errors, or operational data failing to load.

Start with backend logs:

```bash
pm2 logs qatar-operations-backend --lines 100
```

Check PostgreSQL:

```bash
sudo systemctl status postgresql
```

Production database:

```text
qatar_operations
```

Do not print database passwords from `backend/.env` during troubleshooting.

---

## 9. Migration problem

Handover baseline:

```text
28 migrations applied
latest: 028_remove_closed_fault_status.sql
```

Migration runner:

```bash
cd /var/www/qatar-operations/source/backend
node src/db/migrate.js
```

If a migration fails:

1. stop additional schema work;
2. read the exact database error;
3. determine whether anything partially applied;
4. inspect migration state;
5. confirm a database backup exists before corrective work;
6. never rewrite an already-successfully-applied historical migration.

**Git rollback does not undo database schema or data changes.**

---

## 10. Only one Site is broken

Production Sites:

```text
Al Mana
Mowasalat
Msheireb
```

They use the same shared code. There are no per-Site JavaScript implementations.

Investigate in this order:

1. Site ID and Site record;
2. Site/archive status;
3. Charger relationships and IDs;
4. backend API response;
5. current Site/Charger context;
6. operational record relationships;
7. attachments/Site images;
8. active filters;
9. shared code last.

Do not create Site-specific JavaScript as a workaround.

---

## 11. Charger profile disappears after refresh

Owner:

```text
frontend/pages/sites/sites-data.js
```

Important function:

```text
refreshOpenProfiles()
```

The refresh is intentionally **Charger-first** and preserves Site ID, Charger ID, active tab, and Charger profile visibility.

If context is lost, inspect the saved Site/Charger state, active tab, refreshed data, and `refreshOpenProfiles()` before changing the flow.

---

## 12. Sites search or operational filters look wrong

Main Sites filter:

```text
frontend/pages/sites/sites-list.js
```

Operational filter state/helpers:

```text
frontend/pages/sites/sites-shared.js
```

Operational records:

```text
frontend/pages/sites/operational-records.js
```

Filters intentionally persist across rerenders and data refreshes. Clear filters and confirm context/data before concluding records are missing.

---

## 13. Fault problem

Active statuses are only:

```text
Open
In Progress
Resolved
```

`Closed` must not be reintroduced.

Frontend display:

```text
frontend/pages/sites/faults.js
```

Fault modal flow:

```text
frontend/shared/modals/fault-modals.js
frontend/shared/modals/modal-core.js
frontend/shared/modals/modal-submit.js
```

If Add Fault opens from a Charger profile, Site and Charger context should remain selected.

Trace data issues as:

```text
UI → modal/context → api-client.js → backend Fault endpoint → database
```

---

## 14. Site Visit problem

Owner:

```text
frontend/pages/sites/site-visits.js
```

Check Site/Charger context, Visit record, attachment/report ID, attachment metadata, active filters, and API response.

Site Visits may be Site-only or Site + Charger.

---

## 15. Documents, Weekly Reports or Troubleshooting problem

Shared owner:

```text
frontend/pages/sites/operational-records.js
```

Context rules:

| Module | Context |
|---|---|
| Documents | Site or Site + Charger |
| Weekly Reports | **Site only** |
| Troubleshooting | Site or Site + Charger |

A Weekly Report receiving Charger context should be treated as a bug.

---

## 16. File preview or download fails

Frontend preview owner:

```text
frontend/shared/files/file-preview.js
```

Protected endpoints:

```text
GET /api/v1/attachments/:id/preview
GET /api/v1/attachments/:id/download
```

Use DevTools Network to inspect the status:

- `401` → authentication/session
- `403` → authorization
- `404` → attachment ID, record, stored path, or missing file
- `5xx` → backend/preview/conversion error; inspect PM2 logs

Do not expose the raw operational uploads directory as a workaround.

Site images are the intentional public exception under `/uploads/site-images/*`.

---

## 17. Office preview problem

Expected flow:

```text
View
 → file-preview.js
 → authenticated preview endpoint
 → backend preview/conversion
 → PDF/blob
 → internal preview modal
```

For Word/Excel/PowerPoint failures:

1. inspect Network response;
2. verify attachment ID;
3. check backend logs;
4. verify the source file exists;
5. verify the server conversion/preview dependency;
6. inspect generated preview handling;
7. test Download separately.

Do not bypass authenticated previewing with a public raw URL.

---

## 18. Requests problem

Frontend:

```text
frontend/pages/requests/
```

| Role | Requests access |
|---|---|
| Administrator | Yes |
| HQ User | Yes |
| Operations Staff | No |
| Viewer | No |

If access is wrong, confirm the logged-in role, frontend permission/navigation logic, backend authorization, and API response.

Backend authorization is authoritative.

---

## 19. User Management problem

Owner:

```text
frontend/pages/settings/user-management.js
```

Mutations may also involve shared modals, `js/api-client.js`, and backend user logic.

Do not bypass current-user protection, audit safeguards, or foreign-key behavior with manual SQL.

---

## 20. Archive problem

Owner:

```text
frontend/pages/settings/archive-page.js
```

Archive is not the same as a Fault being Resolved.

If a restored Site/Charger does not reappear:

1. confirm restore API success;
2. confirm archive state;
3. refresh operational data;
4. inspect `sites-data.js`;
5. clear filters if needed.

Permanent deletion is destructive. Verify the record before proceeding.

---

## 21. Contacts problem

Owner:

```text
frontend/pages/contacts/contacts-page.js
```

`site_id` may be `NULL` or a valid Site ID.

Current Contact model supports Name, Role, Organization/Department, Phone, Email, optional Assigned Site, and Notes.

Do not reintroduce the obsolete `Scope` model.

---

## 22. Permission / 403 problem

General production model:

| Role | Operational records | Site/Charger/User administration | Requests |
|---|---|---|---|
| Administrator | Manage | Manage | Authorized access |
| HQ User | Manage | No | Process |
| Operations Staff | Manage | No | No access |
| Viewer | Read-only | Read-only | No access |

For exact action-level behavior, inspect current backend authorization and tests.

Do not solve a backend `403` by simply removing frontend permission checks.

---

## 23. Nginx problem

Production vhost:

```text
/etc/nginx/sites-available/zdoperations
```

Validate first:

```bash
sudo nginx -t
```

If validation fails, **do not reload**.

Check service status:

```bash
sudo systemctl status nginx
```

Nginx security rules intentionally protect backend source, dotfiles, raw operational uploads, and sensitive runtime/development paths.

---

## 24. SSL / HTTPS problem

If HTTPS fails while the server is otherwise reachable:

1. inspect Nginx configuration;
2. inspect the installed certificate;
3. check certificate expiry/renewal status;
4. run `sudo nginx -t` before any reload.

Do not permanently weaken TLS/certificate verification as a shortcut. Temporary troubleshooting workarounds should be reverted after the certificate issue is fixed.

---

## 25. SSH connection timeout

If SSH times out:

1. verify the DigitalOcean server is running;
2. verify its public IP;
3. check firewall/network rules;
4. test another network if appropriate;
5. use the DigitalOcean console when SSH itself is unavailable.

A timeout normally points to connectivity/firewall/server availability, unlike `Permission denied`, which is an authentication problem.

---

## 26. Security verification

Sensitive paths should remain inaccessible publicly:

```text
/backend/.env
/backend/package.json
/backend/src/server.js
/.git/config
```

Expected public result: `404`.

At final QA, unauthenticated protected attachment access returned `401` rather than file contents.

Never print secrets while testing these controls.

---

## 27. Git checks during an incident

```bash
cd /var/www/qatar-operations/source
git status
git branch --show-current
git log --oneline -8
```

Understand the current branch, commit, uncommitted work, and recent timeline before changing production.

Verified pre-reorganization source reference:

```text
Tag: production-pre-handover-20260818
Commit: a47e07424344f131cf4de54c0812b3c95004eea2
```

This is a source snapshot only. It does not restore the database, uploads, `.env`, Nginx, or later migrations.

---

## 28. When to restart what

| Situation | Correct action |
|---|---|
| Frontend JS/CSS/HTML changed | Usually no service restart |
| Backend Node.js changed | Restart `qatar-operations-backend` |
| `.env` changed | Restart backend after safe config change |
| Nginx config changed | `nginx -t`, then reload |
| DB migration added | Run deliberately; restart backend only if accompanying code requires it |
| Browser shows stale frontend | Cache token + hard refresh, not PM2 |
| API healthy but UI blank | Debug frontend first |

---

## 29. Recovery order

For a serious incident:

```text
1. Stop making changes
2. Capture Git / PM2 / Nginx state
3. Identify frontend vs API vs DB vs proxy
4. Read the actual error
5. Compare with last known-good state
6. Make the smallest correction
7. Run relevant tests
8. Verify production
9. Commit/document the correction
```

Avoid restarting services merely to “see if it helps.” It can hide useful failure state and make the timeline harder to understand.

---

## 30. Final production health checklist

After recovery verify:

### Public

```text
Homepage → HTTP 200
/api/health → HTTP 200
```

### Runtime

```text
PM2 → qatar-operations-backend online
port 3000 → expected backend process
Nginx → valid/running
PostgreSQL → reachable
```

### Browser

Check login, Homepage, Sites, Site/Charger profiles, Faults, Site Visits, Documents, Weekly Reports, Troubleshooting, Contacts, Requests with an authorized account, Settings, and Archive.

### Frontend

Check no Console startup errors, current cache tokens, no duplicate scripts, and current live files.

### Security

Confirm backend source, `.env`, `.git`, and protected raw uploads remain blocked, and attachment APIs require authentication.

---

## 31. Final handover baseline

```text
Homepage: HTTP 200
/api/health: HTTP 200
PM2: qatar-operations-backend online
Database: qatar_operations

Migrations: 28/28 applied
Latest: 028_remove_closed_fault_status.sql

Tests: 55/55 files, 472/472 passed
Startup harness: 9/9 passed
Frontend syntax: 44/44 passed
ESLint: passed
git diff --check: passed

Known outstanding functional issues: none discovered
```

These numbers describe the handover baseline. Future legitimate development may increase the test count.

---

## Related documentation

- `README.md` — project overview and starting point
- Private Developer Handover — distributed separately and intentionally not stored in GitHub
- `docs/CODEBASE_MAP.md` — where each feature lives in the code
- `docs/DEPLOYMENT.md` — planned deployment, backup and rollback procedures
- `docs/DATABASE_MAP.md` — database structure, relationships and migrations
