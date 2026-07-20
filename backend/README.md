# Qatar Operations Backend

This folder contains the backend foundation for the Qatar Operations Platform.

The current root website is still a plain HTML, CSS, and JavaScript frontend. This backend is not connected to that frontend yet.

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

Operational API modules are not implemented yet. The database schema defines the main tables, and authentication plus admin user-management endpoints now exist, but there are still no sites, chargers, uploads, reports, documents, or faults API endpoints in this phase.

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

## Roles

The platform role model is intentionally simple:

- `admin`: full access, including user management.
- `operator`: full operational access, but cannot manage users or roles.
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
- `POST /users`: admin-only user creation.
- `GET /sites`: authenticated site list.
- `GET /sites/:id`: authenticated site detail.
- `POST /sites`: admin/operator site creation.
- `PATCH /sites/:id`: admin/operator site update.
- `PATCH /sites/:id/status`: admin/operator archive or restore.

There is no permanent site deletion endpoint.

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

Always run migrations before seeds. Do not run seeds against production unless that is explicitly intended and approved.

## Sites API

Sites use a soft-archive model:

- `active` sites appear in the normal site list.
- `archived` sites are hidden from the default list, but their chargers, faults, visits, documents, reports, and activity history are preserved.
- Archived sites can be restored by setting their status back to `active`.

`GET /api/v1/sites` returns active sites by default. Supported query parameters:

```text
status=active|archived
search=text
sort=name|created_at|updated_at
order=asc|desc
```

Permissions:

- `admin`: can list, view, create, update, archive, and restore sites.
- `operator`: can list, view, create, update, archive, and restore sites.
- `viewer`: can list and view sites only.

Create example:

```json
{
  "name": "Msheireb",
  "code": "MSHEIREB",
  "location": "Doha, Qatar",
  "address": "Optional address",
  "description": "Optional description",
  "image_path": "sites/msheireb/cover.webp"
}
```

Update example:

```json
{
  "name": "Msheireb Downtown",
  "location": "Doha"
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

`image_path` is metadata only. Image upload and file storage are not implemented in the Sites API yet.

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

The existing root frontend testing login is separate from this backend authentication until the frontend is connected to these API routes. This backend does not depend on the old frontend login or static test credentials.

## Creating the First Admin

The backend does not include a default admin password. To create the first admin manually, set these temporary environment values in `.env`:

```text
ADMIN_NAME=
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

Then run:

```bash
npm.cmd run create-admin
```

PowerShell example with placeholders:

```powershell
$env:ADMIN_NAME="Admin User"
$env:ADMIN_EMAIL="admin@zeedaenergy.com"
$env:ADMIN_PASSWORD="Use-A-Strong-Local-Password-Here1!"
npm.cmd run create-admin
```

These admin values are only used by the manual create-admin command. Never commit a real `.env` file or a real password.
