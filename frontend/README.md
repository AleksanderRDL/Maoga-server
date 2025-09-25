# Maoga Frontend Play Portal

A lightweight testing UI for the Maoga backend. The interface mirrors the product mocks and exposes flows for authentication, game discovery, lobby management, matchmaking and chat so you can exercise the API surface locally.

## Prerequisites

- Node.js 18+
- A running Maoga backend (the API server that lives in this repository)

Ensure the backend CORS settings allow the Vite dev server origin. For local work you can add the following to your backend `.env`:

```bash
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

## Quick start

From the repository root you can now run `npm run dev` to boot both backend and frontend together. If you only need the UI, use the standalone commands below:

```bash
cd frontend
cp .env.example .env   # edit if your backend runs on another host/port
npm install
npm run dev
```

The application is served on [http://localhost:5173](http://localhost:5173). The dev server proxies directly to the backend API defined in `VITE_API_URL`.

To build a static production bundle:

```bash
npm run build
npm run preview
```

## Environment variables

Create a `.env` file (see `.env.example`) and point it at your backend:

```bash
VITE_API_URL=http://localhost:3000/api
```

## Feature overview

- **Authentication** – register, log in and persist sessions with automatic access-token refresh.
- **Discover** – browse trending games, search by title and jump into matchmaking with a highlighted game.
- **Lobbies** – view the lobbies you belong to, join via ID, leave and toggle ready state.
- **Lobby detail & chat** – inspect roster details and chat with the squad in real time (polled refresh).
- **Matchmaking** – craft requests with game selections, mode, region, language and scheduling controls. Monitor and cancel the active request.
- **Chat hub** – consolidated lobby messaging view.
- **Profile** – update bio, display name and high level gaming preferences.

The UI follows the provided mock-ups with a focus on gradient rich cards, a floating bottom navigation bar and responsive layouts.
