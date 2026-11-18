import Link from 'next/link';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import LotteryGrid from '@/src/components/LotteryGrid';
//import WinnerReveal from '@/src/components/WinnerReveal';
import { createWeeklyRound } from '@/lib/lottery';
import PendingSubmitButton from '@/src/components/PendingSubmitButton';
import { revalidatePath } from 'next/cache';
import { Play } from 'lucide-react'; // Ikon for start-knapp
import WineLogo from '@/src/components/WineLogo';
import WineShowcase from '@/src/components/WineShowcase';
import ThemeToggle from '@/src/components/ThemeToggle';
import CountdownTimer from '@/src/components/CountdownTimer';
import TicketProgressBar from '@/src/components/TicketProgressBar';
import KakeTidslinje, { type KakeUke } from '@/src/components/KakeTidslinje';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

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
      tickets: { orderBy: { number: 'asc' } },
      wines: { orderBy: { position: 'asc' } }
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
            // Starter en ny runde med dagens ukenummer – kun når ingen runde er aktiv
            // (expectedActiveRoundId = null), slik at denne offentlige knappen aldri kan
            // avslutte en pågående runde, og et dobbeltklikk ikke lager to runder.
            const week = getWeekNumber(new Date());
            await createWeeklyRound(`Uke ${week}, ${new Date().getFullYear()}`, null);
            revalidatePath('/');
          }}>
            <PendingSubmitButton
              pendingText="Starter…"
              className="group flex items-center gap-2 mx-auto px-8 py-4 bg-[#722F37] hover:bg-[#8a3842] text-[#D4AF37] font-serif text-xl border border-[#D4AF37]/30 rounded shadow-2xl transition-all"
            >
              <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Start Nytt Lotteri
            </PendingSubmitButton>
          </form>
          <footer className="text-center wine-text-subtle text-sm mt-12">
            <Link href="/vinnerhistorikk" className="wine-text-muted hover:text-[#D4AF37]">Vinnerhistorikk</Link>
          </footer>
        </div>
      </main>
    );
  }

  // --- SCENARIO 2: Aktiv runde (Vis rutenett og spill) ---
  const tickets: Ticket[] = activeRound.tickets;
  const takenTickets = tickets.filter(t => t.isTaken);

  // Hent hele kakelisten. Bare ukene som står her har kake.
  const todayWeek = getWeekNumber(new Date());
  const kakeRader = await prisma.kakeliste.findMany({
    where: { uke: { not: null }, Navn: { not: null } },
    select: { uke: true, Navn: true },
    orderBy: [{ uke: 'asc' }, { id: 'asc' }],
  });
  // Slå sammen flere bakere i samme uke til ett kort
  const kakeUker: KakeUke[] = [];
  for (const { uke, Navn } of kakeRader) {
    const navn = Navn!.trim();
    if (!navn) continue;
    const siste = kakeUker[kakeUker.length - 1];
    if (siste && siste.uke === uke) siste.navn.push(navn);
    else kakeUker.push({ uke: uke!, navn: [navn] });
  }
  // Neste kakebaker = første kakeuke som ikke er passert
  const nextKake = kakeUker.find(k => k.uke >= todayWeek) ?? null;
  const kakeUke = nextKake?.uke ?? null;

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
            {kakeUke ? `Uke ${kakeUke}` : activeRound.name}
          </div>
          <h1 className="text-5xl md:text-7xl font-serif text-transparent bg-clip-text bg-gradient-to-b from-[#D4AF37] to-[#8a6e1f] drop-shadow-sm">
            <WineLogo className="w-16 h-16 text-[#D4AF37] mx-auto" /> Vinlotteri
          </h1>
          <p className="wine-text-muted text-lg font-light tracking-wide max-w-2xl mx-auto">
            Velg dine lykketall.<br />
          </p>
        

        </header>

        {/* Kakebakere – kun ukene som står i kakelisten */}
        <KakeTidslinje uker={kakeUker} currentWeek={todayWeek} />

        {/* Ukens vin – trykk på en vin for mer info */}
        {activeRound.wines.length > 0 && (
          <WineShowcase
            wines={activeRound.wines.map(({ id, info, imageUrl, productCode }) => ({ id, info, imageUrl, productCode }))}
          />
        )}

        {/* Progress bar */}
        <div className="mb-8">
          <TicketProgressBar taken={takenTickets.length} total={tickets.length} />
        </div>

        {/* Countdown */}
        <div className="mb-10">
          <CountdownTimer roundName={kakeUke ? `Uke ${kakeUke}, ${new Date().getFullYear()}` : (activeRound.name ?? '')} />
        </div>

        {/* The Grid */}
        <div className="grid-wrapper backdrop-blur-sm rounded-2xl border p-1 shadow-2xl mt-8">
          <LotteryGrid tickets={tickets} />
        </div>

        <footer className="text-center wine-text-subtle text-sm mt-12 py-8">
          &copy; {new Date().getFullYear()} RENE<br />
          <a href="../admin" className="wine-text-muted hover:text-[#D4AF37]">Admin</a>
          <span className="mx-2 wine-text-subtle">·</span>
          <Link href="/vinnerhistorikk" className="wine-text-muted hover:text-[#D4AF37]">Vinnerhistorikk</Link>
        </footer>
      </div>
    </main>
  );
}

// Hjelpefunksjon for ukenummer
function getWeekNumber(d: Date) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  return weekNo;
}
