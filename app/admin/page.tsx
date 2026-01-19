import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';
import AdminLogin from '@/src/components/AdminLogin';
import WinnerReveal from '@/src/components/WinnerReveal';
import { getAdminStats, adminStartNewRound } from '@/lib/admin-actions';
import { Trophy, RefreshCw, BarChart3 } from 'lucide-react';

const prisma = new PrismaClient();

export default async function AdminPage() {
  // 1. Sjekk sikkerhet
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get('admin_auth')?.value === 'true';

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  // 2. Hent data for aktiv runde (for trekking)
  const activeRound = await prisma.lotteryRound.findFirst({
    where: { isActive: true },
    include: { tickets: true }
  });

  const takenTickets = activeRound ? activeRound.tickets.filter(t => t.isTaken) : [];
  
  // 3. Hent historikk og statistikk
  const { recentWinners, winningNumbers } = await getAdminStats();

  return (
    <main className="min-h-screen bg-[#0d0506] text-white p-6 md:p-12">
      <header className="max-w-6xl mx-auto mb-12 flex justify-between items-center border-b border-[#722F37]/30 pb-6">
        <div>
          <h1 className="text-4xl font-serif text-[#D4AF37]">Lottery Control</h1>
          <p className="text-gray-400">
            Aktiv runde: <span className="text-white">{activeRound?.name || 'Ingen aktiv runde'}</span>
          </p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* --- MAIN STAGE: TREKKING --- */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-[#1a0b0e]/80 border border-[#722F37] rounded-2xl p-8 shadow-[0_0_50px_rgba(114,47,55,0.2)] text-center min-h-[400px] flex flex-col justify-center">
            <h2 className="text-2xl font-serif text-[#D4AF37] mb-4">Live Trekning</h2>
            
            {activeRound ? (
              <WinnerReveal takenTickets={takenTickets} />
            ) : (
              <p className="text-gray-500">Du må starte en ny runde for å kunne trekke.</p>
            )}
            
            <div className="mt-8 text-sm text-gray-500">
              Antall lodd i potten: <span className="text-white font-bold">{takenTickets.length}</span>
            </div>
          </div>

          {/* Handlinger */}
          <div className="bg-[#1a0b0e] border border-[#333] rounded-xl p-6">
            <h3 className="text-lg text-gray-300 mb-4 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Administrasjon
            </h3>
            <form action={adminStartNewRound}>
              <button 
                type="submit"
                className="w-full py-4 border-2 border-dashed border-[#722F37] text-[#722F37] hover:bg-[#722F37] hover:text-[#D4AF37] hover:border-transparent rounded-lg transition-all uppercase tracking-widest text-sm font-bold"
                //</form>onClick={() => {
                    // Vi legger inn en enkel confirm her med standard JS, men siden dette er server action
                    // vil den kjøre direkte. For enklere flyt i første omgang skipper vi confirm-dialog
                    // eller implementerer det i en Client Component wrapper hvis du vil ha det veldig trygt.
                //}}
              >
                Avslutt uke & Start Nytt Lotteri
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Advarsel: Dette arkiverer nåværende runde og sletter alle lodd fra "Active"-visningen.
              </p>
            </form>
          </div>
        </div>

        {/* --- SIDEBAR: STATISTIKK --- */}
        <div className="space-y-6">
          
          {/* Siste Vinnere */}
          <div className="bg-[#1a0b0e] border border-[#722F37]/50 rounded-xl p-6">
            <h3 className="text-[#D4AF37] font-serif text-xl mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5" /> Hall of Fame
            </h3>
            <ul className="space-y-3">
              {recentWinners.map((ticket, i) => (
                <li key={i} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0">
                  <div>
                    <div className="font-bold text-white">{ticket.ownerName}</div>
                    <div className="text-xs text-gray-500">{ticket.round.name}</div>
                  </div>
                  <div className="text-[#D4AF37] font-mono text-lg">#{ticket.number}</div>
                </li>
              ))}
              {recentWinners.length === 0 && <p className="text-gray-500 text-sm">Ingen vinnere ennå.</p>}
            </ul>
          </div>

          {/* Lykketall Statistikk */}
          <div className="bg-[#1a0b0e] border border-[#722F37]/50 rounded-xl p-6">
            <h3 className="text-[#D4AF37] font-serif text-xl mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" /> Lykketall
            </h3>
            <div className="space-y-3">
              {winningNumbers.map((stat, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#2a1216] border border-[#722F37] flex items-center justify-center text-[#D4AF37] font-bold text-sm">
                    {stat.number}
                  </div>
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#D4AF37]" 
                      style={{ width: `${(stat._count.number / 5) * 100}%` }} // Skalerer bare visuelt
                    />
                  </div>
                  <div className="text-xs text-gray-400">{stat._count.number} seire</div>
                </div>
              ))}
              {winningNumbers.length === 0 && <p className="text-gray-500 text-sm">Ikke nok data.</p>}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}