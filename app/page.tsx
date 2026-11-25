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
import FunFactBox from '@/src/components/FunFactBox';
import WineSummaryBox from '@/src/components/WineSummaryBox';
import { pickFunFactIndex } from '@/lib/wine-fun-facts';
import ThemeToggle from '@/src/components/ThemeToggle';
import TicketProgressBar from '@/src/components/TicketProgressBar';
import KakeTidslinje, { type KakeUke } from '@/src/components/KakeTidslinje';
import Perforation from '@/src/components/Perforation';
import RoundStamp from '@/src/components/RoundStamp';

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
            <div className="p-4 rounded-full wine-card-bg border wine-border-faint mb-4">
              <WineLogo className="w-16 h-16 wine-accent" />
            </div>
            <h1 className="text-5xl font-serif wine-accent">Vinlotteriet</h1>
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
              className="group flex items-center gap-2 mx-auto px-8 py-4 wine-card-bg wine-card-interactive wine-accent font-serif text-xl border wine-border-strong rounded shadow-2xl transition-all"
            >
              <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Start Nytt Lotteri
            </PendingSubmitButton>
          </form>
          <footer className="text-center wine-text-subtle text-sm mt-12">
            <Link href="/vinnerhistorikk" className="wine-link">Vinnerhistorikk</Link>
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

  // Navneforslag i kjøpsdialogen, så samme person alltid skrives likt
  const ansatte = await prisma.ansatte.findMany({ where: { Navn: { not: null } }, select: { Navn: true } });
  const ansattNavn = [...new Set(ansatte.map(a => a.Navn!.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'nb'));

  const funFactIndex = pickFunFactIndex();

  const roundLabel = activeRound.name ?? '';

  return (
    <main className="min-h-screen wine-page-bg overflow-x-hidden">
      <div className="relative z-10 max-w-[1180px] mx-auto px-6 py-12">

        {/* Mastetopp: ordmerke + rundeinfo som en loddbok-stempel, tema-bryter til høyre */}
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex items-center gap-3">
            <WineLogo aria-hidden className="w-8 h-8 wine-accent" />
            <h1 className="font-serif text-4xl font-semibold tracking-tight wine-text">Vinlotteri</h1>
          </div>
          <div className="flex items-center gap-3.5">
            <RoundStamp roundName={roundLabel} />
            <ThemeToggle initialTheme={theme} />
          </div>
        </div>

        <Perforation />

        {/* Fun fact + AI-oppsummering i én kolonne, ukens viner + kakebakere i den andre */}
        <div className="flex flex-wrap gap-10">
          <div className="flex-[1_1_260px] min-w-[240px] flex flex-col gap-4">
            <FunFactBox initialIndex={funFactIndex} />
            {activeRound.wines.length > 0 && activeRound.aiSummary && (
              <WineSummaryBox summary={activeRound.aiSummary} />
            )}
          </div>

          <div className="flex-[999_1_420px] min-w-0 flex flex-col gap-8">
            {activeRound.wines.length > 0 && (
              <WineShowcase
                wines={activeRound.wines.map(({ id, info, imageUrl, productCode }) => ({ id, info, imageUrl, productCode }))}
                confirmed={activeRound.winesConfirmed}
              />
            )}

            {/* Kakebakere – kun ukene som står i kakelisten */}
            <KakeTidslinje uker={kakeUker} currentYear={today.year} currentWeek={today.week} />
          </div>
        </div>

        <Perforation />

        <TicketProgressBar taken={takenTickets.length} total={tickets.length} />

        <Perforation />

        {/* The Grid */}
        <div className="grid-wrapper rounded-xl border p-1">
          <LotteryGrid tickets={tickets} nameSuggestions={ansattNavn} />
        </div>

        <footer className="flex justify-between flex-wrap gap-2 text-sm wine-text-subtle mt-14 pt-5 border-t wine-border-faint">
          <span>© {new Date().getFullYear()} RENE</span>
          <span>
            <a href="../admin" className="wine-link">Admin</a>
            <span className="mx-2">·</span>
            <Link href="/vinnerhistorikk" className="wine-link">Vinnerhistorikk</Link>
          </span>
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
