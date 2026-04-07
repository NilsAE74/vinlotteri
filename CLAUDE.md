# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Generate Prisma client + Next.js production build
npm run start    # Start production server
npm run lint     # Run ESLint

npx prisma generate   # Regenerate Prisma client after schema changes
npx prisma db push    # Push schema changes to database
```

## Architecture

**Vinlotteri** is a Norwegian wine lottery app built with Next.js App Router, Prisma ORM, and PostgreSQL (Supabase in production).

### Data Model

Two models in `prisma/schema.prisma`:
- `LotteryRound` — a lottery round (name, isActive, isLocked)
- `Ticket` — one of 200 tickets per round (number 1–200, ownerName, isTaken, hasWon). Unique constraint on `[number, roundId]`.

### Request Flow

All mutations go through **Next.js Server Actions** (not API routes):
- `lib/actions.ts` — public: `bookTicket`, `startNewWeeklyLottery`, `resetLottery`
- `lib/admin-actions.ts` — admin: `drawWinnerAction`, `toggleRoundLock`, `getAdminStats`, etc.

Server actions call Prisma directly, then call `revalidatePath('/')` to refresh cached data.

### Pages

- `app/page.tsx` — Public lottery page. Server component that fetches active round + tickets, renders `<LotteryGrid>`.
- `app/admin/page.tsx` — Admin panel. Cookie-authenticated (`admin_auth`, 24h). Handles winner drawing, round management, hall of fame, and winning-number stats.

### Key Components (`src/components/`)

- `LotteryGrid.tsx` — Client component. 10-col (mobile) / 20-col (desktop) grid of 200 tickets with multi-select and floating buy button.
- `TicketDialog.tsx` — Purchase form dialog; validates via Zod before calling `bookTicket`.
- `WinnerReveal.tsx` — Animated winner announcement with confetti and sound.
- `AdminLogin.tsx` — Password form for admin auth.
- `ThemeToggle.tsx` — Client component. Sun/Moon button that toggles dark/light theme by setting `data-theme` on `<html>` and writing an `admin-theme` cookie for SSR persistence.

### Business Rules

- Each round has exactly 200 tickets (1–200).
- A person cannot win twice in the same round (eligible pool excludes previous winners).
- Rounds can be locked to prevent new ticket purchases before drawing.

### Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (Supabase pooler)
- `ADMIN_PASSWORD` — Admin panel password

### Theming

Both dark and light themes are supported on all pages. Theme is stored in the `admin-theme` cookie (values: `dark` / `light`, default `dark`) and read in `app/layout.tsx` to set `data-theme` on `<html>` at render time.

**Do not use Tailwind arbitrary CSS-variable classes** (e.g. `bg-[var(--wine-bg)]`) — Tailwind v4 does not generate these reliably. Instead use the named CSS utility classes defined in `globals.css`:

| Class | Purpose |
|---|---|
| `wine-page-bg` | Page background + base text color |
| `wine-card-bg` | Card/panel background |
| `wine-card-alpha` | Semi-transparent card background |
| `wine-text` | Primary text |
| `wine-text-muted` | Secondary/muted text |
| `wine-text-subtle` | Faint/hint text |
| `wine-border-faint` | Subtle divider borders |
| `ticket-available` | Available ticket background + border |
| `ticket-taken` | Sold ticket background + border |
| `grid-wrapper` | Lottery grid container background + border |

Gold `#D4AF37` and burgundy `#722F37` accents are identical in both themes and can be used as hardcoded Tailwind classes. Path alias `@components/*` → `src/components/`.
