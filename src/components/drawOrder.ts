// Rekkefølgen loddene slukkes i under rutenett-trekningen.
//
// Regel: når det er like mange lodd igjen som deltakere, skal alle som ikke har
// vunnet fortsatt være med. Hver deltaker (unntatt vinneren) får derfor ett
// tilfeldig «representant-lodd» som slukkes til slutt. Alle andre lodd, også
// vinnerens ekstra lodd, slukkes først.
//
// Returnerer taperloddene i den rekkefølgen de skal slukkes, og antall deltakere.

export function shuffle<T>(list: T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function eliminationOrder(
  eligibleNumbers: number[],
  ownerOf: Map<number, string | null>,
  winnerNumber: number,
  winnerOwner: string | null
) {
  const others = eligibleNumbers.filter(n => n !== winnerNumber);
  const representatives = new Map<string, number>();
  for (const n of shuffle(others)) {
    const owner = ownerOf.get(n);
    if (owner && owner !== winnerOwner && !representatives.has(owner)) representatives.set(owner, n);
  }
  const repNumbers = new Set(representatives.values());
  return {
    losers: [...shuffle(others.filter(n => !repNumbers.has(n))), ...shuffle([...repNumbers])],
    participants: representatives.size + 1,
  };
}

// --- Tempo ---
// Pausen før neste lodd slukkes avhenger av hvor mange lodd som er igjen:
// mange lodd → raskt, få lodd → stadig saktere. Gir en jevn nedbremsing helt
// til siste lodd, i stedet for brå skifter.
//
//   pause(R) = MIN_GAP + SLOWDOWN / R^CURVE      (R = lodd igjen før slukking)
//
// Eksempler: 200 lodd ≈ 15 ms, 50 ≈ 30 ms, 10 ≈ 200 ms, 5 ≈ 450 ms, 3 ≈ 950 ms, 2 ≈ 1,7 s
const MIN_GAP = 15;
const SLOWDOWN = 4200;
const CURVE = 1.35;

export function eliminationGap(remaining: number) {
  return MIN_GAP + SLOWDOWN / Math.pow(Math.max(remaining, 2), CURVE);
}

// Tidspunkt (ms fra start) for når hvert taperlodd slukkes. Det siste tidspunktet
// er også avsløringen av vinneren.
export function eliminationTimes(loserCount: number) {
  const total = loserCount + 1; // + vinneren
  const times: number[] = [];
  let t = 0;
  for (let i = 0; i < loserCount; i++) {
    t += eliminationGap(total - i);
    times.push(Math.round(t));
  }
  return times;
}
