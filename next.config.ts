import type { NextConfig } from "next";

// Sikkerhetshoder som sendes med alle sider.
const securityHeaders = [
  // Siden kan ikke bygges inn i en iframe på andre nettsteder (hindrer clickjacking,
  // f.eks. at noen lurer en admin til å trykke «Trekk vinner»).
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: ["frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"].join("; "),
  },
  // Nettleseren skal ikke gjette filtyper
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Ikke send full URL til andre nettsteder (f.eks. Vipps og Vinmonopolet)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Siden trenger ikke kamera, mikrofon eller posisjon
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Bare HTTPS (Vercel sender dette også, men da er det eksplisitt)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Ikke røp at siden kjører Next.js
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
