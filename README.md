# Wafra (وفرة) — Food Waste Reduction Platform

A full-stack, multilingual platform connecting restaurants with charities to reduce food
waste — with role-based dashboards for restaurants, charities, delivery drivers, and admins.

## Overview

Wafra coordinates four roles around a single workflow: restaurants list surplus food,
charities reserve it or pool requests into shared "baskets," delivery drivers pick up and
deliver, and admins oversee the whole system. Built as a graduation project (team of 2)
## Key Features

- **Charity baskets**: charities create baskets of needed items; multiple restaurants
  contribute partial quantities; a basket auto-completes at 100% fulfillment and
  auto-generates deliveries per contributing restaurant (idempotent via `SELECT FOR UPDATE`)
- **Strict delivery state machine** (9 states): mirrors real courier apps — pending →
  accepted → en route to restaurant → restaurant confirms handoff → picked up → en route
  to charity → charity confirms receipt → driver confirms → completed. Both handoff points
  require the receiving party's explicit confirmation before the flow can advance.
- **6-way mutual rating system**: after a delivery completes, every role can rate every
  counterpart they interacted with (restaurant↔charity↔driver)
- **Interactive delivery map**: Leaflet + OpenStreetMap showing pickup/dropoff pins and
  route, with Nominatim geocoding
- **Real-time notifications**: unread badge, mark-read/mark-all-read, fully localized via
  a template-key system that interpolates parameters per user language
- **Full multilingual support**: Arabic (RTL), English, Russian — auto-switching layout
  direction, every workflow status and dashboard translated
- **Dark mode**, contact form with admin inbox, full activity audit log

## Tech Stack

**Frontend:** React, TypeScript, Vite, Wouter, Tailwind CSS, shadcn/ui, Recharts,
react-leaflet/Leaflet
**Backend:** Node.js, Express.js, TypeScript, JWT auth, Drizzle ORM
**Database:** PostgreSQL (11 tables, normalized to 3NF)
**Testing:** Jest, Supertest, manual testing via Postman
**DevOps:** Docker, Docker Compose

## Architecture

Layered architecture (Controller → Service → Repository) throughout the backend, with a
custom `LanguageProvider` context on the frontend driving the i18n/RTL system.

## Role & Ownership (Team of 2)

Owned end-to-end: system design, database schema, all backend logic (API, state machine,
concurrency handling, auth), and the majority of the frontend. A teammate contributed
additional frontend UI work.

## Setup

1. Clone the repo
2. `docker-compose up` to start the Postgres instance
3. Copy `.env.example` to `.env` and fill in your own values
4. [remaining setup steps]

---

## Technical Documentation

*(everything below is implementation detail for contributors/reviewers — not needed for a
first-glance overview)*

### Database Tables
`users` · `food_offers` · `requests` · `activity_logs` · `notifications` · `ratings` ·
`contact_messages` · `baskets` · `basket_items` · `basket_contributions` · `deliveries`

### API Endpoints
- `POST /api/auth/register|login`
- `GET/PUT /api/notifications`
- `POST /api/ratings`
- `POST /api/contact`
- `GET/PUT /api/admin/messages`
- `GET/POST /api/baskets`, `GET /api/baskets/:id`, `POST /api/baskets/:id/contribute`,
  `POST /api/baskets/:id/cancel`
- `GET /api/deliveries`, `GET /api/deliveries/my`, `GET /api/deliveries/stats`,
  `PUT /api/deliveries/:id/accept|pickup|deliver`
- `GET /api/admin/deliveries`

### Key Files
- `shared/schema.ts` — Drizzle schema + Zod types
- `server/storage.ts` — all DB operations
- `server/routes.ts` — Express API routes
- `client/src/lib/translations.ts` — i18n (ar/en/ru)
- `client/src/components/LeafletMap.tsx` — map component
