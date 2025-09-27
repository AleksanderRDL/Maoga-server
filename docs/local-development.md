# Local Development Guide

This document explains how to run the Maoga stack (backend + frontend) locally with the new shared npm scripts.

## Prerequisites
- Node.js 18 or newer
- npm 9 or newer
- MongoDB running locally, via Docker, or in the cloud

## First-time setup
1. Copy `.env.example` to `.env` and adjust the values for your environment.
2. Run `npm install` at the repository root. The new `postinstall` hook also installs the frontend dependencies.
3. Optionally run `npm run migrate` if you need the database migrations.

## Day-to-day development
- `npm run dev` starts both the Express API (with nodemon) and the Vite dev server. The command streams logs from both processes so you can watch backend and frontend activity together.
- `npm run dev:backend` runs only the backend, matching the previous behaviour (also used by Docker Compose).
- `npm run dev:frontend` runs only the frontend Vite server from the root.

When `npm run dev` is running, the API listens on `http://localhost:3000` and the frontend on `http://localhost:5173`. Update `frontend/.env` if you need to target a different API origin.

## Preloaded development data
- `npm run dev` seeds the local database with sample games, six user accounts, active lobbies, matchmaking searches, rich friendship graphs, notification inbox entries, and seeded chat conversations once the backend connects.
- Seeded accounts (password `PlayTogether123!`): `brimstone@maoga.dev`, `aurora@maoga.dev`, `viper@maoga.dev`, `pixelwave@maoga.dev`, `supportive@maoga.dev`, `shotcaller@maoga.dev`.
- Control the behaviour with environment flags: `SKIP_DEV_SEED=true` skips seeding, `ENABLE_DEV_SEED=true` forces it outside development, `FAIL_ON_DEV_SEED_ERROR=true` makes startup fail if the seeding script throws.
- Example lobbies created on boot: `Valorant Night Ranked`, `Summoner's Rift Flex Squad`, and `Fortnite Zero Build Friday`. Each lobby also links to a seeded chat thread so you can view real-time conversation flows immediately.
- When local infrastructure is unavailable the backend automatically falls back to in-memory services: set `REDIS_ALLOW_MOCK_FALLBACK=true` to enable the Redis mock (default in `.env`) and `DB_ALLOW_IN_MEMORY_FALLBACK=true` to allow a temporary MongoDB instance via `mongodb-memory-server`.

## Tests and linting
- `npm test` executes the backend test suite (Mocha + SuperTest) with the proper environment flags.
- `npm run test:backend` is available if you prefer an explicit name for automation.
- `npm run lint` runs ESLint for both backend and frontend codebases from the repository root.

## Build commands
- `npm run build` triggers the Vite build for the React frontend.
- The backend currently runs directly from source, so there is no separate build artefact. Add a `build:backend` script in the future if one becomes necessary.

## Running with Docker
Docker Compose now provisions MongoDB, Redis, and an application container so you can mirror the full stack locally or in a cloud runner.

- `docker compose up --build` starts the API along with MongoDB and Redis. Health checks ensure the dependencies are ready before the backend boots.
- `docker compose run --rm app npm test` executes the test suite inside the already-built backend container.
- `npm run docker:test` provides an end-to-end option that spins up throwaway containers for MongoDB, Redis, and the backend test runner in one command. Under the hood it uses the Compose `test` profile so other services on your machine are unaffected.

The containers respect the values from `.env`, but Compose overrides the MongoDB and Redis hosts so that the backend always targets the in-network services (`mongodb` and `redis`).


## Logging controls
- The backend logging now uses scoped Pino loggers. By default development logs stay on `info`, while background jobs (`jobs:gameSync`, `jobs:notificationQueue`, and `services:socket`) drop to `warn` so they stay quiet during feature testing.
- Override the global level with `LOG_LEVEL=<level>` and toggle pretty output with `LOG_PRETTY=true|false`.
- Use module overrides via `LOG_MODULE_LEVELS`, e.g. `LOG_MODULE_LEVELS=jobs:gameSync=debug,services:socket=info npm run dev`, or the shortcut vars (`LOG_LEVEL_GAME_SYNC`, `LOG_LEVEL_NOTIFICATION_QUEUE`, `LOG_LEVEL_SOCKET`).
- Toggle verbose Mongoose query logging with `MONGOOSE_DEBUG=true`; adjust its verbosity via `LOG_LEVEL_MONGOOSE=<level>` (scope: `database:mongoose`).
- Set `LOG_CONFIG_DEBUG=true` when you need the configuration banner on startup; it is otherwise suppressed.
- All other modules inherit the global level. When you need more detail, request a scoped logger in code with `logger.forModule('<module>')` and adjust the module level.
