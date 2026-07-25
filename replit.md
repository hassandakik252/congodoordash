# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Project: Deliver LBH (Deliver Lubumbashi)

A DoorDash-style food delivery app for Lubumbashi, Congo (DRC). Full stack with:
- **Mobile app**: Expo React Native (web + mobile)
- **API server**: Express with JWT auth
- **Database**: PostgreSQL with Drizzle ORM
- 3 user roles: customer, restaurant owner, delivery driver
- English/French bilingual (default: French)
- Payment: cash on delivery + Mobile Money (M-Pesa/Airtel)

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo SDK 54, Expo Router 6, React Native 0.81

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port via $PORT, runs at 8080)
│   ├── mobile/             # Expo React Native app (Expo Router file-based routing)
│   └── mockup-sandbox/     # Component preview server (Vite)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
```

## Mobile App Structure (artifacts/mobile)

```text
app/
  _layout.tsx            # Root layout — QueryClient, all providers, Splash
  (auth)/
    _layout.tsx          # Auth stack layout
    welcome.tsx          # Welcome screen with FR/EN toggle
    login.tsx            # Login screen
    register.tsx         # Register screen with role picker + vehicle type picker for drivers
  (tabs)/
    _layout.tsx          # Tab bar (role-based: customer/driver/owner)
    index.tsx            # Routes to CustomerHome / DriverDashboard / DriverPendingScreen / RestaurantOwnerDashboard
    orders.tsx           # Order history
    cart.tsx             # Cart + checkout (customer only)
    menu.tsx             # Menu management (restaurant_owner only) — SectionList, add/edit modal, availability toggle, inline delete confirm
    restaurant.tsx       # Restaurant profile management (restaurant_owner only) — edit name/desc/phone/address/hours/fees, open/close toggle
    profile.tsx          # Profile + language toggle + Legal & Support section + logout
  restaurant/
    [id].tsx             # Restaurant detail + menu + add to cart
  order/
    [id].tsx             # Order status tracking
  legal/
    _layout.tsx          # Legal screen stack layout
    privacy.tsx          # Privacy Policy screen
    support.tsx          # Support & Contact screen (FAQ accordion + email/WhatsApp)
components/
  CustomerHome.tsx        # Restaurant list with search + category filter
  DriverDashboard.tsx     # Available orders + active deliveries
  RestaurantOwnerDashboard.tsx  # Today's orders + status management
  ErrorBoundary.tsx       # Error boundary wrapper
context/
  AuthContext.tsx              # User auth state (JWT token + user)
  CartContext.tsx              # Cart items, restaurant, totals
  LanguageContext.tsx          # EN/FR translations (t() function)
  PushNotificationContext.tsx  # Push token registration, listener lifecycle
constants/
  colors.ts              # Dark theme: #0F0F0F bg, #FF4500 primary, #FFA500 accent
services/
  api.ts                 # All API calls (auth, restaurants, orders, users)
  pushNotifications.ts   # Local OS push: setupHandler, register token, scheduleLocalNotification
utils/
  format.ts              # formatCurrency, formatDate, getGreeting, RESTAURANT_CATEGORIES
```

## API Server Routes (artifacts/api-server)

- `GET /api/healthz` — health check
- `POST /api/auth/register` — register (email, password, name, phone, role)
- `POST /api/auth/login` — login (returns JWT token)
- `GET /api/auth/me` — current user (JWT required)
- `GET /api/restaurants` — list all restaurants (optional ?category= ?search=)
- `GET /api/restaurants/mine` — owner's own restaurant (ORDER BY id ASC, restaurant_owner only)
- `PATCH /api/restaurants/mine` — update own restaurant: name/desc/category/phone/address/imageUrl/deliveryFee/deliveryTimeMin/openingHours/isOpen (restaurant_owner only)
- `GET /api/restaurants/mine/menu` — all menu items incl. unavailable (restaurant_owner only)
- `GET /api/restaurants/:id` — restaurant detail
- `GET /api/restaurants/:id/menu` — available menu items only (public/customers)
- `POST /api/restaurants` — create restaurant (restaurant_owner only)
- `POST /api/restaurants/:id/menu` — add menu item (restaurant_owner only)
- `PATCH /api/restaurants/:id/menu/:itemId/availability` — toggle isAvailable (restaurant_owner only)
- `PATCH /api/restaurants/:id/menu/:itemId` — update menu item fields (restaurant_owner only)
- `DELETE /api/restaurants/:id/menu/:itemId` — delete menu item (restaurant_owner only)
- `GET /api/orders` — user's orders (role-filtered, newest first)
- `POST /api/orders` — create order (customer only; stores customerPhone, driverInstructions, paymentReference)
- `GET /api/orders/available` — orders ready for pickup with no driver (driver only)
- `GET /api/orders/my-orders` — driver's own accepted orders
- `GET /api/orders/:id` — single order detail
- `POST /api/orders/:id/accept` — atomic driver claim (prevents race conditions)
- `PATCH /api/orders/:id/status` — update status (auto-sets paymentStatus=paid on cash delivery)
- `PATCH /api/orders/:id/payment` — customer submits mobile money reference (pending→submitted)
- `GET /api/admin/payments?paymentStatus=` — list mobile money payment orders
- `PATCH /api/admin/payments/:id` — admin confirms or fails mobile money payment (body: { action: "confirmed"|"failed" })
- `GET /api/users/me` — full profile with savedAddresses
- `PATCH /api/users/profile` — update profile (name, phone, address, savedAddresses)
- `GET /api/notifications` — list user's notifications, newest first (max 50)
- `GET /api/notifications/unread-count` — fast badge count `{count: N}`
- `PATCH /api/notifications/:id/read` — mark one notification as read
- `PATCH /api/notifications/read-all` — mark all user notifications as read

## Database Schema (lib/db)

Tables:
- `users` — id, email, passwordHash, name, phone, role (enum), address, savedAddresses (jsonb array), createdAt
- `restaurants` — id, ownerId, name, description, category, address, phone, imageUrl, rating, deliveryTimeMin, deliveryFee, isOpen, createdAt
- `menu_items` — id, restaurantId, name, description, price, category, imageUrl, isAvailable, createdAt
- `orders` — id, customerId, driverId, restaurantId, status (enum), paymentMethod (enum cash|mobile_money), paymentStatus (enum: pending|submitted|confirmed|failed|paid), paymentProvider, paymentReference, paymentPhone, paymentRequestedAt, paymentConfirmedAt, deliveryAddress, driverInstructions, customerPhone, items (jsonb), subtotal, deliveryFee, total, notes, createdAt, updatedAt
- `notifications` — id, userId (FK), type, title, body, orderId (FK nullable), isRead, createdAt

## Admin Panel (artifacts/admin-panel, /admin/)

Web-only React + Vite super-admin dashboard. Login: `admin@deliverlbh.com` / `admin2024` (role: `admin`).

Pages:
- **Tableau de bord** — 7 live metric cards (total/delivered/active orders, revenue, restaurants, customers, drivers)
- **Commandes** — filterable by all statuses; table with customer, restaurant, payment, total, date
- **Restaurants** — searchable; toggle `isOpen` per restaurant (Ouvrir/Fermer)
- **Utilisateurs** — filterable by role (clients/drivers/owners), searchable; toggle `isActive` per user

Admin API routes (all require `Authorization: Bearer <admin-jwt>`):
- `GET /api/admin/stats` — aggregate metrics
- `GET /api/admin/orders?status=` — all orders with join to user + restaurant
- `GET /api/admin/restaurants?search=` — restaurants with owner info
- `PATCH /api/admin/restaurants/:id/toggle` — toggle isOpen
- `GET /api/admin/users?role=&search=` — all non-admin users
- `PATCH /api/admin/users/:id/toggle` — toggle isActive

DB additions: `admin` added to `user_role` enum; `is_active boolean` column on `users` table.

## Pilot-Ready Features (added)

- **Saved addresses**: Customers can save multiple labelled addresses (jsonb on users table)
- **Address picker**: Checkout shows saved addresses + "Add new" option with save toggle
- **Driver instructions**: Separate field from restaurant notes, shown to driver in delivery card
- **Payment reference**: Stored for mobile money transactions, visible on all role views
- **Customer phone on orders**: Captured at order time, shown to restaurant and driver (not customer)
- **Payment status tracking**: pending → paid (auto-set on cash delivery completion)
- **Validation**: Phone format check, required field errors, duplicate submit prevention
- **Price breakdown**: subtotal + delivery fee + total shown everywhere

## Seed Data

Run `pnpm --filter @workspace/api-server exec tsx src/seed.ts` to seed 6 restaurants:
- Chez Mama Ngozi (Congolese)
- Le Poulet d'Or (Chicken)
- Pizza Roma (Pizza)
- Dragon Palace (Chinese)
- Quick Burger LBH (Fast Food)
- Boissons Tropicales (Drinks)

## Bug Fixes Applied (Audit Pass)

- **Admin users route**: Removed dead code (unused `$dynamic()` query + `conditions` array); fixed search+role combined filter to correctly apply both constraints in one SQL condition
- **Login `isActive` check**: `/api/auth/login` now returns 403 `account_disabled` if user is inactive
- **Middleware `isActive` check**: `requireAuth` middleware now rejects existing JWTs for deactivated users (403)
- **AuthContext `UserRole` type**: Added `"admin"` to the union type (was missing, causing TypeScript inference issues)
- **Notifications `refreshing`**: Fixed `refreshing={false}` hardcoded → uses actual `isLoading` state for pull-to-refresh spinner
- **Notifications order ref**: `"Commande #"` → `{t("orderRef")} #` (bilingual)
- **Notifications unread count**: `"non lue(s)"` → `{t("unreadNotif")}` (bilingual)
- **Profile save button**: Added `disabled={saving}` + opacity dim while save is in progress
- **Profile alert title**: `Alert.alert("Error", ...)` → `Alert.alert(t("error"), ...)` (bilingual)
- **Cart double-submit**: `loading` and `submitting.current` now only reset on the failure path; success path keeps button disabled throughout the animated banner
- **DriverDashboard Alert dialogs**: Two hardcoded French dialog messages → `t("acceptDeliveryMsg")` / `t("confirmDeliveryMsg")`
- **DriverDashboard payment badge**: `"Payé"` → `{t("paymentPaid")}` (bilingual)
- **RestaurantOwnerDashboard Alert title**: `"Error"` → `t("error")` (bilingual)
- **Orders FlatList**: `scrollEnabled={!!(orders && orders.length > 0)}` → `scrollEnabled={true}` (was blocking scroll on empty state)
- **LanguageContext**: Added keys: `acceptDeliveryMsg`, `confirmDeliveryMsg`, `unreadNotif`, `orderRef`, `moreItems`, `accountDisabled` (EN+FR)

## Key Design Decisions

- UUID generation: `Date.now().toString() + Math.random()` (no uuid package)
- JWT secret: env `JWT_SECRET` or fallback `"deliver-lubumbashi-secret-2024"`
- API base URL in mobile: `https://${EXPO_PUBLIC_DOMAIN}/api`
- No `react-native-maps` (would need exactly v1.18.0)
- All currency in CDF (Congolese Franc)
- Tab bar adapts to user role dynamically

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in `references`

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
