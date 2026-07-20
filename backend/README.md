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
