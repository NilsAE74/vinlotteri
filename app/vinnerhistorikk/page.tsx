import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Trophy, BarChart3, ScrollText } from 'lucide-react';
import ThemeToggle from '@/src/components/ThemeToggle';
import { getAdminTheme } from '@/lib/admin-auth';
import { getWinnerHistory } from '@/lib/history';

export const metadata: Metadata = { title: 'Vinnerhistorikk – Vinlotteri' };
export const dynamic = 'force-dynamic'; // Alltid ferske tall fra databasen

const TOP_NUMBERS = 15;

const formatDate = (d: Date) =>
  d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', timeZone: 'Europe/Oslo' });

export default async function WinnerHistoryPage() {
  const theme = await getAdminTheme();
  const { stats, leaderboard, numberStats, repeatedNumbers, rounds } = await getWinnerHistory();

  const topNumbers = numberStats.slice(0, TOP_NUMBERS);
  const maxTotal = Math.max(1, ...topNumbers.map(s => s.total));

  return (
    <main className="min-h-screen wine-page-bg px-4 py-8 md:py-16">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <Link href="/" className="wine-text-muted hover:text-[#D4AF37] text-sm flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Til lotteriet
          </Link>
          <ThemeToggle initialTheme={theme} />
        </div>

        {/* Header */}
        <header className="mb-10">
          <p className="font-mono text-xs uppercase tracking-widest text-[#D4AF37] mb-3">Vinlotteriet</p>
          <h1 className="text-4xl md:text-5xl font-serif text-[#D4AF37] mb-3">Vinnerhistorikk</h1>
          <p className="wine-text-muted text-lg max-w-2xl">
            Alle trekninger som har truffet et solgt lodd siden lotteriet startet – hvem som vant, og hvilket lodd som ble trukket.
          </p>
          {stats.unsoldDraws > 0 && (
            <p className="wine-text-subtle text-sm mt-3 pl-3 border-l-2 border-[#722F37]/50">
              {stats.unsoldDraws} trekninger som traff usolgte lodd er ikke med i topplisten og loggen.
            </p>
          )}
        </header>

        {/* Nøkkeltall */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#722F37]/30 border border-[#722F37]/30 rounded-xl overflow-hidden mb-14">
          <Stat value={stats.draws} label="trekninger med vinner" />
          <Stat value={stats.winnerCount} label="ulike vinnere" />
          <Stat
            value={stats.topWins}
            label={stats.topNames.length ? `flest gevinster – ${stats.topNames.join(' og ')}` : 'flest gevinster'}
          />
          <Stat value={stats.roundsWithWinner} label="runder gjennomført" />
        </div>

        {stats.draws === 0 ? (
          <p className="wine-text-subtle text-center py-12">Ingen vinnere er trukket ennå.</p>
        ) : (
          <>
            {/* Toppliste */}
            <Section icon={<Trophy className="w-5 h-5" />} title="Toppliste" note="rangert etter antall gevinster">
              <ol className="space-y-2">
                {leaderboard.map(e => (
                  <li
                    key={e.name}
                    className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 px-4 py-3 rounded-lg border wine-card-bg ${
                      e.rank === 1 ? 'border-[#D4AF37]' : 'border-[#722F37]/30'
                    }`}
                  >
                    <span
                      className={`text-center font-serif text-2xl ${
                        e.rank === 1 ? 'text-[#D4AF37]' : e.rank <= 3 ? 'text-[#722F37]' : 'wine-text-subtle'
                      }`}
                    >
                      {e.rank}
                    </span>
                    <div className="min-w-0">
                      <div className="wine-text font-semibold">{e.name}</div>
                      <div className="wine-text-subtle font-mono text-xs truncate">nr. {e.numbers.join(' · ')}</div>
                    </div>
                    <span className="font-mono text-[#D4AF37] whitespace-nowrap">
                      <b className="text-lg">{e.wins}</b> {e.wins === 1 ? 'gevinst' : 'gevinster'}
                    </span>
                  </li>
                ))}
              </ol>
            </Section>

            {/* Mest trukne tall */}
            <Section
              icon={<BarChart3 className="w-5 h-5" />}
              title="Mest trukne tall"
              note={`topp ${topNumbers.length} · med og uten gevinst`}
            >
              <div className="flex gap-6 mb-4 text-sm wine-text-muted">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#D4AF37]" /> Med gevinst</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#722F37]" /> Uten gevinst</span>
              </div>
              <ul className="space-y-1.5">
                {topNumbers.map(s => (
                  <li key={s.number} className="grid grid-cols-[3rem_1fr_2rem] items-center gap-3">
                    <NumberChip n={s.number} />
                    <div
                      className="flex h-4"
                      role="img"
                      aria-label={`Nummer ${s.number}: trukket ${s.total} ganger, ${s.withWinner} med gevinst og ${s.withoutWinner} uten`}
                    >
                      {s.withWinner > 0 && (
                        <div
                          className="h-full bg-[#D4AF37] rounded-l-sm last:rounded-r"
                          style={{ width: `${(s.withWinner / maxTotal) * 100}%` }}
                          title={`Nr. ${s.number} – ${s.withWinner} med gevinst`}
                        />
                      )}
                      {s.withoutWinner > 0 && (
                        <div
                          className="h-full bg-[#722F37] first:rounded-l-sm rounded-r ml-0.5 first:ml-0"
                          style={{ width: `${(s.withoutWinner / maxTotal) * 100}%` }}
                          title={`Nr. ${s.number} – ${s.withoutWinner} uten gevinst`}
                        />
                      )}
                    </div>
                    <span className="font-mono text-sm wine-text-muted text-right">{s.total}</span>
                  </li>
                ))}
              </ul>
              <p className="wine-text-subtle text-xs font-mono mt-4">
                {repeatedNumbers > 0
                  ? `${repeatedNumbers} tall er trukket minst to ganger. Hver runde starter med 200 nye lodd, så samme nummer kan vinne flere ganger.`
                  : 'Ingen tall er trukket mer enn én gang ennå.'}
              </p>
            </Section>

            {/* Trekningslogg */}
            <Section icon={<ScrollText className="w-5 h-5" />} title="Full trekningslogg" note="nyeste runde først">
              <div className="border border-[#722F37]/30 rounded-xl overflow-hidden wine-card-bg">
                {rounds.map(r => (
                  <div key={r.id}>
                    <div className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-[#D4AF37] bg-[#722F37]/15 border-t border-[#722F37]/20 first:border-t-0">
                      {r.name} <span className="wine-text-subtle normal-case tracking-normal ml-2">{formatDate(r.date)}</span>
                    </div>
                    <ul>
                      {r.winners.map((w, i) => (
                        <li key={`${w.number}-${i}`} className="flex items-center gap-4 px-4 py-2.5 wine-border-faint border-t">
                          <NumberChip n={w.number} />
                          <span className="wine-text font-medium">{w.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        <footer className="text-center wine-text-subtle text-sm mt-16">
          <Link href="/" className="wine-text-muted hover:text-[#D4AF37]">Tilbake til lotteriet</Link>
        </footer>
      </div>
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="wine-card-bg p-5">
      <div className="font-serif text-4xl text-[#D4AF37] leading-none mb-2 tabular-nums">{value}</div>
      <div className="wine-text-muted text-sm leading-snug">{label}</div>
    </div>
  );
}

function Section({ icon, title, note, children }: { icon: React.ReactNode; title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <div className="flex items-baseline justify-between gap-4 border-b border-[#722F37]/40 pb-3 mb-5">
        <h2 className="text-2xl font-serif text-[#D4AF37] flex items-center gap-2">{icon} {title}</h2>
        <span className="wine-text-subtle text-xs font-mono hidden sm:block">{note}</span>
      </div>
      {children}
    </section>
  );
}

function NumberChip({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[2.75rem] px-2 py-0.5 font-mono font-semibold text-sm tabular-nums rounded-md border border-[#722F37]/50 bg-[#722F37]/15 text-[#D4AF37]">
      {n}
    </span>
  );
}
