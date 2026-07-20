# Qatar Operations Backend

This folder contains the backend foundation for the Qatar Operations Platform.

The current root website is still a plain HTML, CSS, and JavaScript frontend. This backend is not connected to that frontend yet.

## Current Phase

Phase 2 adds the database foundation on top of the Phase 1 backend base:

- Express application setup
- Environment validation
- PostgreSQL connection setup
- Health endpoints
- Migration runner foundation
- Error handling
- Basic automated tests
- SQL schema migrations
- Repeat-safe development seed files

Business API modules are not implemented yet. The database schema now defines the main tables, but there are still no authentication, users, sites, chargers, uploads, or reports API endpoints in this phase.

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

## Roles

The platform role model is intentionally simple:

- `admin`: full access, including user management.
- `operator`: full operational access, but cannot manage users or roles.
- `viewer`: read-only access.

Authorization middleware is not implemented yet. That will be added in the authentication phase.

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

Then update `.env` with real local values. Do not commit `.env`.

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
