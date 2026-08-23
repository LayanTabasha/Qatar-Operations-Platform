# Qatar Operations — Codebase Map

This document answers one practical question:

> **“I need to change something in the platform — where do I start?”**

It maps each visible feature to the frontend file that owns it, shows the shared files it depends on, and explains how to trace a change into the backend and database.

> **Important:** the frontend paths below reflect the final handover structure. For exact backend module filenames, route registration, repository/query files, and schema columns, inspect the current `backend/src/` tree before changing them. Do not rely on an old project version or guess a backend path.

---

## 1. High-level structure

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

### How to think about it

- `index.html` controls the **active frontend script load order and cache tokens**.
- `app.js` owns the remaining **application-level orchestration and delegated events**.
- `js/state.js` owns the shared application state and common helpers.
- `js/api-client.js` is the centralized frontend → backend API layer.
- `js/auth-router.js` owns authentication, session restoration, routing, and saved view context.
- `frontend/pages/` contains feature-specific UI logic.
- `frontend/shared/` contains reusable modal, file, and display utilities.
- `backend/src/` contains the Express/PostgreSQL backend.
- `backend/tests/` contains the frontend/backend regression suite.

---

# 2. Frontend entry and core

| Responsibility | File | What to know before changing it |
|---|---|---|
| HTML shell + script order | `index.html` | **Every changed active JS file needs a new cache token here.** |
| Global styles | `styles.css` | Shared across the full SPA |
| App orchestration / delegated events | `app.js` | Some global event listeners and cross-page actions remain here |
| Shared state + helpers | `js/state.js` | Single mutable application state; deliberately left centralized |
| Frontend API client | `js/api-client.js` | Central place for frontend API calls |
| Authentication + routing | `js/auth-router.js` | Login/session/routing/saved view context; foundational file |

## Core dependency flow

```text
index.html
   ↓
state.js
   ↓
api-client.js
   ↓
auth-router.js
   ↓
feature/shared scripts
   ↓
app.js
```

The project uses **classic browser scripts**, not ES modules. Top-level `const`, `let`, and `class` declarations therefore need special care because duplicate declarations can stop the entire frontend from starting.

---

# 3. Homepage

Directory:

```text
frontend/pages/homepage/
```

| Feature | File | Main responsibility |
|---|---|---|
| KPI cards | `kpi-cards.js` | Sites, Chargers, Open Faults, Site Visits counts |
| Fault Status | `fault-status.js` | Fault Status doughnut/summary rendering |
| Charger Status Distribution | `charger-status.js` | Charger status normalization and chart |
| Fault Trend | `fault-trend.js` | Time ranges, grouping, site selection, totals, sparklines, chart lifecycle |
| Site Visit Activity | `visit-activity.js` | Visit activity grouping/display |
| Records by Site | `records-by-site.js` | Per-Site operational-record summary |
| Requests Status | `requests-status.js` | Homepage Requests status card/chart and access behavior |
| Recent Activity | `recent-activity.js` | Recent activity list and activity icons |
| Global Search | `global-search.js` | Cross-platform search and Site/Charger navigation |
| Shared Homepage helpers | `home-shared.js` | Shared chart colors, grouping, legends, empty states |
| Homepage orchestration | `home-page.js` | Calls Homepage component renderers in the correct flow |

## Homepage rules worth preserving

Fault statuses are only:

```text
Open
In Progress
Resolved
```

`Closed` is not active.

The Homepage uses shared Site definitions and operational state. If a chart looks wrong, verify the data in `state` and the API response before changing chart logic.

---

# 4. Sites and Chargers

Directory:

```text
frontend/pages/sites/
```

This is the main operational area of the platform.

| Feature / responsibility | File | Notes |
|---|---|---|
| Main Sites list | `sites-list.js` | Site cards, search, status filter |
| Site profile | `site-profile.js` | Site profile shell and Site tabs |
| Charger profile | `charger-profile.js` | Charger profile shell and Charger tabs |
| Site Visits | `site-visits.js` | Visit rows, attachments, Site Visit-specific lifecycle |
| Faults | `faults.js` | Fault rows and Fault photo rendering |
| Documents / Weekly Reports / Troubleshooting | `operational-records.js` | Shared filtering, tables, View / Download / Edit / Delete controls |
| Charger archive lifecycle | `charger-lifecycle.js` | Archived Charger restore and permanent deletion |
| Backend → frontend mapping | `sites-data-mappers.js` | Converts backend response shapes into frontend records |
| Data loading / profile refresh | `sites-data.js` | `loadOperationalData()` and `refreshOpenProfiles()` |
| Shared Sites helpers | `sites-shared.js` | Shared filter helpers, options, operational filter state |

## Critical Site rule

**Al Mana, Mowasalat, and Msheireb do not have separate JavaScript implementations.**

They all use the same files above.

If something works at Al Mana but not at Mowasalat, investigate:

1. Site record
2. Charger records
3. Site/Charger IDs and relationships
4. API response
5. archive/inactive state
6. current frontend context
7. attachments / Site images / record relationships
8. active filters
9. shared code last

Do not create a per-Site JavaScript file as a shortcut.

## Site / Charger context rules

| Record type | Allowed context |
|---|---|
| Site Visit | Site-only or Site + Charger |
| Fault | Site-only or Site + Charger |
| Document | Site-only or Site + Charger |
| Weekly Report | **Site-only** |
| Troubleshooting | Site-only or Site + Charger |

## Refresh rule

`refreshOpenProfiles()` lives in:

```text
frontend/pages/sites/sites-data.js
```

It intentionally restores an open **Charger profile first** before falling back to Site-only context.

This preserves:

- current Site
- current Charger
- active Charger tab
- visible Charger profile

Do not reverse this flow without understanding the historical profile-context regression.

---

# 5. Requests

Directory:

```text
frontend/pages/requests/
```

| Responsibility | File |
|---|---|
| Shared request state/options | `requests-shared.js` |
| List, filters, loading states | `requests-list.js` |
| Detail view + attachments | `request-detail.js` |
| Form/submission UI | `request-form.js` |
| Page/event orchestration | `requests-page.js` |

Important compatibility globals include:

```text
submitRequestForm()
updateRequestsNavigation()
loadRequestsPage()
```

## Requests access

- Administrator: access
- HQ User: access
- Operations Staff: no access
- Viewer: no access

If Requests visibility is wrong, inspect the current permission helper and backend authorization before changing the page itself.

---

# 6. Contacts

Main file:

```text
frontend/pages/contacts/contacts-page.js
```

Responsibilities include:

- Contacts page rendering
- search/filtering
- Site display/association
- contact list behavior

Add/Edit form behavior is handled through the shared modal system.

Current Contact model supports:

- Name
- Role
- Organization / Department
- Phone
- Email
- optional Assigned Site
- Notes

`site_id` may be `NULL`.

Do not reintroduce the old UI concepts:

```text
Scope
All Sites / HQ
External / No Site
```

---

# 7. Settings and Archive

Directory:

```text
frontend/pages/settings/
```

| Feature | File |
|---|---|
| Shared Settings definitions | `settings-shared.js` |
| Account / security UI | `account-settings.js` |
| Platform Health | `platform-health.js` |
| User Management | `user-management.js` |
| Archive | `archive-page.js` |
| Settings orchestration | `settings-page.js` |

## Typical ownership

### User Management

Start with:

```text
frontend/pages/settings/user-management.js
```

Then trace mutation calls through:

```text
frontend/shared/modals/
js/api-client.js
backend/src/
```

### Archive

Start with:

```text
frontend/pages/settings/archive-page.js
```

Archive actions may refresh operational Site/Charger data afterward. If a restore changes what appears in Sites, also inspect:

```text
frontend/pages/sites/sites-data.js
```

---

# 8. Shared modals

Directory:

```text
frontend/shared/modals/
```

| File | Responsibility |
|---|---|
| `modal-files.js` | File/image processing and attachment helpers |
| `fault-modals.js` | Fault/DTC form helpers |
| `modal-configs.js` | Modal configuration definitions |
| `modal-core.js` | Generic modal shell, context, prefill and detail views |
| `modal-submit.js` | Submission/API mutation/refresh dispatcher |

Important global functions include:

```text
openModal()
closeModal()
openSiteVisitDetail()
openFaultDetail()
handleModalSubmit()
```

## When a form is wrong

For example, if the **Add Fault** modal has the wrong Site/Charger:

1. inspect the triggering feature/context;
2. inspect `modal-configs.js`;
3. inspect `modal-core.js`;
4. inspect Fault-specific helpers in `fault-modals.js`;
5. inspect submission handling in `modal-submit.js`;
6. inspect the API payload in `js/api-client.js`;
7. inspect backend validation/route behavior.

---

# 9. Shared files and utilities

| Responsibility | File |
|---|---|
| File preview | `frontend/shared/files/file-preview.js` |
| Shared display/formatting helpers | `frontend/shared/utils/display-utils.js` |
| Brand assets | `frontend/assets/brand/` |

## Protected file workflow

Preview:

```text
/api/v1/attachments/:id/preview
```

Download:

```text
/api/v1/attachments/:id/download
```

Operational files should not be exposed by bypassing these endpoints with a public raw upload URL.

---

# 10. Backend orientation

Backend root:

```text
backend/src/
```

The backend is Node.js/Express with PostgreSQL.

The current backend contains:

- configuration
- database/migrations
- middleware
- route/resource modules
- utilities
- operational scripts
- authentication/authorization logic

Platform resource areas include:

- authentication
- users / roles
- Sites
- Chargers
- Site Visits
- Faults
- DTC / fault catalogue
- Documents
- Weekly Reports
- Troubleshooting
- Requests
- Contacts
- operational attachments
- Archive/lifecycle behavior
- activity/audit behavior

## Backend rule

Do **not** copy a backend path from an old project version.

Before editing a backend feature:

1. inspect current route registration;
2. inspect the matching resource/module;
3. inspect request validation and role authorization;
4. inspect repository/query/database logic;
5. inspect existing tests.

The detailed exact backend module/route map should be verified against the final repository before handover publication.

---

# 11. Frontend → backend tracing pattern

When a feature needs a change, trace it in this order:

```text
Visible UI
   ↓
Feature file in frontend/pages/
   ↓
Modal/shared helper if applicable
   ↓
js/api-client.js
   ↓
Express route / backend resource
   ↓
Repository/query/database logic
   ↓
Migration only if schema changes
   ↓
Tests
```

### Example: Fault change

```text
frontend/pages/sites/faults.js
        ↓
frontend/shared/modals/fault-modals.js
        ↓
frontend/shared/modals/modal-submit.js
        ↓
js/api-client.js
        ↓
backend Fault route/module
        ↓
faults table / related migrations
```

### Example: Contact change

```text
frontend/pages/contacts/contacts-page.js
        ↓
frontend/shared/modals/modal-core.js
        ↓
frontend/shared/modals/modal-submit.js
        ↓
js/api-client.js
        ↓
backend Contacts route/module
        ↓
contacts table
```

### Example: File preview issue

```text
frontend/shared/files/file-preview.js
        ↓
js/api-client.js
        ↓
/api/v1/attachments/:id/preview
        ↓
backend attachment/preview logic
        ↓
stored operational file / generated preview
```

---

# 12. Database and migrations

Production database:

```text
qatar_operations
```

Current handover baseline:

```text
028_remove_closed_fault_status.sql
```

All 28 current migrations were applied at final QA.

Never edit an already-applied migration.

For schema work:

1. inspect the existing migrations;
2. inspect current backend queries;
3. add the next numbered migration;
4. back up production;
5. review and apply deliberately;
6. verify migration state;
7. test affected workflows.

See:

```text
docs/DATABASE_MAP.md
```

for the database-oriented handover.

---

# 13. Tests

Tests live under:

```text
backend/tests/
```

The suite includes backend tests and frontend regression/contract tests.

Final QA baseline:

```text
55 test files
472 tests passed

Exact-index startup harness: 9/9
Active frontend script syntax checks: 44/44
ESLint: passed
git diff --check: passed
```

One especially important regression file is the exact-index frontend startup test. It loads the active frontend scripts in the same order as `index.html` and is intended to catch duplicate globals, missing dependencies, and startup failures.

---

# 14. Active frontend cache rule

When any active JavaScript file changes:

1. update its `?v=` token in `index.html`;
2. run the exact-index startup test;
3. confirm the live `index.html` references the new token;
4. fetch the live script URL and confirm HTTP 200;
5. compare live and local content where appropriate;
6. hard-refresh with browser cache disabled;
7. check the Console.

Historical failure:

```text
Identifier 'siteListFilters' has already been declared
```

This happened because a newly extracted file and an old cached script were both loaded.

A correct source tree alone is not enough; the browser must also receive the current files.

---

# 15. “Where should I change this?” quick table

| If you want to change… | Start here |
|---|---|
| Homepage KPI | `frontend/pages/homepage/kpi-cards.js` |
| Fault Status | `frontend/pages/homepage/fault-status.js` |
| Charger Status | `frontend/pages/homepage/charger-status.js` |
| Fault Trend | `frontend/pages/homepage/fault-trend.js` |
| Global Search | `frontend/pages/homepage/global-search.js` |
| Main Site cards/filter | `frontend/pages/sites/sites-list.js` |
| Site profile | `frontend/pages/sites/site-profile.js` |
| Charger profile | `frontend/pages/sites/charger-profile.js` |
| Site Visit display | `frontend/pages/sites/site-visits.js` |
| Fault display | `frontend/pages/sites/faults.js` |
| Documents / Weekly Reports / Troubleshooting | `frontend/pages/sites/operational-records.js` |
| Site/Charger backend mapping | `frontend/pages/sites/sites-data-mappers.js` |
| Operational data refresh | `frontend/pages/sites/sites-data.js` |
| Requests list/filter | `frontend/pages/requests/requests-list.js` |
| Request detail | `frontend/pages/requests/request-detail.js` |
| Request form | `frontend/pages/requests/request-form.js` |
| Contacts page | `frontend/pages/contacts/contacts-page.js` |
| Users | `frontend/pages/settings/user-management.js` |
| Archive | `frontend/pages/settings/archive-page.js` |
| Platform Health | `frontend/pages/settings/platform-health.js` |
| Add/Edit form behavior | `frontend/shared/modals/` |
| File preview | `frontend/shared/files/file-preview.js` |
| Shared state / permissions | `js/state.js` |
| API call | `js/api-client.js` |
| Login / routing | `js/auth-router.js` |
| Schema / migration | backend migration area + `docs/DATABASE_MAP.md` |

---

# 16. Files that are intentionally NOT current production owners

Do not look for active feature logic in the removed pre-reorganization monolithic files:

```text
js/home-page.js
js/sites-page.js
js/requests-page.js
js/settings-page.js
js/modals.js
```

Their responsibilities were moved into the feature-organized structure documented above.

Historical/prototype material under:

```text
/var/www/qatar-operations/archive/
```

is also **not** active production source.

---

# 17. Safe change checklist

Before editing:

- identify the owning feature file;
- identify any shared modal/helper it depends on;
- trace the API call;
- understand the backend permission rule;
- understand the relevant database relationship.

After editing:

- update the frontend cache token if an active JS file changed;
- run relevant tests;
- run the exact-index startup harness for frontend changes;
- run ESLint/syntax validation;
- verify the live page/API;
- confirm the browser Console is clean;
- commit the smallest coherent change.

For deployment and rollback details, see [`DEPLOYMENT.md`](DEPLOYMENT.md).
For production troubleshooting, see [`OPERATIONS_RUNBOOK.md`](OPERATIONS_RUNBOOK.md).
