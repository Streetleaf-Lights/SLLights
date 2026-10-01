# Streetleaf - Customer Dashboard (stub)

Internal Next.js app for managing Customers → Projects → Poles, plus a Users page.
Data is intended to come from an Azure API Management (APIM) gateway; all pages
currently render stubbed/mock data so the UI can be reviewed before the APIM
routes exist.

## Pages

- `/` redirects to `/customers`
- `/customers` — list of customer accounts; expand a row to see its projects
- `/poles` — full pole inventory across all customers/projects
- `/users` — application users and roles

## Wiring up the real APIM data

All data access goes through `src/lib/apim.ts`. Each resource function
(`getCustomers`, `getPoles`, `getUsers`, etc.) currently returns mock data from
`src/lib/mock-data.ts`. Once your APIM routes are live:

1. Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_APIM_BASE_URL` — your APIM gateway base URL
   - `APIM_SUBSCRIPTION_KEY` — your `Ocp-Apim-Subscription-Key`
2. In `src/lib/apim.ts`, replace each stub's return value with the matching
   `apimFetch<T>(path)` call (already stubbed in as a TODO comment above each
   function).

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view it.

## Build

```bash
npm install
npm run build
npm run start
```
