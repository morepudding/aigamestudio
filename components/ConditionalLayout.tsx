"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/footer";

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOffice = pathname === "/";

  if (isOffice) {
    return (
      <div className="flex-1 h-screen overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto">
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 pb-24 md:px-10 md:py-10 md:pb-10 lg:px-14 lg:py-14">
        {children}
      </main>
      <Footer />
    </div>
  );
}
