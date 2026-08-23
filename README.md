# ZD Energy Qatar — Qatar Operations Platform

Qatar Operations is the production platform used to manage ZD Energy Qatar's EV charging operations across **Al Mana, Mowasalat, and Msheireb**.

It brings Sites, Chargers, Faults, Site Visits, Documents, Weekly Reports, Troubleshooting records, Contacts, Requests, Users, Archive, DTC information, attachments, and dashboard reporting into one shared system.

> **New to this project?** Start with `docs/CODEBASE_MAP.md` and `docs/DEPLOYMENT.md` before making production changes. The private Developer Handover is distributed separately and is intentionally not stored in GitHub.

**Live site:** https://zdoperations.zdenergyqatar.com
**GitHub repository:** https://github.com/LayanTabasha/Qatar-Operations-Platform

---

## What does it do?

| Part | What it does |
|---|---|
| **Homepage** | Shows Sites, Chargers, Open Faults and Site Visit KPIs, plus Fault Status, Charger Status, Fault Trend, Site Visit Activity, Records by Site, Requests Status, Recent Activity and Global Search |
| **Sites & Chargers** | Stores the three production Sites, Charger records, Site profiles, Charger profiles, search/filtering and operational context |
| **Faults & DTC** | Tracks operational Faults and provides a DTC fault-identification catalogue |
| **Site Visits** | Stores Site Visit records and their report attachments |
| **Documents** | Stores operational documents linked to a Site or Site + Charger |
| **Weekly Reports** | Stores weekly operational reports at Site level |
| **Troubleshooting** | Stores troubleshooting guides and related operational files |
| **Contacts** | Stores operational contacts with an optional Site assignment |
| **Requests** | Lets authorized users submit, review and process operational requests |
| **Settings / Users** | Provides account settings, Platform Health and User Management |
| **Archive** | Handles restore and permanent lifecycle actions for supported archived records |

---

## Production sites

The active production Sites are:

- **Al Mana**
- **Mowasalat**
- **Msheireb**

All three Sites use the **same shared frontend and backend code**.

There is intentionally no separate `almana.js`, `mowasalat.js`, or `msheireb.js`.

If one Site behaves differently from another, check its data, Charger relationships, API response, archive state, Site/Charger context, attachments and filters before changing shared code.

---

## Technology

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, classic browser JavaScript, Chart.js |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Process manager | PM2 |
| Reverse proxy | Nginx |
| Production server | Ubuntu Linux |
| Hosting | DigitalOcean |

Production architecture:

```text
Browser
  ↓
Nginx
  ↓
Static frontend
  ↓
/api/v1
  ↓
Node.js / Express
  ↓
PostgreSQL
```

---

## Project structure

```text
qatar-operations/
├── index.html
├── styles.css
├── app.js
│
├── js/
│   ├── state.js
│   ├── api-client.js
│   └── auth-router.js
│
├── frontend/
│   ├── pages/
│   │   ├── homepage/
│   │   ├── sites/
│   │   ├── requests/
│   │   ├── contacts/
│   │   └── settings/
│   │
│   ├── shared/
│   │   ├── modals/
│   │   ├── files/
│   │   └── utils/
│   │
│   └── assets/
│       └── brand/
│
├── backend/
│   ├── src/
│   └── tests/
│
└── docs/
```

For the exact feature-to-file map, see [`docs/CODEBASE_MAP.md`](docs/CODEBASE_MAP.md).

---

## Getting started locally

The frontend is static HTML/CSS/JavaScript and the backend is Node.js/Express with PostgreSQL.

Use the current repository scripts and configuration as the source of truth.

```bash
# 1. Get the code
git clone <repo-url>
cd <repo-folder>

# 2. Install backend dependencies
cd backend
npm install

# 3. Create the backend environment file
cp .env.example .env
# Fill in the required values securely

# 4. Configure PostgreSQL
# Create/use the project database and confirm the connection settings in .env

# 5. Apply migrations
node src/db/migrate.js

# 6. Start the backend using the repository's configured npm script
# Check backend/package.json for the current start/dev command
```

Then serve/open the frontend using the project's current local development method.

> Do not guess production credentials or copy `.env` from Git. Obtain required secrets securely from the authorized system owner.

---

## Environment configuration

Production environment configuration lives outside source control.

The backend uses:

```text
backend/.env
```

This file must **never** be committed or exposed publicly.

Use `backend/.env.example` as the template if present in the repository.

Typical categories of configuration include:

- PostgreSQL connection details
- session/authentication secrets
- runtime/port configuration
- allowed origins / production URL settings
- other backend service configuration defined by the current source

Do not place real passwords, tokens, private keys, certificates or database credentials in this README.

For production configuration and security rules, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Running in production

### Production paths

```text
Source:   /var/www/qatar-operations/source
Backend:  /var/www/qatar-operations/source/backend
Uploads:  /var/www/qatar-operations/uploads
```

### Backend process

```text
PM2 application: qatar-operations-backend
Backend entry:    /var/www/qatar-operations/source/backend/src/server.js
Backend port:     3000
```

Useful commands:

```bash
pm2 status
pm2 logs qatar-operations-backend --lines 100
pm2 restart qatar-operations-backend
pm2 save
```

### Nginx

Production Nginx configuration:

```text
/etc/nginx/sites-available/zdoperations
```

Nginx serves the frontend and proxies:

```text
/api/  →  http://127.0.0.1:3000
```

Always validate before reloading:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

A frontend-only HTML/CSS/JavaScript change normally does **not** require a PM2 restart.

Full production procedure: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

---

## User roles

| Role | Main access |
|---|---|
| **Administrator** | Operational records, Site/Charger administration, User Management, authorized Requests visibility, Archive/admin functions |
| **HQ User** | Operational records and authorized Requests processing |
| **Operations Staff** | Operational records; no Requests access |
| **Viewer** | Read-only operational access; View and Download only |

Backend authorization is the source of truth.

Hiding a button in the frontend is **not** security. If a role is not allowed to perform an action, the backend must reject it too.

For detailed maintenance guidance, see [`docs/CODEBASE_MAP.md`](docs/CODEBASE_MAP.md), [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md), and [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md).

---

## Main application areas

The platform is a single-page application. These are feature areas, not separate server-rendered page routes.

### Homepage
- KPI cards
- Fault Status
- Charger Status Distribution
- Fault Trend
- Site Visit Activity
- Records by Site
- Requests Status
- Recent Activity
- Global Search
- Quick Actions

### Sites & Chargers
- Main Site list
- Site search and status filter
- Site profiles
- Charger profiles
- Site Visits
- Faults
- Documents
- Weekly Reports
- Troubleshooting

### Requests
- Request list
- Request detail
- Request form
- attachments
- response/status processing for authorized roles

### Contacts
- Contact list
- search/filter
- Add / Edit / Delete
- optional Site assignment

### Settings
- Account
- Platform Health
- User Management
- Archive

---

## Fault lifecycle

Active Fault statuses are only:

- **Open**
- **In Progress**
- **Resolved**

`Closed` was removed from the active lifecycle.

**Resolved is not the same as Archive.**

---

## Files and attachments

The platform handles Site images, operational attachments, Request attachments, Documents, Weekly Reports, Troubleshooting files, Site Visit reports, Fault evidence/photos, and generated previews.

Site images may be served from:

```text
/uploads/site-images/*
```

Operational files and previews must not be exposed through raw public `/uploads/` URLs.

Protected files use authenticated API endpoints including:

```text
/api/v1/attachments/:id/preview
/api/v1/attachments/:id/download
```

Do **not** make `/uploads/` broadly public to work around a preview or download problem.

---

## Database and migrations

Production database:

```text
qatar_operations
```

Schema changes use numbered SQL migrations.

Current handover baseline:

```text
028_remove_closed_fault_status.sql
```

All 28 current migration files were applied at final QA.

Migration runner:

```bash
cd /var/www/qatar-operations/source/backend
node src/db/migrate.js
```

Rules:

- never edit an already-applied migration
- add the next numbered migration
- back up production before significant schema changes
- review the SQL before applying it
- verify migration state and affected workflows afterward

See [`docs/DATABASE_MAP.md`](docs/DATABASE_MAP.md).

---

## Critical frontend cache rule

This is one of the most important maintenance rules in the project.

The frontend uses classic `<script>` tags with cache tokens in `index.html`.

Whenever an active frontend JavaScript file changes:

1. update that script's `?v=` cache token in `index.html`;
2. run the exact-index startup regression test;
3. verify the live script URL;
4. hard-refresh the browser;
5. check DevTools Console for `SyntaxError` or `ReferenceError`.

A previous reorganization incident loaded a newly extracted script together with an old cached script. Both declared the same top-level constant:

```text
Identifier 'siteListFilters' has already been declared
```

The result was a blank Homepage.

Treat cache-token updates as mandatory for frontend JavaScript deployment.

---

## Running the tests

Final handover QA baseline:

```text
55 test files
472 tests
472 passed

Startup harness: 9/9 passed
Frontend syntax: 44/44 active local scripts passed
ESLint: passed
git diff --check: passed
```

Run the repository's backend test command from:

```bash
cd /var/www/qatar-operations/source/backend
```

Check `backend/package.json` for the current authoritative npm test/lint scripts before running them.

The test counts above are a handover baseline, not a fixed requirement. Future valid tests may increase the totals.

---

## Security

Do not commit or expose:

- `backend/.env`
- private keys or certificates
- database dumps/backups
- uploads
- previews
- logs
- `node_modules`
- generated outputs

Direct public access to backend source and sensitive files is intentionally blocked.

At final QA, paths such as these were not publicly accessible:

```text
/backend/.env
/backend/package.json
/backend/src/server.js
/.git/config
```

Operational attachments must remain protected behind authenticated APIs.

Historical/prototype material is stored separately under:

```text
/var/www/qatar-operations/archive/
```

Do not treat that directory as active production source.

---

## Troubleshooting

For quick checks:

```bash
cd /var/www/qatar-operations/source
git status

pm2 status
pm2 logs qatar-operations-backend --lines 100

curl -s -o /dev/null -w "%{http_code}\n"   https://zdoperations.zdenergyqatar.com/api/health
```

| Symptom | First checks |
|---|---|
| Blank Homepage | Console errors, duplicate declarations, script 404s, cache tokens |
| Frontend change missing | `index.html` token, public script content, Disable cache, hard refresh |
| API unavailable | PM2, `/api/health`, backend logs, PostgreSQL, port 3000 |
| One Site broken | Site/Charger records, IDs, API response, archive state, context, attachments, filters |
| Charger profile lost after refresh | `refreshOpenProfiles()` and saved Site/Charger/tab context |
| File preview/download fails | Authenticated attachment endpoint, attachment ID/path, backend logs |
| 403 | User role + backend authorization |
| Migration problem | Migration state, SQL review, backup |

Full troubleshooting guide: [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md)

---

## Documentation

| File | What's in it |
|---|---|
| [`docs/CODEBASE_MAP.md`](docs/CODEBASE_MAP.md) | Exact feature-to-file map |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Production deployment, Nginx, PM2, migrations, backups, rollback and security |
| [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md) | Production troubleshooting and recovery |
| [`docs/DATABASE_MAP.md`](docs/DATABASE_MAP.md) | Database, migrations and relationship overview |

Recommended reading order:

1. Developer Handover + README
2. `docs/CODEBASE_MAP.md`
3. `docs/DEPLOYMENT.md`
4. `docs/OPERATIONS_RUNBOOK.md`
5. `docs/DATABASE_MAP.md` as needed

---

## Production handover baseline

At final QA:

- Homepage returned HTTP 200
- `/api/health` returned HTTP 200
- PM2 application `qatar-operations-backend` was online
- 55/55 test files passed
- 472/472 tests passed
- startup harness passed 9/9
- 44/44 active local scripts passed syntax checks
- ESLint passed
- `git diff --check` passed
- no known outstanding functional issues were found

Verified pre-reorganization rollback reference:

```text
Branch: handover/production-snapshot-20260818
Commit: a47e07424344f131cf4de54c0812b3c95004eea2
Tag: production-pre-handover-20260818
```

The Git snapshot covers source code. It does **not** automatically restore PostgreSQL data, uploads, environment configuration or later database migrations.

**Final GitHub repository URL and authoritative remote branch will be added after the final verified GitHub push.**
