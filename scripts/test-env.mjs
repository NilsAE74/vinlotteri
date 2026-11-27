// Testmiljø: lokal Postgres (i .testdb/) med testdata, og `next dev` på
// port 3001 som bruker den i stedet for Supabase. Lotteriet påvirkes ikke.
//
//   npm run test-env            start (lager databasen første gang)
//   npm run test-env -- --reset slett testdatabasen og start på nytt
//
// Adminpassord i testmiljøet: test

import { spawnSync, spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import Prisma from '@prisma/client';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = path.join(root, '.testdb');
const PORT = 54329;
const DB = 'vinlotteri_test';
const DATABASE_URL = `postgresql://postgres:test@127.0.0.1:${PORT}/${DB}`;

// Stopp en Postgres som ble hengende igjen fra forrige gang (f.eks. når terminalen ble lukket)
if (existsSync(path.join(dataDir, 'postmaster.pid'))) {
  const os = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[process.platform];
  const { pg_ctl } = await import(`@embedded-postgres/${os}-${process.arch}`);
  spawnSync(pg_ctl, ['stop', '-D', dataDir, '-m', 'fast'], { stdio: 'ignore' });
}
if (process.argv.includes('--reset')) rmSync(dataDir, { recursive: true, force: true });
const fresh = !existsSync(dataDir);

const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'test', port: PORT, persistent: true });
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase(DB);

// Alt under arver denne env-en; .env (Supabase) overstyrer ikke en verdi som allerede er satt
const env = { ...process.env, DATABASE_URL, ADMIN_PASSWORD: 'test', NEXT_DIST_DIR: '.next-test' };
if (!new URL(env.DATABASE_URL).hostname.startsWith('127.')) throw new Error('Testmiljøet må bruke lokal database');

const node = (script, args) => spawnSync(process.execPath, [path.join(root, script), ...args], { cwd: root, env, stdio: 'inherit' });
if (node('node_modules/prisma/build/index.js', ['db', 'push', '--skip-generate']).status !== 0) {
  await pg.stop();
  process.exit(1);
}

const prisma = new Prisma.PrismaClient({ datasourceUrl: DATABASE_URL });
if ((await prisma.ansatte.count()) === 0) await seed(prisma);
await prisma.$disconnect();

console.log(`\nTestmiljø: http://localhost:3001  (admin: /admin, passord «test»)\n`);
const next = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '-p', '3001'], { cwd: root, env, stdio: 'inherit' });
const stop = async () => {
  // På Windows lever next sine barneprosesser videre med vanlig kill
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(next.pid), '/t', '/f'], { stdio: 'ignore' });
  else next.kill();
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
next.on('exit', stop);

// Oppdiktede testdata. Første runde lages av forsiden når den åpnes.
async function seed(db) {
  const names = ['Test Testesen', 'Kari Prøve', 'Ola Eksempel', 'Siri Demo', 'Per Fiktiv', 'Anne Dummy'];
  await db.ansatte.createMany({ data: names.map(Navn => ({ Navn })) });
  await db.navneAlias.create({ data: { alias: 'tt', navn: 'Test Testesen' } });

  const facts = await db.funFact.createManyAndReturn({
    data: [
      { text: 'Testfakta: en vanlig vinflaske rommer 75 cl.' },
      { text: 'Testfakta: Champagne kommer fra Champagne-regionen i Frankrike.' },
      { text: 'Testfakta: Barolo lages av druen nebbiolo.' },
      { text: 'Testfakta: Rosévin får fargen fra kort skallkontakt.' },
      { text: 'Testfakta: Riesling er en hvit drue.' },
      { text: 'Testfakta: Portvin kommer fra Portugal.' },
    ],
  });
  const q = (id, text, options, answer, i) => ({ id, text, options, answer, factId: facts[i].id });
  await db.quizSporsmal.createMany({
    data: [
      q('test-flaske', 'Hvor mye rommer en vanlig vinflaske?', ['50 cl', '70 cl', '75 cl', '100 cl'], 2, 0),
      q('test-champagne', 'Hvor kommer champagne fra?', ['Spania', 'Frankrike', 'Italia', 'Tyskland'], 1, 1),
      q('test-barolo', 'Hvilken drue brukes i Barolo?', ['Nebbiolo', 'Merlot', 'Syrah', 'Malbec'], 0, 2),
      q('test-rose', 'Hva gir rosévin fargen?', ['Tilsatt farge', 'Kort skallkontakt', 'Eikefat', 'Sukker'], 1, 3),
      q('test-riesling', 'Hva slags drue er riesling?', ['Blå', 'Rød', 'Hvit', 'Rosa'], 2, 4),
      q('test-portvin', 'Hvilket land kommer portvin fra?', ['Portugal', 'Hellas', 'Chile', 'Ungarn'], 0, 5),
    ],
  });
  await db.regnskapspost.create({ data: { dato: new Date(), tekst: 'Inngående saldo (test)', belop: 100 } });

  // Aktiv runde for denne uken (samme navn som forsiden lager), med noen solgte lodd og tre viner
  const now = new Date();
  const thursday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 3 - ((now.getDay() + 6) % 7)));
  const week = Math.ceil(((thursday - Date.UTC(thursday.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7);
  await db.lotteryRound.create({
    data: {
      name: `Uke ${week}, ${thursday.getUTCFullYear()}`,
      winesConfirmed: true,
      tickets: {
        create: Array.from({ length: 200 }, (_, i) => {
          const owner = i < 60 && i % 3 !== 2 ? names[i % names.length] : null;
          return { number: i + 1, ownerName: owner, isTaken: !!owner };
        }),
      },
      wines: {
        create: [
          { info: 'Testvin Rød 2022 – Italia, Piemonte – 75 cl · 13,5% · Kr 199,90', position: 0 },
          { info: 'Testvin Hvit 2024 – Frankrike, Loire – 75 cl · 12% · Kr 179,90', position: 1 },
          { info: 'Testvin Musserende – Spania – 75 cl · 11,5% · Kr 1 049,90', position: 2 },
        ],
      },
    },
  });
  console.log('Testdata lagt inn.');
}
