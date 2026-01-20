# Vinlotteri - Norwegian Lottery App

A modern lottery application built with Next.js, featuring real-time ticket purchasing and admin management.

## 🏗️ Tech Stack

- **Framework**: Next.js 16 with React 19
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Deployment**: Vercel
- **Database Hosting**: Supabase

## 🚀 Features

- Real-time ticket purchasing (1-200 numbers per round)
- Admin panel for lottery management
- Weekly lottery rounds with automatic winner selection
- Hall of Fame and statistics tracking
- Responsive design with modern UI
- Secure authentication for admin functions

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (Supabase recommended)

### Installation

1. Clone the repository:
git clone <repository-url>
cd vinlotteri

2. Install dependencies:
    npm install

3. Set up environment variables
Create a .env.local file with:
    DATABASE_URL="your-supabase-postgresql-connection-string"
    ADMIN_PASSWORD="your-admin-password"

4. Generate Prisma client and run migrations:
    npx prisma generate
    npx prisma db push

5. Run the development server:
    npm run dev

Open http://localhost:3000 to view the application.

The app is automatically deployed to Vercel on every push to the main branch.
🗄️ Database Schema
The application uses two main models:
LotteryRound: Manages weekly lottery rounds
Ticket: Individual lottery tickets (numbers 1-200 per round)
🔐 Admin Features
Access the admin panel at /admin with the configured admin password to:
View lottery statistics
Draw winners
Start new lottery rounds
Lock/unlock ticket sales
📊 Statistics
The app tracks:
Hall of Fame (top winners)
Most winning numbers
Round-by-round statistics
Ticket sales data
🚀 Deployment
The application is deployed on Vercel with automatic deployments from the main branch. Database migrations are handled automatically through Prisma.
📝 License
This project is private and proprietary.
