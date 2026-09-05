# وفرة (Wafra) — Food Waste Reduction Platform

## Overview
A full-stack multilingual web platform connecting restaurants with charities to reduce food waste. Four roles: restaurants, charities, admin, delivery drivers.

## Tech Stack
- **Frontend**: React + TypeScript, Vite, Wouter, Tailwind CSS, shadcn/ui, Recharts, react-leaflet/Leaflet
- **Backend**: Express.js, JWT authentication, Drizzle ORM
- **Database**: PostgreSQL
- **Languages**: Arabic (RTL), English (LTR), Russian (LTR) — default: English

## Features
- **Restaurants**: Manage food offers, view/confirm/cancel reservations, see ratings, contribute to charity baskets
- **Charities**: Browse offers, map view (Leaflet/OpenStreetMap), make reservations, rate restaurants, create/manage baskets
- **Admin**: User management, offer oversight, activity logs, contact messages inbox, deliveries oversight
- **Delivery drivers**: Browse available deliveries, accept → pickup → deliver, track stats
- **Charity baskets**: Charities create baskets containing multiple items; multiple restaurants contribute partial quantities; basket auto-completes at 100% fulfillment, which auto-creates one delivery per unique contributing restaurant (idempotent via SELECT FOR UPDATE on basket row)
- **Deliveries (strict Uber-like flow)**: pending → accepted → going_to_restaurant → (driver taps pickup) → **waiting_for_restaurant_confirmation** (restaurant sees alert, confirms handoff) → **picked_up** → going_to_charity → arrived (BLOCKED: charity must confirm first) → waiting_for_delivery_confirmation (charity confirmed) → confirmed_by_delivery (driver confirms) → request completed
- **Restaurant confirm-pickup**: Driver taps "I arrived at restaurant" → delivery goes to `waiting_for_restaurant_confirmation`; restaurant sees prominent "Driver waiting" alert with "Confirm Handoff" button; after restaurant confirms → status becomes `picked_up` and driver is notified. Atomic DB with `restaurantConfirmedAt` guard.
- **Charity confirm-receipt**: Mandatory step — charity sees "Needs Confirmation" section when driver arrives; MUST confirm before driver can do final confirm. Atomic DB operation with `charityConfirmedAt` timestamp guard.
- **6-way mutual rating**: After completion, any role can rate their counterparts: restaurant→charity/delivery, charity→restaurant/delivery, driver→restaurant/charity. Uses `fromType/fromId/toType/toId` unique-per-pair ratings table.
- **Delivery map**: Drivers can open a Leaflet+OSM map dialog showing pickup (restaurant) and dropoff (charity) pins with a polyline; uses Nominatim geocoding cached in localStorage
- **Notifications**: Real-time unread badge in navbar, mark-read, mark-all-read. Multilingual body via `messageKey`/`messageParams` fields — notifications store a `{{param}}` template key; client interpolates in the user's current language at render time
- **Confirmation dialogs**: Logout and cancel actions use AlertDialog in all 3 languages (AR/EN/RU)
- **Contact Form**: Messages stored in DB → appear in admin inbox with read status
- **Dark mode**: Full support via ThemeProvider
- **Multilingual**: AR/EN/RU via custom context system (`LanguageProvider` + `translations.ts`). All delivery workflow statuses, rating system, and dashboards fully translated including new `delivery`, `charityDeliveries`, `ratings`, `deliveryStatuses` sections. RTL (Arabic) / LTR (EN/RU) auto-switch on language change.

## Database Tables
- `users` — all roles (restaurant, charity, admin, delivery)
- `food_offers` — restaurant food offers
- `requests` — charity reservation requests
- `activity_logs` — system audit trail
- `notifications` — per-user real notifications
- `ratings` — charity → restaurant ratings
- `contact_messages` — contact form submissions
- `baskets` — charity baskets (status: open/completed/expired/cancelled)
- `basket_items` — line items inside a basket with requested vs fulfilled qty
- `basket_contributions` — each restaurant's contribution toward a basket item
- `deliveries` — delivery records linking request/basket → restaurant → charity → driver

## Admin Credentials
- Email: `admin@wafra.com`
- Password: `admin123`

## Key Files
- `shared/schema.ts` — Drizzle schema + Zod types
- `server/storage.ts` — all DB operations (IStorage interface)
- `server/routes.ts` — Express API routes
- `client/src/lib/translations.ts` — i18n for ar/en/ru
- `client/src/components/LeafletMap.tsx` — OpenStreetMap map component
- `client/src/pages/` — all page components

## API Endpoints
- `POST /api/auth/register|login` — auth
- `GET/PUT /api/notifications` — notifications
- `POST /api/ratings` — submit rating
- `POST /api/contact` — contact form
- `GET/PUT /api/admin/messages` — admin inbox
- `GET /api/baskets` — list open baskets (auto-expires stale ones)
- `POST /api/baskets` — charity creates basket with items
- `GET /api/baskets/:id` — basket details with items + contributors
- `POST /api/baskets/:id/contribute` — restaurant contributes to one or more items; auto-completes basket at 100%
- `POST /api/baskets/:id/cancel` — charity cancels its basket
- `GET /api/deliveries` — driver lists available pending deliveries
- `GET /api/deliveries/my` — driver lists own deliveries
- `GET /api/deliveries/stats` — driver stats (total/active/completed/cancelled)
- `PUT /api/deliveries/:id/accept|pickup|deliver` — driver flow
- `GET /api/admin/deliveries` — admin oversight
