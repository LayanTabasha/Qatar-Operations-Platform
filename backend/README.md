# Qatar Operations Backend

This folder contains the Phase 1 backend foundation for the Qatar Operations Platform.

The current root website is still a plain HTML, CSS, and JavaScript frontend. This backend is not connected to that frontend yet.

## Current Phase

Phase 1 only creates the backend base:

- Express application setup
- Environment validation
- PostgreSQL connection setup
- Health endpoints
- Migration runner foundation
- Error handling
- Basic automated tests

No business modules are implemented yet. That means there are no users, sites, chargers, uploads, reports, or authentication endpoints in this phase.

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

SQL migration files will live in:

```text
src/db/migrations
```

Run migrations manually with:

```bash
npm run migrate
```

Migrations are never run automatically during normal application startup.
