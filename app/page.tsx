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
  const today = getIsoWeek(new Date());
  const kakeRader = await prisma.kakeliste.findMany({
    where: { uke: { not: null }, Navn: { not: null } },
    select: { aar: true, uke: true, Navn: true },
    orderBy: [{ aar: 'asc' }, { uke: 'asc' }, { id: 'asc' }],
  });
  // Slå sammen flere bakere i samme uke til ett kort
  const kakeUker: KakeUke[] = [];
  for (const { aar, uke, Navn } of kakeRader) {
    const navn = Navn!.trim();
    if (!navn) continue;
    const siste = kakeUker[kakeUker.length - 1];
    if (siste && siste.aar === aar && siste.uke === uke) siste.navn.push(navn);
    else kakeUker.push({ aar, uke: uke!, navn: [navn] });
  }
  // Neste kakebaker = første kakeuke (år + uke) som ikke er passert
  const nextKake = kakeUker.find(k => k.aar * 100 + k.uke >= today.year * 100 + today.week) ?? null;

  // Navneforslag i kjøpsdialogen, så samme person alltid skrives likt
  const ansatte = await prisma.ansatte.findMany({ where: { Navn: { not: null } }, select: { Navn: true } });
  const ansattNavn = [...new Set(ansatte.map(a => a.Navn!.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'nb'));

  return (
    <main className="min-h-screen wine-page-bg overflow-x-hidden selection:bg-[#D4AF37] selection:text-black">
      {/* Background Ambience – only visible in dark mode */}
      {theme === 'dark' && (
        <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#360f14] via-[#0d0506] to-[#000000] pointer-events-none" />
      )}

      <div className="relative z-10 container mx-auto px-4 py-6">
        {/* Theme toggle – ligger i hjørnet, tar ingen egen linje */}
        <div className="absolute top-2 right-2 md:top-4 md:right-4 z-20">
          <ThemeToggle initialTheme={theme} />
        </div>

        {/* Header */}
        <header className="text-center mb-6">
          <h1 className="flex items-center justify-center gap-2 md:gap-4 text-5xl md:text-7xl font-serif drop-shadow-sm">
            <span aria-hidden="true" className="flex"><WineLogo className="w-8 h-8 md:w-14 md:h-14 shrink-0 text-[#D4AF37]" /></span>
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#D4AF37] to-[#8a6e1f]">Vinlotteri</span>
            {/* Speilvendt glass etter, så de to «skåler» mot hverandre */}
            <span aria-hidden="true" className="flex"><WineLogo className="w-8 h-8 md:w-14 md:h-14 shrink-0 text-[#D4AF37] -scale-x-100" /></span>
          </h1>
        </header>

        {/* Countdown – mb-12 erstatter høyden til den fjernede «Fredag kl. 14:15»-linjen */}
        <div className="mb-12">
          <CountdownTimer roundName={nextKake ? `Uke ${nextKake.uke}, ${nextKake.aar}` : (activeRound.name ?? '')} />
        </div>

        {/* Kakebakere – kun ukene som står i kakelisten */}
        <KakeTidslinje uker={kakeUker} currentYear={today.year} currentWeek={today.week} />

        {/* Ukens vin – trykk på en vin for mer info */}
        {activeRound.wines.length > 0 && (
          <WineShowcase
            wines={activeRound.wines.map(({ id, info, imageUrl, productCode }) => ({ id, info, imageUrl, productCode }))}
            summary={activeRound.aiSummary}
            confirmed={activeRound.winesConfirmed}
          />
        )}

        {/* Progress bar */}
        <div className="mb-4">
          <TicketProgressBar taken={takenTickets.length} total={tickets.length} />
        </div>

        {/* The Grid */}
        <div className="grid-wrapper backdrop-blur-sm rounded-2xl border p-1 shadow-2xl">
          <LotteryGrid tickets={tickets} nameSuggestions={ansattNavn} />
        </div>

        <footer className="text-center wine-text-subtle text-sm mt-6 py-4">
          &copy; {new Date().getFullYear()} RENE<br />
          <a href="../admin" className="wine-text-muted hover:text-[#D4AF37]">Admin</a>
          <span className="mx-2 wine-text-subtle">·</span>
          <Link href="/vinnerhistorikk" className="wine-text-muted hover:text-[#D4AF37]">Vinnerhistorikk</Link>
        </footer>
      </div>
    </main>
  );
}

// ISO-uke med tilhørende ISO-år (uke 1 kan starte i desember, uke 53 kan havne i januar)
function getIsoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return { year: d.getUTCFullYear(), week: getWeekNumber(date) };
}

// Hjelpefunksjon for ukenummer
function getWeekNumber(d: Date) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  return weekNo;
}
