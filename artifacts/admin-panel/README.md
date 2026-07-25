# Admin panel

A **single-file, dependency-free** admin console for Deliver LBH. It talks to the
API's `/admin/*` endpoints (admin JWT required).

## Run

Either open `index.html` directly in a browser, or serve it:

```bash
pnpm --filter @workspace/admin-panel run dev   # http://localhost:5000
```

On the login screen, set the **API URL** (default `http://localhost:8080/api`,
change to your deployed API), then sign in with an `admin` account (create one
with `pnpm --filter @workspace/api-server exec tsx src/create-admin.ts`).

## Features

- **Tableau de bord** — live metric cards (orders, revenue, restaurants, users,
  pending drivers/payments)
- **Commandes** — filter by status
- **Magasins** — open/close toggle per store
- **Utilisateurs** — filter by role + search, activate/deactivate
- **Livreurs** — approve / reject driver applications

No build step, no npm dependencies — just static HTML + `fetch`.
