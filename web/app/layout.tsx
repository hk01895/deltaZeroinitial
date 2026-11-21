import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import SectorSelect from "@/components/SectorSelect";
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
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="font-medium text-slate-700">CareSlot</span>
                  <span>·</span>
                  <span>Powered by NVIDIA Nemotron</span>
                  {USING_MOCK && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      mock data
                    </span>
                  )}
                </div>
                <SectorSelect />
              </header>
              <main className="flex-1 px-8 py-6">{children}</main>
            </div>
          </div>
        </SectorProvider>
      </body>
    </html>
  );
}
