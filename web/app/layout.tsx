import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Unbounded } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { SectorProvider } from "@/components/SectorProvider";
import { USING_MOCK } from "@/lib/api";

// Type system: Unbounded (display: headings, big numbers) · Manrope (text) · JetBrains Mono (code, IDs)
const display = Unbounded({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });
const body = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "DeltaZero",
  description: "No difference between what you promised and what you shipped.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <SectorProvider>
          <AppShell mock={USING_MOCK}>{children}</AppShell>
        </SectorProvider>
      </body>
    </html>
  );
}
