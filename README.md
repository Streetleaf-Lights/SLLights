# SLLights monorepo

| Path | What it is |
| --- | --- |
| `apps/web` | SLLights_Web_v2 — Next.js 16 dashboard. Also the backend for the mobile app (`/api/mobile/*`). |
| `apps/mobile` | Expo SDK 57 app (iOS + Android) for field crews: sign in, scan a pole tag, look it up, record an install, report an issue. |
| `packages/shared` | Framework-free TypeScript used by both: domain types, role rules, date/format helpers, scan parsing, the web↔mobile API contract, brand colours. |

## Setup

Requires Node 22 and **npm 11** (npm 10's resolver crashes on this workspace layout).

```bash
npx npm@11 install          # or upgrade npm globally: npm i -g npm@11
cp apps/web/.env.local.example apps/web/.env.local   # then fill in values
cp apps/mobile/.env.example apps/mobile/.env         # EXPO_PUBLIC_API_BASE_URL
```

## Common commands (from the repo root)

```bash
npm run web          # Next.js dev server
npm run mobile       # Expo dev server (scan the QR with a dev build / Expo Go)
npm run typecheck    # all workspaces
npm run lint
npm test             # Vitest (shared, web) + Jest (mobile)
npm run build:web
```

Testing on a phone against your local web app: run `npm run web`, then set
`EXPO_PUBLIC_API_BASE_URL=http://<your-LAN-IP>:3000` in `apps/mobile/.env`.

## Architecture rules

- **The mobile app never calls APIM.** The subscription key can't ship in an
  app binary, and some APIM reads aren't scoped per user, so the web app's
  route handlers are the enforcement boundary. Mobile calls `/api/mobile/*`
  and existing routes with `Authorization: Bearer <jwt>`.
- **One React version repo-wide** (root `overrides`: 19.2.3). React Native
  0.86.3 requires exactly this version, and Expo doesn't support duplicate
  React in one app. Next's App Router renders with its own bundled React, so
  this only affects the web app's tests. When upgrading Expo, move the
  override to the React version that SDK pins.
- **`packages/shared` stays portable**: its tsconfig has no DOM or Node types,
  so `Buffer`, `document`, etc. fail the typecheck. Mobile app code is held to
  the same rule (TypeScript 6's empty default `types`); only test configs add
  `jest`/`node`.
- **Install native modules with `npx expo install <pkg>`** in `apps/mobile` so
  versions match the SDK.

## Open items

- `POST /api/mobile/poleinstall` validates and authenticates, then returns 501
  until an APIM operation for recording installs exists. The app shows this
  as "not available yet" — it never claims a save happened.
- `parsePoleCode` / `SCAN_BARCODE_TYPES` assume tags like `PAS-4938` (or a URL
  containing it) in QR / Code 128 / Code 39 / Data Matrix. Tighten both once
  real tag samples are confirmed.
- `/api/mobile/pole` pulls the full pole list for cross-customer users
  (~9 MB) because `/getPoles` has no `poleNumber` filter. Ask for one before a
  wide rollout.
- Offline install queue (dead zones) is not built yet.

