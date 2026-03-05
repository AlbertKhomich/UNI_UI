"use client";

import { useEffect, useMemo, useState } from "react";
import { countryCodeToFlag, countryCodeToName } from "@/lib/country";
import { bodyErrorMessage, toErrorMessage } from "@/lib/errors";
import type { Row } from "@/lib/types";
import type { Theme } from "./useTheme";

type TopCountriesApiEntry = {
  name?: string | null;
  value?: number | string | null;
};

type TopCountriesApiResponse = {
  error?: string;
  rows?: {
    totalPapers?: number | string | null;
    rows?: TopCountriesApiEntry[];
  };
};

function ccToColor(rank: number, theme: Theme): string {
  const alpha = Math.max(0.25, 1 - rank * 0.18);
  if (theme === "dark") return `rgba(255,255,255,${alpha})`;
  return `rgba(30,64,175,${Math.min(0.88, alpha)})`;
}

export function useCountryStats(theme: Theme) {
  const [countryRows, setCountryRows] = useState<Row[]>([]);
  const [countryLoading, setCountryLoading] = useState(false);
  const [countryErr, setCountryErr] = useState<string | null>(null);
  const [totalPapers, setTotalPapers] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function loadCountries() {
      setCountryLoading(true);
      setCountryErr(null);
      try {
        const response = await fetch("/api/top-countries");
        const contentType = response.headers.get("content-type") ?? "";

        let payload: unknown = null;
        if (contentType.includes("application/json")) payload = await response.json();
        else throw new Error((await response.text()) || `HTTP ${response.status}`);

        if (!response.ok) throw new Error(bodyErrorMessage(payload) ?? "Failed to load countries");

        const data = (payload as TopCountriesApiResponse) ?? {};
        const mappedRaw: Array<Row | null> = (data.rows?.rows ?? []).map((entry: TopCountriesApiEntry) => {
          const cc = String(entry.name ?? "").trim().toUpperCase();
          if (!/^[A-Z]{2}$/.test(cc)) return null;

          const papers = Number(entry.value) || 0;
          const countryName = countryCodeToName(cc, "en");
          const flag = countryCodeToFlag(cc);
          const labelWithCode = countryName && countryName !== cc ? `${countryName} (${cc})` : cc;
          const label = flag ? `${flag} ${labelWithCode}` : labelWithCode;

          return { name: label, value: papers, code: cc };
        });
        const mapped: Row[] = mappedRaw.filter((row): row is Row => row !== null);

        if (!cancelled) {
          setCountryRows(mapped);
          setTotalPapers(Number(data.rows?.totalPapers) || 0);
        }
      } catch (error: unknown) {
        if (!cancelled) setCountryErr(toErrorMessage(error));
      } finally {
        if (!cancelled) setCountryLoading(false);
      }
    }

    void loadCountries();
    return () => {
      cancelled = true;
    };
  }, []);

  const countryRowsWithColors = useMemo(
    () => countryRows.map((row, idx) => ({ ...row, color: ccToColor(idx, theme) })),
    [countryRows, theme],
  );

  return {
    countryRowsWithColors,
    countryLoading,
    countryErr,
    totalPapers,
  };
}
