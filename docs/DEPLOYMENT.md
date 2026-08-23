# Qatar Operations — Deployment Guide

This guide explains how to update the **Qatar Operations Platform** safely in production.

Use it whenever you are changing:

- frontend HTML / CSS / JavaScript
- backend Node.js / Express code
- PostgreSQL schema
- Nginx configuration
- production runtime settings

> **Important:** Qatar Operations is a live production platform. Do not restart services, run migrations, or modify Nginx unless the change actually requires it.

---

# 1. Production quick reference

| Item | Production value |
|---|---|
| Live site | `https://zdoperations.zdenergyqatar.com` |
| Source | `/var/www/qatar-operations/source` |
| Backend | `/var/www/qatar-operations/source/backend` |
| Uploads | `/var/www/qatar-operations/uploads` |
| Database | `qatar_operations` |
| Backend port | `3000` |
| PM2 application | `qatar-operations-backend` |
| Backend entry point | `/var/www/qatar-operations/source/backend/src/server.js` |
| Nginx vhost | `/etc/nginx/sites-available/zdoperations` |
| Latest handover migration | `028_remove_closed_fault_status.sql` |

Production request flow:

```text
Browser
   ↓
Nginx
   ├── static frontend
   └── /api/
          ↓
     127.0.0.1:3000
          ↓
     Node.js / Express
          ↓
      PostgreSQL
```

---

# 2. Before changing anything

Start from the production source directory:

```bash
cd /var/www/qatar-operations/source
```

Check Git:

```bash
git status
git branch --show-current
git log --oneline -5
```

Check the application:

```bash
pm2 status
```

Check the live website:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  https://zdoperations.zdenergyqatar.com/
```

Check backend health:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  https://zdoperations.zdenergyqatar.com/api/health
```

Expected healthy result:

```text
Homepage: 200
API health: 200
PM2 qatar-operations-backend: online
```

If production is already unhealthy, diagnose that first. Do not stack a deployment on top of an existing problem.

---

# 3. Decide what type of change you are making

Use this table before deploying.

| Change type | Typical examples | PM2 restart? | Nginx reload? | Migration? |
|---|---|---:|---:|---:|
| Frontend-only | HTML, CSS, frontend JavaScript | Usually no | No | No |
| Backend | Express route, service, repository, validation | Usually yes | No | Only if schema changed |
| Database | new table/column/constraint/index | Usually after migration if backend changed | No | Yes |
| Nginx | proxy/security/static rules | No | Yes | No |
| Mixed | frontend + backend + DB | Depends | Usually no unless Nginx changed | Depends |

Do only what the change requires.

---

# 4. Frontend-only deployment

Frontend files are served directly by Nginx from the production source.

Typical frontend areas:

```text
index.html
styles.css
app.js
js/
frontend/pages/
frontend/shared/
```

## Step 1 — Make the change

Edit the owning feature file only.

Use:

```text
docs/CODEBASE_MAP.md
```

to identify the correct file.

## Step 2 — Update the JavaScript cache token

This is mandatory for any active frontend JavaScript file that changes.

Example:

```html
<script src="frontend/pages/sites/sites-list.js?v=NEW-TOKEN"></script>
```

Do not leave a changed script using an old token.

### Why this matters

The frontend uses classic browser scripts.

A previous deployment loaded:

- a newly extracted script
- and an older cached copy of the previous script

Both declared the same top-level constant:

```text
Identifier 'siteListFilters' has already been declared
```

The result was a blank Homepage.

So after changing JavaScript:

1. update its token in `index.html`;
2. run the frontend startup tests;
3. verify the live script URL;
4. hard-refresh with browser cache disabled.

## Step 3 — Run validation

From the repository/backend directory, use the current test scripts defined in `backend/package.json`.

At minimum, run:

- relevant feature tests
- full regression suite where appropriate
- exact-index frontend startup harness
- ESLint
- syntax checks
- `git diff --check`

The final handover baseline was:

```text
55 test files / 472 tests passed
startup harness: 9/9
44/44 active frontend scripts passed syntax checks
ESLint: passed
git diff --check: passed
```

These numbers may increase later as new tests are added.

## Step 4 — Verify the live script

Check that live `index.html` contains the new token:

```bash
curl -s https://zdoperations.zdenergyqatar.com/ | \
grep "<script-name-or-token>"
```

Check the script itself:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
"https://zdoperations.zdenergyqatar.com/path/to/script.js?v=NEW-TOKEN"
```

Expected:

```text
200
```

When needed, compare live and local file content or SHA-256.

## Step 5 — Browser validation

In Chrome/Edge:

```text
F12
→ Network
→ Disable cache
→ Ctrl + Shift + R
```

Check Console for:

```text
SyntaxError
ReferenceError
duplicate declaration
404 script
```

## Step 6 — Confirm key pages

At minimum:

- Homepage
- Sites
- Site profile
- Charger profile
- Contacts
- Requests for an authorized user
- Settings
- Archive

### PM2 restart?

Normally **not required** for a frontend-only change.

---

# 5. Backend deployment

Backend path:

```text
/var/www/qatar-operations/source/backend
```

PM2 process:

```text
qatar-operations-backend
```

## Before restart

Run tests first.

Check current status:

```bash
pm2 status
pm2 logs qatar-operations-backend --lines 100
```

## Restart after backend code changes

```bash
pm2 restart qatar-operations-backend
```

Then verify:

```bash
pm2 status
```

and:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  https://zdoperations.zdenergyqatar.com/api/health
```

Expected:

```text
200
```

Check logs again:

```bash
pm2 logs qatar-operations-backend --lines 100
```

If the configured production process list needs to be persisted:

```bash
pm2 save
```

Do not restart PM2 merely because a frontend asset changed.

---

# 6. Database migrations

Qatar Operations uses numbered SQL migrations.

Migration directory is inside the backend database structure.

The migration runner used in production is:

```bash
cd /var/www/qatar-operations/source/backend
node src/db/migrate.js
```

Final handover baseline:

```text
28 migrations applied
latest: 028_remove_closed_fault_status.sql
```

## Rules

Never:

- edit an already-applied migration;
- rename an applied migration;
- delete an applied migration;
- manually run random SQL in production without review;
- assume Git rollback reverses a database migration.

For a new schema change:

1. back up the database;
2. create the next numbered migration;
3. review the SQL;
4. run tests;
5. apply migration once;
6. verify migration status;
7. restart backend only if backend code also changed;
8. verify affected workflows.

---

# 7. Database backup before significant schema work

Keep backups outside the public web root.

Example:

```bash
sudo -u postgres pg_dump -Fc -d qatar_operations \
  -f /secure-backups/qatar-operations-YYYYMMDD.dump
```

Verify the destination exists and is restricted.

Do not store database dumps under:

```text
/var/www/qatar-operations/source
```

---

# 8. Nginx changes

Production vhost:

```text
/etc/nginx/sites-available/zdoperations
```

Nginx currently:

- serves the frontend
- proxies `/api/` to `127.0.0.1:3000`
- blocks backend source
- blocks dotfiles
- blocks protected raw uploads
- keeps Site images intentionally public
- protects sensitive development/runtime paths

## Safe Nginx workflow

### Step 1 — Back up the config

Example:

```bash
sudo cp /etc/nginx/sites-available/zdoperations \
/etc/nginx/sites-available/zdoperations.backup-$(date +%Y%m%d-%H%M%S)
```

### Step 2 — Edit carefully

Do not weaken existing security rules unless the change is intentional and reviewed.

### Step 3 — Validate

```bash
sudo nginx -t
```

If validation fails:

```text
STOP.
Do not reload Nginx.
```

### Step 4 — Reload

Only after a successful test:

```bash
sudo systemctl reload nginx
```

### Step 5 — Verify

Check:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  https://zdoperations.zdenergyqatar.com/

curl -s -o /dev/null -w "%{http_code}\n" \
  https://zdoperations.zdenergyqatar.com/api/health
```

---

# 9. Upload and attachment security

## Intentionally public

Site images:

```text
/uploads/site-images/*
```

## Protected

Do not directly expose:

```text
/uploads/operational-files/*
/uploads/previews/*
general /uploads/ paths
```

Protected attachment workflows use authenticated APIs:

```text
/api/v1/attachments/:id/preview
/api/v1/attachments/:id/download
```

At handover QA:

- direct protected upload paths returned HTTP 404
- unauthenticated preview/download returned HTTP 401
- backend source and dotfiles returned HTTP 404

Do not make `/uploads/` publicly accessible to solve a preview/download problem.

---

# 10. Security checks after deployment

Sensitive paths should not be publicly retrievable.

Examples:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
https://zdoperations.zdenergyqatar.com/backend/.env

curl -s -o /dev/null -w "%{http_code}\n" \
https://zdoperations.zdenergyqatar.com/backend/package.json

curl -s -o /dev/null -w "%{http_code}\n" \
https://zdoperations.zdenergyqatar.com/backend/src/server.js

curl -s -o /dev/null -w "%{http_code}\n" \
https://zdoperations.zdenergyqatar.com/.git/config
```

Expected:

```text
404
```

Never print the contents of sensitive files during verification.

---

# 11. Environment configuration

Production backend environment file:

```text
/var/www/qatar-operations/source/backend/.env
```

It must remain:

- outside Git tracking
- inaccessible over HTTP
- readable only by authorized server users

Never place actual environment values in:

- README
- documentation
- Git commits
- screenshots
- support messages

If the next developer needs credentials, obtain them securely from the authorized system owner.

---

# 12. Rollback

Verified pre-reorganization source snapshot:

```text
Commit:
a47e07424344f131cf4de54c0812b3c95004eea2

Tag:
production-pre-handover-20260818
```

This tag is a source-code rollback/reference point.

Do not rewrite or move it.

## Important limitation

Git rollback does **not** automatically restore:

- PostgreSQL data
- database migrations
- uploads
- generated previews
- environment configuration
- Nginx configuration
- PM2 configuration

Before rollback, identify exactly which layers changed.

For example:

```text
Frontend-only problem
→ source rollback may be enough

Backend code problem
→ source rollback + PM2 restart

Database migration problem
→ source rollback alone is NOT enough

Nginx problem
→ restore validated Nginx backup
```

---

# 13. Production backups to preserve

Before major work, consider backing up:

| Item | Location / method |
|---|---|
| PostgreSQL | `pg_dump` outside web root |
| Uploads | `/var/www/qatar-operations/uploads` |
| Nginx config | `/etc/nginx/sites-available/zdoperations` |
| PM2 config | PM2 dump/configuration |
| Backend environment | `/var/www/qatar-operations/source/backend/.env` |

Environment backups must have restrictive permissions.

---

# 14. After-deployment checklist

Use this after any non-trivial deployment.

## Git

```bash
git status
```

Worktree should be understood and intentional.

## Homepage

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
https://zdoperations.zdenergyqatar.com/
```

Expected:

```text
200
```

## Backend

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
https://zdoperations.zdenergyqatar.com/api/health
```

Expected:

```text
200
```

## PM2

```bash
pm2 status
```

Confirm:

```text
qatar-operations-backend  online
```

## Browser

Open production and verify:

- login
- Homepage
- Sites
- Site/Charger profiles
- Faults
- Site Visits
- Documents
- Weekly Reports
- Troubleshooting
- Contacts
- Requests for authorized role
- Settings
- Archive

## Frontend changes

Also verify:

- new cache tokens
- current live JavaScript
- no Console errors
- startup harness passed

## Backend changes

Also verify:

- logs
- API route
- permissions
- database write/read behavior

## Database changes

Also verify:

- migration applied once
- expected schema behavior
- no pending unexpected migration

---

# 15. What NOT to do

Do not:

- restart PM2 after every frontend change;
- reload Nginx without `nginx -t`;
- edit applied migrations;
- expose `/uploads/` broadly;
- expose `backend/.env`;
- copy secrets into Git;
- run destructive SQL without backup/review;
- start a second backend process on port 3000;
- treat `/var/www/qatar-operations/archive/` as production source;
- forget frontend cache-token updates;
- assume a successful HTTP 200 means the entire UI initialized correctly.

---

# 16. If deployment goes wrong

Do not stack more changes.

Check the failing layer first:

```text
Blank frontend
→ browser Console / cache / script order

API failure
→ PM2 / logs / PostgreSQL / port 3000

Nginx failure
→ nginx -t / config backup

Database failure
→ migration state / DB backup / backend logs

One Site only
→ Site/Charger data and relationships before shared code
```

Then make the smallest possible correction.

See:

```text
docs/OPERATIONS_RUNBOOK.md
```

for full troubleshooting procedures.

---

# 17. Final handover baseline

At final QA:

```text
Homepage: HTTP 200
/api/health: HTTP 200
PM2: qatar-operations-backend online

55 test files
472 tests passed

startup harness: 9/9
frontend syntax: 44/44
ESLint: passed
git diff --check: passed

latest migration:
028_remove_closed_fault_status.sql

known outstanding functional issues:
none found
```

Treat this as the production handover baseline, not as a guarantee that future test counts remain identical.
