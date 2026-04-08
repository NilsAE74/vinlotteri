import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import LotteryGrid from '@/src/components/LotteryGrid';
//import WinnerReveal from '@/src/components/WinnerReveal';
import { startNewWeeklyLottery } from '@/lib/actions'; // Sørg for at denne er i actions.ts
import { Play } from 'lucide-react'; // Ikon for start-knapp
import WineLogo from '@/src/components/WineLogo';
import ThemeToggle from '@/src/components/ThemeToggle';
import CountdownTimer from '@/src/components/CountdownTimer';
import TicketProgressBar from '@/src/components/TicketProgressBar';

const prisma = new PrismaClient();

type Ticket = {
  id: number;
  number: number;
  ownerName: string | null;
  isTaken: boolean;
  hasWon: boolean;
};

export default async function Home() {
  const cookieStore = await cookies();
  const theme = (cookieStore.get('admin-theme')?.value ?? 'dark') as 'dark' | 'light';

  // 1. Finn den runden som er aktiv nå
  const activeRound = await prisma.lotteryRound.findFirst({
    where: { isActive: true },
    include: {
      tickets: { orderBy: { number: 'asc' } }
    }
  });

  // --- SCENARIO 1: Ingen aktiv runde (Vis start-skjerm) ---
  if (!activeRound) {
    return (
      <main className="min-h-screen wine-page-bg flex flex-col items-center justify-center p-4">
        <div className="absolute top-4 right-4">
          <ThemeToggle initialTheme={theme} />
        </div>
        <div className="text-center space-y-6 max-w-lg">
          {/* Header */}
          <header className="text-center mb-12 space-y-4 flex flex-col items-center">
            {/* LOGO HER */}
            <div className="p-4 rounded-full wine-card-bg border border-[#722F37] shadow-[0_0_30px_rgba(114,47,55,0.4)] mb-4">
              <WineLogo className="w-16 h-16 text-[#D4AF37]" />
            </div>
            <h1 className="text-5xl font-serif text-[#D4AF37]">Vinlotteriet</h1>
          </header>
          <p className="wine-text-muted">Ingen trekning er aktiv akkurat nå.</p>

          <form action={async () => {
            'use server';
            // Starter en ny runde med dagens ukenummer
            const week = getWeekNumber(new Date());
            await startNewWeeklyLottery(`Uke ${week}, ${new Date().getFullYear()}`);
          }}>
            <button
              type="submit"
              className="group flex items-center gap-2 mx-auto px-8 py-4 bg-[#722F37] hover:bg-[#8a3842] text-[#D4AF37] font-serif text-xl border border-[#D4AF37]/30 rounded shadow-2xl transition-all"
            >
              <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Start Nytt Lotteri
            </button>
          </form>
        </div>
      </main>
    );
  }

  // --- SCENARIO 2: Aktiv runde (Vis rutenett og spill) ---
  const tickets: Ticket[] = activeRound.tickets;
  const takenTickets = tickets.filter(t => t.isTaken);

  return (
    <main className="min-h-screen wine-page-bg overflow-x-hidden selection:bg-[#D4AF37] selection:text-black">
      {/* Background Ambience – only visible in dark mode */}
      {theme === 'dark' && (
        <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#360f14] via-[#0d0506] to-[#000000] pointer-events-none" />
      )}

      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Theme toggle */}
        <div className="flex justify-end mb-4">
          <ThemeToggle initialTheme={theme} />
        </div>

        {/* Header */}
        <header className="text-center mb-12 space-y-4">
          <div className="inline-block px-3 py-1 border border-[#D4AF37]/30 rounded-full text-[#D4AF37] text-xs uppercase tracking-widest mb-2">
            {activeRound.name}
          </div>
          <h1 className="text-5xl md:text-7xl font-serif text-transparent bg-clip-text bg-gradient-to-b from-[#D4AF37] to-[#8a6e1f] drop-shadow-sm">
            <WineLogo className="w-16 h-16 text-[#D4AF37] mx-auto" /> Vinlotteri
          </h1>
          <p className="wine-text-muted text-lg font-light tracking-wide max-w-2xl mx-auto">
            Velg dine lykketall.<br />
            5 kr pr lodd. Vipps beløp til Johan Fredrik.                        
          </p>
        </header>

        {/* Progress bar */}
        <div className="mb-8">
          <TicketProgressBar taken={takenTickets.length} total={tickets.length} />
        </div>

        {/* Countdown */}
        <div className="mb-10">
          <CountdownTimer roundName={activeRound.name ?? ''} />
        </div>

        {/* The Grid */}
        <div className="grid-wrapper backdrop-blur-sm rounded-2xl border p-1 shadow-2xl mt-8">
          <LotteryGrid tickets={tickets} />
        </div>

        <footer className="text-center wine-text-subtle text-sm mt-12 py-8">
          &copy; {new Date().getFullYear()} RENE<br />
          <a href="../admin" className="wine-text-muted hover:text-[#D4AF37]">Admin</a>
        </footer>
      </div>
    </main>
  );
}

// Hjelpefunksjon for ukenummer
function getWeekNumber(d: Date) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  var weekNo = Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  return weekNo;
}
