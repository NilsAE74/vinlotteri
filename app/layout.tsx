import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

// Fraunces: ordmerket og store tall (loddbok-følelsen) – det ene serif-øyeblikket.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

// Inter: all brødtekst og UI.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// IBM Plex Mono: det som faktisk er data – loddnummer, nedtelling, vindetaljer.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Vinlotteri",
  description: "Vinlotteri for RENE",
  icons: {
    icon: '/icon.svg',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = (cookieStore.get('admin-theme')?.value ?? 'dark') as 'dark' | 'light';

  return (
    <html lang="en" data-theme={theme}>
      <body
        className={`${fraunces.variable} ${inter.variable} ${plexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
