// Spørsmålsbanken til ukens quiz. Hvert spørsmål er laget fra én fun fact i
// lib/wine-fun-facts.ts (factIndex), som vises som forklaring etter svaret.
// Rent modul uten sideeffekter, men importeres bare på serveren: klienten får
// aldri vite riktig svar før den har svart.
//
// `answer` er indeksen i `options` slik de står her. Rekkefølgen stokkes per
// runde før spørsmålet vises (se lib/quiz.ts).
//
// `id` må aldri endres eller gjenbrukes: påbegynte forsøk lagrer id-ene.

export type QuizQuestion = {
  id: string;
  text: string;
  options: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
  factIndex: number;
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { id: 'speyer', factIndex: 0, text: 'Hvor gammel er verdens eldste uåpnede vinflaske?', options: ['Rundt 200 år', 'Rundt 700 år', 'Rundt 1700 år', 'Rundt 3000 år'], answer: 2 },
  { id: 'georgia', factIndex: 1, text: 'Hvor er de eldste kjente sporene etter vinproduksjon funnet?', options: ['Frankrike', 'Georgia', 'Egypt', 'Hellas'], answer: 1 },
  { id: 'perignon', factIndex: 2, text: 'Hva brukte munken Dom Pérignon lang tid på?', options: ['Å finne opp champagne', 'Å hindre at vinen fikk bobler', 'Å lage den første champagnekorken', 'Å plante Pinot Noir i Champagne'], answer: 1 },
  { id: 'trykk', factIndex: 3, text: 'Hvor høyt er trykket i en champagneflaske?', options: ['Rundt 2 bar', 'Rundt 6 bar', 'Rundt 12 bar', 'Rundt 20 bar'], answer: 1 },
  { id: 'vinrotlus', factIndex: 4, text: 'Hvordan reddet man Europas vinmarker etter vinrotlusen?', options: ['Ved å sprøyte med svovel', 'Ved å pode vinstokkene på amerikanske røtter', 'Ved å flytte vinmarkene høyere opp', 'Ved å bytte til hvite druer'], answer: 1 },
  { id: 'cabernet', factIndex: 5, text: 'Cabernet Sauvignon er en krysning av Cabernet Franc og …', options: ['Merlot', 'Sauvignon Blanc', 'Pinot Noir', 'Syrah'], answer: 1 },
  { id: 'farge', factIndex: 6, text: 'Hvor kommer fargen i rødvin fra?', options: ['Saften i druen', 'Skallet', 'Eikefatet', 'Kjernene'], answer: 1 },
  { id: 'kork', factIndex: 7, text: 'Hvilket land står for rundt halvparten av verdens korkproduksjon?', options: ['Spania', 'Portugal', 'Italia', 'Frankrike'], answer: 1 },
  { id: 'zinfandel', factIndex: 8, text: 'Zinfandel fra California er samme drue som …', options: ['Primitivo', 'Malbec', 'Grenache', 'Syrah'], answer: 0 },
  { id: 'carmenere', factIndex: 10, text: 'Hvilken drue ble gjenoppdaget i Chile i 1994, etter å ha blitt dyrket som Merlot i årevis?', options: ['Carmenère', 'Malbec', 'Tannat', 'Petit Verdot'], answer: 0 },
  { id: 'taarer', factIndex: 11, text: 'Hva forteller «tårene» på innsiden av glasset noe om?', options: ['Kvaliteten', 'Alkoholinnholdet', 'Alderen', 'Sukkerinnholdet'], answer: 1 },
  { id: 'isvin', factIndex: 12, text: 'Hvor kaldt er det gjerne når druene til isvin høstes?', options: ['Rundt null grader', 'Tre minusgrader', 'Sju minusgrader eller kaldere', 'Tjue minusgrader'], answer: 2 },
  { id: 'edelraate', factIndex: 13, text: 'Hva heter soppen som gir Sauternes og Tokaji konsentrasjonen sin?', options: ['Edelråte', 'Gråskimmel', 'Meldugg', 'Flor'], answer: 0 },
  { id: 'paris', factIndex: 14, text: 'Hvilket år slo californiske viner de franske i blindtesten «Judgement of Paris»?', options: ['1956', '1976', '1989', '2001'], answer: 1 },
  { id: 'pinot', factIndex: 15, text: 'Pinot Gris og Pinot Blanc er …', options: ['mutasjoner av Pinot Noir', 'krysninger med Chardonnay', 'helt urelaterte druer', 'tyske navn på Pinot Noir'], answer: 0 },
  { id: 'portvin', factIndex: 17, text: 'Hvorfor er portvin søt?', options: ['Druene tørkes før pressing', 'Druebrennevin stopper gjæringen', 'Det tilsettes sukker etter gjæringen', 'Druene høstes frosne'], answer: 1 },
  { id: 'chablis', factIndex: 18, text: 'Hvilken drue lages Chablis av?', options: ['Sauvignon Blanc', 'Chardonnay', 'Riesling', 'Chenin Blanc'], answer: 1 },
  { id: 'malbec', factIndex: 19, text: 'I hvilket land er Malbec den viktigste druen i dag?', options: ['Chile', 'Argentina', 'Spania', 'Australia'], answer: 1 },
  { id: 'petroleum', factIndex: 20, text: 'Hvilken drue kan få petroleumsduft når vinen modnes?', options: ['Riesling', 'Chardonnay', 'Merlot', 'Nebbiolo'], answer: 0 },
  { id: 'tannin', factIndex: 21, text: 'Hvorfor gir tanniner en tørr, snerpende følelse i munnen?', options: ['De binder seg til proteiner i spyttet', 'De inneholder mye alkohol', 'De senker temperaturen i munnen', 'De er svært sure'], answer: 0 },
  { id: 'vinmonopolet', factIndex: 22, text: 'Hvilket år ble Vinmonopolet etablert?', options: ['1905', '1922', '1946', '1960'], answer: 1 },
  { id: 'magnum', factIndex: 23, text: 'Hvor mye rommer en magnum?', options: ['1 liter', '1,5 liter', '3 liter', '6 liter'], answer: 1 },
  { id: 'nebbiolo', factIndex: 24, text: 'Hva betyr nebbia, som trolig har gitt navn til Nebbiolo?', options: ['Tåke', 'Liten nebb', 'Mørk', 'Sen'], answer: 0 },
  { id: 'clicquot', factIndex: 25, text: 'Hva fant Madame Clicquot opp i 1816?', options: ['Champagneglasset', 'Et eget bord for remuage', 'Ståltråden rundt korken', 'Tørr champagne'], answer: 1 },
  { id: 'nv-champagne', factIndex: 26, text: 'Hvor lenge må champagne uten årgang minst lagres før den kan selges?', options: ['3 måneder', '15 måneder', '3 år', '5 år'], answer: 1 },
  { id: 'qvevri', factIndex: 27, text: 'Hva er en qvevri?', options: ['Et eggformet leirkar som graves ned', 'Et georgisk drikkehorn', 'En type eikefat', 'En gammel druesort'], answer: 0 },
  { id: 'mouton', factIndex: 29, text: 'Hvilket vinhus ble i 1973 rykket opp til første klasse i Bordeaux-klassifiseringen?', options: ['Château Margaux', 'Château Mouton Rothschild', 'Château Latour', 'Château Lafite Rothschild'], answer: 1 },
  { id: 'glera', factIndex: 30, text: 'Hva heter druen bak prosecco i dag?', options: ['Glera', 'Trebbiano', 'Garganega', 'Vermentino'], answer: 0 },
  { id: 'pinotage', factIndex: 33, text: 'I hvilket land ble Pinotage krysset fram?', options: ['Australia', 'New Zealand', 'Sør-Afrika', 'Chile'], answer: 2 },
  { id: 'barrique', factIndex: 34, text: 'Hvor mange vanlige flasker holder et Bordeaux-fat (barrique) til?', options: ['100', '200', '300', '500'], answer: 2 },
  { id: 'vinsten', factIndex: 35, text: 'Hva er de små krystallene du av og til finner på korken?', options: ['Glassbiter', 'Vinsten', 'Sukker', 'Salt fra korken'], answer: 1 },
  { id: 'korksmak', factIndex: 36, text: 'Hvilket stoff gir korksmak?', options: ['TCA', 'TDN', 'Sulfitt', 'Tannin'], answer: 0 },
  { id: 'nouveau', factIndex: 38, text: 'Når slippes Beaujolais Nouveau?', options: ['Første mandag i oktober', 'Tredje torsdag i november', 'Siste fredag i november', '1. desember'], answer: 1 },
  { id: 'flor', factIndex: 40, text: 'Hva heter gjærlaget som beskytter fino-sherry mot luft?', options: ['Flor', 'Bunnfall', 'Most', 'Edelråte'], answer: 0 },
  { id: 'madeira', factIndex: 41, text: 'Hva er spesielt med produksjonen av Madeira?', options: ['Vinen varmes opp med vilje', 'Vinen lagres under havet', 'Druene fryses før pressing', 'Vinen gjærer i leirkar'], answer: 0 },
  { id: 'retsina', factIndex: 42, text: 'Hva er den greske vinen retsina smaksatt med?', options: ['Harpiks fra furu', 'Anis', 'Honning', 'Rosmarin'], answer: 0 },
  { id: 'tempranillo', factIndex: 43, text: 'Hva betyr temprano, som har gitt navn til Tempranillo?', options: ['Tidlig', 'Mørk', 'Varm', 'Liten'], answer: 0 },
  { id: 'cannonau', factIndex: 44, text: 'Hva kalles Grenache på Sardinia?', options: ['Cannonau', 'Garnacha', 'Monastrell', 'Carignano'], answer: 0 },
  { id: 'prosecco', factIndex: 48, text: 'Hvor gjærer prosecco andre gang?', options: ['I hver enkelt flaske', 'I store ståltanker', 'I eikefat', 'I leirkar'], answer: 1 },
  { id: 'chianti', factIndex: 49, text: 'Hva er symbolet på flasker med Chianti Classico?', options: ['En svart hane', 'Et villsvin', 'En ørn', 'En hest'], answer: 0 },
];

export const QUESTIONS_PER_QUIZ = 5;
export const SECONDS_PER_QUESTION = 20;

// Klassene fra Bordeaux-klassifiseringen fra 1855, etter antall riktige svar (0–5)
const CLASSES = ['Ikke klassifisert', 'Cinquième Cru', 'Quatrième Cru', 'Troisième Cru', 'Deuxième Cru', 'Premier Cru'];
export function quizClass(score: number) {
  return CLASSES[Math.max(0, Math.min(CLASSES.length - 1, score))];
}
