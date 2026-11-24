# Vinlotteri

A weekly workplace wine lottery. Colleagues buy numbered tickets in a 200-ticket grid, pay with Vipps, and the admin draws the winners live on a big screen.

The UI is in Norwegian.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Actions, React Compiler) with React 19
- **Database:** PostgreSQL via Prisma ORM, hosted on Supabase
- **Styling:** Tailwind CSS v4, dark and light themes
- **Language:** TypeScript
- **Validation:** Zod
- **Deployment:** Vercel
- **External services:** Vinmonopolet (wine search and product details), Google Gemini (optional AI summary of the week's wines)

## Features

**Public**
- Ticket grid with 200 numbers per round, multi-select and Vipps payment (5 kr per ticket)
- This week's wines with details from Vinmonopolet, plus a short AI-written summary
- Countdown to the draw, sales progress bar, a random wine fun fact and the cake-baker schedule
- Winner history (`/vinnerhistorikk`): leaderboard, winning-number stats, round log and a luck ranking

**Admin** (`/admin`, password protected)
- Start new weekly rounds, lock and unlock ticket sales
- Edit or release bookings
- Search Vinmonopolet, add the week's wines and get budget-based shopping suggestions, optionally limited to what a chosen store has in stock
- Edit or regenerate the AI summary
- Hall of fame and most frequent winning numbers
- Reset the draw, plus test-ticket tools in development mode

**Live draw** (`/admin/trekning`)
- Four views: grid (default), slot machine, wheel of fortune and classic
- The server picks the winner before the animation starts; the animation only reveals it
- Confetti, melody and spoken announcement

## Rules

- Each round has exactly 200 tickets (1–200).
- A person can win only once per round.
- The grid, slot machine and wheel views draw only among sold tickets. The classic view draws among all tickets, including unsold ones.
- Names are normalised (aliases such as initials map to one name), so the same person is counted as one participant.

## Getting Started

### Prerequisites

- Node.js 20.9 or newer (CI uses Node 22)
- A PostgreSQL database (Supabase recommended)

### Installation

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/NilsAE74/vinlotteri.git
   cd vinlotteri
   npm install
   ```

2. Create a `.env` file in the project root:

   ```bash
   DATABASE_URL="your-supabase-postgresql-connection-string"
   ADMIN_PASSWORD="your-admin-password"
   # Optional: AI summary of the week's wines
   GEMINI_API_KEY="your-gemini-api-key"
   # GEMINI_MODEL="gemini-2.5-flash"
   ```

   Use `.env`, not `.env.local`: the Prisma CLI (`prisma.config.ts`) only reads `.env`. Next.js reads both.

3. Generate the Prisma client and push the schema:

   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

### Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Supabase pooler) |
| `ADMIN_PASSWORD` | Yes | Admin password. Also signs the session cookie, so changing it logs out all admins |
| `GEMINI_API_KEY` | No | Google Gemini key for the weekly wine summary. Without it the summary is skipped |
| `GEMINI_MODEL` | No | Overrides the Gemini model. Falls back to a built-in list |

## Scripts

```bash
npm run dev      # Development server
npm run build    # Prisma generate + production build
npm run start    # Production server
npm run lint     # ESLint
```

There is no automated test suite.

## Database

Defined in `prisma/schema.prisma`:

| Model | Purpose |
|---|---|
| `LotteryRound` | A weekly round: name, active/locked state, AI summary, wines confirmed |
| `Ticket` | One of 200 tickets per round: number, owner, sold, won |
| `Wine` | The bottles raffled in a round, with Vinmonopolet item number |
| `AdminLoginAttempt` | Failed admin logins (hashed IP), used for rate limiting |
| `Ansatte`, `Kakeliste`, `NavneAlias` | Managed directly in Supabase: employees, cake-baker schedule and name aliases |

`Ansatte`, `Kakeliste` and `NavneAlias` are in the schema only so `prisma db push` does not drop them. Names and aliases live in the database, not in the code, because the repository is public.

There are no migration files. Schema changes are applied with `npx prisma db push`, which must be run manually against the production database. The build only runs `prisma generate`.

## Security

- Admin session cookie is an HMAC derived from `ADMIN_PASSWORD` (24 hours)
- Login is rate limited: 5 failed attempts per IP and 50 in total per 15 minutes
- Security headers on all routes (no framing, HSTS, no MIME sniffing, strict referrer policy)
- GitHub Actions runs `npm audit` on push, on pull requests and every Monday. Dependabot opens weekly dependency updates.

## Deployment

Vercel deploys automatically on every push to `master`. Set the environment variables in the Vercel project settings.

## License

Proprietary. All rights reserved.
