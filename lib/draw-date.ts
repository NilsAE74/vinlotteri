// Trekningsdag ut fra rundenavnet «Uke N, ÅÅÅÅ»: fredagen i den ISO-uken,
// f.eks. «fredag 27. november». Regnes i UTC så serverens tidssone ikke
// flytter datoen. Null hvis navnet ikke følger mønsteret.
export function drawDate(roundName: string): Date | null {
  const match = roundName.match(/Uke (\d+),\s*(\d{4})/);
  if (!match) return null;
  const week = Number(match[1]);
  const year = Number(match[2]);
  // 4. januar er alltid i ISO-uke 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday1 = Date.UTC(year, 0, 4 - ((jan4.getUTCDay() || 7) - 1));
  return new Date(monday1 + ((week - 1) * 7 + 4) * 86_400_000);
}

export function formatDrawDate(roundName: string): string | null {
  const friday = drawDate(roundName);
  if (!friday) return null;
  return new Intl.DateTimeFormat('nb-NO', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  }).format(friday);
}

// ISO-uke med tilhørende ISO-år (uke 1 kan starte i desember, uke 53 kan havne i januar)
export function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  return { week: Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7), year };
}
