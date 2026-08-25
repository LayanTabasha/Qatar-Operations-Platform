# Qatar Operations Backend

This folder contains the backend foundation for the Qatar Operations Platform.

The current root website is a plain HTML, CSS, and JavaScript frontend connected to this backend for authentication, sites, chargers, Site Visits, DTC catalogue records, and Admin-only user management.

## Current Phase

Phase 3 adds authentication and authorization on top of the Phase 1 and Phase 2 backend foundation:

- Express application setup
- Environment validation
- PostgreSQL connection setup
- Health endpoints
- Migration runner foundation
- Error handling
- Basic automated tests
- SQL schema migrations
- Repeat-safe development seed files
- HTTP-only cookie authentication
- Role authorization middleware
- Admin-only user creation and listing

Sites, chargers, Site Visits, DTC catalogue records, authentication, and Admin-only user-management endpoints are implemented. Uploads, reports, documents, and full fault record persistence still need future backend modules.

## Operational attachment storage

At startup the API creates the configured operational upload and preview directories recursively, then verifies both are readable and writable. Startup stops with a safe error if either check fails. It does not create probe files or alter existing files.

The directories should be owned by the Linux account that runs `qatar-operations-backend`, with a shared application group where needed. A typical deployment uses owner/group `rwx` and no access for other users (`0770` directories); use `0750` instead when the group needs read-only access. Do not use world-writable permissions. Set `OPERATIONAL_UPLOAD_ROOT` and `OPERATIONAL_PREVIEW_ROOT` in the backend environment when the defaults are not appropriate. `LIBREOFFICE_BIN` may specify a trusted absolute LibreOffice executable; otherwise the API tries `libreoffice` and then `soffice` from its service PATH.

## Backend Structure

Shared infrastructure stays in the shared folders:

- `src/config` contains environment, database, CORS, and logging setup.
- `src/middleware` contains reusable Express middleware such as request IDs, rate limiting, 404 handling, and error handling.
- `src/db` contains migration and seed runners plus SQL files.
- `src/routes/index.js` is the central API router for `/api/v1`.
- `src/utils` contains small helpers that can be reused by any feature.

Feature-specific code lives in `src/modules`. The current health feature is in:

```text
src/modules/health
```

Future features may have their own route, controller, service, validation, and repository files, but only when that feature actually needs them. Avoid creating empty placeholder modules.

The authentication feature lives in:

```text
src/modules/auth
```

The first user-management endpoints live in:

```text
src/modules/users
```

The Sites feature lives in:

```text
src/modules/sites
```

The Chargers feature lives in:

```text
src/modules/chargers
```

The DTC fault catalogue feature lives in:

```text
src/modules/dtc
```

## Roles

The platform role model is intentionally simple:

- `admin`: full access, including user management.
- `operations_staff`: full operational access, but cannot manage users or roles.
- `viewer`: read-only access.

Authorization middleware now exists for authentication-protected backend routes, but operational modules such as sites, faults, documents, and reports have not been connected to it yet.

## API Routes

Current backend routes are mounted under `/api/v1`:

- `GET /health`: basic API health check.
- `GET /health/database`: database connectivity health check.
- `POST /auth/login`: validates email and password, then sets an HTTP-only auth cookie.
- `POST /auth/logout`: clears the auth cookie.
- `GET /auth/me`: reloads and returns the current authenticated user.
- `GET /users`: admin-only user list.
- `POST /users`: admin-only user creation. Missing role defaults to `operations_staff`.
- `GET /users/:id`: admin-only user detail.
- `PATCH /users/:id`: admin-only user name or role update.
- `PATCH /users/:id/status`: admin-only activate/deactivate.
- `POST /users/:id/reset-password`: admin-only temporary password reset.
- `GET /sites`: authenticated site list.
- `GET /sites/:id`: authenticated site detail.
- `POST /sites`: admin-only site creation.
- `PATCH /sites/:id`: admin-only site update.
- `PATCH /sites/:id/status`: admin-only operational status change.
- `PATCH /sites/:id/archive`: admin-only site archive.
- `PATCH /sites/:id/restore`: admin-only site restore.
- `GET /chargers`: authenticated charger list.
- `GET /chargers/:id`: authenticated charger detail.
- `POST /chargers`: admin/operations_staff charger creation.
- `PATCH /chargers/:id`: admin/operations_staff charger update.
- `PATCH /chargers/:id/status`: admin/operations_staff charger status change.
- `PATCH /chargers/:id/archive`: admin/operations_staff charger archive.
- `PATCH /chargers/:id/restore`: admin/operations_staff charger restore.
- `DELETE /chargers/:id`: admin-only soft delete for already archived chargers.
- `GET /dtc`: authenticated DTC catalogue search.
- `GET /dtc/:id`: authenticated DTC catalogue detail.
- `POST /dtc`: admin-only DTC record creation.
- `PATCH /dtc/:id`: admin-only DTC record update.
- `PATCH /dtc/:id/status`: admin-only DTC activate/deactivate.
- `POST /dtc/import`: admin-only `.xlsx` DTC workbook import using multipart field `file`.

There are no permanent site deletion endpoints. Charger delete is implemented as a soft delete for archived chargers only, so historical fault and document links are protected.

## DTC Catalogue API

The DTC catalogue imports structured data from the manufacturer Excel workbook instead of keeping the workbook only as a downloadable file.

Supported search parameters:

```text
code=P0301
query=over-current
charger_model=ZD
category=Yes
severity=2012
status=active|inactive|all
sort=dtc_code|fault_title|category|charger_model|updated_at
order=asc|desc
limit=50
offset=0
```

The importer validates:

- file extension must be `.xlsx`;
- workbook must contain a sheet named `DTC`;
- the DTC sheet must include `ECU`, `DTC1`, `FTB1`, and `DTC Description`;
- blank and formatted tail rows are skipped;
- DTC codes are trimmed and normalized for search;
- duplicate records in the same DTC/FTB/model/component scope are rejected;
- import writes run inside one database transaction.

Mapped workbook columns:

- `ECU` -> `component`
- `DTC1` -> `dtc_code`
- `FTB1` -> `ftb_code`
- `DTC Description` -> `fault_title` and `description`
- `Failure Criteria (Test Result NOK)` -> `possible_causes`
- `Repair Action` -> `recommended_actions`
- `HV Shutdown` -> `severity`
- `Gun Status Unavailable/Fault` -> `category`
- cover sheet project/version -> `charger_model` and `source_version`

Extra manufacturer fields, such as CAN messages and monitor data, are stored in `manufacturer_data`.

## Prerequisites

- Node.js
- npm
- PostgreSQL for future database work

## Local Installation

From this folder:

```bash
npm install
```

## Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Then update `.env` with real local values. Never commit `.env`.

For local PostgreSQL, create the database first:

```bash
createdb qatar_operations
```

Then set `DATABASE_URL` in `.env`:

```text
DATABASE_URL=postgresql://username:password@localhost:5432/qatar_operations
DATABASE_SSL=false
```

## Development Mode

```bash
npm run dev
```

The server checks the PostgreSQL connection before it starts accepting requests. If no local database exists yet, do not run the server.

## Tests

```bash
npm test
```

The basic health tests do not require a real PostgreSQL database.

## Migrations

Migrations are numbered SQL files that change the database structure in a controlled order. They create tables, constraints, triggers, and indexes.

SQL migration files will live in:

```text
src/db/migrations
```

Run migrations manually with:

```bash
npm.cmd run migrate
```

Migrations are never run automatically during normal application startup.

## Seeds

Seed files add repeat-safe development data after the schema exists. They are useful for local testing only.

Run seeds manually with:

```bash
npm.cmd run seed
```

Run only the required roles seed with:

```bash
npm.cmd run seed:roles
```

Always run migrations before seeds. Do not run seeds against production unless that is explicitly intended and approved.

## Sites API

Sites have operational statuses and a separate soft-archive lifecycle:

- `active`, `inactive`, and `maintenance` sites appear in the normal site list.
- `archived` sites are hidden from the default list, but their chargers, faults, visits, documents, reports, and activity history are preserved.
- Archived sites are restored through the dedicated restore endpoint, which returns them to `active`.

`GET /api/v1/sites` returns all non-archived sites by default. Supported query parameters:

```text
status=active|inactive|maintenance|all
search=text
sort=name|created_at|updated_at
order=asc|desc
```

Permissions:

- `admin`: can list, view, create, update, archive, and restore sites.
- `operations_staff`: can list, view, create, update, archive, and restore sites.
- `viewer`: can list and view sites only.

Create example:

```json
{
  "name": "Msheireb",
  "code": "MSHEIREB",
  "location": "Doha, Qatar",
  "address": "Optional address",
  "description": "Optional description"
}
```

Update example:

```json
{
  "name": "Msheireb Downtown",
  "location": "Doha"
}
```

Operational status example:

```json
{
  "status": "maintenance"
}
```

Archive and restore use dedicated endpoints:

```text
PATCH /api/v1/sites/:id/archive
PATCH /api/v1/sites/:id/restore
```

Upload or replace a site image with multipart form data:

```text
POST /api/v1/sites/:id/image
Field name: image
Allowed: JPEG, PNG, WebP
Maximum size: 5 MB
```

The API stores the file on disk and saves only the public path in `sites.image_path`.

## Chargers API

Chargers use these status values:

- `active`: available operational charger.
- `maintenance`: charger is under maintenance.
- `faulted`: charger currently has an operational issue.
- `archived`: hidden from the normal charger list while preserving history.

`inactive` is not a valid charger status.

`GET /api/v1/chargers` excludes archived chargers by default. Use `status=archived` to view archived chargers.

Supported `GET /api/v1/chargers` query parameters:

```text
site_id=uuid
status=active|maintenance|faulted|archived
type=AC|DC
search=text
sort=name|code|created_at|updated_at|power_kw
order=asc|desc
```

Search checks charger name, charger code, model, manufacturer, and serial number. Default sorting is `name` ascending.

Permissions:

- `admin`: can list, view, create, update, archive, and restore chargers.
- `operations_staff`: can list, view, create, update, archive, and restore chargers.
- `viewer`: can list and view chargers only.

Every charger belongs to one site. A new charger cannot be created under an archived site, and an archived charger cannot be restored while its parent site is archived.

Create example:

```json
{
  "site_id": "33333333-3333-4333-8333-333333333333",
  "name": "DC Charger 01",
  "code": "DC_01",
  "manufacturer": "Example Manufacturer",
  "model": "Model X",
  "serial_number": "SN-001",
  "type": "DC",
  "power_kw": 120,
  "firmware_version": "1.0.0",
  "description": "Main DC charger",
  "image_path": "chargers/dc-01.webp"
}
```

Update example:

```json
{
  "firmware_version": "1.0.1",
  "description": "Firmware updated"
}
```

Status change example:

```json
{
  "status": "maintenance"
}
```

Archive example:

```json
{
  "status": "archived"
}
```

Restore example:

```json
{
  "status": "active"
}
```

There is no permanent charger delete endpoint. `image_path` is metadata only. Charger file and image upload are not implemented yet.

## Authentication Setup

Authentication uses a signed JWT stored in an HTTP-only cookie. The token is not stored in browser `localStorage` and is not stored in PostgreSQL.

Set these values in `.env` before running the backend:

```text
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=8h
AUTH_COOKIE_NAME=qatar_ops_token
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
```

Use `COOKIE_SECURE=true` only when the API is served over HTTPS.

The root frontend uses this backend authentication. Random credentials, browser-only login, and public self-registration are not supported.

## Creating the First Admin

The backend does not include a default admin password. To create the first admin manually, set these temporary environment values in `.env`:

```text
ADMIN_NAME=
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

Then run the migration, repeat-safe roles seed, and repeat-safe admin seed commands:

```bash
npm.cmd run migrate
npm.cmd run seed:roles
npm.cmd run seed:admin
```

PowerShell example with placeholders:

```powershell
$env:ADMIN_NAME="Admin User"
$env:ADMIN_EMAIL="admin@zeedaenergy.com"
$env:ADMIN_PASSWORD="UseAStrongLocalPasswordHere1"
npm.cmd run migrate
npm.cmd run seed:roles
npm.cmd run seed:admin
```

The password must be at least 12 characters and include uppercase letters, lowercase letters, and a number. A symbol is not required for the current internal MVP.

These admin values are only used by the manual admin seed command. It reports whether the admin was created or already existed. Never commit a real `.env` file or a real password.

## Creating Managed Users

Admins can create future accounts from the website Settings page under User Management. New accounts default to `operations_staff` unless an Admin explicitly chooses `admin` or `viewer`.

For one-time server-side account creation, use:

```bash
npm run user:create -- --name="Full Name" --email="user@example.com" --password="StrongPassword1" --role=operations_staff
npm run user:create-admin -- --name="Supervisor Name" --email="supervisor@example.com" --password="StrongPassword1"
```

Do not hard-code real passwords in repository files or shell history shared with other people.
