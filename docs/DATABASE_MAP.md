# Qatar Operations — Database Map

This document explains the PostgreSQL database used by the **Qatar Operations Platform**.

Use it when you need to understand:

- which business areas are stored in the database;
- how Sites, Chargers and operational records relate;
- which relationships are intentionally nullable;
- how Fault, User and Archive lifecycles work;
- how attachments are associated with operational records;
- how migrations must be handled safely.

> **Important:** this document gives the verified handover-level database structure and rules. Before changing an exact column, foreign key, index, trigger, constraint, or cascade rule, inspect the current migration files and backend repository/query code. Do not infer schema details from frontend field names alone.

---

# 1. Production database

| Item | Value |
|---|---|
| Database engine | PostgreSQL |
| Production database | `qatar_operations` |
| Migration style | Numbered SQL migrations |
| Handover migration count | 28 applied |
| Latest migration | `028_remove_closed_fault_status.sql` |
| Migration runner | `node src/db/migrate.js` |

Backend directory:

```text
/var/www/qatar-operations/source/backend
```

Migration command:

```bash
cd /var/www/qatar-operations/source/backend
node src/db/migrate.js
```

At final handover QA:

```text
28/28 migrations applied
0 pending migrations
latest = 028_remove_closed_fault_status.sql
```

---

# 2. Migration rules

These rules are mandatory.

## Never edit an already-applied migration

Once a migration has been successfully applied in production:

- do not modify it;
- do not rename it;
- do not delete it;
- do not change its order.

For a new schema change, create the **next numbered migration**.

Example:

```text
028_remove_closed_fault_status.sql
029_<next_change>.sql
```

## Before applying a significant migration

1. back up the production database;
2. review the SQL;
3. confirm the current migration state;
4. run relevant tests;
5. apply the migration once;
6. verify migration status;
7. verify affected API/frontend workflows;
8. restart the backend only if accompanying backend code requires it.

## Important rollback rule

Git rollback does **not** undo database changes.

If source code is reverted but a later migration remains applied, the application may become incompatible with the database.

Always treat source rollback and database rollback as separate decisions.

---

# 3. Main tables

The verified handover baseline identifies these main production tables:

```text
roles
users
sites
chargers
site_visits
faults
fault_catalogue
documents
reports
troubleshooting_records
requests
contacts
activity_logs
operational_attachments
```

The backend also maintains migration state through its migration system, including the applied migration history.

Before modifying exact table definitions, inspect the migrations and current backend data-access code.

---

# 4. High-level relationship map

Conceptually, the data model looks like this:

```text
roles
  │
  └── users
        │
        ├── created/updated operational records
        └── activity history

sites
  │
  ├── chargers
  │
  ├── site_visits
  │
  ├── faults
  │
  ├── documents
  │
  ├── reports
  │
  ├── troubleshooting_records
  │
  └── contacts (optional relationship)

chargers
  │
  ├── faults
  ├── site_visits
  ├── documents
  └── troubleshooting_records

operational records
  │
  └── operational_attachments

fault_catalogue
  └── DTC reference data

requests
  └── request lifecycle / attachments where supported

activity_logs
  └── append-only operational/audit history
```

Not every relationship above is mandatory. Several operational record types may be Site-only.

---

# 5. Roles and users

## `roles`

Stores the platform role definitions used by authorization.

Production roles are:

```text
Administrator
HQ User
Operations Staff
Viewer
```

Authorization behavior is enforced primarily by the backend.

Do not change role behavior by editing frontend visibility only.

## `users`

Stores application user records and role association.

Important lifecycle rule:

> User deletion must not destroy operational history.

The production user-deletion model was deliberately changed from simple deactivation to permanent deletion, with database safeguards so historical records remain valid.

Where designed, historical user foreign-key references may become:

```text
NULL
```

instead of causing old operational records to be deleted.

Do not change user foreign-key behavior without reviewing:

- current migrations;
- user repository/service logic;
- audit-log protection;
- deletion tests.

---

# 6. Sites

## `sites`

Represents an operational Site.

Current production Sites:

```text
Al Mana
Mowasalat
Msheireb
```

Important rule:

All Sites use the same application code.

Site-specific behavior is driven by:

- the Site record;
- related Chargers;
- operational records;
- uploaded Site assets;
- archive state;
- API relationships.

Do not create database or frontend exceptions for one Site unless the business requirement truly differs.

Typical relationships:

```text
Site
 ├── Chargers
 ├── Site Visits
 ├── Faults
 ├── Documents
 ├── Weekly Reports
 ├── Troubleshooting
 └── Contacts (optional)
```

---

# 7. Chargers

## `chargers`

Represents an EV Charger associated with a Site.

A Charger belongs to a Site.

Operational records may optionally reference a Charger in addition to the Site.

Important display behavior in the frontend:

- Charger lists use natural numeric ordering;
- AC Chargers are grouped before DC Chargers;
- visible Charger name is the primary ordering basis.

That sorting is frontend behavior, not a database ordering requirement.

Archive/lifecycle behavior must be preserved when changing Charger relationships.

---

# 8. Site Visits

## `site_visits`

Stores Site Visit records.

Context may be:

```text
Site only
```

or:

```text
Site + Charger
```

Site Visit reports may have attachments managed through the operational attachment workflow.

When changing Site Visit relationships, verify:

- Site association;
- optional Charger association;
- report attachment linkage;
- visit status mapping;
- frontend contextual locking.

---

# 9. Faults

## `faults`

Stores operational Fault records.

Context may be:

```text
Site only
```

or:

```text
Site + Charger
```

## Active Fault lifecycle

Only these statuses are active:

```text
Open
In Progress
Resolved
```

`Closed` was removed.

Migration:

```text
028_remove_closed_fault_status.sql
```

Do not reintroduce `Closed` in:

- frontend constants;
- backend validation;
- SQL constraints;
- reports;
- filters;
- seed/default data.

## Resolved vs Archive

These are different concepts.

```text
Resolved
```

means the operational issue has been resolved.

```text
Archive
```

is a separate record/entity lifecycle concept.

Do not use Archive as a replacement for Fault status, and do not treat Resolved as deletion.

---

# 10. DTC fault catalogue

## `fault_catalogue`

Stores the Diagnostic Trouble Code reference catalogue.

The original imported workbook produced approximately:

```text
211 importable DTC records
```

The catalogue is reference data used for Fault identification.

Before changing DTC schema or import logic, inspect:

- DTC backend module;
- original DTC migration(s);
- current import/seed logic;
- tests covering catalogue behavior.

Do not assume every workbook column became a first-class SQL column; some source data may be stored in structured manufacturer/reference fields.

---

# 11. Documents

## `documents`

Stores operational Documents.

Supported context:

```text
Site only
```

or:

```text
Site + Charger
```

Documents may have protected attachments.

Do not expose raw stored file paths directly to the browser.

---

# 12. Weekly Reports

## `reports`

Stores Weekly Report records.

Important context rule:

```text
Weekly Reports are Site-only.
```

They must not become Charger-specific unless the product requirement is intentionally changed.

If a Weekly Report form starts persisting Charger context, treat that as a regression.

---

# 13. Troubleshooting

## `troubleshooting_records`

Stores Troubleshooting records.

Supported context:

```text
Site only
```

or:

```text
Site + Charger
```

Troubleshooting records may have protected file attachments.

---

# 14. Operational attachments

## `operational_attachments`

Stores metadata/relationships for protected operational files.

Operational file categories include:

- Documents
- Weekly Reports
- Troubleshooting files
- Site Visit reports
- Fault evidence/photos
- generated previews
- other persisted operational files supported by the backend

Protected files are served through authenticated API routes rather than through a broadly public uploads directory.

Preview:

```text
/api/v1/attachments/:id/preview
```

Download:

```text
/api/v1/attachments/:id/download
```

Important security rule:

Do not solve a file access problem by exposing:

```text
/uploads/operational-files/
/uploads/previews/
/uploads/
```

publicly.

Site images are the intentional public exception.

---

# 15. Contacts

## `contacts`

Stores operational Contacts.

Important relationship rule:

```text
site_id is optional / nullable
```

A Contact may therefore be:

```text
associated with one Site
```

or:

```text
not Site-specific
```

Current Contact information supports:

- Name
- Role
- Organization / Department
- Phone
- Email
- optional Assigned Site
- Notes

Do not reintroduce the old `Scope` model unless there is a new deliberate product requirement.

Obsolete UI concepts include:

```text
Scope
All Sites / HQ
External / No Site
```

---

# 16. Requests

## `requests`

Stores operational Requests.

Requests are a distinct workflow from Faults and operational content.

Production access:

```text
Administrator → access
HQ User       → access
Operations    → no access
Viewer        → no access
```

HQ users handle the operational Request-processing workflow.

When changing Request schema, verify:

- requester/creator relationships;
- Site/Charger context where supported;
- status/response fields;
- attachment behavior;
- backend role authorization;
- Homepage Requests integration.

Do not infer exact Request columns from the frontend alone.

---

# 17. Activity logs

## `activity_logs`

Stores operational/audit history.

The table is intentionally designed as append-only history.

A previous production issue occurred when permanent user deletion attempted to null a user foreign key, but the append-only trigger blocked the update.

The final controlled behavior allows a very narrow exception:

- existing `user_id` may become `NULL`
- only during the authorized user-deletion transaction
- no other audit-log field may change

General activity-log updates/deletes remain prohibited.

Important principle:

> Historical audit data should survive user deletion.

Do not weaken the append-only trigger to make an unrelated update easier.

---

# 18. User deletion and historical references

Permanent user deletion was intentionally implemented.

Before deleting a user, the backend/database lifecycle preserves supported historical references.

Known design behavior includes:

- operational history remains;
- historical `user_id` references may become `NULL`;
- audit rows remain;
- general activity log immutability remains protected.

Do not replace this with:

```text
DELETE CASCADE
```

without reviewing every historical relationship.

---

# 19. Archive lifecycle

Archive is a separate application lifecycle.

Supported archived entities include Site/Charger lifecycle behavior.

Archive actions may include:

```text
archive
restore
permanent delete
```

Authorization is required.

Important:

Archive state must not be confused with:

- Fault Resolved status;
- frontend filtering;
- simple inactive display state.

When changing archive behavior, verify database state, API behavior, frontend refresh, and historical relationships.

---

# 20. Migration tracking

The migration runner records which migrations have already been applied.

Before creating or applying a migration:

1. inspect the applied migration state;
2. confirm the next migration number;
3. confirm the migration has not already run;
4. review existing constraints/triggers that may interact with the change.

Do not run SQL manually and then later add an identical migration without understanding the resulting state.

---

# 21. Important migration history

The following handover-relevant migrations are known from the final production history:

## User lifecycle / audit safeguards

Migrations in the later 020s introduced permanent user deletion and the controlled audit-log user FK nullification behavior.

One key migration:

```text
025_allow_user_fk_nullification_in_activity_logs.sql
```

## Contacts

Migration:

```text
027_remove_contact_scope.sql
```

removed the old Contact Scope model.

Current Contacts use optional `site_id` instead.

## Fault lifecycle

Migration:

```text
028_remove_closed_fault_status.sql
```

removed `Closed` from the Fault lifecycle.

For exact earlier migration names and schema evolution, inspect the full migration directory.

---

# 22. Data deletion principles

Different resources have different lifecycle requirements.

Do not apply a universal delete strategy.

Before implementing Delete:

1. identify whether the entity should be archived first;
2. inspect foreign keys;
3. inspect historical/audit requirements;
4. inspect backend authorization;
5. inspect existing migration constraints;
6. test deletion with realistic related records.

Particularly sensitive resources:

- users
- Sites
- Chargers
- activity logs
- operational attachments

---

# 23. Foreign-key changes

Before changing a foreign key, answer:

- Is the relationship required or optional?
- Should deletion be restricted?
- Should the reference become NULL?
- Should the related record be archived instead?
- Does history need to survive?
- Will frontend mapping handle NULL safely?
- Are there triggers protecting the table?

Do not use cascading deletion simply because it is convenient.

---

# 24. NULL handling

Known intentionally nullable relationship:

```text
contacts.site_id
```

Historical user references may also become NULL where specifically designed.

When introducing or changing nullable fields:

- update backend validation;
- update SQL constraints;
- update frontend mapping/display;
- update filters;
- add tests.

---

# 25. Attachments and filesystem storage

The database stores attachment metadata/relationships; file content is stored on the server filesystem.

Production uploads:

```text
/var/www/qatar-operations/uploads
```

The database and filesystem therefore need to remain consistent.

A database backup alone does not preserve uploaded files.

A complete production backup should include:

```text
PostgreSQL
+
/var/www/qatar-operations/uploads
+
environment/runtime configuration
```

---

# 26. Backup before schema work

Example database backup:

```bash
sudo -u postgres pg_dump -Fc -d qatar_operations \
  -f /secure-backups/qatar-operations-YYYYMMDD.dump
```

Keep the backup outside the web root.

Confirm:

- backup directory exists;
- permissions are restricted;
- sufficient disk space is available.

Do not store DB dumps in the repository.

---

# 27. Database troubleshooting flow

If a database-backed feature fails:

```text
Frontend symptom
   ↓
Network/API response
   ↓
Backend logs
   ↓
Route/validation
   ↓
Repository/query
   ↓
Database record/relationship
   ↓
Migration/schema
```

Do not jump directly to changing SQL.

### Example: one Charger missing

Check:

1. Site record exists
2. Charger record exists
3. Charger belongs to correct Site
4. Charger is not archived
5. API returns it
6. frontend mapping/filtering
7. only then schema/query logic

### Example: Contact with no Site disappears

Check:

1. contact row exists
2. `site_id` is NULL as intended
3. backend query does not incorrectly require a Site join
4. frontend mapping accepts NULL
5. filter logic supports non-site-specific Contacts

---

# 28. Schema change checklist

Before:

- [ ] Confirm current migration state
- [ ] Back up production
- [ ] Inspect related migrations
- [ ] Inspect backend repository/query code
- [ ] Inspect frontend assumptions
- [ ] Review permission/lifecycle implications

During:

- [ ] Add next numbered migration
- [ ] Keep change narrowly scoped
- [ ] Do not edit historical migrations
- [ ] Add/update tests

After:

- [ ] Apply migration once
- [ ] Confirm it is recorded as applied
- [ ] Run backend/API tests
- [ ] Test affected frontend workflow
- [ ] Check PM2 logs
- [ ] Verify `/api/health`
- [ ] Confirm no unexpected data loss

---

# 29. Tables that require extra caution

| Table | Why |
|---|---|
| `users` | permanent deletion + historical references |
| `activity_logs` | append-only audit protection |
| `sites` | parent of many operational relationships |
| `chargers` | Site relationship + operational context + archive lifecycle |
| `faults` | active status constraints/lifecycle |
| `contacts` | intentionally nullable Site relationship |
| `operational_attachments` | database ↔ filesystem consistency |
| `requests` | role-restricted business workflow |

---

# 30. Current database rules at handover

The next developer should remember these without needing to rediscover them:

```text
Database:
qatar_operations

Current migration baseline:
28 applied

Latest:
028_remove_closed_fault_status.sql

Fault statuses:
Open
In Progress
Resolved

Contacts:
site_id may be NULL

Weekly Reports:
Site-only

User deletion:
preserve supported historical records

Activity logs:
append-only, except controlled user_id → NULL during user deletion

Archive:
separate from Fault Resolved

Attachments:
metadata in DB + files on server
protected through authenticated APIs
```

---

# 31. What this document intentionally does not do

This map does **not** list every column and constraint.

That is intentional.

The authoritative sources for exact schema details are:

1. current SQL migration files;
2. current backend repository/query code;
3. current automated tests;
4. the live database schema when inspected by an authorized developer.

Do not copy an old schema diagram forward without verifying it.

---

# 32. Related documentation

Use:

```text
README.md
```

for the project overview.

Use the private Developer Handover, distributed separately and intentionally not stored in GitHub, for the main developer handover.

Use:

```text
docs/CODEBASE_MAP.md
```

for frontend/code ownership.

Use:

```text
docs/DEPLOYMENT.md
```

for backups, migrations and production deployment.

Use:

```text
docs/OPERATIONS_RUNBOOK.md
```

for troubleshooting.
