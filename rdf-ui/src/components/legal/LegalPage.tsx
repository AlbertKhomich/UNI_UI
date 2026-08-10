"use client";

import type { ReactNode } from "react";
import DiceFooter from "@/components/DiceFooter";
import PageContainer from "@/components/PageContainer";
import SiteHeader from "@/components/SiteHeader";
import { useTheme } from "@/hooks/useTheme";

type LegalPageProps = {
  children: ReactNode;
};

export default function LegalPage({ children }: LegalPageProps) {
  const { isDark, setTheme } = useTheme();

  return (
    <PageContainer className="flex min-h-screen flex-col bg-white text-slate-950 transition-colors dark:bg-slate-950 dark:text-white">
      <SiteHeader
        isDark={isDark}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      />

      <article className="mx-auto mt-10 w-full max-w-[720px] rounded-xl border border-slate-200 bg-white px-5 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.02)] dark:border-slate-800 dark:bg-slate-900 sm:px-8 sm:py-8 lg:mt-12">
        {children}
      </article>

      <DiceFooter className="mt-auto pt-10" />
    </PageContainer>
  );
}
