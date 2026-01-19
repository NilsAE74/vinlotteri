import { cookies } from 'next/headers';
import AdminLogin from '@/src/components/AdminLogin';
import WinnerReveal from '@/src/components/WinnerReveal';
import { getAdminStats, adminStartNewRound, getAdminPageData } from '@/lib/admin-actions'; // HUSK Å IMPORTERE DEN NYE
import { Trophy, RefreshCw, BarChart3 } from 'lucide-react';
import { toggleRoundLock } from '@/lib/admin-actions';
import { Lock, Unlock } from 'lucide-react';

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get('admin_auth')?.value === 'true';

  if (!isAuthenticated) return <AdminLogin />;

  // 1. Hent den nye, smarte dataen
  const { activeRound, eligibleTickets, takenCount } = await getAdminPageData();
  
  // 2. Hent statistikk
  const { hallOfFame, winningNumbers } = await getAdminStats();

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
        
        {/* --- MAIN STAGE --- */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-[#1a0b0e]/80 border border-[#722F37] rounded-2xl p-8 shadow-[0_0_50px_rgba(114,47,55,0.2)] text-center min-h-[400px] flex flex-col justify-center">
            <h2 className="text-2xl font-serif text-[#D4AF37] mb-4">Live Trekning</h2>
            
            {activeRound ? (
              // Sender nå inn kun de som KAN vinne til animasjonen
              <WinnerReveal takenTickets={eligibleTickets} />
            ) : (
              <p className="text-gray-500">Start en ny runde for å trekke.</p>
            )}
            
            <div className="mt-8 flex justify-center gap-8 text-sm">
              <div className="text-gray-500">
                Totalt solgt: <span className="text-white font-bold">{takenCount}</span>
              </div>
              <div className="text-gray-500">
                I potten nå: <span className="text-white font-bold">{eligibleTickets.length}</span>
              </div>
            </div>
          </div>

          {/* Handlinger (Behold form action som før) */}
          <div className="bg-[#1a0b0e] border border-[#333] rounded-xl p-6">
            <h3 className="text-lg text-gray-300 mb-4 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Administrasjon
            </h3>
            <form action={toggleRoundLock}>
               <button 
                type="submit"
                className={`
                  w-full py-3 flex items-center justify-center gap-2 rounded-lg font-bold transition-all border
                  ${activeRound?.isLocked 
                    ? "bg-green-900/30 border-green-800 text-green-500 hover:bg-green-900/50" // Hvis Låst: Vis knapp for å åpne
                    : "bg-red-900/30 border-red-800 text-red-500 hover:bg-red-900/50"          // Hvis Åpen: Vis knapp for å stenge
                  }
                `}
              >
                {activeRound?.isLocked ? (
                  <>
                    <Unlock className="w-4 h-4" /> Gjenåpne Salget
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" /> Steng Salget (Før Trekning)
                  </>
                )}
              </button>
            </form>
            <form action={adminStartNewRound}>
              <button 
                type="submit"
                className="w-full py-4 border-2 border-dashed border-[#722F37] text-[#722F37] hover:bg-[#722F37] hover:text-[#D4AF37] hover:border-transparent rounded-lg transition-all uppercase tracking-widest text-sm font-bold"
              >
                Avslutt uke & Start Nytt Lotteri
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Advarsel: Dette arkiverer nåværende runde og sletter alle lodd fra "Active"-visningen.
              </p>
            </form>
          </div>
        </div>

                       {/* --- SIDEBAR (Behold som før) --- */}
        <div className="space-y-6">
          <div className="bg-[#1a0b0e] border border-[#722F37]/50 rounded-xl p-6">
            <h3 className="text-[#D4AF37] font-serif text-xl mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5" /> Hall of Fame
            </h3>
            <ul className="space-y-3">
              {hallOfFame.map((winner, i) => (
                <li key={i} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0">
                  <div className="font-bold text-white">{winner.ownerName}</div>
                  <div className="text-[#D4AF37] font-mono text-lg">{winner._count.ownerName}x</div>
                </li>
              ))}
              {hallOfFame.length === 0 && <p className="text-gray-500 text-sm">Ingen vinnere ennå.</p>}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}