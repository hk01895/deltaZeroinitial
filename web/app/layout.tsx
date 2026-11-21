import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { SectorProvider } from "@/components/SectorProvider";
import { USING_MOCK } from "@/lib/api";

export const metadata: Metadata = {
  title: "DeltaZero",
  description: "No difference between what you promised and what you shipped.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SectorProvider>
          <AppShell mock={USING_MOCK}>{children}</AppShell>
        </SectorProvider>
      </body>
    </html>
  );
}
