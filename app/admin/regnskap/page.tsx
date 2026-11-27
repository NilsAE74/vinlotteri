import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import AdminLogin from '@/src/components/AdminLogin';
import ThemeToggle from '@/src/components/ThemeToggle';
import PendingSubmitButton from '@/src/components/PendingSubmitButton';
import { isAdminAuthenticated, getAdminTheme } from '@/lib/admin-auth';
import { getLedger, getAccountingRounds, ACCOUNTING_FROM } from '@/lib/accounting';
import { addAccountingPost, deleteAccountingPost } from '@/lib/admin-actions';

const kr = (n: number) => `${n.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;
const sign = (n: number) => (n < 0 ? 'text-red-500' : 'text-green-500');
const day = (d: Date) => d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const input = 'w-full rounded-lg wine-card-alpha border border-[#722F37]/50 px-3 py-2 wine-text';

export default async function AccountingPage() {
  if (!(await isAdminAuthenticated())) return <AdminLogin />;

  const theme = await getAdminTheme();
  const [{ lines, posts }, rounds] = await Promise.all([getLedger(), getAccountingRounds()]);
  const roundLines = lines.flatMap(l => (l.kind === 'round' ? [l] : []));
  const total = roundLines.reduce(
    (t, r) => ({ income: t.income + r.income, cost: t.cost + r.cost, tickets: t.tickets + r.paidTickets, bottles: t.bottles + r.bottles }),
    { income: 0, cost: 0, tickets: 0, bottles: 0 },
  );
  const otherTotal = posts.reduce((sum, p) => sum + p.amount, 0);
  const saldo = lines.at(-1)?.balance ?? 0;
  const missing = roundLines.reduce((n, r) => n + r.missingPrice, 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen wine-page-bg p-6 md:p-12">
      <header className="max-w-5xl mx-auto mb-8 flex justify-between items-center border-b border-[#722F37]/30 pb-6">
        <div>
          <Link href="/admin" className="text-sm wine-text-muted hover:text-[#D4AF37] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Til admin
          </Link>
          <h1 className="text-4xl font-serif text-[#D4AF37] mt-2">Regnskap</h1>
          <p className="wine-text-muted">Fra og med uke {ACCOUNTING_FROM.week}, {ACCOUNTING_FROM.year}</p>
        </div>
        <ThemeToggle initialTheme={theme} />
      </header>

      <div className="max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="wine-card-bg border border-[#722F37]/50 rounded-xl p-5">
            <div className="text-sm wine-text-subtle">Lodd ({total.tickets} betalte)</div>
            <div className="text-2xl font-mono wine-text">{kr(total.income)}</div>
          </div>
          <div className="wine-card-bg border border-[#722F37]/50 rounded-xl p-5">
            <div className="text-sm wine-text-subtle">Vinkjøp ({total.bottles} flasker)</div>
            <div className="text-2xl font-mono wine-text">{kr(-total.cost)}</div>
          </div>
          <div className="wine-card-bg border border-[#722F37]/50 rounded-xl p-5">
            <div className="text-sm wine-text-subtle">Egne poster ({posts.length})</div>
            <div className="text-2xl font-mono wine-text">{kr(otherTotal)}</div>
          </div>
          <div className="wine-card-bg border border-[#722F37]/50 rounded-xl p-5">
            <div className="text-sm wine-text-subtle">Saldo</div>
            <div className={`text-2xl font-mono ${sign(saldo)}`}>{kr(saldo)}</div>
          </div>
        </div>

        {missing > 0 && (
          <p className="text-sm text-[#D4AF37]">
            {missing} flaske{missing === 1 ? '' : 'r'} mangler pris i vinteksten og er ikke med i utgiftene.
          </p>
        )}

        {/* Kronologisk: egne poster og runder, med saldo etter hver linje */}
        <div className="wine-card-bg border border-[#722F37]/50 rounded-xl p-6 overflow-x-auto">
          {lines.length === 0 ? (
            <p className="wine-text-subtle">Ingen poster eller runder i regnskapet ennå.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="wine-text-subtle text-left wine-border-faint border-b">
                  <th className="py-2 pr-4 font-normal">Dato</th>
                  <th className="py-2 pr-4 font-normal">Hva</th>
                  <th className="py-2 pr-4 font-normal text-right">Lodd</th>
                  <th className="py-2 pr-4 font-normal text-right">Vinkjøp</th>
                  <th className="py-2 pr-4 font-normal text-right">Egne poster</th>
                  <th className="py-2 pr-4 font-normal text-right">Resultat</th>
                  <th className="py-2 font-normal text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {lines.map(l =>
                  l.kind === 'post' ? (
                    <tr key={`p${l.post.id}`} className="wine-border-faint border-b last:border-0">
                      <td className="py-2 pr-4 font-sans wine-text-muted whitespace-nowrap">{day(l.date)}</td>
                      <td className="py-2 pr-4 font-sans wine-text-muted" colSpan={4}>{l.post.text}</td>
                      <td className={`py-2 pr-4 text-right ${sign(l.post.amount)}`}>{kr(l.post.amount)}</td>
                      <td className={`py-2 text-right ${sign(l.balance)}`}>{kr(l.balance)}</td>
                    </tr>
                  ) : (
                    <tr key={`r${l.id}`} className="wine-border-faint border-b last:border-0">
                      <td className="py-2 pr-4 font-sans wine-text-muted whitespace-nowrap">{day(l.date)}</td>
                      <td className="py-2 pr-4 font-sans wine-text">{l.name}</td>
                      <td className="py-2 pr-4 text-right wine-text" title={`${l.paidTickets} betalte lodd`}>{kr(l.income)}</td>
                      <td className="py-2 pr-4 text-right wine-text" title={`${l.bottles} flasker`}>
                        {kr(-l.cost)}
                        {l.missingPrice > 0 && <span className="text-[#D4AF37]"> ({l.missingPrice} u/pris)</span>}
                      </td>
                      <td className="py-2 pr-4 text-right wine-text-muted">{l.other ? kr(l.other) : '–'}</td>
                      <td className={`py-2 pr-4 text-right ${sign(l.result)}`}>{kr(l.result)}</td>
                      <td className={`py-2 text-right ${sign(l.balance)}`}>{kr(l.balance)}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form action={addAccountingPost} className="wine-card-bg border border-[#722F37]/50 rounded-xl p-6 space-y-3">
            <h2 className="text-[#D4AF37] font-serif text-xl">Ny post</h2>
            <p className="text-xs wine-text-subtle">
              F.eks. inngående saldo, avvik mot kvitteringen eller gebyrer. Negativt beløp = utgift.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm wine-text-muted space-y-1">
                <span>Dato</span>
                <input type="date" name="dato" required defaultValue={today} className={input} />
              </label>
              <label className="text-sm wine-text-muted space-y-1">
                <span>Beløp (kr)</span>
                <input name="belop" required inputMode="decimal" pattern="-?[\d\s]+([.,]\d{1,2})?" placeholder="-49,90" className={input} />
              </label>
            </div>
            <label className="block text-sm wine-text-muted space-y-1">
              <span>Tekst</span>
              <input name="tekst" required maxLength={200} placeholder="Hva posten gjelder" className={input} />
            </label>
            <label className="block text-sm wine-text-muted space-y-1">
              <span>Runde (valgfritt, tas med i rundens resultat)</span>
              <select name="roundId" defaultValue="" className={input}>
                <option value="">Ingen</option>
                {rounds.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            <PendingSubmitButton
              pendingText="Lagrer…"
              className="w-full py-2 bg-[#722F37] text-white font-bold rounded-lg hover:bg-[#8a3842] transition-all"
            >
              Legg til
            </PendingSubmitButton>
          </form>

          <div className="wine-card-bg border border-[#722F37]/50 rounded-xl p-6">
            <h2 className="text-[#D4AF37] font-serif text-xl mb-3">Egne poster</h2>
            {posts.length === 0 ? (
              <p className="wine-text-subtle text-sm">Ingen poster ennå.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {posts.map(p => (
                  <li key={p.id} className="flex items-center gap-3 wine-border-faint border-b pb-2 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="wine-text truncate">{p.text}</div>
                      <div className="text-xs wine-text-subtle">
                        {day(p.date)}
                        {p.roundName && ` · ${p.roundName}`}
                      </div>
                    </div>
                    <div className={`font-mono ${sign(p.amount)}`}>{kr(p.amount)}</div>
                    <form action={deleteAccountingPost}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" aria-label={`Slett «${p.text}»`} className="p-1 wine-text-subtle hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p className="text-xs wine-text-subtle">
          Lodd er betalte lodd à 5 kr (gratis bonuslodd fra quizen er ikke med). Vinkjøp er prisen fra Vinmonopolet
          slik den står på vinene i runden. Rundene dateres på trekningsdagen.
        </p>
      </div>
    </main>
  );
}
